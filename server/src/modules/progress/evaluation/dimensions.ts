import {
  evaluateAdaptiveLayout,
  evaluateAiEvaluation,
  evaluateApiDesign,
  evaluateApiSurface,
  evaluateAuth,
  evaluateCodeQuality,
  evaluateCoreFeatures,
  evaluateCostLatency,
  evaluateDataLayer,
  evaluateDeployment,
  evaluateDistribution,
  evaluateDocs,
  evaluateErrorHandling,
  evaluateGameplay,
  evaluateGenericContent,
  evaluateGenericUiUx,
  evaluateGraphics,
  evaluateLevelContent,
  evaluateModelIntegration,
  evaluateNativeIntegration,
  evaluatePackaging,
  evaluatePerformance,
  evaluatePhysics,
  evaluatePlatformApis,
  evaluatePrompting,
  evaluateScreens,
  evaluateSecurity,
  evaluateStoreReadiness,
  evaluateTesting,
  evaluateUpdates,
} from './dimensions-generic.js';
import {
  evaluateCommerce,
  evaluateContent,
  evaluateFunctional,
  evaluateIntegrations,
  evaluatePages,
  evaluatePayments,
  evaluateResponsive,
  evaluateSeo,
  evaluateWebsiteUiUx,
} from './dimensions-website.js';
import { DimensionContext, DimensionDefinition, DimensionPartial } from './types.js';

type Evaluator = (ctx: DimensionContext) => DimensionPartial;

const EVALUATORS: Record<string, Evaluator> = {
  pages: evaluatePages,
  functional: evaluateFunctional,
  uiux: (ctx) => (ctx.website?.analyzed ? evaluateWebsiteUiUx(ctx) : evaluateGenericUiUx(ctx)),
  responsive: evaluateResponsive,
  content: (ctx) => (ctx.website?.analyzed ? evaluateContent(ctx) : evaluateGenericContent(ctx)),
  integrations: evaluateIntegrations,
  codeQuality: evaluateCodeQuality,
  testing: evaluateTesting,
  seo: evaluateSeo,
  commerce: evaluateCommerce,
  payments: evaluatePayments,
  coreFeatures: evaluateCoreFeatures,
  dataLayer: evaluateDataLayer,
  apiDesign: evaluateApiDesign,
  auth: evaluateAuth,
  security: evaluateSecurity,
  deployment: evaluateDeployment,
  modelIntegration: evaluateModelIntegration,
  prompting: evaluatePrompting,
  evaluation: evaluateAiEvaluation,
  costLatency: evaluateCostLatency,
  screens: evaluateScreens,
  adaptiveLayout: evaluateAdaptiveLayout,
  platformApis: evaluatePlatformApis,
  storeReadiness: evaluateStoreReadiness,
  performance: evaluatePerformance,
  gameplay: evaluateGameplay,
  levelContent: evaluateLevelContent,
  graphics: evaluateGraphics,
  physics: evaluatePhysics,
  distribution: evaluateDistribution,
  nativeIntegration: evaluateNativeIntegration,
  packaging: evaluatePackaging,
  updates: evaluateUpdates,
  apiSurface: evaluateApiSurface,
  docs: evaluateDocs,
  errorHandling: evaluateErrorHandling,
};

export interface DimensionEvaluation {
  framework: DimensionDefinition[];
  raw: Record<string, DimensionPartial>;
}

/**
 * Evaluate every applicable dimension in the selected framework. Inapplicable
 * dimensions are skipped here and reported separately by finalizeDimensions.
 */
export function evaluateDimensions(
  framework: DimensionDefinition[],
  ctx: DimensionContext,
  weightOverrides: Record<string, number> = {}
): DimensionEvaluation {
  const adjustedFramework = framework.map((definition) => {
    const override = weightOverrides[definition.key];
    if (Number.isFinite(override) && override > 0) {
      return { ...definition, weight: Math.min(100, Math.max(1, Number(override))) };
    }
    return definition;
  });

  const raw: Record<string, DimensionPartial> = {};

  for (const definition of adjustedFramework) {
    let applicable = false;
    try {
      applicable = definition.applicable(ctx);
    } catch {
      applicable = true;
    }
    if (!applicable) continue;

    const evaluator = EVALUATORS[definition.key] || evaluateCoreFeatures;
    try {
      raw[definition.key] = evaluator(ctx);
    } catch (error: any) {
      raw[definition.key] = {
        score: 0,
        confidence: 30,
        summary: `Dimension could not be evaluated: ${error?.message || 'unknown analysis error'}.`,
        evidence: [],
        fileRefs: [],
        checksPassed: 0,
        checksTotal: 0,
      };
    }
  }

  return { framework: adjustedFramework, raw };
}

export { EVALUATORS };
