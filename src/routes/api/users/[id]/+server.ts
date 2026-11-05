import { json } from '@sveltejs/kit';
import { repository, DomainError } from '../../../../lib/server/db';
import { apiError, readJson } from '../../../../lib/server/http';
export async function POST({ locals, params, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json({
      users: repository().identity.change(locals.user.id, params.id, await readJson(request)),
      history: locals.user.id !== params.id ? repository().identity.history(locals.user.id) : [],
    });
  } catch (e) {
    return apiError(e);
  }
}
