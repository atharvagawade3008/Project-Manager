import path from 'path';
import { FilesystemService } from '../filesystem/filesystem.service.js';
import { OllamaService } from '../ollama/ollama.service.js';
import { classifyProject } from '../progress/evaluation/classifier.js';
import { buildProjectSignals } from '../progress/evaluation/signals.js';
import { ProjectMeta, ProjectType } from '../progress/evaluation/types.js';

export type ProjectCategory =
  | 'Software Development'
  | 'Game Development'
  | 'Web Application'
  | 'AI / ML System'
  | 'Mobile App'
  | 'CLI & Systems'
  | 'Non-Software Project';

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  'Software Development',
  'Game Development',
  'Web Application',
  'AI / ML System',
  'Mobile App',
  'CLI & Systems',
  'Non-Software Project',
];

export interface FolderProjectAnalysis {
  rootPath: string;
  name: string;
  description: string;
  category: ProjectCategory;
  objective: string;
  expectedDeliverables: string;
  techStack: string[];
  complexity: 'Low' | 'Medium' | 'High' | 'Very High';
  projectType: {
    code: ProjectType;
    label: string;
    confidence: number;
    rationale: string;
  };
  filesScanned: number;
  truncated: boolean;
  aiUsed: boolean;
  aiMessage: string | null;
}

interface AiMetadata {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  objective?: unknown;
  expectedDeliverables?: unknown;
  techStack?: unknown;
  complexity?: unknown;
}

const GENERIC_PACKAGE_NAMES = new Set([
  'app',
  'client',
  'server',
  'web',
  'frontend',
  'backend',
  'project',
  'project-os',
  'my-app',
  'temp',
  'test',
  'demo',
]);

function humanize(value: string): string {
  const title = value
    .replace(/^@[^/]+\//, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return title.replace(/\b(3d|ai|api|cli|css|html|js|json|saas|sql|ts|ui|ux)\b/gi, (token) =>
    token.toUpperCase()
  );
}

function truncate(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1).trimEnd()}\u2026` : normalized;
}

function firstReadmeParagraph(readme: string): string {
  const withoutCode = readme.replace(/```[\s\S]*?```/g, ' ');
  const blocks = withoutCode.split(/\n\s*\n/);

  for (const block of blocks) {
    const cleaned = block
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/^[*-]\s*/gm, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[`*_>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length < 40) continue;
    if (/^(badges?|license|table of contents|installation|usage|contributing)\b/i.test(cleaned)) continue;
    if (/^https?:\/\//i.test(cleaned)) continue;
    return truncate(cleaned, 420);
  }

  return '';
}

function categoryForType(type: ProjectType): ProjectCategory {
  switch (type) {
    case 'GAME_3D':
      return 'Game Development';
    case 'MOBILE_APPLICATION':
      return 'Mobile App';
    case 'DEVELOPER_TOOL':
      return 'CLI & Systems';
    case 'AI_APPLICATION':
      return 'AI / ML System';
    case 'BUSINESS_WEBSITE':
    case 'PORTFOLIO_WEBSITE':
    case 'ECOMMERCE_WEBSITE':
    case 'LANDING_PAGE':
    case 'SAAS_APPLICATION':
    case 'FULLSTACK_WEB_APP':
      return 'Web Application';
    case 'DESKTOP_APPLICATION':
    case 'OTHER':
    default:
      return 'Software Development';
  }
}

function detectTechStack(dependencies: string[], files: Array<{ relativePath: string }>): string[] {
  const stack = new Set<string>();
  const deps = dependencies.join(' ').toLowerCase();
  const paths = files.map((file) => file.relativePath.toLowerCase());

  if (/react/.test(deps) || paths.some((p) => p.endsWith('.tsx') || p.endsWith('.jsx'))) stack.add('React');
  if (/next/.test(deps)) stack.add('Next.js');
  if (/vue/.test(deps)) stack.add('Vue');
  if (/svelte/.test(deps)) stack.add('Svelte');
  if (/express/.test(deps)) stack.add('Express');
  if (/fastify/.test(deps)) stack.add('Fastify');
  if (/hono/.test(deps)) stack.add('Hono');
  if (/prisma/.test(deps)) stack.add('Prisma');
  if (/drizzle/.test(deps)) stack.add('Drizzle ORM');
  if (/sqlite|better-sqlite3/.test(deps)) stack.add('SQLite');
  if (/postgres|pg/.test(deps)) stack.add('PostgreSQL');
  if (/mongodb|mongoose/.test(deps)) stack.add('MongoDB');
  if (/tailwind/.test(deps)) stack.add('Tailwind CSS');
  if (/three/.test(deps)) stack.add('Three.js');
  if (/electron/.test(deps)) stack.add('Electron');
  if (/@tauri-apps|tauri/.test(deps)) stack.add('Tauri');
  if (/react-native|expo/.test(deps)) stack.add('React Native / Expo');
  if (/openai|anthropic|langchain|ollama/.test(deps)) stack.add('LLM Runtime');
  if (/vitest|jest|mocha|playwright|cypress/.test(deps)) stack.add('Test Runner');

  if (paths.some((p) => p.endsWith('.ts') || p.endsWith('.tsx'))) stack.add('TypeScript');
  if (paths.some((p) => p.endsWith('.js') || p.endsWith('.jsx'))) stack.add('JavaScript');
  if (paths.some((p) => p.endsWith('.html'))) stack.add('HTML5');
  if (paths.some((p) => p.endsWith('.css') || p.endsWith('.scss'))) stack.add('CSS3');
  if (paths.some((p) => p.endsWith('.py'))) stack.add('Python');
  if (paths.some((p) => p.endsWith('.cs'))) stack.add('C#');
  if (paths.some((p) => p.endsWith('.go'))) stack.add('Go');
  if (paths.some((p) => p.endsWith('.rs'))) stack.add('Rust');

  return Array.from(stack).slice(0, 14);
}

function inferComplexity(input: {
  filesScanned: number;
  projectType: ProjectType;
  techStack: string[];
  dependencies: string[];
}): FolderProjectAnalysis['complexity'] {
  const deps = input.dependencies.join(' ').toLowerCase();
  const hasBackend = /express|fastify|hono|nestjs|next|nuxt|remix|sveltekit/.test(deps);
  const hasDatabase = /prisma|drizzle|sequelize|typeorm|mongoose|sqlite|postgres|mysql/.test(deps);
  const hasTests = /vitest|jest|playwright|cypress|mocha/.test(deps);
  const complexitySignals =
    input.techStack.length + (hasBackend ? 1 : 0) + (hasDatabase ? 1 : 0) + (hasTests ? 1 : 0);

  if (input.filesScanned > 320 || input.projectType === 'GAME_3D' || complexitySignals >= 9) {
    return 'Very High';
  }
  if (input.filesScanned > 110 || complexitySignals >= 6) return 'High';
  if (input.filesScanned > 30 || complexitySignals >= 3) return 'Medium';
  return 'Low';
}

function extractJson(text: string): AiMetadata | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as AiMetadata;
  } catch {
    return null;
  }
}

function validCategory(value: unknown): ProjectCategory | null {
  if (typeof value !== 'string') return null;
  return PROJECT_CATEGORIES.find((category) => category.toLowerCase() === value.trim().toLowerCase()) || null;
}

function validComplexity(value: unknown): FolderProjectAnalysis['complexity'] | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'low') return 'Low';
  if (normalized === 'medium') return 'Medium';
  if (normalized === 'high') return 'High';
  if (normalized === 'very high' || normalized === 'very-high') return 'Very High';
  return null;
}

function sanitizeText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = truncate(value.replace(/[\r\n]+/g, ' '), max);
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeAiName(value: unknown): string | null {
  const cleaned = sanitizeText(value, 100);
  if (!cleaned) return null;
  // Small local models sometimes echo a package slug as the project name.
  if (/^[@a-z0-9._/-]+$/.test(cleaned) && /[-_.]/.test(cleaned)) {
    return humanize(cleaned);
  }
  return cleaned;
}

function sanitizeStack(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const cleaned = truncate(item, 48);
    if (cleaned) unique.add(cleaned);
    if (unique.size >= 12) break;
  }
  return Array.from(unique);
}

function mergeTechStack(detected: string[], aiValues: string[]): string[] {
  const result: string[] = [];
  for (const value of [...detected, ...aiValues]) {
    if (!result.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      result.push(value);
    }
  }
  return result.slice(0, 14);
}

export class FolderProjectAnalysisService {
  public static async analyze(
    rawPath: string,
    options: { useAI?: boolean } = {}
  ): Promise<FolderProjectAnalysis> {
    if (!rawPath || !rawPath.trim()) {
      throw new Error('Choose a project folder to analyze.');
    }

    const inspection = FilesystemService.inspectDirectory(rawPath.trim());
    const folderName = path.basename(inspection.resolvedPath);
    const meta: ProjectMeta = { name: humanize(folderName), description: '' };
    const signals = buildProjectSignals(meta, inspection.files, inspection.resolvedPath);
    const classification = classifyProject(signals);
    const dependencies = [...signals.dependencies, ...signals.devDependencies];
    const detectedTechStack = detectTechStack(dependencies, signals.files);
    const readmeDescription = firstReadmeParagraph(signals.readme);

    const packageName =
      signals.packageName && !GENERIC_PACKAGE_NAMES.has(signals.packageName.toLowerCase())
        ? humanize(signals.packageName)
        : '';
    const name = packageName || humanize(folderName) || 'Untitled Project';
    const description =
      (signals.packageDescription && signals.packageDescription.trim().length >= 12
        ? truncate(signals.packageDescription, 600)
        : '') ||
      readmeDescription ||
      `A ${classification.projectTypeLabel} with ${inspection.totalFiles} scanned files.`;

    let analysis: FolderProjectAnalysis = {
      rootPath: inspection.resolvedPath,
      name,
      description,
      category: categoryForType(classification.projectType),
      objective: `Deliver a working ${classification.projectTypeLabel} with verified core workflows.`,
      expectedDeliverables:
        'Working core flows, responsive primary screens, and a deployment-ready build',
      techStack: detectedTechStack,
      complexity: inferComplexity({
        filesScanned: inspection.totalFiles,
        projectType: classification.projectType,
        techStack: detectedTechStack,
        dependencies,
      }),
      projectType: {
        code: classification.projectType,
        label: classification.projectTypeLabel,
        confidence: classification.confidence,
        rationale: classification.rationale,
      },
      filesScanned: inspection.totalFiles,
      truncated: inspection.truncated,
      aiUsed: false,
      aiMessage: null,
    };

    if (options.useAI === false) {
      return analysis;
    }

    try {
      const status = await OllamaService.checkStatus();
      if (!status.online) {
        return {
          ...analysis,
          aiMessage: 'Ollama is offline; populated from repository metadata instead.',
        };
      }

      const model =
        status.availableModels.includes(status.activeModel)
          ? status.activeModel
          : status.availableModels[0];
      if (!model) {
        return {
          ...analysis,
          aiMessage: 'No Ollama model is installed; populated from repository metadata instead.',
        };
      }

      const prompt = this.buildPrompt({
        folderName,
        resolvedPath: inspection.resolvedPath,
        filesScanned: inspection.totalFiles,
        truncated: inspection.truncated,
        packageJson: {
          name: signals.packageName,
          description: signals.packageDescription,
          dependencies: signals.dependencies.slice(0, 60),
          devDependencies: signals.devDependencies.slice(0, 60),
          scripts: signals.scripts,
        },
        readme: signals.readme.slice(0, 2600),
        detectedProjectType: classification.projectTypeLabel,
        detectedTechStack,
        sourceFiles: signals.sourceFiles.slice(0, 60),
        pages: signals.pageFiles.slice(0, 24),
      });

      const response = await OllamaService.generate(prompt, model);
      const parsed = extractJson(response);
      if (!parsed) {
        return {
          ...analysis,
          aiMessage: 'The AI response was not valid metadata; repository metadata was used instead.',
        };
      }

      const aiName = normalizeAiName(parsed.name);
      const aiDescription = sanitizeText(parsed.description, 600);
      const aiObjective = sanitizeText(parsed.objective, 320);
      const aiDeliverables = sanitizeText(parsed.expectedDeliverables, 600);
      const aiCategory = validCategory(parsed.category);
      const aiComplexity = validComplexity(parsed.complexity);
      const aiStack = sanitizeStack(parsed.techStack);

      analysis = {
        ...analysis,
        name: aiName || analysis.name,
        description: aiDescription || analysis.description,
        category: aiCategory || analysis.category,
        objective: aiObjective || analysis.objective,
        expectedDeliverables: aiDeliverables || analysis.expectedDeliverables,
        techStack: mergeTechStack(analysis.techStack, aiStack),
        complexity: aiComplexity || analysis.complexity,
        aiUsed: true,
        aiMessage: `Prefilled with ${model} from repository metadata. Review before creating.`,
      };
    } catch (error: any) {
      analysis = {
        ...analysis,
        aiMessage: `AI prefill was unavailable (${error?.message || 'unknown error'}); repository metadata was used instead.`,
      };
    }

    return analysis;
  }

  private static buildPrompt(input: {
    folderName: string;
    resolvedPath: string;
    filesScanned: number;
    truncated: boolean;
    packageJson: Record<string, unknown>;
    readme: string;
    detectedProjectType: string;
    detectedTechStack: string[];
    sourceFiles: string[];
    pages: string[];
  }): string {
    return `You extract project metadata for a project-management app. Use ONLY the repository evidence below. Do not invent features, customers, results or technologies.

Return strict JSON only, with no markdown, in this exact shape:
{"name":"","description":"","category":"","objective":"","expectedDeliverables":"","techStack":[],"complexity":"Low|Medium|High|Very High"}

Rules:
- name: the real project name. Prefer a meaningful package name or README title over a generic folder name.
- description: 1-2 factual sentences about what this project actually is.
- category: exactly one of ${PROJECT_CATEGORIES.map((category) => `"${category}"`).join(', ')}.
- objective: one concrete sentence describing the main build goal.
- expectedDeliverables: a short semicolon-separated list of concrete deliverables supported by the repository.
- techStack: up to 12 technologies proven by dependencies, source files or config. Do not list generic tools that are not present.
- complexity: estimate from size, architecture and dependencies.

Evidence:
Folder: ${input.folderName}
Path: ${input.resolvedPath}
Files inspected: ${input.filesScanned}${input.truncated ? ' (file limit reached)' : ''}
package.json: ${JSON.stringify(input.packageJson)}
Detected project type: ${input.detectedProjectType}
Detected technologies: ${input.detectedTechStack.join(', ') || 'none'}
Source paths: ${input.sourceFiles.join(', ') || 'none'}
Page/UI paths: ${input.pages.join(', ') || 'none'}
README excerpt:
${input.readme || '(no README)'}`;
  }
}