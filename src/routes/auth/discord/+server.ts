import { redirect, error } from '@sveltejs/kit';
import { authorization } from '../../../lib/server/auth';
import { authConfigured, requestOrigin } from '../../../lib/server/config';
export async function GET({ cookies, url }: import('./$types').RequestEvent) {
  if (!authConfigured())
    error(503, 'Logowanie Discord wymaga konfiguracji aplikacji i serwera Discord.');
  const flow = await authorization(requestOrigin(url));
  const options = {
    path: '/auth/discord/callback',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax' as const,
    maxAge: 600,
  };
  cookies.set('oauth_state', flow.state, options);
  cookies.set('oauth_verifier', flow.verifier, options);
  redirect(302, flow.url, { external: ['https://discord.com'] });
}
