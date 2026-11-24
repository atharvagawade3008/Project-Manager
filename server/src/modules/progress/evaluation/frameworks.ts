import {
  DimensionContext,
  DimensionDefinition,
  MetricGroup,
  ProjectType,
  PROJECT_TYPE_LABELS,
} from './types.js';

type DimensionSeed = Omit<DimensionDefinition, 'applicable'> & {
  applicable?: (ctx: DimensionContext) => boolean;
  exclusionReason?: string;
};

const always = () => true;

function dimension(seed: DimensionSeed): DimensionDefinition {
  return {
    ...seed,
    applicable: seed.applicable || always,
  };
}

function requirementMatches(ctx: DimensionContext, dimensionKey: string, pattern?: RegExp): boolean {
  return ctx.requirements.some(
    (r) =>
      r.included &&
      (r.dimension === dimensionKey || (pattern ? pattern.test(`${r.title} ${r.description}`) : false))
  );
}

function hasIntegrationEvidence(ctx: DimensionContext): boolean {
  const site = ctx.website;
  return Boolean(
    (site && (site.forms.length > 0 || site.apiCalls > 0 || site.backendRouteCount > 0)) ||
      requirementMatches(ctx, 'integrations', /\b(api|integration|crm|newsletter|booking|payment|webhook)\b/i)
  );
}

function hasAuthEvidence(ctx: DimensionContext): boolean {
  return Boolean(
    /\b(auth|login|sign in|signin|sign up|signup|session|jwt|oauth|password|user account|role)\b/i.test(ctx.signals.allText) ||
      requirementMatches(ctx, 'auth', /\b(auth|login|sign in|sign up|session|oauth|user account)\b/i)
  );
}

function hasPublicPages(ctx: DimensionContext): boolean {
  return Boolean(ctx.website?.analyzed && ctx.website.pages.length > 0);
}

const WEBSITE_BASE: DimensionSeed[] = [
  {
    key: 'pages',
    name: 'Page & section completeness',
    description: 'Every discoverable route exists and contains the sections its page type requires (hero, content, navigation, footer).',
    metric: 'PRODUCT',
    weight: 0,
  },
  {
    key: 'functional',
    name: 'Functional completeness',
    description: 'Buttons, links, forms, navigation and interactive elements are wired to real behaviour, not just rendered markup.',
    metric: 'PRODUCT',
    weight: 0,
  },
  {
    key: 'uiux',
    name: 'UI/UX implementation',
    description: 'Layout system, styling consistency, component structure, visual states and interaction feedback.',
    metric: 'PRODUCT',
    weight: 0,
  },
  {
    key: 'responsive',
    name: 'Responsive design',
    description: 'Viewport configuration, breakpoint coverage, fluid layouts and responsive media. Rendered layout is not visually verified unless a runtime check is supplied.',
    metric: 'PRODUCT',
    weight: 0,
  },
  {
    key: 'content',
    name: 'Content & assets',
    description: 'Real copy and imagery are present, referenced assets resolve, and no placeholder copy remains.',
    metric: 'PRODUCT',
    weight: 0,
  },
  {
    key: 'integrations',
    name: 'Integrations & data handling',
    description: 'Forms, APIs, analytics and third-party services are connected and handle responses and failures.',
    metric: 'TECHNICAL',
    weight: 0,
    applicable: hasIntegrationEvidence,
    exclusionReason: 'No forms, API calls, data services or integration requirements were detected for this project.',
  },
  {
    key: 'codeQuality',
    name: 'Code quality & architecture',
    description: 'Project structure, component decomposition, typing, module boundaries, consistency and absence of oversized or dead modules.',
    metric: 'TECHNICAL',
    weight: 0,
  },
  {
    key: 'testing',
    name: 'Testing & reliability',
    description: 'Automated tests, error boundaries, failure handling, loading/empty states and runtime failure recovery.',
    metric: 'READINESS',
    weight: 0,
  },
  {
    key: 'seo',
    name: 'SEO, accessibility & deployment',
    description: 'Crawl metadata, semantic markup, labels and alt text, plus hosting/deployment configuration.',
    metric: 'READINESS',
    weight: 0,
    applicable: hasPublicPages,
    exclusionReason: 'No public web pages were detected, so crawl metadata and browser accessibility checks do not apply.',
  },
];

function websiteFramework(weights: Record<string, number>, overrides: Record<string, DimensionSeed> = {}): DimensionDefinition[] {
  return Object.entries(weights)
    .map(([key, weight]) => {
      const base = WEBSITE_BASE.find((d) => d.key === key) || overrides[key];
      if (!base) return null;
      return dimension({ ...base, ...(overrides[key] || {}), weight });
    })
    .filter((d): d is DimensionDefinition => Boolean(d));
}

const SAAS_EXTRA: DimensionSeed[] = [
  {
    key: 'coreFeatures',
    name: 'Core product workflows',
    description: 'The primary user workflows (sign-up, core action, saved state, return visit) are implemented end to end.',
    metric: 'PRODUCT',
    weight: 0,
  },
  {
    key: 'auth',
    name: 'Authentication & accounts',
    description: 'Account creation, sign-in, session handling, protected areas and role boundaries.',
    metric: 'TECHNICAL',
    weight: 0,
    applicable: hasAuthEvidence,
    exclusionReason: 'No authentication, accounts or user-role requirements were detected for this project.',
  },
  {
    key: 'dataLayer',
    name: 'Data layer & persistence',
    description: 'Database schema, models, migrations, queries and server-side ownership of persistent state.',
    metric: 'TECHNICAL',
    weight: 0,
  },
  {
    key: 'apiDesign',
    name: 'API & server design',
    description: 'Route handlers, request validation, error contracts, authorization checks and service boundaries.',
    metric: 'TECHNICAL',
    weight: 0,
  },
  {
    key: 'security',
    name: 'Security',
    description: 'Input validation, secret handling, protected mutations, password/auth safety and security headers.',
    metric: 'READINESS',
    weight: 0,
  },
  {
    key: 'deployment',
    name: 'Deployment & operations',
    description: 'Build configuration, environment templates, hosting/deploy config, CI and operational readiness.',
    metric: 'READINESS',
    weight: 0,
  },
];

const APP_EXTRA: DimensionSeed[] = [
  {
    key: 'coreFeatures',
    name: 'Core features',
    description: 'The application’s primary capabilities are implemented and reachable, not scaffolded.',
    metric: 'PRODUCT',
    weight: 0,
  },
  {
    key: 'dataLayer',
    name: 'Data layer & persistence',
    description: 'Models, schema, migrations, queries and persistent state handling.',
    metric: 'TECHNICAL',
    weight: 0,
  },
  {
    key: 'apiDesign',
    name: 'API & server design',
    description: 'Route handlers, validation, error contracts, authorization and service boundaries.',
    metric: 'TECHNICAL',
    weight: 0,
  },
  {
    key: 'auth',
    name: 'Authentication & accounts',
    description: 'Sign-in, sessions, protected routes and account boundaries where required.',
    metric: 'TECHNICAL',
    weight: 0,
    applicable: hasAuthEvidence,
    exclusionReason: 'No authentication or account requirements were detected, so this criterion is excluded.',
  },
  {
    key: 'security',
    name: 'Security',
    description: 'Input validation, secret handling, authorization and protective headers.',
    metric: 'READINESS',
    weight: 0,
  },
  {
    key: 'deployment',
    name: 'Deployment & operations',
    description: 'Build, environment, hosting, CI and operational configuration.',
    metric: 'READINESS',
    weight: 0,
  },
  {
    key: 'seo',
    name: 'SEO & accessibility',
    description: 'Crawl metadata and browser accessibility for any public-facing pages.',
    metric: 'READINESS',
    weight: 0,
    applicable: hasPublicPages,
    exclusionReason: 'No public-facing web pages were detected, so crawl metadata and accessibility checks do not apply.',
  },
];

const SAAS_FRAMEWORK = websiteFramework(
  {
    pages: 8,
    coreFeatures: 16,
    uiux: 12,
    responsive: 8,
    auth: 10,
    dataLayer: 10,
    apiDesign: 8,
    codeQuality: 6,
    testing: 6,
    security: 6,
    seo: 4,
    deployment: 6,
  },
  Object.fromEntries(SAAS_EXTRA.map((d) => [d.key, d]))
);

const FULLSTACK_FRAMEWORK = websiteFramework(
  {
    pages: 10,
    coreFeatures: 14,
    uiux: 10,
    responsive: 8,
    dataLayer: 12,
    apiDesign: 12,
    auth: 8,
    codeQuality: 8,
    testing: 6,
    security: 6,
    deployment: 6,
  },
  Object.fromEntries(APP_EXTRA.map((d) => [d.key, d]))
);

const AI_FRAMEWORK = websiteFramework(
  {
    pages: 8,
    coreFeatures: 14,
    uiux: 8,
    responsive: 6,
    modelIntegration: 14,
    prompting: 10,
    dataLayer: 6,
    codeQuality: 6,
    testing: 5,
    evaluation: 8,
    security: 5,
    deployment: 5,
    costLatency: 5,
  },
  {
    ...Object.fromEntries(APP_EXTRA.map((d) => [d.key, d])),
    modelIntegration: {
      key: 'modelIntegration',
      name: 'Model integration',
      description: 'LLM provider wiring, configuration, streaming, retries and offline fallback.',
      metric: 'TECHNICAL',
      weight: 14,
    },
    prompting: {
      key: 'prompting',
      name: 'Prompt & output handling',
      description: 'Prompt templates, system instructions, structured output parsing and response validation.',
      metric: 'TECHNICAL',
      weight: 10,
    },
    evaluation: {
      key: 'evaluation',
      name: 'AI evaluation & guardrails',
      description: 'Eval datasets, output validation, guardrails, rate limiting and failure behaviour for model calls.',
      metric: 'READINESS',
      weight: 8,
    },
    costLatency: {
      key: 'costLatency',
      name: 'Cost & latency controls',
      description: 'Token/time limits, caching, streaming and usage tracking for model calls.',
      metric: 'READINESS',
      weight: 5,
    },
  }
);

const DESKTOP_DIMENSIONS: DimensionDefinition[] = [
  dimension({
    key: 'coreFeatures',
    name: 'Core application features',
    description: 'The primary desktop workflows are implemented and reachable.',
    metric: 'PRODUCT',
    weight: 20,
  }),
  dimension({
    key: 'uiux',
    name: 'Desktop UI/UX',
    description: 'Native window layout, dialogs, menus, keyboard navigation and interaction states.',
    metric: 'PRODUCT',
    weight: 16,
  }),
  dimension({
    key: 'pages',
    name: 'Screens & dialogs',
    description: 'Application windows, views and dialogs required by the product exist and are populated.',
    metric: 'PRODUCT',
    weight: 10,
  }),
  dimension({
    key: 'nativeIntegration',
    name: 'Native integration',
    description: 'Filesystem access, OS APIs, IPC boundaries and platform-specific behaviour.',
    metric: 'TECHNICAL',
    weight: 12,
  }),
  dimension({
    key: 'codeQuality',
    name: 'Code quality & architecture',
    description: 'Module structure, typing, boundaries and maintainability of the application code.',
    metric: 'TECHNICAL',
    weight: 10,
  }),
  dimension({
    key: 'testing',
    name: 'Testing & reliability',
    description: 'Automated tests, crash handling, error reporting and recovery paths.',
    metric: 'READINESS',
    weight: 10,
  }),
  dimension({
    key: 'packaging',
    name: 'Packaging & distribution',
    description: 'Installer/build configuration, icons, version metadata, signing and release artifacts.',
    metric: 'READINESS',
    weight: 12,
  }),
  dimension({
    key: 'updates',
    name: 'Updates & lifecycle',
    description: 'Update mechanism, migration of user data and version compatibility.',
    metric: 'READINESS',
    weight: 5,
  }),
  dimension({
    key: 'security',
    name: 'Security',
    description: 'Local data protection, secret handling and privileged operation boundaries.',
    metric: 'READINESS',
    weight: 5,
  }),
];

const MOBILE_DIMENSIONS: DimensionDefinition[] = [
  dimension({
    key: 'screens',
    name: 'Screens & navigation',
    description: 'Every screen and navigation path required by the product exists and contains real content.',
    metric: 'PRODUCT',
    weight: 18,
  }),
  dimension({
    key: 'coreFeatures',
    name: 'Core features',
    description: 'Primary mobile workflows are implemented beyond scaffolding.',
    metric: 'PRODUCT',
    weight: 18,
  }),
  dimension({
    key: 'uiux',
    name: 'Mobile UI/UX',
    description: 'Touch targets, native patterns, navigation affordances and screen states.',
    metric: 'PRODUCT',
    weight: 14,
  }),
  dimension({
    key: 'adaptiveLayout',
    name: 'Adaptive layout',
    description: 'Layout adapts across phone sizes, orientations and safe areas.',
    metric: 'PRODUCT',
    weight: 10,
  }),
  dimension({
    key: 'platformApis',
    name: 'Platform APIs',
    description: 'Camera, notifications, storage, permissions and other device integrations.',
    metric: 'TECHNICAL',
    weight: 12,
  }),
  dimension({
    key: 'codeQuality',
    name: 'Code quality & architecture',
    description: 'Component structure, state management, typing and module boundaries.',
    metric: 'TECHNICAL',
    weight: 8,
  }),
  dimension({
    key: 'testing',
    name: 'Testing & reliability',
    description: 'Automated tests, error handling, offline behaviour and recovery.',
    metric: 'READINESS',
    weight: 8,
  }),
  dimension({
    key: 'storeReadiness',
    name: 'Store readiness',
    description: 'App metadata, icons, splash screens, permissions declarations and release configuration.',
    metric: 'READINESS',
    weight: 8,
  }),
  dimension({
    key: 'performance',
    name: 'Performance',
    description: 'Asset loading, list virtualization, memory footprint and startup cost controls.',
    metric: 'READINESS',
    weight: 4,
  }),
];

const GAME_DIMENSIONS: DimensionDefinition[] = [
  dimension({
    key: 'gameplay',
    name: 'Core gameplay loop',
    description: 'Player control, input handling, game state and the primary loop are implemented.',
    metric: 'PRODUCT',
    weight: 24,
  }),
  dimension({
    key: 'levelContent',
    name: 'World & level content',
    description: 'Scenes, maps, spawn points and playable content exist beyond placeholders.',
    metric: 'PRODUCT',
    weight: 16,
  }),
  dimension({
    key: 'graphics',
    name: 'Rendering & graphics',
    description: 'Renderer setup, scene composition, lighting, materials and visual assets.',
    metric: 'PRODUCT',
    weight: 14,
  }),
  dimension({
    key: 'uiux',
    name: 'Game UI & HUD',
    description: 'HUD, menus, objectives and player-facing feedback.',
    metric: 'PRODUCT',
    weight: 8,
  }),
  dimension({
    key: 'physics',
    name: 'Physics & simulation',
    description: 'Collision, movement physics and simulation correctness.',
    metric: 'TECHNICAL',
    weight: 12,
  }),
  dimension({
    key: 'codeQuality',
    name: 'Code quality & architecture',
    description: 'Engine/module boundaries, update loop structure, typing and maintainability.',
    metric: 'TECHNICAL',
    weight: 8,
  }),
  dimension({
    key: 'performance',
    name: 'Performance',
    description: 'Frame budget, LOD/instancing, pooling and asset loading strategy.',
    metric: 'READINESS',
    weight: 8,
  }),
  dimension({
    key: 'testing',
    name: 'Testing & reliability',
    description: 'Automated tests and runtime failure recovery.',
    metric: 'READINESS',
    weight: 5,
  }),
  dimension({
    key: 'distribution',
    name: 'Build & distribution',
    description: 'Production build, packaging and release configuration.',
    metric: 'READINESS',
    weight: 5,
  }),
];

const DEVTOOL_DIMENSIONS: DimensionDefinition[] = [
  dimension({
    key: 'apiSurface',
    name: 'API / CLI surface',
    description: 'Commands, flags, exported functions or endpoints exist and are wired.',
    metric: 'PRODUCT',
    weight: 20,
  }),
  dimension({
    key: 'docs',
    name: 'Documentation & examples',
    description: 'README usage, install instructions, examples and reference docs.',
    metric: 'PRODUCT',
    weight: 14,
  }),
  dimension({
    key: 'coreFeatures',
    name: 'Core functionality',
    description: 'The tool actually performs its primary job rather than only parsing arguments.',
    metric: 'PRODUCT',
    weight: 12,
  }),
  dimension({
    key: 'codeQuality',
    name: 'Code quality & architecture',
    description: 'Module boundaries, typing, error propagation and maintainability.',
    metric: 'TECHNICAL',
    weight: 14,
  }),
  dimension({
    key: 'testing',
    name: 'Testing',
    description: 'Automated tests covering commands, edge cases and regressions.',
    metric: 'READINESS',
    weight: 12,
  }),
  dimension({
    key: 'packaging',
    name: 'Packaging & release',
    description: 'Build output, package metadata, versioning and distribution setup.',
    metric: 'READINESS',
    weight: 10,
  }),
  dimension({
    key: 'errorHandling',
    name: 'Error handling & diagnostics',
    description: 'Validation, actionable errors, exit codes and logging.',
    metric: 'READINESS',
    weight: 10,
  }),
  dimension({
    key: 'security',
    name: 'Security',
    description: 'Safe input handling, secret usage and dependency hygiene.',
    metric: 'READINESS',
    weight: 8,
  }),
];

const OTHER_DIMENSIONS: DimensionDefinition[] = [
  dimension({
    key: 'coreFeatures',
    name: 'Core features',
    description: 'The intended capabilities of the project are implemented.',
    metric: 'PRODUCT',
    weight: 30,
  }),
  dimension({
    key: 'uiux',
    name: 'User-facing experience',
    description: 'User interfaces, output quality and interaction feedback.',
    metric: 'PRODUCT',
    weight: 15,
  }),
  dimension({
    key: 'content',
    name: 'Content & assets',
    description: 'Required content, data and assets are present.',
    metric: 'PRODUCT',
    weight: 10,
  }),
  dimension({
    key: 'codeQuality',
    name: 'Code quality & architecture',
    description: 'Structure, typing, module boundaries and maintainability.',
    metric: 'TECHNICAL',
    weight: 20,
  }),
  dimension({
    key: 'testing',
    name: 'Testing & reliability',
    description: 'Automated tests and failure handling.',
    metric: 'READINESS',
    weight: 15,
  }),
  dimension({
    key: 'deployment',
    name: 'Build & deployment',
    description: 'Build configuration and deliverable packaging.',
    metric: 'READINESS',
    weight: 10,
  }),
];

export const FRAMEWORKS: Record<ProjectType, DimensionDefinition[]> = {
  BUSINESS_WEBSITE: websiteFramework({
    pages: 18,
    functional: 18,
    uiux: 14,
    responsive: 10,
    content: 12,
    integrations: 6,
    codeQuality: 8,
    testing: 6,
    seo: 8,
  }),
  PORTFOLIO_WEBSITE: websiteFramework({
    pages: 12,
    functional: 12,
    uiux: 18,
    responsive: 10,
    content: 18,
    integrations: 5,
    codeQuality: 8,
    testing: 5,
    seo: 12,
  }),
  LANDING_PAGE: websiteFramework({
    pages: 10,
    functional: 12,
    uiux: 18,
    responsive: 12,
    content: 18,
    integrations: 7,
    codeQuality: 7,
    testing: 4,
    seo: 12,
  }),
  ECOMMERCE_WEBSITE: websiteFramework(
    {
      pages: 10,
      functional: 16,
      uiux: 12,
      responsive: 8,
      content: 8,
      commerce: 14,
      payments: 8,
      integrations: 6,
      codeQuality: 4,
      testing: 4,
      seo: 5,
      security: 5,
    },
    {
      commerce: {
        key: 'commerce',
        name: 'Commerce functionality',
        description: 'Product catalog, product detail, cart, checkout and order state.',
        metric: 'PRODUCT',
        weight: 14,
      },
      payments: {
        key: 'payments',
        name: 'Payments',
        description: 'Payment provider integration, payment state and failure handling.',
        metric: 'TECHNICAL',
        weight: 8,
      },
      security: {
        key: 'security',
        name: 'Security',
        description: 'Checkout protection, input validation, secret handling and authorization.',
        metric: 'READINESS',
        weight: 5,
      },
    }
  ),
  SAAS_APPLICATION: SAAS_FRAMEWORK,
  FULLSTACK_WEB_APP: FULLSTACK_FRAMEWORK,
  AI_APPLICATION: AI_FRAMEWORK,
  DESKTOP_APPLICATION: DESKTOP_DIMENSIONS,
  MOBILE_APPLICATION: MOBILE_DIMENSIONS,
  GAME_3D: GAME_DIMENSIONS,
  DEVELOPER_TOOL: DEVTOOL_DIMENSIONS,
  OTHER: OTHER_DIMENSIONS,
};

export function getFramework(projectType: ProjectType): DimensionDefinition[] {
  return FRAMEWORKS[projectType] || FRAMEWORKS.OTHER;
}

export function frameworkLabel(projectType: ProjectType): string {
  return PROJECT_TYPE_LABELS[projectType];
}

export function isWebProject(projectType: ProjectType): boolean {
  return [
    'BUSINESS_WEBSITE',
    'PORTFOLIO_WEBSITE',
    'ECOMMERCE_WEBSITE',
    'LANDING_PAGE',
    'SAAS_APPLICATION',
    'FULLSTACK_WEB_APP',
    'AI_APPLICATION',
  ].includes(projectType);
}

export function resolveRequirementDimension(
  framework: DimensionDefinition[],
  requested: string
): string {
  if (framework.some((d) => d.key === requested)) return requested;

  const fallbackByMetric: Record<MetricGroup, string | undefined> = {
    PRODUCT: framework.find((d) => d.metric === 'PRODUCT')?.key,
    TECHNICAL: framework.find((d) => d.metric === 'TECHNICAL')?.key,
    READINESS: framework.find((d) => d.metric === 'READINESS')?.key,
  };

  if (requested === 'pages' || requested === 'screens') {
    return fallbackByMetric.PRODUCT || framework[0].key;
  }
  if (requested === 'security' && fallbackByMetric.READINESS) return fallbackByMetric.READINESS;
  if (requested === 'deployment' && fallbackByMetric.READINESS) return fallbackByMetric.READINESS;
  if (requested === 'testing' && framework.some((d) => d.key === 'testing')) return 'testing';
  return framework.find((d) => d.metric === 'PRODUCT')?.key || framework[0].key;
}
