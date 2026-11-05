import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../src/lib/server/db';
import { copyEquipment } from '../src/lib/compendium';
import { newItem, newCharacter } from '../src/lib/rules/model';
let repo: Repository, a: string, b: string;
const document = () => ({
  category: 'Narzędzia',
  source: 'Exilium — uzgodnienie drużyny',
  item: { ...newItem(), name: 'Klucz z Jericho', price: 35, weight: 1 },
});
beforeEach(() => {
  repo = new Repository(':memory:');
  a = repo.user('100000000000000001', 'A').id;
  b = repo.user('100000000000000002', 'B').id;
});
afterEach(() => repo.db.close());
describe('persistent shared equipment compendium', () => {
  it('seeds a broad mundane catalog with book values and conditional armor kept conditional', () => {
    const entries = repo.equipment.list();
    expect(entries.length).toBe(117);
    expect(
      entries.find((e) => e.document.item.name === 'Glock (9mm)')?.document.item,
    ).toMatchObject({ price: 200, weight: 3, capacity: 17, damage: '2k6', loaded: 0, reserve: 0 });
    expect(
      entries.find((e) => e.document.item.name === 'Kamizelka refleksyjna')?.document.item,
    ).toMatchObject({ armor: 0, price: 200 });
    expect(new Set(entries.map((e) => e.document.category)).size).toBeGreaterThan(10);
  });
  it('allows a second player to edit the entry and records who changed it', () => {
    const created = repo.equipment.create(a, crypto.randomUUID(), document());
    const edited = repo.equipment.change(b, created.id, 1, crypto.randomUUID(), {
      type: 'update',
      document: { ...created.document, item: { ...created.document.item, price: 40 } },
    });
    expect(edited).toMatchObject({ createdByName: 'A', updatedByName: 'B', revision: 2 });
    expect(repo.equipment.history(created.id)[0]).toMatchObject({
      actorName: 'B',
      before: { item: { price: 35 } },
      after: { item: { price: 40 } },
    });
  });
  it('deduplicates create and update retries and rejects command ID reuse', () => {
    const input = document(),
      id = crypto.randomUUID();
    const first = repo.equipment.create(a, id, input),
      again = repo.equipment.create(a, id, input);
    expect(again.id).toBe(first.id);
    expect(repo.equipment.list().length).toBe(118);
    expect(() => repo.equipment.create(a, id, { ...input, category: 'Inna' })).toThrow(
      'innej zmiany',
    );
    const commandId = crypto.randomUUID(),
      command = {
        type: 'update',
        document: { ...first.document, item: { ...first.document.item, price: 50 } },
      };
    repo.equipment.change(b, first.id, 1, commandId, command);
    expect(repo.equipment.change(b, first.id, 1, commandId, command).revision).toBe(2);
    expect(repo.equipment.history(first.id)).toHaveLength(2);
  });
  it('rejects stale writes instead of overwriting another player', () => {
    const record = repo.equipment.create(a, crypto.randomUUID(), document());
    repo.equipment.change(b, record.id, 1, crypto.randomUUID(), {
      type: 'update',
      document: { ...record.document, item: { ...record.document.item, price: 90 } },
    });
    expect(() =>
      repo.equipment.change(a, record.id, 1, crypto.randomUUID(), {
        type: 'update',
        document: record.document,
      }),
    ).toThrow('inny gracz');
    expect(repo.equipment.read(record.id).document.item.price).toBe(90);
  });
  it('archives/restores shared entries without changing a character inventory snapshot', () => {
    const record = repo.equipment.create(a, crypto.randomUUID(), document());
    const character = newCharacter('Maaad');
    character.inventory.push(copyEquipment(record));
    const saved = repo.create(a, character.name, character);
    expect(character.inventory[0].id).not.toBe(record.id);
    const updated = repo.equipment.change(b, record.id, 1, crypto.randomUUID(), {
      type: 'update',
      document: {
        ...record.document,
        item: { ...record.document.item, price: 500, name: 'Nowy model' },
      },
    });
    const archived = repo.equipment.change(b, record.id, updated.revision, crypto.randomUUID(), {
      type: 'archive',
    });
    expect(repo.equipment.list().some((e) => e.id === record.id)).toBe(false);
    expect(repo.equipment.list(true).some((e) => e.id === record.id)).toBe(true);
    expect(() =>
      repo.equipment.change(a, record.id, archived.revision, crypto.randomUUID(), {
        type: 'update',
        document: record.document,
      }),
    ).toThrow('przywróć');
    const restored = repo.equipment.change(a, record.id, archived.revision, crypto.randomUUID(), {
      type: 'restore',
    });
    expect(restored.status).toBe('active');
    expect(repo.get(a, saved.id).document.inventory[0]).toMatchObject({
      name: 'Klucz z Jericho',
      price: 35,
    });
  });
  it('rejects invalid statistics without adding a history event', () => {
    const record = repo.equipment.create(a, crypto.randomUUID(), document());
    expect(() =>
      repo.equipment.change(a, record.id, 1, crypto.randomUUID(), {
        type: 'update',
        document: { ...record.document, item: { ...record.document.item, price: -1 } },
      }),
    ).toThrow();
    expect(repo.equipment.read(record.id).revision).toBe(1);
    expect(repo.equipment.history(record.id)).toHaveLength(1);
  });
  it('migrates an existing character database once and never overwrites edited or archived seed entries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'exilium-catalog-migration-')),
      path = join(dir, 'data.sqlite');
    let stored = new Repository(path);
    try {
      const user = stored.user('100000000000000003', 'C'),
        token = stored.createSession(user, '200000000000000001');
      const character = stored.create(user.id, 'Istniejąca karta');
      stored.db.exec(
        'DROP TABLE equipment_catalog_events; DROP TABLE equipment_catalog; DELETE FROM schema_migrations WHERE version=4;',
      );
      stored.db.close();
      stored = new Repository(path);
      expect(stored.get(user.id, character.id)).toEqual(character);
      expect(stored.session(token)?.guildId).toBe('200000000000000001');
      const seed = stored.equipment.list().find((e) => e.document.item.name === 'Plecak')!;
      const updated = stored.equipment.change(user.id, seed.id, 1, crypto.randomUUID(), {
        type: 'update',
        document: { ...seed.document, item: { ...seed.document.item, price: 123 } },
      });
      stored.equipment.change(user.id, seed.id, updated.revision, crypto.randomUUID(), {
        type: 'archive',
      });
      stored.db.close();
      stored = new Repository(path);
      expect(stored.equipment.list(true)).toHaveLength(117);
      expect(stored.equipment.read(seed.id)).toMatchObject({
        revision: 3,
        status: 'archived',
        document: { item: { price: 123 } },
      });
    } finally {
      stored.db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
