import { SourceCorpus } from './corpus.js';
import { resolveRequirementDimension } from './frameworks.js';
import {
  ClassificationResult,
  DimensionDefinition,
  ProjectSignals,
  RequirementInput,
  RequirementSource,
  WebsiteAnalysis,
} from './types.js';

export interface ExistingFeatureRow {
  id: string;
  name: string;
  description: string;
  category?: string;
  dimension?: string;
  source?: string;
  included?: boolean;
  userModified?: boolean;
}

export interface ScopeDiscoveryInput {
  signals: ProjectSignals;
  classification: ClassificationResult;
  framework: DimensionDefinition[];
  website: WebsiteAnalysis | null;
  corpus: SourceCorpus;
  existingFeatures: ExistingFeatureRow[];
  taskTitles: string[];
}

const SOURCES: RequirementSource[] = [
  'ORIGINAL_PLANNED',
  'AI_DISCOVERED',
  'AI_INFERRED_MISSING',
  'USER_CONFIRMED',
];

const DIMENSION_KEYWORDS: Array<{ dimension: string; pattern: RegExp }> = [
  { dimension: 'payments', pattern: /\b(payment|stripe|checkout payment|billing|invoice|subscription)\b/i },
  { dimension: 'commerce', pattern: /\b(cart|checkout|catalog|product|order|inventory|shipping|storefront|shop)\b/i },
  { dimension: 'auth', pattern: /\b(auth|login|log in|sign ?in|sign ?up|account|session|oauth|password|role|permission)\b/i },
  { dimension: 'security', pattern: /\b(security|encryption|csrf|xss|rate limit|sanitiz|vulnerab)\b/i },
  { dimension: 'responsive', pattern: /\b(responsive|mobile[- ]friendly|breakpoint|adaptive layout)\b/i },
  { dimension: 'seo', pattern: /\b(seo|meta tag|metadata|sitemap|robots|accessibility|aria|wcag)\b/i },
  { dimension: 'testing', pattern: /\b(test|testing|unit test|e2e|qa|regression)\b/i },
  { dimension: 'deployment', pattern: /\b(deploy|deployment|hosting|ci\/cd|docker|release pipeline)\b/i },
  { dimension: 'modelIntegration', pattern: /\b(llm|openai|ollama|anthropic|model|inference|ai provider)\b/i },
  { dimension: 'prompting', pattern: /\b(prompt|rag|embedding|vector|completion|system message)\b/i },
  { dimension: 'evaluation', pattern: /\b(guardrail|eval|evaluation|moderation|hallucination)\b/i },
  { dimension: 'costLatency', pattern: /\b(cost|latency|cache|token limit)\b/i },
  { dimension: 'dataLayer', pattern: /\b(database|schema|prisma|sql|migration|persistence|data model|orm)\b/i },
  { dimension: 'apiDesign', pattern: /\b(api|endpoint|rest|graphql|webhook|server route)\b/i },
  { dimension: 'functional', pattern: /\b(form|contact form|button|interaction|submit|validation|workflow)\b/i },
  { dimension: 'integrations', pattern: /\b(integration|crm|newsletter|analytics|third[- ]party|booking|email service)\b/i },
  { dimension: 'gameplay', pattern: /\b(player|movement|jump|sprint|gameplay|controls?|input|mission state)\b/i },
  { dimension: 'physics', pattern: /\b(physics|collision|vehicle dynamics|raycast|gravity|suspension)\b/i },
  { dimension: 'levelContent', pattern: /\b(world|level|map|road|terrain|spawn|mission|district|sector|environment)\b/i },
  { dimension: 'graphics', pattern: /\b(render|lighting|shader|material|texture|3d|scene|camera|graphics)\b/i },
  { dimension: 'performance', pattern: /\b(performance|fps|optimization|optimisation|lod|instancing|pooling)\b/i },
  { dimension: 'distribution', pattern: /\b(packaging|installer|build pipeline|distribution|release build)\b/i },
  { dimension: 'nativeIntegration', pattern: /\b(native|filesystem|ipc|system tray|os api)\b/i },
  { dimension: 'packaging', pattern: /\b(packaging|installer|signing|notariz)\b/i },
  { dimension: 'updates', pattern: /\b(auto[- ]?update|updater|version migration)\b/i },
  { dimension: 'platformApis', pattern: /\b(camera|location|notifications?|device storage|permissions?|deep link)\b/i },
  { dimension: 'storeReadiness', pattern: /\b(app store|play store|store listing|privacy manifest|app icon)\b/i },
  { dimension: 'adaptiveLayout', pattern: /\b(adaptive|safe area|orientation)\b/i },
  { dimension: 'screens', pattern: /\b(screen|view|navigation|tabs?)\b/i },
  { dimension: 'apiSurface', pattern: /\b(cli|command|flag|sdk|api surface|library)\b/i },
  { dimension: 'docs', pattern: /\b(documentation|readme|docs|guide|examples?)\b/i },
  { dimension: 'errorHandling', pattern: /\b(error handling|error boundary|logging|diagnostics|validation)\b/i },
  { dimension: 'uiux', pattern: /\b(ui|ux|design|theme|layout|animation|hud|menu|styling)\b/i },
  { dimension: 'content', pattern: /\b(content|copy|blog|gallery|image|asset|text)\b/i },
  { dimension: 'functional', pattern: /\b(form|button|interaction|submit|validation|workflow|feature)\b/i },
  { dimension: 'pages', pattern: /\b(page|section|hero|home|about|contact|footer|header|route)\b/i },
];

export function inferDimension(text: string, framework: DimensionDefinition[]): string {
  for (const entry of DIMENSION_KEYWORDS) {
    if (entry.pattern.test(text)) {
      return resolveRequirementDimension(framework, entry.dimension);
    }
  }
  return resolveRequirementDimension(framework, 'coreFeatures');
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cleanBullet(line: string): string | null {
  const cleaned = line
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
  if (cleaned.length < 4 || cleaned.length > 160) return null;
  if (/^(and|or|the|todo|tbd|coming soon)$/i.test(cleaned)) return null;
  return cleaned;
}

function parseReadmeRequirements(readme: string): string[] {
  const lines = readme.split(/\r?\n/);
  const requirements: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      inSection = /\b(planned|features?|roadmap|requirements?|scope|milestones?|what'?s next|highlights?)\b/i.test(
        heading[1]
      );
      continue;
    }
    if (!inSection) continue;
    if (/^\s*[-*+\d]/.test(line)) {
      const item = cleanBullet(line);
      if (item) requirements.push(item);
      if (requirements.length >= 24) break;
    }
  }
  return requirements;
}

function splitDeliverables(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|;|\u2022/)
    .map((part) => part.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((part) => part.length >= 5 && part.length <= 160)
    .slice(0, 10);
}

function sourceOf(row: ExistingFeatureRow): RequirementSource {
  if (row.userModified) return 'USER_CONFIRMED';
  if (row.source && SOURCES.includes(row.source as RequirementSource)) {
    return row.source as RequirementSource;
  }
  return 'AI_DISCOVERED';
}

export function discoverScope(input: ScopeDiscoveryInput): RequirementInput[] {
  const { signals, framework, website, corpus, existingFeatures, taskTitles } = input;
  const seen = new Set<string>();
  const requirements: RequirementInput[] = [];

  const push = (requirement: RequirementInput) => {
    const key = `${normalizeTitle(requirement.title)}::${requirement.dimension}`;
    if (!requirement.title.trim() || seen.has(key)) return;
    seen.add(key);
    requirements.push(requirement);
  };

  // 1. Existing scope / planned records already in the database.
  for (const row of existingFeatures) {
    const dimension = row.dimension && framework.some((d) => d.key === row.dimension)
      ? row.dimension
      : inferDimension(`${row.name} ${row.description}`, framework);
    push({
      id: row.id,
      title: row.name,
      description: row.description || '',
      dimension,
      priority: 'HIGH',
      source: sourceOf(row),
      included: row.included !== false,
      expectedFunctionality: row.description || row.name,
    });
  }

  // 2. Original planned requirements explicitly written by the user.
  const planned: string[] = [
    ...parseReadmeRequirements(signals.readme),
    ...splitDeliverables(signals.meta.objective || ''),
    ...splitDeliverables(signals.meta.expectedDeliverables || ''),
    ...taskTitles.slice(0, 15),
  ];

  for (const title of planned) {
    push({
      title,
      description: 'Originally planned requirement extracted from the project README, objective, deliverables or task backlog.',
      dimension: inferDimension(title, framework),
      priority: 'HIGH',
      source: 'ORIGINAL_PLANNED',
      included: true,
      expectedFunctionality: title,
    });
  }

  // 3. Features discovered in the existing implementation.
  if (website?.analyzed) {
    for (const page of website.pages.slice(0, 16)) {
      push({
        title: `Page: ${page.route}`,
        description: `Discovered route ${page.route} implemented in ${page.filePath}.`,
        dimension: resolveRequirementDimension(framework, 'pages'),
        priority: 'MEDIUM',
        source: 'AI_DISCOVERED',
        included: true,
        expectedFunctionality: `Render the ${page.name} page at ${page.route}.`,
      });
    }
  }

  const apiMatches = new Map<string, string>();
  for (const { file, content } of corpus.readAll((f) => f.fileCategory === 'SOURCE')) {
    const regex = /\b(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const key = `${match[1].toUpperCase()} ${match[2]}`;
      if (!apiMatches.has(key)) apiMatches.set(key, file.relativePath);
      if (apiMatches.size >= 12) break;
    }
    if (apiMatches.size >= 12) break;
  }

  for (const [endpoint, filePath] of apiMatches) {
    push({
      title: `API endpoint: ${endpoint}`,
      description: `Discovered server route ${endpoint} registered in ${filePath}.`,
      dimension: inferDimension(`${endpoint} api endpoint server route`, framework),
      priority: 'MEDIUM',
      source: 'AI_DISCOVERED',
      included: true,
      expectedFunctionality: `Serve ${endpoint} with validation and error handling.`,
    });
  }

  // 4. Concrete missing requirements supported by evidence (not invented scope).
  if (website) {
    for (const broken of website.brokenInternalLinks.slice(0, 5)) {
      const [, target] = broken.split('→').map((p) => p.trim());
      if (!target || /\.(png|jpe?g|svg|pdf|css|js|woff2?)$/i.test(target)) continue;
      push({
        title: `Page: ${target}`,
        description: `A navigation link references ${target}, but no route or page component resolves it (evidence: ${broken}).`,
        dimension: resolveRequirementDimension(framework, 'pages'),
        priority: 'HIGH',
        source: 'AI_INFERRED_MISSING',
        included: true,
        expectedFunctionality: `Provide a working page at ${target} or remove the broken link.`,
      });
    }

    for (const form of website.forms.filter((f) => f.isPlaceholder).slice(0, 3)) {
      push({
        title: `Working form submission in ${form.filePath.split('/').pop()}`,
        description: `A form with ${form.fieldCount} field(s) exists in ${form.filePath} but has no submit handler, action or backend endpoint.`,
        dimension: resolveRequirementDimension(framework, 'functional'),
        priority: 'HIGH',
        source: 'AI_INFERRED_MISSING',
        included: true,
        expectedFunctionality: 'Validate the form, submit it to a real handler/endpoint and surface success and failure states.',
      });
    }
  }

  return requirements.slice(0, 60);
}
