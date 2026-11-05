import { error, redirect } from '@sveltejs/kit';
import { repository } from '../../lib/server/db';
export function load({ locals }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  if (locals.user.role !== 'admin') error(403, 'Tylko administrator zarządza użytkownikami.');
  return {
    users: repository().identity.list(locals.user.id),
    history: repository().identity.history(locals.user.id),
  };
}
