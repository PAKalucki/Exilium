import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { imageSize } from 'image-size';
import { normalizePortrait, portraitBody } from '../src/lib/server/portraits';
import { Repository } from '../src/lib/server/db';
import { execute } from '../src/lib/server/commands';
import { characterSchema } from '../src/lib/rules/model';
import { PORTRAIT_UPLOAD_LIMIT } from '../src/lib/portraits';
import { sample } from './fixtures';

import { portraitFixture } from './image-fixture';
describe('private portrait uploads', () => {
  it('decodes and resizes a PNG into a clean JPEG while preserving portrait proportions', () => {
    const p = normalizePortrait(portraitFixture(1000, 1500));
    expect(p).toMatchObject({ width: 533, height: 800 });
    expect(imageSize(p.data)).toMatchObject({ type: 'jpg', width: 533, height: 800 });
    expect(p.data.length).toBeLessThan(1024 * 1024);
  });
  it('honors camera EXIF orientation and removes source comments and metadata', () => {
    const jpg = jpeg.encode(
      {
        width: 3,
        height: 2,
        data: Buffer.alloc(3 * 2 * 4, 255),
        comments: ['PRIVATE CAMERA COMMENT'],
      },
      80,
    ).data;
    const exif = Buffer.from(
      '45786966000049492a0008000000010012010300010000000600000000000000',
      'hex',
    );
    const marker = Buffer.alloc(4);
    marker[0] = 255;
    marker[1] = 225;
    marker.writeUInt16BE(exif.length + 2, 2);
    const result = normalizePortrait(
      Buffer.concat([jpg.subarray(0, 2), marker, exif, jpg.subarray(2)]),
    );
    expect(result).toMatchObject({ width: 2, height: 3 });
    expect(Buffer.from(result.data).includes(Buffer.from('PRIVATE CAMERA COMMENT'))).toBe(false);
    expect(imageSize(result.data).orientation).toBeUndefined();
  });
  it('rejects SVGs, malformed raster files, oversized images and oversized streams', async () => {
    expect(() => normalizePortrait(Buffer.from('<svg onload="alert(1)"></svg>'))).toThrow(
      'JPG lub PNG',
    );
    expect(() => normalizePortrait(Buffer.from([255, 216, 255, 0]))).toThrow('JPG lub PNG');
    expect(() => normalizePortrait(Buffer.alloc(PORTRAIT_UPLOAD_LIMIT + 1))).toThrow('5 MB');
    const huge = portraitFixture();
    huge.writeUInt32BE(16385, 16);
    expect(() => normalizePortrait(huge)).toThrow('16 milionów');
    await expect(
      portraitBody(
        new Request('http://local/', {
          method: 'POST',
          body: new Uint8Array(PORTRAIT_UPLOAD_LIMIT + 1),
        }),
      ),
    ).rejects.toThrow('5 MB');
  });
  it('keeps uploads atomic, deduplicates retry, checks ownership and retains old bytes for undo', () => {
    const repo = new Repository(':memory:');
    try {
      const a = repo.user('100000000000000001', 'A'),
        b = repo.user('100000000000000002', 'B'),
        record = repo.create(a.id, 'Portret', sample()),
        image = normalizePortrait(portraitFixture()),
        commandId = crypto.randomUUID();
      const saved = repo.attachPortrait(
          a.id,
          record.id,
          record.revision,
          commandId,
          'digest',
          image,
        ),
        id = saved.document.portraitId!;
      repo.attachPortrait(a.id, record.id, record.revision, commandId, 'digest', image);
      expect(repo.db.prepare('SELECT count(*) n FROM portrait_images').get()?.n).toBe(1);
      expect(repo.portrait(a.id, id).width).toBe(96);
      expect(() => repo.portrait(b.id, id)).toThrow('Nie znaleziono');
      expect(() =>
        repo.attachPortrait(b.id, record.id, 1, crypto.randomUUID(), 'digest', image),
      ).toThrow('Tę kartę');
      const other = repo.create(b.id, 'B', sample());
      other.document.portraitId = id;
      expect(() =>
        execute(repo, b.id, other.id, {
          revision: other.revision,
          commandId: crypto.randomUUID(),
          command: { type: 'saveDraft', document: other.document },
        }),
      ).toThrow('Nie znaleziono');
      const removed = execute(repo, a.id, record.id, {
        revision: saved.revision,
        commandId: crypto.randomUUID(),
        command: { type: 'removePortrait' },
      });
      expect(removed.document.portraitId).toBeNull();
      const undone = execute(repo, a.id, record.id, {
        revision: removed.revision,
        commandId: crypto.randomUUID(),
        command: { type: 'undo' },
      });
      expect(undone.document.portraitId).toBe(id);
      expect(repo.portrait(a.id, id).data.length).toBeGreaterThan(0);
    } finally {
      repo.db.close();
    }
  });
  it('opens older saved character documents without requiring new fields', () => {
    const old: Record<string, unknown> = sample();
    delete old.appearance;
    delete old.portraitId;
    expect(characterSchema.parse(old)).toMatchObject({ appearance: '', portraitId: null });
  });
});
