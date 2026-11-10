import { execFileSync } from 'node:child_process';
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { sample } from '../fixtures';
import { portraitFixture } from '../image-fixture';
import { newItem, type Character } from '../../src/lib/rules/model';
import { origin } from './helpers';

async function saveCharacter(page: Page, document: Character) {
  await page.request.post('/auth/dev', { form: { player: 'a' }, headers: { Origin: origin } });
  const response = await page.request.post('/api/characters', {
    headers: { Origin: origin },
    data: { name: document.name },
  });
  expect(response.status()).toBe(201);
  const record = await response.json();
  const saved = await page.request.post(`/api/characters/${record.id}`, {
    headers: { Origin: origin },
    data: {
      revision: record.revision,
      commandId: crypto.randomUUID(),
      command: { type: 'saveDraft', document },
    },
  });
  expect(saved.status()).toBe(200);
  return saved.json();
}

async function printedPdf(page: Page, info: TestInfo) {
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.compact-navigation')).toBeHidden();
  await expect(page.locator('.site-footer')).toBeHidden();
  await expect(page.locator('.print-toolbar')).toBeHidden();
  const path = info.outputPath('character-sheet.pdf');
  await page.pdf({ path, preferCSSPageSize: true, printBackground: false });
  await info.attach('Character sheet PDF', { path, contentType: 'application/pdf' });
  const metadata = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
  expect(metadata).toMatch(/Page size:\s+841\S* x 594\S* pts \(A4\)/);
  return {
    path,
    pages: Number(metadata.match(/Pages:\s+(\d+)/)?.[1]),
    text: execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' }),
  };
}

test('one print action produces a compact landscape sheet with dice, trackers and a portrait', async ({
  page,
}, info) => {
  const c = sample();
  c.conditions.wounds = 2;
  c.conditions.fatigue = 1;
  c.inventory = [
    {
      ...newItem(),
      name: 'Rewolwer z Jericho',
      kind: 'weapon',
      damage: '2k6+1',
      range: '12/24/48',
      capacity: 6,
      loaded: 4,
      reserve: 18,
      weight: 2,
      equipped: true,
    },
    { ...newItem(), name: 'Skórzany płaszcz', kind: 'armor', armor: 1, weight: 4, equipped: true },
    { ...newItem(), name: 'Narzędzia mechanika', weight: 2, notes: 'Połatana torba z Jericho.' },
  ];
  const record = await saveCharacter(page, c);
  const portrait = await page.request.post(`/api/characters/${record.id}/portrait`, {
    headers: {
      Origin: origin,
      'Content-Type': 'image/png',
      'X-Character-Revision': String(record.revision),
      'X-Command-Id': crypto.randomUUID(),
    },
    data: portraitFixture(),
  });
  expect(portrait.status()).toBe(200);
  await page.goto(`/characters/${record.id}`);
  const printLink = page.getByRole('link', { name: 'Drukuj / PDF' });
  await expect(printLink).toHaveAttribute('href', `/characters/${record.id}/print`);
  await expect(page.locator('a[href$="/pdf"]')).toHaveCount(0);
  await page.goto(`/characters/${record.id}/print`);
  await expect(page.getByRole('img', { name: `Portret: ${c.name}` })).toBeVisible();
  await expect(page.locator('.condition-boxes .marked')).toHaveCount(3);
  await expect(page.locator('.attribute-line .selected')).toHaveCount(5);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printCalled = 'yes';
    };
  });
  await page.getByRole('button', { name: 'Drukuj / zapisz PDF' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-called', 'yes');
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  // Printing from a phone must still use the full landscape layout.
  const pdf = await printedPdf(page, info);
  expect(pdf.pages).toBe(1);
  for (const text of [
    c.name,
    'Rewolwer z Jericho',
    '2k6+1',
    '12/24/48',
    'Skórzany płaszcz',
    'Narzędzia mechanika',
    'Czujny',
    'Wigor',
    'k4−2',
  ])
    expect(pdf.text).toContain(text);
  expect(pdf.text).not.toContain('Wyloguj');
  execFileSync('pdftoppm', [
    '-f',
    '1',
    '-l',
    '1',
    '-scale-to',
    '1800',
    '-png',
    '-singlefile',
    pdf.path,
    info.outputPath('character-sheet'),
  ]);
});

test('long inventories, custom skills and Polish notes continue across pages without losing their endings', async ({
  page,
}, info) => {
  const c = sample();
  c.name = 'Żaneta Źdźbło — długa karta';
  c.background = `${'Żółć i źdźbła na pustkowiu. '.repeat(300)} KONIEC HISTORII`;
  c.notes = `${'Notatki z podróży przez Morze Popiołu. '.repeat(260)} KONIEC NOTATKI — GĘŚLĄ JAŹŃ`;
  c.appearance = 'Blizna na lewym policzku, połatany płaszcz.';
  for (let i = 0; i < 28; i++)
    c.build.skills[`knowledge:Specjalizacja ${String(i).padStart(2, '0')}`] = 6;
  c.inventory = Array.from({ length: 45 }, (_, i) => ({
    ...newItem(),
    name: `Przedmiot ${i + 1}`,
    weight: 1,
    notes: `Właściwości i stan przedmiotu ${i + 1}.`,
  }));
  c.inventory.at(-1)!.notes = 'KONIEC EKWIPUNKU — ŻÓŁĆ';
  const record = await saveCharacter(page, c);
  await page.goto(`/characters/${record.id}/print`);
  const pdf = await printedPdf(page, info);
  expect(pdf.pages).toBeGreaterThan(3);
  for (const text of [
    'Specjalizacja 27',
    'KONIEC EKWIPUNKU — ŻÓŁĆ',
    'KONIEC HISTORII',
    'KONIEC NOTATKI — GĘŚLĄ JAŹŃ',
    c.appearance,
  ])
    expect(pdf.text).toContain(text);
  const text = pdf.text.replace(/\s+/g, ' ');
  expect(text.split('Notatki z podróży przez Morze Popiołu.').length - 1).toBe(260);
  for (let i = 1; i <= 45; i++) expect(text).toContain(`Przedmiot ${i}`);
});
