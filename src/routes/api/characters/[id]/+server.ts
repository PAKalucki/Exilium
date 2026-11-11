import { json } from '@sveltejs/kit';
import { repository, DomainError } from '../../../../lib/server/db';
import {
  characterForViewer,
  requirePrivateCharacterAccess,
} from '../../../../lib/server/visibility';
import { execute } from '../../../../lib/server/commands';
import { readJson, apiError } from '../../../../lib/server/http';
export function GET({ locals, params, url }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json(
      characterForViewer(
        repository().read(params.id),
        locals.user,
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
    const input = await readJson(request);
    requirePrivateCharacterAccess(
      repository().editable(locals.user.id, params.id),
      locals.user,
      url.searchParams.get('revealPrivate') === '1',
    );
    return json(
      characterForViewer(
        execute(repository(), locals.user.id, params.id, input),
        locals.user,
        url.searchParams.get('revealPrivate') === '1',
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
