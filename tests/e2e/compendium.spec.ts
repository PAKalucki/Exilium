import { test, expect, type Page } from '@playwright/test';
import { promote, adminLogin, resetPlayers } from './helpers';
import { newItem } from '../../src/lib/rules/model';
import { sample } from '../fixtures';
const origin = 'http://127.0.0.1:5174';

test('creator saves and restores two grenades from the catalog while guns remain individual', async ({
  page,
}) => {
  await adminLogin(page);
  const response = await page.request.post('/api/compendium', {
    headers: { Origin: origin },
    data: {
      commandId: crypto.randomUUID(),
      document: {
        category: 'Granaty',
        source: 'SW PL 2015, s. 61',
        item: {
          ...newItem(),
          name: 'Granat do testu ilości',
          kind: 'weapon',
          price: 75,
          damage: '3k6',
          range: '5/10/20',
        },
      },
    },
  });
  expect(response.status()).toBe(201);
  const entry = await response.json();
  const characterId = await draft(page, 'Dwa granaty');
  const current = await (await page.request.get(`/api/characters/${characterId}`)).json();
  expect(
    (
      await page.request.post(`/api/characters/${characterId}`, {
        headers: { Origin: origin },
        data: {
          revision: current.revision,
          commandId: crypto.randomUUID(),
          command: { type: 'saveDraft', document: { ...sample(), name: 'Dwa granaty' } },
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: /05Ekwipunek|05 Ekwipunek/ }).click();
  await page.getByRole('button', { name: 'Dodaj przedmiot', exact: false }).click();
  const choices = page.getByLabel('Przedmiot z kompendium');
  await choices.selectOption({ label: 'Glock (9mm) · 200 $' });
  const quantity = page.getByLabel('Liczba sztuk');
  await expect(quantity).toHaveAttribute('max', '1');
  await quantity.fill('2');
  expect(await quantity.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(
    true,
  );
  await choices.selectOption(entry.id);
  await expect(quantity).toHaveAttribute('max', '10000');
  await quantity.fill('2');
  await page.getByRole('button', { name: 'Zapisz przedmiot', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Zapisano');
  const saved = await (await page.request.get(`/api/characters/${characterId}`)).json();
  expect(saved.document.inventory).toHaveLength(1);
  expect(saved.document.inventory[0]).toMatchObject({ quantity: 2, price: 75, kind: 'weapon' });
  await page.reload();
  await page.getByRole('button', { name: /05Ekwipunek|05 Ekwipunek/ }).click();
  await expect(page.locator('.inventory-row')).toContainText('2 szt. · 150 $');
  expect(
    (
      await page.request.post(`/api/characters/${characterId}`, {
        headers: { Origin: origin },
        data: {
          revision: saved.revision,
          commandId: crypto.randomUUID(),
          command: { type: 'finalize' },
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await page.request.get(`/api/characters/${characterId}`)).json()).document.cash,
  ).toBe(250);
});
async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Wejdź do lokalnego podglądu' }).click();
  await expect(page.getByRole('heading', { name: 'Archiwum postaci' })).toBeVisible();
}
async function draft(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('Imię nowej postaci').fill(name);
  await page.getByRole('button', { name: 'Stwórz postać', exact: false }).click();
  await expect(page).toHaveURL(/\/characters\/[\w-]+$/);
  return page.url().split('/').pop()!;
}

test('ammunition controls are optional in editors and absent from melee, grenades and shared views', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const id = await draft(page, 'Wyposażenie bez pustych liczników');
  const current = await (await page.request.get(`/api/characters/${id}`)).json();
  const inventory = [
    { ...newItem(), name: 'Sztylet do testu', kind: 'weapon', damage: 'Si+k4' },
    { ...newItem(), name: 'Granat do testu', kind: 'weapon', damage: '3k6', quantity: 2 },
    { ...newItem(), name: 'Rewolwer do testu', kind: 'weapon', capacity: 6, loaded: 0, reserve: 6 },
    { ...newItem(), name: 'Plecak do testu' },
  ];
  expect(
    (
      await page.request.post(`/api/characters/${id}`, {
        headers: { Origin: origin },
        data: {
          revision: current.revision,
          commandId: crypto.randomUUID(),
          command: {
            type: 'saveDraft',
            document: { ...sample(), name: current.document.name, inventory },
          },
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: /^Ekwipunek/ }).click();
  const card = (name: string) =>
    page
      .locator('.inventory-detail')
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
  for (const name of ['Sztylet do testu', 'Granat do testu ×2', 'Plecak do testu'])
    await expect(card(name).locator('.ammo-controls')).toHaveCount(0);
  await expect(card('Rewolwer do testu').locator('.ammo-controls')).toContainText('0 / 6');
  await card('Sztylet do testu').getByRole('button', { name: 'Edytuj', exact: true }).click();
  await expect(page.getByLabel('Broń zużywa amunicję', { exact: true })).not.toBeChecked();
  for (const label of ['Pojemność magazynka', 'Załadowane naboje', 'Zapas amunicji / ogniw'])
    await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Anuluj', exact: true }).click();
  await card('Rewolwer do testu').getByRole('button', { name: 'Edytuj', exact: true }).click();
  const tracking = page.getByLabel('Broń zużywa amunicję', { exact: true });
  await expect(tracking).toBeChecked();
  page.once('dialog', (dialog) => dialog.dismiss());
  await tracking.click();
  await expect(tracking).toBeChecked();
  await expect(page.getByLabel('Zapas amunicji / ogniw')).toHaveValue('6');
  page.once('dialog', (dialog) => dialog.accept());
  await tracking.uncheck();
  await expect(page.getByLabel('Załadowane naboje')).toHaveCount(0);
  await page.getByRole('button', { name: 'Anuluj', exact: true }).click();
  await page.getByRole('button', { name: 'Dodaj przedmiot', exact: false }).click();
  await page.getByLabel('Nazwa', { exact: true }).fill('Pusta broń własna');
  await page
    .getByRole('combobox', { name: 'Rodzaj przedmiotu', exact: true })
    .selectOption('weapon');
  await expect(page.getByLabel('Załadowane naboje')).toHaveCount(0);
  await page.getByLabel('Broń zużywa amunicję', { exact: true }).check();
  await page.getByLabel('Pojemność magazynka').fill('');
  await expect(page.getByLabel('Pojemność magazynka')).toBeVisible({ timeout: 1000 });
  await expect(page.getByLabel('Pojemność magazynka')).toBeFocused();
  await page.getByLabel('Pojemność magazynka').fill('6');
  await page.getByRole('button', { name: 'Zapisz przedmiot', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Zapisano');
  await page.reload();
  await page.getByRole('button', { name: /^Ekwipunek/ }).click();
  await expect(card('Pusta broń własna').locator('.ammo-controls')).toContainText('0 / 6');
  const other = await browser.newContext({ baseURL: origin });
  await other.request.post('/auth/dev', { headers: { Origin: origin }, form: { player: 'a' } });
  await promote(page, other.request, 'player');
  const viewer = await other.newPage();
  await viewer.goto(`/characters/${id}`);
  const entry = (name: string) =>
    viewer
      .locator('.rule-entry')
      .filter({ has: viewer.getByRole('heading', { name, exact: true }) });
  for (const name of ['Sztylet do testu', 'Granat do testu ×2', 'Plecak do testu'])
    await expect(entry(name)).not.toContainText(/amunicj/i);
  await expect(entry('Rewolwer do testu')).toContainText('Amunicja: 0/6');
  await expect(viewer.getByRole('button', { name: 'Ustawienia', exact: true })).toHaveCount(0);
  await other.close();
});

test('GMs maintain the live compendium and the creator copies current values without changing existing equipment', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  await page.getByRole('link', { name: 'Kompendium', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kompendium ekwipunku' })).toBeVisible();
  await page.getByLabel('Szukaj w kompendium').fill('Glock');
  await expect(page.locator('.catalog-card')).toContainText('200 $');
  await page.getByRole('button', { name: 'Dodaj wpis', exact: false }).click();
  await page.getByLabel('Kategoria', { exact: true }).fill('Sprzęt medyczny');
  await page.getByLabel('Źródło / ustalenie').fill('Exilium — ustalenia graczy');
  await page.getByLabel('Nazwa', { exact: true }).fill('Apteczka podróżna');
  await page.getByLabel('Cena za sztukę ($)').fill('35');
  await page.getByLabel('Waga sztuki (jedn. SW)').fill('2');
  await page
    .getByLabel('Uwagi, źródło i właściwości')
    .fill('Zapas opatrunków. Bez dodatkowych premii mechanicznych.');
  await page.getByRole('button', { name: 'Zapisz wpis kompendium', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Zapisano zmianę kompendium.');
  await page.getByLabel('Szukaj w kompendium').fill('apteczka podrozna');
  await expect(page.locator('.catalog-card')).toContainText('35 $');
  const other = await browser.newContext({ baseURL: origin });
  await other.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await promote(page, other.request, 'gm');
  const editor = await other.newPage();
  await editor.goto('/compendium');
  await editor.getByLabel('Szukaj w kompendium').fill('Apteczka podróżna');
  await editor
    .locator('.catalog-card')
    .getByRole('button', { name: 'Edytuj', exact: true })
    .click();
  await editor.getByLabel('Cena za sztukę ($)').fill('50');
  await editor.getByRole('button', { name: 'Zapisz wpis kompendium', exact: true }).click();
  await expect(editor.getByRole('status')).toHaveText('Zapisano zmianę kompendium.');
  await editor
    .locator('.catalog-card')
    .getByRole('button', { name: 'Historia', exact: true })
    .click();
  await expect(editor.getByRole('region', { name: 'Historia wpisu kompendium' })).toContainText(
    'Gracz B',
  );
  const entries = await (await page.request.get('/api/compendium')).json();
  const entry = entries.find(
    (value: { document: { item: { name: string } } }) =>
      value.document.item.name === 'Apteczka podróżna',
  );
  expect(entry.document.item.price).toBe(50);
  const characterId = await draft(page, 'Podróżnik z apteczką');
  await page.getByRole('button', { name: /05Ekwipunek|05 Ekwipunek/ }).click();
  await page.getByRole('button', { name: 'Dodaj przedmiot', exact: false }).click();
  await page.getByLabel('Szukaj wyposażenia').fill('apteczka');
  await page.getByLabel('Przedmiot z kompendium').selectOption(entry.id);
  await expect(page.getByLabel('Nazwa', { exact: true })).toHaveValue('Apteczka podróżna');
  await expect(page.getByLabel('Cena za sztukę ($)')).toHaveValue('50');
  await page.getByRole('button', { name: 'Zapisz przedmiot', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Zapisano');
  await editor
    .locator('.catalog-card')
    .getByRole('button', { name: 'Edytuj', exact: true })
    .click();
  await editor.getByLabel('Cena za sztukę ($)').fill('90');
  await editor.getByRole('button', { name: 'Zapisz wpis kompendium', exact: true }).click();
  await expect(editor.getByRole('status')).toHaveText('Zapisano zmianę kompendium.');
  const character = await (await page.request.get(`/api/characters/${characterId}`)).json();
  expect(character.document.inventory[0]).toMatchObject({ name: 'Apteczka podróżna', price: 50 });
  await page.getByRole('button', { name: 'Dodaj przedmiot', exact: false }).click();
  await page.getByLabel('Szukaj wyposażenia').fill('apteczka');
  await page.getByLabel('Przedmiot z kompendium').selectOption(entry.id);
  await expect(page.getByLabel('Cena za sztukę ($)')).toHaveValue('90');
  editor.once('dialog', (dialog) => dialog.accept());
  await editor
    .locator('.catalog-card')
    .getByRole('button', { name: 'Archiwizuj', exact: true })
    .click();
  await expect(editor.locator('.catalog-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Odśwież kompendium', exact: true }).click();
  await expect(
    page.getByLabel('Przedmiot z kompendium').locator(`option[value="${entry.id}"]`),
  ).toHaveCount(0);
  await editor.getByLabel('Widok kompendium').selectOption('archived');
  await editor
    .locator('.catalog-card')
    .getByRole('button', { name: 'Przywróć', exact: true })
    .click();
  await expect(editor.locator('.catalog-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Odśwież kompendium', exact: true }).click();
  await expect(
    page.getByLabel('Przedmiot z kompendium').locator(`option[value="${entry.id}"]`),
  ).toHaveCount(1);
  await editor.setViewportSize({ width: 820, height: 1180 });
  await editor.getByLabel('Widok kompendium').selectOption('active');
  expect(await editor.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
    false,
  );
  await editor.screenshot({ path: 'test-results/exilium-compendium-tablet.png', fullPage: true });
  await other.close();
});

test('compendium rejects anonymous and cross-origin access and preserves edits after a stale revision', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const catalogDocument = {
    category: 'Narzędzia',
    source: 'Exilium test',
    item: { ...newItem(), name: 'Narzędzie do próby konfliktu', price: 20 },
  };
  const created = await page.request.post('/api/compendium', {
    headers: { Origin: origin },
    data: { commandId: crypto.randomUUID(), document: catalogDocument },
  });
  expect(created.status()).toBe(201);
  const record = await created.json();
  const anonymous = await browser.newContext({ baseURL: origin });
  expect((await anonymous.request.get('/api/compendium')).status()).toBe(401);
  expect((await anonymous.request.get(`/api/compendium/${record.id}`)).status()).toBe(401);
  expect(
    (
      await anonymous.request.post('/api/compendium', {
        headers: { Origin: origin },
        data: { commandId: crypto.randomUUID(), document: catalogDocument },
      })
    ).status(),
  ).toBe(401);
  const visitor = await anonymous.newPage();
  await visitor.goto('/compendium');
  await expect(visitor).toHaveURL(origin + '/');
  await anonymous.close();
  expect(
    (
      await page.request.post('/api/compendium', {
        headers: { Origin: 'https://untrusted.invalid' },
        data: { commandId: crypto.randomUUID(), document: catalogDocument },
      })
    ).status(),
  ).toBe(403);
  await page.goto('/compendium');
  await page.getByLabel('Szukaj w kompendium').fill(record.document.item.name);
  await page.locator('.catalog-card').getByRole('button', { name: 'Edytuj', exact: true }).click();
  await page.getByLabel('Cena za sztukę ($)').fill('60');
  const other = await browser.newContext({ baseURL: origin });
  await other.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await promote(page, other.request, 'gm');
  const updated = await other.request.post(`/api/compendium/${record.id}`, {
    headers: { Origin: origin },
    data: {
      revision: 1,
      commandId: crypto.randomUUID(),
      command: {
        type: 'update',
        document: { ...record.document, item: { ...record.document.item, price: 50 } },
      },
    },
  });
  expect(updated.status()).toBe(200);
  await page.getByRole('button', { name: 'Zapisz wpis kompendium', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('inny gracz');
  await expect(page.getByLabel('Cena za sztukę ($)')).toHaveValue('60');
  expect(
    (await (await page.request.get(`/api/compendium/${record.id}`)).json()).record.document.item
      .price,
  ).toBe(50);
  await page.getByRole('button', { name: 'Anuluj edycję', exact: true }).click();
  await page.getByRole('button', { name: 'Odśwież listę', exact: true }).click();
  await expect(page.locator('.catalog-card')).toContainText('50 $');
  await page.locator('.catalog-card').getByRole('button', { name: 'Edytuj', exact: true }).click();
  await page.getByLabel('Cena za sztukę ($)').fill('60');
  await page.getByRole('button', { name: 'Zapisz wpis kompendium', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Zapisano zmianę kompendium.');
  await other.close();
});

test('custom Knowledge fields can be renamed and removed with their die and point budget preserved', async ({
  page,
}) => {
  await login(page);
  const id = await draft(page, 'Własne dziedziny Wiedzy');
  await page.getByRole('button', { name: /04Umiejętności|04 Umiejętności/ }).click();
  await page.getByLabel('Dziedzina Wiedzy', { exact: true }).fill('Elektronika');
  await page.getByRole('button', { name: 'Dodaj Wiedzę', exact: true }).click();
  await page.getByRole('combobox', { name: 'Wiedza (Elektronika)', exact: true }).selectOption('8');
  await expect(page.locator('.budget-banner strong')).toContainText('5');
  await page.getByRole('button', { name: 'Zmień nazwę Wiedza (Elektronika)', exact: true }).click();
  await page.getByLabel('Nowa nazwa dziedziny Wiedzy').fill('Technika kolonialna');
  await page.getByRole('button', { name: 'Zapisz nazwę Wiedzy', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Wiedza (Technika kolonialna)', exact: true }),
  ).toHaveValue('8');
  await expect(page.locator('.save-status')).toHaveText('Zapisano');
  const saved = await (await page.request.get(`/api/characters/${id}`)).json();
  expect(saved.document.build.skills['knowledge:Technika kolonialna']).toBe(8);
  expect(saved.document.build.skills['knowledge:Elektronika']).toBeUndefined();
  await page.reload();
  await page.getByRole('button', { name: /04Umiejętności|04 Umiejętności/ }).click();
  await page.getByLabel('Dziedzina Wiedzy', { exact: true }).fill('Historia');
  await page.getByRole('button', { name: 'Dodaj Wiedzę', exact: true }).click();
  await page
    .getByRole('button', { name: 'Zmień nazwę Wiedza (Technika kolonialna)', exact: true })
    .click();
  await page.getByLabel('Nowa nazwa dziedziny Wiedzy').fill('historia');
  await page.getByRole('button', { name: 'Zapisz nazwę Wiedzy', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('już istnieje');
  await page.getByRole('button', { name: 'Anuluj zmianę nazwy', exact: true }).click();
  await page
    .getByRole('button', { name: 'Usuń Wiedza (Technika kolonialna)', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Wiedza (Technika kolonialna)', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Wiedza (Historia)', exact: true })).toHaveValue(
    '4',
  );
  await expect(page.locator('.save-status')).toHaveText('Zapisano');
  expect(
    (await (await page.request.get(`/api/characters/${id}`)).json()).document.build.skills,
  ).toEqual({ 'knowledge:Historia': 4 });
});

test.afterEach(async ({ browser }) => {
  await resetPlayers(browser);
});
