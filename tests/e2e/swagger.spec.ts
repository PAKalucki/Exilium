import { test, expect } from '@playwright/test';
import { origin, releaseVersion } from './helpers';
test('self-hosted Swagger renders authenticated OpenAPI and Try it out uses only an explicit bearer token', async ({
  page,
  browser,
}) => {
  const anonymous = await browser.newContext({ baseURL: origin });
  expect((await anonymous.request.get('/api/openapi.json')).status()).toBe(401);
  expect((await anonymous.request.get('/api-docs/ui')).status()).toBe(401);
  await anonymous.close();
  await page.request.post('/auth/dev', { headers: { Origin: origin }, form: { player: 'a' } });
  const minted = await page.request.post('/api/tokens', {
    headers: { Origin: origin },
    data: { name: 'Swagger test', scopes: ['read'], days: 1 },
  });
  expect(minted.status()).toBe(201);
  const token = await minted.json();
  const reads = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Authorization: `Bearer ${token.token}` },
  });
  const spec = await (await reads.request.get('/api/openapi.json')).json();
  expect(spec.info.version).toBe(releaseVersion);
  expect(spec.paths['/api/compendium'].post).toBeDefined();
  const external: string[] = [];
  page.on('request', (r) => {
    if (r.url().startsWith('http') && new URL(r.url()).origin !== origin)
      external.push(new URL(r.url()).origin);
  });
  await page.goto('/api-docs');
  const frame = page.frameLocator('iframe[title="Swagger UI API Exilium"]');
  await expect(frame.locator('.info .title')).toContainText('Exilium API');
  const me = frame.locator('.opblock').filter({ has: frame.locator('[data-path="/api/me"]') });
  await me.locator('.opblock-summary-control').click();
  await me.getByRole('button', { name: 'Try it out', exact: true }).click();
  const unauth = page.waitForResponse(
    (r) => r.url() === origin + '/api/me' && r.request().method() === 'GET',
  );
  await me.getByRole('button', { name: 'Execute', exact: true }).click();
  expect((await unauth).status()).toBe(401);
  await frame
    .locator('.scheme-container')
    .getByRole('button', { name: 'Authorize', exact: false })
    .click();
  await frame.locator('.auth-container input').fill(token.token);
  await frame
    .locator('.auth-btn-wrapper')
    .getByRole('button', { name: 'Apply credentials', exact: true })
    .click();
  await frame
    .locator('.auth-btn-wrapper')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  const authorized = page.waitForResponse(
    (r) => r.url() === origin + '/api/me' && r.request().method() === 'GET',
  );
  await me.getByRole('button', { name: 'Execute', exact: true }).click();
  const result = await authorized;
  expect(result.status()).toBe(200);
  const headers = await result.request().allHeaders();
  expect(headers.authorization).toBe(`Bearer ${token.token}`);
  expect(headers.cookie).toBeUndefined();
  await page.reload();
  await expect(frame.locator('.info .title')).toContainText('Exilium API');
  expect(await frame.locator('.scheme-container .authorize').getAttribute('class')).toContain(
    'unlocked',
  );
  expect(external).toEqual([]);
  await page.request.delete(`/api/tokens/${token.id}`, { headers: { Origin: origin } });
  await reads.close();
});
