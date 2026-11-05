import { error, redirect } from '@sveltejs/kit';
import { DomainError, repository } from '../../../../lib/server/db';
import { exportView } from '../../../../lib/rules/export';
import { characterForViewer } from '../../../../lib/server/visibility';
export function load({ locals, params }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  try {
    const record = characterForViewer(repository().read(params.id), locals.user);
    return {
      id: params.id,
      view: exportView(record.document, record.visibleStats),
      revision: record.revision,
      date: new Date().toLocaleString('pl-PL'),
    };
  } catch (e) {
    if (e instanceof DomainError) error(e.status, e.message);
    throw e;
  }
}
