import { json } from '@sveltejs/kit';
import { repository, DomainError } from '../../../lib/server/db';
import { apiError } from '../../../lib/server/http';
export function GET({ locals }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json({
      users: repository().identity.list(locals.user.id),
      history: repository().identity.history(locals.user.id),
    });
  } catch (e) {
    return apiError(e);
  }
}
