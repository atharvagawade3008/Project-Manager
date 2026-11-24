import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyProject } from '../src/modules/progress/evaluation/classifier.js';
import { buildProjectSignals } from '../src/modules/progress/evaluation/signals.js';
import type { FileMetadata } from '../src/modules/filesystem/filesystem.service.js';
import type { ProjectMeta } from '../src/modules/progress/evaluation/types.js';
import { fixtureSignals } from './helpers/scan-fixture.js';

function file(relativePath: string, content = '', category: FileMetadata['fileCategory'] = 'SOURCE'): FileMetadata {
  return {
    relativePath,
    absolutePath: `/virtual/${relativePath}`,
    extension: relativePath.includes('.') ? `.${relativePath.split('.').pop()}` : '',
    sizeBytes: content.length,
    hash: 'hash',
    lastModified: new Date(),
    language: 'TypeScript',
    fileCategory: category,
    linesOfCode: content.split('\n').length,
    todos: [],
    exportedSymbols: [],
    importedModules: [],
  };
}

function signalsFor(
  meta: ProjectMeta,
  files: FileMetadata[],
  packageJson?: Record<string, unknown>
) {
  const all = packageJson
    ? [file('package.json', JSON.stringify(packageJson), 'CONFIG'), ...files]
    : files;
  return buildProjectSignals(meta, all, '/virtual');
}

test('classifies the sample business website with supporting evidence', () => {
  const { signals } = fixtureSignals();
  const result = classifyProject(signals);

  assert.equal(result.projectType, 'BUSINESS_WEBSITE');
  assert.equal(result.projectTypeLabel, 'Business website');
  assert.ok(result.confidence >= 60, `expected confident classification, got ${result.confidence}`);
  assert.ok(result.evidence.length > 0);
  assert.equal(result.source, 'AUTO');
});

test('classifies a 3D game from engine dependencies and game paths', () => {
  const meta: ProjectMeta = {
    name: 'Navi Mumbai 3D',
    description: 'Open-world driving simulation',
    category: 'Game Development',
  };
  const signals = signalsFor(
    meta,
    [
      file('src/player/playerMovement.ts', "import * as THREE from 'three'; export class PlayerMovementController {}"),
      file('src/physics/vehicleController.ts', "import * as CANNON from 'cannon-es'; export class VehiclePhysicsController {}"),
      file('src/world/roadNetwork.ts', 'export class RoadNetworkManager {}'),
      file('src/ui/hud.ts', 'export class HudOverlay {}'),
    ],
    { dependencies: { three: '^0.170.0', 'cannon-es': '^0.20.0' } }
  );

  const result = classifyProject(signals);
  assert.equal(result.projectType, 'GAME_3D');
  assert.ok(result.confidence > 60);
});

test('classifies an e-commerce application from payment and cart signals', () => {
  const meta: ProjectMeta = {
    name: 'Mochi Store',
    description: 'Online storefront with checkout and product catalog',
    category: 'Web Application',
  };
  const signals = signalsFor(
    meta,
    [
      file('src/pages/cart.tsx', 'export function CartPage() { return <div>Cart</div>; }'),
      file('src/pages/checkout.tsx', 'export function CheckoutPage() { return <div>Checkout</div>; }'),
      file('src/pages/products/[slug].tsx', 'export function ProductPage() { return <div>Product</div>; }'),
    ],
    { dependencies: { react: '^19.0.0', stripe: '^17.0.0', next: '^15.0.0' } }
  );

  const result = classifyProject(signals);
  assert.equal(result.projectType, 'ECOMMERCE_WEBSITE');
});

test('manual classification overrides automatic detection', () => {
  const { signals } = fixtureSignals();
  const result = classifyProject(signals, 'PORTFOLIO_WEBSITE');

  assert.equal(result.projectType, 'PORTFOLIO_WEBSITE');
  assert.equal(result.source, 'USER');
  assert.equal(result.confidence, 100);
  assert.match(result.rationale, /manually by the user/i);
  assert.ok(result.alternatives.some((alternative) => alternative.projectType === 'BUSINESS_WEBSITE'));
});
