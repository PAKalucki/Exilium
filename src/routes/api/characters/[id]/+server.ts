import { json } from '@sveltejs/kit';
import { repository, DomainError } from '../../../../lib/server/db';
import { execute } from '../../../../lib/server/commands';
import { readJson, apiError } from '../../../../lib/server/http';
export function GET({ locals, params }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json(repository().read(params.id));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST({ locals, params, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json(execute(repository(), locals.user.id, params.id, await readJson(request)));
  } catch (e) {
    return apiError(e);
  }
}
