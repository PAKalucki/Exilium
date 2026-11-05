import { expect, type Page, type APIRequestContext } from '@playwright/test';
import type { Role } from '../../src/lib/access';
export const origin = 'http://127.0.0.1:5174';
export async function adminLogin(page: Page) {
  await page.request.post('/auth/dev', { form: { player: 'admin' }, headers: { Origin: origin } });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Archiwum postaci' })).toBeVisible();
}
export async function promote(admin: Page, target: APIRequestContext, role: Role) {
  const { user } = await (await target.get('/api/me')).json();
  const response = await admin.request.post(`/api/users/${user.id}`, {
    headers: { Origin: origin },
    data: { role, enabled: true, expectedRole: user.role, expectedEnabled: true },
  });
  expect(response.status()).toBe(200);
}

export async function resetPlayers(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext({ baseURL: origin }),
    admin = await context.newPage();
  await adminLogin(admin);
  for (const name of ['a', 'b']) {
    const player = await browser.newContext({ baseURL: origin });
    await player.request.post('/auth/dev', { form: { player: name }, headers: { Origin: origin } });
    await promote(admin, player.request, 'player');
    await player.close();
  }
  await context.close();
}
