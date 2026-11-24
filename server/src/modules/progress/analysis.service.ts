import prisma from '../../db.js';
import { FilesystemService } from '../filesystem/filesystem.service.js';
import {
  buildAssessment,
  discoverScope,
  generateAssessmentNarrative,
  prepareProject,
  refineFeaturesWithOllama,
  healthStatusFor,
  EVALUATION_FRAMEWORK_VERSION,
  ProjectMeta,
  ProjectType,
  PROJECT_TYPES,
  RequirementInput,
  RequirementSource,
  AssessmentPayload,
} from './evaluation/index.js';

export interface ScanProgressCallback {
  (stage: string, percent: number, message: string): void;
}

export interface AnalysisOptions {
  onProgress?: ScanProgressCallback;
  previewUrl?: string | null;
  refreshScope?: boolean;
  useAI?: boolean;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export class AnalysisService {
  /**
   * Evaluation Framework V2 pipeline:
   * discovery -> classification -> scope -> feature evidence -> dimensions ->
   * deterministic metrics -> narrative/recommendations -> immutable snapshot.
   */
  public static async executeAnalysisPipeline(projectId: string, options: AnalysisOptions | ScanProgressCallback = {}) {
    const opts: AnalysisOptions = typeof options === 'function' ? { onProgress: options } : options;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        features: { orderBy: { createdAt: 'asc' } },
        tasks: { select: { title: true, status: true } },
      },
    });

    if (!project) throw new Error('Project not found');
    if (!project.rootPath) {
      throw new Error('Project does not have a linked local directory. Please configure a directory path first.');
    }

    const job = await prisma.analysisJob.create({
      data: {
        projectId,
        status: 'RUNNING',
        currentStage: 'STAGE 1: Filesystem Discovery',
        progressPercent: 5.0,
        startedAt: new Date(),
      },
    });

    const notify = (stage: string, percent: number, msg: string) => {
      if (opts.onProgress) opts.onProgress(stage, percent, msg);
      prisma.analysisJob
        .update({ where: { id: job.id }, data: { currentStage: stage, progressPercent: percent } })
        .catch(() => {});
    };

    try {
      // STAGE 1 — Filesystem discovery
      notify('STAGE 1: Filesystem Discovery', 8.0, 'Recursively indexing files and calculating SHA-256 hashes...');
      const scanResult = await FilesystemService.scanProjectDirectory(
        projectId,
        project.rootPath,
        [],
        512 * 1024,
        (scanned, currentFile) => {
          if (scanned % 15 === 0) {
            notify('STAGE 1: Filesystem Discovery', 8 + Math.min(15, scanned / 6), `Indexed ${currentFile}`);
          }
        }
      );
      const files = scanResult.files;

      await prisma.analysisJob.update({
        where: { id: job.id },
        data: { scannedFilesCount: files.length, totalFilesCount: files.length },
      });

      // STAGE 2 — Classification and project-aware preparation
      notify('STAGE 2: Project Classification', 28.0, 'Classifying project type and loading category-specific evaluation framework...');
      const meta: ProjectMeta = {
        name: project.name,
        description: project.description,
        category: project.category,
        objective: project.objective,
        expectedDeliverables: project.expectedDeliverables,
        techStack: (() => {
          try {
            return JSON.parse(project.techStack || '[]');
          } catch {
            return [];
          }
        })(),
      };

      const userTypeOverride =
        project.projectTypeSource === 'USER' && project.projectType && PROJECT_TYPES.includes(project.projectType as ProjectType)
          ? (project.projectType as ProjectType)
          : null;

      const prepared = await prepareProject({
        meta,
        files,
        rootPath: project.rootPath,
        userTypeOverride,
        previewUrl: opts.previewUrl || null,
      });

      // STAGE 3 — Scope discovery (first assessment or explicit refresh)
      const shouldDiscoverScope =
        project.features.length === 0 || opts.refreshScope === true || project.scopeApprovedAt === null;

      if (shouldDiscoverScope) {
        notify('STAGE 3: Requirements Discovery', 40.0, 'Discovering pages, endpoints, planned requirements and evidence-backed gaps...');

        const existingForDiscovery =
          opts.refreshScope === true
            ? project.features
                .filter((f) => ['ORIGINAL_PLANNED', 'USER_CONFIRMED'].includes(f.source) || f.userModified)
                .map(this.toExistingRow)
            : project.features.map(this.toExistingRow);

        const discovered = discoverScope({
          signals: prepared.signals,
          classification: prepared.classification,
          framework: prepared.framework,
          website: prepared.website,
          corpus: prepared.corpus,
          existingFeatures: existingForDiscovery,
          taskTitles: project.tasks.map((t) => t.title),
        });

        await this.persistScope(projectId, discovered, opts.refreshScope === true);
      }

      const currentFeatures = await prisma.feature.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      });

      // STAGE 4 — Feature-level evidence assessment
      notify('STAGE 4: Feature Evidence Assessment', 56.0, 'Evaluating expected functionality against code, routes, forms and runtime evidence...');

      let aiRefinedCount = 0;
      const built = await buildAssessment({
        meta,
        files,
        rootPath: project.rootPath,
        taskTitles: project.tasks.map((t) => t.title),
        existingFeatures: currentFeatures.map(this.toExistingRow),
        userTypeOverride,
        weightOverrides: this.parseWeights(project.dimensionWeightOverrides),
        prepared,
        runtime: prepared.runtime,
        scopeMode: 'existing',
        scopeApproved: Boolean(project.scopeApprovedAt),
        scannedFiles: files.length,
        totalCodeLines: scanResult.totalCodeLines,
        refineFeatures: async (features) => {
          if (opts.useAI === false) return features;
          const result = await refineFeaturesWithOllama(
            project.name,
            prepared.classification.projectTypeLabel,
            features
          );
          aiRefinedCount = result.applied;
          return result.features;
        },
      });

      const payload = built.payload;
      payload.aiAssisted = aiRefinedCount > 0;

      // STAGE 5 — Deterministic scoring
      notify('STAGE 5: Deterministic Scoring', 74.0, 'Normalising applicable dimension weights and computing independent metrics...');

      // Persist the assessed features and their evidence
      for (const assessment of payload.features) {
        if (!assessment.id) continue;
        const row = currentFeatures.find((f) => f.id === assessment.id);
        if (!row) continue;

        await prisma.featureEvidence.deleteMany({ where: { featureId: row.id } });
        if (assessment.evidences.length > 0) {
          await prisma.featureEvidence.createMany({
            data: assessment.evidences.map((evidence) => ({
              featureId: row.id,
              filePath: evidence.filePath,
              symbolOrComponent: evidence.symbolOrComponent || null,
              evidenceDescription: evidence.evidenceDescription,
              status: evidence.status,
              confidence: evidence.confidence,
              lineStart: evidence.lineStart || null,
              lineEnd: evidence.lineEnd || null,
            })),
          });
        }

        await prisma.feature.update({
          where: { id: row.id },
          data: {
            dimension: assessment.dimension,
            category: assessment.category,
            expectedFunctionality: row.userModified ? row.expectedFunctionality : assessment.expectedFunctionality,
            weight: row.userModified ? row.weight : assessment.weight,
            estimatedProgress: assessment.completion,
            verificationConfidence: assessment.confidence,
            status: assessment.status,
            verificationStatus: assessment.verificationStatus,
            missingRequirements: assessment.missingRequirements,
            included: row.userModified ? row.included : assessment.included,
            lastAssessedAt: new Date(),
          },
        });
      }

      // STAGE 6 — Narrative synthesis (never changes scores)
      notify('STAGE 6: Evidence Synthesis', 88.0, 'Summarising verified implementation, gaps and methodology notes...');
      const narrative =
        opts.useAI === false ? null : await generateAssessmentNarrative(payload);
      const narrativeSummary = narrative || payload.summary;

      const report = await this.createAnalysisReport({
        jobId: job.id,
        projectId,
        prepared,
        payload,
        narrative: narrativeSummary,
        totalTodos: files.reduce((sum, f) => sum + f.todos.length, 0),
        testFilesCount: files.filter((f) => f.fileCategory === 'TEST').length,
        largeFiles: files.filter((f) => f.linesOfCode > 400).map((f) => f.relativePath),
      });

      // STAGE 7 — Snapshot, history, recommendations
      notify('STAGE 7: Snapshot & Recommendations', 96.0, 'Recording an immutable V2 assessment and generating next actions...');

      const assessmentRecord = await prisma.projectAssessment.create({
        data: {
          projectId,
          scanJobId: job.id,
          frameworkVersion: EVALUATION_FRAMEWORK_VERSION,
          projectType: payload.projectType,
          projectTypeLabel: payload.projectTypeLabel,
          projectTypeSource: payload.projectTypeSource,
          classificationConfidence: payload.classification.confidence,
          productCompletion: payload.scores.productCompletion,
          technicalCompletion: payload.scores.technicalCompletion,
          productionReadiness: payload.scores.productionReadiness,
          evaluationConfidence: payload.scores.evaluationConfidence,
          overallProgress: payload.scores.overallProgress,
          scopeApproved: payload.scopeApproved,
          aiAssisted: payload.aiAssisted,
          dimensionsJson: JSON.stringify(payload.dimensions),
          featuresJson: JSON.stringify(payload.features),
          scopeJson: JSON.stringify(payload.scope),
          nextActionsJson: JSON.stringify(payload.nextActions),
          classificationJson: JSON.stringify(payload.classification),
          websiteJson: payload.website ? JSON.stringify(payload.website) : null,
          summary: narrativeSummary,
          notes: JSON.stringify(payload.notes),
        },
      });

      const completedFeatures = payload.scores.featureCounts.implemented;
      await prisma.progressSnapshot.create({
        data: {
          projectId,
          overallProgress: payload.scores.overallProgress,
          verificationConfidence: payload.scores.evaluationConfidence,
          totalFeatures: payload.features.filter((f) => f.included).length,
          completedFeatures,
          scanJobId: job.id,
          frameworkVersion: EVALUATION_FRAMEWORK_VERSION,
          productCompletion: payload.scores.productCompletion,
          technicalCompletion: payload.scores.technicalCompletion,
          productionReadiness: payload.scores.productionReadiness,
          assessmentId: assessmentRecord.id,
          summary: `V2 assessment: product ${payload.scores.productCompletion ?? 'n/a'}%, technical ${
            payload.scores.technicalCompletion ?? 'n/a'
          }%, readiness ${payload.scores.productionReadiness ?? 'n/a'}%, confidence ${payload.scores.evaluationConfidence}%.`,
        },
      });

      // A user-marked completed project stays at 100%; the assessment itself is
      // still recorded below, so evidence stays inspectable without lowering it.
      const isMarkedComplete = project.status === 'COMPLETED';
      await prisma.project.update({
        where: { id: projectId },
        data: {
          overallProgress: isMarkedComplete ? 100 : payload.scores.productCompletion ?? 0,
          verificationConfidence: payload.scores.evaluationConfidence,
          projectType: payload.projectType,
          projectTypeSource: payload.projectTypeSource,
          projectTypeConfidence: payload.classification.confidence,
          lastScanAt: new Date(),
          healthStatus: isMarkedComplete
            ? 'EXCELLENT'
            : healthStatusFor(payload.scores.productCompletion, payload.scores.productionReadiness),
        },
      });

      await this.replaceRecommendations(projectId, payload);

      await prisma.projectActivity.create({
        data: {
          projectId,
          type: 'SCAN_COMPLETED',
          description: `Evaluation Framework V2 scan completed: product ${payload.scores.productCompletion ?? 'n/a'}%, technical ${
            payload.scores.technicalCompletion ?? 'n/a'
          }%, production readiness ${payload.scores.productionReadiness ?? 'n/a'}% across ${files.length} files.`,
        },
      });

      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          currentStage: 'COMPLETED',
          progressPercent: 100.0,
          completedAt: new Date(),
        },
      });

      notify('COMPLETE', 100.0, 'Evaluation Framework V2 assessment completed.');

      const scopeReviewRequired = !project.scopeApprovedAt;

      return {
        jobId: job.id,
        assessmentId: assessmentRecord.id,
        frameworkVersion: EVALUATION_FRAMEWORK_VERSION,
        overallProgress: payload.scores.overallProgress,
        productCompletion: payload.scores.productCompletion,
        technicalCompletion: payload.scores.technicalCompletion,
        productionReadiness: payload.scores.productionReadiness,
        verificationConfidence: payload.scores.evaluationConfidence,
        evaluationConfidence: payload.scores.evaluationConfidence,
        scannedFilesCount: files.length,
        totalCodeLines: scanResult.totalCodeLines,
        featuresAssessed: payload.features.length,
        featureCounts: payload.scores.featureCounts,
        projectType: payload.projectType,
        projectTypeLabel: payload.projectTypeLabel,
        classificationConfidence: payload.classification.confidence,
        scopeReviewRequired,
        scopeApproved: Boolean(project.scopeApprovedAt) && !scopeReviewRequired,
        aiAssisted: payload.aiAssisted,
        excludedDimensions: payload.dimensions.filter((d) => !d.applicable).map((d) => d.key),
        notes: payload.notes,
        report,
      };
    } catch (err: any) {
      console.error('[AnalysisService Error]:', err);
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: err.message || 'Unknown scan error',
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  private static toExistingRow(feature: {
    id: string;
    name: string;
    description: string;
    category: string;
    dimension: string;
    source: string;
    included: boolean;
    userModified: boolean;
  }) {
    return {
      id: feature.id,
      name: feature.name,
      description: feature.description,
      category: feature.category,
      dimension: feature.dimension,
      source: feature.source,
      included: feature.included,
      userModified: feature.userModified,
    };
  }

  private static parseWeights(raw: string | null): Record<string, number> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const result: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) result[key] = value;
      }
      return result;
    } catch {
      return {};
    }
  }

  /**
   * Persist inferred/planned scope without destroying user-confirmed entries.
   * On an explicit refresh, stale auto-discovered entries are excluded rather
   * than deleted, preserving history and user visibility.
   */
  private static async persistScope(
    projectId: string,
    requirements: RequirementInput[],
    refresh: boolean
  ) {
    const existing = await prisma.feature.findMany({ where: { projectId } });
    const byId = new Map(existing.map((f) => [f.id, f]));
    const byKey = new Map(existing.map((f) => [`${normalizeTitle(f.name)}::${f.dimension}`, f]));
    const keptIds = new Set<string>();

    for (const requirement of requirements) {
      const validSources: RequirementSource[] = [
        'ORIGINAL_PLANNED',
        'AI_DISCOVERED',
        'AI_INFERRED_MISSING',
        'USER_CONFIRMED',
      ];
      const source = validSources.includes(requirement.source) ? requirement.source : 'AI_DISCOVERED';

      const row =
        (requirement.id ? byId.get(requirement.id) : undefined) ||
        byKey.get(`${normalizeTitle(requirement.title)}::${requirement.dimension}`);

      if (row) {
        keptIds.add(row.id);
        if (row.userModified) {
          // Never overwrite user-edited scope metadata.
          continue;
        }
        await prisma.feature.update({
          where: { id: row.id },
          data: {
            name: requirement.title,
            description: requirement.description,
            dimension: requirement.dimension,
            source: row.source === 'USER_CONFIRMED' ? 'USER_CONFIRMED' : source,
            expectedFunctionality: requirement.expectedFunctionality || requirement.description,
            included: requirement.included,
          },
        });
        continue;
      }

      const created = await prisma.feature.create({
        data: {
          projectId,
          name: requirement.title,
          description: requirement.description,
          dimension: requirement.dimension,
          category: requirement.dimension,
          source,
          expectedFunctionality: requirement.expectedFunctionality || requirement.description,
          weight: requirement.priority === 'CRITICAL' ? 20 : requirement.priority === 'LOW' ? 6 : 12,
          included: requirement.included,
          status: 'MISSING',
          verificationStatus: 'UNVERIFIED',
        },
      });
      keptIds.add(created.id);
    }

    if (refresh) {
      const stale = existing.filter(
        (f) =>
          !keptIds.has(f.id) &&
          !f.userModified &&
          ['AI_DISCOVERED', 'AI_INFERRED_MISSING'].includes(f.source)
      );
      for (const row of stale) {
        await prisma.feature.update({ where: { id: row.id }, data: { included: false } });
      }
    }
  }

  private static detectTechStack(prepared: Awaited<ReturnType<typeof prepareProject>>): string[] {
    const stack = new Set<string>();
    const deps = [...prepared.signals.dependencies, ...prepared.signals.devDependencies].join(' ');
    const paths = prepared.signals.files.map((f) => f.relativePath.toLowerCase());

    if (/react/.test(deps) || paths.some((p) => p.endsWith('.tsx') || p.endsWith('.jsx'))) stack.add('React');
    if (/next/.test(deps)) stack.add('Next.js');
    if (/vue/.test(deps)) stack.add('Vue');
    if (/svelte/.test(deps)) stack.add('Svelte');
    if (/express/.test(deps)) stack.add('Express');
    if (/fastify/.test(deps)) stack.add('Fastify');
    if (/prisma/.test(deps)) stack.add('Prisma');
    if (/drizzle/.test(deps)) stack.add('Drizzle ORM');
    if (/sqlite|better-sqlite3/.test(deps)) stack.add('SQLite');
    if (/postgres|pg/.test(deps)) stack.add('PostgreSQL');
    if (/mongodb|mongoose/.test(deps)) stack.add('MongoDB');
    if (/tailwind/.test(deps)) stack.add('Tailwind CSS');
    if (/three/.test(deps)) stack.add('Three.js');
    if (/cannon|rapier/.test(deps)) stack.add('Physics Engine');
    if (/electron/.test(deps)) stack.add('Electron');
    if (/@tauri-apps|tauri/.test(deps)) stack.add('Tauri');
    if (/react-native|expo/.test(deps)) stack.add('React Native / Expo');
    if (/openai|anthropic|langchain|ollama/.test(deps)) stack.add('LLM Runtime');
    if (/vitest|jest|mocha|playwright|cypress/.test(deps)) stack.add('Test Runner');

    if (paths.some((p) => p.endsWith('.ts') || p.endsWith('.tsx'))) stack.add('TypeScript');
    if (paths.some((p) => p.endsWith('.html'))) stack.add('HTML5');
    if (paths.some((p) => p.endsWith('.css') || p.endsWith('.scss'))) stack.add('CSS3');
    if (paths.some((p) => p.endsWith('.py'))) stack.add('Python');

    return Array.from(stack);
  }

  private static async createAnalysisReport(args: {
    jobId: string;
    projectId: string;
    prepared: Awaited<ReturnType<typeof prepareProject>>;
    payload: AssessmentPayload;
    narrative: string;
    totalTodos: number;
    testFilesCount: number;
    largeFiles: string[];
  }) {
    const { jobId, projectId, prepared, payload, narrative, totalTodos, testFilesCount, largeFiles } = args;
    const techStack = this.detectTechStack(prepared);
    const appliedDimensions = payload.dimensions.filter((d) => d.applicable);

    const frontendStructure =
      prepared.website.pages.length > 0
        ? `${prepared.website.pages.length} page(s)/route(s): ${prepared.website.pages
            .map((p) => p.route)
            .slice(0, 6)
            .join(', ')}`
        : 'No web routes detected';
    const backendStructure =
      prepared.website.backendRouteCount > 0
        ? `${prepared.website.backendRouteCount} server route handler(s) detected`
        : 'No server route handlers detected';
    const databaseStructure = prepared.signals.files.some((f) => /(schema\.prisma|\.sql$|migrations?\/)/i.test(f.relativePath))
      ? 'Database schema/migrations detected'
      : 'No database schema detected';

    const blockers = payload.features
      .filter((f) => f.included && ['MISSING', 'PLACEHOLDER'].includes(f.status))
      .slice(0, 5)
      .map((f) => `${f.name}: ${f.missingRequirements || f.status}`);

    return prisma.analysisReport.create({
      data: {
        jobId,
        projectId,
        architectureSummary: narrative,
        techStackDetected: JSON.stringify(techStack),
        frontendStructure,
        backendStructure,
        databaseStructure,
        apiRoutesSummary:
          prepared.website.backendRouteCount > 0
            ? `${prepared.website.backendRouteCount} server route(s); ${prepared.website.apiCalls} client API call(s)`
            : `${prepared.website.apiCalls} client API call(s)`,
        componentsSummary: `${prepared.signals.files.filter((f) => /(^|\/)components\//i.test(f.relativePath)).length} component file(s)`,
        blockersDetected: JSON.stringify(blockers),
        technicalDebt: JSON.stringify({
          frameworkVersion: EVALUATION_FRAMEWORK_VERSION,
          todosCount: totalTodos,
          testsCount: testFilesCount,
          largeFiles,
          featureCounts: payload.scores.featureCounts,
          dimensions: appliedDimensions.map((d) => ({
            key: d.key,
            metric: d.metric,
            score: d.score,
            weight: d.weight,
            confidence: d.confidence,
          })),
          excludedDimensions: payload.dimensions
            .filter((d) => !d.applicable)
            .map((d) => ({ key: d.key, reason: d.exclusionReason })),
          methodologyNotes: payload.notes,
        }),
        rawModelOutput: narrative,
      },
    });
  }

  private static async replaceRecommendations(projectId: string, payload: AssessmentPayload) {
    await prisma.aIRecommendation.deleteMany({
      where: { projectId, isConvertedToTask: false },
    });

    for (const action of payload.nextActions) {
      await prisma.aIRecommendation.create({
        data: {
          projectId,
          title: action.title,
          explanation: action.explanation,
          recommendedAction: action.recommendedAction,
          priority: action.priority,
          category: action.category,
          relatedFeatureId: action.relatedFeatureId || null,
        },
      });
    }
  }
}

