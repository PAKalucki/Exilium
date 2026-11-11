import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import type { EquipmentRecord } from '../../src/lib/compendium';
import { test, expect } from '@playwright/test';
import { newItem } from '../../src/lib/rules/model';
import { sample } from '../fixtures';
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

test('independent privacy covers page data, API, print, and PDF; admins reveal and GMs always see', async ({
  page,
  browser,
}, info) => {
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
  doc.build.skills['knowledge:Sekretna wiedza 861'] = 10;
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
  await sheet.getByLabel('Ukryj statystyki', { exact: true }).check();
  await expect(sheet.locator('.save-status')).toHaveText('Zapisano');
  const statsOnly = await (await other.request.get(`/api/characters/${created.id}`)).json();
  expect(statsOnly.redacted).toEqual(['statistics']);
  expect(statsOnly.document.background).toBe(doc.background);
  expect(statsOnly.document.origin).toBe(doc.origin);
  expect(statsOnly.document.inventory).toEqual(doc.inventory);
  expect(statsOnly.document.build.skills).toEqual({});
  await sheet.getByLabel('Ukryj statystyki', { exact: true }).uncheck();
  await expect(sheet.locator('.save-status')).toHaveText('Zapisano');
  await sheet.getByLabel('Ukryj historię', { exact: true }).check();
  await sheet.getByLabel('Ukryj pochodzenie', { exact: true }).check();
  await sheet.getByLabel('Ukryj ekwipunek i zasoby', { exact: true }).check();
  await expect(sheet.locator('.save-status')).toHaveText('Zapisano');
  const publicStats = await (await other.request.get(`/api/characters/${created.id}`)).json();
  expect(publicStats.document.build.skills).toEqual(doc.build.skills);
  expect(publicStats.visibleStats).toBeDefined();
  await sheet.getByLabel('Ukryj statystyki', { exact: true }).check();
  await expect(sheet.locator('.save-status')).toHaveText('Zapisano');
  await sheet.reload();
  await sheet.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  for (const label of [
    'Ukryj statystyki',
    'Ukryj historię',
    'Ukryj pochodzenie',
    'Ukryj ekwipunek i zasoby',
  ])
    await expect(sheet.getByLabel(label, { exact: true })).toBeChecked();
  await sheet.screenshot({ path: info.outputPath('privacy-settings.png'), fullPage: true });
  await sheet.setViewportSize({ width: 390, height: 1000 });
  expect(await sheet.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await sheet.screenshot({ path: info.outputPath('privacy-settings-mobile.png'), fullPage: true });
  await sheet.setViewportSize({ width: 1440, height: 1000 });
  const response = await other.request.get(`/api/characters/${created.id}`);
  expect(await response.text()).not.toMatch(/861/);
  expect(await (await other.request.get('/api/characters')).text()).not.toMatch(/861/);
  expect(await (await other.request.get('/')).text()).not.toMatch(/861/);
  expect(
    await (await other.request.get(`/api/characters/${created.id}?revealPrivate=1`)).text(),
  ).not.toMatch(/861/);
  const viewer = await other.newPage();
  await viewer.goto(`/characters/${created.id}`);
  await expect(viewer.getByRole('note', { name: 'Historia: ukryte' })).toBeVisible();
  await expect(viewer.getByRole('note', { name: 'Pochodzenie: ukryte' })).toBeVisible();
  await expect(viewer.getByRole('note', { name: 'Ekwipunek: ukryte' })).toBeVisible();
  await expect(viewer.getByRole('note', { name: 'Statystyki: ukryte' })).toBeVisible();
  await expect(viewer.locator('.stat-tile, .die-badge, .rank-pill')).toHaveCount(0);
  await expect(
    viewer.getByRole('link', { name: 'Odkryj prywatne szczegóły', exact: true }),
  ).toHaveCount(0);
  expect(await viewer.content()).not.toMatch(/861/);
  const printed = await other.request.get(`/characters/${created.id}/print`);
  expect(await printed.text()).not.toMatch(/861/);
  const pdf = await other.request.get(`/api/characters/${created.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  const pdfPath = info.outputPath('private-sheet.pdf');
  writeFileSync(pdfPath, await pdf.body());
  const privatePdfText = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
  expect(privatePdfText).not.toMatch(/861/);
  expect(privatePdfText).toContain('Statystyki ukryte');
  expect(privatePdfText).not.toContain('Obrona:');

  // An administrator sees the same projection until explicitly revealing this sheet.
  for (const path of [
    `/api/characters/${created.id}`,
    '/api/characters',
    '/',
    `/characters/${created.id}`,
    `/characters/${created.id}/print`,
  ])
    expect(await (await page.request.get(path)).text()).not.toMatch(/861/);
  const adminPdf = await page.request.get(`/api/characters/${created.id}/pdf`);
  writeFileSync(pdfPath, await adminPdf.body());
  expect(execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' })).not.toMatch(/861/);
  const currentPrivate = await (await owner.request.get(`/api/characters/${created.id}`)).json();
  const change = {
    revision: currentPrivate.revision,
    commandId: crypto.randomUUID(),
    command: { type: 'tracker', field: 'bennies', delta: 1 },
  };
  expect(
    (
      await page.request.post(`/api/characters/${created.id}`, {
        headers: { Origin: origin },
        data: change,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`/api/characters/${created.id}/duplicate`, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`/api/characters/${created.id}/portrait`, {
        headers: { Origin: origin },
        data: 'not an image',
      })
    ).status(),
  ).toBe(403);
  await page.goto(`/characters/${created.id}`);
  await expect(page.getByRole('note', { name: 'Statystyki: ukryte' })).toBeVisible();
  await expect(page.locator('.sheet-tabs')).toHaveCount(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`admin-private-${width}.png`), fullPage: true });
  }
  await page.getByRole('link', { name: 'Odkryj prywatne szczegóły', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Ukryj prywatne szczegóły', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.sheet-tabs')).toBeVisible();
  await page.getByRole('button', { name: 'Karta postaci', exact: true }).click();
  await expect(page.locator('.skill-list')).toContainText('Sekretna wiedza 861');
  expect(
    await (await page.request.get(`/api/characters/${created.id}?revealPrivate=1`)).text(),
  ).toContain('Sekretna wiedza 861');
  await expect(page.getByRole('link', { name: 'Drukuj / PDF', exact: false })).toHaveAttribute(
    'href',
    `/characters/${created.id}/print?revealPrivate=1`,
  );
  const revealedPrint = await page.request.get(`/characters/${created.id}/print?revealPrivate=1`);
  expect(await revealedPrint.text()).toContain('Tajne Laboratorium 861');
  expect(
    (
      await page.request.post(`/api/characters/${created.id}?revealPrivate=1`, {
        headers: { Origin: origin },
        data: change,
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Ukryj prywatne szczegóły', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ukryj prywatne szczegóły', exact: true }).click();
  await expect(page.getByRole('note', { name: 'Statystyki: ukryte' })).toBeVisible();
  expect(await page.content()).not.toMatch(/861/);
  expect(await (await page.request.get(`/api/characters/${created.id}`)).text()).not.toMatch(/861/);
  const unchanged = await (await owner.request.get(`/api/characters/${created.id}`)).json();
  expect(unchanged.document.privacy).toEqual({
    statistics: true,
    origin: true,
    background: true,
    equipment: true,
  });
  await promote(page, other.request, 'gm');
  expect(await (await other.request.get(`/api/characters/${created.id}`)).text()).toContain(
    'Tajne Laboratorium 861',
  );
  await viewer.getByRole('button', { name: 'Odśwież kartę', exact: true }).click();
  await expect(
    viewer.getByRole('link', { name: 'Odkryj prywatne szczegóły', exact: true }),
  ).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Karta postaci', exact: true }).click();
  await expect(viewer.locator('.skill-list')).toContainText('Sekretna wiedza 861');
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

test('hiding statistics on an active sheet redacts the admin save response and refreshes into the private view', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const owner = await browser.newContext({ baseURL: origin });
  await owner.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  await promote(page, owner.request, 'player');
  let record = await (
    await owner.request.post('/api/characters', {
      headers: { Origin: origin },
      data: { name: 'Aktywna karta prywatna' },
    })
  ).json();
  const doc = sample();
  doc.name = record.document.name;
  doc.background = 'Jawna historia aktywnej postaci';
  delete doc.build.skills.repair;
  doc.build.skills['knowledge:Tajemna wiedza aktywna'] = 6;
  for (const command of [{ type: 'saveDraft', document: doc }, { type: 'finalize' }]) {
    const response = await owner.request.post(`/api/characters/${record.id}`, {
      headers: { Origin: origin },
      data: { revision: record.revision, commandId: crypto.randomUUID(), command },
    });
    expect(response.status()).toBe(200);
    record = await response.json();
  }
  await page.goto(`/characters/${record.id}`);
  await expect(page.locator('.rank-pill')).toBeVisible();
  await page.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  const saving = page.waitForResponse(
    (response) =>
      response.url() === `${origin}/api/characters/${record.id}` &&
      response.request().method() === 'POST',
  );
  await page.getByLabel('Ukryj statystyki', { exact: true }).check();
  const saved = await saving;
  expect(saved.status()).toBe(200);
  expect(await saved.text()).not.toContain('Tajemna wiedza aktywna');
  await expect(page.getByRole('note', { name: 'Statystyki: ukryte' })).toBeVisible();
  await expect(page.locator('.rank-pill, .stat-tile, .sheet-tabs')).toHaveCount(0);
  await expect(page.getByText(doc.background, { exact: true })).toBeVisible();
  await page.goto('/');
  const card = page.locator(`a.character-card[href="/characters/${record.id}"]`);
  await expect(card).toContainText('Statystyki ukryte');
  await expect(card.locator('.card-stats b')).toHaveCount(0);
  await expect(card).not.toContainText(' PD');
  const source = await (await owner.request.get(`/api/characters/${record.id}`)).json();
  expect(source.document.build).toEqual(doc.build);
  expect(source.document.privacy).toEqual({
    statistics: true,
    background: false,
    origin: false,
    equipment: false,
  });
  await owner.close();
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
