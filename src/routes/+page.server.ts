import { dev } from '$app/env';
import { config, authConfigured } from '../lib/server/config';
import { repository } from '../lib/server/db';
export const load = ({ locals, url }: { locals: App.Locals; url: URL }) => ({
  characters: locals.user ? repository().list(locals.user.id) : [],
  authReady: authConfigured(),
  developmentLogin: dev && config().devLogin,
  loginError:
    url.searchParams.get('login') === 'denied'
      ? 'Dostęp wymaga członkostwa na serwerze Discord tej kampanii i zgody na jego sprawdzenie.'
      : url.searchParams.has('login')
        ? 'Logowanie nie powiodło się. Spróbuj ponownie.'
        : null,
});
