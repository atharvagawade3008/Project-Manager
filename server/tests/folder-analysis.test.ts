import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { FolderProjectAnalysisService } from '../src/modules/projects/folder-analysis.service.js';

test('folder analysis prefills project metadata from repository evidence without AI', async () => {
  const samplePath = path.resolve('..', 'sample-project');
  const analysis = await FolderProjectAnalysisService.analyze(samplePath, { useAI: false });

  assert.equal(analysis.rootPath, samplePath);
  assert.equal(analysis.category, 'Game Development');
  assert.equal(analysis.projectType.code, 'GAME_3D');
  assert.equal(analysis.projectType.label, '3D game');
  assert.equal(analysis.name, 'Navi Mumbai 3D');
  assert.match(analysis.description, /3D Open-World Engine/);
  assert.ok(analysis.techStack.includes('Three.js'));
  assert.ok(analysis.techStack.includes('TypeScript'));
  assert.ok(analysis.filesScanned > 0);
  assert.equal(analysis.aiUsed, false);
});

test('folder analysis rejects a missing directory', async () => {
  await assert.rejects(
    () => FolderProjectAnalysisService.analyze(path.resolve('..', 'sample-project-does-not-exist'), { useAI: false }),
    /Directory does not exist|Invalid directory/i
  );
});