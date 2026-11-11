import { test, expect, type APIRequestContext } from '@playwright/test';
import { adminLogin, promote, origin, resetPlayers } from './helpers';
import { sample } from '../fixtures';

async function create(
  request: APIRequestContext,
  name: string,
  active = false,
  privateDetails = false,
) {
  let record = await (
    await request.post('/api/characters', { headers: { Origin: origin }, data: { name } })
  ).json();
  const document = active ? { ...sample(), name } : record.document;
  document.background = 'Historia zachowana w archiwum.';
  document.privacy.background = privateDetails;
  const commands = [{ type: 'saveDraft', document }, ...(active ? [{ type: 'finalize' }] : [])];
  for (const command of commands) {
    const response = await request.post(`/api/characters/${record.id}`, {
      headers: { Origin: origin },
      data: { revision: record.revision, commandId: crypto.randomUUID(), command },
    });
    expect(response.status()).toBe(200);
    record = await response.json();
  }
  return record;
}

test('owners can archive and restore drafts and active sheets from visible card, header and settings controls', async ({
  page,
}, info) => {
  await page.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  const draft = await create(page.request, 'Szkic — archiwizacja');
  const active = await create(page.request, 'Aktywna — archiwizacja', true);
  await page.goto('/');
  const filter = page.getByRole('combobox', { name: 'Twórca postaci', exact: true });
  await filter.selectOption('mine');
  const card = page.getByRole('article', { name: `Postać: ${draft.document.name}`, exact: true });
  const archiveCard = card.getByRole('button', {
    name: `Archiwizuj postać ${draft.document.name}`,
    exact: true,
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await card.screenshot({ path: info.outputPath(`archive-card-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  page.once('dialog', (dialog) => dialog.dismiss());
  await archiveCard.click();
  await expect(card).toBeVisible();
  expect((await (await page.request.get(`/api/characters/${draft.id}`)).json()).revision).toBe(
    draft.revision,
  );
  page.once('dialog', (dialog) => dialog.accept());
  await archiveCard.click();
  await expect(card).toHaveCount(0);
  await expect(page.locator('.library-feedback')).toContainText('do archiwum');
  await expect(filter).toHaveValue('mine');
  await expect(page).toHaveURL('/');
  let saved = await (await page.request.get(`/api/characters/${draft.id}`)).json();
  expect(saved.status).toBe('archived');
  expect(saved.document).toEqual(draft.document);
  await page.getByRole('button', { name: 'Archiwum', exact: true }).click();
  await expect(card).toBeVisible();
  await card
    .getByRole('button', { name: `Przywróć postać ${draft.document.name}`, exact: true })
    .click();
  await expect(card).toHaveCount(0);
  expect((await (await page.request.get(`/api/characters/${draft.id}`)).json()).status).toBe(
    'draft',
  );

  await page.goto(`/characters/${draft.id}`);
  await page.getByLabel('Historia', { exact: true }).fill('Ostatnia edycja przed archiwizacją.');
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('.sheet-actions')
    .getByRole('button', { name: 'Archiwizuj postać', exact: true })
    .click();
  await expect(page.locator('.sheet-actions .badge')).toHaveText('ARCHIWUM');
  saved = await (await page.request.get(`/api/characters/${draft.id}`)).json();
  expect(saved.status).toBe('archived');
  expect(saved.document.background).toBe('Ostatnia edycja przed archiwizacją.');
  await page
    .locator('.sheet-tabs')
    .getByRole('button', { name: 'Ustawienia', exact: true })
    .click();
  const management = page.getByRole('region', { name: 'Zarządzanie postacią' });
  await expect(
    management.getByRole('button', { name: 'Przywróć postać', exact: true }),
  ).toBeEnabled();
  await management.getByRole('button', { name: 'Przywróć postać', exact: true }).click();
  await expect(page.locator('.sheet-actions .badge')).toHaveText('SZKIC');
  await expect(
    management.getByRole('button', { name: 'Archiwizuj postać', exact: true }),
  ).toBeEnabled();

  await page.goto(`/characters/${active.id}`);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('.sheet-actions')
    .getByRole('button', { name: 'Archiwizuj postać', exact: true })
    .click();
  await expect(page.locator('.sheet-actions .badge')).toHaveText('ARCHIWUM');
  await page
    .locator('.sheet-actions')
    .getByRole('button', { name: 'Przywróć postać', exact: true })
    .click();
  await expect(page.locator('.rank-pill')).toBeVisible();
  saved = await (await page.request.get(`/api/characters/${active.id}`)).json();
  expect(saved.status).toBe('active');
  expect(saved.document).toEqual(active.document);
});

test('shared readers cannot archive; admins reveal private sheets first and GMs can manage them directly', async ({
  page,
  browser,
}) => {
  await adminLogin(page);
  const owner = await browser.newContext({ baseURL: origin });
  const reader = await browser.newContext({ baseURL: origin });
  await owner.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  await reader.request.post('/auth/dev', { form: { player: 'b' }, headers: { Origin: origin } });
  await promote(page, owner.request, 'player');
  await promote(page, reader.request, 'player');
  const record = await create(owner.request, 'Prywatna — archiwizacja', false, true);
  const viewer = await reader.newPage();
  await viewer.goto('/');
  const cardName = `Postać: ${record.document.name}`;
  await expect(
    viewer.getByRole('article', { name: cardName, exact: true }).getByRole('button'),
  ).toHaveCount(0);
  await viewer.goto(`/characters/${record.id}`);
  await expect(
    viewer.getByRole('button', { name: /Archiwizuj postać|Przywróć postać/ }),
  ).toHaveCount(0);
  await page.goto('/');
  await expect(
    page.getByRole('article', { name: cardName, exact: true }).getByRole('button'),
  ).toHaveCount(0);
  await page.goto(`/characters/${record.id}`);
  await expect(
    page.locator('.sheet-actions').getByRole('button', { name: 'Archiwizuj postać', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Odkryj prywatne szczegóły', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('.sheet-actions')
    .getByRole('button', { name: 'Archiwizuj postać', exact: true })
    .click();
  await expect(page.locator('.sheet-actions .badge')).toHaveText('ARCHIWUM');
  await page
    .locator('.sheet-actions')
    .getByRole('button', { name: 'Przywróć postać', exact: true })
    .click();
  await expect(page.locator('.sheet-actions .badge')).toHaveText('SZKIC');

  await promote(page, reader.request, 'gm');
  await viewer.goto('/');
  const gmCard = viewer.getByRole('article', { name: cardName, exact: true });
  viewer.once('dialog', (dialog) => dialog.accept());
  await gmCard
    .getByRole('button', { name: `Archiwizuj postać ${record.document.name}`, exact: true })
    .click();
  await expect(gmCard).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Archiwum', exact: true }).click();
  await gmCard
    .getByRole('button', { name: `Przywróć postać ${record.document.name}`, exact: true })
    .click();
  await expect(gmCard).toHaveCount(0);
  const after = await (await owner.request.get(`/api/characters/${record.id}`)).json();
  expect(after.status).toBe('draft');
  expect(after.document).toEqual(record.document);
  await owner.close();
  await reader.close();
});

test.afterEach(async ({ browser }) => resetPlayers(browser));
