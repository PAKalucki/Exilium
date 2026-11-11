import { redirect } from '@sveltejs/kit';
import { repository } from '../../lib/server/db';
import { managesGame } from '../../lib/access';
export function load({ locals }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
  return { combats: repository().combat.list(locals.user.id), canManage: managesGame(locals.user) };
}
