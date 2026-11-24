import type { FileMetadata } from '../../filesystem/filesystem.service.js';
import { SourceCorpus } from './corpus.js';
import { ProjectMeta, ProjectSignals } from './types.js';

const ROUTE_DEFINITION_REGEXES = [
  /<Route\b[^>]*\bpath\s*=\s*["'{`]([^"'`}]+)["'`}]/g,
  /\bpath\s*:\s*["'`]([^"'`]+)["'`]/g,
  /\bNavigate\b[^>]*\bto\s*=\s*["'{`]([^"'`}]+)["'`}]/g,
];

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function buildProjectSignals(
  meta: ProjectMeta,
  files: FileMetadata[],
  rootPath: string,
  corpus?: SourceCorpus
): ProjectSignals {
  const normalizedFiles = files.map((f) => ({ ...f, relativePath: normalizePath(f.relativePath) }));
  const read = corpus || new SourceCorpus(normalizedFiles);

  const packageFile = normalizedFiles.find(
    (f) => f.relativePath === 'package.json' || f.relativePath.endsWith('/package.json')
  );
  const packageJson = packageFile
    ? safeJsonParse<Record<string, any>>(read.getForFile(packageFile), {})
    : {};

  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});
  const scripts = (packageJson.scripts || {}) as Record<string, string>;

  const readmeFile = normalizedFiles.find((f) => /(^|\/)readme(\.md|\.mdx|\.txt)?$/i.test(f.relativePath));
  const readme = readmeFile ? read.getForFile(readmeFile) : '';

  const htmlFiles = normalizedFiles
    .filter((f) => ['.html', '.htm'].includes(f.extension))
    .map((f) => f.relativePath);
  const cssFiles = normalizedFiles
    .filter((f) => ['.css', '.scss', '.sass', '.less'].includes(f.extension))
    .map((f) => f.relativePath);
  const sourceFiles = normalizedFiles
    .filter((f) => f.fileCategory === 'SOURCE')
    .map((f) => f.relativePath);
  const testFiles = normalizedFiles
    .filter(
      (f) =>
        f.fileCategory === 'TEST' ||
        /(^|\/)(__tests__|tests?|specs?)\//i.test(f.relativePath) ||
        /\.(test|spec)\.[a-z]+$/i.test(f.relativePath)
    )
    .map((f) => f.relativePath);

  const pageFiles = sourceFiles.filter((p) =>
    /(^|\/)(pages|views|screens|app)\//i.test(p) ||
    /\.(html|htm)$/i.test(p) ||
    /page\.(tsx|jsx|ts|js|vue|svelte)$/i.test(p)
  );

  const routeDefinitions: Array<{ route: string; filePath: string }> = [];
  for (const { file, content } of read.readAll((f) =>
    /(route|router|app|main|navigation|nav|layout)/i.test(f.relativePath) ||
    /\.(tsx|jsx|vue|svelte)$/i.test(f.relativePath)
  )) {
    for (const regex of ROUTE_DEFINITION_REGEXES) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const route = match[1];
        if (route && route.startsWith('/') && !route.includes(':') && route !== '/*' && route !== '/**') {
          routeDefinitions.push({ route, filePath: file.relativePath });
        }
        if (routeDefinitions.length > 80) break;
      }
    }
    if (routeDefinitions.length > 80) break;
  }

  const fileExtensions: Record<string, number> = {};
  for (const file of normalizedFiles) {
    const ext = file.extension || '(none)';
    fileExtensions[ext] = (fileExtensions[ext] || 0) + 1;
  }

  const allText = [
    meta.name,
    meta.description,
    meta.category || '',
    meta.objective || '',
    meta.expectedDeliverables || '',
    (meta.techStack || []).join(' '),
    readme,
    dependencies.join(' '),
    devDependencies.join(' '),
    packageJson.description || '',
    normalizedFiles.map((f) => f.relativePath).join(' '),
    normalizedFiles.map((f) => f.exportedSymbols.join(' ')).join(' '),
  ]
    .join('\n')
    .slice(0, 200_000);

  return {
    meta,
    rootPath,
    files: normalizedFiles,
    dependencies,
    devDependencies,
    scripts,
    packageName: typeof packageJson.name === 'string' ? packageJson.name : null,
    packageDescription: typeof packageJson.description === 'string' ? packageJson.description : null,
    readme,
    readmePath: readmeFile?.relativePath || null,
    allText,
    hasTests:
      testFiles.length > 0 ||
      Boolean(scripts.test) ||
      [...dependencies, ...devDependencies].some((d) =>
        /(jest|vitest|mocha|playwright|cypress|ava|tap|pytest|phpunit|junit)/i.test(d)
      ),
    testFiles,
    sourceFiles,
    htmlFiles,
    cssFiles,
    pageFiles,
    routeDefinitions,
    fileExtensions,
  };
}
