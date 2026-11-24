import fs from 'fs';
import path from 'path';
import type { FileMetadata } from '../../filesystem/filesystem.service.js';
import { SourceCorpus } from './corpus.js';
import {
  FormInfo,
  ProjectSignals,
  RuntimeCheckSummary,
  WebsiteAnalysis,
  WebsitePageInfo,
} from './types.js';

const ASSET_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|mp4|webm|mp3|wav|pdf|woff2?|ttf|otf)$/i;

function countMatches(text: string, regex: RegExp): number {
  if (!regex.global) regex = new RegExp(regex.source, regex.flags + 'g');
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    count += 1;
    if (count > 500) break;
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
  }
  return count;
}

function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(input: string): number {
  const stripped = stripTags(input);
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w)).length;
}

function normalizeRoute(route: string): string {
  let clean = route.split('?')[0].split('#')[0].trim();
  if (!clean) return '/';
  if (!clean.startsWith('/')) clean = `/${clean}`;
  clean = clean.replace(/\/+/g, '/');
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
  return clean;
}

function pageNameFromRoute(route: string): string {
  if (route === '/') return 'Home';
  const segment = route.split('/').filter(Boolean).pop() || 'Page';
  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/\.(html?|tsx?|jsx?|vue|svelte)$/i, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isInternalLink(href: string): boolean {
  return !/^(https?:|mailto:|tel:|javascript:|data:|#|\/\/)/i.test(href.trim());
}

function assetExists(rootPath: string, sourceFile: string, ref: string): boolean {
  const cleanRef = ref.split('?')[0].split('#')[0].trim();
  if (!cleanRef || /^(https?:|data:|mailto:|tel:|#)/i.test(cleanRef)) return true;

  const candidates = [
    path.resolve(rootPath, cleanRef.replace(/^\//, '')),
    path.resolve(rootPath, 'public', cleanRef.replace(/^\//, '')),
    path.resolve(path.dirname(path.resolve(rootPath, sourceFile)), cleanRef),
  ];

  const rootResolved = path.resolve(rootPath).toLowerCase();
  for (const candidate of candidates) {
    if (!candidate.toLowerCase().startsWith(rootResolved)) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return true;
    } catch {
      // Ignore permission errors.
    }
  }
  return false;
}

function pageFileRoute(file: FileMetadata): string | null {
  const p = file.relativePath.replace(/\\/g, '/');
  const base = path.posix.basename(p);
  const ext = path.posix.extname(p).toLowerCase();

  if (!['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte'].includes(ext)) return null;
  if (/(^|\/)(components?|ui|widgets?|layouts?|hooks?|lib|utils?|services?|store|styles?)\//i.test(p)) return null;

  let stem = base.replace(/\.(tsx|jsx|ts|js|vue|svelte)$/i, '');
  const inRouteDirectory = /(^|\/)(pages|views|screens)\//i.test(p);
  const isNextAppPage = /(^|\/)app\//i.test(p) && /^page\./i.test(base);
  // An index.ts file in a utils/types directory is a module entry, not a route.
  if (!inRouteDirectory && !isNextAppPage) return null;

  stem = stem.replace(/Screen$/i, '').replace(/Page$/i, '');
  if (/^(index|page)$/i.test(stem)) stem = '';

  const parts = p.split('/');
  const pagesIndex = parts.findIndex((part) => /^(pages|views|screens)$/i.test(part));
  let segments: string[] = [];

  if (pagesIndex >= 0) {
    segments = parts.slice(pagesIndex + 1);
    segments[segments.length - 1] = segments[segments.length - 1].replace(/\.(tsx|jsx|ts|js|vue|svelte)$/i, '');
  } else {
    // Next.js app router: app/**/page.tsx
    const appIndex = parts.findIndex((part) => part === 'app');
    if (appIndex >= 0 && /^page\./i.test(base)) {
      segments = parts.slice(appIndex + 1);
      segments.pop();
    } else {
      return null;
    }
  }

  segments = segments
    .filter((s) => !/^\(.*\)$/.test(s)) // route groups
    .map((s) => s.replace(/Screen$/i, '').replace(/Page$/i, ''))
    .filter(Boolean);

  if (segments.length > 0 && /^(index|page)$/i.test(segments[segments.length - 1])) segments.pop();
  if (segments.length === 0) return '/';

  const route = '/' + segments.join('/');
  return normalizeRoute(route);
}

function extractForms(entries: Array<{ file: FileMetadata; content: string }>): FormInfo[] {
  const forms: FormInfo[] = [];

  for (const { file, content } of entries) {
    const formRegex = /<form\b([\s\S]*?)<\/form>/gi;
    let match: RegExpExecArray | null;
    while ((match = formRegex.exec(content)) !== null) {
      const block = match[0];
      const attributes = match[1];
      const fieldCount = countMatches(block, /<(input|select|textarea)\b/gi);
      const hasValidation =
        /\b(required|pattern|minlength|maxlength|type=["']email["']|type=["']password["'])\b/i.test(block) ||
        /\b(validate|validation|zod|yup|react-hook-form)\b/i.test(block);
      const hasSubmitHandler = /onSubmit\s*=/.test(attributes);
      const hasAction = /\baction\s*=/.test(attributes) && !/action\s*=\s*["']#["']/.test(attributes);
      const nearby = content.slice(Math.max(0, match.index - 250), match.index + block.length + 600);
      const hasBackendEndpoint = /(\/api\/|fetch\(|axios\.|action=)/i.test(nearby);
      const isPlaceholder =
        /\b(todo|not implemented|coming soon)\b/i.test(block) ||
        /\blorem ipsum\b/i.test(block) ||
        /\balert\s*\(/.test(block) ||
        (!hasSubmitHandler && !hasAction && fieldCount > 0) ||
        /action\s*=\s*["']#["']/i.test(attributes);

      forms.push({
        filePath: file.relativePath,
        fieldCount,
        hasValidation,
        hasSubmitHandler,
        hasAction,
        hasBackendEndpoint,
        isPlaceholder,
        evidence: `${fieldCount} field(s), validation=${hasValidation ? 'yes' : 'no'}, handler=${hasSubmitHandler || hasAction ? 'yes' : 'no'}`,
      });
    }
  }

  return forms;
}

export function analyzeWebsite(
  signals: ProjectSignals,
  corpus: SourceCorpus,
  runtime?: RuntimeCheckSummary | null
): WebsiteAnalysis {
  const allEntries = corpus.readAll();
  const htmlEntries = allEntries.filter((e) => ['.html', '.htm'].includes(e.file.extension));
  const cssEntries = allEntries.filter((e) => ['.css', '.scss', '.sass', '.less'].includes(e.file.extension));
  // HTML documents are handled once through htmlEntries; never count them twice.
  const sourceEntries = allEntries.filter(
    (e) =>
      !['.html', '.htm'].includes(e.file.extension) &&
      (e.file.fileCategory === 'SOURCE' || e.file.fileCategory === 'DOCS' || e.file.fileCategory === 'CONFIG')
  );
  const allContent = allEntries.map((e) => e.content).join('\n');
  const allHtml = htmlEntries.map((e) => e.content).join('\n');

  const spaPackages = [
    'react', 'react-dom', 'vue', 'svelte', '@angular/core', 'next', 'nuxt', 'solid-js', 'preact', 'astro', 'vite',
  ];
  const isSpa = [...signals.dependencies, ...signals.devDependencies].some((dependency) =>
    spaPackages.includes(dependency)
  );

  // ---------------------------------------------------------------
  // Routes and pages
  // ---------------------------------------------------------------
  const pageMap = new Map<string, WebsitePageInfo>();

  for (const entry of htmlEntries) {
    const rel = entry.file.relativePath;
    const base = path.posix.basename(rel);
    if (/^404\.html?$/i.test(base)) continue;

    let route: string;
    const content = entry.content;
    if (/^index\.html?$/i.test(base)) {
      const dir = path.posix.dirname(rel);
      // In a framework SPA the root index.html is only the mount shell; the
      // rendered home screen lives in the component tree, not this document.
      if (dir === '.' && isSpa && /id=["'](root|app)["']/i.test(content)) continue;
      route = dir === '.' ? '/' : `/${dir}`;
    } else {
      route = `/${rel.replace(/\.html?$/i, '')}`;
    }
    route = normalizeRoute(route);
    const sectionCount =
      countMatches(content, /<section\b/gi) +
      countMatches(content, /<header\b/gi) +
      countMatches(content, /<main\b/gi) +
      countMatches(content, /<footer\b/gi) +
      countMatches(content, /<aside\b/gi);
    const words = wordCount(content);
    const images = countMatches(content, /<img\b/gi);
    const imagesMissingAlt = Math.max(
      0,
      images - countMatches(content, /<img\b[^>]*\balt\s*=\s*["'][^"']+["'][^>]*>/gi)
    );

    pageMap.set(route, {
      route,
      name: pageNameFromRoute(route),
      filePath: rel,
      kind: 'html',
      hasContent: words >= 25 || sectionCount >= 2,
      sectionCount,
      wordCount: words,
      hasNav: /<nav\b/i.test(content),
      hasFooter: /<footer\b/i.test(content),
      hasTitle: /<title\b[^>]*>[^<]{2,}<\/title>/i.test(content),
      hasMetaDescription: /<meta\b[^>]*name=["']description["'][^>]*content=["'][^"']{10,}/i.test(content),
      formCount: countMatches(content, /<form\b/gi),
      buttonCount: countMatches(content, /<button\b/gi),
      imageCount: images,
      imagesMissingAlt,
    });
  }

  for (const file of signals.files) {
    const route = pageFileRoute(file);
    if (!route) continue;
    const existing = pageMap.get(route);
    // Prefer a real page component over an index.html shell for the same route.
    if (existing && !(isSpa && existing.kind === 'html' && route === '/')) continue;
    const content = corpus.getForFile(file);
    const sectionCount =
      countMatches(content, /<(section|header|main|footer|aside|nav)\b/gi) +
      (countMatches(content, /<h[12]\b/gi) > 0 ? 1 : 0);
    const words = wordCount(content);
    const images = countMatches(content, /<(img|Image)\b/gi);
    const imagesMissingAlt = Math.max(
      0,
      images - countMatches(content, /<(img|Image)\b[^>]*\balt\s*=\s*[{'"][^>]*[{'"][^>]*/gi)
    );

    pageMap.set(route, {
      route,
      name: pageNameFromRoute(route),
      filePath: file.relativePath,
      kind: 'page-component',
      hasContent: words >= 15 || sectionCount >= 2 || /return\s*\(/.test(content),
      sectionCount,
      wordCount: words,
      hasNav: /(<nav\b|<Navbar|<Header\b)/i.test(content),
      hasFooter: /(<footer\b|<Footer\b)/i.test(content),
      hasTitle: /(<title\b|metadata\s*=|Head\b)/i.test(content),
      hasMetaDescription: /(name=["']description["']|description\s*:)/i.test(content),
      formCount: countMatches(content, /<form\b/gi),
      buttonCount: countMatches(content, /<button\b/gi),
      imageCount: images,
      imagesMissingAlt,
    });
  }

  for (const def of signals.routeDefinitions) {
    const route = normalizeRoute(def.route);
    if (pageMap.has(route)) continue;
    const content = corpus.get(def.filePath);
    pageMap.set(route, {
      route,
      name: pageNameFromRoute(route),
      filePath: def.filePath,
      kind: 'route-definition',
      hasContent: content.length > 200,
      sectionCount: countMatches(content, /<(section|main|header|footer)\b/gi),
      wordCount: wordCount(content),
      hasNav: false,
      hasFooter: false,
      hasTitle: false,
      hasMetaDescription: false,
      formCount: countMatches(content, /<form\b/gi),
      buttonCount: countMatches(content, /<button\b/gi),
      imageCount: countMatches(content, /<img\b/gi),
      imagesMissingAlt: 0,
    });
  }

  const pages = Array.from(pageMap.values()).sort((a, b) =>
    a.route === '/' ? -1 : b.route === '/' ? 1 : a.route.localeCompare(b.route)
  );

  const siteHasNav = pages.some((p) => p.hasNav) || /(<nav\b|<Navbar|<Sidebar|<Header\b)/i.test(allContent);
  const siteHasFooter = pages.some((p) => p.hasFooter) || /<footer\b|<Footer\b/i.test(allContent);
  for (const page of pages) {
    page.hasNav = page.hasNav || siteHasNav;
    page.hasFooter = page.hasFooter || siteHasFooter;
  }

  // ---------------------------------------------------------------
  // Navigation, links, buttons and forms
  // ---------------------------------------------------------------
  const linkTargets: Array<{ href: string; source: string }> = [];
  for (const entry of [...htmlEntries, ...sourceEntries]) {
    const hrefRegex = /\bhref\s*=\s*["']([^"']+)["']/gi;
    let hrefMatch: RegExpExecArray | null;
    while ((hrefMatch = hrefRegex.exec(entry.content)) !== null) {
      if (isInternalLink(hrefMatch[1]) && !ASSET_EXTENSIONS.test(hrefMatch[1])) {
        linkTargets.push({ href: hrefMatch[1], source: entry.file.relativePath });
      }
    }
    const toRegex = /<Link\b[^>]*\bto\s*=\s*["']([^"']+)["']/gi;
    let toMatch: RegExpExecArray | null;
    while ((toMatch = toRegex.exec(entry.content)) !== null) {
      if (isInternalLink(toMatch[1])) linkTargets.push({ href: toMatch[1], source: entry.file.relativePath });
    }
  }

  const routeSet = new Set(pages.map((p) => normalizeRoute(p.route)));
  const brokenSet = new Set<string>();
  const unresolved = new Set<string>();
  for (const link of linkTargets) {
    const clean = link.href.split('?')[0].split('#')[0].trim();
    if (!clean || clean === '/' || clean === '.' || clean === '#') continue;
    if (clean.startsWith('#') || clean.includes(':') || clean.includes('{{') || clean.includes('${')) continue;

    const normalized = normalizeRoute(clean);
    if (routeSet.has(normalized)) continue;

    const staticCandidate = clean.replace(/^\//, '');
    if (assetExists(signals.rootPath, link.source, staticCandidate)) continue;

    const hasPagePrefixMatch = Array.from(routeSet).some((r) => {
      if (!r.includes('/:')) return false;
      const prefix = r.split('/:')[0];
      return normalized === prefix || normalized.startsWith(`${prefix}/`);
    });
    if (hasPagePrefixMatch) continue;

    unresolved.add(clean);
    brokenSet.add(`${link.source} → ${link.href}`);
  }

  const buttons = countMatches(allContent, /<button\b/gi);
  const links = countMatches(allContent, /<a\b/gi) + countMatches(allContent, /<Link\b/gi);
  const onClickHandlers = countMatches(allContent, /\bonClick\s*=/gi);
  const onSubmitHandlers = countMatches(allContent, /\bonSubmit\s*=/gi);
  const placeholderInteractions =
    countMatches(allContent, /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/gi) +
    countMatches(allContent, /href\s*=\s*["']#["']/gi) +
    countMatches(allContent, /\balert\s*\(/gi) +
    countMatches(allContent, /onClick\s*=\s*\{\s*console\.log/gi);
  const wiredInteractions =
    onClickHandlers +
    onSubmitHandlers +
    linkTargets.filter((l) => !brokenSet.has(`${l.source} → ${l.href}`)).length +
    countMatches(allContent, /<button\b[^>]*type\s*=\s*["']submit["']/gi);

  const forms = extractForms([...htmlEntries, ...sourceEntries]);
  const validationSignals =
    countMatches(allContent, /\brequired\b/gi) +
    countMatches(allContent, /\bpattern\s*=/gi) +
    countMatches(allContent, /\b(zod|yup|react-hook-form|validate|validation)\b/gi);

  // ---------------------------------------------------------------
  // Responsive design evidence
  // ---------------------------------------------------------------
  const mediaBreakpoints = new Set<string>();
  for (const entry of cssEntries) {
    const regex = /@media[^{]*?\((?:min|max)-width\s*:\s*([0-9.]+(?:px|em|rem))\)/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(entry.content)) !== null) mediaBreakpoints.add(match[1]);
    for (const inline of [entry.content]) void inline;
  }

  const classText = [
    ...Array.from(allContent.matchAll(/className\s*=\s*["'`]([^"'`]+)["'`]/gi)).map((m) => m[1]),
    ...Array.from(allHtml.matchAll(/class\s*=\s*["']([^"']+)["']/gi)).map((m) => m[1]),
  ].join(' ');
  const tailwindBreakpoints = ['sm', 'md', 'lg', 'xl', '2xl'].filter((bp) =>
    new RegExp(`\\b${bp}:`, 'i').test(classText)
  );
  const hasViewportMeta = htmlEntries.some((e) => /<meta\b[^>]*name=["']viewport["']/i.test(e.content));
  const fluidLayoutSignals =
    countMatches(allContent, /display\s*:\s*(flex|grid)/gi) +
    countMatches(classText, /\b(flex|grid|container|w-full|max-w-|min-h-screen|mx-auto)\b/gi) +
    countMatches(allContent, /\b(clamp\(|minmax\(|fit-content|auto-fit)\b/gi);
  const mobileNavSignals =
    countMatches(
      allContent,
      /\b(md:hidden|hidden\s+md:flex|mobile-menu|mobileMenu|hamburger|menu-toggle|data-menu-toggle|isMenuOpen|setMenuOpen|aria-expanded)\b/gi
    ) +
    countMatches(allContent, /<button\b[^>]*aria-label\s*=\s*["'][^"']*menu[^"']*["']/gi);
  const responsiveImageSignals =
    countMatches(allContent, /\bsrcset\s*=/gi) +
    countMatches(classText, /\b(max-w-full|object-cover|object-contain|w-full|h-auto)\b/gi) +
    countMatches(allContent, /\bloading\s*=\s*["']lazy["']/gi);

  // ---------------------------------------------------------------
  // Assets
  // ---------------------------------------------------------------
  const imageRegex = /<(?:img|Image)\b([^>]*)>/gi;
  let imageRefs = 0;
  let imagesWithAlt = 0;
  const missingAssets = new Set<string>();
  let resolvedImages = 0;

  const mediaSourceRegex = /(?:src|srcSet|poster)\s*=\s*["'`]([^"'`]+)["'`]/gi;
  for (const entry of [...htmlEntries, ...sourceEntries]) {
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imageRegex.exec(entry.content)) !== null) {
      imageRefs += 1;
      if (/\balt\s*=\s*["'`][^"'`]+["'`]/i.test(imgMatch[1])) imagesWithAlt += 1;
    }

    let srcMatch: RegExpExecArray | null;
    while ((srcMatch = mediaSourceRegex.exec(entry.content)) !== null) {
      const ref = srcMatch[1];
      if (!ref || ref.startsWith('{') || ref.includes('${') || /^(https?:|data:)/i.test(ref)) continue;
      if (!ASSET_EXTENSIONS.test(ref.split('?')[0])) continue;
      if (assetExists(signals.rootPath, entry.file.relativePath, ref)) resolvedImages += 1;
      else missingAssets.add(ref);
    }

    const importRegex = /import\s+\w+\s+from\s+["']([^"']+\.(?:png|jpe?g|gif|webp|avif|svg|ico))["']/gi;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = importRegex.exec(entry.content)) !== null) {
      if (assetExists(signals.rootPath, entry.file.relativePath, importMatch[1])) resolvedImages += 1;
      else missingAssets.add(importMatch[1]);
    }
  }

  const imagesMissingAlt = Math.max(0, imageRefs - imagesWithAlt);

  // ---------------------------------------------------------------
  // Integrations, SEO, accessibility, reliability, deployment
  // ---------------------------------------------------------------
  const apiCalls =
    countMatches(allContent, /\bfetch\s*\(/gi) +
    countMatches(allContent, /\baxios\.(get|post|put|delete|patch)\s*\(/gi) +
    countMatches(allContent, /\buseQuery\b|\buseSWR\b|\buseMutation\b/gi);
  const endpointSet = new Set<string>();
  for (const match of allContent.matchAll(/["'`](\/api\/[A-Za-z0-9_\-/:{}[\]$]*|\/graphql)["'`]/gi)) {
    endpointSet.add(match[1]);
  }
  const backendRouteCount =
    countMatches(allContent, /\b(?:router|app)\.(?:get|post|put|patch|delete)\s*\(/gi) +
    signals.files.filter((f) => /(^|\/)route\.(ts|js)$/i.test(f.relativePath)).length;
  const envVarRefs =
    countMatches(allContent, /\bprocess\.env\./g) + countMatches(allContent, /\bimport\.meta\.env\./g);
  const hasAnalytics = /gtag|googletagmanager|plausible|umami|posthog|mixpanel|hotjar|analytics/i.test(allContent);
  const hasThirdPartySdk = /stripe|supabase|firebase|sentry|clerk|auth0|mapbox|cloudinary|algolia|openai|anthropic|mailchimp|resend|twilio/i.test(
    allContent
  );

  const siteAll = allContent;
  const pagesWithTitle = pages.filter(
    (p) => p.hasTitle || countMatches(corpus.get(p.filePath), /<title|<Head|metadata\s*=/gi) > 0
  ).length;
  const pagesWithDescription = pages.filter(
    (p) =>
      p.hasMetaDescription ||
      countMatches(corpus.get(p.filePath), /name=["']description["']|description\s*:/gi) > 0
  ).length;
  const pagesWithOpenGraph = pages.filter((p) =>
    /og:title|openGraph|property=["']og:/i.test(corpus.get(p.filePath))
  ).length;
  const pagesWithCanonical = pages.filter((p) => /rel=["']canonical["']|canonical\s*:/i.test(corpus.get(p.filePath))).length;
  const pageFileSet = new Set(pages.map((p) => p.filePath));
  const pagesWithLang = htmlEntries.filter(
    (e) => pageFileSet.has(e.file.relativePath) && /<html\b[^>]*\blang\s*=/i.test(e.content)
  ).length;
  const singleH1Pages = pages.filter((p) => countMatches(corpus.get(p.filePath), /<h1\b/gi) === 1).length;
  const pagesWithStructuredData = pages.filter((p) => /application\/ld\+json|schema\.org/i.test(corpus.get(p.filePath))).length;
  const hasRobotsTxt = signals.files.some((f) => /(^|\/)robots\.txt$/i.test(f.relativePath));
  const hasSitemap =
    signals.files.some((f) => /(^|\/)sitemap[^/]*\.xml$/i.test(f.relativePath)) ||
    /sitemap/i.test(signals.allText);
  const semanticTags =
    countMatches(siteAll, /<(header|nav|main|section|article|aside|footer|figure|figcaption)\b/gi);
  const headingCount = countMatches(siteAll, /<h[1-6]\b/gi);

  const inputs = countMatches(siteAll, /<(input|select|textarea)\b/gi);
  const labelledInputs =
    countMatches(siteAll, /aria-label\s*=/gi) +
    countMatches(siteAll, /<label\b/gi) +
    countMatches(siteAll, /htmlFor\s*=/gi);
  const ariaAttributes = countMatches(siteAll, /\baria-[a-z-]+\s*=/gi);
  const labelElements = countMatches(siteAll, /<label\b/gi);
  const divButtons = countMatches(siteAll, /<div\b[^>]*\bonClick\s*=/gi);
  const focusStyles =
    countMatches(allContent, /:focus(-visible|-within)?/gi) +
    countMatches(classText, /\bfocus(-visible|-within)?:/gi);
  const skipLinks = countMatches(siteAll, /skip to (main|content)/gi);

  const errorBoundaries = countMatches(allContent, /ErrorBoundary|componentDidCatch|error\.tsx|errorElement/gi);
  const tryCatchBlocks = countMatches(allContent, /\btry\s*\{/gi);
  const catchHandlers = countMatches(allContent, /\bcatch\s*[({]/gi);
  const loadingStates = countMatches(siteAll, /\b(isLoading|loading|Skeleton|Spinner|loading\.tsx)\b/gi);
  const emptyStates = countMatches(siteAll, /\b(empty state|no results|nothing here|emptyState|EmptyState)\b/gi);
  const has404Page = signals.files.some((f) =>
    /(^|\/)(404\.html?|not-found\.(tsx|jsx|ts|js)|NotFound\.(tsx|jsx|vue)|404\.(tsx|jsx|vue))$/i.test(f.relativePath)
  );
  const formErrorMessages = countMatches(allContent, /\b(error|invalid|required|setError|formState\.errors)\b/gi);

  const deploymentConfigs = signals.files
    .filter((f) =>
      /(^|\/)(vercel\.json|netlify\.toml|netlify\.config\.(js|ts)|wrangler\.(toml|jsonc?)|firebase\.json|Dockerfile|docker-compose\.ya?ml|CNAME|\.github\/workflows\/[^/]+\.ya?ml|azure-pipelines\.yml|app\.yaml|Procfile|render\.yaml|fly\.toml)$/i.test(
        f.relativePath
      )
    )
    .map((f) => f.relativePath);
  const hasEnvExample = signals.files.some((f) => /(^|\/)\.env\.(example|sample|template)$/i.test(f.relativePath));
  const hasDocker = deploymentConfigs.some((c) => /docker/i.test(c));
  const hasCi = deploymentConfigs.some((c) => /\.github\/workflows/i.test(c));
  const hasHostingConfig = deploymentConfigs.some((c) => /(vercel|netlify|wrangler|firebase|render|fly|app\.yaml|CNAME)/i.test(c));
  const hasDeployScript = Object.keys(signals.scripts).some((s) => /deploy|publish|release/i.test(s));
  const buildScript = signals.scripts.build || null;

  const placeholderCopy: string[] = [];
  for (const token of ['lorem ipsum', 'coming soon', 'placeholder text', 'your text here', 'sample text', 'dummy content']) {
    if (new RegExp(token, 'i').test(siteAll)) placeholderCopy.push(token);
  }

  // ---------------------------------------------------------------
  // Runtime checks (optional, loopback preview server only)
  // ---------------------------------------------------------------
  const runtimeNotes: string[] = [];
  let checkedRoutes = 0;
  let successfulRoutes = 0;
  const failedRoutes: string[] = [];

  if (runtime) {
    runtimeNotes.push(...runtime.notes);
    checkedRoutes = runtime.checkedRoutes;
    successfulRoutes = runtime.successfulRoutes;
    failedRoutes.push(...runtime.failedRoutes);
    for (const result of runtime.routeResults) {
      const page = pages.find((p) => normalizeRoute(p.route) === normalizeRoute(result.route));
      if (page) {
        page.runtimeStatus = result.status ?? undefined;
        page.runtimeVerified = result.ok && result.contentLength > 300;
        if (page.runtimeVerified && !page.hasContent) {
          page.hasContent = true;
          page.wordCount = Math.max(page.wordCount, 30);
        }
      }
    }
  }

  return {
    analyzed: pages.length > 0 || signals.htmlFiles.length > 0,
    pages,
    routes: pages.map((p) => p.route),
    brokenInternalLinks: Array.from(brokenSet).slice(0, 50),
    unresolvedRouteLinks: Array.from(unresolved).slice(0, 50),
    navigationMenus: countMatches(siteAll, /<nav\b/gi),
    buttons,
    links,
    wiredInteractions,
    placeholderInteractions,
    forms,
    validationSignals,
    interactiveStateHooks:
      countMatches(allContent, /\buseState\b|\buseReducer\b/gi) + countMatches(allContent, /\bzustand|createStore/gi),
    modals: countMatches(allContent, /\b(Modal|Dialog|isOpen|showModal)\b/gi),
    carousels: countMatches(allContent, /\b(carousel|slider|swiper|slick)\b/gi),
    animationSignals:
      countMatches(classText, /\b(animate-|transition-|duration-|ease-)/gi) +
      countMatches(allContent, /framer-motion|gsap|motion\./gi),
    cssKeyframes: countMatches(allContent, /@keyframes\b/gi),
    transitionClasses: countMatches(classText, /\b(transition|duration|ease)-/gi),
    mediaQueryCount: cssEntries.reduce((sum, e) => sum + countMatches(e.content, /@media\b/gi), 0),
    breakpoints: Array.from(mediaBreakpoints).slice(0, 12),
    tailwindBreakpoints,
    hasViewportMeta,
    fluidLayoutSignals,
    mobileNavSignals,
    responsiveImageSignals,
    imageRefs,
    resolvedImages,
    missingAssets: Array.from(missingAssets).slice(0, 30),
    imagesWithAlt,
    imagesMissingAlt,
    apiCalls,
    apiEndpoints: Array.from(endpointSet).slice(0, 20),
    envVarRefs,
    backendRouteCount,
    hasAnalytics,
    hasThirdPartySdk,
    seo: {
      pagesWithTitle,
      pagesWithDescription,
      pagesWithOpenGraph,
      pagesWithCanonical,
      pagesWithLang,
      singleH1Pages,
      pagesWithStructuredData,
      hasRobotsTxt,
      hasSitemap,
      semanticTags,
      headingCount,
    },
    accessibility: {
      ariaAttributes,
      labelElements,
      inputs,
      labelledInputs,
      semanticElements: semanticTags,
      divButtons,
      focusStyles,
      skipLinks,
      altCoverage: imageRefs > 0 ? imagesWithAlt / imageRefs : null,
    },
    errorHandling: {
      errorBoundaries,
      tryCatchBlocks,
      catchHandlers,
      loadingStates,
      emptyStates,
      has404Page,
      formErrorMessages,
    },
    deployment: {
      configs: Array.from(new Set(deploymentConfigs)).slice(0, 20),
      buildScript,
      hasEnvExample,
      hasDocker,
      hasCi,
      hasHostingConfig,
      hasDeployScript,
    },
    runtime: {
      baseUrl: runtime?.baseUrl || null,
      checkedRoutes,
      successfulRoutes,
      failedRoutes,
      notes: runtimeNotes,
    },
    placeholderCopy,
    detected404: has404Page,
  };
}
