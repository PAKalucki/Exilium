import { describe, expect, it } from 'vitest';
import { configuredOrigins } from '../scripts/origins.mjs';

describe('explicit HTTP and HTTPS deployment origins', () => {
  it('maps each configured host and port to exactly one declared scheme', () => {
    const c = configuredOrigins({
      APP_ORIGIN: 'https://exilium.test',
      APP_ADDITIONAL_ORIGINS: 'http://192.0.2.10:5173, http://192.0.2.10:5173',
    });
    expect(c.origins).toEqual(['https://exilium.test', 'http://192.0.2.10:5173']);
    expect(c.hosts.get('exilium.test')).toBe('https://exilium.test');
    expect(c.hosts.get('192.0.2.10:5173')).toBe('http://192.0.2.10:5173');
    expect(c.hosts.get('evil.test')).toBeUndefined();
  });
  it.each([
    'file:///tmp/app',
    'https://app.test/',
    'https://app.test/path',
    'https://u:p@app.test',
    'https://app.test?origin=other',
    'https://app.test#x',
    'null',
  ])('rejects an invalid origin: %s', (origin) => {
    expect(() => configuredOrigins({ APP_ORIGIN: origin })).toThrow();
  });
  it('rejects different schemes that cannot be distinguished by their Host header', () => {
    expect(() =>
      configuredOrigins({
        APP_ORIGIN: 'https://app.test',
        APP_ADDITIONAL_ORIGINS: 'http://app.test',
      }),
    ).toThrow('distinct host');
  });
});
