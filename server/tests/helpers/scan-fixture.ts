import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { FileMetadata } from '../../src/modules/filesystem/filesystem.service.js';
import { buildProjectSignals } from '../../src/modules/progress/evaluation/signals.js';
import { ProjectMeta } from '../../src/modules/progress/evaluation/types.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);
const TEXT = new Set([
  '.html', '.htm', '.css', '.scss', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt',
  '.yml', '.yaml', '.svg', '.sql', '.prisma',
]);

const LANGUAGES: Record<string, string> = {
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript React',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript React',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.svg': 'SVG',
  '.yml': 'YAML',
  '.yaml': 'YAML',
};

export function scanFixture(root: string): FileMetadata[] {
  const files: FileMetadata[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
        continue;
      }
      const relative = path.relative(root, full).replace(/\\/g, '/');
      const ext = path.extname(entry.name).toLowerCase();
      const stat = fs.statSync(full);
      if (!TEXT.has(ext) || stat.size > 512 * 1024) continue;

      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      const linesOfCode = lines.filter(
        (line) => line.trim().length > 0 && !line.trim().startsWith('//') && !line.trim().startsWith('#')
      ).length;

      let fileCategory: FileMetadata['fileCategory'] = 'SOURCE';
      if (/\.(test|spec)\./.test(relative) || /tests?\//.test(relative)) fileCategory = 'TEST';
      else if (ext === '.md' || ext === '.txt') fileCategory = 'DOCS';
      else if (ext === '.json' || ext === '.yml' || ext === '.yaml') fileCategory = 'CONFIG';

      const exportedSymbols: string[] = [];
      const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([a-zA-Z0-9_$]+)/g;
      let match: RegExpExecArray | null;
      while ((match = exportRegex.exec(content)) !== null) exportedSymbols.push(match[1]);

      const todos: string[] = [];
      lines.forEach((line, index) => {
        if (/TODO:|FIXME:|HACK:|XXX:/i.test(line)) todos.push(`Line ${index + 1}: ${line.trim()}`);
      });

      files.push({
        relativePath: relative,
        absolutePath: full,
        extension: ext,
        sizeBytes: stat.size,
        hash: crypto.createHash('sha256').update(content).digest('hex'),
        lastModified: stat.mtime,
        language: LANGUAGES[ext] || 'Text',
        fileCategory,
        linesOfCode,
        todos,
        exportedSymbols,
        importedModules: [],
      });
    }
  };

  walk(root);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function fixturePath(name = 'sample-site'): string {
  return path.resolve(process.cwd(), 'tests', 'fixtures', name);
}

export function fixtureSignals(metaOverrides: Partial<ProjectMeta> = {}) {
  const root = fixturePath();
  const files = scanFixture(root);
  const meta: ProjectMeta = {
    name: 'Northwind Consulting Website',
    description: 'A business website for a small consulting studio.',
    category: 'Web Development',
    objective: 'Publish a complete marketing website for the studio.',
    expectedDeliverables: 'Home, about, services and contact pages.',
    techStack: ['HTML', 'CSS'],
    ...metaOverrides,
  };
  return {
    root,
    files,
    meta,
    signals: buildProjectSignals(meta, files, root),
  };
}
