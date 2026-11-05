import { redirect } from '@sveltejs/kit';
import { repository } from '../../lib/server/db';
export function load({ locals }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  return { tokens: repository().identity.tokens(locals.user.id) };
}
