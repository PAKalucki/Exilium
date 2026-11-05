import PDFDocument from 'pdfkit';
import { resolve } from 'node:path';
import type { Character } from '../rules/model';
import { exportView } from '../rules/export';

export async function characterPdf(c: Character, portrait?: Uint8Array): Promise<Buffer> {
  const v = exportView(c),
    doc = new PDFDocument({
      size: 'A4',
      margin: 46,
      bufferPages: true,
      info: { Title: `${c.name} — Exilium`, Author: 'Exilium · Archiwum postaci' },
    });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.registerFont('regular', resolve('static/fonts/DejaVuSans.ttf'));
  doc.registerFont('bold', resolve('static/fonts/DejaVuSans-Bold.ttf'));
  const text = (value: string, bold = false, size = 9) => {
    doc
      .font(bold ? 'bold' : 'regular')
      .fontSize(size)
      .fillColor('#243a32')
      .text(value, { lineGap: 3 });
  };
  const section = (title: string, lines: string[]) => {
    if (!lines.length) return;
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.moveDown();
    text(title, true, 12);
    doc.moveDown(0.4);
    for (const line of lines) {
      text(line);
      doc.moveDown(0.35);
    }
  };
  text('EXILIUM / ARCHIWUM POSTACI', true, 10);
  doc.moveDown(0.8);
  if (portrait) {
    const top = doc.y;
    doc.image(Buffer.from(portrait), doc.page.width - 146, top, { fit: [100, 125] });
    doc
      .font('bold')
      .fontSize(24)
      .fillColor('#243a32')
      .text(v.name, 46, top, { width: doc.page.width - 225 });
    doc
      .font('regular')
      .fontSize(9)
      .text(v.description, { width: doc.page.width - 225, lineGap: 3 });
    doc.moveDown(0.5);
    doc.font('bold').text(v.advancement, { width: doc.page.width - 225, lineGap: 3 });
    doc.y = Math.max(doc.y, top + 135);
  } else {
    text(v.name, true, 24);
    text(v.description);
    doc.moveDown(0.5);
    text(v.advancement, true);
  }
  section('Wygląd', [v.appearance].filter(Boolean));
  section(
    'Współczynniki',
    v.stats.map(([a, b]) => `${a}: ${b}`),
  );
  section(
    'Cechy',
    v.attributes.map(([a, b]) => `${a}: ${b}`),
  );
  section(
    'Umiejętności',
    v.skills.map(([a, b]) => `${a}: ${b}`),
  );
  section('Stan podczas sesji', [v.conditions]);
  section('Przewagi', v.edges);
  section('Zawady', v.hindrances);
  section(
    'Ekwipunek',
    v.inventory.map((i) => `${i.name}\n${i.detail}`),
  );
  section('Zasoby', [v.funds, v.load]);
  section('Historia i motywacja', [v.background, v.motivation, v.affiliation].filter(Boolean));
  section('Notatki', [v.notes].filter(Boolean));
  section('Doświadczenie i rozwinięcia', [v.legacy, ...v.xp, ...v.history].filter(Boolean));
  section('Decyzje MG — zapis gracza', [...v.rulings, v.adjustments].filter(Boolean));
  section('Źródło i stan zapisu', [
    `Savage Worlds PL 2015 · ${v.ruleset} · ${new Date().toLocaleString('pl-PL')}`,
    'Wartości i stany są migawką zapisanej karty. Modyfikatory sytuacyjne sprawdź w opisach przewag i zawad.',
  ]);
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 15;
    doc
      .font('regular')
      .fontSize(7)
      .fillColor('#7a8372')
      .text(
        `EXILIUM · ${c.name.slice(0, 50)} · ${i + 1}/${pages.count}`,
        46,
        doc.page.height - 30,
        { lineBreak: false },
      );
  }
  doc.end();
  return done;
}
