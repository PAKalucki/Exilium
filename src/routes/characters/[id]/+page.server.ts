import { error, redirect } from '@sveltejs/kit';
import { DomainError, repository } from '../../../lib/server/db';
export function load({ locals, params }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  try {
    const record = repository().read(params.id);
    return {
      record,
      canEdit: record.ownerId === locals.user.id,
      history: repository().readHistory(params.id),
    };
  } catch (e) {
    if (e instanceof DomainError) error(e.status, e.message);
    throw e;
  }
}
