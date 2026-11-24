import type { FileMetadata } from '../../filesystem/filesystem.service.js';
import { SourceCorpus } from './corpus.js';
import { clampCompletionForStatus, round1 } from './scoring.js';
import {
  DimensionDefinition,
  FeatureAssessment,
  FeatureEvidenceRef,
  ImplementationStatus,
  ProjectSignals,
  RequirementInput,
  VerificationStatus,
  WebsiteAnalysis,
  WebsitePageInfo,
} from './types.js';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'are', 'was', 'were', 'has', 'have',
  'will', 'can', 'should', 'must', 'able', 'using', 'used', 'use', 'all', 'any', 'our', 'their',
  'page', 'pages', 'feature', 'features', 'implement', 'implemented', 'implementation', 'support',
  'supports', 'add', 'create', 'build', 'system', 'basic', 'full', 'core', 'main', 'new',
  'planned', 'requirement', 'requirements', 'extracted', 'readme', 'objective', 'deliverables',
  'deliverable', 'task', 'backlog', 'project', 'evidence', 'docs', 'documentation',
]);

const PLACEHOLDER_PATTERN =
  /\b(?:TODO|FIXME|HACK|XXX)\b|\bnot implemented\b|\bcoming soon\b|\blorem ipsum\b|\bplaceholder (?:page|content|section|text|implementation|component|screen)\b|\bthis is a placeholder\b/i;
const WIRING_PATTERN = /(onClick|onSubmit|onChange|addEventListener|router\.(get|post|put|patch|delete)|app\.(get|post|put|patch|delete)|export\s+(default\s+)?(function|class|const)|=>|function\s+\w+\s*\()/;

function tokensFrom(text: string, limit = 14): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s/_-]/g, ' ')
    .split(/\s+/);
  return Array.from(new Set(tokens.filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t)))).slice(0, limit);
}

function tokensFor(requirement: RequirementInput): string[] {
  return tokensFrom(
    `${requirement.title} ${requirement.description} ${requirement.expectedFunctionality || ''}`
  );
}

function titleTokensFor(requirement: RequirementInput): string[] {
  return tokensFrom(requirement.title, 10);
}

function lineOf(content: string, index: number): number {
  return content.slice(0, Math.max(0, index)).split('\n').length;
}

function normalizeExplicitRoute(route: string): string {
  const clean = route.split('?')[0].split('#')[0].trim().toLowerCase();
  if (!clean) return '/';
  const withSlash = clean.startsWith('/') ? clean : `/${clean}`;
  return withSlash.length > 1 && withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

function routeFromText(text: string): string | null {
  const match = text.match(/(?:^|\s)(\/[a-z0-9][a-z0-9/_-]*)(?:\s|$|[,.;:])/i);
  return match ? match[1].toLowerCase() : null;
}

function referencedFormFiles(requirement: RequirementInput): string[] {
  const text = `${requirement.title} ${requirement.description}`;
  const names = new Set<string>();
  const regex = /[\w./\\-]+\.(?:tsx|jsx|ts|js|vue|svelte|html?)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const base = match[0].split(/[\\/]/).pop();
    if (base) names.add(base.toLowerCase());
  }
  return Array.from(names);
}

function formsForRequirement(
  site: WebsiteAnalysis,
  requirement: RequirementInput
): typeof site.forms {
  const targets = referencedFormFiles(requirement);
  if (targets.length > 0) {
    return site.forms.filter((form) => {
      const base = form.filePath.split(/[\\/]/).pop()?.toLowerCase();
      return base ? targets.includes(base) : false;
    });
  }

  // Match generic form requirements by meaningful title words (contact, signup,
  // newsletter) so one unrelated working form cannot cover another.
  const ignored = new Set(['working', 'form', 'forms', 'submission', 'submit', 'with', 'page']);
  const tokens = requirement.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !ignored.has(token));
  if (tokens.length === 0) return [];

  return site.forms.filter((form) => {
    const base = form.filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
    return tokens.some((token) => base.includes(token));
  });
}

function findPageForRequirement(site: WebsiteAnalysis, requirement: RequirementInput): WebsitePageInfo | null {
  const explicitRoute = routeFromText(`${requirement.title} ${requirement.description}`);
  if (explicitRoute) {
    const exact = site.pages.find((p) => p.route.toLowerCase() === explicitRoute);
    if (exact) return exact;
  }

  const title = requirement.title.toLowerCase();
  if (/\bhome\b|\blanding\b/.test(title)) {
    const home = site.pages.find((p) => p.route === '/');
    if (home) return home;
  }

  const words = tokensFor(requirement);
  for (const page of site.pages) {
    const haystack = `${page.name} ${page.route} ${page.filePath}`.toLowerCase();
    if (words.some((word) => word.length > 3 && haystack.includes(word))) return page;
  }
  return null;
}

interface MatchResult {
  file: FileMetadata;
  content: string;
  score: number;
  matched: string[];
  placeholderLines: string[];
  hasWiring: boolean;
}

function findMatches(
  requirement: RequirementInput,
  signals: ProjectSignals,
  corpus: SourceCorpus,
  dimensionHints: RegExp | null
): MatchResult[] {
  const titleTokens = titleTokensFor(requirement);
  const descriptionTokens = tokensFor(requirement).filter((token) => !titleTokens.includes(token)).slice(0, 6);
  if (titleTokens.length === 0) return [];

  const allowDocs = requirement.dimension === 'docs' || requirement.dimension === 'content';
  const candidates = corpus.readAll(
    (f) =>
      f.fileCategory === 'SOURCE' ||
      f.fileCategory === 'TEST' ||
      f.fileCategory === 'CONFIG' ||
      (allowDocs && f.fileCategory === 'DOCS')
  );
  const matches: MatchResult[] = [];

  for (const { file, content } of candidates) {
    // The README/objective that a requirement was extracted from cannot also be
    // implementation evidence for it; that would be circular.
    if (file.relativePath === signals.readmePath) continue;

    const lowerPath = file.relativePath.toLowerCase();
    const lowerSymbols = file.exportedSymbols.join(' ').toLowerCase();
    const lowerContent = content.toLowerCase();
    let score = 0;
    let titleHits = 0;
    const matched: string[] = [];

    for (const word of titleTokens) {
      let hit = false;
      if (lowerPath.includes(word)) {
        score += 6;
        matched.push(`path:${word}`);
        hit = true;
      }
      if (lowerSymbols.includes(word)) {
        score += 5;
        matched.push(`symbol:${word}`);
        hit = true;
      }
      if (lowerContent.includes(word)) {
        score += 3;
        matched.push(`code:${word}`);
        hit = true;
      }
      if (hit) titleHits += 1;
    }

    for (const word of descriptionTokens) {
      if (lowerPath.includes(word)) {
        score += 2;
        matched.push(`path:${word}`);
      }
      if (lowerSymbols.includes(word)) {
        score += 2;
        matched.push(`symbol:${word}`);
      }
      if (lowerContent.includes(word)) {
        score += 1;
        matched.push(`code:${word}`);
      }
    }

    // A description-only mention is not evidence. At least one title concept
    // must appear in the file.
    if (titleHits === 0) continue;

    if (dimensionHints && dimensionHints.test(lowerPath)) {
      score += 2;
      matched.push('dimension-path');
    }

    if (score <= 0) continue;

    const placeholderLines: string[] = [];
    if (PLACEHOLDER_PATTERN.test(content)) {
      for (const line of content.split('\n')) {
        if (PLACEHOLDER_PATTERN.test(line) && placeholderLines.length < 4) {
          placeholderLines.push(line.trim().slice(0, 160));
        }
      }
    }

    matches.push({
      file,
      content,
      score,
      matched: Array.from(new Set(matched)).slice(0, 6),
      placeholderLines,
      hasWiring: WIRING_PATTERN.test(content),
    });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}

function verificationFromEvidence(
  page: WebsitePageInfo | null,
  testReferenced: boolean,
  evidenceCount: number
): VerificationStatus {
  if (page?.runtimeVerified || testReferenced) return 'VERIFIED';
  if (evidenceCount >= 2) return 'PARTIALLY_VERIFIED';
  if (evidenceCount >= 1) return 'UNVERIFIED';
  return 'UNVERIFIED';
}

function statusFor(
  requirement: RequirementInput,
  page: WebsitePageInfo | null,
  matches: MatchResult[],
  signals: ProjectSignals,
  site: WebsiteAnalysis | null
): { status: ImplementationStatus; reason: string; placeholderSignals: string[] } {
  const lower = `${requirement.title} ${requirement.description}`.toLowerCase();
  const isFormRequirement = /\b(form|contact|newsletter|waitlist|booking|signup|sign-up|submit)\b/.test(lower);
  const isPageRequirement = requirement.dimension === 'pages' || requirement.dimension === 'screens' || /\b(page|screen|view|about|home|landing)\b/.test(lower);

  // An inferred "Page: /x" requirement is only satisfied by that exact route.
  const explicitRoute = requirement.title.match(/^page:\s*(\/\S+)/i);
  if (explicitRoute) {
    const target = normalizeExplicitRoute(explicitRoute[1]);
    const exact = site?.pages.find((p) => normalizeExplicitRoute(p.route) === target);
    if (!exact) {
      return {
        status: 'MISSING',
        reason: `No route or page component resolves ${explicitRoute[1]}.`,
        placeholderSignals: [],
      };
    }
    return {
      status: exact.hasContent ? 'IMPLEMENTED' : 'PLACEHOLDER',
      reason: exact.hasContent
        ? `Route ${exact.route} exists in ${exact.filePath}.`
        : `Route ${exact.route} exists but its page shell has little content.`,
      placeholderSignals: exact.hasContent ? [] : ['Route exists without populated page content'],
    };
  }

  if (isPageRequirement && site?.pages.length) {
    if (page) {
      if (page.runtimeVerified) {
        return { status: 'IMPLEMENTED', reason: 'Route exists and responded at runtime.', placeholderSignals: [] };
      }
      if (page.hasContent) {
        return { status: 'IMPLEMENTED', reason: 'Route and substantive page content discovered.', placeholderSignals: [] };
      }
      return {
        status: 'PLACEHOLDER',
        reason: 'The route exists but the page shell contains little or no substantive content.',
        placeholderSignals: ['Route exists without populated page content'],
      };
    }

    if (site.brokenInternalLinks.some((link) => lower.includes(link.split('→')[1]?.trim() || '\u0000'))) {
      return {
        status: 'MISSING',
        reason: 'A link references this page, but no route or page component resolves it.',
        placeholderSignals: ['Linked route target is missing'],
      };
    }
  }

  if (isFormRequirement && site && site.forms.length > 0) {
    const scopedForms = formsForRequirement(site, requirement);
    const formsToCheck = scopedForms.length > 0 ? scopedForms : site.forms;
    const functional = formsToCheck.filter(
      (f) => !f.isPlaceholder && (f.hasSubmitHandler || f.hasAction || f.hasBackendEndpoint)
    );
    // If this requirement names a specific form file, an unrelated working form
    // elsewhere in the project cannot satisfy it.
    if (functional.length === formsToCheck.length) {
      return { status: 'IMPLEMENTED', reason: `${functional.length} working form(s) discovered.`, placeholderSignals: [] };
    }
    return {
      status: 'PLACEHOLDER',
      reason: 'A form exists but has no submit handler, action or backend endpoint.',
      placeholderSignals: ['Form is rendered without working submission'],
    };
  }

  if (matches.length === 0) {
    const assetKeywords = /\b(logo|image|icon|texture|model|asset|sprite|text|font)\b/.test(lower);
    const assetMatch = assetKeywords
      ? signals.files.find((f) => /\.(png|jpe?g|svg|webp|glb|gltf|fbx|ttf|woff2?)$/i.test(f.relativePath))
      : null;
    if (assetMatch) {
      return {
        status: 'CANNOT_VERIFY',
        reason: `Only an unreadable binary asset (${assetMatch.relativePath}) is associated with this requirement; implementation cannot be verified from source.`,
        placeholderSignals: [],
      };
    }
    return {
      status: 'MISSING',
      reason: 'No source, symbol, route or content evidence for this requirement was found.',
      placeholderSignals: [],
    };
  }

  const totalLines = matches.reduce((sum, m) => sum + m.file.linesOfCode, 0);
  const placeholderLines = matches.flatMap((m) => m.placeholderLines);
  const hasWiring = matches.some((m) => m.hasWiring);
  const substantiveMatches = matches.filter((m) => m.file.linesOfCode >= 15 || m.content.length >= 400).length;

  if (totalLines < 20 || (matches.length === 1 && matches[0].content.length < 220)) {
    return {
      status: 'PLACEHOLDER',
      reason: 'Only a name match or an empty stub was found; the requirement has no substantive implementation.',
      placeholderSignals: placeholderLines.length > 0 ? placeholderLines : ['Matched code is an empty or near-empty stub'],
    };
  }

  if (placeholderLines.length > 0 && (matches.length === 1 || !hasWiring)) {
    return {
      status: 'PLACEHOLDER',
      reason: 'Matched files are structurally present but contain unfinished TODO/FIXME or explicit placeholder code.',
      placeholderSignals: placeholderLines,
    };
  }

  if (placeholderLines.length > 0 || substantiveMatches < 2 || !hasWiring) {
    return {
      status: 'PARTIALLY_IMPLEMENTED',
      reason:
        placeholderLines.length > 0
          ? 'Substantive code exists, but unfinished markers remain in the matched implementation.'
          : 'Some implementation evidence exists, but wiring or breadth of implementation is incomplete.',
      placeholderSignals: placeholderLines,
    };
  }

  return {
    status: 'IMPLEMENTED',
    reason: 'Substantive, wired implementation evidence was found in the matched source files.',
    placeholderSignals: [],
  };
}

function estimateCompletion(status: ImplementationStatus, evidenceCount: number, hasWiring: boolean): number {
  switch (status) {
    case 'IMPLEMENTED':
      return clampCompletionForStatus(status, 78 + Math.min(10, evidenceCount * 2) + (hasWiring ? 4 : 0));
    case 'PARTIALLY_IMPLEMENTED':
      return clampCompletionForStatus(status, 40 + Math.min(25, evidenceCount * 5));
    case 'PLACEHOLDER':
      return clampCompletionForStatus(status, 12 + Math.min(10, evidenceCount * 2));
    default:
      return 0;
  }
}

function weightFor(requirement: RequirementInput): number {
  switch (requirement.priority) {
    case 'CRITICAL':
      return 20;
    case 'HIGH':
      return 15;
    case 'LOW':
      return 6;
    default:
      return 10;
  }
}

function dimensionHints(dimension: string): RegExp | null {
  const hints: Record<string, RegExp> = {
    pages: /(pages?|views?|screens?|routes?|app)\//,
    functional: /(components?|forms?|handlers?|actions?|ui)\//,
    uiux: /(components?|ui|styles?|theme)\//,
    responsive: /(styles?|components?|layout)/,
    content: /(content|assets?|data|public)\//,
    integrations: /(api|services?|lib|integrations?|client)\//,
    codeQuality: /(src|lib|components?)\//,
    testing: /(tests?|spec|__tests__)\//,
    seo: /(seo|metadata|head|layout)/,
    commerce: /(products?|cart|checkout|orders?|shop)\//,
    payments: /(payments?|stripe|checkout|billing)\//,
    coreFeatures: /(features?|modules?|services?|pages?|app)\//,
    dataLayer: /(models?|schema|db|database|migrations?|prisma)\//,
    apiDesign: /(api|routes?|controllers?|services?)\//,
    auth: /(auth|login|session|user)\//,
    security: /(auth|security|middleware|validation)\//,
    deployment: /(docker|deploy|ci|workflows|config)\//,
    modelIntegration: /(ai|llm|openai|anthropic|ollama|providers?|models?)\//,
    prompting: /(prompts?|ai|llm)\//,
    evaluation: /(eval|tests?|guardrails?)\//,
    costLatency: /(ai|llm|cache)\//,
    screens: /(screens?|views?|pages?)\//,
    adaptiveLayout: /(screens?|components?|layout|styles?)\//,
    platformApis: /(services?|native|platform|lib)\//,
    storeReadiness: /(android|ios|app\.json|config)\//,
    performance: /(engine|render|world|components?)\//,
    gameplay: /(player|game|engine|world|physics)\//,
    levelContent: /(world|levels?|scenes?|maps?|assets?)\//,
    graphics: /(render|graphics|scenes?|engine|shaders?)\//,
    physics: /(physics|player|vehicle|collision)\//,
    distribution: /(build|config|electron|tauri|export)\//,
    nativeIntegration: /(electron|tauri|preload|main|native)\//,
    packaging: /(build|electron|tauri|installer|config)\//,
    updates: /(update|electron|tauri|migration)\//,
    apiSurface: /(commands?|cli|bin|api|routes?)\//,
    docs: /(docs?|readme|examples?)\//,
    errorHandling: /(middleware|errors?|lib|utils?)\//,
  };
  return hints[dimension] || null;
}

function testReferences(
  corpus: SourceCorpus,
  symbols: string[],
  words: string[]
): { referenced: boolean; filePath: string | null } {
  for (const { file, content } of corpus.readAll((f) => f.fileCategory === 'TEST')) {
    const lower = content.toLowerCase();
    if (symbols.some((symbol) => symbol && lower.includes(symbol.toLowerCase()))) {
      return { referenced: true, filePath: file.relativePath };
    }
    const wordHits = words.filter((word) => word.length > 4 && lower.includes(word)).length;
    if (wordHits >= 2) return { referenced: true, filePath: file.relativePath };
  }
  return { referenced: false, filePath: null };
}

export interface AssessFeaturesOptions {
  requirements: RequirementInput[];
  signals: ProjectSignals;
  corpus: SourceCorpus;
  framework: DimensionDefinition[];
  website: WebsiteAnalysis | null;
}

export function assessFeatures(options: AssessFeaturesOptions): FeatureAssessment[] {
  const { requirements, signals, corpus, framework, website } = options;

  return requirements.map((requirement, index) => {
    const definition = framework.find((d) => d.key === requirement.dimension);
    const dimensionName = definition?.name || requirement.dimension;
    const matches = findMatches(requirement, signals, corpus, dimensionHints(requirement.dimension));
    const page =
      website && (requirement.dimension === 'pages' || requirement.dimension === 'screens')
        ? findPageForRequirement(website, requirement)
        : null;
    const isFormRequirement = /\b(form|contact form|newsletter|waitlist|booking|submit)\b/i.test(
      `${requirement.title} ${requirement.description}`
    );

    const { status, reason, placeholderSignals } = statusFor(requirement, page, matches, signals, website);
    const symbols = matches.flatMap((m) => m.file.exportedSymbols).slice(0, 6);
    const words = tokensFor(requirement);
    const testRef = testReferences(corpus, symbols, words);

    let finalStatus: ImplementationStatus = status;
    let verificationStatus: VerificationStatus = verificationFromEvidence(
      page,
      testRef.referenced,
      matches.length
    );

    if (status === 'MISSING') {
      verificationStatus = 'UNVERIFIED';
    } else if (status === 'CANNOT_VERIFY') {
      verificationStatus = 'CANNOT_VERIFY';
    } else if (page?.runtimeVerified || testRef.referenced) {
      finalStatus = 'IMPLEMENTED';
      verificationStatus = 'VERIFIED';
    }

    const evidences: FeatureEvidenceRef[] = [];

    if (page) {
      evidences.push({
        filePath: page.filePath,
        symbolOrComponent: null,
        evidenceDescription: `Route ${page.route} maps to ${page.filePath}; ${
          page.hasContent ? `${page.sectionCount} sections, ~${page.wordCount} words` : 'page shell has little content'
        }${page.runtimeVerified ? `; HTTP ${page.runtimeStatus} at runtime` : ''}.`,
        status: page.hasContent ? 'FOUND' : 'PARTIAL',
        confidence: page.runtimeVerified ? 94 : page.hasContent ? 86 : 65,
      });
    } else if (isFormRequirement && website && website.forms.length > 0) {
      const scopedForms = formsForRequirement(website, requirement);
      for (const form of (scopedForms.length > 0 ? scopedForms : website.forms).slice(0, 3)) {
        evidences.push({
          filePath: form.filePath,
          symbolOrComponent: null,
          evidenceDescription: `Form in ${form.filePath}: ${form.evidence}${
            form.isPlaceholder ? ' — no working submission handler/endpoint' : ''
          }.`,
          status: form.isPlaceholder ? 'PARTIAL' : 'FOUND',
          confidence: form.isPlaceholder ? 72 : 88,
        });
      }
    } else {
      for (const match of matches.slice(0, 5)) {
        const primaryToken = words.find((w) => match.content.toLowerCase().includes(w));
        const idx = primaryToken ? match.content.toLowerCase().indexOf(primaryToken) : 0;
        const isPartial = match.placeholderLines.length > 0;
        evidences.push({
          filePath: match.file.relativePath,
          symbolOrComponent: match.file.exportedSymbols[0] || null,
          evidenceDescription: `Matched ${match.matched.join(', ')} in ${match.file.relativePath} (${match.file.linesOfCode} code lines)${
            isPartial ? ` — placeholder markers: ${match.placeholderLines[0]}` : ''
          }`,
          status: isPartial ? 'PARTIAL' : 'FOUND',
          confidence: Math.min(95, 55 + match.score * 2),
          lineStart: idx >= 0 ? lineOf(match.content, idx) : undefined,
        });
      }
    }

    if (testRef.referenced && testRef.filePath) {
      evidences.push({
        filePath: testRef.filePath,
        symbolOrComponent: null,
        evidenceDescription: `A test/spec file references this requirement or its exported symbols.`,
        status: 'FOUND',
        confidence: 90,
      });
    }

    const dedupedEvidences = Array.from(
      new Map(evidences.map((evidence) => [`${evidence.filePath}|${evidence.evidenceDescription}`, evidence])).values()
    );

    const functionalForm = website?.forms.some(
      (f) => !f.isPlaceholder && (f.hasSubmitHandler || f.hasAction || f.hasBackendEndpoint)
    );
    const hasWiring = matches.some((m) => m.hasWiring) || Boolean(page?.hasContent) || Boolean(functionalForm);
    const completion = estimateCompletion(finalStatus, dedupedEvidences.length, hasWiring);
    let confidence = 42 + dedupedEvidences.length * 7 + (hasWiring ? 6 : 0);
    if (verificationStatus === 'VERIFIED') confidence += 10;
    if (finalStatus === 'CANNOT_VERIFY') confidence = 38;
    if (finalStatus === 'MISSING') confidence = 44;
    confidence = round1(Math.min(94, Math.max(25, confidence)));

    let missingRequirements: string | null = null;
    if (finalStatus === 'MISSING') {
      missingRequirements = reason;
    } else if (finalStatus === 'PLACEHOLDER') {
      missingRequirements = `${reason} ${placeholderSignals.slice(0, 2).join('; ')}`.trim();
    } else if (finalStatus === 'PARTIALLY_IMPLEMENTED') {
      missingRequirements = `${reason}${
        placeholderSignals.length > 0 ? ` Unfinished markers: ${placeholderSignals.slice(0, 2).join('; ')}.` : ''
      }`;
    } else if (finalStatus === 'CANNOT_VERIFY') {
      missingRequirements = reason;
    } else if (verificationStatus !== 'VERIFIED') {
      missingRequirements = 'Implementation evidence exists, but no runtime or test verification was available. This is a confidence gap, not a missing feature.';
    }

    return {
      id: requirement.id || `scope-${index}`,
      name: requirement.title,
      description: requirement.description,
      dimension: requirement.dimension,
      category: dimensionName,
      source: requirement.source,
      included: requirement.included,
      weight: weightFor(requirement),
      expectedFunctionality:
        requirement.expectedFunctionality && requirement.expectedFunctionality.trim().length > 0
          ? requirement.expectedFunctionality
          : requirement.description || requirement.title,
      status: finalStatus,
      verificationStatus,
      completion,
      confidence,
      missingRequirements,
      evidences: dedupedEvidences,
      placeholderSignals,
    };
  });
}
