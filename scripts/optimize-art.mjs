import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Re-encode the existing artwork for delivery; keep the original PNG masters.
const output = new URL('../src/lib/assets/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [input, name, width] of [
    ['exilium-hero-v1.png', 'exilium-hero-1536.webp', 1536],
    ['exilium-hero-v1.png', 'exilium-hero-768.webp', 768],
    ['portrait-default-v1.png', 'portrait-default.webp', 320],
  ]) {
    const source = await readFile(new URL(`../static/images/${input}`, import.meta.url));
    const data = await page.evaluate(
      async ({ source, width }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${source}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = Math.round((image.naturalHeight * width) / image.naturalWidth);
        const context = canvas.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/webp', 0.82).split(',')[1];
      },
      { source: source.toString('base64'), width },
    );
    const bytes = Buffer.from(data, 'base64');
    await writeFile(new URL(name, output), bytes);
    console.log(`${name}: ${bytes.length} bytes (source ${source.length})`);
  }
} finally {
  await browser.close();
}
