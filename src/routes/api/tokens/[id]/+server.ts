import { json } from '@sveltejs/kit';
import { repository, DomainError } from '../../../../lib/server/db';
import { apiError } from '../../../../lib/server/http';
export function DELETE({ locals, params }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    repository().identity.revokeToken(locals.user.id, params.id);
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
