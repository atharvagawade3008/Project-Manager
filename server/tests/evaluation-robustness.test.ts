import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SourceCorpus } from '../src/modules/progress/evaluation/corpus.js';
import { buildProjectSignals } from '../src/modules/progress/evaluation/signals.js';
import { analyzeWebsite } from '../src/modules/progress/evaluation/website-analyzer.js';
import { buildAssessment } from '../src/modules/progress/evaluation/assessment.js';
import type { ProjectMeta } from '../src/modules/progress/evaluation/types.js';
import { scanFixture } from './helpers/scan-fixture.js';

function createSpaFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-os-spa-'));
  fs.mkdirSync(path.join(root, 'src', 'pages'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'components'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'types'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'spa-fixture', dependencies: { react: '^18.0.0' }, devDependencies: { vite: '^5.0.0' } })
  );
  fs.writeFileSync(
    path.join(root, 'index.html'),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>'
  );
  fs.writeFileSync(
    path.join(root, 'src', 'pages', 'Home.tsx'),
    `import React from 'react';
export const Home = () => {
  return (
    <main>
      <h1>Operations dashboard</h1>
      <p>Track delivery work, review project health and keep every team aligned.</p>
      <button onClick={() => console.log('open')}>Open projects</button>
    </main>
  );
};
`
  );
  fs.writeFileSync(
    path.join(root, 'src', 'pages', 'About.tsx'),
    `import React from 'react';
export const About = () => {
  return (
    <main>
      <h1>About the team</h1>
      <p>We are a small product studio focused on reliable operational tooling.</p>
    </main>
  );
};
`
  );
  fs.writeFileSync(
    path.join(root, 'src', 'components', 'SignupForm.tsx'),
    `import React from 'react';
export const SignupForm = () => {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void fetch('/api/signup', { method: 'POST' });
  };
  return (
    <form onSubmit={handleSubmit}>
      <input name="email" placeholder="Email address" required />
      <button type="submit">Join</button>
    </form>
  );
};
`
  );
  fs.writeFileSync(
    path.join(root, 'src', 'types', 'index.ts'),
    `export interface User { id: string; name: string; }\nexport type Status = 'active' | 'paused';\n`
  );
  fs.writeFileSync(
    path.join(root, 'src', 'components', 'BrokenForm.tsx'),
    `import React from 'react';
export const BrokenForm = () => (
  <form>
    <input name="name" placeholder="Your name" required />
    <button type="submit">Send</button>
  </form>
);
`
  );
  return root;
}

const meta: ProjectMeta = {
  name: 'SPA Fixture',
  description: 'A React single-page application with pages and forms.',
  category: 'Web Application',
  objective: 'Ship the dashboard and account flows.',
  expectedDeliverables: '',
  techStack: ['React'],
};

test('normalizes Windows path separators so page components are read, not treated as empty shells', () => {
  const root = createSpaFixture();
  try {
    const windowsFiles = scanFixture(root).map((file) => ({
      ...file,
      relativePath: file.relativePath.replace(/\//g, '\\'),
    }));
    const corpus = new SourceCorpus(windowsFiles);
    const signals = buildProjectSignals(meta, windowsFiles, root, corpus);
    const site = analyzeWebsite(signals, corpus);

    const home = site.pages.find((page) => page.route === '/Home');
    assert.ok(home, `expected /Home page, got ${site.pages.map((p) => p.route).join(', ')}`);
    assert.equal(home!.kind, 'page-component');
    assert.equal(home!.hasContent, true);
    assert.ok(home!.wordCount > 5);
    assert.match(home!.filePath, /\//, 'page file paths should be normalized to forward slashes');

    assert.ok(!site.routes.includes('/'), 'the SPA index.html mount shell must not be reported as the home page');
    assert.ok(
      !site.pages.some((page) => page.filePath.includes('types/index.ts')),
      'a module index.ts file must never be treated as a page component'
    );
    assert.ok(site.routes.includes('/About'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('input placeholder attributes do not make a form look unfinished', () => {
  const root = createSpaFixture();
  try {
    const files = scanFixture(root);
    const corpus = new SourceCorpus(files);
    const signals = buildProjectSignals(meta, files, root, corpus);
    const site = analyzeWebsite(signals, corpus);

    const signup = site.forms.find((form) => form.filePath.includes('SignupForm.tsx'));
    assert.ok(signup, 'expected the signup form to be detected');
    assert.equal(signup!.hasSubmitHandler, true);
    assert.equal(signup!.isPlaceholder, false);

    const broken = site.forms.find((form) => form.filePath.includes('BrokenForm.tsx'));
    assert.ok(broken);
    assert.equal(broken!.isPlaceholder, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an unrelated working form cannot satisfy a specific inferred broken-form requirement', async () => {
  const root = createSpaFixture();
  try {
    const files = scanFixture(root);
    const totalCodeLines = files.reduce((sum, file) => sum + file.linesOfCode, 0);

    const { payload } = await buildAssessment({
      meta,
      files,
      rootPath: root,
      taskTitles: [],
      existingFeatures: [
        {
          id: 'broken-form',
          name: 'Working form submission in BrokenForm.tsx',
          description:
            'A form with 2 field(s) exists in src/components/BrokenForm.tsx but has no submit handler, action or backend endpoint.',
          dimension: 'functional',
          source: 'AI_INFERRED_MISSING',
          included: true,
        },
        {
          id: 'signup-form',
          name: 'Working signup form submission',
          description: 'Collect an email address and submit it to the signup endpoint.',
          dimension: 'functional',
          source: 'ORIGINAL_PLANNED',
          included: true,
        },
      ],
      scopeMode: 'existing',
      scopeApproved: false,
      scannedFiles: files.length,
      totalCodeLines,
    });

    const feature = payload.features.find((entry) => entry.id === 'broken-form');
    assert.ok(feature);
    assert.equal(feature!.status, 'PLACEHOLDER');
    assert.ok(feature!.completion <= 25);
    assert.ok(feature!.evidences.every((evidence) => evidence.filePath.includes('BrokenForm.tsx')));
    assert.ok(
      !feature!.evidences.some((evidence) => evidence.filePath.includes('SignupForm.tsx')),
      'evidence from an unrelated functional form must not be attributed to this requirement'
    );

    const signup = payload.features.find((entry) => entry.id === 'signup-form');
    assert.ok(signup);
    assert.equal(signup!.status, 'IMPLEMENTED');
    assert.equal(
      signup!.placeholderSignals.length,
      0,
      'normal input placeholder attributes and UI labels are not unfinished-code markers'
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
