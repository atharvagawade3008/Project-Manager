import fs from 'fs';
import type { FileMetadata } from '../../filesystem/filesystem.service.js';

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.json', '.md', '.mdx', '.txt', '.yml', '.yaml', '.toml', '.xml', '.svg',
  '.py', '.rb', '.php', '.go', '.rs', '.java', '.kt', '.kts', '.swift', '.dart',
  '.cs', '.cpp', '.c', '.h', '.hpp', '.lua', '.gd', '.sql', '.sh', '.ps1',
  '.prisma', '.graphql', '.gql', '.env.example',
]);

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp',
  '.mp3', '.mp4', '.webm', '.wav', '.ogg', '.mov',
  '.glb', '.gltf', '.fbx', '.obj', '.blend', '.unity3d', '.uasset',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.zip', '.gz', '.7z', '.exe', '.dll',
  '.pdf', '.lock',
]);

export interface CorpusOptions {
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

/**
 * Lazy, read-only, size-capped source corpus. The scanner already visited and
 * hashed these files; this only re-reads text files that are needed for
 * evidence, keeping analysis memory bounded on large repositories.
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export class SourceCorpus {
  private cache = new Map<string, string>();
  private totalBytes = 0;
  private readonly files: FileMetadata[];
  private readonly maxFiles: number;
  private readonly maxFileBytes: number;
  private readonly maxTotalBytes: number;

  constructor(
    files: FileMetadata[],
    private readonly readFn?: (file: FileMetadata) => string,
    options: CorpusOptions = {}
  ) {
    // Windows scanners report backslash paths while signal/route analysis emits
    // forward slashes. Normalizing once keeps lookups and evidence references
    // consistent across platforms.
    this.files = files.map((file) => ({ ...file, relativePath: normalizePath(file.relativePath) }));
    this.maxFiles = options.maxFiles ?? 400;
    this.maxFileBytes = options.maxFileBytes ?? 300 * 1024;
    this.maxTotalBytes = options.maxTotalBytes ?? 12 * 1024 * 1024;
  }

  public static isTextFile(file: FileMetadata): boolean {
    const ext = (file.extension || '').toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) return false;
    return TEXT_EXTENSIONS.has(ext) || file.fileCategory === 'DOCS' || file.fileCategory === 'CONFIG';
  }

  public get(relativePath: string): string {
    const normalizedPath = normalizePath(relativePath);
    if (this.cache.has(normalizedPath)) return this.cache.get(normalizedPath)!;

    const file = this.files.find((f) => f.relativePath === normalizedPath);
    if (!file || !SourceCorpus.isTextFile(file) || this.cache.size >= this.maxFiles) return '';
    if (this.totalBytes >= this.maxTotalBytes) return '';

    let content = '';
    try {
      content = this.readFn ? this.readFn(file) : fs.readFileSync(file.absolutePath, 'utf8');
    } catch {
      content = '';
    }

    if (content.length > this.maxFileBytes) content = content.slice(0, this.maxFileBytes);
    this.totalBytes += content.length;
    this.cache.set(normalizedPath, content);
    return content;
  }

  public getForFile(file: FileMetadata): string {
    return this.get(file.relativePath);
  }

  public readAll(predicate?: (file: FileMetadata) => boolean): Array<{ file: FileMetadata; content: string }> {
    const sorted = [...this.files].sort((a, b) => {
      const weight = (f: FileMetadata) =>
        f.fileCategory === 'SOURCE' ? 0 : f.fileCategory === 'TEST' ? 1 : f.fileCategory === 'DOCS' ? 2 : 3;
      return weight(a) - weight(b);
    });

    const entries: Array<{ file: FileMetadata; content: string }> = [];
    for (const file of sorted) {
      if (this.cache.size >= this.maxFiles || this.totalBytes >= this.maxTotalBytes) break;
      if (!SourceCorpus.isTextFile(file)) continue;
      if (predicate && !predicate(file)) continue;
      const content = this.getForFile(file);
      if (content) entries.push({ file, content });
    }
    return entries;
  }
}
