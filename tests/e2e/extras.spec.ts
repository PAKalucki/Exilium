import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { adminLogin, promote, resetPlayers, origin } from './helpers';
import { newCharacter } from '../../src/lib/rules/model';

test('GM creates a private Extra with free stats, edits it after activation, and filters/prints its category', async ({
  page,
  browser,
}, info) => {
  await adminLogin(page);
  const gm = await browser.newContext({ baseURL: origin });
  await gm.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await promote(page, gm.request, 'gm');
  const editor = await gm.newPage();
  const errors: string[] = [];
  editor.on('pageerror', (error) => errors.push(error.message));
  await editor.goto('/');
  const form = editor.locator('.new-character-card');
  await expect(
    form.getByRole('combobox', { name: 'Kategoria nowej postaci', exact: true }),
  ).toHaveValue('wildCard');
  await form
    .getByRole('combobox', { name: 'Kategoria nowej postaci', exact: true })
    .selectOption('extra');
  await editor.getByLabel('Imię nowej postaci').fill('Strażnik — Blotka');
  await editor.getByRole('button', { name: 'Stwórz postać', exact: false }).click();
  await expect(editor).toHaveURL(/\/characters\/[\w-]+$/);
  const id = editor.url().split('/').pop()!;
  const category = editor
    .getByRole('region', { name: 'Kategoria postaci', exact: true })
    .getByRole('combobox');
  await expect(category).toHaveValue('extra');
  await category.selectOption('wildCard');
  await expect(editor.locator('.save-status')).toHaveText('Zapisano');
  expect((await (await gm.request.get(`/api/characters/${id}`)).json()).document.category).toBe(
    'wildCard',
  );
  await category.selectOption('extra');
  await expect(editor.locator('.save-status')).toHaveText('Zapisano');
  for (const width of [1440, 820, 390]) {
    await editor.setViewportSize({ width, height: 1000 });
    expect(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await editor.screenshot({ path: info.outputPath(`extra-creator-${width}.png`) });
  }
  await editor.setViewportSize({ width: 1440, height: 1000 });
  await editor.getByRole('button', { name: /02Cechy|02 Cechy/ }).click();
  await expect(editor.locator('.budget-banner')).toHaveCount(0);
  await editor
    .locator('.attribute-row')
    .filter({ has: editor.getByText('Zręczność', { exact: true }) })
    .getByRole('button', { name: 'k12', exact: true })
    .click();
  await editor
    .locator('.attribute-row')
    .filter({ has: editor.getByText('Siła', { exact: true }) })
    .getByRole('button', { name: 'k10', exact: true })
    .click();
  await editor.getByRole('button', { name: /04Umiejętności|04 Umiejętności/ }).click();
  await expect(editor.locator('.budget-banner')).toHaveCount(0);
  await editor.getByRole('combobox', { name: 'Strzelanie', exact: true }).selectOption('12');
  await editor.getByRole('button', { name: 'Zatwierdź postać', exact: false }).click();
  await expect(editor.locator('.session-panel')).toBeVisible();
  await expect(editor.locator('.rank-pill')).toHaveCount(0);
  await expect(editor.getByRole('button', { name: /^Rozwój/ })).toHaveCount(0);
  await expect(
    editor.getByRole('button', { name: /Dodaj fuksa|Wydaj fuksa|Nowa sesja/ }),
  ).toHaveCount(0);
  let record = await (await gm.request.get(`/api/characters/${id}`)).json();
  expect(record.document.category).toBe('extra');
  expect(record.status).toBe('active');
  expect(Object.values(record.document.privacy).every(Boolean)).toBe(true);
  expect(record.document.conditions.bennies).toBe(0);
  expect(record.document.build.attributes.agility).toBe(12);
  expect(record.document.build.attributes.strength).toBe(10);
  expect(record.document.build.skills.shooting).toBe(12);
  expect(record.document.build.edges).toEqual([]);
  expect(record.document.legacy).toBeNull();
  await editor.getByRole('button', { name: 'Zwiększ Rany', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Zwiększ Rany', exact: true })).toBeDisabled();
  await expect(editor.locator('.session-warning')).toContainText('wyeliminowana');
  await editor.getByRole('button', { name: 'Zmniejsz Rany', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Zwiększ Rany', exact: true })).toBeEnabled();
  await editor.getByRole('button', { name: 'Statystyki Blotki', exact: true }).click();
  await expect(category).toBeDisabled();
  await editor.getByRole('button', { name: /02Cechy|02 Cechy/ }).click();
  await editor
    .locator('.attribute-row')
    .filter({ has: editor.getByText('Duch', { exact: true }) })
    .getByRole('button', { name: 'k12', exact: true })
    .click();
  await expect(editor.locator('.save-status')).toHaveText('Zapisano');
  record = await (await gm.request.get(`/api/characters/${id}`)).json();
  expect(record.document.build.attributes.spirit).toBe(12);
  expect(record.status).toBe('active');

  await editor.goto(`/characters/${id}/print`);
  await expect(editor.locator('.advancement-strip')).toContainText('Blotka');
  await expect(editor.locator('.advancement-strip')).not.toContainText('Ranga');
  await expect(editor.locator('.benny-count')).toHaveCount(0);
  await expect(editor.locator('.condition-boxes > span')).toHaveCount(4);
  await expect(editor.locator('.skill-line')).toHaveCount(1);
  await editor.emulateMedia({ media: 'print' });
  const pdf = info.outputPath('extra.pdf');
  await editor.pdf({ path: pdf, preferCSSPageSize: true });
  const text = execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
  expect(text).toContain('Blotka');
  expect(text).toContain('Pula MG');
  expect(text).not.toMatch(/Nowicjusz|Niewydane rozwinięcia/);
  expect(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' })).toMatch(/Pages:\s+1\b/);
  await editor.emulateMedia({ media: 'screen' });
  const copy = await gm.request.post(`/api/characters/${id}/duplicate`, {
    headers: { Origin: origin },
  });
  expect(copy.status()).toBe(201);
  const duplicate = await copy.json();
  expect(duplicate.document.category).toBe('extra');
  expect(duplicate.document.legacy).toBeNull();
  expect(Object.values(duplicate.document.privacy).every(Boolean)).toBe(true);
  const figure = await (
    await gm.request.post('/api/characters', {
      headers: { Origin: origin },
      data: { name: 'Figura kontrolna' },
    })
  ).json();
  await editor.goto('/');
  const filter = editor.getByRole('combobox', { name: 'Kategoria postaci', exact: true });
  await filter.selectOption('extra');
  const card = editor.locator(`a.character-card[href="/characters/${id}"]`);
  const figureCard = editor.locator(`a.character-card[href="/characters/${figure.id}"]`);
  await expect(card).toBeVisible();
  await expect(figureCard).toHaveCount(0);
  for (const width of [1440, 820, 390]) {
    await editor.setViewportSize({ width, height: 1000 });
    expect(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await editor
      .locator('.library-toolbar')
      .screenshot({ path: info.outputPath(`category-filter-${width}.png`) });
  }
  await editor.setViewportSize({ width: 1440, height: 1000 });
  await filter.selectOption('wildCard');
  await expect(card).toHaveCount(0);
  await expect(figureCard).toBeVisible();
  await filter.selectOption('extra');
  const group = editor.getByRole('article', { name: 'Postać: Strażnik — Blotka', exact: true });
  editor.once('dialog', (dialog) => dialog.accept());
  await group
    .getByRole('button', { name: 'Archiwizuj postać Strażnik — Blotka', exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await editor.getByRole('button', { name: 'Archiwum', exact: true }).click();
  await expect(filter).toHaveValue('extra');
  await expect(card).toBeVisible();
  await group
    .getByRole('button', { name: 'Przywróć postać Strażnik — Blotka', exact: true })
    .click();
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
  await gm.close();
});

test('players and admins cannot create or forge Extras; readers see private defaults and public category', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const player = await browser.newContext({ baseURL: origin });
  const gm = await browser.newContext({ baseURL: origin });
  await player.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  await gm.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await promote(page, player.request, 'player');
  await promote(page, gm.request, 'gm');
  for (const request of [player.request, page.request]) {
    expect(
      (
        await request.post('/api/characters', {
          headers: { Origin: origin },
          data: { name: 'Zakazana Blotka', category: 'extra' },
        })
      ).status(),
    ).toBe(403);
    const owned = await (
      await request.post('/api/characters', {
        headers: { Origin: origin },
        data: { name: 'Dozwolona Figura' },
      })
    ).json();
    expect(owned.document.category).toBe('wildCard');
    const forged = { ...newCharacter('Fałszywa Blotka', 'extra'), name: owned.document.name };
    expect(
      (
        await request.post(`/api/characters/${owned.id}`, {
          headers: { Origin: origin },
          data: {
            revision: owned.revision,
            commandId: crypto.randomUUID(),
            command: { type: 'saveDraft', document: forged },
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await (await request.get(`/api/characters/${owned.id}`)).json()).document.category,
    ).toBe('wildCard');
  }
  const created = await gm.request.post('/api/characters', {
    headers: { Origin: origin },
    data: { name: 'Ukryta Blotka', category: 'extra' },
  });
  expect(created.status()).toBe(201);
  const record = await created.json();
  const viewer = await player.newPage();
  await viewer.goto('/');
  await expect(viewer.locator('.new-character-card').getByRole('combobox')).toHaveCount(0);
  await viewer
    .getByRole('combobox', { name: 'Kategoria postaci', exact: true })
    .selectOption('extra');
  await expect(viewer.locator(`a.character-card[href="/characters/${record.id}"]`)).toContainText(
    'Blotka',
  );
  await viewer.goto(`/characters/${record.id}`);
  for (const label of ['Statystyki', 'Pochodzenie', 'Historia', 'Ekwipunek'])
    await expect(viewer.getByRole('note', { name: `${label}: ukryte`, exact: true })).toBeVisible();
  await page.goto(`/characters/${record.id}`);
  await expect(page.getByRole('note', { name: 'Statystyki: ukryte' })).toBeVisible();
  await page.getByRole('link', { name: 'Odkryj prywatne szczegóły', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Statystyki Blotki', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zatwierdź postać', exact: false })).toHaveCount(0);
  expect(
    (
      await page.request.post(`/api/characters/${record.id}?revealPrivate=1`, {
        headers: { Origin: origin },
        data: {
          revision: record.revision,
          commandId: crypto.randomUUID(),
          command: { type: 'saveExtra', document: record.document },
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`/api/characters/${record.id}/duplicate?revealPrivate=1`, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(403);
  await player.close();
  await gm.close();
});

test.afterEach(async ({ browser }) => resetPlayers(browser));
