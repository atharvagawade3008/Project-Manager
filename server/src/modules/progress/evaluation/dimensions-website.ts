import { check, countContentOccurrences, filesMatching, ratio, scoreChecks } from './evidence-utils.js';
import { DimensionContext, DimensionPartial } from './types.js';

const MAX = (value: number) => Math.min(1, Math.max(0, value));

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function expectedPageRequirementCount(ctx: DimensionContext): number {
  return ctx.requirements.filter((r) => r.included && r.dimension === 'pages').length;
}

export function evaluatePages(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;

  if (!site || site.pages.length === 0) {
    const pageFiles = ctx.signals.pageFiles;
    const populated = pageFiles.filter((p) => ctx.corpus.get(p).length > 250);
    const checks = [
      check('Application screens exist', `${pageFiles.length} screen/page module(s) discovered.`, pageFiles.length > 0, 30),
      check(
        'Screens contain implementation',
        `${populated.length}/${pageFiles.length} screen modules contain meaningful content.`,
        ratio(populated.length, pageFiles.length),
        40
      ),
      check('Navigation and layout components', 'A navigation, layout or shell component is present.', filesMatching(ctx.signals, /(nav|layout|shell|sidebar|header)/i).length > 0, 30),
    ];
    return scoreChecks(checks, {
      summary: 'No rendered web routes were discovered; screen/page modules were assessed from source structure.',
      confidenceBase: 68,
    });
  }

  const pages = site.pages;
  const completePages = pages.filter((p) => p.hasContent);
  const sectionedPages = pages.filter((p) => p.sectionCount >= 1);
  const requiredPages = expectedPageRequirementCount(ctx);
  const pageCoverage = requiredPages > 0 ? ratio(pages.length, requiredPages) : 1;

  const checks = [
    check('Home or root page exists', pages.some((p) => p.route === '/') ? 'A root route is defined.' : 'No root (/) route was discovered.', pages.some((p) => p.route === '/'), 10),
    check(
      'Every discovered page has substantive content',
      `${completePages.length}/${pages.length} pages contain real copy or section structure.`,
      ratio(completePages.length, pages.length),
      25
    ),
    check('Shared navigation is implemented', `${site.navigationMenus} navigation element(s) detected.`, site.navigationMenus > 0, 15),
    check('Footer is present', `${pages.filter((p) => p.hasFooter).length} page(s) expose a footer.`, pages.some((p) => p.hasFooter), 10),
    check(
      'Page sections are implemented',
      `${sectionedPages.length}/${pages.length} pages contain structural sections or headings.`,
      ratio(sectionedPages.length, pages.length),
      15
    ),
    check(
      'Internal navigation resolves',
      site.brokenInternalLinks.length === 0
        ? `All ${site.links} internal links resolve.`
        : `${site.brokenInternalLinks.length} unresolved internal link(s): ${site.brokenInternalLinks.slice(0, 3).join('; ')}`,
      ratio(Math.max(0, site.links - site.brokenInternalLinks.length), Math.max(1, site.links)),
      15
    ),
    check(
      'Pages required by the confirmed scope exist',
      requiredPages === 0
        ? 'No explicit page requirements are in scope; discovered routes were used as the baseline.'
        : `${pages.length} route(s) exist against ${requiredPages} required page requirement(s).`,
      pageCoverage,
      10
    ),
  ];

  if (site.runtime.checkedRoutes > 0) {
    checks.push(
      check(
        'Discovered routes respond at runtime',
        `${site.runtime.successfulRoutes}/${site.runtime.checkedRoutes} checked route(s) returned a successful response.`,
        ratio(site.runtime.successfulRoutes, site.runtime.checkedRoutes),
        10,
        site.runtime.baseUrl || undefined
      )
    );
  }

  return scoreChecks(checks, {
    summary: `${pages.length} route(s) discovered (${pages.map((p) => p.route).slice(0, 6).join(', ')}${
      pages.length > 6 ? ', …' : ''
    }); ${completePages.length} contain substantive page content.`,
    confidenceBase: 78,
    fileLimit: 20,
  });
}

export function evaluateFunctional(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;
  if (!site || !site.analyzed) {
    return scoreChecks([check('Interactive behaviour', 'No web interaction surface was discovered.', 0, 100)], {
      summary: 'No user-facing interaction surface was available to assess.',
      confidenceBase: 40,
    });
  }

  const actionable = Math.max(1, site.buttons + site.links + site.forms.length);
  const adjustedWired = Math.max(0, site.wiredInteractions - site.placeholderInteractions * 0.5);
  const wiring = MAX(adjustedWired / actionable);
  const forms = site.forms;
  const functionalForms = forms.filter((f) => !f.isPlaceholder && (f.hasSubmitHandler || f.hasAction || f.hasBackendEndpoint));
  const formRatio = forms.length === 0 ? 1 : functionalForms.length / forms.length;
  const validatedForms = forms.filter((f) => f.hasValidation).length;
  const validationRatio = forms.length === 0 ? 1 : validatedForms / forms.length;
  const linkIntegrity = MAX(1 - site.brokenInternalLinks.length / Math.max(1, site.links));
  const needsState = site.buttons > 0 || forms.length > 0 || site.modals > 0;
  const stateRatio = needsState ? (site.interactiveStateHooks > 0 ? 1 : 0.4) : 1;

  const checks = [
    check(
      'Interactive elements are wired',
      `${site.wiredInteractions} wired interaction(s), ${site.placeholderInteractions} placeholder/no-op interaction(s), ${actionable} actionable element(s).`,
      wiring,
      30
    ),
    check(
      'No placeholder interactions remain',
      site.placeholderInteractions === 0
        ? 'No empty handlers, alert stubs or dead href="#" links detected.'
        : `${site.placeholderInteractions} placeholder interaction(s) detected (empty onClick, alert(), or href="#").`,
      MAX(1 - site.placeholderInteractions / Math.max(1, actionable)),
      15
    ),
    check(
      'Navigation integrity',
      site.brokenInternalLinks.length === 0
        ? 'Every discovered internal link resolves to a page or asset.'
        : `${site.brokenInternalLinks.length} broken internal link(s).`,
      linkIntegrity,
      20
    ),
    check(
      'Forms submit to real behaviour',
      forms.length === 0
        ? 'No forms are required or present in this project.'
        : `${functionalForms.length}/${forms.length} form(s) have a submit handler, action or backend endpoint.`,
      formRatio,
      15
    ),
    check(
      'Forms validate input',
      forms.length === 0 ? 'No form validation is required.' : `${validatedForms}/${forms.length} form(s) declare validation.`,
      validationRatio,
      10
    ),
    check(
      'Interaction state is managed',
      needsState
        ? `${site.interactiveStateHooks} state hook(s) and ${site.modals} modal/dialog signal(s) detected.`
        : 'No interactive state is required for this static experience.',
      stateRatio,
      10
    ),
  ];

  if (site.runtime.checkedRoutes > 0) {
    checks.push(
      check(
        'Pages respond when served',
        `${site.runtime.successfulRoutes}/${site.runtime.checkedRoutes} route(s) responded successfully.`,
        ratio(site.runtime.successfulRoutes, site.runtime.checkedRoutes),
        10
      )
    );
  }

  return scoreChecks(checks, {
    summary: `${site.buttons} button(s), ${site.links} link(s) and ${forms.length} form(s) inspected; ${
      forms.length - functionalForms.length
    } form(s) lack working submission.`,
    confidenceBase: 74,
  });
}

export function evaluateWebsiteUiUx(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;
  if (!site) {
    return scoreChecks([check('UI implementation', 'No UI files discovered.', 0, 100)], {
      summary: 'No user interface could be inspected.',
      confidenceBase: 40,
    });
  }

  const stylingFiles = ctx.signals.cssFiles.length;
  const tailwind =
    filesMatching(ctx.signals, /tailwind\.config/i).length > 0 ||
    ctx.signals.dependencies.includes('tailwindcss') ||
    ctx.signals.devDependencies.includes('tailwindcss');
  const componentFiles = filesMatching(ctx.signals, /(^|\/)(components|ui|widgets)\//i);
  const pages = site.pages;
  const hasImages = site.imageRefs > 0;
  const hasIcons = /lucide|react-icons|heroicons|font-awesome|@iconify|icon/i.test(ctx.signals.allText);
  const focusOrHover = site.accessibility.focusStyles > 0 || countContentOccurrences(ctx.corpus, /:hover|hover:/gi) > 0;
  const animation = site.animationSignals + site.cssKeyframes + site.transitionClasses;
  const loadingStates = site.errorHandling.loadingStates + site.errorHandling.emptyStates;

  const checks = [
    check('Styling system present', `${stylingFiles} stylesheet(s); Tailwind ${tailwind ? 'detected' : 'not detected'}.`, stylingFiles > 0 || tailwind, 12),
    check('Structural layout primitives', `${site.navigationMenus} nav element(s) and shared header/footer shells.`, site.navigationMenus > 0 && pages.some((p) => p.hasFooter), 12),
    check('Component decomposition', `${componentFiles.length} reusable component file(s) detected.`, ratio(componentFiles.length, 3), 12),
    check('Heading hierarchy', `${site.seo.headingCount} headings across ${pages.length} page(s).`, ratio(site.seo.headingCount, Math.max(2, pages.length * 2)), 8),
    check('Visual media', `${site.imageRefs} image reference(s), ${site.resolvedImages} resolved asset(s).`, site.imageRefs > 0 && site.missingAssets.length === 0 ? 1 : ratio(site.resolvedImages, Math.max(1, site.missingAssets.length + site.resolvedImages)), 10),
    check('Interaction feedback', `${site.accessibility.focusStyles} focus style(s) and hover states.`, focusOrHover ? 1 : 0.4, 10),
    check('Motion and transitions', `${animation} animation/transition signal(s) detected.`, ratio(animation, 3), 8),
    check('Iconography', 'An icon library or inline SVG iconography is used.', hasIcons ? 1 : 0.3, 6),
    check('Loading and empty states', `${site.errorHandling.loadingStates} loading and ${site.errorHandling.emptyStates} empty-state signal(s).`, ratio(loadingStates, 2), 10),
    check('Responsive styling classes', `${site.tailwindBreakpoints.length} responsive breakpoint family/families detected.`, site.tailwindBreakpoints.length > 0 || site.mediaQueryCount > 0 ? 1 : 0, 6),
    check('Visual consistency', 'Shared class system / repeated design tokens across pages.', stylingFiles > 0 && pages.length > 1 ? 1 : 0.5, 6),
  ];

  return scoreChecks(checks, {
    summary: `UI structure inspected across ${pages.length} page(s), ${componentFiles.length} component file(s) and ${stylingFiles} stylesheet(s). Visual appearance was not rendered or visually reviewed.`,
    confidenceBase: 62,
  });
}

export function evaluateResponsive(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;
  if (!site) {
    return scoreChecks([check('Responsive CSS', 'No website was detected.', 0, 100)], {
      summary: 'No responsive surface to inspect.',
      confidenceBase: 35,
    });
  }

  const breakpointCount = site.breakpoints.length + site.tailwindBreakpoints.length;
  const mobileNav = site.mobileNavSignals > 0;
  const runtimeVerified = false; // HTTP checks cannot verify rendered layout at multiple viewports.

  const checks = [
    check('Viewport meta tag', 'Pages declare a responsive viewport.', site.hasViewportMeta, 15),
    check('Breakpoint system', `${site.mediaQueryCount} media quer${site.mediaQueryCount === 1 ? 'y' : 'ies'}; breakpoints: ${[...site.breakpoints, ...site.tailwindBreakpoints].slice(0, 6).join(', ') || 'none'}.`, ratio(breakpointCount, 3), 20),
    check('Fluid layout primitives', `${site.fluidLayoutSignals} flex/grid/fluid-width signal(s) detected.`, ratio(site.fluidLayoutSignals, 6), 20),
    check('Mobile navigation pattern', `${site.mobileNavSignals} mobile-menu signal(s) detected.`, mobileNav ? 1 : 0, 15),
    check('Responsive media handling', `${site.responsiveImageSignals} responsive image signal(s).`, ratio(site.responsiveImageSignals, 2), 10),
    check('Multiple breakpoints covered', `${breakpointCount} distinct breakpoint value(s).`, ratio(breakpointCount, 2), 10),
    check(
      'Rendered layout verified at real viewports',
      runtimeVerified
        ? 'A browser viewport check confirmed the layout.'
        : 'Not verified: HTTP checks and media-query inspection cannot prove the rendered layout works on real devices.',
      runtimeVerified ? 1 : 0,
      10
    ),
  ];

  return scoreChecks(checks, {
    summary: `Breakpoint and fluid-layout evidence found (${breakpointCount} breakpoint value(s)); rendered responsive behaviour is unverified without an actual browser viewport check, so the score is capped.`,
    confidenceBase: 58,
    cap: 85,
  });
}

export function evaluateContent(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;
  if (!site) {
    return scoreChecks([check('Content', 'No content files discovered.', 0, 100)], {
      summary: 'No content surface could be inspected.',
      confidenceBase: 35,
    });
  }

  const words = site.pages.map((p) => p.wordCount);
  const avgWords = average(words);
  const totalAssets = site.resolvedImages + site.missingAssets.length;
  const assetRatio = totalAssets === 0 ? 0 : site.resolvedImages / totalAssets;
  const placeholderCount = site.placeholderCopy.length;

  const checks = [
    check('Real page copy', `${Math.round(avgWords)} average words across ${site.pages.length} page(s).`, ratio(avgWords, 120), 25),
    check('No placeholder copy', placeholderCount === 0 ? 'No lorem ipsum or placeholder copy detected.' : `Placeholder copy: ${site.placeholderCopy.join(', ')}.`, placeholderCount === 0 ? 1 : 0, 15),
    check('Imagery and visual assets', `${site.imageRefs} image reference(s), ${site.resolvedImages} resolved asset(s).`, ratio(site.resolvedImages, 3), 15),
    check('Referenced assets resolve', site.missingAssets.length === 0 ? 'All referenced local assets exist.' : `${site.missingAssets.length} missing asset reference(s): ${site.missingAssets.slice(0, 3).join(', ')}.`, assetRatio, 20),
    check('Alt text coverage', site.imageRefs === 0 ? 'No images require alt text.' : `${site.imagesWithAlt}/${site.imageRefs} image(s) have alt text.`, site.imageRefs === 0 ? 1 : site.imagesWithAlt / site.imageRefs, 10),
    check('Content metadata', `${site.seo.pagesWithTitle}/${site.pages.length} pages have a title.`, ratio(site.seo.pagesWithTitle, site.pages.length), 10),
    check('Asset variety', `${filesMatching(ctx.signals, /\.(svg|png|jpe?g|webp|woff2?|mp4)$/i).length} media/font file(s) present.`, filesMatching(ctx.signals, /\.(svg|png|jpe?g|webp|woff2?|mp4)$/i).length > 0 ? 1 : 0, 5),
  ];

  return scoreChecks(checks, {
    summary: `${site.pages.length} page(s) average ${Math.round(avgWords)} words; ${site.resolvedImages} asset(s) resolve and ${site.missingAssets.length} are missing.`,
    confidenceBase: 78,
  });
}

export function evaluateIntegrations(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;
  if (!site) {
    return scoreChecks([check('Integrations', 'No integration surface discovered.', 0, 100)], {
      summary: 'No integration surface was detected.',
      confidenceBase: 40,
    });
  }

  const forms = site.forms;
  const wiredForms = forms.filter((f) => f.hasSubmitHandler || f.hasAction || f.hasBackendEndpoint);
  const externalFormAction = forms.some((f) => f.hasAction || /action\s*=\s*["']https?:/i.test(f.evidence));
  const fetchErrorHandling =
    countContentOccurrences(ctx.corpus, /\bcatch\s*[({]/gi) + countContentOccurrences(ctx.corpus, /\berror\b/gi);
  const endpoints = site.apiEndpoints.length + site.backendRouteCount;
  const envDocs = ctx.signals.files.some((f) => /(^|\/)\.env\.(example|sample|template)$/i.test(f.relativePath));

  const checks = [
    check('API calls are implemented', `${site.apiCalls} client API call(s) detected.`, ratio(site.apiCalls, 1), 20),
    check('Forms reach a backend or service', forms.length === 0 ? 'No form backend is required.' : `${wiredForms.length}/${forms.length} form(s) are wired.`, forms.length === 0 ? 1 : wiredForms.length / forms.length, 20),
    check('Server routes or external service actions', `${site.backendRouteCount} server route(s); external form action: ${externalFormAction ? 'yes' : 'no'}.`, site.backendRouteCount > 0 || externalFormAction ? 1 : 0, 20),
    check('Integration endpoints are defined', `${endpoints} endpoint reference(s) discovered.`, ratio(endpoints, 2), 10),
    check('Environment configuration is documented', envDocs ? '.env example present.' : 'No .env example/template found.', envDocs ? 1 : 0, 10),
    check('Failure handling around integrations', `${fetchErrorHandling} error-handling signal(s).`, ratio(fetchErrorHandling, 3), 10),
    check('Analytics or third-party service', `${site.hasAnalytics ? 'Analytics' : 'No analytics'}; ${site.hasThirdPartySdk ? 'third-party SDK present' : 'no SDK'}.`, site.hasAnalytics || site.hasThirdPartySdk ? 1 : 0, 10),
  ];

  return scoreChecks(checks, {
    summary: `${site.apiCalls} API call(s), ${forms.length} form(s), ${site.backendRouteCount} server route(s); integrations ${
      site.apiCalls + forms.length + site.backendRouteCount > 0 ? 'are present' : 'were not detected'
    }.`,
    confidenceBase: 76,
  });
}

export function evaluateSeo(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;
  if (!site) {
    return scoreChecks([check('SEO', 'No public pages discovered.', 0, 100)], {
      summary: 'No public pages were available for crawl/accessibility checks.',
      confidenceBase: 35,
    });
  }

  const pageCount = Math.max(1, site.pages.length);
  const inputs = site.accessibility.inputs;
  const labelledRatio = inputs === 0 ? 1 : ratio(site.accessibility.labelledInputs, inputs);
  const altRatio = site.imageRefs === 0 ? 1 : site.imagesWithAlt / site.imageRefs;

  const checks = [
    check('Page titles', `${site.seo.pagesWithTitle}/${pageCount} pages have a title.`, ratio(site.seo.pagesWithTitle, pageCount), 12),
    check('Meta descriptions', `${site.seo.pagesWithDescription}/${pageCount} pages have a meta description.`, ratio(site.seo.pagesWithDescription, pageCount), 12),
    check('Open Graph metadata', `${site.seo.pagesWithOpenGraph}/${pageCount} pages expose Open Graph tags.`, ratio(site.seo.pagesWithOpenGraph, pageCount), 8),
    check('Canonical URLs', `${site.seo.pagesWithCanonical}/${pageCount} pages declare a canonical URL.`, ratio(site.seo.pagesWithCanonical, pageCount), 6),
    check('Document language', `${site.seo.pagesWithLang} HTML document(s) declare lang.`, site.seo.pagesWithLang > 0, 5),
    check('Single H1 per page', `${site.seo.singleH1Pages}/${pageCount} pages have exactly one H1.`, ratio(site.seo.singleH1Pages, pageCount), 8),
    check('Image alt coverage', `${site.imagesWithAlt}/${site.imageRefs} images have alt text.`, altRatio, 10),
    check('Labels and ARIA', `${site.accessibility.ariaAttributes} ARIA attribute(s), ${site.accessibility.labelElements} label element(s).`, labelledRatio, 12),
    check('Semantic landmarks', `${site.seo.semanticTags} semantic landmark tag(s).`, ratio(site.seo.semanticTags, 3), 5),
    check('robots.txt and sitemap', `robots.txt: ${site.seo.hasRobotsTxt ? 'yes' : 'no'}; sitemap: ${site.seo.hasSitemap ? 'yes' : 'no'}.`, (site.seo.hasRobotsTxt ? 0.5 : 0) + (site.seo.hasSitemap ? 0.5 : 0), 10),
    check('Structured data', `${site.seo.pagesWithStructuredData}/${pageCount} pages expose structured data.`, ratio(site.seo.pagesWithStructuredData, pageCount), 5),
    check(
      'Deployment configuration',
      site.deployment.configs.length > 0 ? `Config: ${site.deployment.configs.join(', ')}.` : 'No hosting/deployment configuration detected.',
      site.deployment.configs.length > 0 || site.deployment.buildScript ? 1 : 0,
      7
    ),
  ];

  return scoreChecks(checks, {
    summary: `Metadata/accessibility/deployment: ${site.seo.pagesWithTitle}/${pageCount} titles, ${site.seo.pagesWithDescription}/${pageCount} descriptions, ${Math.round(
      altRatio * 100
    )}% alt coverage, ${site.deployment.configs.length} deploy config(s).`,
    confidenceBase: 80,
  });
}

export function evaluateCommerce(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;
  const corpus = ctx.corpus;
  const all = ctx.signals.allText;
  const hasCatalog = filesMatching(ctx.signals, /(products?|catalog|shop)/i).length > 0 || /product catalog|\/products/i.test(all);
  const hasDetail = countContentOccurrences(corpus, /product\.(id|slug)|productId|ProductDetail|addToCart/gi) > 0;
  const hasCart = /cart|basket/i.test(all);
  const hasCheckout = /checkout/i.test(all);
  const hasOrder = /order(s)?\b|orderId|order confirmation/i.test(all);
  const hasSearch = /search|filter|sort/i.test(all) && hasCatalog;
  const hasInventory = /inventory|stock|quantity/i.test(all);
  const hasRuntime = Boolean(site && site.runtime.checkedRoutes > 0 && site.runtime.successfulRoutes > 0);

  const checks = [
    check('Product catalog', 'Product listing/catalog implementation detected.', hasCatalog, 20),
    check('Product detail flow', 'Product detail selection/add-to-cart wiring detected.', hasDetail, 15),
    check('Cart state', 'Cart or basket state detected.', hasCart, 15),
    check('Checkout flow', 'Checkout implementation detected.', hasCheckout, 20),
    check('Order handling', 'Order creation/confirmation state detected.', hasOrder, 10),
    check('Search and filtering', 'Catalog search/filter/sort detected.', hasSearch, 5),
    check('Inventory or stock data', 'Inventory/stock/quantity fields detected.', hasInventory, 5),
    check('Commerce pages respond', site?.runtime.checkedRoutes ? 'Runtime commerce routes responded.' : 'No runtime commerce route check was supplied.', site?.runtime.checkedRoutes ? ratio(site.runtime.successfulRoutes, site.runtime.checkedRoutes) : 0, 10),
  ];

  return scoreChecks(checks, {
    summary: `Commerce flow evidence: catalog=${hasCatalog}, cart=${hasCart}, checkout=${hasCheckout}, orders=${hasOrder}.`,
    confidenceBase: 72,
  });
}

export function evaluatePayments(ctx: DimensionContext): DimensionPartial {
  const all = ctx.signals.allText;
  const deps = [...ctx.signals.dependencies, ...ctx.signals.devDependencies].join(' ');
  const provider = /stripe|paypal|braintree|paddle|lemonsqueezy|square|adyen/i.test(deps + ' ' + all);
  const paymentIntent = /paymentIntent|payment_intent|createPayment|checkout\.sessions|preference/i.test(all);
  const webhook = /webhook/i.test(all);
  const successFailure = /payment_success|payment failed|payment error|succeeded|declined/i.test(all);
  const orderPersistence = /order/i.test(all) && /(create|save|persist)/i.test(all);
  const envConfig = countContentOccurrences(ctx.corpus, /STRIPE|PAYMENT|PUBLIC_KEY|SECRET_KEY/gi) > 0;
  const testMode = /test_mode|test mode|sandbox|sk_test|pk_test/i.test(all);

  const checks = [
    check('Payment provider integrated', provider ? 'Payment provider dependency or API usage detected.' : 'No payment provider integration detected.', provider, 25),
    check('Payment intent/session created server-side', 'Payment intent or checkout session creation detected.', paymentIntent, 20),
    check('Webhook handling', 'Payment webhook handler detected.', webhook, 15),
    check('Payment result handling', 'Success/failure states detected.', successFailure, 15),
    check('Order persistence', 'Order persistence detected.', orderPersistence, 10),
    check('Payment configuration via environment', 'Payment keys referenced through environment configuration.', envConfig, 10),
    check('Test/sandbox mode support', 'Test or sandbox mode configuration detected.', testMode, 5),
  ];

  return scoreChecks(checks, {
    summary: `Payment integration ${provider ? 'detected' : 'not detected'}; ${webhook ? 'webhook handling present' : 'no webhook handling'}.`,
    confidenceBase: 74,
  });
}
