import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../src/lib/server/db';
import { newItem } from '../src/lib/rules/model';
import { snapshot } from '../scripts/backup.mjs';
import { restore } from '../scripts/restore.mjs';
import { sample } from './fixtures';
import { portraitFixture } from './image-fixture';
import { normalizePortrait } from '../src/lib/server/portraits';
describe('operational recovery', () => {
  it('backs up committed WAL state and restores characters and history without restoring sessions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exilium-recovery-'));
    const repo = new Repository(join(dir, 'live.sqlite'));
    try {
      const user = repo.user('100000000000000001', 'Łucja'),
        token = repo.createSession(user),
        record = repo.create(user.id, 'Łucja', sample());
      repo.mutate(
        user.id,
        record.id,
        1,
        crypto.randomUUID(),
        { type: 'tracker' },
        (r) => (r.document.conditions.wounds = 2),
      );
      const portrait = repo.attachPortrait(
        user.id,
        record.id,
        2,
        crypto.randomUUID(),
        'backup-fixture',
        normalizePortrait(portraitFixture()),
      );
      repo.mutate(
        user.id,
        record.id,
        portrait.revision,
        crypto.randomUUID(),
        { type: 'appearance' },
        (r) => {
          r.document.appearance = 'Blizna na policzku, krótko ścięte włosy.';
        },
      );
      const apiToken = repo.identity.createToken(user.id, 'guild', {
        name: 'backup',
        scopes: ['read'],
      });
      const backup = join(dir, 'snapshot.sqlite');
      const catalogEntry = repo.equipment.create(user.id, crypto.randomUUID(), {
        category: 'Narzędzia',
        source: 'Exilium — zapis drużyny',
        item: { ...newItem(), name: 'Lutownica z warsztatu', price: 42 },
      });
      repo.equipment.change(user.id, catalogEntry.id, 1, crypto.randomUUID(), { type: 'archive' });
      await snapshot(join(dir, 'live.sqlite'), backup);
      expect(statSync(backup).mode & 0o777).toBe(0o600);
      expect(repo.session(token)).not.toBeNull();
      const restoredFile = restore(backup, join(dir, 'restored.sqlite')),
        restored = new Repository(restoredFile);
      try {
        expect(restored.get(user.id, record.id).document.conditions.wounds).toBe(2);
        expect(restored.history(user.id, record.id)).toHaveLength(3);
        const restoredCharacter = restored.get(user.id, record.id).document;
        expect(restoredCharacter.appearance).toContain('Blizna');
        expect(restored.portrait(user.id, restoredCharacter.portraitId!).width).toBe(96);
        expect(restored.session(token)).toBeNull();
        expect(restored.identity.token(apiToken.token)).toBeNull();
        expect(restored.equipment.read(catalogEntry.id)).toMatchObject({
          status: 'archived',
          document: { item: { price: 42 } },
        });
        expect(restored.equipment.history(catalogEntry.id)).toHaveLength(2);
        expect(restored.equipment.list(true)).toHaveLength(repo.equipment.list(true).length);
      } finally {
        restored.db.close();
      }
      expect(() => restore(backup, join(dir, 'live.sqlite'))).toThrow('empty destination');
    } finally {
      repo.db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
