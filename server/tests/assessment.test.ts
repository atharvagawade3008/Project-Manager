import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAssessment } from '../src/modules/progress/evaluation/assessment.js';
import { fixtureSignals } from './helpers/scan-fixture.js';

async function assessFixture() {
  const { root, files, meta } = fixtureSignals();
  const totalCodeLines = files.reduce((sum, file) => sum + file.linesOfCode, 0);

  return buildAssessment({
    meta,
    files,
    rootPath: root,
    taskTitles: [],
    existingFeatures: [],
    scopeMode: 'discover',
    scopeApproved: false,
    scannedFiles: files.length,
    totalCodeLines,
  });
}

test('builds a project-aware assessment with three independent metrics', async () => {
  const { payload } = await assessFixture();

  assert.equal(payload.frameworkVersion, 'V2');
  assert.equal(payload.projectType, 'BUSINESS_WEBSITE');
  assert.equal(payload.projectTypeLabel, 'Business website');
  assert.ok(payload.scores.productCompletion !== null);
  assert.ok(payload.scores.technicalCompletion !== null);
  assert.ok(payload.scores.productionReadiness !== null);

  const average =
    ((payload.scores.productCompletion as number) +
      (payload.scores.technicalCompletion as number) +
      (payload.scores.productionReadiness as number)) /
    3;
  assert.notEqual(Math.round(average * 10) / 10, payload.scores.overallProgress);
  assert.equal(payload.scores.overallProgress, payload.scores.productCompletion);
});

test('substantially built product scores high on product completion while readiness stays honest', async () => {
  const { payload } = await assessFixture();

  assert.ok(
    (payload.scores.productCompletion as number) >= 55,
    `expected product completion above 55, got ${payload.scores.productCompletion}`
  );
  assert.ok(
    (payload.scores.productCompletion as number) < 98,
    'product completion should not be 100 for a site with a broken link and unwired form'
  );
  assert.ok(
    (payload.scores.productionReadiness as number) < (payload.scores.productCompletion as number),
    'production readiness should be lower than product completion for this fixture (no hosting config/tests/error handling)'
  );
});

test('website dimensions include all nine website criteria and dimension scores are explainable', async () => {
  const { payload } = await assessFixture();
  const keys = payload.dimensions.map((dimension) => dimension.key);

  for (const expected of [
    'pages', 'functional', 'uiux', 'responsive', 'content',
    'integrations', 'codeQuality', 'testing', 'seo',
  ]) {
    assert.ok(keys.includes(expected), `missing website dimension ${expected}`);
  }

  const pages = payload.dimensions.find((dimension) => dimension.key === 'pages')!;
  assert.ok((pages.score as number) >= 60, `expected pages >= 60, got ${pages.score}`);
  assert.ok(pages.evidence.length > 0);
  assert.ok(pages.summary.includes('route'));

  const responsive = payload.dimensions.find((dimension) => dimension.key === 'responsive')!;
  assert.ok((responsive.score as number) <= 85);
  assert.match(responsive.summary, /unverified|not verified/i);
});

test('distinguishes implemented pages, placeholder forms and missing planned features', async () => {
  const { payload } = await assessFixture();
  const byName = (name: string) => payload.features.find((feature) => feature.name.toLowerCase().includes(name));

  const about = byName('about the team');
  assert.ok(about, 'expected the planned About page requirement');
  assert.equal(about!.status, 'IMPLEMENTED');
  assert.ok(about!.evidences.some((evidence) => evidence.filePath.includes('about.html')));

  const contact = byName('working contact form');
  assert.ok(contact, 'expected the contact form requirement');
  assert.equal(contact!.status, 'PLACEHOLDER');
  assert.ok((contact!.completion as number) <= 25);
  assert.match(contact!.missingRequirements || '', /form/i);

  const blog = byName('blog');
  assert.ok(blog, 'expected the planned blog requirement');
  assert.equal(blog!.status, 'MISSING');
  assert.equal(blog!.completion, 0);
});

test('scope discovery labels original, discovered, inferred and user-confirmed sources distinctly', async () => {
  const { payload } = await assessFixture();
  const sources = new Set(payload.scope.map((requirement) => requirement.source));

  assert.ok(sources.has('ORIGINAL_PLANNED'));
  assert.ok(sources.has('AI_DISCOVERED'));
  assert.ok(sources.has('AI_INFERRED_MISSING'));
  assert.ok(!sources.has('USER_CONFIRMED'));
});

test('assessment exposes methodology notes and an unapproved provisional scope', async () => {
  const { payload } = await assessFixture();

  assert.equal(payload.scopeApproved, false);
  assert.ok(payload.notes.some((note) => /Framework V2/i.test(note)));
  assert.ok(payload.notes.some((note) => /comparable to V1/i.test(note)));
  assert.ok(payload.notes.some((note) => /preview URL|runtime/i.test(note)));
  assert.equal(payload.scores.evaluationConfidence > 0, true);
});
