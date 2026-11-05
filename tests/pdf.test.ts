import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { characterPdf } from '../src/lib/server/pdf';
import { sample } from './fixtures';
import { portraitFixture } from './image-fixture';
import { normalizePortrait } from '../src/lib/server/portraits';
describe('PDF export', () => {
  it('embeds Polish text and paginates long content without truncating the final note', async () => {
    const c = sample();
    c.background = 'Żółć, źdźbło, łąka. '.repeat(1200);
    c.notes = 'KONIEC NOTATKI — GĘŚLĄ JAŹŃ';
    c.appearance = 'Blizna na lewym policzku, połatany płaszcz.';
    const pdf = await characterPdf(c, normalizePortrait(portraitFixture()).data);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.includes(Buffer.from('/Subtype /Image'))).toBe(true);
    const directory = mkdtempSync(join(tmpdir(), 'exilium-pdf-'));
    try {
      const filename = join(directory, 'sheet.pdf');
      writeFileSync(filename, pdf);
      const text = execFileSync('pdftotext', [filename, '-'], { encoding: 'utf8' });
      expect(text).toContain('Łucja Żelazna');
      expect(text).toContain('KONIEC NOTATKI');
      expect(text).toContain('GĘŚLĄ JAŹŃ');
      expect(text).toContain('Blizna na lewym policzku');
      const info = execFileSync('pdfinfo', [filename], { encoding: 'utf8' });
      expect(Number(info.match(/Pages:\s+(\d+)/)?.[1])).toBeGreaterThan(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
