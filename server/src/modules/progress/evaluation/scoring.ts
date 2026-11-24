import {
  AssessmentScores,
  DimensionDefinition,
  DimensionResult,
  FeatureAssessment,
  ImplementationStatus,
  MetricGroup,
  VerificationStatus,
  DimensionPartial,
} from './types.js';

/**
 * Deterministic completion bands per implementation status.
 * AI/heuristic interpretation may propose a completion value, but the backend
 * clamps it into the band that its evidence class allows.
 */
export const COMPLETION_BANDS: Record<ImplementationStatus, { min: number; max: number }> = {
  IMPLEMENTED: { min: 75, max: 90 },
  PARTIALLY_IMPLEMENTED: { min: 30, max: 70 },
  PLACEHOLDER: { min: 5, max: 25 },
  MISSING: { min: 0, max: 5 },
  CANNOT_VERIFY: { min: 0, max: 0 },
  NOT_APPLICABLE: { min: 0, max: 0 },
};

const SCORED_STATUSES: ImplementationStatus[] = [
  'IMPLEMENTED',
  'PARTIALLY_IMPLEMENTED',
  'PLACEHOLDER',
  'MISSING',
];

export function defaultCompletionForStatus(status: ImplementationStatus): number {
  switch (status) {
    case 'IMPLEMENTED':
      return 82;
    case 'PARTIALLY_IMPLEMENTED':
      return 50;
    case 'PLACEHOLDER':
      return 15;
    case 'MISSING':
      return 0;
    case 'CANNOT_VERIFY':
      return 0;
    case 'NOT_APPLICABLE':
      return 0;
    default:
      return 0;
  }
}

export function clampCompletionForStatus(status: ImplementationStatus, desired: number): number {
  if (status === 'CANNOT_VERIFY' || status === 'NOT_APPLICABLE') return 0;
  const band = COMPLETION_BANDS[status] || COMPLETION_BANDS.MISSING;
  const safe = Number.isFinite(desired) ? desired : band.min;
  return round1(Math.min(band.max, Math.max(band.min, safe)));
}

export function isFeatureScored(feature: FeatureAssessment): boolean {
  return (
    feature.included &&
    feature.status !== 'NOT_APPLICABLE' &&
    feature.status !== 'CANNOT_VERIFY' &&
    SCORED_STATUSES.includes(feature.status)
  );
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function weightedAverage(items: Array<{ score: number; weight: number }>): number | null {
  const total = items.reduce((sum, item) => sum + (item.weight > 0 ? item.weight : 0), 0);
  if (total <= 0) return null;
  return round1(items.reduce((sum, item) => sum + item.score * (item.weight > 0 ? item.weight : 0), 0) / total);
}

/**
 * Apply requirement/feature coverage to a structural dimension score and
 * normalize weights across only the applicable dimensions.
 */
export function finalizeDimensions(
  framework: DimensionDefinition[],
  rawResults: Record<string, DimensionPartial>,
  features: FeatureAssessment[]
): DimensionResult[] {
  const results: DimensionResult[] = framework.map((definition) => {
    const raw = rawResults[definition.key];
    if (!raw) {
      return {
        key: definition.key,
        name: definition.name,
        description: definition.description,
        metric: definition.metric,
        weight: definition.weight,
        normalizedWeight: 0,
        applicable: false,
        exclusionReason: definition.exclusionReason || 'No evidence could be collected for this criterion.',
        score: null,
        confidence: 0,
        summary: 'Criterion not assessed.',
        evidence: [],
        fileRefs: [],
        checksPassed: 0,
        checksTotal: 0,
        featureCoverage: null,
      };
    }

    return {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      metric: definition.metric,
      weight: definition.weight,
      normalizedWeight: 0,
      applicable: true,
      score: Math.min(100, Math.max(0, round1(raw.score))),
      confidence: Math.min(96, Math.max(0, round1(raw.confidence))),
      summary: raw.summary,
      evidence: raw.evidence,
      fileRefs: Array.from(new Set(raw.fileRefs)).slice(0, 20),
      checksPassed: raw.checksPassed,
      checksTotal: raw.checksTotal,
      featureCoverage: null,
    };
  });

  // Requirement coverage is a bounded, transparent component of each dimension.
  for (const result of results) {
    if (!result.applicable) continue;
    const related = features.filter(
      (f) => f.included && f.dimension === result.key && f.status !== 'NOT_APPLICABLE' && f.status !== 'CANNOT_VERIFY'
    );
    if (related.length === 0) continue;
    const coverage = weightedAverage(
      related.map((f) => ({ score: f.completion, weight: f.weight > 0 ? f.weight : 10 }))
    );
    if (coverage === null) continue;
    result.featureCoverage = coverage;
    const structural = result.score ?? 0;
    result.score = round1(structural * 0.7 + coverage * 0.3);
    result.confidence = round1(Math.min(96, (result.confidence * 0.8 + 20) * 1.0));
    result.summary = `${result.summary} Requirement coverage is ${coverage}% across ${related.length} assessed feature(s).`;
  }

  const totalWeight = results
    .filter((r) => r.applicable && r.weight > 0)
    .reduce((sum, r) => sum + r.weight, 0);

  for (const result of results) {
    if (!result.applicable || totalWeight <= 0) {
      result.normalizedWeight = 0;
      if (result.applicable) result.applicable = false;
      continue;
    }
    result.normalizedWeight = round1((result.weight / totalWeight) * 100);
  }

  return results;
}

/**
 * Three independent metrics. They are never averaged together.
 */
export function calculateMetrics(dimensions: DimensionResult[]): {
  productCompletion: number | null;
  technicalCompletion: number | null;
  productionReadiness: number | null;
  overallProgress: number;
} {
  const byMetric = (metric: MetricGroup): number | null => {
    const applicable = dimensions.filter(
      (d) => d.applicable && d.metric === metric && d.score !== null && d.weight > 0
    );
    return weightedAverage(applicable.map((d) => ({ score: d.score as number, weight: d.weight })));
  };

  const product = byMetric('PRODUCT');
  const technical = byMetric('TECHNICAL');
  const readiness = byMetric('READINESS');

  // Compatibility field only. The three metrics above remain authoritative.
  const overall = product ?? technical ?? readiness ?? 0;

  return {
    productCompletion: product,
    technicalCompletion: technical,
    productionReadiness: readiness,
    overallProgress: overall,
  };
}

export function countFeatureStatuses(features: FeatureAssessment[]) {
  const counts = {
    total: features.length,
    applicable: 0,
    implemented: 0,
    partiallyImplemented: 0,
    placeholder: 0,
    missing: 0,
    cannotVerify: 0,
    notApplicable: 0,
    verified: 0,
  };

  for (const feature of features) {
    if (feature.status === 'NOT_APPLICABLE') {
      counts.notApplicable += 1;
      continue;
    }
    if (feature.status === 'CANNOT_VERIFY') {
      counts.cannotVerify += 1;
      continue;
    }
    if (!feature.included) continue;
    counts.applicable += 1;
    if (feature.status === 'IMPLEMENTED') counts.implemented += 1;
    if (feature.status === 'PARTIALLY_IMPLEMENTED') counts.partiallyImplemented += 1;
    if (feature.status === 'PLACEHOLDER') counts.placeholder += 1;
    if (feature.status === 'MISSING') counts.missing += 1;
    if (feature.verificationStatus === 'VERIFIED') counts.verified += 1;
  }

  return counts;
}

function verificationRatio(features: FeatureAssessment[]): number {
  const applicable = features.filter((f) => f.included && f.status !== 'NOT_APPLICABLE');
  if (applicable.length === 0) return 0;
  return applicable.filter((f) => f.verificationStatus === 'VERIFIED').length / applicable.length;
}

/**
 * Evaluation confidence expresses how much of the score is backed by verifiable
 * evidence. It is deliberately independent from completion percentages.
 */
export function calculateEvaluationConfidence(
  dimensions: DimensionResult[],
  features: FeatureAssessment[],
  scopeApproved: boolean,
  runtimeVerified = false
): number {
  const applicable = dimensions.filter((d) => d.applicable);
  const weightedConfidence =
    weightedAverage(applicable.map((d) => ({ score: d.confidence, weight: d.weight }))) ?? 0;

  const featureEvidenceRatio =
    features.length > 0
      ? features.filter((f) => f.included && f.evidences.length > 0 && f.status !== 'NOT_APPLICABLE').length /
        Math.max(1, features.filter((f) => f.included && f.status !== 'NOT_APPLICABLE').length)
      : 0;

  let confidence =
    weightedConfidence * 0.55 +
    verificationRatio(features) * 100 * 0.2 +
    featureEvidenceRatio * 100 * 0.25;

  if (!scopeApproved) confidence -= 8;
  if (runtimeVerified) confidence += 3;

  return round1(Math.max(10, Math.min(96, confidence)));
}

export function buildScores(
  dimensions: DimensionResult[],
  features: FeatureAssessment[],
  scopeApproved: boolean,
  runtimeVerified = false
): AssessmentScores {
  const metrics = calculateMetrics(dimensions);
  return {
    productCompletion: metrics.productCompletion,
    technicalCompletion: metrics.technicalCompletion,
    productionReadiness: metrics.productionReadiness,
    overallProgress: metrics.overallProgress,
    evaluationConfidence: calculateEvaluationConfidence(
      dimensions,
      features,
      scopeApproved,
      runtimeVerified
    ),
    featureCounts: countFeatureStatuses(features),
  };
}

/**
 * Guard against AI-provided completion escaping its evidence class. The AI can
 * interpret evidence; it cannot choose the project percentage.
 */
export function normalizeAiFeatureUpdates(
  features: FeatureAssessment[],
  updates: Array<{
    id?: string;
    name?: string;
    status?: string;
    completion?: number;
    confidence?: number;
    missing?: string;
  }>
): { features: FeatureAssessment[]; applied: number } {
  const allowedStatuses: ImplementationStatus[] = [
    'IMPLEMENTED',
    'PARTIALLY_IMPLEMENTED',
    'PLACEHOLDER',
    'MISSING',
    'CANNOT_VERIFY',
    'NOT_APPLICABLE',
  ];
  const allowedVerification: VerificationStatus[] = [
    'VERIFIED',
    'PARTIALLY_VERIFIED',
    'UNVERIFIED',
    'CANNOT_VERIFY',
    'NOT_APPLICABLE',
  ];

  let applied = 0;
  const next = features.map((feature) => {
    const update = updates.find(
      (u) => (u.id && u.id === feature.id) || (!u.id && u.name && u.name === feature.name)
    );
    if (!update) return feature;

    const status = allowedStatuses.includes(update.status as ImplementationStatus)
      ? (update.status as ImplementationStatus)
      : feature.status;

    // Never let the model upgrade a feature that has no corroborating evidence.
    const evidenceCount = feature.evidences.filter((e) => e.status !== 'MISSING').length;
    if (status === 'IMPLEMENTED' && evidenceCount === 0) {
      return feature;
    }

    const completion = clampCompletionForStatus(
      status,
      typeof update.completion === 'number' ? update.completion : feature.completion
    );
    const confidence = Number.isFinite(update.confidence)
      ? Math.min(95, Math.max(20, Number(update.confidence)))
      : feature.confidence;

    applied += 1;
    const verificationStatus: VerificationStatus =
      status === 'NOT_APPLICABLE'
        ? 'NOT_APPLICABLE'
        : status === 'CANNOT_VERIFY'
        ? 'CANNOT_VERIFY'
        : feature.verificationStatus === 'VERIFIED' && allowedVerification.includes(feature.verificationStatus)
        ? feature.verificationStatus
        : status === 'IMPLEMENTED' || status === 'PARTIALLY_IMPLEMENTED'
        ? 'UNVERIFIED'
        : feature.verificationStatus;

    return {
      ...feature,
      status,
      completion,
      confidence: round1(confidence),
      verificationStatus,
      missingRequirements:
        typeof update.missing === 'string' && update.missing.trim().length > 0
          ? update.missing.trim()
          : feature.missingRequirements,
    };
  });

  return { features: next, applied };
}

export function healthStatusFor(
  productCompletion: number | null,
  productionReadiness: number | null
): 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL' {
  const product = productCompletion ?? 0;
  const readiness = productionReadiness ?? 0;
  if (product >= 85 && readiness >= 55) return 'EXCELLENT';
  if (product >= 65) return 'GOOD';
  if (product >= 30) return 'NEEDS_ATTENTION';
  return 'CRITICAL';
}
