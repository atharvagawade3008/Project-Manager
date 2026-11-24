import { Router, Request, Response, NextFunction } from 'express';
import { AnalysisService } from './analysis.service.js';
import prisma from '../../db.js';
import {
  EVALUATION_FRAMEWORK_VERSION,
  FRAMEWORKS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  ProjectType,
  inferDimension,
  getFramework,
} from './evaluation/index.js';

export const progressRouter = Router();

function apiError(res: Response, status: number, message: string) {
  return res.status(status).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
}

function validProjectType(value: unknown): value is ProjectType {
  return typeof value === 'string' && PROJECT_TYPES.includes(value as ProjectType);
}

function allFrameworkDimensionKeys(): string[] {
  const keys = new Set<string>();
  for (const framework of Object.values(FRAMEWORKS)) {
    for (const dimension of framework) keys.add(dimension.key);
  }
  return Array.from(keys);
}

// POST /api/progress/scan/:projectId
progressRouter.post('/scan/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const previewUrl =
      typeof req.body?.previewUrl === 'string' && req.body.previewUrl.trim().length > 0
        ? req.body.previewUrl.trim()
        : null;
    const result = await AnalysisService.executeAnalysisPipeline(projectId, {
      previewUrl,
      refreshScope: req.body?.refreshScope === true,
      useAI: req.body?.useAI !== false,
    });
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/jobs/:jobId
progressRouter.get('/jobs/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = String(req.params.jobId);
    const job = await prisma.analysisJob.findUnique({ where: { id: jobId } });
    if (!job) return apiError(res, 404, 'Job not found');
    res.json({ success: true, data: job, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/report/:projectId
progressRouter.get('/report/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const report = await prisma.analysisReport.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const features = await prisma.feature.findMany({
      where: { projectId },
      orderBy: { weight: 'desc' },
      include: { evidences: { orderBy: { confidence: 'desc' } } },
    });

    res.json({
      success: true,
      data: { report, features },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/snapshots/:projectId — append-only history; V1 rows preserved.
progressRouter.get('/snapshots/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const snapshots = await prisma.progressSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: snapshots, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/assessment/:projectId
progressRouter.get('/assessment/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return apiError(res, 404, 'Project not found');

    const latest = await prisma.projectAssessment.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const historyRows = await prisma.projectAssessment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        frameworkVersion: true,
        projectType: true,
        projectTypeLabel: true,
        productCompletion: true,
        technicalCompletion: true,
        productionReadiness: true,
        evaluationConfidence: true,
        overallProgress: true,
        scopeApproved: true,
        aiAssisted: true,
      },
    });

    const legacySnapshots = await prisma.progressSnapshot.findMany({
      where: { projectId, frameworkVersion: { not: EVALUATION_FRAMEWORK_VERSION } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const scopeFeatures = await prisma.feature.findMany({
      where: { projectId },
      orderBy: [{ weight: 'desc' }, { createdAt: 'asc' }],
      include: { evidences: { orderBy: { confidence: 'desc' } } },
    });

    let assessment = null;
    if (latest) {
      const parse = <T>(raw: string | null, fallback: T): T => {
        try {
          return raw ? (JSON.parse(raw) as T) : fallback;
        } catch {
          return fallback;
        }
      };
      const features = parse<any[]>(latest.featuresJson, []);
      const includedFeatures = features.filter((feature) => feature.included !== false);
      const classification = parse<any>(latest.classificationJson, {});
      const featureCounts = {
        total: features.length,
        applicable: includedFeatures.length,
        implemented: includedFeatures.filter((feature) => feature.status === 'IMPLEMENTED').length,
        partiallyImplemented: includedFeatures.filter((feature) => feature.status === 'PARTIALLY_IMPLEMENTED').length,
        placeholder: includedFeatures.filter((feature) => feature.status === 'PLACEHOLDER').length,
        missing: includedFeatures.filter((feature) => feature.status === 'MISSING').length,
        cannotVerify: includedFeatures.filter((feature) => feature.status === 'CANNOT_VERIFY').length,
        notApplicable: includedFeatures.filter((feature) => feature.status === 'NOT_APPLICABLE').length,
        verified: includedFeatures.filter((feature) => feature.verificationStatus === 'VERIFIED').length,
      };

      assessment = {
        ...latest,
        dimensions: parse<any[]>(latest.dimensionsJson, []),
        features,
        scope: parse<any[]>(latest.scopeJson, []),
        nextActions: parse<any[]>(latest.nextActionsJson, []),
        notes: parse<string[]>(latest.notes, []),
        scores: {
          productCompletion: latest.productCompletion,
          technicalCompletion: latest.technicalCompletion,
          productionReadiness: latest.productionReadiness,
          evaluationConfidence: latest.evaluationConfidence,
          overallProgress: latest.overallProgress,
          featureCounts,
        },
        classification: classification.projectType
          ? classification
          : {
              projectType: latest.projectType,
              projectTypeLabel: latest.projectTypeLabel,
              source: latest.projectTypeSource,
              confidence: latest.classificationConfidence,
              rationale: `Classified as ${latest.projectTypeLabel} from project metadata, dependencies, directory structure and source signals.`,
              evidence: [],
              alternatives: [],
            },
        website: parse<any>(latest.websiteJson, null),
      };
    }

    const latestV2Snapshot = await prisma.progressSnapshot.findFirst({
      where: { projectId, frameworkVersion: EVALUATION_FRAMEWORK_VERSION },
      orderBy: { createdAt: 'desc' },
    });

    const previous = legacySnapshots[0] || null;

    res.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          projectType: project.projectType,
          projectTypeSource: project.projectTypeSource,
          projectTypeConfidence: project.projectTypeConfidence,
          scopeApprovedAt: project.scopeApprovedAt,
          dimensionWeightOverrides: project.dimensionWeightOverrides,
          lastScanAt: project.lastScanAt,
          overallProgress: project.overallProgress,
        },
        assessment,
        history: historyRows,
        latestSnapshot: latestV2Snapshot,
        legacySnapshots,
        comparison: previous
          ? {
              available: true,
              explanation:
                'The previous score was produced by Evaluation Framework V1 (feature-name matching and a single overall score). V2 uses project classification, requirement-level evidence and independent product/technical/readiness metrics. A difference between these numbers reflects a methodology change, not development progress.',
              previous: {
                overallProgress: previous.overallProgress,
                verificationConfidence: previous.verificationConfidence,
                frameworkVersion: previous.frameworkVersion,
                createdAt: previous.createdAt,
              },
            }
          : {
              available: false,
              explanation:
                'No earlier V1 snapshot exists for this project, so there is no methodology comparison to show.',
            },
        scope: {
          approvedAt: project.scopeApprovedAt,
          requirements: scopeFeatures,
          counts: {
            total: scopeFeatures.length,
            included: scopeFeatures.filter((f) => f.included).length,
          },
        },
        framework: {
          version: EVALUATION_FRAMEWORK_VERSION,
          projectTypes: PROJECT_TYPES.map((value) => ({ value, label: PROJECT_TYPE_LABELS[value] })),
          dimensionKeys: allFrameworkDimensionKeys(),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/scope/:projectId
progressRouter.get('/scope/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return apiError(res, 404, 'Project not found');

    const requirements = await prisma.feature.findMany({
      where: { projectId },
      orderBy: [{ weight: 'desc' }, { createdAt: 'asc' }],
      include: { evidences: true },
    });

    res.json({
      success: true,
      data: {
        approvedAt: project.scopeApprovedAt,
        requirements,
        counts: {
          total: requirements.length,
          included: requirements.filter((r) => r.included).length,
          originalPlanned: requirements.filter((r) => r.source === 'ORIGINAL_PLANNED').length,
          aiDiscovered: requirements.filter((r) => r.source === 'AI_DISCOVERED').length,
          aiInferredMissing: requirements.filter((r) => r.source === 'AI_INFERRED_MISSING').length,
          userConfirmed: requirements.filter((r) => r.source === 'USER_CONFIRMED').length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/progress/scope/:projectId — approve/edit/remove/add inferred requirements
progressRouter.patch('/scope/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return apiError(res, 404, 'Project not found');

    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    const additions = Array.isArray(req.body?.additions) ? req.body.additions : [];
    const removals = Array.isArray(req.body?.removals) ? req.body.removals.map(String) : [];
    const validDimensions = allFrameworkDimensionKeys();

    for (const update of updates) {
      const id = typeof update?.id === 'string' ? update.id : null;
      if (!id) continue;
      const existing = await prisma.feature.findFirst({ where: { id, projectId } });
      if (!existing) continue;

      const data: any = { userModified: true };
      if (typeof update.included === 'boolean') data.included = update.included;
      if (typeof update.title === 'string' && update.title.trim().length > 0) {
        data.name = update.title.trim().slice(0, 200);
        data.source = 'USER_CONFIRMED';
      }
      if (typeof update.description === 'string') {
        data.description = update.description.slice(0, 2000);
        data.source = 'USER_CONFIRMED';
      }
      if (typeof update.expectedFunctionality === 'string') {
        data.expectedFunctionality = update.expectedFunctionality.slice(0, 2000);
        data.source = 'USER_CONFIRMED';
      }
      if (typeof update.dimension === 'string' && validDimensions.includes(update.dimension)) {
        data.dimension = update.dimension;
      }
      if (typeof update.priority === 'string') {
        data.weight = update.priority === 'CRITICAL' ? 20 : update.priority === 'LOW' ? 6 : 12;
      }
      await prisma.feature.update({ where: { id }, data });
    }

    for (const removalId of removals) {
      await prisma.feature.updateMany({
        where: { id: removalId, projectId },
        data: { included: false, userModified: true },
      });
    }

    const framework = getFramework(
      project.projectType && validProjectType(project.projectType) ? project.projectType : 'OTHER'
    );

    for (const addition of additions) {
      const title = typeof addition?.title === 'string' ? addition.title.trim().slice(0, 200) : '';
      if (!title) continue;
      const dimension =
        typeof addition.dimension === 'string' && validDimensions.includes(addition.dimension)
          ? addition.dimension
          : inferDimension(title, framework);
      const priority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(addition.priority)
        ? addition.priority
        : 'HIGH';
      await prisma.feature.create({
        data: {
          projectId,
          name: title,
          description:
            typeof addition.description === 'string' && addition.description.trim().length > 0
              ? addition.description.trim().slice(0, 2000)
              : 'User-confirmed requirement.',
          dimension,
          category: dimension,
          source: 'USER_CONFIRMED',
          expectedFunctionality:
            typeof addition.expectedFunctionality === 'string' && addition.expectedFunctionality.trim().length > 0
              ? addition.expectedFunctionality.trim().slice(0, 2000)
              : title,
          weight: priority === 'CRITICAL' ? 20 : priority === 'LOW' ? 6 : 12,
          included: true,
          userModified: true,
          status: 'MISSING',
          verificationStatus: 'UNVERIFIED',
        },
      });
    }

    const requirements = await prisma.feature.findMany({
      where: { projectId },
      orderBy: [{ weight: 'desc' }, { createdAt: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        approvedAt: project.scopeApprovedAt,
        requirements,
        counts: {
          total: requirements.length,
          included: requirements.filter((r) => r.included).length,
        },
        message:
          'Scope updated. Run a new assessment to recalculate scores from the confirmed requirements.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/progress/scope/:projectId/approve
progressRouter.post('/scope/:projectId/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return apiError(res, 404, 'Project not found');

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { scopeApprovedAt: new Date() },
    });

    await prisma.projectActivity.create({
      data: {
        projectId,
        type: 'SCOPE_APPROVED',
        description: 'Project scope approved for definitive Evaluation Framework V2 assessment.',
      },
    });

    res.json({
      success: true,
      data: {
        approvedAt: updated.scopeApprovedAt,
        message: 'Scope approved. Run a new assessment to produce the definitive V2 result.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/progress/classification/:projectId
progressRouter.put('/classification/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return apiError(res, 404, 'Project not found');

    const projectType = req.body?.projectType;

    if (projectType === 'AUTO') {
      const updated = await prisma.project.update({
        where: { id: projectId },
        data: { projectType: null, projectTypeSource: 'AUTO', projectTypeConfidence: null },
      });
      return res.json({
        success: true,
        data: {
          projectType: updated.projectType,
          projectTypeSource: updated.projectTypeSource,
          message: 'Classification reset to automatic. Run a new assessment to re-detect the project type.',
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (!validProjectType(projectType)) {
      return apiError(
        res,
        400,
        `Invalid project type. Expected one of: ${PROJECT_TYPES.join(', ')}, or AUTO.`
      );
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        projectType,
        projectTypeSource: 'USER',
        projectTypeConfidence: 100,
      },
    });

    res.json({
      success: true,
      data: {
        projectType: updated.projectType,
        projectTypeLabel: PROJECT_TYPE_LABELS[projectType],
        projectTypeSource: updated.projectTypeSource,
        message: 'Classification corrected. Run a new assessment to evaluate under the selected framework.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/progress/weights/:projectId — per-project dimension weight overrides
progressRouter.put('/weights/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return apiError(res, 404, 'Project not found');

    const weights = req.body?.weights;
    if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
      return apiError(res, 400, 'Body must include a weights object mapping dimension keys to positive numbers.');
    }

    const validKeys = allFrameworkDimensionKeys();
    const cleaned: Record<string, number> = {};
    for (const [key, value] of Object.entries(weights)) {
      if (!validKeys.includes(key)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100) continue;
      cleaned[key] = value;
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { dimensionWeightOverrides: JSON.stringify(cleaned) },
    });

    res.json({
      success: true,
      data: {
        weights: JSON.parse(updated.dimensionWeightOverrides),
        message: 'Weights updated. Run a new assessment to apply them.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/progress/recommendations/:id/convert
progressRouter.post('/recommendations/:id/convert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const rec = await prisma.aIRecommendation.findUnique({ where: { id } });
    if (!rec) return apiError(res, 404, 'Recommendation not found');

    const task = await prisma.task.create({
      data: {
        projectId: rec.projectId,
        title: rec.title,
        description: `${rec.explanation}\n\nRecommended Action: ${rec.recommendedAction}`,
        priority: rec.priority,
        status: 'NOT_STARTED',
        aiRecommendations: rec.recommendedAction,
      },
    });

    await prisma.aIRecommendation.update({
      where: { id },
      data: { isConvertedToTask: true, convertedTaskId: task.id },
    });

    res.json({
      success: true,
      data: task,
      message: 'Recommendation converted to task',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
