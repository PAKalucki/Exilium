import { json } from '@sveltejs/kit';
import { repository, DomainError } from '../../../lib/server/db';
import { config } from '../../../lib/server/config';
import { apiError, readJson } from '../../../lib/server/http';
export function GET({ locals }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json(repository().identity.tokens(locals.user.id));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST({ locals, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json(
      repository().identity.createToken(locals.user.id, config().guildId, await readJson(request)),
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
