import { json } from '@sveltejs/kit';
import { repository, DomainError } from '../../../../lib/server/db';
import { apiError, readJson } from '../../../../lib/server/http';
export function GET({ locals, params, url }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json(
      repository().combat.view(
        params.id,
        locals.user.id,
        url.searchParams.get('revealPrivate') === '1',
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST({ locals, params, request, url }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const reveal = url.searchParams.get('revealPrivate') === '1';
    repository().combat.change(locals.user.id, params.id, await readJson(request), reveal);
    return json(repository().combat.view(params.id, locals.user.id, reveal));
  } catch (e) {
    return apiError(e);
  }
}
