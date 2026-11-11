import { error, redirect } from '@sveltejs/kit';
import { DomainError, repository } from '../../../../lib/server/db';
import { exportView } from '../../../../lib/rules/export';
import { characterForViewer } from '../../../../lib/server/visibility';
export function load({ locals, params, url }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  try {
    const revealPrivate = url.searchParams.get('revealPrivate') === '1';
    const record = characterForViewer(repository().read(params.id), locals.user, revealPrivate);
    return {
      id: params.id,
      view: exportView(record.document, record.visibleStats, record.redacted),
      privateDetailsRevealed: locals.user.role === 'admin' && revealPrivate,
      revision: record.revision,
      date: new Date().toLocaleString('pl-PL'),
    };
  } catch (e) {
    if (e instanceof DomainError) error(e.status, e.message);
    throw e;
  }
}
