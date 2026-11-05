import { error, redirect } from '@sveltejs/kit';
import { DomainError, repository } from '../../../lib/server/db';
import { characterForViewer } from '../../../lib/server/visibility';
import { canEditCharacter } from '../../../lib/access';
export function load({ locals, params }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  try {
    const record = repository().read(params.id);
    return {
      record: characterForViewer(record, locals.user),
      isOwner: record.ownerId === locals.user.id,
      canEdit: canEditCharacter(locals.user, record.ownerId),
      history: repository().readHistory(params.id),
    };
  } catch (e) {
    if (e instanceof DomainError) error(e.status, e.message);
    throw e;
  }
}
