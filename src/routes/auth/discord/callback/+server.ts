import { redirect } from '@sveltejs/kit';
import { discordIdentity } from '../../../../lib/server/auth';
import { config } from '../../../../lib/server/config';
import { DomainError, repository } from '../../../../lib/server/db';
export async function GET({ cookies, url }: import('./$types').RequestEvent) {
  const state = cookies.get('oauth_state'),
    verifier = cookies.get('oauth_verifier');
  cookies.delete('oauth_state', { path: '/auth/discord/callback' });
  cookies.delete('oauth_verifier', { path: '/auth/discord/callback' });
  let denied = false,
    token = '';
  try {
    if (!state || !verifier) throw new Error('Missing login flow');
    const identity = await discordIdentity(url, state, verifier);
    const user = repository().user(identity.id, identity.name);
    token = repository().createSession(user, config().guildId);
  } catch (e) {
    denied = e instanceof DomainError && e.status === 403;
  }
  if (!token) redirect(303, denied ? '/?login=denied' : '/?login=failed');
  const previous = cookies.get('exilium_session');
  if (previous) repository().logout(previous);
  cookies.set('exilium_session', token, {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 7 * 86400,
  });
  redirect(303, '/');
}
