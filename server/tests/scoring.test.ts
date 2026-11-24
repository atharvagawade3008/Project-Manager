import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMetrics,
  clampCompletionForStatus,
  countFeatureStatuses,
  finalizeDimensions,
  weightedAverage,
} from '../src/modules/progress/evaluation/scoring.js';
import { getFramework } from '../src/modules/progress/evaluation/frameworks.js';
import type { FeatureAssessment, DimensionPartial } from '../src/modules/progress/evaluation/types.js';

function partial(score: number, confidence = 80): DimensionPartial {
  return {
    score,
    confidence,
    summary: 'fixture',
    evidence: [],
    fileRefs: [],
    checksPassed: 1,
    checksTotal: 1,
  };
}

function feature(overrides: Partial<FeatureAssessment> = {}): FeatureAssessment {
  return {
    id: 'f1',
    name: 'Home page',
    description: 'Render the home page',
    dimension: 'pages',
    category: 'Page & section completeness',
    source: 'ORIGINAL_PLANNED',
    included: true,
    weight: 10,
    expectedFunctionality: 'Home page renders',
    status: 'IMPLEMENTED',
    verificationStatus: 'UNVERIFIED',
    completion: 82,
    confidence: 80,
    missingRequirements: null,
    evidences: [],
    placeholderSignals: [],
    ...overrides,
  };
}

test('weighted average returns null when no weight applies', () => {
  assert.equal(weightedAverage([]), null);
  assert.equal(weightedAverage([{ score: 50, weight: 0 }]), null);
  assert.equal(weightedAverage([{ score: 50, weight: 10 }, { score: 100, weight: 10 }]), 75);
});

test('inapplicable dimensions are excluded and remaining weights renormalise to 100', () => {
  const framework = getFramework('BUSINESS_WEBSITE');
  const raw: Record<string, DimensionPartial> = {};
  for (const dimension of framework) {
    // Deliberately omit integrations, as a static site without forms/APIs would.
    if (dimension.key === 'integrations') continue;
    raw[dimension.key] = partial(90);
  }

  const results = finalizeDimensions(framework, raw, []);
  const applicable = results.filter((r) => r.applicable);
  const excluded = results.filter((r) => !r.applicable);

  assert.ok(excluded.some((r) => r.key === 'integrations'));
  assert.equal(applicable.length, framework.length - 1);
  const total = applicable.reduce((sum, r) => sum + r.normalizedWeight, 0);
  assert.ok(Math.abs(total - 100) < 0.5, `normalised weights should total 100, got ${total}`);
  assert.equal(applicable.find((r) => r.key === 'integrations'), undefined);
});

test('the three metrics are computed independently rather than averaged', () => {
  const framework = getFramework('BUSINESS_WEBSITE');
  const raw: Record<string, DimensionPartial> = {};
  for (const dimension of framework) {
    if (dimension.metric === 'PRODUCT') raw[dimension.key] = partial(100);
    else if (dimension.metric === 'TECHNICAL') raw[dimension.key] = partial(40);
    else raw[dimension.key] = partial(20);
  }

  const dimensions = finalizeDimensions(framework, raw, []);
  const metrics = calculateMetrics(dimensions);

  assert.equal(metrics.productCompletion, 100);
  assert.equal(metrics.technicalCompletion, 40);
  assert.equal(metrics.productionReadiness, 20);
  assert.notEqual(metrics.overallProgress, (100 + 40 + 20) / 3);
  assert.equal(metrics.overallProgress, 100);
});

test('completion is clamped to the evidence band for each status', () => {
  assert.equal(clampCompletionForStatus('MISSING', 80), 5);
  assert.equal(clampCompletionForStatus('PLACEHOLDER', 80), 25);
  assert.equal(clampCompletionForStatus('PARTIALLY_IMPLEMENTED', 99), 70);
  assert.equal(clampCompletionForStatus('IMPLEMENTED', 10), 75);
  assert.equal(clampCompletionForStatus('CANNOT_VERIFY', 80), 0);
});

test('requirement coverage adjusts a dimension but cannot override its structural evidence entirely', () => {
  const framework = getFramework('BUSINESS_WEBSITE');
  const raw: Record<string, DimensionPartial> = {};
  for (const dimension of framework) raw[dimension.key] = partial(80);

  const dimensions = finalizeDimensions(framework, raw, [
    feature({ dimension: 'pages', status: 'MISSING', completion: 0, weight: 20 }),
    feature({ dimension: 'pages', status: 'IMPLEMENTED', completion: 80, weight: 20 }),
  ]);
  const pages = dimensions.find((d) => d.key === 'pages')!;

  assert.equal(pages.featureCoverage, 40);
  assert.equal(pages.score, 68); // 80*0.7 + 40*0.3
});

test('cannot-verify and not-applicable features are excluded from counts', () => {
  const counts = countFeatureStatuses([
    feature({ id: '1', status: 'IMPLEMENTED' }),
    feature({ id: '2', status: 'CANNOT_VERIFY' }),
    feature({ id: '3', status: 'NOT_APPLICABLE' }),
    feature({ id: '4', status: 'MISSING' }),
    feature({ id: '5', status: 'IMPLEMENTED', included: false }),
  ]);

  assert.equal(counts.total, 5);
  assert.equal(counts.applicable, 2);
  assert.equal(counts.implemented, 1);
  assert.equal(counts.missing, 1);
  assert.equal(counts.cannotVerify, 1);
  assert.equal(counts.notApplicable, 1);
});
