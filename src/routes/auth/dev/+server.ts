import { dev } from '$app/env';
import { error, redirect } from '@sveltejs/kit';
import { config } from '../../../lib/server/config';
import { repository } from '../../../lib/server/db';
export async function POST({ cookies, request, url }: import('./$types').RequestEvent) {
  if (!dev || !config().devLogin) error(404);
  const form = await request.formData();
  const player = form.get('player') === 'b' ? 'b' : 'a';
  const user = repository().user(`dev:${player}`, `Gracz ${player.toUpperCase()} · lokalnie`);
  const old = cookies.get('exilium_session');
  if (old) repository().logout(old);
  cookies.set('exilium_session', repository().createSession(user), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 86400,
  });
  redirect(303, '/');
}
