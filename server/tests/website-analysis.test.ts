import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWebsite } from '../src/modules/progress/evaluation/website-analyzer.js';
import { SourceCorpus } from '../src/modules/progress/evaluation/corpus.js';
import { fixtureSignals } from './helpers/scan-fixture.js';

function analyzeFixture() {
  const { signals, files } = fixtureSignals();
  const corpus = new SourceCorpus(files);
  return analyzeWebsite(signals, corpus);
}

test('discovers every HTML route and excludes the 404 document from page inventory', () => {
  const site = analyzeFixture();
  const routes = site.routes.sort();

  assert.deepEqual(routes, ['/', '/about', '/contact', '/services']);
  assert.ok(!site.routes.includes('/404'));
  assert.equal(site.pages.every((page) => page.hasContent), true);
  assert.equal(site.detected404, true);
});

test('detects broken internal navigation instead of assuming links work', () => {
  const site = analyzeFixture();
  assert.ok(
    site.brokenInternalLinks.some((link) => link.includes('/missing-page')),
    `expected /missing-page to be reported broken, got ${site.brokenInternalLinks.join('; ')}`
  );
  assert.ok(site.unresolvedRouteLinks.includes('/missing-page'));
});

test('a rendered submit button without a handler is a placeholder form, not a complete feature', () => {
  const site = analyzeFixture();
  assert.equal(site.forms.length, 1);
  const form = site.forms[0];
  assert.equal(form.isPlaceholder, true);
  assert.equal(form.hasSubmitHandler, false);
  assert.equal(form.hasAction, false);
  assert.equal(form.hasValidation, true);
  assert.ok(form.fieldCount >= 3);
});

test('responsive evidence is collected but never claims rendered verification', () => {
  const site = analyzeFixture();
  assert.equal(site.hasViewportMeta, true);
  assert.equal(site.mediaQueryCount, 2);
  assert.ok(site.breakpoints.includes('768px'));
  assert.ok(site.breakpoints.includes('1024px'));
  assert.ok(site.fluidLayoutSignals > 0);

  const responsiveCheck = site.runtime.checkedRoutes;
  assert.equal(responsiveCheck, 0);
});

test('resolves existing assets and reports missing images and alt-text gaps', () => {
  const site = analyzeFixture();
  assert.ok(site.resolvedImages >= 2, `expected logo assets to resolve, got ${site.resolvedImages}`);
  assert.ok(site.missingAssets.some((asset) => asset.includes('/hero.jpg')));
  assert.equal(site.imagesMissingAlt, 1);
  assert.equal(site.imagesWithAlt, 2);
});

test('extracts SEO, accessibility and deployment evidence', () => {
  const site = analyzeFixture();
  assert.equal(site.seo.pagesWithTitle, 4);
  assert.equal(site.seo.pagesWithDescription, 4);
  assert.equal(site.seo.pagesWithLang, 4);
  assert.equal(site.seo.hasRobotsTxt, false);
  assert.equal(site.seo.hasSitemap, false);
  assert.ok(site.accessibility.labelElements >= 3);
  assert.ok(site.accessibility.inputs >= 3);
  assert.ok(site.seo.semanticTags > 0);
  assert.equal(site.deployment.buildScript, 'node scripts/build.js');
  assert.equal(site.deployment.hasHostingConfig, false);
  assert.equal(site.errorHandling.has404Page, true);
});

test('flags placeholder content markers found in source', () => {
  const site = analyzeFixture();
  assert.ok(site.placeholderCopy.length === 0);
});
