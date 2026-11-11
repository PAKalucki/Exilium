import { error, redirect } from '@sveltejs/kit';
import { DomainError, repository } from '../../../lib/server/db';
import { characterForViewer } from '../../../lib/server/visibility';
import { canEditCharacter } from '../../../lib/access';
export function load({ locals, params, url }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  try {
    const record = repository().read(params.id);
    const revealPrivate = url.searchParams.get('revealPrivate') === '1';
    const visible = characterForViewer(record, locals.user, revealPrivate);
    const canRevealPrivate =
      locals.user.role === 'admin' &&
      record.ownerId !== locals.user.id &&
      Object.values(record.document.privacy).some(Boolean);
    return {
      record: visible,
      isOwner: record.ownerId === locals.user.id,
      canEdit: canEditCharacter(locals.user, record.ownerId) && !visible.redacted?.length,
      canRevealPrivate,
      privateDetailsRevealed: canRevealPrivate && revealPrivate,
      history: visible.redacted?.includes('statistics') ? [] : repository().readHistory(params.id),
    };
  } catch (e) {
    if (e instanceof DomainError) error(e.status, e.message);
    throw e;
  }
}
