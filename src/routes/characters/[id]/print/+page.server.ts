import { error, redirect } from '@sveltejs/kit';
import { DomainError, repository } from '../../../../lib/server/db';
import { exportView } from '../../../../lib/rules/export';
export function load({ locals, params }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  try {
    const record = repository().get(locals.user.id, params.id);
    return {
      id: params.id,
      view: exportView(record.document),
      revision: record.revision,
      date: new Date().toLocaleString('pl-PL'),
    };
  } catch (e) {
    if (e instanceof DomainError) error(e.status, e.message);
    throw e;
  }
}
