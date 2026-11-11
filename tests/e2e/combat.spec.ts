import { test, expect, type APIRequestContext, type Route } from '@playwright/test';
import { adminLogin, promote, resetPlayers, origin } from './helpers';
import { sample } from '../fixtures';

async function character(request: APIRequestContext, name: string, extra = false) {
  let record = await (
    await request.post('/api/characters', {
      headers: { Origin: origin },
      data: { name, category: extra ? 'extra' : 'wildCard' },
    })
  ).json();
  if (!extra) {
    const document = sample();
    document.name = name;
    const saved = await request.post(`/api/characters/${record.id}`, {
      headers: { Origin: origin },
      data: {
        revision: record.revision,
        commandId: crypto.randomUUID(),
        command: { type: 'saveDraft', document },
      },
    });
    expect(saved.status()).toBe(200);
    record = await saved.json();
  }
  const finalized = await request.post(`/api/characters/${record.id}`, {
    headers: { Origin: origin },
    data: {
      revision: record.revision,
      commandId: crypto.randomUUID(),
      command: { type: 'finalize' },
    },
  });
  expect(finalized.status()).toBe(200);
  return finalized.json();
}
test('GM prepares grouped combat, resolves 2015 states, retains held cards and retries linked damage safely', async ({
  page,
  browser,
}, info) => {
  await adminLogin(page);
  const gm = await browser.newContext({ baseURL: origin }),
    player = await browser.newContext({ baseURL: origin });
  await gm.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await player.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  await promote(page, gm.request, 'gm');
  await promote(page, player.request, 'player');
  const hero = await character(player.request, 'Łucja — walka'),
    guard = await character(gm.request, 'Strażnik A — walka', true),
    guard2 = await character(gm.request, 'Strażnik B — walka', true);
  const editor = await gm.newPage();
  const errors: string[] = [];
  editor.on('pageerror', (e) => errors.push(e.message));
  await editor.goto('/combat');
  await editor.getByLabel('Nazwa starcia', { exact: true }).fill('Obrona studni');
  await editor.getByRole('button', { name: 'Przygotuj walkę →', exact: true }).click();
  await expect(editor).toHaveURL(/\/combat\/[\w-]+$/);
  const id = editor.url().split('/').pop()!;
  async function read() {
    return (await gm.request.get(`/api/combats/${id}`)).json();
  }
  async function add(characterId: string, side: 'players' | 'gm', unitId = '') {
    await editor
      .getByRole('combobox', { name: 'Karta postaci', exact: true })
      .selectOption(characterId);
    if (characterId !== hero.id)
      await editor
        .getByRole('combobox', { name: 'Grupa inicjatywy', exact: true })
        .selectOption(unitId);
    if (!unitId)
      await editor.getByRole('combobox', { name: 'Kontrolujący', exact: true }).selectOption(side);
    await editor.getByRole('button', { name: 'Dodaj do walki', exact: true }).click();
    await expect(
      editor.getByRole('article', {
        name: `Uczestnik: ${characterId === hero.id ? hero.document.name : characterId === guard.id ? guard.document.name : guard2.document.name}`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await add(hero.id, 'players');
  await add(guard.id, 'gm');
  let record = await read();
  const guardUnitId = record.units.find((u: { leaderId: string }) => u.leaderId === guard.id).id;
  await add(guard2.id, 'gm', guardUnitId);
  record = await read();
  expect(record.units).toHaveLength(2);
  const guardGroup = editor.getByRole('region', {
    name: 'Inicjatywa: Strażnik A — walka',
    exact: true,
  });
  await guardGroup
    .getByRole('textbox', { name: 'Nazwa grupy', exact: true })
    .fill('Strażnicy posterunku');
  await guardGroup
    .getByRole('combobox', { name: 'Pierwsza runda', exact: true })
    .selectOption('ambush');
  await guardGroup.getByRole('button', { name: 'Zapisz ustawienia grupy', exact: true }).click();
  await expect(
    editor.getByRole('region', { name: 'Inicjatywa: Strażnicy posterunku', exact: true }),
  ).toBeVisible();
  await editor.getByLabel('Początkowa pula fuksów MG', { exact: true }).fill('2');
  await editor.getByRole('button', { name: 'Rozdaj pierwszą rundę', exact: true }).click();
  await expect(editor.getByRole('region', { name: 'Bieżąca tura', exact: true })).toBeVisible();
  record = await read();
  const heroUnitId = record.units.find((u: { leaderId: string }) => u.leaderId === hero.id).id;
  const heroGroup = editor.getByRole('region', { name: 'Inicjatywa: Łucja — walka', exact: true });
  if (!record.currentId)
    await heroGroup.getByRole('button', { name: 'Joker — działaj teraz', exact: true }).click();
  const heroCard = editor.getByRole('article', { name: 'Uczestnik: Łucja — walka', exact: true });
  await heroCard.getByRole('button', { name: 'Szok', exact: true }).click();
  await expect(heroCard.getByRole('button', { name: 'Szok', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await heroCard.getByLabel('Suma testu Ducha po modyfikatorach', { exact: true }).fill('4');
  await heroCard.getByRole('button', { name: 'Rozlicz test Ducha', exact: true }).click();
  await expect(heroCard.getByRole('button', { name: 'Szok', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  const guardCard = editor.getByRole('article', {
    name: 'Uczestnik: Strażnik A — walka',
    exact: true,
  });
  await guardCard.getByText('Rozlicz obrażenia i wyparowanie', { exact: true }).click();
  await guardCard.getByLabel('Obrażenia', { exact: true }).fill('9');
  await guardCard.getByLabel('Efektywna Wytrzymałość', { exact: true }).fill('5');
  await guardCard.getByLabel('Wyparowane Rany', { exact: true }).fill('1');
  await guardCard
    .getByRole('combobox', { name: 'Fuks na wyparowanie', exact: true })
    .selectOption('gm');
  await guardCard.getByRole('button', { name: 'Zastosuj obrażenia do karty', exact: true }).click();
  await expect.poll(async () => (await read()).gmBennies).toBe(1);
  let sheet = await (await gm.request.get(`/api/characters/${guard.id}`)).json();
  expect(sheet.document.conditions.wounds).toBe(0);
  await guardCard.getByLabel('Wyparowane Rany', { exact: true }).fill('0');
  await guardCard
    .getByRole('combobox', { name: 'Fuks na wyparowanie', exact: true })
    .selectOption('none');
  await guardCard.getByRole('button', { name: 'Zastosuj obrażenia do karty', exact: true }).click();
  await expect(guardCard.getByText('WYELIMINOWANIE', { exact: true })).toBeVisible();
  sheet = await (await gm.request.get(`/api/characters/${guard.id}`)).json();
  expect(sheet.document.conditions).toMatchObject({ wounds: 1, bennies: 0, incapacitated: true });
  expect(
    (await (await gm.request.get(`/api/characters/${guard2.id}`)).json()).document.conditions
      .wounds,
  ).toBe(0);
  const viewer = await player.newPage();
  await viewer.goto(`/combat/${id}`);
  await expect(viewer.getByRole('note', { name: 'Statystyki: ukryte', exact: true })).toHaveCount(
    2,
  );
  await expect(viewer.getByRole('button', { name: 'Koniec tury →', exact: true })).toHaveCount(0);
  let releaseRead!: () => void, capturedRead!: () => void;
  const gate = new Promise<void>((resolve) => (releaseRead = resolve));
  const captured = new Promise<void>((resolve) => (capturedRead = resolve));
  let heldRead = false;
  const delayOldRead = async (route: Route) => {
    if (route.request().method() === 'GET' && !heldRead) {
      heldRead = true;
      const response = await route.fetch();
      capturedRead();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  };
  await editor.route(`${origin}/api/combats/${id}`, delayOldRead);
  const refreshClick = editor.getByRole('button', { name: 'Odśwież', exact: true }).click();
  await captured;
  await heroCard
    .getByRole('button', { name: 'Zwiększ Zmęczenie: Łucja — walka', exact: true })
    .click();
  await expect(
    heroCard.locator('.combat-counter').filter({ hasText: 'Zmęczenie' }).locator('b'),
  ).toHaveText('1/3');
  releaseRead();
  await refreshClick;
  await expect(editor.getByRole('button', { name: 'Odśwież', exact: true })).toBeEnabled();
  await expect(
    heroCard.locator('.combat-counter').filter({ hasText: 'Zmęczenie' }).locator('b'),
  ).toHaveText('1/3');
  await editor.unroute(`${origin}/api/combats/${id}`, delayOldRead);
  let dropped = false;
  await editor.route(`${origin}/api/combats/${id}`, async (route) => {
    if (
      route.request().method() === 'POST' &&
      route.request().postDataJSON().command.type === 'tracker' &&
      !dropped
    ) {
      dropped = true;
      await route.fetch();
      await route.abort();
      return;
    }
    return route.continue();
  });
  await heroCard.getByRole('button', { name: 'Zwiększ Rany: Łucja — walka', exact: true }).click();
  await expect(
    editor.getByRole('button', { name: 'Ponów ten sam zapis', exact: true }),
  ).toBeVisible();
  await editor.getByRole('button', { name: 'Ponów ten sam zapis', exact: true }).click();
  await expect(
    editor.getByRole('button', { name: 'Ponów ten sam zapis', exact: true }),
  ).toHaveCount(0);
  expect(
    (await (await player.request.get(`/api/characters/${hero.id}`)).json()).document.conditions
      .wounds,
  ).toBe(1);
  await expect(
    viewer
      .getByRole('article', { name: 'Uczestnik: Łucja — walka', exact: true })
      .locator('.combat-counter')
      .filter({ hasText: 'Rany' })
      .locator('b'),
  ).toHaveText('1/3');
  record = await read();
  const heldCard = record.units.find((u: { id: string }) => u.id === heroUnitId).card;
  await editor.getByRole('button', { name: 'Wstrzymaj akcję', exact: true }).click();
  await editor.getByRole('button', { name: 'Rozdaj następną rundę', exact: true }).click();
  await expect.poll(async () => (await read()).round).toBe(2);
  record = await read();
  expect(record.units.find((u: { id: string }) => u.id === heroUnitId).card).toBe(heldCard);
  for (const width of [1440, 820, 390]) {
    await editor.setViewportSize({ width, height: 1100 });
    expect(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await editor.screenshot({ path: info.outputPath(`combat-${width}.png`), fullPage: true });
  }
  await editor.setViewportSize({ width: 1440, height: 1000 });
  await heroGroup
    .getByRole('button', { name: 'Działaj w przerwie między akcjami', exact: true })
    .click();
  await editor.getByRole('button', { name: 'Koniec tury →', exact: true }).click();
  editor.once('dialog', (dialog) => dialog.accept());
  await editor.getByRole('button', { name: 'Zakończ starcie', exact: true }).click();
  await expect(editor.getByText('ZAKOŃCZONA WALKA', { exact: true })).toBeVisible();
  await editor.reload();
  await expect(editor.getByText('ZAKOŃCZONA WALKA', { exact: true })).toBeVisible();
  expect((await read()).phase).toBe('finished');
  expect(errors).toEqual([]);
  await gm.close();
  await player.close();
});

test('combat enforces roles, privacy reveal, CSRF and revision checks without exposing the deck', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const gm = await browser.newContext({ baseURL: origin }),
    player = await browser.newContext({ baseURL: origin }),
    anonymous = await browser.newContext({ baseURL: origin });
  await gm.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await player.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  await promote(page, gm.request, 'gm');
  await promote(page, player.request, 'player');
  expect(
    (
      await player.request.post('/api/combats', {
        headers: { Origin: origin },
        data: { name: 'Zakazane', commandId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(403);
  expect((await anonymous.request.get('/api/combats')).status()).toBe(401);
  const body = { name: 'Prywatne starcie', commandId: crypto.randomUUID() };
  const created = await gm.request.post('/api/combats', {
    headers: { Origin: origin },
    data: body,
  });
  expect(created.status()).toBe(201);
  let record = await created.json();
  expect(
    (
      await (
        await gm.request.post('/api/combats', { headers: { Origin: origin }, data: body })
      ).json()
    ).id,
  ).toBe(record.id);
  const extra = await character(gm.request, 'Prywatny przeciwnik', true);
  async function post(
    request: APIRequestContext,
    command: unknown,
    revision = record.revision,
    reveal = false,
    requestOrigin = origin,
  ) {
    return request.post(`/api/combats/${record.id}${reveal ? '?revealPrivate=1' : ''}`, {
      headers: { Origin: requestOrigin },
      data: { revision, commandId: crypto.randomUUID(), command },
    });
  }
  record = await (
    await post(gm.request, { type: 'add', characterId: extra.id, side: 'gm' })
  ).json();
  expect(
    (
      await post(page.request, { type: 'start', gmBennies: 1, tacticianId: null, tacticsResult: 0 })
    ).status(),
  ).toBe(403);
  await page.goto(`/combat/${record.id}`);
  await expect(page.getByRole('note', { name: 'Statystyki: ukryte', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Rozdaj pierwszą rundę', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Odkryj prywatne szczegóły', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Rozdaj pierwszą rundę', exact: true }),
  ).toBeVisible();
  record = await (
    await post(gm.request, { type: 'start', gmBennies: 1, tacticianId: null, tacticsResult: 0 })
  ).json();
  expect((await post(player.request, { type: 'gmBenny', delta: 1 })).status()).toBe(403);
  expect(
    (
      await post(
        gm.request,
        { type: 'gmBenny', delta: 1 },
        record.revision,
        false,
        'https://foreign.example',
      )
    ).status(),
  ).toBe(403);
  expect(
    (await post(gm.request, { type: 'gmBenny', delta: 1 }, record.revision - 1)).status(),
  ).toBe(409);
  const visible = await (
    await player.request.get(`/api/combats/${record.id}?revealPrivate=1`)
  ).json();
  expect(visible.participants[0].character.redacted).toHaveLength(4);
  expect(visible).not.toHaveProperty('deck');
  expect(visible.reserve).toEqual([]);
  expect(visible.units[0].draws).toEqual([]);
  const token = await (
    await player.request.post('/api/tokens', {
      headers: { Origin: origin },
      data: { name: 'Combat cannot write', scopes: ['read'], days: 1 },
    })
  ).json();
  expect(
    (
      await anonymous.request.post(`/api/combats/${record.id}`, {
        headers: { Authorization: `Bearer ${token.token}` },
        data: {
          revision: record.revision,
          commandId: crypto.randomUUID(),
          command: { type: 'gmBenny', delta: 1 },
        },
      })
    ).status(),
  ).toBe(403);
  await gm.close();
  await player.close();
  await anonymous.close();
});
test.afterEach(async ({ browser }) => resetPlayers(browser));

test('Tactician gives allies a separate card before turns start and Full Defense uses the 2015 result', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const gm = await browser.newContext({ baseURL: origin });
  await gm.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await promote(page, gm.request, 'gm');
  let tactician = await character(gm.request, 'Taktyk posterunku', true);
  tactician.document.build.edges.push({ id: 'tactician', target: '' });
  const saved = await gm.request.post(`/api/characters/${tactician.id}`, {
    headers: { Origin: origin },
    data: {
      revision: tactician.revision,
      commandId: crypto.randomUUID(),
      command: { type: 'saveExtra', document: tactician.document },
    },
  });
  expect(saved.status()).toBe(200);
  tactician = await saved.json();
  const ally = await character(gm.request, 'Pomocnik Taktyka', true);
  let encounter = await (
    await gm.request.post('/api/combats', {
      headers: { Origin: origin },
      data: { name: 'Taktyk i sojusznicy', commandId: crypto.randomUUID() },
    })
  ).json();
  async function command(value: unknown) {
    const result = await gm.request.post(`/api/combats/${encounter.id}`, {
      headers: { Origin: origin },
      data: { revision: encounter.revision, commandId: crypto.randomUUID(), command: value },
    });
    expect(result.status()).toBe(200);
    encounter = await result.json();
  }
  await command({ type: 'add', characterId: tactician.id, side: 'gm' });
  const host = encounter.units[0].id;
  await command({ type: 'add', characterId: ally.id, side: 'gm', unitId: host });
  const editor = await gm.newPage();
  await editor.goto(`/combat/${encounter.id}`);
  await editor
    .getByRole('combobox', { name: 'Taktyk — jeden na starcie', exact: true })
    .selectOption(tactician.id);
  await editor.getByLabel('Suma testu Wiedzy (Strategia)', { exact: true }).fill('8');
  await editor.getByRole('button', { name: 'Rozdaj pierwszą rundę', exact: true }).click();
  await expect(
    editor.getByRole('button', { name: 'Pomiń kartę Taktyka — rozpocznij tury', exact: true }),
  ).toBeVisible();
  encounter = await (await gm.request.get(`/api/combats/${encounter.id}`)).json();
  await editor
    .getByRole('combobox', { name: 'Karta z rezerwy', exact: true })
    .selectOption(encounter.reserve[0]);
  await editor.getByRole('combobox', { name: 'Sojusznicza grupa', exact: true }).selectOption(host);
  await editor.getByRole('checkbox', { name: ally.document.name, exact: true }).check();
  await editor.getByRole('button', { name: 'Przekaż kartę', exact: true }).click();
  await expect(
    editor.getByRole('button', { name: 'Pomiń kartę Taktyka — rozpocznij tury', exact: true }),
  ).toHaveCount(0);
  encounter = await (await gm.request.get(`/api/combats/${encounter.id}`)).json();
  expect(encounter.units).toHaveLength(2);
  expect(encounter.units.find((u: { returnTo: string }) => u.returnTo === host).members).toEqual([
    ally.id,
  ]);
  const row = editor.getByRole('article', {
    name: `Uczestnik: ${ally.document.name}`,
    exact: true,
  });
  await row
    .locator('summary')
    .filter({ hasText: /^Pełna obrona$/ })
    .click();
  await row.getByLabel('Wynik Walki +2 po wszystkich modyfikatorach', { exact: true }).fill('11');
  await row.getByRole('button', { name: 'Zastosuj pełną obronę', exact: true }).click();
  await expect(row.locator('.combatant-stats > span').first()).toContainText('11');
  await row.getByRole('button', { name: 'Desperacki atak', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Desperacki atak', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(row.getByRole('button', { name: 'Usuń pełną obronę', exact: true })).toHaveCount(0);
  expect(
    (await (await gm.request.get(`/api/characters/${ally.id}`)).json()).document.conditions.wounds,
  ).toBe(0);
  await gm.close();
});
