import { dev } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { config } from './lib/server/config';
import { discordSessionAllowed } from './lib/server/auth';
import { repository } from './lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
  const c = config();
  if (!c.origins.includes(event.url.origin))
    return new Response('Niedozwolony adres aplikacji.', { status: 421 });
  event.locals.user = null;
  event.locals.apiScopes = null;
  const authorization = event.request.headers.get('authorization');
  if (authorization) {
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const user = repository().identity.token(bearer);
    if (
      !user ||
      !(discordSessionAllowed(user) || (dev && c.devLogin && user.discordId.startsWith('dev:')))
    )
      return new Response('Nieprawidłowy lub wygasły token API.', { status: 401 });
    const path = event.url.pathname;
    const read =
      ['GET', 'HEAD'].includes(event.request.method) &&
      (path === '/api/me' ||
        path === '/api/health' ||
        path === '/api/diagnostics' ||
        path === '/api/openapi.json' ||
        /^\/api\/(characters|compendium)(\/[^/]+(\/(pdf|portrait))?)?$/.test(path));
    const write = event.request.method === 'POST' && /^\/api\/compendium(\/[^/]+)?$/.test(path);
    if (
      !(read && user.scopes.includes('read')) &&
      !(write && user.scopes.includes('compendium:write'))
    )
      return new Response('Token nie ma uprawnień do tej operacji.', { status: 403 });
    event.locals.user = user;
    event.locals.apiScopes = user.scopes;
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
    const origin = event.request.headers.get('origin');
    if (origin !== event.url.origin && !(event.locals.apiScopes && !origin))
      return new Response('Niedozwolone źródło żądania.', { status: 403 });
  }
  const token = event.cookies.get('exilium_session');
  if (token && !authorization) {
    const user = repository().session(token);
    if (
      user &&
      (discordSessionAllowed(user) || (dev && c.devLogin && user.discordId.startsWith('dev:')))
    )
      event.locals.user = user;
    else {
      repository().logout(token);
      event.cookies.delete('exilium_session', { path: '/' });
    }
  }
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set(
    'X-Frame-Options',
    event.url.pathname === '/api-docs/ui' ? 'SAMEORIGIN' : 'DENY',
  );
  response.headers.set('Referrer-Policy', 'same-origin');
  if (
    (event.locals.user || event.url.pathname.startsWith('/auth')) &&
    !response.headers.has('Cache-Control')
  )
    response.headers.set('Cache-Control', 'no-store');
  return response;
};
