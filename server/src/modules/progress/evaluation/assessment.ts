import type { FileMetadata } from '../../filesystem/filesystem.service.js';
import { classifyProject } from './classifier.js';
import { SourceCorpus } from './corpus.js';
import { evaluateDimensions } from './dimensions.js';
import { assessFeatures } from './evidence-engine.js';
import { getFramework } from './frameworks.js';
import { buildScores, finalizeDimensions } from './scoring.js';
import { discoverScope, ExistingFeatureRow, inferDimension } from './scope-discovery.js';
import { analyzeWebsite } from './website-analyzer.js';
import { buildProjectSignals } from './signals.js';
import { runRuntimeChecks } from './runtime-check.js';
import {
  AssessmentPayload,
  DimensionResult,
  FeatureAssessment,
  NextAction,
  ProjectMeta,
  ProjectType,
  RequirementInput,
  RuntimeCheckSummary,
  WebsiteAnalysis,
} from './types.js';

export interface PrepareInput {
  meta: ProjectMeta;
  files: FileMetadata[];
  rootPath: string;
  userTypeOverride?: ProjectType | null;
  previewUrl?: string | null;
}

export interface PreparedProject {
  corpus: SourceCorpus;
  signals: ReturnType<typeof buildProjectSignals>;
  classification: ReturnType<typeof classifyProject>;
  framework: ReturnType<typeof getFramework>;
  website: WebsiteAnalysis;
  runtime: RuntimeCheckSummary | null;
}

/**
 * Read-only preparation shared by scope discovery and assessment so both see
 * identical signals. Optional loopback runtime checks verify route responses.
 */
export async function prepareProject(input: PrepareInput): Promise<PreparedProject> {
  const corpus = new SourceCorpus(input.files);
  const signals = buildProjectSignals(input.meta, input.files, input.rootPath, corpus);
  const classification = classifyProject(signals, input.userTypeOverride || null);
  const framework = getFramework(classification.projectType);

  let runtime: RuntimeCheckSummary | null = null;
  let website = analyzeWebsite(signals, corpus);

  if (input.previewUrl) {
    runtime = await runRuntimeChecks(input.previewUrl, website.routes.length > 0 ? website.routes : ['/']);
    if (runtime.checkedRoutes > 0) {
      website = analyzeWebsite(signals, corpus, runtime);
    }
  }

  return { corpus, signals, classification, framework, website, runtime };
}

export interface BuildAssessmentInput {
  meta: ProjectMeta;
  files: FileMetadata[];
  rootPath: string;
  taskTitles: string[];
  existingFeatures: ExistingFeatureRow[];
  userTypeOverride?: ProjectType | null;
  weightOverrides?: Record<string, number>;
  runtime?: RuntimeCheckSummary | null;
  prepared?: PreparedProject;
  scopeMode?: 'discover' | 'existing';
  scopeApproved: boolean;
  scannedFiles: number;
  totalCodeLines: number;
  aiAssisted?: boolean;
  refineFeatures?: (features: FeatureAssessment[]) => Promise<FeatureAssessment[]>;
}

export interface BuiltAssessment {
  payload: AssessmentPayload;
  scope: RequirementInput[];
  deterministic: {
    productCompletion: number | null;
    technicalCompletion: number | null;
    productionReadiness: number | null;
    evaluationConfidence: number;
    overallProgress: number;
  };
}

function buildNextActions(
  features: FeatureAssessment[],
  dimensions: DimensionResult[]
): NextAction[] {
  const actions: NextAction[] = [];
  const seen = new Set<string>();

  const push = (action: NextAction) => {
    const key = action.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    actions.push(action);
  };

  const incomplete = features
    .filter((f) => f.included && ['MISSING', 'PLACEHOLDER', 'PARTIALLY_IMPLEMENTED'].includes(f.status))
    .sort((a, b) => {
      const statusRank = (s: string) => (s === 'MISSING' ? 3 : s === 'PLACEHOLDER' ? 2 : 1);
      return statusRank(b.status) - statusRank(a.status) || b.weight - a.weight;
    });

  for (const feature of incomplete.slice(0, 6)) {
    push({
      title: `Complete "${feature.name}"`,
      explanation:
        feature.missingRequirements ||
        `Current evidence places this requirement at ${feature.completion}% (${feature.status.toLowerCase().replace(/_/g, ' ')}).`,
      recommendedAction:
        feature.expectedFunctionality ||
        `Implement the remaining behaviour and verify it in the running application.`,
      priority: feature.status === 'MISSING' ? 'CRITICAL' : feature.weight >= 15 ? 'HIGH' : 'MEDIUM',
      category: feature.dimension === 'testing' ? 'TEST' : 'NEXT_STEP',
      dimension: feature.dimension,
      relatedFeatureId: feature.id || null,
    });
  }

  const weakDimensions = dimensions
    .filter((d) => d.applicable && d.score !== null && d.score < 60)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, 3);

  for (const dimension of weakDimensions) {
    const unmet = dimension.evidence.filter((e) => !e.satisfied).slice(0, 2);
    push({
      title: `Strengthen ${dimension.name}`,
      explanation: `${dimension.name} is at ${dimension.score}%. ${unmet.map((e) => e.detail).join(' ') || dimension.summary}`,
      recommendedAction: unmet.length > 0 ? unmet.map((e) => e.label).join('; ') : dimension.description,
      priority: (dimension.score as number) < 35 ? 'HIGH' : 'MEDIUM',
      category: dimension.metric === 'READINESS' ? 'TEST' : 'ARCHITECTURE',
      dimension: dimension.key,
      relatedFeatureId: null,
    });
  }

  return actions.slice(0, 8);
}

function buildNotes(
  website: WebsiteAnalysis | null,
  dimensions: DimensionResult[],
  runtime: RuntimeCheckSummary | null | undefined
): string[] {
  const notes = [
    'Evaluation Framework V2 uses category-specific dimensions, requirement-level evidence and deterministic weighted scoring. Scores are not directly comparable to V1 snapshots because the methodology changed.',
    'Completion metrics (Product, Technical, Production Readiness) are calculated independently and are never averaged into one leaderboard score.',
    'Feature completion is clamped to its evidence class (missing, placeholder, partial, implemented, verified); an assessment model cannot choose the final project percentage.',
  ];

  if (website) {
    if (website.runtime.checkedRoutes > 0) {
      notes.push(
        `Runtime verification covered ${website.runtime.successfulRoutes}/${website.runtime.checkedRoutes} route(s) over HTTP. JavaScript-rendered behaviour was not exercised.`
      );
    } else {
      notes.push('No preview URL was supplied, so routes were not verified at runtime; page scores rely on source evidence only.');
    }
    notes.push('Responsive compatibility is reported as unverified unless an actual rendered viewport check was performed; breakpoint CSS alone cannot prove it.');
  }

  const excluded = dimensions.filter((d) => !d.applicable);
  if (excluded.length > 0) {
    notes.push(
      `Excluded as not applicable: ${excluded
        .map((d) => `${d.name} (${d.exclusionReason || 'no applicable evidence'})`)
        .join('; ')}. Their weight was redistributed across applicable criteria.`
    );
  }

  if (runtime) {
    notes.push(...runtime.notes);
  }

  return notes;
}

/**
 * Build a complete V2 assessment. Deterministic: the same signals and scope
 * always produce the same scores.
 */
export async function buildAssessment(input: BuildAssessmentInput): Promise<BuiltAssessment> {
  const prepared =
    input.prepared ||
    (await prepareProject({
      meta: input.meta,
      files: input.files,
      rootPath: input.rootPath,
      userTypeOverride: input.userTypeOverride,
      previewUrl: null,
    }));
  const { corpus, signals, classification, framework, website } = prepared;
  const runtime = input.runtime ?? prepared.runtime;

  const scope: RequirementInput[] =
    input.scopeMode === 'existing'
      ? input.existingFeatures.map((row) => ({
          id: row.id,
          title: row.name,
          description: row.description || '',
          dimension:
            row.dimension && framework.some((d) => d.key === row.dimension)
              ? row.dimension
              : inferDimension(`${row.name} ${row.description}`, framework),
          priority: 'HIGH',
          source: (row.source as RequirementInput['source']) || 'AI_DISCOVERED',
          included: row.included !== false,
          expectedFunctionality: row.description || row.name,
        }))
      : discoverScope({
          signals,
          classification,
          framework,
          website,
          corpus,
          existingFeatures: input.existingFeatures,
          taskTitles: input.taskTitles,
        });

  let features = assessFeatures({
    requirements: scope,
    signals,
    corpus,
    framework,
    website,
  });

  if (input.refineFeatures) {
    try {
      features = await input.refineFeatures(features);
    } catch {
      // Evidence interpretation is an enhancement; deterministic results stand if it fails.
    }
  }

  const dimensionContext = {
    signals,
    classification,
    website,
    requirements: scope,
    features,
    corpus,
  };

  const { framework: adjustedFramework, raw } = evaluateDimensions(
    framework,
    dimensionContext,
    input.weightOverrides || {}
  );
  const dimensions = finalizeDimensions(adjustedFramework, raw, features);
  const scores = buildScores(
    dimensions,
    features,
    input.scopeApproved,
    Boolean(runtime && runtime.checkedRoutes > 0)
  );

  const nextActions = buildNextActions(features, dimensions);
  const notes = buildNotes(website, dimensions, runtime);
  const missing = features.filter((f) => f.included && f.status === 'MISSING').length;
  const partial = features.filter(
    (f) => f.included && ['PARTIALLY_IMPLEMENTED', 'PLACEHOLDER'].includes(f.status)
  ).length;

  const summary =
    `Classified as ${classification.projectTypeLabel} (${classification.confidence}% classification confidence). ` +
    `${features.length} requirement(s) assessed: ${missing} missing, ${partial} partial, ` +
    `${features.filter((f) => f.included && f.status === 'IMPLEMENTED').length} implemented, ` +
    `${features.filter((f) => f.included && f.verificationStatus === 'VERIFIED').length} verified. ` +
    `Product ${scores.productCompletion ?? 'n/a'}%, technical ${scores.technicalCompletion ?? 'n/a'}%, ` +
    `production readiness ${scores.productionReadiness ?? 'n/a'}%.`;

  const payload: AssessmentPayload = {
    frameworkVersion: 'V2',
    projectType: classification.projectType,
    projectTypeLabel: classification.projectTypeLabel,
    projectTypeSource: classification.source,
    classification,
    scores,
    dimensions,
    features,
    scope,
    scopeApproved: input.scopeApproved,
    nextActions,
    notes,
    summary,
    aiAssisted: Boolean(input.aiAssisted),
    scannedFiles: input.scannedFiles,
    totalCodeLines: input.totalCodeLines,
    website: website.analyzed ? website : null,
  };

  return {
    payload,
    scope,
    deterministic: {
      productCompletion: scores.productCompletion,
      technicalCompletion: scores.technicalCompletion,
      productionReadiness: scores.productionReadiness,
      evaluationConfidence: scores.evaluationConfidence,
      overallProgress: scores.overallProgress,
    },
  };
}
