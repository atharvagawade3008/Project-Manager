import {
  anyContentMatching,
  check,
  countContentOccurrences,
  filesMatching,
  placeholderMarkers,
  ratio,
  scoreChecks,
  substantiveSourceFiles,
  totalSourceLines,
} from './evidence-utils.js';
import { DimensionContext, DimensionPartial } from './types.js';

function hasDep(ctx: DimensionContext, pattern: RegExp): boolean {
  return pattern.test([...ctx.signals.dependencies, ...ctx.signals.devDependencies].join(' '));
}

function hasContent(ctx: DimensionContext, pattern: RegExp): boolean {
  return anyContentMatching(ctx.corpus, pattern) !== null;
}

function countFiles(ctx: DimensionContext, pattern: RegExp): number {
  return filesMatching(ctx.signals, pattern).length;
}

function hasReadme(ctx: DimensionContext): boolean {
  return ctx.signals.readme.trim().length > 150;
}

function hasBuildScript(ctx: DimensionContext): boolean {
  return Boolean(ctx.signals.scripts.build);
}

function errorSignalCount(ctx: DimensionContext): number {
  return countContentOccurrences(ctx.corpus, /\btry\s*\{|\bcatch\s*[({]|ErrorBoundary|error\.tsx/gi);
}

function testSignalCount(ctx: DimensionContext): number {
  return ctx.signals.testFiles.length;
}

export function evaluateCodeQuality(ctx: DimensionContext): DimensionPartial {
  const signals = ctx.signals;
  const sourceFiles = signals.files.filter((f) => f.fileCategory === 'SOURCE');
  const oversized = sourceFiles.filter((f) => f.linesOfCode > 500).length;
  const typedFiles = sourceFiles.filter((f) => ['.ts', '.tsx'].includes(f.extension)).length;
  const typedRatio = sourceFiles.length === 0 ? 0 : typedFiles / sourceFiles.length;
  const componentFiles = countFiles(ctx, /(^|\/)(components|ui|widgets|modules)\//i);
  const moduleDirs = new Set(
    sourceFiles
      .map((f) => f.relativePath.split('/').slice(0, -1).join('/'))
      .filter(Boolean)
  );
  const separation = ['components', 'pages', 'app', 'services', 'utils', 'hooks', 'lib', 'styles', 'api', 'models'].filter(
    (dir) => sourceFiles.some((f) => new RegExp(`(^|/)${dir}/`, 'i').test(f.relativePath))
  ).length;
  const consoleNoise = countContentOccurrences(ctx.corpus, /\bconsole\.(log|debug)\b/gi);
  const todos = placeholderMarkers(ctx.corpus);
  const avgLines = sourceFiles.length > 0 ? totalSourceLines(signals) / sourceFiles.length : 0;

  const checks = [
    check('Modular project structure', `${sourceFiles.length} source file(s) across ${moduleDirs.size} directories.`, ratio(sourceFiles.length, 6) * 0.5 + ratio(moduleDirs.size, 3) * 0.5, 15),
    check('Typed implementation', `${typedFiles}/${sourceFiles.length} source files use TypeScript.`, typedRatio, 12),
    check('Component/service decomposition', `${componentFiles} component module(s) and ${separation} recognised layer(s).`, Math.max(ratio(componentFiles, 3), ratio(separation, 4)), 12),
    check('No oversized modules', `${oversized} file(s) exceed 500 code lines.`, oversized === 0 ? 1 : ratio(sourceFiles.length - oversized, sourceFiles.length), 12),
    check('Layer separation', `Layers detected: ${separation || 'none'}.`, ratio(separation, 3), 10),
    check('Low placeholder/debt density', `${todos} TODO/FIXME/placeholder marker(s) across the codebase.`, ratio(Math.max(0, sourceFiles.length * 2 - todos), Math.max(1, sourceFiles.length * 2)), 10),
    check('Module size is reasonable', `${Math.round(avgLines)} average lines per source file.`, avgLines > 0 && avgLines <= 300 ? 1 : avgLines > 300 ? 0.5 : 0, 8),
    check('Build/tooling scripts', Object.keys(signals.scripts).length > 0 ? `Scripts: ${Object.keys(signals.scripts).join(', ')}.` : 'No package scripts configured.', ratio(Object.keys(signals.scripts).length, 3), 8),
    check('Low console noise', `${consoleNoise} console.log/debug call(s).`, ratio(Math.max(0, 10 - consoleNoise), 10), 5),
    check('Project documentation', hasReadme(ctx) ? 'README documents the project.' : 'README is missing or very short.', hasReadme(ctx) ? 1 : 0, 8),
  ];

  return scoreChecks(checks, {
    summary: `${sourceFiles.length} source file(s), ${typedFiles} typed, ${oversized} oversized; ${moduleDirs.size} module directories.`,
    confidenceBase: 80,
  });
}

export function evaluateTesting(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;
  const tests = testSignalCount(ctx);
  const testFramework = /(jest|vitest|mocha|playwright|cypress|pytest|phpunit|junit)/i.test(
    [...ctx.signals.dependencies, ...ctx.signals.devDependencies, Object.keys(ctx.signals.scripts).join(' ')].join(' ')
  );
  const errorHandling = errorSignalCount(ctx);
  const hasErrorBoundary = hasContent(ctx, /ErrorBoundary|componentDidCatch|error\.tsx|errorElement/);
  const loading = site?.errorHandling.loadingStates ?? countContentOccurrences(ctx.corpus, /\bisLoading|loading|Skeleton|Spinner/gi);
  const empty = site?.errorHandling.emptyStates ?? countContentOccurrences(ctx.corpus, /no results|empty state|EmptyState|nothing here/gi);
  const validation =
    site?.validationSignals ?? countContentOccurrences(ctx.corpus, /\b(validate|validation|zod|yup|required)\b/gi);
  const notFound = site ? site.errorHandling.has404Page : ctx.signals.files.some((f) => /not[-_]?found|404/i.test(f.relativePath));

  const checks = [
    check('Automated tests exist', tests > 0 ? `${tests} test/spec file(s) detected.` : 'No automated test files were detected.', ratio(tests, 3), 22),
    check('Test runner is configured', testFramework ? 'A test framework/script is configured.' : 'No test runner configuration found.', testFramework ? 1 : 0, 10),
    check('Error boundaries / recovery', hasErrorBoundary ? 'Error boundary or error route detected.' : `${errorHandling} try/catch or error handler signal(s).`, hasErrorBoundary ? 1 : ratio(errorHandling, 4), 18),
    check('Failure handling', `${errorHandling} try/catch/error-handler signal(s).`, ratio(errorHandling, 3), 15),
    check('Loading states', `${loading} loading-state signal(s).`, ratio(loading, 2), 10),
    check('Empty states', `${empty} empty-state signal(s).`, ratio(empty, 2), 8),
    check('Input validation', `${validation} validation signal(s).`, ratio(validation, 2), 10),
    check('Not-found handling', notFound ? '404/not-found handling detected.' : 'No dedicated 404/not-found handling detected.', notFound ? 1 : 0, 7),
  ];

  return scoreChecks(checks, {
    summary: `${tests} test file(s); reliability evidence: ${errorHandling} error-handling signal(s), ${loading} loading state(s). Missing automated tests are reported as a readiness gap, not as missing functionality.`,
    confidenceBase: 82,
  });
}

export function evaluateCoreFeatures(ctx: DimensionContext): DimensionPartial {
  const lines = totalSourceLines(ctx.signals);
  const substantive = substantiveSourceFiles(ctx.signals);
  const exportsCount = ctx.signals.files.reduce((sum, f) => sum + f.exportedSymbols.length, 0);
  const routes = ctx.signals.routeDefinitions.length;
  const placeholders = placeholderMarkers(ctx.corpus);
  const serverRoutes = countContentOccurrences(ctx.corpus, /\b(?:router|app)\.(?:get|post|put|patch|delete)\s*\(/gi);

  const checks = [
    check('Substantive implementation exists', `${lines} code lines across ${ctx.signals.sourceFiles.length} source file(s).`, ratio(lines, 400), 25),
    check('Multiple implemented modules', `${substantive.length} source file(s) contain at least 30 code lines.`, ratio(substantive.length, 4), 20),
    check('Public capabilities are exposed', `${exportsCount} exported symbol(s), ${routes} frontend route(s).`, ratio(exportsCount + routes, 10), 15),
    check('Server or workflow entrypoints', `${serverRoutes} server route(s) and ${ctx.signals.scripts.start ? 'a start script' : 'no start script'}.`, serverRoutes > 0 || Boolean(ctx.signals.scripts.start) || Boolean(ctx.signals.scripts.dev) ? 1 : 0, 15),
    check('Low placeholder density', `${placeholders} placeholder/TODO marker(s).`, ratio(Math.max(0, ctx.signals.sourceFiles.length * 2 - placeholders), Math.max(1, ctx.signals.sourceFiles.length * 2)), 15),
    check('Feature documentation', hasReadme(ctx) ? 'README describes the project and features.' : 'No substantial README found.', hasReadme(ctx) ? 1 : 0, 10),
  ];

  return scoreChecks(checks, {
    summary: `${lines} source lines, ${substantive.length} substantive module(s), ${exportsCount} exported symbol(s).`,
    confidenceBase: 74,
  });
}

export function evaluateDataLayer(ctx: DimensionContext): DimensionPartial {
  const schemaFiles = countFiles(ctx, /(schema\.prisma|\.sql$|migrations?\/|models?\/|entities?\/|schema\.(ts|js)$)/i);
  const orm = hasDep(ctx, /prisma|drizzle|sequelize|typeorm|mongoose|knex|@supabase|postgres|mysql|sqlite/i);
  const modelSymbols = ctx.signals.files.filter((f) => /model|schema|entity/i.test(f.relativePath)).flatMap((f) => f.exportedSymbols).length;
  const queries = countContentOccurrences(ctx.corpus, /\b(prisma|db|knex|sequelize|model)\.(find|create|update|delete|query|aggregate)/gi);
  const migrations = countFiles(ctx, /migrations?\//i);
  const seed = countFiles(ctx, /seed/i);
  const envDb = countContentOccurrences(ctx.corpus, /DATABASE_URL|DB_HOST|MONGO_URI|SUPABASE_URL/gi);
  const transaction = countContentOccurrences(ctx.corpus, /\$transaction|transaction\(|BEGIN TRANSACTION/gi);

  const checks = [
    check('Schema or models defined', `${schemaFiles} schema/model/migration file(s) detected.`, schemaFiles > 0, 22),
    check('ORM or database driver configured', orm ? 'ORM/database dependency detected.' : 'No ORM/database driver detected.', orm, 18),
    check('Model definitions', `${modelSymbols} exported model/entity symbol(s).`, ratio(modelSymbols, 3), 15),
    check('Queries implemented', `${queries} database operation(s) detected.`, ratio(queries, 4), 18),
    check('Migrations present', `${migrations} migration directory/file(s).`, migrations > 0, 10),
    check('Seed or fixtures', `${seed} seed/fixture file(s).`, seed > 0, 5),
    check('Database configuration externalised', `${envDb} database environment reference(s).`, envDb > 0 ? 1 : 0, 7),
    check('Transactional writes', `${transaction} transaction call(s).`, transaction > 0 ? 1 : 0.4, 5),
  ];

  return scoreChecks(checks, {
    summary: `${schemaFiles} schema/model file(s), ${queries} query operation(s), ${migrations} migration file(s).`,
    confidenceBase: 78,
  });
}

export function evaluateApiDesign(ctx: DimensionContext): DimensionPartial {
  const routeFiles = countFiles(ctx, /(^|\/)(routes?|controllers?|api|handlers?|endpoints?)\//i);
  const routes = countContentOccurrences(ctx.corpus, /\b(?:router|app)\.(?:get|post|put|patch|delete)\s*\(/gi);
  const services = countFiles(ctx, /(^|\/)(services?|usecases?|domain)\//i);
  const validation = countContentOccurrences(ctx.corpus, /\b(zod|joi|yup|celebrate|express-validator|validate\()/gi);
  const errorMiddleware = hasContent(ctx, /errorHandler|error handler|next\(error\)|app\.use\(\(err/);
  const authChecks = countContentOccurrences(ctx.corpus, /\b(requireAuth|isAuthenticated|authorize|checkPermission|getUser)\b/gi);
  const statusCodes = countContentOccurrences(ctx.corpus, /\.status\(\s*(200|201|204|400|401|403|404|409|422|500)\s*\)/gi);
  const apiTypes = countFiles(ctx, /(openapi|swagger|api\.md|routes\.md)/i);

  const checks = [
    check('API routes/handlers exist', `${routes} route handler(s) across ${routeFiles} route module(s).`, routes > 0, 25),
    check('Service/domain separation', `${services} service-layer file(s).`, ratio(services, 2), 15),
    check('Request validation', `${validation} validation signal(s).`, ratio(validation, 2), 18),
    check('Error middleware/contract', errorMiddleware ? 'Central error handling detected.' : 'No central error handling detected.', errorMiddleware ? 1 : 0, 15),
    check('Authorization checks', `${authChecks} authorization check(s).`, ratio(authChecks, 1), 12),
    check('Correct status codes', `${statusCodes} explicit HTTP status usage(s).`, ratio(statusCodes, 3), 8),
    check('API documentation/types', `${apiTypes} API documentation file(s).`, apiTypes > 0, 7),
  ];

  return scoreChecks(checks, {
    summary: `${routes} route handler(s), ${services} service file(s), ${validation} validation signal(s).`,
    confidenceBase: 78,
  });
}

export function evaluateAuth(ctx: DimensionContext): DimensionPartial {
  const authDep = hasDep(ctx, /next-auth|@auth|passport|clerk|auth0|better-auth|supabase\/auth|firebase\/auth|jsonwebtoken|bcrypt|argon2/i);
  const loginUi = hasContent(ctx, /sign[ -]?in|log[ -]?in|LoginForm|SignInForm|auth\/login/i);
  const session = countContentOccurrences(ctx.corpus, /\bsession\b|\bjwt\b|getServerSession|useSession|req\.user/gi);
  const hashing = countContentOccurrences(ctx.corpus, /\bbcrypt|argon2|scrypt|password.*hash/gi);
  const protectedRoute = countContentOccurrences(ctx.corpus, /\b(requireAuth|isAuthenticated|middleware.*auth|protectedRoute|PrivateRoute)\b/gi);
  const roles = countContentOccurrences(ctx.corpus, /\b(role|permission|admin|authorize)\b/gi);
  const logout = countContentOccurrences(ctx.corpus, /\b(signOut|logout|logOut|destroySession)\b/gi);
  const oauth = countContentOccurrences(ctx.corpus, /\b(oauth|google|github|apple|microsoft|provider)\b/gi);

  const checks = [
    check('Authentication library/provider', authDep ? 'Authentication dependency detected.' : 'No authentication dependency detected.', authDep, 22),
    check('Sign-in UI', loginUi ? 'Login/sign-in interface detected.' : 'No sign-in interface detected.', loginUi, 15),
    check('Session handling', `${session} session/JWT signal(s).`, ratio(session, 2), 18),
    check('Password hashing', `${hashing} password-hashing signal(s).`, hashing > 0, 12),
    check('Protected routes', `${protectedRoute} route-protection signal(s).`, protectedRoute > 0, 15),
    check('Role/permission checks', `${roles} role/permission signal(s).`, ratio(roles, 2), 8),
    check('Sign-out', `${logout} sign-out signal(s).`, logout > 0, 5),
    check('OAuth providers', `${oauth} OAuth/provider signal(s).`, oauth > 0 ? 1 : 0.3, 5),
  ];

  return scoreChecks(checks, {
    summary: `Auth evidence: provider=${authDep}, UI=${loginUi}, sessions=${session}, hashing=${hashing}, protection=${protectedRoute}.`,
    confidenceBase: 76,
  });
}

export function evaluateSecurity(ctx: DimensionContext): DimensionPartial {
  const validation = countContentOccurrences(ctx.corpus, /\b(zod|joi|yup|validate\(|sanitize|escape)\b/gi);
  const envUsage = countContentOccurrences(ctx.corpus, /\bprocess\.env\.|import\.meta\.env\./g);
  const authMiddleware = countContentOccurrences(ctx.corpus, /\b(requireAuth|isAuthenticated|authorize|csrf|rateLimit)\b/gi);
  const headers = hasContent(ctx, /helmet|content-security-policy|X-Frame-Options|Strict-Transport-Security/);
  const cors = countContentOccurrences(ctx.corpus, /\bcors\s*\(|Access-Control-Allow-Origin/gi);
  const secretsInCode = countContentOccurrences(ctx.corpus, /\b(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|api[_-]?key\s*[:=]\s*["'][A-Za-z0-9]{16,}["'])/g);
  const audit = Object.keys(ctx.signals.scripts).some((s) => /audit|security/i.test(s));
  const hasEnvExample = ctx.signals.files.some((f) => /\.env\.(example|sample|template)$/i.test(f.relativePath));

  const checks = [
    check('Input validation', `${validation} validation/sanitisation signal(s).`, ratio(validation, 2), 20),
    check('Secrets via environment', `${envUsage} environment reference(s).`, envUsage > 0 ? 1 : 0, 18),
    check('No hard-coded credentials', secretsInCode === 0 ? 'No obvious hard-coded secret literal detected.' : `${secretsInCode} potential hard-coded secret(s) detected.`, secretsInCode === 0 ? 1 : 0, 15),
    check('Auth/CSRF/rate-limit protection', `${authMiddleware} protection signal(s).`, ratio(authMiddleware, 2), 15),
    check('Security headers', headers ? 'Security headers/middleware detected.' : 'No security header configuration detected.', headers ? 1 : 0, 12),
    check('CORS configured', `${cors} CORS signal(s).`, cors > 0 ? 1 : 0.5, 8),
    check('Dependency audit script', audit ? 'Audit script configured.' : 'No audit script configured.', audit ? 1 : 0, 6),
    check('Environment template', hasEnvExample ? '.env example present.' : 'No .env example present.', hasEnvExample ? 1 : 0, 6),
  ];

  return scoreChecks(checks, {
    summary: `${validation} validation signal(s), ${envUsage} env reference(s), ${secretsInCode} potential hard-coded secret(s).`,
    confidenceBase: 72,
  });
}

export function evaluateDeployment(ctx: DimensionContext): DimensionPartial {
  const configs = filesMatching(
    ctx.signals,
    /(vercel\.json|netlify\.toml|wrangler\.(toml|jsonc?)|firebase\.json|Dockerfile|docker-compose|\.github\/workflows|Procfile|render\.yaml|fly\.toml|app\.yaml)/i
  );
  const envExample = ctx.signals.files.some((f) => /\.env\.(example|sample|template)$/i.test(f.relativePath));
  const health = countContentOccurrences(ctx.corpus, /\/health|\/healthz|healthcheck/gi);
  const migrationsInBuild = Object.values(ctx.signals.scripts).some((s) => /migrate|prisma db push|deploy/i.test(s));
  const startScript = Boolean(ctx.signals.scripts.start);

  const checks = [
    check('Production build script', hasBuildScript(ctx) ? `Build script: ${ctx.signals.scripts.build}.` : 'No build script configured.', hasBuildScript(ctx) ? 1 : 0, 20),
    check('Hosting/deployment configuration', `${configs.length} deployment config file(s).`, configs.length > 0, 22),
    check('Environment template', envExample ? '.env example present.' : 'No .env example/template.', envExample ? 1 : 0, 15),
    check('CI pipeline', configs.some((f) => /\.github\/workflows/i.test(f.relativePath)) ? 'GitHub Actions workflow detected.' : 'No CI workflow detected.', configs.some((f) => /\.github\/workflows/i.test(f.relativePath)) ? 1 : 0, 15),
    check('Production start command', startScript ? 'Start script configured.' : 'No start script configured.', startScript ? 1 : 0, 10),
    check('Health endpoint', health > 0 ? 'Health endpoint detected.' : 'No health endpoint detected.', health > 0 ? 1 : 0, 8),
    check('Deploy/migration step', migrationsInBuild ? 'Deploy or migration script configured.' : 'No deploy/migration script.', migrationsInBuild ? 1 : 0, 10),
  ];

  return scoreChecks(checks, {
    summary: `${configs.length} deployment config(s); build=${hasBuildScript(ctx)}, env template=${envExample}, CI=${configs.some((f) => /workflows/i.test(f.relativePath))}.`,
    confidenceBase: 82,
  });
}

export function evaluateModelIntegration(ctx: DimensionContext): DimensionPartial {
  const deps = [...ctx.signals.dependencies, ...ctx.signals.devDependencies].join(' ');
  const provider = /openai|anthropic|@langchain|langchain|ollama|cohere|groq|@google\/generative-ai|@ai-sdk|replicate|huggingface/i.test(deps);
  const client = countFiles(ctx, /(^|\/)(ai|llm|openai|anthropic|ollama|providers?|models?|inference)\//i) > 0;
  const apiKey = countContentOccurrences(ctx.corpus, /OPENAI_API_KEY|ANTHROPIC_API_KEY|OLLAMA|API_KEY/gi);
  const streaming = countContentOccurrences(ctx.corpus, /\bstream\s*[:=]|streamText|ReadableStream|onToken/gi);
  const retry = countContentOccurrences(ctx.corpus, /\bretry|backoff|timeout|AbortController\b/gi);
  const fallback = countContentOccurrences(ctx.corpus, /\bfallback|catch\s*[({].*model|offline/gi);
  const usage = countContentOccurrences(ctx.corpus, /\busage|prompt_tokens|completion_tokens|inputTokens|outputTokens\b/gi);
  const modelSelection = countContentOccurrences(ctx.corpus, /\bmodel\s*[:=]\s*["'`]|gpt-|claude-|qwen|llama|deepseek/gi);

  const checks = [
    check('Model provider integrated', provider ? 'AI provider dependency detected.' : 'No AI provider dependency detected.', provider, 24),
    check('Dedicated client module', client ? 'Dedicated AI/model module detected.' : 'No dedicated model client module.', client ? 1 : 0, 16),
    check('Credentials from environment', `${apiKey} model-key/env reference(s).`, apiKey > 0 ? 1 : 0, 15),
    check('Streaming or progressive output', `${streaming} streaming signal(s).`, streaming > 0 ? 1 : 0.3, 10),
    check('Retries/timeouts', `${retry} retry/timeout signal(s).`, ratio(retry, 2), 12),
    check('Offline/error fallback', `${fallback} fallback signal(s).`, fallback > 0 ? 1 : 0, 10),
    check('Usage accounting', `${usage} usage/token signal(s).`, usage > 0 ? 1 : 0, 7),
    check('Model selection configured', `${modelSelection} model selection reference(s).`, modelSelection > 0 ? 1 : 0, 6),
  ];

  return scoreChecks(checks, {
    summary: `Model integration: provider=${provider}, client module=${client}, env credentials=${apiKey > 0}, streaming=${streaming > 0}.`,
    confidenceBase: 78,
  });
}

export function evaluatePrompting(ctx: DimensionContext): DimensionPartial {
  const promptFiles = countFiles(ctx, /(^|\/)(prompts?|templates?)\//i);
  const promptText = countContentOccurrences(ctx.corpus, /\b(system prompt|systemPrompt|You are a|prompt\s*[:=])\b/gi);
  const structured = countContentOccurrences(ctx.corpus, /JSON\.parse|response_format|json_schema|structured output|zod/i);
  const messages = countContentOccurrences(ctx.corpus, /\bmessages\s*[:=]|role\s*:\s*["'](system|user|assistant)["']/gi);
  const validation = countContentOccurrences(ctx.corpus, /\b(validate|guardrail|parse|schema)\b/gi);
  const contextLimit = countContentOccurrences(ctx.corpus, /max_tokens|maxTokens|context|truncate|token limit/gi);

  const checks = [
    check('Prompt templates/modules', `${promptFiles} prompt file(s), ${promptText} prompt signal(s).`, promptFiles > 0 || promptText > 0 ? 1 : 0, 22),
    check('System instructions', promptText > 0 ? 'System prompt/instruction text detected.' : 'No system instruction detected.', promptText > 0 ? 1 : 0, 18),
    check('Structured message construction', `${messages} message/role signal(s).`, ratio(messages, 2), 15),
    check('Structured output parsing', `${structured} structured-output signal(s).`, structured > 0 ? 1 : 0, 18),
    check('Response validation/guardrails', `${validation} validation signal(s).`, ratio(validation, 2), 15),
    check('Context/token limits', `${contextLimit} token/context limit signal(s).`, ratio(contextLimit, 2), 12),
  ];

  return scoreChecks(checks, {
    summary: `${promptFiles} prompt module(s), ${promptText} prompt signal(s), ${structured} structured-output signal(s).`,
    confidenceBase: 76,
  });
}

export function evaluateAiEvaluation(ctx: DimensionContext): DimensionPartial {
  const tests = testSignalCount(ctx);
  const evalFiles = countFiles(ctx, /(eval|evals|benchmark|test.*ai|ai.*test)/i);
  const guardrails = countContentOccurrences(ctx.corpus, /\bguardrail|moderation|safety|sanitize|validate.*output/gi);
  const outputValidation = countContentOccurrences(ctx.corpus, /\b(JSON\.parse|schema|zod|parseResponse|validateResponse)\b/gi);
  const rateLimit = countContentOccurrences(ctx.corpus, /\brate.?limit|throttle|queue\b/gi);
  const fallback = countContentOccurrences(ctx.corpus, /\bfallback|catch\s*[({]|timeout\b/gi);

  const checks = [
    check('AI-specific tests/evals', `${evalFiles} eval file(s), ${tests} test file(s).`, evalFiles > 0 ? 1 : ratio(tests, 3), 24),
    check('Output validation', `${outputValidation} output-validation signal(s).`, ratio(outputValidation, 2), 20),
    check('Guardrails/moderation', `${guardrails} guardrail signal(s).`, guardrails > 0 ? 1 : 0, 18),
    check('Rate limiting/throttling', `${rateLimit} rate-limit signal(s).`, rateLimit > 0 ? 1 : 0, 14),
    check('Failure fallback', `${fallback} fallback/error signal(s).`, ratio(fallback, 3), 14),
    check('Evaluation documentation', hasReadme(ctx) ? 'README documents behaviour.' : 'No substantial README.', hasReadme(ctx) ? 1 : 0, 10),
  ];

  return scoreChecks(checks, {
    summary: `${evalFiles} eval file(s), ${tests} test file(s), ${guardrails} guardrail signal(s).`,
    confidenceBase: 70,
  });
}

export function evaluateCostLatency(ctx: DimensionContext): DimensionPartial {
  const tokenLimits = countContentOccurrences(ctx.corpus, /max_tokens|maxTokens|maxOutputTokens|token limit/gi);
  const caching = countContentOccurrences(ctx.corpus, /\bcache|redis|memoize\b/gi);
  const streaming = countContentOccurrences(ctx.corpus, /\bstream\b|ReadableStream/gi);
  const timeouts = countContentOccurrences(ctx.corpus, /\btimeout|AbortController\b/gi);
  const usage = countContentOccurrences(ctx.corpus, /\busage|tokens\b/gi);
  const modelChoice = countContentOccurrences(ctx.corpus, /\bmodel\s*[:=]|gpt-|claude-|qwen|llama/gi);

  const checks = [
    check('Token/output limits', `${tokenLimits} token-limit signal(s).`, tokenLimits > 0 ? 1 : 0, 24),
    check('Caching', `${caching} caching signal(s).`, caching > 0 ? 1 : 0.2, 20),
    check('Streaming', `${streaming} streaming signal(s).`, streaming > 0 ? 1 : 0.3, 18),
    check('Timeouts', `${timeouts} timeout/abort signal(s).`, timeouts > 0 ? 1 : 0, 18),
    check('Usage/token accounting', `${usage} usage/token signal(s).`, usage > 0 ? 1 : 0, 12),
    check('Model/configuration choice', `${modelChoice} model reference(s).`, modelChoice > 0 ? 1 : 0, 8),
  ];

  return scoreChecks(checks, {
    summary: `Cost/latency controls: token limits=${tokenLimits}, caching=${caching}, streaming=${streaming}, timeouts=${timeouts}.`,
    confidenceBase: 72,
  });
}

export function evaluateScreens(ctx: DimensionContext): DimensionPartial {
  const screenFiles = ctx.signals.files.filter((f) =>
    /(^|\/)(screens?|views?|pages?)\/|Screen\.(tsx|jsx|ts|js|dart|swift|kt)$/i.test(f.relativePath)
  );
  const populated = screenFiles.filter((f) => ctx.corpus.getForFile(f).length > 250);
  const navigation = countFiles(ctx, /(navigator|router|navigation|nav|tabs?)/i);
  const deepLinks = countContentOccurrences(ctx.corpus, /\b(deep.?link|route|navigate|push\(|router)\b/gi);

  const checks = [
    check('Screens exist', `${screenFiles.length} screen/view module(s).`, ratio(screenFiles.length, 3), 30),
    check('Screens are implemented', `${populated.length}/${screenFiles.length} screens contain meaningful content.`, ratio(populated.length, Math.max(1, screenFiles.length)), 35),
    check('Navigation configured', `${navigation} navigation/router file(s).`, navigation > 0, 20),
    check('Navigation paths wired', `${deepLinks} navigation signal(s).`, ratio(deepLinks, 3), 15),
  ];

  return scoreChecks(checks, {
    summary: `${screenFiles.length} screen module(s), ${populated.length} with substantive content.`,
    confidenceBase: 72,
  });
}

export function evaluateAdaptiveLayout(ctx: DimensionContext): DimensionPartial {
  const site = ctx.website;
  const safeArea = countContentOccurrences(ctx.corpus, /SafeAreaView|safe-area|WindowInsets/gi);
  const dimensions = countContentOccurrences(ctx.corpus, /useWindowDimensions|Dimensions\.get|MediaQuery|OrientationBuilder/gi);
  const breakpoints = site ? site.breakpoints.length + site.tailwindBreakpoints.length : 0;
  const flex = countContentOccurrences(ctx.corpus, /flex|Expanded|Flexible|Flexbox/gi);
  const orientation = countContentOccurrences(ctx.corpus, /orientation|landscape|portrait/gi);
  const responsiveImages = countContentOccurrences(ctx.corpus, /resizeMode|aspectRatio|contentFit|BoxFit/gi);

  const checks = [
    check('Adaptive layout primitives', `${flex} flex/adaptive layout signal(s).`, ratio(flex, 3), 25),
    check('Breakpoints/media queries', `${breakpoints} breakpoint value(s).`, ratio(breakpoints, 2), 20),
    check('Window/orientation awareness', `${dimensions + orientation} dimension/orientation signal(s).`, ratio(dimensions + orientation, 2), 20),
    check('Safe-area handling', `${safeArea} safe-area signal(s).`, safeArea > 0 ? 1 : 0, 15),
    check('Responsive media', `${responsiveImages} responsive image signal(s).`, ratio(responsiveImages, 2), 10),
    check('Rendered layout verification', 'Rendered device sizes were not visually verified.', 0, 10),
  ];

  return scoreChecks(checks, {
    summary: `Adaptive layout evidence: ${breakpoints} breakpoint(s), ${dimensions} dimension API use(s), ${safeArea} safe-area signal(s). Rendered verification not performed.`,
    confidenceBase: 62,
    cap: 88,
  });
}

export function evaluatePlatformApis(ctx: DimensionContext): DimensionPartial {
  const camera = countContentOccurrences(ctx.corpus, /\b(camera|Camera|ImagePicker|expo-camera)\b/gi);
  const location = countContentOccurrences(ctx.corpus, /\b(geolocation|location|Location|expo-location)\b/gi);
  const notifications = countContentOccurrences(ctx.corpus, /\b(notification|push|expo-notifications|FirebaseMessaging)\b/gi);
  const storage = countContentOccurrences(ctx.corpus, /\b(AsyncStorage|SecureStore|localStorage|SharedPreferences|UserDefaults)\b/gi);
  const permissions = countContentOccurrences(ctx.corpus, /\b(permission|requestPermission|PermissionsAndroid)\b/gi);
  const deeplink = countContentOccurrences(ctx.corpus, /\b(linking|deep link|Linking\.openURL)\b/gi);

  const checks = [
    check('Device storage integration', `${storage} storage API signal(s).`, storage > 0 ? 1 : 0, 20),
    check('Notifications', `${notifications} notification signal(s).`, notifications > 0 ? 1 : 0.3, 18),
    check('Camera/media APIs', `${camera} camera/media signal(s).`, camera > 0 ? 1 : 0.3, 16),
    check('Location APIs', `${location} location signal(s).`, location > 0 ? 1 : 0.3, 16),
    check('Permission handling', `${permissions} permission signal(s).`, ratio(permissions, 1), 18),
    check('Deep linking', `${deeplink} deep-link signal(s).`, deeplink > 0 ? 1 : 0.3, 12),
  ];

  return scoreChecks(checks, {
    summary: `Platform API usage: storage=${storage}, notifications=${notifications}, camera=${camera}, location=${location}, permissions=${permissions}.`,
    confidenceBase: 74,
  });
}

export function evaluateStoreReadiness(ctx: DimensionContext): DimensionPartial {
  const appConfig = countFiles(ctx, /(app\.json|app\.config\.(js|ts)|Info\.plist|AndroidManifest\.xml|pubspec\.yaml)/i);
  const icons = countFiles(ctx, /(icon|splash|adaptive-icon)/i);
  const version = countContentOccurrences(ctx.corpus, /\bversion\b|versionCode|CFBundleShortVersionString/gi);
  const permissions = countContentOccurrences(ctx.corpus, /\b(permission|NSCameraUsageDescription|uses-permission)\b/gi);
  const buildProfiles = countFiles(ctx, /(eas\.json|fastlane|build\.gradle|Podfile)/i);
  const storeMetadata = countFiles(ctx, /(store|privacy|release|changelog)/i);

  const checks = [
    check('App configuration exists', `${appConfig} app configuration file(s).`, appConfig > 0, 25),
    check('App icons and splash assets', `${icons} icon/splash file(s).`, icons > 0 ? 1 : 0, 18),
    check('Version metadata', `${version} version signal(s).`, version > 0 ? 1 : 0, 15),
    check('Permissions declared', `${permissions} permission declaration(s).`, permissions > 0 ? 1 : 0.5, 12),
    check('Release build profile', `${buildProfiles} release/build config file(s).`, buildProfiles > 0 ? 1 : 0, 18),
    check('Store/privacy documentation', `${storeMetadata} store/privacy document(s).`, storeMetadata > 0 ? 1 : 0, 12),
  ];

  return scoreChecks(checks, {
    summary: `${appConfig} app config(s), ${icons} icon/splash asset(s), ${buildProfiles} release config(s).`,
    confidenceBase: 78,
  });
}

export function evaluatePerformance(ctx: DimensionContext): DimensionPartial {
  const loop = countContentOccurrences(ctx.corpus, /\brequestAnimationFrame|deltaTime|delta\b/gi);
  const lod = countContentOccurrences(ctx.corpus, /\bLOD|level of detail|instanc|InstancedMesh\b/gi);
  const pooling = countContentOccurrences(ctx.corpus, /\bpool|reuse|object pool\b/gi);
  const memo = countContentOccurrences(ctx.corpus, /\bReact\.memo|useMemo|useCallback|virtualiz/gi);
  const lazy = countContentOccurrences(ctx.corpus, /\blazy\(|dynamic import|Suspense|loading="lazy"/gi);
  const limits = countContentOccurrences(ctx.corpus, /\bfps|frame budget|maxDelta|performance\.now\b/gi);
  const compression = countFiles(ctx, /(compressed|optimized|min\.(js|css)|draco|basis)/i);

  const checks = [
    check('Update loop uses delta time', `${loop} frame/delta signal(s).`, ratio(loop, 2), 20),
    check('LOD/instancing', `${lod} LOD/instancing signal(s).`, lod > 0 ? 1 : 0, 18),
    check('Object pooling/reuse', `${pooling} pooling signal(s).`, pooling > 0 ? 1 : 0, 12),
    check('Render/render-cost memoisation', `${memo} memoisation/virtualisation signal(s).`, ratio(memo, 2), 16),
    check('Lazy/async loading', `${lazy} lazy-loading signal(s).`, ratio(lazy, 2), 12),
    check('Frame budget/fps controls', `${limits} frame-budget signal(s).`, ratio(limits, 2), 12),
    check('Compressed/optimised assets', `${compression} optimised asset(s).`, compression > 0 ? 1 : 0, 10),
  ];

  return scoreChecks(checks, {
    summary: `Performance evidence: delta loop=${loop}, LOD/instancing=${lod}, pooling=${pooling}, lazy loading=${lazy}.`,
    confidenceBase: 70,
  });
}

export function evaluateGameplay(ctx: DimensionContext): DimensionPartial {
  const player = countContentOccurrences(ctx.corpus, /player|character|avatar/gi);
  const input = countContentOccurrences(ctx.corpus, /keydown|keyup|keyboard|gamepad|PointerLock|input/gi);
  const loop = countContentOccurrences(ctx.corpus, /requestAnimationFrame|update\(|game loop|fixedStep/gi);
  const state = countContentOccurrences(ctx.corpus, /state machine|gameState|missionState|objective/gi);
  const mission = countContentOccurrences(ctx.corpus, /mission|quest|objective|task/gi);
  const save = countContentOccurrences(ctx.corpus, /save|load|localStorage|persist/gi);
  const collision = countContentOccurrences(ctx.corpus, /collision|raycast|ground|gravity/gi);

  const checks = [
    check('Player controller', `${player} player/character signal(s).`, player > 0 ? 1 : 0, 20),
    check('Input handling', `${input} input signal(s).`, input > 0 ? 1 : 0, 18),
    check('Game update loop', `${loop} update-loop signal(s).`, loop > 0 ? 1 : 0, 18),
    check('Game state management', `${state} state/objective signal(s).`, state > 0 ? 1 : 0, 15),
    check('Mission/objective system', `${mission} mission signal(s).`, mission > 0 ? 1 : 0.2, 12),
    check('Save/load persistence', `${save} save/load signal(s).`, save > 0 ? 1 : 0, 7),
    check('Movement collision', `${collision} collision/gravity signal(s).`, collision > 0 ? 1 : 0, 10),
  ];

  return scoreChecks(checks, {
    summary: `Gameplay evidence: player=${player}, input=${input}, update loop=${loop}, missions=${mission}.`,
    confidenceBase: 74,
  });
}

export function evaluateLevelContent(ctx: DimensionContext): DimensionPartial {
  const scenes = countFiles(ctx, /(scenes?|levels?|world|maps?)\//i);
  const assets = filesMatching(ctx.signals, /\.(glb|gltf|fbx|obj|blend|unity|uasset|tscn)$/i);
  const spawn = countContentOccurrences(ctx.corpus, /spawn|waypoint|checkpoint|startPosition/gi);
  const procedural = countContentOccurrences(ctx.corpus, /procedural|generate|spline|road network/gi);
  const levelData = countContentOccurrences(ctx.corpus, /level|segment|mapData|tile/gi);
  const readmePlanned = /world|level|map|sector|district|environment/i.test(ctx.signals.readme);

  const checks = [
    check('Scene/level modules exist', `${scenes} scene/level/world module(s).`, ratio(scenes, 2), 24),
    check('3D assets present', `${assets.length} 3D asset file(s).`, ratio(assets.length, 3), 18),
    check('Spawn/placement data', `${spawn} spawn/placement signal(s).`, ratio(spawn, 2), 14),
    check('Level/content data structures', `${levelData} level data signal(s).`, ratio(levelData, 3), 16),
    check('Procedural/authoring system', `${procedural} procedural/authoring signal(s).`, procedural > 0 ? 1 : 0, 14),
    check('Content described in scope', readmePlanned ? 'README describes world/level content.' : 'No world/level content described.', readmePlanned ? 1 : 0, 8),
  ];

  return scoreChecks(checks, {
    summary: `${scenes} scene module(s), ${assets.length} 3D asset(s), ${spawn} spawn signal(s).`,
    confidenceBase: 68,
  });
}

export function evaluateGraphics(ctx: DimensionContext): DimensionPartial {
  const renderer = countContentOccurrences(ctx.corpus, /WebGLRenderer|renderer|Canvas|Engine|GraphicsDevice/gi);
  const scene = countContentOccurrences(ctx.corpus, /new Scene|Scene\(|camera|PerspectiveCamera/gi);
  const lights = countContentOccurrences(ctx.corpus, /Light|lighting|AmbientLight|DirectionalLight/gi);
  const materials = countContentOccurrences(ctx.corpus, /Material|texture|map:/gi);
  const shaders = countContentOccurrences(ctx.corpus, /shader|ShaderMaterial|glsl|effect/gi);
  const models = countContentOccurrences(ctx.corpus, /GLTFLoader|loadModel|gltf|obj|fbx/gi);
  const post = countContentOccurrences(ctx.corpus, /postprocess|bloom|composer|toneMapping/gi);
  const assets = filesMatching(ctx.signals, /\.(glb|gltf|fbx|obj|png|jpe?g|hdr|ktx2)$/i);

  const checks = [
    check('Renderer configured', `${renderer} renderer signal(s).`, renderer > 0 ? 1 : 0, 18),
    check('Scene/camera composition', `${scene} scene/camera signal(s).`, scene > 0 ? 1 : 0, 16),
    check('Lighting', `${lights} lighting signal(s).`, lights > 0 ? 1 : 0, 12),
    check('Materials/textures', `${materials} material/texture signal(s).`, ratio(materials, 2), 14),
    check('3D models loaded', `${models} model-loading signal(s).`, models > 0 ? 1 : 0, 14),
    check('Shaders/post-processing', `${shaders + post} shader/post-process signal(s).`, shaders + post > 0 ? 1 : 0.3, 12),
    check('Visual assets present', `${assets.length} visual asset file(s).`, ratio(assets.length, 4), 14),
  ];

  return scoreChecks(checks, {
    summary: `Graphics evidence: renderer=${renderer}, scene/camera=${scene}, models=${models}, assets=${assets.length}.`,
    confidenceBase: 68,
  });
}

export function evaluatePhysics(ctx: DimensionContext): DimensionPartial {
  const engine = hasDep(ctx, /cannon|rapier|ammo|matter|physics|havok|box2d/i);
  const bodies = countContentOccurrences(ctx.corpus, /\bBody\(|RigidBody|Collider|collisionShape/gi);
  const collisions = countContentOccurrences(ctx.corpus, /collision|contact|raycast|intersect/gi);
  const vehicle = countContentOccurrences(ctx.corpus, /vehicle|wheel|suspension|steering|throttle/gi);
  const constraints = countContentOccurrences(ctx.corpus, /constraint|joint|spring|damping/gi);
  const timestep = countContentOccurrences(ctx.corpus, /fixedStep|fixedTimeStep|substep|step\(delta/gi);

  const checks = [
    check('Physics engine integrated', engine ? 'Physics dependency detected.' : 'No physics engine dependency detected.', engine, 22),
    check('Rigid bodies/colliders', `${bodies} body/collider signal(s).`, bodies > 0 ? 1 : 0, 20),
    check('Collision detection', `${collisions} collision/raycast signal(s).`, ratio(collisions, 2), 18),
    check('Vehicle dynamics', `${vehicle} vehicle signal(s).`, vehicle > 0 ? 1 : 0.2, 14),
    check('Constraints/joints', `${constraints} constraint/damping signal(s).`, constraints > 0 ? 1 : 0.2, 12),
    check('Fixed timestep', `${timestep} timestep signal(s).`, timestep > 0 ? 1 : 0, 14),
  ];

  return scoreChecks(checks, {
    summary: `Physics evidence: engine=${engine}, bodies=${bodies}, collisions=${collisions}, vehicle=${vehicle}.`,
    confidenceBase: 74,
  });
}

export function evaluateDistribution(ctx: DimensionContext): DimensionPartial {
  const build = hasBuildScript(ctx);
  const engineProject = countFiles(ctx, /(project\.godot|\.uproject|ProjectSettings|Packages\/manifest|Assets\/)/i);
  const packaging = countFiles(ctx, /(electron-builder|forge\.config|tauri\.conf|build\.json|export_presets)/i);
  const version = countContentOccurrences(ctx.corpus, /\bversion\b|versionCode|appVersion/gi);
  const storeAssets = countFiles(ctx, /(icon|splash|banner|store)/i);

  const checks = [
    check('Production build configured', build ? `Build script: ${ctx.signals.scripts.build}.` : 'No production build script.', build ? 1 : 0, 30),
    check('Engine/platform project configuration', `${engineProject} engine/project config file(s).`, engineProject > 0 ? 1 : 0, 22),
    check('Release packaging config', `${packaging} packaging config file(s).`, packaging > 0 ? 1 : 0, 20),
    check('Version metadata', `${version} version signal(s).`, version > 0 ? 1 : 0, 16),
    check('Marketing/store assets', `${storeAssets} icon/banner asset(s).`, storeAssets > 0 ? 1 : 0, 12),
  ];

  return scoreChecks(checks, {
    summary: `Distribution: build=${build}, packaging configs=${packaging}, store assets=${storeAssets}.`,
    confidenceBase: 78,
  });
}

export function evaluateNativeIntegration(ctx: DimensionContext): DimensionPartial {
  const shell = hasDep(ctx, /electron|@tauri-apps|tauri|wails/i);
  const ipc = countContentOccurrences(ctx.corpus, /ipcMain|ipcRenderer|invoke\(|@tauri-apps\/api/gi);
  const fsAccess = countContentOccurrences(ctx.corpus, /\bfs\.|dialog\.|readFile|writeFile|path\./gi);
  const osApis = countContentOccurrences(ctx.corpus, /tray|Menu|shell\.openExternal|clipboard|Notification|globalShortcut/gi);
  const preload = countFiles(ctx, /preload/i);
  const security = countContentOccurrences(ctx.corpus, /contextIsolation|sandbox|nodeIntegration:\s*false|allowlist/gi);

  const checks = [
    check('Desktop shell configured', shell ? 'Desktop shell dependency detected.' : 'No desktop shell detected.', shell, 24),
    check('IPC boundary implemented', `${ipc} IPC signal(s).`, ipc > 0 ? 1 : 0, 20),
    check('Filesystem/native APIs', `${fsAccess} filesystem/native API signal(s).`, fsAccess > 0 ? 1 : 0, 18),
    check('OS integrations', `${osApis} OS integration signal(s).`, osApis > 0 ? 1 : 0.2, 14),
    check('Preload/bridge module', `${preload} preload/bridge file(s).`, preload > 0 ? 1 : 0, 12),
    check('Renderer isolation', `${security} security/isolation signal(s).`, security > 0 ? 1 : 0, 12),
  ];

  return scoreChecks(checks, {
    summary: `Native integration: shell=${shell}, IPC=${ipc}, filesystem=${fsAccess}, preload=${preload}.`,
    confidenceBase: 78,
  });
}

export function evaluatePackaging(ctx: DimensionContext): DimensionPartial {
  const builder = countFiles(ctx, /(electron-builder|forge\.config|tauri\.conf|build\.json|wix|inno|nsis)/i);
  const icons = countFiles(ctx, /(icon|iconset|\.ico$|\.icns$)/i);
  const installer = countContentOccurrences(ctx.corpus, /\bnsis|msi|dmg|appimage|deb|installer|setup\b/gi);
  const signing = countContentOccurrences(ctx.corpus, /codesign|notarize|signing|sign\b/gi);
  const version = countContentOccurrences(ctx.corpus, /\bversion\b|appVersion/gi);
  const build = hasBuildScript(ctx);

  const checks = [
    check('Packaging tool configured', `${builder} packaging config file(s).`, builder > 0 ? 1 : 0, 24),
    check('Application icons', `${icons} icon file(s).`, icons > 0 ? 1 : 0, 18),
    check('Installer targets', `${installer} installer target signal(s).`, installer > 0 ? 1 : 0, 18),
    check('Code signing/notarisation', `${signing} signing signal(s).`, signing > 0 ? 1 : 0, 12),
    check('Version metadata', `${version} version signal(s).`, version > 0 ? 1 : 0, 14),
    check('Build script', build ? 'Build script configured.' : 'No build script.', build ? 1 : 0, 14),
  ];

  return scoreChecks(checks, {
    summary: `${builder} packaging config(s), ${icons} icon(s), installer signals=${installer}.`,
    confidenceBase: 80,
  });
}

export function evaluateUpdates(ctx: DimensionContext): DimensionPartial {
  const updater = hasDep(ctx, /electron-updater|tauri-plugin-updater|autoUpdater|squirrel/i) || countContentOccurrences(ctx.corpus, /autoUpdater|checkForUpdates|update\.exe|latest\.yml/gi) > 0;
  const updateChecks = countContentOccurrences(ctx.corpus, /checkForUpdates|update check|version check/gi);
  const migration = countContentOccurrences(ctx.corpus, /migrat|schema version|data migration/gi);
  const channel = countContentOccurrences(ctx.corpus, /channel|beta|stable|release feed/gi);
  const changelog = countFiles(ctx, /changelog|releases?\.md/i);

  const checks = [
    check('Update mechanism', updater ? 'Auto-update mechanism detected.' : 'No update mechanism detected.', updater ? 1 : 0, 32),
    check('Update check', `${updateChecks} update-check signal(s).`, updateChecks > 0 ? 1 : 0, 22),
    check('Data migrations on update', `${migration} migration signal(s).`, migration > 0 ? 1 : 0, 20),
    check('Release channels', `${channel} channel signal(s).`, channel > 0 ? 1 : 0, 14),
    check('Changelog', changelog > 0 ? 'Changelog present.' : 'No changelog.', changelog > 0 ? 1 : 0, 12),
  ];

  return scoreChecks(checks, {
    summary: `Update mechanism=${updater}, update checks=${updateChecks}, migration signals=${migration}.`,
    confidenceBase: 76,
  });
}

export function evaluateApiSurface(ctx: DimensionContext): DimensionPartial {
  const exportsCount = ctx.signals.files.reduce((sum, f) => sum + f.exportedSymbols.length, 0);
  const commands = countFiles(ctx, /(^|\/)(commands?|cli|bin)\//i);
  const argParsing = countContentOccurrences(ctx.corpus, /\b(process\.argv|yargs|commander|cac|argparse|clap|click)\b/gi);
  const help = countContentOccurrences(ctx.corpus, /--help|usage:|help command|printHelp/gi);
  const routes = countContentOccurrences(ctx.corpus, /\b(?:router|app)\.(?:get|post|put|patch|delete)\s*\(/gi);

  const checks = [
    check('Public API/command surface', `${exportsCount} exported symbol(s), ${commands} command module(s).`, ratio(exportsCount + commands, 6), 28),
    check('Argument/option parsing', `${argParsing} argument-parsing signal(s).`, argParsing > 0 ? 1 : 0, 20),
    check('Help/usage output', `${help} help/usage signal(s).`, help > 0 ? 1 : 0, 18),
    check('Commands are implemented', `${commands} command file(s).`, ratio(commands, 2), 18),
    check('HTTP/server surface', `${routes} route handler(s).`, ratio(routes, 2), 16),
  ];

  return scoreChecks(checks, {
    summary: `${exportsCount} exports, ${commands} command module(s), ${argParsing} parser signals.`,
    confidenceBase: 78,
  });
}

export function evaluateDocs(ctx: DimensionContext): DimensionPartial {
  const readme = ctx.signals.readme;
  const docsFiles = countFiles(ctx, /(^|\/)(docs?|documentation)\//i);
  const install = /\b(install|setup|getting started)\b/i.test(readme);
  const usage = /\b(usage|example|quick start)\b/i.test(readme);
  const api = /\b(api|reference|flags|options)\b/i.test(readme);
  const changelog = countFiles(ctx, /changelog|release/i);
  const license = countFiles(ctx, /license/i);
  const examples = countFiles(ctx, /(^|\/)(examples?|samples?)\//i);

  const checks = [
    check('README present', readme.length > 150 ? `README is ${readme.length} characters.` : 'README missing or very short.', readme.length > 150 ? 1 : 0, 22),
    check('Installation instructions', install ? 'Install/setup section found.' : 'No installation section.', install ? 1 : 0, 16),
    check('Usage examples', usage ? 'Usage/example section found.' : 'No usage section.', usage ? 1 : 0, 18),
    check('API/reference documentation', api ? 'API/reference documentation found.' : 'No API reference.', api ? 1 : 0, 14),
    check('Examples/samples', `${examples} example directory/file(s).`, examples > 0 ? 1 : 0, 10),
    check('Changelog', changelog > 0 ? 'Changelog present.' : 'No changelog.', changelog > 0 ? 1 : 0, 8),
    check('License', license > 0 ? 'License file present.' : 'No license file.', license > 0 ? 1 : 0, 6),
    check('Dedicated docs directory', `${docsFiles} docs file(s).`, docsFiles > 0 ? 1 : 0, 6),
  ];

  return scoreChecks(checks, {
    summary: `Documentation: README=${readme.length} chars, install=${install}, usage=${usage}, examples=${examples}.`,
    confidenceBase: 82,
  });
}

export function evaluateErrorHandling(ctx: DimensionContext): DimensionPartial {
  const tryCatch = countContentOccurrences(ctx.corpus, /\btry\s*\{/gi);
  const catches = countContentOccurrences(ctx.corpus, /\bcatch\s*[({]/gi);
  const validation = countContentOccurrences(ctx.corpus, /\b(validate|zod|joi|yup|required)\b/gi);
  const exitCodes = countContentOccurrences(ctx.corpus, /process\.exit\(|exitCode|throw new Error/gi);
  const logging = countContentOccurrences(ctx.corpus, /\b(logger|log\.error|console\.error|winston|pino)\b/gi);
  const messages = countContentOccurrences(ctx.corpus, /\berror message|errorMessage|invalid|failed to\b/gi);

  const checks = [
    check('Exception handling', `${tryCatch} try block(s), ${catches} catch handler(s).`, ratio(catches, 2), 24),
    check('Input validation', `${validation} validation signal(s).`, ratio(validation, 2), 20),
    check('Actionable errors', `${messages} error-message signal(s).`, ratio(messages, 3), 18),
    check('Exit/error propagation', `${exitCodes} exit/propagation signal(s).`, ratio(exitCodes, 2), 16),
    check('Error logging', `${logging} logging signal(s).`, logging > 0 ? 1 : 0, 14),
    check('CLI/API error documentation', hasReadme(ctx) ? 'README present.' : 'No README.', hasReadme(ctx) ? 1 : 0, 8),
  ];

  return scoreChecks(checks, {
    summary: `${tryCatch} try blocks, ${catches} catch handlers, ${validation} validation signals.`,
    confidenceBase: 78,
  });
}

export function evaluateGenericUiUx(ctx: DimensionContext): DimensionPartial {
  const componentFiles = countFiles(ctx, /(^|\/)(components|ui|views|screens|widgets)\//i);
  const styling = countFiles(ctx, /\.(css|scss|less|styled\.|tailwind)/i) + (hasDep(ctx, /tailwind|styled-components|emotion/i) ? 1 : 0);
  const states = errorSignalCount(ctx);
  const icons = /lucide|react-icons|heroicons|font-awesome/i.test(ctx.signals.allText);
  const images = filesMatching(ctx.signals, /\.(png|jpe?g|svg|webp)$/i);

  const checks = [
    check('UI module structure', `${componentFiles} UI module(s).`, ratio(componentFiles, 3), 24),
    check('Styling system', `${styling} styling signal(s).`, styling > 0 ? 1 : 0, 22),
    check('Interaction states', `${states} error/loading/state signal(s).`, ratio(states, 2), 18),
    check('Iconography', icons ? 'Icon library present.' : 'No icon library.', icons ? 1 : 0.3, 10),
    check('Visual assets', `${images.length} image asset(s).`, ratio(images.length, 2), 12),
    check('Layout primitives', 'Layout/navigation components present.', countFiles(ctx, /(layout|nav|header|shell|sidebar)/i) > 0 ? 1 : 0, 14),
  ];

  return scoreChecks(checks, {
    summary: `${componentFiles} UI module(s), ${styling} styling signal(s); visual rendering not reviewed.`,
    confidenceBase: 62,
  });
}

export function evaluateGenericContent(ctx: DimensionContext): DimensionPartial {
  const docs = countFiles(ctx, /\.(md|mdx|txt)$/i);
  const assets = filesMatching(ctx.signals, /\.(png|jpe?g|svg|webp|mp4|glb|gltf)$/i);
  const placeholder = placeholderMarkers(ctx.corpus);
  const dataFiles = countFiles(ctx, /\.(json|csv|yaml|yml)$/i);

  const checks = [
    check('Documentation/content files', `${docs} document(s).`, ratio(docs, 1), 25),
    check('Asset files', `${assets.length} media asset(s).`, ratio(assets.length, 2), 25),
    check('Data/content files', `${dataFiles} data/config file(s).`, ratio(dataFiles, 2), 20),
    check('No placeholder content', `${placeholder} placeholder/TODO marker(s).`, ratio(Math.max(0, 10 - placeholder), 10), 15),
    check('README content', hasReadme(ctx) ? 'README present.' : 'No substantial README.', hasReadme(ctx) ? 1 : 0, 15),
  ];

  return scoreChecks(checks, {
    summary: `${docs} docs, ${assets.length} assets, ${dataFiles} data files.`,
    confidenceBase: 74,
  });
}
