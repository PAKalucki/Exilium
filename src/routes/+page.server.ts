import { dev } from '$app/env';
import { config, authConfigured } from '../lib/server/config';
import { repository } from '../lib/server/db';
import { characterForViewer } from '../lib/server/visibility';
import { canEditCharacter } from '../lib/access';
export const load = ({ locals, url }: { locals: App.Locals; url: URL }) => ({
  characters: locals.user
    ? repository()
        .listAll()
        .map((record) => ({
          ...characterForViewer(record, locals.user!),
          isOwner: record.ownerId === locals.user!.id,
          canEdit: canEditCharacter(locals.user!, record.ownerId),
        }))
    : [],
  authReady: authConfigured(),
  developmentLogin: dev && config().devLogin,
  loginError:
    url.searchParams.get('login') === 'denied'
      ? 'Dostęp wymaga członkostwa na serwerze Discord tej kampanii i zgody na jego sprawdzenie.'
      : url.searchParams.has('login')
        ? 'Logowanie nie powiodło się. Spróbuj ponownie.'
        : null,
});
