import { RuntimeCheckSummary } from './types.js';

/**
 * Safe, bounded HTTP verification of a locally served preview.
 * Only loopback origins are accepted, so this can never be used to probe
 * arbitrary hosts from the user's machine.
 */
export async function runRuntimeChecks(
  baseUrl: string,
  routes: string[],
  timeoutMs = 4000
): Promise<RuntimeCheckSummary> {
  const notes: string[] = [];
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    return {
      baseUrl,
      checkedRoutes: 0,
      successfulRoutes: 0,
      failedRoutes: [],
      notes: ['Invalid preview URL; runtime verification skipped.'],
      routeResults: [],
    };
  }

  const isLoopback =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]' ||
    parsed.hostname === '::1';

  if (!isLoopback || !['http:', 'https:'].includes(parsed.protocol)) {
    return {
      baseUrl,
      checkedRoutes: 0,
      successfulRoutes: 0,
      failedRoutes: [],
      notes: [
        'Runtime checks are limited to http(s) loopback preview servers (localhost/127.0.0.1) for safety; the supplied URL was not checked.',
      ],
      routeResults: [],
    };
  }

  const uniqueRoutes = Array.from(new Set(routes.map((r) => (r.startsWith('/') ? r : `/${r}`)))).slice(0, 20);
  if (uniqueRoutes.length === 0) uniqueRoutes.push('/');

  const routeResults: RuntimeCheckSummary['routeResults'] = [];
  const failedRoutes: string[] = [];
  let successfulRoutes = 0;

  for (const route of uniqueRoutes) {
    const target = new URL(route, parsed.origin).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(target, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { Accept: 'text/html,application/xhtml+xml' },
      });
      const body = await response.text();
      const ok = response.ok && body.trim().length > 0;
      const looksLikeEmptyShell =
        /<div\s+id=["'](root|app)["']\s*>\s*<\/div>/i.test(body) && body.replace(/<[^>]+>/g, '').trim().length < 50;

      if (ok) successfulRoutes += 1;
      else failedRoutes.push(route);

      if (looksLikeEmptyShell) {
        notes.push(
          `${route} returned an empty client-rendered shell; HTTP reachability is confirmed but rendered content was not verified.`
        );
      }

      routeResults.push({
        route,
        status: response.status,
        ok,
        contentLength: body.length,
      });
    } catch (error: any) {
      failedRoutes.push(route);
      routeResults.push({ route, status: null, ok: false, contentLength: 0 });
      if (error?.name === 'AbortError') {
        notes.push(`${route} timed out after ${timeoutMs}ms.`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  notes.push(
    'Runtime checks verify HTTP responses and served markup only; JavaScript-rendered behaviour and multiple viewports are not exercised.'
  );

  return {
    baseUrl: parsed.origin,
    checkedRoutes: uniqueRoutes.length,
    successfulRoutes,
    failedRoutes,
    notes,
    routeResults,
  };
}
