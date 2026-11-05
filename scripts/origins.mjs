// Shared by the production HTTP entry point and the bundled application.
export function configuredOrigins(env = process.env) {
  const origin = env.APP_ORIGIN || 'http://localhost:5173';
  const origins = [
    ...new Set([
      origin,
      ...(env.APP_ADDITIONAL_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ]),
  ];
  const hosts = new Map();
  for (const value of origins) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value)
      throw new Error(
        'App origins must be normalized HTTP(S) origins without paths or trailing slashes',
      );
    if (hosts.has(url.host)) throw new Error('Each app origin must have a distinct host and port');
    hosts.set(url.host, value);
  }
  return { origin, origins, hosts };
}
