import { dev } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { config } from './lib/server/config';
import { discordSessionAllowed } from './lib/server/auth';
import { repository } from './lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
  const c = config();
  if (!c.origins.includes(event.url.origin))
    return new Response('Niedozwolony adres aplikacji.', { status: 421 });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
    if (event.request.headers.get('origin') !== event.url.origin)
      return new Response('Niedozwolone źródło żądania.', { status: 403 });
  }
  event.locals.user = null;
  const token = event.cookies.get('exilium_session');
  if (token) {
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
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  if (
    (event.locals.user || event.url.pathname.startsWith('/auth')) &&
    !response.headers.has('Cache-Control')
  )
    response.headers.set('Cache-Control', 'no-store');
  return response;
};
