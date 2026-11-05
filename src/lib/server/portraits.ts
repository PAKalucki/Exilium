import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { imageSize } from 'image-size';
import { DomainError, type PortraitImage } from './db';
import { PORTRAIT_UPLOAD_LIMIT } from '../portraits';

export async function portraitBody(request: Request): Promise<Buffer> {
  if (Number(request.headers.get('content-length')) > PORTRAIT_UPLOAD_LIMIT)
    throw new DomainError(413, 'Portret może mieć maksymalnie 5 MB.');
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError(400, 'Wybierz plik portretu.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > PORTRAIT_UPLOAD_LIMIT) {
        await reader.cancel();
        throw new DomainError(413, 'Portret może mieć maksymalnie 5 MB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

// Decode and re-encode raster pixels. Uploaded filenames, metadata and arbitrary markup are never served.
export function normalizePortrait(input: Buffer): PortraitImage {
  if (input.length > PORTRAIT_UPLOAD_LIMIT)
    throw new DomainError(413, 'Portret może mieć maksymalnie 5 MB.');
  try {
    const isPng = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
    if (!isPng && !isJpeg) throw new Error('format');
    const dimensions = imageSize(input);
    if (
      !dimensions.width ||
      !dimensions.height ||
      dimensions.width > 16384 ||
      dimensions.height > 16384 ||
      dimensions.width * dimensions.height > 16_000_000
    )
      throw new DomainError(
        422,
        'Portret może mieć najwyżej 16 milionów pikseli i 16384 piksele na boku.',
      );
    const image = isPng
      ? PNG.sync.read(input, { checkCRC: true })
      : jpeg.decode(input, {
          useTArray: true,
          formatAsRGBA: true,
          tolerantDecoding: false,
          maxResolutionInMP: 16,
          maxMemoryUsageInMB: 128,
        });
    const orientation =
      dimensions.orientation && dimensions.orientation >= 1 && dimensions.orientation <= 8
        ? dimensions.orientation
        : 1;
    const sw = orientation >= 5 ? image.height : image.width,
      sh = orientation >= 5 ? image.width : image.height;
    const scale = Math.min(1, 800 / sw, 800 / sh),
      width = Math.max(1, Math.round(sw * scale)),
      height = Math.max(1, Math.round(sh * scale));
    const pixels = Buffer.alloc(width * height * 4);
    const sample = (x: number, y: number, channel: number) => {
      let rx = x,
        ry = y;
      switch (orientation) {
        case 2:
          rx = image.width - 1 - x;
          break;
        case 3:
          rx = image.width - 1 - x;
          ry = image.height - 1 - y;
          break;
        case 4:
          ry = image.height - 1 - y;
          break;
        case 5:
          rx = y;
          ry = x;
          break;
        case 6:
          rx = y;
          ry = image.height - 1 - x;
          break;
        case 7:
          rx = image.width - 1 - y;
          ry = image.height - 1 - x;
          break;
        case 8:
          rx = image.width - 1 - y;
          ry = x;
          break;
      }
      const offset = (ry * image.width + rx) * 4,
        alpha = image.data[offset + 3] / 255;
      return image.data[offset + channel] * alpha + 255 * (1 - alpha);
    };
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const sx = Math.max(0, Math.min(sw - 1, ((x + 0.5) * sw) / width - 0.5)),
          sy = Math.max(0, Math.min(sh - 1, ((y + 0.5) * sh) / height - 0.5));
        const x0 = Math.floor(sx),
          y0 = Math.floor(sy),
          x1 = Math.min(sw - 1, x0 + 1),
          y1 = Math.min(sh - 1, y0 + 1),
          dx = sx - x0,
          dy = sy - y0,
          offset = (y * width + x) * 4;
        for (let ch = 0; ch < 3; ch++)
          pixels[offset + ch] = Math.round(
            (sample(x0, y0, ch) * (1 - dx) + sample(x1, y0, ch) * dx) * (1 - dy) +
              (sample(x0, y1, ch) * (1 - dx) + sample(x1, y1, ch) * dx) * dy,
          );
        pixels[offset + 3] = 255;
      }
    const data = jpeg.encode({ width, height, data: pixels }, 82).data;
    if (data.length > 1024 * 1024) throw new Error('encoded image too large');
    return { data, width, height };
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError(422, 'Nie można odczytać portretu. Wybierz poprawny obraz JPG lub PNG.');
  }
}
