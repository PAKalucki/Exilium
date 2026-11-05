import { test, expect, type Page } from '@playwright/test';
import { portraitFixture } from '../image-fixture';
import { sample } from '../fixtures';
import { newItem } from '../../src/lib/rules/model';
const origin = 'http://127.0.0.1:5174';
async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Wejdź do lokalnego podglądu' }).click();
  await expect(page.getByRole('heading', { name: 'Archiwum postaci' })).toBeVisible();
}
async function create(page: Page, name: string) {
  await page.getByLabel('Imię nowej postaci').fill(name);
  await page.getByRole('button', { name: 'Stwórz postać', exact: false }).click();
  await expect(page).toHaveURL(/\/characters\/[\w-]+$/);
  await page.getByRole('button', { name: /02Cechy|02 Cechy/ }).click();
  for (const row of await page.locator('.attribute-row').all())
    await row.getByRole('button', { name: 'k6', exact: true }).click();
  await page.getByRole('button', { name: /03Zawady|03 Zawady/ }).click();
  await page.getByLabel('Wybierz przewagę').selectOption('alertness');
  await page.getByRole('button', { name: 'Dodaj', exact: true }).nth(1).click();
  await page.getByRole('button', { name: /04Umiejętności|04 Umiejętności/ }).click();
  for (const skill of [
    'Walka',
    'Strzelanie',
    'Spostrzegawczość',
    'Reperowanie',
    'Przetrwanie',
    'Leczenie',
    'Przekonywanie',
  ])
    await page.getByRole('combobox', { name: skill, exact: true }).selectOption('6');
  await page.getByRole('combobox', { name: 'Zastraszanie', exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Zatwierdź postać', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Trzymaj rękę na pulsie.' })).toBeVisible();
  return page.url().split('/').pop()!;
}
test('create, track, level up, persist, print and export a Polish character', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  const id = await create(page, 'Łucja Żelazna');
  await page.getByRole('button', { name: 'Zwiększ Rany', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await page.getByRole('button', { name: 'Rozwój', exact: false }).click();
  await page.getByLabel('Punkty PD', { exact: true }).fill('5');
  await page.getByLabel('Sesja / uzasadnienie').fill('Sesja 1 — Jericho');
  await page.getByRole('button', { name: 'Zapisz PD', exact: true }).click();
  await expect(page.locator('.accent-stat strong')).toHaveText('1');
  await page.getByLabel('Rodzaj rozwinięcia').selectOption('skill');
  await page.getByRole('button', { name: 'Potwierdź rozwinięcie', exact: false }).click();
  await expect(page.locator('.accent-stat strong')).toHaveText('0');
  await page.getByRole('button', { name: 'Karta postaci', exact: true }).click();
  await expect(
    page.locator('.skill-list>div').filter({ hasText: 'Walka' }).locator('strong'),
  ).toHaveText('k8');
  await page.getByRole('button', { name: 'Ekwipunek', exact: false }).click();
  await expect(page.locator('.resource').first().locator('strong')).toHaveText(/400\s*\$/);
  await page.getByRole('button', { name: 'Dodaj przedmiot', exact: false }).click();
  await page.getByLabel('Nazwa', { exact: true }).fill('Rewolwer z Jericho');
  await page
    .getByRole('combobox', { name: 'Rodzaj przedmiotu', exact: true })
    .selectOption('weapon');
  await page.getByLabel('Pojemność magazynka').fill('6');
  await page.getByLabel('Załadowane naboje').fill('2');
  await page.getByLabel('Zapas amunicji / ogniw').fill('10');
  await page.getByRole('button', { name: 'Zapisz przedmiot' }).click();
  await page.getByRole('button', { name: 'Przeładuj', exact: true }).click();
  await expect(page.locator('.ammo-controls')).toContainText('6 / 6');
  await expect(page.locator('.ammo-controls')).toContainText(/ZAPAS\s*6/);
  await page.getByRole('button', { name: 'Zużyj 1 nabój' }).click();
  await expect(page.locator('.ammo-controls')).toContainText('5 / 6');
  await page.reload();
  await page.getByRole('button', { name: 'Rozwój', exact: false }).click();
  await expect(page.locator('.development-stats strong').first()).toHaveText(/5\s*PD/);
  await expect(page.locator('.advancement-row')).toContainText('Walka');
  const pdf = await page.request.get(`/api/characters/${id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  const print = await page.context().newPage();
  await print.goto(`/characters/${id}/print`);
  await expect(print.locator('.print-sheet h1')).toHaveText('Łucja Żelazna');
  await expect(print.locator('.print-sheet')).toContainText('Rewolwer z Jericho');
  await print.close();
  await page.getByRole('button', { name: 'Karta postaci', exact: true }).click();
  await page.screenshot({ path: 'test-results/exilium-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.screenshot({ path: 'test-results/exilium-tablet.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  expect(errors).toEqual([]);
});
test('signed-in players can read all sheets and exports, while only creators can mutate them', async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByLabel('Imię nowej postaci').fill('Wspólny szkic');
  await page.getByRole('button', { name: 'Stwórz postać', exact: false }).click();
  await expect(page).toHaveURL(/\/characters\/[\w-]+$/);
  const id = page.url().split('/').pop()!;
  const send = async (command: unknown) => {
    const current = await (await page.request.get(`/api/characters/${id}`)).json();
    const response = await page.request.post(`/api/characters/${id}`, {
      headers: { Origin: origin },
      data: { revision: current.revision, commandId: crypto.randomUUID(), command },
    });
    expect(response.status()).toBe(200);
  };
  const draft = {
    ...sample(),
    name: 'Wspólny szkic',
    notes: 'Znaki na szlaku do Jericho.',
    appearance: 'Połatany płaszcz podróżny.',
  };
  draft.inventory.push({ ...newItem(), name: 'Mapa karawanowa', price: 10 });
  await send({ type: 'saveDraft', document: draft });
  const other = await browser.newContext({ baseURL: origin });
  await other.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  for (const path of [
    `/api/characters/${id}`,
    `/api/characters/${id}/pdf`,
    `/characters/${id}/print`,
    `/characters/${id}`,
  ])
    expect((await other.request.get(path)).status()).toBe(200);
  const reader = await other.newPage();
  await reader.goto('/');
  const card = reader.locator('.character-card').filter({ hasText: 'Wspólny szkic' });
  await expect(card).toContainText('Twórca: Gracz A');
  await expect(card).toContainText('Tylko do odczytu');
  await card.click();
  await expect(reader.getByRole('status')).toHaveText('Tylko do odczytu');
  await expect(reader.locator('.read-only-sheet')).toContainText('Znaki na szlaku do Jericho.');
  await expect(reader.locator('.read-only-sheet')).toContainText('Mapa karawanowa');
  await expect(reader.locator('.read-only-sheet')).toContainText('Połatany płaszcz podróżny.');
  await expect(
    reader.locator('.character-page input, .character-page select, .character-page textarea'),
  ).toHaveCount(0);
  await expect(
    reader.getByRole('button', {
      name: /Zatwierdź postać|Zwiększ Rany|Zapisz PD|Cofnij ostatnią zmianę|Przywróć postać/,
    }),
  ).toHaveCount(0);
  await reader.getByRole('button', { name: 'Pomoc: Cechy a umiejętności', exact: true }).click();
  await expect(
    reader.getByRole('dialog', { name: 'Cechy a umiejętności', exact: true }),
  ).toBeVisible();
  await reader.keyboard.press('Escape');
  const baseline = await (await other.request.get(`/api/characters/${id}`)).json();
  for (const command of [
    { type: 'tracker', field: 'bennies', delta: -1 },
    { type: 'saveDraft', document: { ...draft, name: 'Cudza zmiana' } },
    { type: 'archive' },
    { type: 'undo' },
    { type: 'removePortrait' },
    { type: 'xp', amount: 5, note: 'Cudza sesja' },
  ])
    expect(
      (
        await other.request.post(`/api/characters/${id}`, {
          headers: { Origin: origin },
          data: { revision: baseline.revision, commandId: crypto.randomUUID(), command },
        })
      ).status(),
    ).toBe(404);
  expect(
    (
      await other.request.post(`/api/characters/${id}/duplicate`, { headers: { Origin: origin } })
    ).status(),
  ).toBe(404);
  expect(await (await other.request.get(`/api/characters/${id}`)).json()).toEqual(baseline);
  await send({ type: 'finalize' });
  await send({ type: 'xp', amount: 5, note: 'Pierwsza wspólna sesja' });
  await send({
    type: 'advance',
    choice: {
      kind: 'skill',
      target: 'fighting',
      second: '',
      edgeTarget: '',
      note: 'Trening na pustkowiu',
    },
  });
  await reader.getByRole('button', { name: 'Odśwież kartę' }).click();
  await expect(reader.locator('.read-only-sheet')).toContainText('Pierwsza wspólna sesja');
  await expect(reader.locator('.read-only-sheet')).toContainText('Trening na pustkowiu');
  await expect(reader.locator('.skill-list').filter({ hasText: 'Walka' })).toContainText('k8');
  await expect(reader.locator('.read-only-sheet .history-row')).toHaveCount(4);
  await reader.setViewportSize({ width: 820, height: 1180 });
  expect(
    await reader.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);
  await reader.screenshot({ path: 'test-results/exilium-shared-sheet-tablet.png', fullPage: true });
  const cross = await page.request.post(`/api/characters/${id}`, {
    headers: { Origin: 'https://untrusted.example' },
    data: {
      revision: 1,
      commandId: crypto.randomUUID(),
      command: { type: 'tracker', field: 'bennies', delta: -1 },
    },
  });
  expect(cross.status()).toBe(403);
  await send({ type: 'archive' });
  await reader.goto('/');
  await reader.getByRole('button', { name: 'Archiwum', exact: true }).click();
  await expect(
    reader.locator('.character-card').filter({ hasText: 'Wspólny szkic' }),
  ).toBeVisible();
  await reader.locator('.character-card').filter({ hasText: 'Wspólny szkic' }).click();
  await expect(reader.getByText('Ta postać jest w archiwum.', { exact: false })).toBeVisible();
  await expect(reader.getByRole('button', { name: 'Przywróć postać' })).toHaveCount(0);
  const anonymous = await browser.newContext({ baseURL: origin });
  for (const suffix of ['', '/pdf', '/portrait'])
    expect((await anonymous.request.get(`/api/characters/${id}${suffix}`)).status()).toBe(401);
  const visitor = await anonymous.newPage();
  await visitor.goto(`/characters/${id}`);
  await expect(visitor).toHaveURL(origin + '/');
  await expect(visitor.locator('.character-card')).toHaveCount(0);
  await visitor.goto(`/characters/${id}/print`);
  await expect(visitor).toHaveURL(origin + '/');
  await anonymous.close();
  await other.close();
});
test('unsaved text survives a lost connection and is saved when connection returns', async ({
  page,
  context,
}) => {
  await login(page);
  await create(page, 'Wędrowiec');
  await page.getByRole('button', { name: 'Notatki', exact: true }).click();
  await page.getByLabel('Notatki z sesji').fill('Zapis podczas utraty połączenia.');
  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText('Brak połączenia');
  await page.waitForTimeout(900);
  await context.setOffline(false);
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await page.reload();
  await page.getByRole('button', { name: 'Notatki', exact: true }).click();
  await expect(page.getByLabel('Notatki z sesji')).toHaveValue('Zapis podczas utraty połączenia.');
});

test('background autosave preserves focus, caret and edits made while a response is delayed', async ({
  page,
}) => {
  await login(page);
  await page.getByLabel('Imię nowej postaci').fill('Próba pisania');
  await page.getByRole('button', { name: 'Stwórz postać', exact: false }).click();
  await expect(page).toHaveURL(/\/characters\/[\w-]+$/);
  const id = page.url().split('/').pop()!;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let intercepted = false;
  await page.route(`**/api/characters/${id}`, async (route) => {
    if (!intercepted && route.request().method() === 'POST') {
      intercepted = true;
      const response = await route.fetch();
      started();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  const name = page.getByLabel('Imię postaci', { exact: true });
  await name.fill('Maaad ');
  try {
    await requestStarted;
    await expect(name).toBeFocused();
    await expect(name).toBeEnabled();
    await name.pressSequentially('Mikelsen');
    await name.evaluate((element) => (element as HTMLInputElement).setSelectionRange(3, 3));
    await name.pressSequentially('a');
    release();
    await expect(page.getByRole('status')).toHaveText('Zapisano');
    await expect(name).toHaveValue('Maaaad Mikelsen');
    await expect(name).toBeFocused();
    expect(await name.evaluate((element) => (element as HTMLInputElement).selectionStart)).toBe(4);
    await expect
      .poll(
        async () => (await (await page.request.get(`/api/characters/${id}`)).json()).document.name,
      )
      .toBe('Maaaad Mikelsen');
    await name.fill('Maaad ');
    await expect(page.getByRole('status')).toHaveText('Zapisano');
    await expect(name).toHaveValue('Maaad ');
    await expect(name).toBeFocused();
    await name.pressSequentially('Mikelsen');
    await expect(page.getByRole('status')).toHaveText('Zapisano');
    await page.reload();
    await expect(page.getByLabel('Imię postaci', { exact: true })).toHaveValue('Maaad Mikelsen');
  } finally {
    release();
  }
});

test('session actions wait for background profile saves and the latest typed notes', async ({
  page,
}) => {
  await login(page);
  const id = await create(page, 'Notatki bez utraty tekstu');
  await page.getByRole('button', { name: 'Notatki', exact: true }).click();
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let intercepted = false;
  await page.route(`**/api/characters/${id}`, async (route) => {
    if (
      !intercepted &&
      route.request().method() === 'POST' &&
      route.request().postDataJSON()?.command?.type === 'profile'
    ) {
      intercepted = true;
      const response = await route.fetch();
      started();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  const notes = page.getByLabel('Notatki z sesji');
  await notes.fill('Droga przez ');
  try {
    await requestStarted;
    await expect(notes).toBeFocused();
    await notes.pressSequentially('pustkowia.');
    await page.getByRole('button', { name: 'Karta postaci', exact: true }).click();
    await page.getByRole('button', { name: 'Zwiększ Rany', exact: true }).click();
    release();
    await expect(page.getByRole('status')).toHaveText('Zapisano');
    await expect
      .poll(async () => {
        const record = await (await page.request.get(`/api/characters/${id}`)).json();
        return { notes: record.document.notes, wounds: record.document.conditions.wounds };
      })
      .toEqual({ notes: 'Droga przez pustkowia.', wounds: 1 });
  } finally {
    release();
  }
});

test('retrying a lost text-save response preserves newer typing and deduplicates the old save', async ({
  page,
}) => {
  await login(page);
  const id = await create(page, 'Notatki po ponowieniu');
  await page.getByRole('button', { name: 'Notatki', exact: true }).click();
  const before = await (await page.request.get(`/api/characters/${id}`)).json();
  let lost = false;
  await page.route(`**/api/characters/${id}`, async (route) => {
    if (
      !lost &&
      route.request().method() === 'POST' &&
      route.request().postDataJSON()?.command?.type === 'profile'
    ) {
      lost = true;
      await route.fetch();
      await route.abort('connectionfailed');
    } else await route.continue();
  });
  const notes = page.getByLabel('Notatki z sesji');
  await notes.fill('Pierwszy zapis.');
  await expect(page.getByRole('button', { name: 'Ponów działanie', exact: true })).toBeVisible();
  await notes.fill('Nowszy zapis z dalszą historią.');
  await page.getByRole('button', { name: 'Ponów działanie', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  const saved = await (await page.request.get(`/api/characters/${id}`)).json();
  expect(saved.document.notes).toBe('Nowszy zapis z dalszą historią.');
  expect(saved.revision).toBe(before.revision + 2);
  await expect(notes).toHaveValue('Nowszy zapis z dalszą historią.');
});

test('an automatic refresh cannot overwrite typing that starts while the read is delayed', async ({
  page,
}) => {
  await login(page);
  await page.getByLabel('Imię nowej postaci').fill('Szkic przed odświeżeniem');
  await page.getByRole('button', { name: 'Stwórz postać', exact: false }).click();
  await expect(page).toHaveURL(/\/characters\/[\w-]+$/);
  const id = page.url().split('/').pop()!;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let intercepted = false;
  await page.route(`**/api/characters/${id}`, async (route) => {
    if (!intercepted && route.request().method() === 'GET') {
      intercepted = true;
      const response = await route.fetch();
      started();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole('heading', { name: 'Szkic przed odświeżeniem', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  try {
    await requestStarted;
    const name = page.getByLabel('Imię postaci', { exact: true });
    await name.fill('Nowszy tekst podczas odświeżania');
    release();
    await expect(page.getByRole('status')).toHaveText('Zapisano');
    await expect(name).toHaveValue('Nowszy tekst podczas odświeżania');
    await expect(name).toBeFocused();
    await page.reload();
    await expect(page.getByLabel('Imię postaci', { exact: true })).toHaveValue(
      'Nowszy tekst podczas odświeżania',
    );
  } finally {
    release();
  }
});

test('legacy entry preserves spent advances and records a scoped GM exception during leveling', async ({
  page,
}) => {
  await login(page);
  await page.getByLabel('Imię nowej postaci').fill('Bohater z papierowej karty');
  await page.getByRole('button', { name: 'Stwórz postać', exact: false }).click();
  await page.getByText('Wpisuję istniejącą postać', { exact: true }).click();
  await page.getByLabel('Użyj istniejącej karty jako podstawy').check();
  await page.getByLabel('Obecne PD', { exact: true }).fill('20');
  await page.getByLabel('Historycznie wydane rozwinięcia').fill('4');
  await page.getByLabel('Cecha zwiększona na obecnej Randze').check();
  await page.getByRole('button', { name: 'Zatwierdź postać', exact: false }).click();
  await page.getByRole('button', { name: 'Rozwój', exact: false }).click();
  await expect(page.locator('.accent-stat strong')).toHaveText('0');
  await page.getByLabel('Punkty PD', { exact: true }).fill('5');
  await page.getByLabel('Sesja / uzasadnienie').fill('Kolejna sesja');
  await page.getByRole('button', { name: 'Zapisz PD', exact: true }).click();
  await expect(page.locator('.accent-stat strong')).toHaveText('1');
  await page.getByRole('combobox', { name: 'Przewaga', exact: true }).selectOption('brave');
  await page.getByRole('button', { name: 'Zapisz decyzję MG', exact: false }).click();
  await page.getByLabel('Ustalenie MG', { exact: true }).fill('MG dopuszcza Dzielnego z Duchem k4');
  await page.getByLabel('Uzasadnienie / kto ustalił').fill('Ustalenie naszej drużyny');
  await page.getByRole('button', { name: 'Zapisz decyzję', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await page.getByRole('button', { name: 'Rozwój', exact: false }).click();
  await page.getByRole('button', { name: 'Potwierdź rozwinięcie', exact: false }).click();
  await expect(page.locator('.accent-stat strong')).toHaveText('0');
  await expect(page.locator('.advancement-row')).toContainText('Dzielny');
});

test('a lost response can be retried without spending a Fuks twice', async ({ page }) => {
  await login(page);
  await create(page, 'Ostrożny podróżnik');
  let lost = false;
  await page.route('**/api/characters/*', async (route) => {
    if (
      !lost &&
      route.request().method() === 'POST' &&
      route.request().postDataJSON()?.command?.type === 'tracker'
    ) {
      lost = true;
      await route.fetch();
      await route.abort('connectionfailed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Wydaj fuksa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ponów działanie', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ponów działanie', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await expect(page.locator('.bennies-block .tracker-controls>strong')).toHaveText('2');
});

test('portraits are shared with signed-in readers and creation previews explain choices and GM wealth approval', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  await page.getByLabel('Imię nowej postaci').fill('Mara — portret');
  await page.getByRole('button', { name: 'Stwórz postać', exact: false }).click();
  await expect(page).toHaveURL(/\/characters\/[\w-]+$/);
  const id = page.url().split('/').pop()!;
  await page
    .getByLabel('Wygląd (opcjonalnie)')
    .fill('Krótko ścięte włosy, blizna na policzku i połatany płaszcz.');
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await page
    .getByLabel('Wgraj portret', { exact: true })
    .setInputFiles({ name: 'mara.png', mimeType: 'image/png', buffer: portraitFixture() });
  await expect(page.getByRole('img', { name: 'Portret postaci', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await page.reload();
  await expect(page.getByLabel('Wygląd (opcjonalnie)')).toHaveValue(/blizna/);
  await expect(page.getByRole('img', { name: 'Portret postaci', exact: true })).toBeVisible();
  const image = await page.request.get(`/api/characters/${id}/portrait`);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/jpeg');
  expect(image.headers()['cache-control']).toBe('private, no-cache');
  expect(image.headers()['vary']).toContain('Cookie');
  const etag = image.headers()['etag'];
  expect(etag).toBeTruthy();
  const cached = await page.request.get(`/api/characters/${id}/portrait`, {
    headers: { 'If-None-Match': etag },
  });
  expect(cached.status()).toBe(304);
  expect((await cached.body()).length).toBe(0);
  const anonymous = await browser.newContext({ baseURL: origin });
  expect(
    (
      await anonymous.request.get(`/api/characters/${id}/portrait`, {
        headers: { 'If-None-Match': etag },
      })
    ).status(),
  ).toBe(401);
  await anonymous.close();
  const before = await (await page.request.get(`/api/characters/${id}`)).json();
  const invalid = await page.request.post(`/api/characters/${id}/portrait`, {
    headers: {
      Origin: origin,
      'Content-Type': 'image/png',
      'X-Character-Revision': String(before.revision),
      'X-Command-Id': crypto.randomUUID(),
    },
    data: Buffer.from('<svg onload="alert(1)"/>'),
  });
  expect(invalid.status()).toBe(422);
  expect((await (await page.request.get(`/api/characters/${id}`)).json()).revision).toBe(
    before.revision,
  );
  const other = await browser.newContext({ baseURL: origin });
  await other.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  const sharedImage = await other.request.get(`/api/characters/${id}/portrait`);
  expect(sharedImage.status()).toBe(200);
  expect(await sharedImage.body()).toEqual(await image.body());
  expect(
    (
      await other.request.get(`/api/characters/${id}/portrait`, {
        headers: { 'If-None-Match': `W/${etag}` },
      })
    ).status(),
  ).toBe(304);
  expect(
    (
      await other.request.post(`/api/characters/${id}/portrait`, {
        headers: { Origin: origin },
        data: portraitFixture(),
      })
    ).status(),
  ).toBe(404);
  await other.close();
  await page.getByRole('button', { name: /03Zawady|03 Zawady/ }).click();
  await page.getByLabel('Wybierz zawadę').selectOption('phobia');
  await expect(page.getByRole('region', { name: 'Opis wybranej zawady' })).toContainText('−4');
  const preview = page.getByRole('region', { name: 'Opis wybranej przewagi' });
  await page.getByLabel('Wybierz przewagę').selectOption('rich');
  await expect(preview).toContainText('1200');
  await expect(preview.getByRole('note')).toContainText('porozmawiaj z MG i uzyskaj jego zgodę');
  await page.getByRole('button', { name: 'Dodaj', exact: true }).nth(1).click();
  await expect(page.locator('.choice-card .gm-approval-warning')).toContainText('zgodę');
  await page.getByLabel('Wybierz przewagę').selectOption('filthy-rich');
  await expect(preview).toContainText('2000');
  await expect(preview.getByRole('note')).toContainText('wszyscy zaczynają jako biedni');
  await page.getByLabel('Wybierz przewagę').selectOption('alertness');
  await expect(preview.getByRole('note')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  const current = await (await page.request.get(`/api/characters/${id}`)).json();
  expect(current.document.build.hindrances).toEqual([]);
  const print = await page.context().newPage();
  await print.goto(`/characters/${id}/print`);
  await expect(print.locator('.print-sheet')).toContainText('blizna na policzku');
  await expect(print.getByRole('img', { name: 'Portret: Mara — portret' })).toBeVisible();
  await print.close();
  const pdf = await page.request.get(`/api/characters/${id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).includes(Buffer.from('/Subtype /Image'))).toBe(true);
  await page.screenshot({ path: 'test-results/exilium-rule-descriptions.png', fullPage: true });
  await page.getByRole('button', { name: /01Koncepcja|01 Koncepcja/ }).click();
  await page.screenshot({ path: 'test-results/exilium-portrait-creator.png', fullPage: true });
  await page.getByRole('button', { name: 'Usuń portret', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Portret postaci', exact: true })).toHaveCount(0);
  expect((await page.request.get(`/api/characters/${id}/portrait`)).status()).toBe(404);
  expect(errors).toEqual([]);
});

test('beginners can choose setting backgrounds, read explanations, and understand excluded book options', async ({
  page,
}) => {
  await login(page);
  await page.getByLabel('Imię nowej postaci').fill('Pierwszy bohater');
  await page.getByRole('button', { name: 'Stwórz postać', exact: false }).click();
  await expect(page).toHaveURL(/\/characters\/[\w-]+$/);
  const id = page.url().split('/').pop()!;
  const origin = page.getByRole('combobox', { name: 'Pochodzenie', exact: true });
  const caste = page.getByRole('combobox', { name: 'Status społeczny', exact: true });
  await expect(origin.locator('option')).toHaveCount(13);
  await expect(caste.locator('option')).toHaveCount(6);
  await origin.selectOption('Alexandria');
  await expect(page.locator('.setting-description').first()).toContainText('Wielkiego Archiwum');
  await caste.selectOption('Uposażeni');
  await expect(page.locator('.setting-description').nth(1)).toContainText('Uznani specjaliści');
  await page.getByRole('button', { name: 'Pomoc: Status społeczny i kasta', exact: true }).click();
  const casteHelp = page.getByRole('dialog', { name: 'Status społeczny i kasta', exact: true });
  await expect(casteHelp).toContainText('sam nie zmienia budżetu');
  await page.keyboard.press('Escape');
  await expect(casteHelp).not.toBeVisible();
  await page.screenshot({ path: 'test-results/exilium-setting-descriptions.png', fullPage: true });
  await origin.selectOption('__custom');
  await page.getByLabel('Własne: pochodzenie', { exact: true }).fill('Stacja Kaldera');
  await expect
    .poll(
      async () => (await (await page.request.get(`/api/characters/${id}`)).json()).document.origin,
    )
    .toBe('Stacja Kaldera');
  await page.reload();
  await expect(page.getByLabel('Własne: pochodzenie', { exact: true })).toHaveValue(
    'Stacja Kaldera',
  );
  await expect(page.getByRole('combobox', { name: 'Status społeczny', exact: true })).toHaveValue(
    'Uposażeni',
  );
  await page.getByRole('button', { name: /02Cechy|02 Cechy/ }).click();
  await expect(
    page.getByText('Koordynacja, refleks i precyzja ruchów.', { exact: true }),
  ).toBeVisible();
  const helpButton = page.getByRole('button', { name: 'Pomoc: Zręczność', exact: true });
  await helpButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Zręczność', exact: true })).toContainText(
    'rzucasz kością Strzelania',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pomoc: Jak czytać kości i testy?', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Jak czytać kości i testy?', exact: true }),
  ).toContainText('wybiera lepszy wynik');
  await page.getByRole('button', { name: 'Zamknij pomoc', exact: true }).click();
  await page.screenshot({ path: 'test-results/exilium-creator-attributes.png', fullPage: true });
  await page.getByRole('button', { name: /03Zawady|03 Zawady/ }).click();
  await page
    .getByRole('searchbox', { name: 'Szukaj zawady lub przewagi' })
    .fill('Pomyslowy Dobromir');
  await expect(page.locator('.unavailable-rules article')).toHaveCount(1);
  await expect(page.locator('.unavailable-rules article')).toContainText('Niesamowita nauka');
  await expect(page.locator('.unavailable-rules article')).toContainText('McGyver');
  await expect(page.getByLabel('Wybierz przewagę').locator('option')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Szukaj zawady lub przewagi' }).fill('McGyver');
  await expect(page.getByLabel('Wybierz przewagę').locator('option')).toHaveCount(1);
  await expect(page.getByLabel('Wybierz przewagę')).toHaveValue('mcgyver');
  const stored = (await (await page.request.get(`/api/characters/${id}`)).json()).document;
  expect(stored.caste).toBe('Uposażeni');
  expect(stored.cash).toBe(400);
  expect(stored.build.edges).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole('button', { name: /01Koncepcja|01 Koncepcja/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/exilium-background-choices.png', fullPage: true });
});

test('character-sheet help works by keyboard and touch without changing the sheet', async ({
  page,
}) => {
  await login(page);
  const id = await create(page, 'Nowa drużyna');
  const before = await (await page.request.get(`/api/characters/${id}`)).json();
  for (const title of [
    'Obrona',
    'Wytrzymałość i pancerz',
    'Siła',
    'Strzelanie',
    'Rany i Wyeliminowanie',
    'Fuksy',
    'Szok',
  ]) {
    await page.getByRole('button', { name: `Pomoc: ${title}`, exact: true }).click();
    await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  }
  const after = await (await page.request.get(`/api/characters/${id}`)).json();
  expect(after.revision).toBe(before.revision);
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole('button', { name: 'Pomoc: Jak czytać kości i testy?', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Jak czytać kości i testy?', exact: true }),
  ).toContainText('Kością Figury');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/exilium-sheet-help.png', fullPage: true });
});
