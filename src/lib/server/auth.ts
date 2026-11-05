import * as oauth from 'oauth4webapi';
import { authConfigured, config, requestOrigin } from './config';
import { DomainError, type SessionUser } from './db';

const server: oauth.AuthorizationServer = {
  issuer: 'https://discord.com',
  authorization_endpoint: 'https://discord.com/oauth2/authorize',
  token_endpoint: 'https://discord.com/api/oauth2/token',
};
function client() {
  const c = config();
  return { client_id: c.clientId };
}
export function discordSessionAllowed(user: SessionUser | null): boolean {
  return !!(
    user?.enabled &&
    authConfigured() &&
    user.guildId === config().guildId &&
    /^\d{10,25}$/.test(user.discordId)
  );
}
export async function authorization(origin = config().origin) {
  requestOrigin(new URL(origin));
  const state = oauth.generateRandomState(),
    verifier = oauth.generateRandomCodeVerifier();
  const challenge = await oauth.calculatePKCECodeChallenge(verifier);
  const url = new URL(server.authorization_endpoint!);
  url.search = new URLSearchParams({
    client_id: config().clientId,
    redirect_uri: `${origin}/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return { state, verifier, url };
}
export async function discordIdentity(
  callback: URL,
  state: string,
  verifier: string,
): Promise<{ id: string; name: string }> {
  const c = config(),
    cl = client();
  if (!authConfigured())
    throw new DomainError(
      503,
      'Logowanie Discord wymaga konfiguracji aplikacji i serwera Discord.',
    );
  const origin = requestOrigin(callback);
  const parameters = oauth.validateAuthResponse(server, cl, callback, state);
  const response = await oauth.authorizationCodeGrantRequest(
    server,
    cl,
    oauth.ClientSecretPost(c.clientSecret),
    parameters,
    `${origin}/auth/discord/callback`,
    verifier,
    { signal: AbortSignal.timeout(10000) },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(server, cl, response);
  if (
    tokens.scope !== undefined &&
    !['identify', 'guilds.members.read'].every((scope) => tokens.scope!.split(' ').includes(scope))
  )
    throw new DomainError(403, 'Zezwól aplikacji na sprawdzenie członkostwa na serwerze Discord.');
  const identity = await oauth.protectedResourceRequest(
    tokens.access_token,
    'GET',
    new URL('https://discord.com/api/v10/users/@me'),
    undefined,
    undefined,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!identity.ok) throw new DomainError(502, 'Nie udało się odczytać tożsamości Discord.');
  const user = (await identity.json()) as { id?: string; global_name?: string; username?: string };
  if (!user.id || !/^\d{10,25}$/.test(user.id))
    throw new DomainError(502, 'Discord zwrócił nieprawidłową tożsamość.');
  const membership = await oauth.protectedResourceRequest(
    tokens.access_token,
    'GET',
    new URL(`https://discord.com/api/v10/users/@me/guilds/${c.guildId}/member`),
    undefined,
    undefined,
    { signal: AbortSignal.timeout(10000) },
  );
  if (membership.status === 403 || membership.status === 404)
    throw new DomainError(403, 'Dostęp wymaga członkostwa na serwerze Discord tej kampanii.');
  if (!membership.ok)
    throw new DomainError(502, 'Nie udało się sprawdzić członkostwa na serwerze Discord.');
  const member = (await membership.json()) as {
    user?: { id?: string };
    roles?: unknown;
    joined_at?: unknown;
  };
  if (
    !Array.isArray(member.roles) ||
    !(typeof member.joined_at === 'string' || member.joined_at === null) ||
    (member.user !== undefined && member.user.id !== user.id)
  )
    throw new DomainError(502, 'Discord zwrócił nieprawidłowe dane członkostwa.');
  return { id: user.id, name: user.global_name || user.username || 'Gracz' };
}
