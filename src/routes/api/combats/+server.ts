import { json } from '@sveltejs/kit';
import { repository, DomainError } from '../../../lib/server/db';
import { apiError, readJson } from '../../../lib/server/http';
export function GET({ locals }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json(repository().combat.list(locals.user.id));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST({ locals, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const record = repository().combat.create(locals.user.id, await readJson(request));
    return json(repository().combat.view(record.id, locals.user.id), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
