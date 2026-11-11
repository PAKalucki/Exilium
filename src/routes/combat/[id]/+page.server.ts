import { error, redirect } from '@sveltejs/kit';
import { repository, DomainError } from '../../../lib/server/db';
import { characterForViewer } from '../../../lib/server/visibility';
export function load({ locals, params, url }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  try {
    const reveal = url.searchParams.get('revealPrivate') === '1';
    return {
      encounter: repository().combat.view(params.id, locals.user.id, reveal),
      characters: repository()
        .listAll()
        .filter((r) => r.status === 'active')
        .map((r) => characterForViewer(r, locals.user!, reveal)),
      canManageRole: locals.user.role !== 'player',
      admin: locals.user.role === 'admin',
      revealRequested: reveal,
    };
  } catch (e) {
    if (e instanceof DomainError) error(e.status, e.message);
    throw e;
  }
}
