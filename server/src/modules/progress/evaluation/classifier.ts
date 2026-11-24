import {
  ClassificationResult,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPES,
  ProjectSignals,
  ProjectType,
} from './types.js';

interface SignalRule {
  weight: number;
  label: string;
  test: (signals: ProjectSignals) => boolean;
  evidence?: (signals: ProjectSignals) => string;
}

const text = (signals: ProjectSignals) => signals.allText.toLowerCase();
const pathText = (signals: ProjectSignals) =>
  signals.files.map((f) => f.relativePath.toLowerCase()).join('\n');
const symbolText = (signals: ProjectSignals) =>
  signals.files.map((f) => f.exportedSymbols.join(' ')).join('\n').toLowerCase();
const depsText = (signals: ProjectSignals) =>
  [...signals.dependencies, ...signals.devDependencies].join(' ').toLowerCase();

const keyword = (pattern: RegExp, weight: number, label: string): SignalRule => ({
  weight,
  label,
  test: (s) => pattern.test(text(s)),
});
const dependency = (pattern: RegExp, weight: number, label: string): SignalRule => ({
  weight,
  label,
  test: (s) => pattern.test(depsText(s)),
});
const pathRule = (pattern: RegExp, weight: number, label: string): SignalRule => ({
  weight,
  label,
  test: (s) => pattern.test(pathText(s)),
});
const extensionRule = (ext: string, weight: number, label: string): SignalRule => ({
  weight,
  label,
  test: (s) => (s.fileExtensions[ext] || 0) > 0,
});
const symbolRule = (pattern: RegExp, weight: number, label: string): SignalRule => ({
  weight,
  label,
  test: (s) => pattern.test(symbolText(s)),
});

const RULES: Record<ProjectType, SignalRule[]> = {
  BUSINESS_WEBSITE: [
    keyword(/\b(company|business|corporate|agency|consulting|professional services|clinic|restaurant|hotel|real estate|law firm|accounting|studio|brand)\b/, 18, 'Business/company language in description, README or source paths'),
    {
      weight: 16,
      label: 'Multiple static HTML pages without a single-page app router',
      test: (s) =>
        s.htmlFiles.length >= 2 &&
        !/(^|\/)(pages|app)\//i.test(s.sourceFiles.join(' ')) &&
        !/(next|nuxt|remix|@angular\/core|vue-router|react-router)/i.test(depsText(s)),
    },
    dependency(/astro|@11ty|eleventy|hugo|jekyll|gatsby|@docusaurus/, 20, 'Static site generator dependency'),
    pathRule(/(^|\/)(about|services?|contact|team|solutions|pricing)\.(html|tsx|jsx|vue|svelte)$/, 12, 'Business page structure (about/services/contact/team)'),
    keyword(/\b(seo|marketing site|brochure site|company website|business website)\b/, 10, 'Website/business intent keywords'),
  ],
  PORTFOLIO_WEBSITE: [
    keyword(/\b(portfolio|personal website|resume|cv|designer|photographer|illustrator|freelance|showcase|creative)\b/, 34, 'Portfolio/resume language in description or README'),
    pathRule(/(^|\/)(portfolio|work|projects|case-studies|about-me)\b/, 14, 'Portfolio project/work pages'),
    keyword(/\b(projects?|gallery|client work|selected work)\b/, 8, 'Project gallery language'),
  ],
  ECOMMERCE_WEBSITE: [
    dependency(/stripe|paypal|@shopify|shopify|@medusajs|snipcart|woocommerce|braintree|paddle|lemonsqueezy|bigcommerce|commercetools/, 45, 'Commerce/payment provider dependency'),
    keyword(/\b(checkout|shopping cart|product catalog|storefront|e-?commerce|add to cart|order management)\b/, 24, 'Commerce language in description, README or source'),
    pathRule(/(^|\/)(cart|checkout|products?|shop|catalog|orders?)\b/, 16, 'Cart/checkout/product paths'),
    symbolRule(/\b(cart|checkout|product|order|basket)\b/, 10, 'Commerce symbols in exported code'),
    keyword(/\b(variant|inventory|shipping|sku|discount code)\b/, 8, 'Store operations language'),
  ],
  LANDING_PAGE: [
    keyword(/\b(landing page|waitlist|coming soon|launch page|single page|one-page|conversion|lead capture|early access)\b/, 36, 'Landing/waitlist/conversion language'),
    {
      weight: 14,
      label: 'Single-page frontend with a hero-oriented structure',
      test: (s) => {
        const pageCount = s.htmlFiles.length + s.pageFiles.length;
        return pageCount <= 2 && /\b(hero|cta|call to action|newsletter|waitlist|signup form)\b/i.test(text(s));
      },
    },
    {
      weight: 10,
      label: 'Email capture or newsletter integration',
      test: (s) => /mailchimp|convertkit|newsletter|waitlist|sendgrid|resend/i.test(text(s)),
    },
  ],
  SAAS_APPLICATION: [
    keyword(/\b(saas|software as a service|subscription|billing|pricing plan|multi-tenant|workspace|organization|team plan|usage-based|free trial)\b/, 30, 'SaaS/subscription/workspace language'),
    {
      weight: 18,
      label: 'Subscription billing plus authenticated workspace dependencies',
      test: (s) =>
        /stripe|paddle|lemonsqueezy|chargebee/i.test(depsText(s)) &&
        /auth|clerk|supabase|firebase|next-auth|passport|better-auth/i.test(depsText(s)),
    },
    pathRule(/(^|\/)(dashboard|workspace|billing|organization|team|settings)\b/, 12, 'SaaS workspace/dashboard/billing paths'),
    symbolRule(/\b(subscription|workspace|organization|billing|plan|tenant)\b/, 10, 'SaaS domain symbols'),
  ],
  FULLSTACK_WEB_APP: [
    {
      weight: 26,
      label: 'Server framework plus an ORM/database layer',
      test: (s) =>
        /express|koa|fastify|@nestjs|hono|next|nuxt|remix|sveltekit/i.test(depsText(s)) &&
        /prisma|drizzle|sequelize|typeorm|mongoose|knex|@supabase|postgres|mysql|sqlite/i.test(depsText(s)),
    },
    pathRule(/(^|\/)(api|server|backend|controllers|services|routes|prisma|models|migrations)\//, 16, 'Backend/API/database directory structure'),
    keyword(/\b(full[- ]stack|backend|database|admin dashboard|web application|crud|rest api|graphql)\b/, 14, 'Full-stack application language'),
    dependency(/prisma|drizzle-orm|sequelize|typeorm|mongoose/, 10, 'Database ORM dependency'),
    dependency(/react|vue|svelte|@angular\/core/, 8, 'Frontend framework dependency'),
  ],
  AI_APPLICATION: [
    dependency(/openai|anthropic|@langchain|langchain|ollama|cohere|groq|@google\/generative-ai|@huggingface|transformers|ai@|@ai-sdk|replicate/, 48, 'LLM/AI provider dependency'),
    keyword(/\b(ai|llm|prompt|agent|chatbot|embedding|rag|machine learning|inference|fine-tun|retrieval augmented)\b/, 20, 'AI/LLM language in description, README or source'),
    pathRule(/(^|\/)(ai|llm|prompt|prompts|agents?|rag|embeddings|inference|models)\//, 14, 'AI/prompt/model source paths'),
    keyword(/\b(system prompt|vector database|semantic search|completion|token|guardrail)\b/, 10, 'Prompting/retrieval implementation language'),
  ],
  DESKTOP_APPLICATION: [
    dependency(/electron|@tauri-apps|tauri|wails|neutralino/, 50, 'Desktop shell dependency (Electron/Tauri/Wails)'),
    pathRule(/(^|\/)(electron|src-tauri|main-process|preload)\//, 18, 'Desktop main/preload process paths'),
    keyword(/\b(desktop app|installer|system tray|native window|offline app|auto[- ]?updater)\b/, 16, 'Desktop application language'),
    extensionRule('.csproj', 30, 'C# desktop project file'),
    extensionRule('.xaml', 18, 'WPF/XAML UI file'),
    keyword(/\b(wpf|winforms|javafx|pyqt|tkinter|qt application)\b/, 25, 'Native desktop UI framework language'),
  ],
  MOBILE_APPLICATION: [
    dependency(/react-native|expo|@capacitor|@ionic|flutter|native-script/, 50, 'Mobile framework dependency'),
    extensionRule('.dart', 32, 'Flutter/Dart source file'),
    extensionRule('.swift', 20, 'Swift source file'),
    extensionRule('.kt', 14, 'Kotlin source file'),
    pathRule(/(^|\/)(android|ios)\//, 16, 'Android/iOS platform directories'),
    keyword(/\b(mobile app|ios app|android app|app store|play store|push notification)\b/, 18, 'Mobile application language'),
  ],
  GAME_3D: [
    dependency(/three|@react-three|babylonjs|@babylonjs|cannon-es|@dimforge\/rapier|phaser|pixi|playcanvas|ammo/, 46, '3D/game engine dependency'),
    keyword(/\b(3d|game|gameplay|player movement|physics|cannon|raycast|mission|world|level|fps|renderer|scene|open[- ]world)\b/, 18, 'Game/3D language in description, README or source'),
    pathRule(/(^|\/)(game|world|player|physics|scenes|levels|engine|gameplay)\//, 14, 'Gameplay/world/physics source paths'),
    extensionRule('.unity', 35, 'Unity scene/asset file'),
    extensionRule('.uproject', 35, 'Unreal project file'),
    extensionRule('.gd', 30, 'Godot script file'),
    extensionRule('.tscn', 30, 'Godot scene file'),
  ],
  DEVELOPER_TOOL: [
    keyword(/\b(cli|command[- ]line|sdk|library|npm package|plugin|compiler|linter|formatter|parser|codegen|developer tool|devtool)\b/, 28, 'Developer-tool language'),
    pathRule(/(^|\/)(bin|cli|commands|packages|src\/commands)\//, 16, 'CLI/package source layout'),
    {
      weight: 14,
      label: 'Packaged codebase without a user-facing web UI',
      test: (s) =>
        s.sourceFiles.length >= 3 &&
        !/\b(react|vue|svelte|next|nuxt)\b/i.test(depsText(s)) &&
        !s.htmlFiles.length,
    },
    keyword(/\b(usage|install|api reference|flags|arguments|stdout|stderr)\b/, 8, 'Usage/CLI documentation language'),
  ],
  OTHER: [],
};

const CATEGORY_HINTS: Array<{ pattern: RegExp; type: ProjectType; weight: number }> = [
  { pattern: /portfolio/i, type: 'PORTFOLIO_WEBSITE', weight: 35 },
  { pattern: /e-?commerce|shop|store/i, type: 'ECOMMERCE_WEBSITE', weight: 35 },
  { pattern: /landing/i, type: 'LANDING_PAGE', weight: 35 },
  { pattern: /saas/i, type: 'SAAS_APPLICATION', weight: 35 },
  { pattern: /game/i, type: 'GAME_3D', weight: 35 },
  { pattern: /mobile|android|ios/i, type: 'MOBILE_APPLICATION', weight: 35 },
  { pattern: /desktop/i, type: 'DESKTOP_APPLICATION', weight: 35 },
  { pattern: /ai|machine learning|llm/i, type: 'AI_APPLICATION', weight: 30 },
  { pattern: /dev(eloper)? tool|cli/i, type: 'DEVELOPER_TOOL', weight: 30 },
  { pattern: /web|website/i, type: 'BUSINESS_WEBSITE', weight: 10 },
  { pattern: /full[- ]?stack|web app/i, type: 'FULLSTACK_WEB_APP', weight: 16 },
];

function scoreCategory(type: ProjectType, signals: ProjectSignals, matched: string[]): number {
  const rules = RULES[type] || [];
  let score = 0;
  for (const rule of rules) {
    try {
      if (rule.test(signals)) {
        score += rule.weight;
        matched.push(`${type}: ${rule.label}`);
      }
    } catch {
      // A malformed rule must never break classification.
    }
  }

  if (type === 'OTHER' && score === 0 && signals.files.length > 0) {
    score += 6;
  }

  return Math.min(100, score);
}

export function classifyProject(
  signals: ProjectSignals,
  userOverride?: ProjectType | null
): ClassificationResult {
  const scored: Array<{ type: ProjectType; score: number }> = [];
  const matchesByType = new Map<ProjectType, string[]>();

  for (const type of PROJECT_TYPES) {
    if (type === 'OTHER') continue;
    const matched: string[] = [];
    let score = scoreCategory(type, signals, matched);
    const categoryHint = CATEGORY_HINTS.find(
      (hint) => hint.type === type && hint.pattern.test(signals.meta.category || '')
    );
    if (categoryHint) {
      score = Math.min(100, score + categoryHint.weight);
      matched.push(`${type}: project category field indicates this type`);
    }
    matchesByType.set(type, matched);
    scored.push({ type, score });
  }

  scored.push({ type: 'OTHER', score: 6 });
  scored.sort((a, b) => b.score - a.score || PROJECT_TYPES.indexOf(a.type) - PROJECT_TYPES.indexOf(b.type));

  const top = scored[0];
  const runnerUp = scored[1];
  const margin = top.score - runnerUp.score;
  const evidence = (matchesByType.get(top.type) || []).map((e) => e.replace(`${top.type}: `, ''));

  const alternatives = scored
    .filter((s) => s.score > 0)
    .slice(0, 4)
    .map((s) => ({
      projectType: s.type,
      label: PROJECT_TYPE_LABELS[s.type],
      score: s.score,
    }));

  if (userOverride && PROJECT_TYPES.includes(userOverride)) {
    const autoEvidence = evidence.length
      ? evidence
      : [`Automatic detection also suggested ${PROJECT_TYPE_LABELS[top.type]}.`];
    return {
      projectType: userOverride,
      projectTypeLabel: PROJECT_TYPE_LABELS[userOverride],
      confidence: 100,
      source: 'USER',
      rationale: `Project type was set manually by the user. The automatic classifier suggested ${PROJECT_TYPE_LABELS[top.type]}.`,
      evidence: ['Manual user override takes precedence over automatic classification.', ...autoEvidence],
      alternatives,
    };
  }

  let confidence: number;
  if (top.score <= 6) {
    confidence = 35;
  } else {
    confidence = Math.round(
      Math.min(97, 48 + Math.min(38, top.score * 0.45) + Math.min(12, Math.max(0, margin) * 0.6))
    );
  }

  let rationale: string;
  if (top.score <= 6) {
    rationale =
      'Not enough distinctive signals were found to classify this project confidently. It is treated as "Other" with a generic evaluation framework. You can correct the type manually.';
  } else {
    rationale = `Classified as ${PROJECT_TYPE_LABELS[top.type]} from ${evidence.length} independent signal(s).`;
    if (runnerUp.score > 0 && margin < 15) {
      rationale += ` ${PROJECT_TYPE_LABELS[runnerUp.type]} was a close alternative (${runnerUp.score} vs ${top.score}); review the classification if it looks wrong.`;
    }
  }

  return {
    projectType: top.type,
    projectTypeLabel: PROJECT_TYPE_LABELS[top.type],
    confidence,
    source: 'AUTO',
    rationale,
    evidence,
    alternatives,
  };
}
