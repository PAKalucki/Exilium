import { configuredOrigins } from '../../../scripts/origins.mjs';

try {
  process.loadEnvFile('.env');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}

export function config() {
  const { origin, origins } = configuredOrigins();
  return {
    origin,
    origins,
    databasePath: process.env.DATABASE_PATH || './data/exilium.sqlite',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    guildId: (process.env.DISCORD_GUILD_ID || '').trim(),
    devLogin: process.env.DEV_LOGIN_ENABLED === 'true',
  };
}
export function requestOrigin(url: URL): string {
  if (!config().origins.includes(url.origin)) throw new Error('Unconfigured app origin');
  return url.origin;
}
export function authConfigured() {
  const c = config();
  return !!(c.clientId && c.clientSecret && /^\d{10,25}$/.test(c.guildId));
}
