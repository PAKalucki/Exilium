import { redirect } from '@sveltejs/kit';
import { repository } from '../../../lib/server/db';
export function POST({ cookies }: import('./$types').RequestEvent) {
  const token = cookies.get('exilium_session');
  if (token) repository().logout(token);
  cookies.delete('exilium_session', { path: '/' });
  redirect(303, '/');
}
