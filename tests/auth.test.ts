import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authorization, discordIdentity, discordSessionAllowed } from '../src/lib/server/auth';
import { authConfigured } from '../src/lib/server/config';
import { Repository } from '../src/lib/server/db';

const guild = '200000000000000001',
  userId = '100000000000000001';
const callback = () =>
  new URL('http://localhost:5173/auth/discord/callback?code=abc&state=expected');
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function provider(
  memberResponse = json({
    user: { id: userId },
    roles: [],
    joined_at: '2026-01-01T00:00:00Z',
  }),
  scope = 'identify guilds.members.read',
) {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      json({ access_token: 'test-access', token_type: 'Bearer', expires_in: 3600, scope }),
    )
    .mockResolvedValueOnce(json({ id: userId, username: 'Test', global_name: 'Łucja' }))
    .mockResolvedValueOnce(memberResponse);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'http://localhost:5173');
  vi.stubEnv('APP_ADDITIONAL_ORIGINS', '');
  vi.stubEnv('DISCORD_CLIENT_ID', 'app');
  vi.stubEnv('DISCORD_CLIENT_SECRET', 'test-secret');
  vi.stubEnv('DISCORD_GUILD_ID', guild);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('Discord OAuth server membership', () => {
  it('uses the same allowed LAN origin for authorization and token exchange', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://exilium.test');
    vi.stubEnv('APP_ADDITIONAL_ORIGINS', 'http://192.0.2.10:5173');
    const flow = await authorization('http://192.0.2.10:5173');
    expect(flow.url.searchParams.get('redirect_uri')).toBe(
      'http://192.0.2.10:5173/auth/discord/callback',
    );
    const fetch = provider();
    await expect(
      discordIdentity(
        new URL('http://192.0.2.10:5173/auth/discord/callback?code=abc&state=expected'),
        'expected',
        'a'.repeat(43),
      ),
    ).resolves.toEqual({ id: userId, name: 'Łucja' });
    expect(new URLSearchParams(String(fetch.mock.calls[0][1].body)).get('redirect_uri')).toBe(
      'http://192.0.2.10:5173/auth/discord/callback',
    );
  });
  it('rejects an unconfigured OAuth origin before contacting Discord', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(authorization('https://evil.test')).rejects.toThrow('Unconfigured');
    await expect(
      discordIdentity(
        new URL('https://evil.test/auth/discord/callback?code=abc&state=expected'),
        'expected',
        'a'.repeat(43),
      ),
    ).rejects.toThrow('Unconfigured');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requests identity and current membership, PKCE S256, one-time state and the canonical callback', async () => {
    const flow = await authorization();
    expect(flow.url.searchParams.get('scope')).toBe('identify guilds.members.read');
    expect(flow.url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(flow.url.searchParams.get('state')).toBe(flow.state);
    expect(flow.url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/auth/discord/callback',
    );
    expect(flow.verifier.length).toBeGreaterThanOrEqual(43);
  });
  it('rejects callback state mismatch before attempting a token exchange', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      discordIdentity(
        new URL('http://localhost:5173/auth/discord/callback?code=a&state=wrong'),
        'expected',
        'verifier',
      ),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('admits a current member of the configured server without a user-ID list', async () => {
    vi.stubEnv('DISCORD_ALLOWED_USER_IDS', 'a-different-legacy-id');
    const fetch = provider();
    const identity = await discordIdentity(callback(), 'expected', 'a'.repeat(43));
    expect(identity).toEqual({ id: userId, name: 'Łucja' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(String(fetch.mock.calls[0][1].body)).toContain('code_verifier=');
    expect(String(fetch.mock.calls[2][0])).toBe(
      `https://discord.com/api/v10/users/@me/guilds/${guild}/member`,
    );
    expect(new Headers(fetch.mock.calls[2][1].headers).get('authorization')).toBe(
      'Bearer test-access',
    );
  });
  it.each([403, 404])(
    'denies nonmembers when Discord returns %s, even with a legacy user-ID list',
    async (status) => {
      vi.stubEnv('DISCORD_ALLOWED_USER_IDS', userId);
      provider(json({ message: 'Unknown Member' }, status));
      await expect(discordIdentity(callback(), 'expected', 'a'.repeat(43))).rejects.toMatchObject({
        status: 403,
      });
    },
  );
  it.each([401, 429, 503])('fails closed on a failed membership check (%s)', async (status) => {
    provider(json({ message: 'Unavailable' }, status));
    await expect(discordIdentity(callback(), 'expected', 'a'.repeat(43))).rejects.toMatchObject({
      status: 502,
    });
  });
  it.each([{}, { user: { id: '100000000000000002' }, roles: [], joined_at: null }])(
    'rejects malformed or mismatched successful member data',
    async (member) => {
      provider(json(member));
      await expect(discordIdentity(callback(), 'expected', 'a'.repeat(43))).rejects.toMatchObject({
        status: 502,
      });
    },
  );
  it('rejects an authorization that did not grant the membership scope', async () => {
    const fetch = provider(undefined, 'identify');
    await expect(discordIdentity(callback(), 'expected', 'a'.repeat(43))).rejects.toMatchObject({
      status: 403,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(['', 'not-a-server-id', '200000000000000001/path'])(
    'requires a configured numeric server ID (%s)',
    async (value) => {
      vi.stubEnv('DISCORD_GUILD_ID', value);
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      expect(authConfigured()).toBe(false);
      await expect(discordIdentity(callback(), 'expected', 'a'.repeat(43))).rejects.toMatchObject({
        status: 503,
      });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe('membership-bound application sessions', () => {
  it('binds each session to its checked server; a different configured server or disabled account denies access', () => {
    const repo = new Repository(':memory:');
    try {
      const user = repo.user(userId, 'Łucja');
      const token = repo.createSession(user, guild);
      expect(discordSessionAllowed(repo.session(token))).toBe(true);
      vi.stubEnv('DISCORD_GUILD_ID', '200000000000000002');
      expect(discordSessionAllowed(repo.session(token))).toBe(false);
      vi.stubEnv('DISCORD_GUILD_ID', guild);
      repo.db.prepare('UPDATE users SET enabled=0 WHERE id=?').run(user.id);
      expect(discordSessionAllowed(repo.session(token))).toBe(false);
    } finally {
      repo.db.close();
    }
  });
  it('migrates the old session table without trusting prior allowlist sessions or losing characters', () => {
    const dir = mkdtempSync(join(tmpdir(), 'exilium-auth-migration-'));
    const path = join(dir, 'old.sqlite');
    const old = new Repository(path);
    const user = old.user(userId, 'Łucja');
    const character = old.create(user.id, 'Mara');
    old.db.exec(
      'DROP TABLE auth_sessions; DELETE FROM schema_migrations WHERE version=3; CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);',
    );
    old.db
      .prepare('INSERT INTO auth_sessions VALUES(?,?,?)')
      .run(
        createHash('sha256').update('legacy-session').digest('hex'),
        user.id,
        Date.now() + 86400_000,
      );
    old.db.close();
    try {
      for (let pass = 0; pass < 2; pass++) {
        const upgraded = new Repository(path);
        try {
          expect(upgraded.session('legacy-session')?.guildId).toBe('');
          expect(discordSessionAllowed(upgraded.session('legacy-session'))).toBe(false);
          expect(upgraded.get(user.id, character.id).document.name).toBe('Mara');
          expect(upgraded.db.prepare('SELECT MAX(version) v FROM schema_migrations').get()?.v).toBe(
            6,
          );
        } finally {
          upgraded.db.close();
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
