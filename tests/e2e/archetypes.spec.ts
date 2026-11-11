import { test, expect } from '@playwright/test';
import { newItem } from '../../src/lib/rules/model';
import { origin } from './helpers';

test('book archetypes preview, preserve the character, autosave, confirm replacements and respect existing-character mode', async ({
  page,
}, info) => {
  await page.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  let record = await (
    await page.request.post('/api/characters', {
      headers: { Origin: origin },
      data: { name: 'Łucja — szybki start' },
    })
  ).json();
  const document = record.document;
  document.background = 'Historia pozostaje moja.';
  document.origin = 'Alexandria';
  document.profession = 'Mechanik';
  document.privacy.statistics = true;
  document.inventory = [{ ...newItem(), name: 'Własna torba', price: 10 }];
  const saved = await page.request.post(`/api/characters/${record.id}`, {
    headers: { Origin: origin },
    data: {
      revision: record.revision,
      commandId: crypto.randomUUID(),
      command: { type: 'saveDraft', document },
    },
  });
  expect(saved.status()).toBe(200);
  record = await saved.json();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/characters/${record.id}`);
  const picker = page.getByRole('region', { name: 'Szybkie tworzenie z archetypu' });
  const select = picker.getByRole('combobox', { name: 'Archetyp z podręcznika', exact: true });
  await expect(select).toBeEnabled();
  await expect(select.locator('option')).toHaveCount(13);
  await select.selectOption('driver');
  await expect(picker).toContainText('7 pkt umiejętności');
  await expect(picker).toContainText('As · Błyskawiczny refleks');
  // Previewing should not enqueue a draft save (the text debounce is 700 ms).
  await page.waitForTimeout(900);
  expect((await (await page.request.get(`/api/characters/${record.id}`)).json()).revision).toBe(
    record.revision,
  );
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await picker.screenshot({ path: info.outputPath(`archetype-preview-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await picker.getByRole('button', { name: 'Wczytaj archetyp', exact: true }).click();
  await expect(picker.getByRole('status')).toContainText('Wczytano archetyp: Kierowca');
  await expect(page.locator('.save-status')).toHaveText('Zapisano');
  const loaded = await (await page.request.get(`/api/characters/${record.id}`)).json();
  expect(loaded.document.build).toMatchObject({
    attributes: { agility: 8, smarts: 6, spirit: 6, strength: 6, vigor: 6 },
    skills: { driving: 8, notice: 6, shooting: 6, fighting: 4 },
    hindrances: [],
    bonus: { attributes: 1, skills: 0, funds: 0 },
  });
  for (const key of ['name', 'background', 'origin', 'profession', 'privacy', 'inventory'])
    expect(loaded.document[key]).toEqual(document[key]);
  await page.getByRole('button', { name: /02Cechy|02 Cechy/ }).click();
  await expect(
    page
      .locator('.attribute-row')
      .filter({ hasText: 'Zręczność' })
      .getByRole('button', { name: 'k8', exact: true }),
  ).toHaveClass(/picked/);
  await page.getByRole('button', { name: /04Umiejętności|04 Umiejętności/ }).click();
  await expect(page.getByRole('combobox', { name: 'Prowadzenie', exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: /01Koncepcja|01 Koncepcja/ }).click();
  await select.selectOption('brute');
  await expect(picker).toContainText('k8 zamiast drukowanego k10');
  page.once('dialog', (dialog) => dialog.dismiss());
  await picker.getByRole('button', { name: 'Wczytaj archetyp', exact: true }).click();
  expect(
    (await (await page.request.get(`/api/characters/${record.id}`)).json()).document.build,
  ).toEqual(loaded.document.build);
  await select.selectOption('scientist');
  page.once('dialog', (dialog) => dialog.accept());
  await picker.getByRole('button', { name: 'Wczytaj archetyp', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Zapisano');
  await page.reload();
  const scientist = await (await page.request.get(`/api/characters/${record.id}`)).json();
  expect(scientist.document.build.skills['knowledge:Inna']).toBe(10);
  expect(
    scientist.document.build.edges.find((edge: { id: string }) => edge.id === 'scholar').target,
  ).toBe('knowledge:Inna|knowledge:Nauka');
  expect(scientist.document.background).toBe(document.background);
  await select.selectOption('sniper');
  await page.getByText('Wpisuję istniejącą postać', { exact: true }).click();
  await page.getByLabel('Użyj istniejącej karty jako podstawy', { exact: false }).check();
  await expect(select).toBeDisabled();
  await expect(
    picker.getByRole('button', { name: 'Wczytaj archetyp', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('.save-status')).toHaveText('Zapisano');
  expect(
    (await (await page.request.get(`/api/characters/${record.id}`)).json()).document.build,
  ).toEqual(scientist.document.build);
  expect(errors).toEqual([]);
});
