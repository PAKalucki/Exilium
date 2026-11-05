import { PNG } from 'pngjs';
export function portraitFixture(width = 96, height = 120) {
  const image = new PNG({ width, height });
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 150;
    image.data[i + 1] = 90;
    image.data[i + 2] = 45;
    image.data[i + 3] = 255;
  }
  return PNG.sync.write(image);
}
