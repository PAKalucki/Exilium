import { error, redirect } from '@sveltejs/kit';
import { DomainError, repository } from '../../../lib/server/db';
export function load({ locals, params }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  try {
    return {
      record: repository().get(locals.user.id, params.id),
      history: repository().history(locals.user.id, params.id),
    };
  } catch (e) {
    if (e instanceof DomainError) error(e.status, e.message);
    throw e;
  }
}
