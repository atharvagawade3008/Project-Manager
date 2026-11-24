import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import prisma from '../../db.js';

export interface FileMetadata {
  relativePath: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
  hash: string;
  lastModified: Date;
  language: string;
  fileCategory: 'SOURCE' | 'CONFIG' | 'DOCS' | 'TEST' | 'BUILD' | 'ASSET';
  linesOfCode: number;
  todos: string[];
  exportedSymbols: string[];
  importedModules: string[];
}

export interface DirectoryTreeItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  language?: string;
  children?: DirectoryTreeItem[];
}

export class FilesystemService {
  public static defaultExclusions = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    'coverage',
    '.next',
    '.nuxt',
    'vendor',
    '__pycache__',
    '.pytest_cache',
    '.venv',
    'venv',
    'target',
    '.idea',
    '.vscode',
    'bin',
    'obj',
  ];

  public static defaultSecretPatterns = [
    /^\.env/i,
    /\.pem$/i,
    /\.key$/i,
    /\.cert$/i,
    /\.pfx$/i,
    /id_rsa/i,
    /credentials\.json$/i,
    /token\.json$/i,
  ];

  public static languageMap: Record<string, string> = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript React',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript React',
    '.py': 'Python',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.sql': 'SQL',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.sh': 'Shell',
    '.bash': 'Shell',
    '.ps1': 'PowerShell',
    '.rs': 'Rust',
    '.go': 'Go',
    '.java': 'Java',
    '.c': 'C',
    '.cpp': 'C++',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
  };

  /**
   * Search for a folder name across common user project paths on Windows
   */
  public static locateFolderByName(folderName: string): string | null {
    if (!folderName) return null;
    const cleanName = folderName.trim().toLowerCase();
    const home = os.homedir();

    const searchRoots = [
      path.join(home, 'Desktop', 'Code'),
      path.join(home, 'Desktop'),
      path.join(home, 'Documents', 'Code'),
      path.join(home, 'Documents'),
      path.join(home, 'Downloads'),
      path.join(home, 'Projects'),
      home,
    ];

    for (const root of searchRoots) {
      if (!fs.existsSync(root)) continue;
      try {
        // Direct check
        const directCandidate = path.join(root, folderName);
        if (fs.existsSync(directCandidate) && fs.statSync(directCandidate).isDirectory()) {
          return directCandidate;
        }

        // Subfolder scan (1 level deep)
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (entry.name.toLowerCase() === cleanName) {
              return path.join(root, entry.name);
            }
            // Check inside subfolder (e.g. Desktop\Code\Aeroleaf)
            const subDir = path.join(root, entry.name);
            try {
              const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
              for (const sub of subEntries) {
                if (sub.isDirectory() && sub.name.toLowerCase() === cleanName) {
                  return path.join(subDir, sub.name);
                }
              }
            } catch {}
          }
        }
      } catch {}
    }

    return null;
  }

  /**
   * Validate that a directory exists, is canonical, and accessible.
   * If exact path is not found, automatically searches in Desktop/Code, Documents, etc.
   */
  public static validateDirectory(dirPath: string): {
    valid: boolean;
    resolvedPath?: string;
    wasRedirected?: boolean;
    error?: string;
  } {
    if (!dirPath || typeof dirPath !== 'string') {
      return { valid: false, error: 'Directory path is required.' };
    }

    try {
      const trimmed = dirPath.trim();
      const resolved = path.resolve(trimmed);

      // Direct check
      if (fs.existsSync(resolved)) {
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
          return { valid: false, error: `Path is a file, not a directory: "${resolved}"` };
        }
        fs.readdirSync(resolved);
        return { valid: true, resolvedPath: resolved };
      }

      // If not directly found, attempt smart folder discovery
      const folderName = path.basename(trimmed) || trimmed;
      const discovered = this.locateFolderByName(folderName);
      if (discovered) {
        return {
          valid: true,
          resolvedPath: discovered,
          wasRedirected: true,
        };
      }

      return {
        valid: false,
        error: `Directory does not exist at "${resolved}". Tip: Check if it is inside another folder (e.g. Desktop\\Code\\${folderName}) or click "Browse File Explorer".`,
      };
    } catch (err: any) {
      return { valid: false, error: `Cannot access directory: ${err.message}` };
    }
  }

  /**
   * Browse directories for easy folder selection in UI
   */
  public static browseDirectories(basePath?: string): { currentPath: string; parentPath: string | null; folders: string[] } {
    let target = basePath ? path.resolve(basePath.trim()) : process.cwd();
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      target = process.cwd();
    }

    const items = fs.readdirSync(target, { withFileTypes: true });
    const folders: string[] = [];

    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        folders.push(item.name);
      }
    }

    const parent = path.dirname(target);
    const parentPath = parent !== target ? parent : null;

    return {
      currentPath: target,
      parentPath,
      folders: folders.sort(),
    };
  }

  /**
   * Read-only, lightweight directory inspection for metadata/AI form
   * prefill. Unlike scanProjectDirectory this does not hash, parse or persist
   * source files; package.json and README are read lazily by the signal layer.
   */
  public static inspectDirectory(
    rootPath: string,
    maxFiles = 2500
  ): { files: FileMetadata[]; totalFiles: number; truncated: boolean; resolvedPath: string } {
    const val = this.validateDirectory(rootPath);
    if (!val.valid || !val.resolvedPath) {
      throw new Error(val.error || 'Invalid directory');
    }

    const resolvedRoot = val.resolvedPath;
    const exclusions = new Set(this.defaultExclusions.map((entry) => entry.toLowerCase()));
    const files: FileMetadata[] = [];
    let truncated = false;

    const walk = (currentDir: string) => {
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }

      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (files.length >= maxFiles) {
          truncated = true;
          return;
        }

        if (entry.isSymbolicLink()) continue;
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (
            exclusions.has(entry.name.toLowerCase()) ||
            entry.name.startsWith('.')
          ) {
            continue;
          }
          walk(fullPath);
          continue;
        }

        if (!entry.isFile()) continue;
        if (this.defaultSecretPatterns.some((pattern) => pattern.test(entry.name))) continue;

        const ext = path.extname(entry.name).toLowerCase();
        const relativePath = path.relative(resolvedRoot, fullPath);
        const lower = relativePath.toLowerCase();

        let fileCategory: FileMetadata['fileCategory'] = 'SOURCE';
        if (
          /(^|\/)(__tests__|tests?|specs?)\//.test(lower) ||
          /\.(test|spec)\.[a-z0-9]+$/.test(lower)
        ) {
          fileCategory = 'TEST';
        } else if (ext === '.md' || ext === '.mdx' || ext === '.txt') {
          fileCategory = 'DOCS';
        } else if (
          ext === '.json' ||
          ext === '.yaml' ||
          ext === '.yml' ||
          ext === '.toml' ||
          /(^|\/)(config|\.[^/]*rc)(\/|$)/.test(lower) ||
          /\.[^/]*config\.[^/]+$/.test(lower)
        ) {
          fileCategory = 'CONFIG';
        }

        files.push({
          relativePath,
          absolutePath: fullPath,
          extension: ext,
          sizeBytes: 0,
          hash: '',
          lastModified: new Date(0),
          language: this.languageMap[ext] || 'Text',
          fileCategory,
          linesOfCode: 0,
          todos: [],
          exportedSymbols: [],
          importedModules: [],
        });
      }
    };

    walk(resolvedRoot);
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return {
      files,
      totalFiles: files.length,
      truncated,
      resolvedPath: resolvedRoot,
    };
  }

  /**
   * Recursively scan a project directory and collect metadata
   */
  public static async scanProjectDirectory(
    projectId: string,
    rootPath: string,
    customExclusions: string[] = [],
    maxFileSizeBytes = 512 * 1024,
    onProgress?: (scanned: number, currentFile: string) => void
  ): Promise<{ files: FileMetadata[]; tree: DirectoryTreeItem; totalFiles: number; totalCodeLines: number }> {
    const val = this.validateDirectory(rootPath);
    if (!val.valid || !val.resolvedPath) {
      throw new Error(val.error || 'Invalid directory');
    }

    const resolvedRoot = val.resolvedPath;
    const exclusions = new Set([...this.defaultExclusions, ...customExclusions.map((e) => e.trim().toLowerCase())]);

    const collectedFiles: FileMetadata[] = [];
    let scannedCount = 0;
    let totalCodeLines = 0;

    const buildTree = (currentDir: string): DirectoryTreeItem => {
      const dirName = path.basename(currentDir) || currentDir;
      const treeNode: DirectoryTreeItem = {
        name: dirName,
        path: path.relative(resolvedRoot, currentDir) || '.',
        type: 'directory',
        children: [],
      };

      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return treeNode;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relative = path.relative(resolvedRoot, fullPath);

        // Check exclusions
        if (entry.isDirectory()) {
          const lowerName = entry.name.toLowerCase();
          if (exclusions.has(lowerName) || entry.name.startsWith('.')) {
            continue;
          }
          treeNode.children?.push(buildTree(fullPath));
        } else if (entry.isFile()) {
          // Check secret patterns
          if (this.defaultSecretPatterns.some((pattern) => pattern.test(entry.name))) {
            continue;
          }

          const ext = path.extname(entry.name).toLowerCase();
          const language = this.languageMap[ext] || 'Text';

          let stat: fs.Stats;
          try {
            stat = fs.statSync(fullPath);
          } catch {
            continue;
          }

          // Skip heavy media/binaries and oversized files
          if (stat.size > maxFileSizeBytes) {
            continue;
          }

          scannedCount++;
          if (onProgress) {
            onProgress(scannedCount, relative);
          }

          // Parse code metadata
          const meta = this.analyzeSourceFile(fullPath, relative, stat, ext, language);
          collectedFiles.push(meta);
          totalCodeLines += meta.linesOfCode;

          treeNode.children?.push({
            name: entry.name,
            path: relative,
            type: 'file',
            size: stat.size,
            extension: ext,
            language,
          });
        }
      }

      return treeNode;
    };

    const tree = buildTree(resolvedRoot);

    // Persist scanned files in SQLite database
    for (const file of collectedFiles) {
      await prisma.scannedFile.upsert({
        where: {
          projectId_relativePath: {
            projectId,
            relativePath: file.relativePath,
          },
        },
        update: {
          extension: file.extension,
          sizeBytes: file.sizeBytes,
          hash: file.hash,
          lastModified: file.lastModified,
          language: file.language,
          fileCategory: file.fileCategory,
          astSummary: JSON.stringify({
            todos: file.todos,
            exportedSymbols: file.exportedSymbols,
            importedModules: file.importedModules,
            lines: file.linesOfCode,
          }),
        },
        create: {
          projectId,
          relativePath: file.relativePath,
          extension: file.extension,
          sizeBytes: file.sizeBytes,
          hash: file.hash,
          lastModified: file.lastModified,
          language: file.language,
          fileCategory: file.fileCategory,
          astSummary: JSON.stringify({
            todos: file.todos,
            exportedSymbols: file.exportedSymbols,
            importedModules: file.importedModules,
            lines: file.linesOfCode,
          }),
        },
      });
    }

    return {
      files: collectedFiles,
      tree,
      totalFiles: collectedFiles.length,
      totalCodeLines,
    };
  }

  /**
   * Fast regex-based AST & symbol extraction for source files
   */
  private static analyzeSourceFile(
    fullPath: string,
    relativePath: string,
    stat: fs.Stats,
    ext: string,
    language: string
  ): FileMetadata {
    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      content = '';
    }

    // SHA-256 Hash
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Categorize
    let fileCategory: 'SOURCE' | 'CONFIG' | 'DOCS' | 'TEST' | 'BUILD' | 'ASSET' = 'SOURCE';
    const lower = relativePath.toLowerCase();

    if (lower.includes('test') || lower.includes('spec') || lower.endsWith('.test.ts') || lower.endsWith('.spec.js')) {
      fileCategory = 'TEST';
    } else if (ext === '.md' || ext === '.txt') {
      fileCategory = 'DOCS';
    } else if (ext === '.json' || ext === '.yaml' || ext === '.yml' || lower.includes('config')) {
      fileCategory = 'CONFIG';
    }

    const lines = content.split('\n');
    const linesOfCode = lines.filter((l) => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('#') && !l.trim().startsWith('/*')).length;

    // Detect TODOs and FIXMEs
    const todos: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/TODO:|FIXME:|HACK:|XXX:/i.test(line)) {
        todos.push(`Line ${i + 1}: ${line.trim()}`);
      }
    }

    // Detect exported symbols
    const exportedSymbols: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([a-zA-Z0-9_$]+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1]) exportedSymbols.push(match[1]);
    }

    // Top-level JavaScript/TypeScript functions or variables if no explicit exports
    if (exportedSymbols.length === 0 && (ext === '.js' || ext === '.ts')) {
      const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
      while ((match = fnRegex.exec(content)) !== null) {
        const fnName = match[1] || match[2];
        if (fnName && !exportedSymbols.includes(fnName)) {
          exportedSymbols.push(fnName);
        }
      }
    }

    // Python function/class definitions
    if (ext === '.py') {
      const pyRegex = /^(?:def|class)\s+([a-zA-Z0-9_$]+)/gm;
      while ((match = pyRegex.exec(content)) !== null) {
        if (match[1]) exportedSymbols.push(match[1]);
      }
    }

    // Detect imports
    const importedModules: string[] = [];
    const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    while ((match = importRegex.exec(content)) !== null) {
      const mod = match[1] || match[2];
      if (mod && !importedModules.includes(mod)) {
        importedModules.push(mod);
      }
    }

    return {
      relativePath,
      absolutePath: fullPath,
      extension: ext,
      sizeBytes: stat.size,
      hash,
      lastModified: stat.mtime,
      language,
      fileCategory,
      linesOfCode,
      todos,
      exportedSymbols,
      importedModules,
    };
  }
}
