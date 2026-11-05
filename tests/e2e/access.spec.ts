import type { EquipmentRecord } from '../../src/lib/compendium';
import { test, expect } from '@playwright/test';
import { newItem } from '../../src/lib/rules/model';
import { adminLogin, promote, origin, resetPlayers, releaseVersion } from './helpers';

test('admin panel assigns roles, GM moderates player items, and player cannot approve or manage users', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const player = await browser.newContext({ baseURL: origin }),
    gm = await browser.newContext({ baseURL: origin });
  await player.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  await gm.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await promote(page, player.request, 'player');
  await promote(page, gm.request, 'player');
  await page.goto('/users');
  const row = page.getByRole('region', { name: 'Użytkownik Gracz B · lokalnie' });
  page.once('dialog', (d) => d.accept());
  await row.getByLabel('Rola użytkownika').selectOption('gm');
  await expect(page.getByRole('status')).toHaveText('Zapisano uprawnienia użytkownika.');
  expect((await (await gm.request.get('/api/me')).json()).user.role).toBe('gm');
  expect((await gm.request.get('/api/users')).status()).toBe(403);
  expect((await player.request.get('/api/users')).status()).toBe(403);
  const editor = await player.newPage();
  await editor.goto('/compendium');
  await editor.getByRole('button', { name: 'Dodaj wpis', exact: false }).click();
  await editor.getByLabel('Kategoria', { exact: true }).fill('Narzędzia');
  await editor.getByLabel('Źródło / ustalenie').fill('Gracz — Exilium');
  await editor.getByLabel('Nazwa', { exact: true }).fill('Wiertarka do moderacji');
  await editor.getByRole('button', { name: 'Zapisz wpis kompendium', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('czeka na zatwierdzenie');
  await editor.getByLabel('Szukaj w kompendium').fill('Wiertarka do moderacji');
  await expect(editor.locator('.catalog-card')).toContainText('Czeka na zatwierdzenie');
  const pending = (await (await player.request.get('/api/compendium?archived=1')).json()).find(
    (r: EquipmentRecord) => r.document.item.name === 'Wiertarka do moderacji',
  );
  expect(
    (await (await player.request.get('/api/compendium')).json()).some(
      (r: EquipmentRecord) => r.id === pending.id,
    ),
  ).toBe(false);
  expect(
    (
      await player.request.post(`/api/compendium/${pending.id}`, {
        headers: { Origin: origin },
        data: {
          revision: pending.revision,
          commandId: crypto.randomUUID(),
          command: { type: 'approve' },
        },
      })
    ).status(),
  ).toBe(403);
  const moderator = await gm.newPage();
  await moderator.goto('/compendium');
  await moderator.getByLabel('Widok kompendium').selectOption('pending');
  await moderator.getByLabel('Szukaj w kompendium').fill('Wiertarka do moderacji');
  await moderator
    .locator('.catalog-card')
    .getByRole('button', { name: 'Zatwierdź', exact: true })
    .click();
  await expect(moderator.getByRole('status')).toHaveText('Zapisano zmianę kompendium.');
  await editor.getByLabel('Widok kompendium').selectOption('active');
  await editor.getByRole('button', { name: 'Odśwież listę', exact: true }).click();
  await expect(editor.locator('.catalog-card')).toContainText('Wiertarka do moderacji');
  await expect(
    editor.locator('.catalog-card').getByRole('button', { name: 'Edytuj', exact: true }),
  ).toHaveCount(0);
  await player.close();
  await gm.close();
});

test('privacy is enforced on page data, API, print, and PDF; GM can edit another player sheet', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const owner = await browser.newContext({ baseURL: origin }),
    other = await browser.newContext({ baseURL: origin });
  await owner.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  await other.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await promote(page, owner.request, 'player');
  await promote(page, other.request, 'player');
  const created = await (
    await owner.request.post('/api/characters', {
      headers: { Origin: origin },
      data: { name: 'Ukryta opowieść' },
    })
  ).json();
  const doc = created.document;
  doc.background = 'Tajne Laboratorium 861';
  doc.origin = 'Zatajona kolonia 861';
  doc.inventory = [{ ...newItem(), name: 'Sekretna broń 861', notes: 'Cenne właściwości 861' }];
  expect(
    (
      await owner.request.post(`/api/characters/${created.id}`, {
        headers: { Origin: origin },
        data: {
          revision: 1,
          commandId: crypto.randomUUID(),
          command: { type: 'saveDraft', document: doc },
        },
      })
    ).status(),
  ).toBe(200);
  const sheet = await owner.newPage();
  await sheet.goto(`/characters/${created.id}`);
  const privacyHeading = sheet.getByRole('heading', { name: 'Prywatność postaci', exact: true });
  await expect(privacyHeading).toHaveCount(0);
  for (const tab of [
    /^Karta postaci$/,
    /^Ekwipunek/,
    /^Rozwój/,
    /^Notatki$/,
    /^Decyzje MG$/,
    /^Historia$/,
    /^Kreator/,
  ]) {
    await sheet.locator('.sheet-tabs').getByRole('button', { name: tab }).click();
    await expect(privacyHeading).toHaveCount(0);
  }
  await sheet.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  await expect(privacyHeading).toBeVisible();
  await sheet.getByLabel('Ukryj historię', { exact: true }).check();
  await sheet.getByLabel('Ukryj pochodzenie', { exact: true }).check();
  await sheet.getByLabel('Ukryj ekwipunek i zasoby', { exact: true }).check();
  await expect(sheet.locator('.save-status')).toHaveText('Zapisano');
  const response = await other.request.get(`/api/characters/${created.id}`);
  expect(await response.text()).not.toMatch(/861/);
  expect(await (await other.request.get('/api/characters')).text()).not.toMatch(/861/);
  expect(await (await other.request.get('/')).text()).not.toMatch(/861/);
  const viewer = await other.newPage();
  await viewer.goto(`/characters/${created.id}`);
  await expect(viewer.getByRole('note', { name: 'Historia: ukryte' })).toBeVisible();
  await expect(viewer.getByRole('note', { name: 'Pochodzenie: ukryte' })).toBeVisible();
  await expect(viewer.getByRole('note', { name: 'Ekwipunek: ukryte' })).toBeVisible();
  expect(await viewer.content()).not.toMatch(/861/);
  const printed = await other.request.get(`/characters/${created.id}/print`);
  expect(await printed.text()).not.toMatch(/861/);
  const pdf = await other.request.get(`/api/characters/${created.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  await promote(page, other.request, 'gm');
  expect(await (await other.request.get(`/api/characters/${created.id}`)).text()).toContain(
    'Tajne Laboratorium 861',
  );
  await viewer.reload();
  await viewer.getByRole('button', { name: 'Karta postaci', exact: true }).click();
  await viewer.getByRole('button', { name: 'Dodaj Fuksa', exact: false }).count();
  const current = await (await other.request.get(`/api/characters/${created.id}`)).json();
  expect(
    (
      await other.request.post(`/api/characters/${created.id}`, {
        headers: { Origin: origin },
        data: {
          revision: current.revision,
          commandId: crypto.randomUUID(),
          command: { type: 'tracker', field: 'bennies', delta: 1 },
        },
      })
    ).status(),
  ).toBe(200);
  await owner.close();
  await other.close();
});

test('scoped tokens allow originless API use, respect roles and revocation, and cannot manage accounts or mutate sheets', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const user = await browser.newContext({ baseURL: origin });
  await user.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  await promote(page, user.request, 'player');
  const account = await user.newPage();
  await account.goto('/account');
  await account.getByLabel('Nazwa tokena', { exact: true }).fill('Automatyzacja');
  await account.getByLabel('Zapis kompendium', { exact: true }).check();
  await account.getByRole('button', { name: 'Utwórz token', exact: true }).click();
  const secret = await account.getByLabel('Nowy token API').inputValue();
  expect(secret).toMatch(/^exi_/);
  const client = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Authorization: `Bearer ${secret}` },
  });
  expect((await client.request.get('/api/characters')).status()).toBe(200);
  expect((await client.request.get('/api/users')).status()).toBe(403);
  expect(
    (await client.request.post('/api/characters', { data: { name: 'Niedozwolona' } })).status(),
  ).toBe(403);
  const pending = await client.request.post('/api/compendium', {
    data: {
      commandId: crypto.randomUUID(),
      document: {
        category: 'API',
        source: 'Test',
        item: { ...newItem(), name: 'Przedmiot z API' },
      },
    },
  });
  expect(pending.status()).toBe(201);
  expect((await pending.json()).approvalStatus).toBe('pending');
  expect(
    (
      await client.request.post('/api/compendium', {
        headers: { Origin: 'https://evil.invalid' },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await client.request.get('/api/tokens')).status()).toBe(403);
  const read = await (
    await user.request.post('/api/tokens', {
      headers: { Origin: origin },
      data: { name: 'Tylko odczyt', scopes: ['read'], days: 1 },
    })
  ).json();
  const readOnly = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Authorization: `Bearer ${read.token}` },
  });
  expect((await readOnly.request.post('/api/compendium', { data: {} })).status()).toBe(403);
  await user.request.delete(`/api/tokens/${read.id}`, { headers: { Origin: origin } });
  expect((await readOnly.request.get('/api/me')).status()).toBe(401);
  await promote(page, user.request, 'gm');
  expect((await (await client.request.get('/api/me')).json()).user.role).toBe('gm');
  expect((await client.request.get('/api/diagnostics')).status()).toBe(200);
  await promote(page, user.request, 'player');
  expect((await client.request.get('/api/diagnostics')).status()).toBe(403);
  await expect(page.locator('.app-version')).toHaveText(`v${releaseVersion}`);
  await user.close();
  await client.close();
  await readOnly.close();
});

test.afterEach(async ({ browser }) => {
  await resetPlayers(browser);
});
