import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { Repository } from '../src/lib/server/db';
import { execute } from '../src/lib/server/commands';
import { characterForViewer } from '../src/lib/server/visibility';
import { canCreateExtras } from '../src/lib/access';
import { newCharacter, characterSchema, newItem } from '../src/lib/rules/model';
import { changeCharacterCategory } from '../src/lib/rules/categories';
import { applyArchetype } from '../src/lib/rules/archetypes';
import {
  derived,
  validateCreation,
  integrityIssues,
  previewAdvance,
} from '../src/lib/rules/engine';
import { exportView } from '../src/lib/rules/export';

let repo: Repository, gm: string, player: string, admin: string;
beforeEach(() => {
  repo = new Repository(':memory:');
  gm = repo.user('gm-extra', 'MG').id;
  player = repo.user('player-extra', 'Gracz').id;
  admin = repo.user('admin-extra', 'Admin').id;
  repo.db.prepare("UPDATE users SET role='gm' WHERE id=?").run(gm);
  repo.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin);
});
afterEach(() => repo.db.close());
const input = (revision: number, command: unknown) => ({
  revision,
  commandId: crypto.randomUUID(),
  command,
});
const extra = () => repo.create(gm, 'Blotka', newCharacter('Blotka', 'extra'));

describe('Figura and GM-only Blotka categories', () => {
  it('defaults old and new player sheets to Figura without rewriting old database records', () => {
    const record = repo.create(player, 'Istniejąca postać');
    repo.db
      .prepare("UPDATE characters SET document=json_remove(document,'$.category') WHERE id=?")
      .run(record.id);
    const before = repo.db
      .prepare('SELECT document FROM characters WHERE id=?')
      .get(record.id)!.document;
    expect(repo.read(record.id).document.category).toBe('wildCard');
    expect(
      repo.db.prepare('SELECT document FROM characters WHERE id=?').get(record.id)!.document,
    ).toBe(before);
    expect(newCharacter().category).toBe('wildCard');
    expect(newCharacter().conditions.bennies).toBe(3);
    expect(newCharacter().privacy.statistics).toBe(false);
  });

  it('allows only the GM role to create Extras, including copies', () => {
    expect(canCreateExtras(repo.identity.user(gm))).toBe(true);
    for (const actor of [player, admin]) {
      expect(canCreateExtras(repo.identity.user(actor))).toBe(false);
      expect(() => repo.create(actor, 'Zakazana', newCharacter('Zakazana', 'extra'))).toThrow(
        'Tylko MG',
      );
    }
    expect(repo.listAll()).toHaveLength(0);
    const record = extra();
    expect(record.document.category).toBe('extra');
    expect(record.document.conditions.bennies).toBe(0);
    expect(record.document.privacy).toEqual({
      statistics: true,
      background: true,
      origin: true,
      equipment: true,
    });
  });

  it('requires a GM for draft category changes and applies private defaults on transition', () => {
    for (const actor of [player, admin]) {
      const record = repo.create(actor, 'Figura');
      const document = changeCharacterCategory(record.document, 'extra');
      expect(() =>
        execute(repo, actor, record.id, input(record.revision, { type: 'saveDraft', document })),
      ).toThrow('Tylko MG');
      expect(repo.read(record.id).document.category).toBe('wildCard');
      expect(repo.read(record.id).revision).toBe(record.revision);
    }
    const record = repo.create(gm, 'BN');
    const document = changeCharacterCategory(record.document, 'extra');
    document.privacy = newCharacter().privacy;
    const saved = execute(
      repo,
      gm,
      record.id,
      input(record.revision, { type: 'saveDraft', document }),
    );
    expect(Object.values(saved.document.privacy).every(Boolean)).toBe(true);
    const back = changeCharacterCategory(saved.document, 'wildCard');
    expect(back.conditions.bennies).toBe(3);
    expect(back.privacy).toEqual(saved.document.privacy);
  });

  it('finalizes arbitrary mundane NPC stats and equipment without point, rank or money budgets', () => {
    let record = extra();
    const document = structuredClone(record.document);
    document.build.attributes = { agility: 12, smarts: 12, spirit: 12, strength: 12, vigor: 12 };
    document.build.skills = { shooting: 12 };
    document.build.edges = [{ id: 'marksman', target: '' }];
    document.inventory = [{ ...newItem(), name: 'Wyposażenie posterunku', price: 100000 }];
    expect(validateCreation(document)).toEqual([]);
    record = execute(repo, gm, record.id, input(record.revision, { type: 'saveDraft', document }));
    record = execute(repo, gm, record.id, input(record.revision, { type: 'finalize' }));
    expect(record.status).toBe('active');
    expect(record.document.cash).toBe(0);
    expect(record.document.legacy).toBeNull();
    expect(record.document.rulings).toEqual([]);
    expect(validateCreation(newCharacter()).length).toBeGreaterThan(0);
  });

  it('lets the GM edit active Extra stats directly and keeps the category fixed after creation', () => {
    let record = extra();
    record = execute(repo, gm, record.id, input(record.revision, { type: 'finalize' }));
    const document = structuredClone(record.document);
    document.build.attributes.strength = 12;
    const saved = execute(
      repo,
      gm,
      record.id,
      input(record.revision, { type: 'saveExtra', document }),
    );
    expect(saved.status).toBe('active');
    expect(saved.document.build.attributes.strength).toBe(12);
    expect(() => execute(repo, admin, saved.id, input(saved.revision, { type: 'undo' }))).toThrow(
      'Tylko MG',
    );
    expect(repo.read(saved.id).revision).toBe(saved.revision);
    expect(() =>
      execute(repo, admin, saved.id, input(saved.revision, { type: 'saveExtra', document })),
    ).toThrow('Tylko MG');
    expect(() =>
      execute(
        repo,
        gm,
        saved.id,
        input(saved.revision, {
          type: 'saveExtra',
          document: {
            ...document,
            category: 'wildCard',
            conditions: { ...document.conditions, bennies: 3 },
          },
        }),
      ),
    ).toThrow('statystyk Blotki');
  });

  it('removes edit access when an Extra owner no longer has a game-management role', () => {
    const record = extra();
    repo.db.prepare("UPDATE users SET role='player' WHERE id=?").run(gm);
    expect(() => execute(repo, gm, record.id, input(record.revision, { type: 'archive' }))).toThrow(
      'edytować',
    );
  });

  it('eliminates an Extra at one wound, gives no wound penalty or personal Fuksy and rejects a second wound', () => {
    let record = extra();
    record = execute(repo, gm, record.id, input(record.revision, { type: 'finalize' }));
    record = execute(
      repo,
      gm,
      record.id,
      input(record.revision, { type: 'tracker', field: 'wounds', delta: 1 }),
    );
    expect(derived(record.document)).toMatchObject({
      incapacitated: true,
      woundPenalty: 0,
      bennies: 0,
    });
    expect(() =>
      execute(
        repo,
        gm,
        record.id,
        input(record.revision, { type: 'tracker', field: 'wounds', delta: 1 }),
      ),
    ).toThrow('zakres');
    expect(() =>
      execute(
        repo,
        gm,
        record.id,
        input(record.revision, { type: 'tracker', field: 'bennies', delta: 1 }),
      ),
    ).toThrow('puli fuksów MG');
    expect(
      characterSchema.safeParse({
        ...record.document,
        conditions: { ...record.document.conditions, wounds: 2 },
      }).success,
    ).toBe(false);
    record = execute(
      repo,
      gm,
      record.id,
      input(record.revision, { type: 'tracker', field: 'wounds', delta: -1 }),
    );
    expect(derived(record.document).incapacitated).toBe(false);
  });

  it('rejects XP/advances and historical baselines for Extras', () => {
    let record = extra();
    record = execute(repo, gm, record.id, input(record.revision, { type: 'finalize' }));
    expect(() =>
      execute(
        repo,
        gm,
        record.id,
        input(record.revision, { type: 'xp', amount: 5, note: 'Sesja' }),
      ),
    ).toThrow('nie korzysta');
    const choice = {
      kind: 'skill' as const,
      target: 'shooting',
      second: '',
      edgeTarget: '',
      note: '',
    };
    expect(
      previewAdvance(record.document, choice).issues.some(
        (issue) => issue.code === 'advance.extra',
      ),
    ).toBe(true);
    expect(() =>
      execute(repo, gm, record.id, input(record.revision, { type: 'advance', choice })),
    ).toThrow('bez rozwinięć');
    expect(
      characterSchema.safeParse({
        ...record.document,
        legacy: {
          xp: 0,
          spent: 0,
          attributeUsed: false,
          lastLegendaryAttribute: null,
          reason: 'Istniejąca',
        },
      }).success,
    ).toBe(false);
  });

  it('redacts Extra details for players and admins by default, but preserves the public category', () => {
    const c = newCharacter('Prywatny przeciwnik', 'extra');
    c.background = 'UKRYTE-TŁO';
    c.build.skills['knowledge:UKRYTA-WIEDZA'] = 12;
    const record = repo.create(gm, c.name, c);
    for (const actor of [player, admin]) {
      const visible = characterForViewer(record, repo.identity.user(actor));
      expect(visible.document.category).toBe('extra');
      expect(visible.redacted).toHaveLength(4);
      expect(JSON.stringify(visible)).not.toMatch(/UKRYTE-TŁO|UKRYTA-WIEDZA/);
      expect(characterSchema.safeParse(visible.document).success).toBe(true);
    }
    expect(characterForViewer(record, repo.identity.user(gm)).document).toEqual(c);
    expect(characterForViewer(record, repo.identity.user(admin), true).document).toEqual(c);
  });

  it('uses Extra mechanics in exports and book archetypes without player budget metadata', () => {
    const c = applyArchetype(newCharacter('Rębacz', 'extra'), 'brute');
    expect(c.build.attributes.strength).toBe(10);
    expect(c.build.bonus).toEqual({ attributes: 0, skills: 0, funds: 0 });
    expect(validateCreation(c)).toEqual([]);
    expect(integrityIssues(c)).toEqual([]);
    c.conditions.wounds = 1;
    const view = exportView(c);
    expect(view.background).toBe('');
    expect(view.extra).toBe(true);
    expect(view.rank).toBe('');
    expect(view.session.maxWounds).toBe(1);
    expect(view.conditions).toContain('Rany: 1/1');
    expect(view.conditions).toContain('pula MG');
    expect(view.conditions).toContain('WYELIMINOWANIE');
    expect(view.traitGroups.flatMap((group) => group.skills)).toHaveLength(3);
  });
});
