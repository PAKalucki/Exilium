import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { Repository } from '../src/lib/server/db';
import { execute } from '../src/lib/server/commands';
import { characterForViewer, requirePrivateCharacterAccess } from '../src/lib/server/visibility';
import { IdentityRepository } from '../src/lib/server/identity';
import { characterSchema, newCharacter, newItem, privacySchema } from '../src/lib/rules/model';
import { derived } from '../src/lib/rules/engine';
import { exportView } from '../src/lib/rules/export';
let repo: Repository, a: string, b: string, gm: string, admin: string;
beforeEach(() => {
  repo = new Repository(':memory:');
  a = repo.user('100000000000000001', 'A').id;
  b = repo.user('100000000000000002', 'B').id;
  gm = repo.user('100000000000000003', 'MG').id;
  admin = repo.user('100000000000000004', 'Admin').id;
  repo.db.prepare("UPDATE users SET role='gm' WHERE id=?").run(gm);
  repo.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin);
});
afterEach(() => repo.db.close());
const command = (revision: number, command: unknown) => ({
  revision,
  commandId: crypto.randomUUID(),
  command,
});
function role(id: string, role: 'player' | 'gm' | 'admin', enabled = true) {
  const u = repo.identity.user(id);
  return repo.identity.change(admin, id, {
    role,
    enabled,
    expectedRole: u.role,
    expectedEnabled: !!u.enabled,
  });
}
it('defaults to player, bootstraps only the configured administrator, and protects that account', () => {
  expect(repo.identity.user(a).role).toBe('player');
  new IdentityRepository(repo.db, '100000000000000001');
  expect(repo.identity.user(a).role).toBe('admin');
  expect(repo.identity.user(b).role).toBe('player');
  const identity = new IdentityRepository(repo.db, '100000000000000001');
  expect(() =>
    identity.change(admin, a, {
      role: 'player',
      enabled: true,
      expectedRole: 'admin',
      expectedEnabled: true,
    }),
  ).toThrow('konfiguracji');
  expect(identity.history(admin).some((e) => e.actorName === null)).toBe(true);
});
it('only admins assign roles; sessions and tokens use current roles, and disable revokes both', () => {
  const session = repo.createSession(repo.identity.user(b), 'guild'),
    token = repo.identity.createToken(b, 'guild', {
      name: 'test',
      scopes: ['read', 'compendium:write'],
    });
  expect(() => repo.identity.list(gm)).toThrow('Tylko administrator');
  expect(() =>
    repo.identity.change(gm, b, {
      role: 'admin',
      enabled: true,
      expectedRole: 'player',
      expectedEnabled: true,
    }),
  ).toThrow('Tylko administrator');
  role(b, 'gm');
  expect(repo.session(session)?.role).toBe('gm');
  expect(repo.identity.token(token.token)?.role).toBe('gm');
  role(b, 'player');
  expect(repo.identity.token(token.token)?.role).toBe('player');
  expect(
    repo.db.prepare('SELECT token_hash FROM api_tokens WHERE id=?').get(token.id)?.token_hash,
  ).not.toBe(token.token);
  expect(JSON.stringify(repo.identity.tokens(b))).not.toContain(token.token);
  role(b, 'player', false);
  expect(repo.session(session)).toBe(null);
  expect(repo.identity.token(token.token)).toBe(null);
  expect(repo.identity.history(admin).length).toBe(3);
});
it('prevents stale account changes and removing the final admin without a partial write', () => {
  expect(() =>
    repo.identity.change(admin, admin, {
      role: 'gm',
      enabled: true,
      expectedRole: 'admin',
      expectedEnabled: true,
    }),
  ).toThrow('ostatniego');
  role(b, 'gm');
  expect(() =>
    repo.identity.change(admin, b, {
      role: 'admin',
      enabled: true,
      expectedRole: 'player',
      expectedEnabled: true,
    }),
  ).toThrow('Odśwież');
  expect(repo.identity.user(b).role).toBe('gm');
});
it('GMs edit other sheets with their own actor ID and cannot use user management', () => {
  const record = repo.create(a, 'Postać A');
  expect(() =>
    execute(
      repo,
      b,
      record.id,
      command(1, {
        type: 'profile',
        name: 'X',
        age: '',
        origin: '',
        caste: '',
        profession: '',
        affiliation: '',
        motivation: '',
        background: '',
        notes: '',
      }),
    ),
  ).toThrow('Tę kartę');
  const saved = execute(
    repo,
    gm,
    record.id,
    command(1, { type: 'tracker', field: 'bennies', delta: 1 }),
  );
  expect(saved.ownerId).toBe(a);
  expect(saved.document.conditions.bennies).toBe(4);
  expect(
    repo.db.prepare('SELECT actor_id FROM character_events WHERE character_id=?').get(record.id)
      ?.actor_id,
  ).toBe(gm);
  expect(() => repo.identity.list(gm)).toThrow();
});
it('redacts private sections, preserves public combat stats, and requires admins to reveal details', () => {
  const c = newCharacter('Prywatna karta');
  c.background = 'HISTORIA-TAJNA';
  c.origin = 'POCHODZENIE-TAJNE';
  c.cash = 99;
  c.inventory = [
    { ...newItem(), name: 'EKWIPUNEK-TAJNY', kind: 'armor', armor: 4, equipped: true },
  ];
  c.privacy = { statistics: false, background: true, origin: true, equipment: true };
  const record = repo.create(a, c.name, c),
    view = characterForViewer(record, repo.identity.user(b));
  expect(JSON.stringify(view)).not.toMatch(/HISTORIA-TAJNA|POCHODZENIE-TAJNE|EKWIPUNEK-TAJNY/);
  expect(view.document.inventory).toEqual([]);
  expect(view.document.cash).toBe(0);
  expect(view.visibleStats?.totalToughness).toBe(derived(c).totalToughness);
  expect(exportView(view.document, view.visibleStats).background).toContain('ukryta');
  for (const actor of [a, gm])
    expect(characterForViewer(record, repo.identity.user(actor)).document).toEqual(c);
  expect(characterForViewer(record, repo.identity.user(admin))).toEqual(view);
  expect(characterForViewer(record, repo.identity.user(admin), true).document).toEqual(c);
  expect(characterForViewer(record, repo.identity.user(b), true)).toEqual(view);
  for (const section of ['background', 'origin', 'equipment'] as const) {
    const single = structuredClone(record);
    single.document.privacy = privacySchema.parse({});
    single.document.privacy[section] = true;
    const filtered = characterForViewer(single, repo.identity.user(b));
    expect(filtered.redacted).toEqual([section]);
    if (section !== 'background') expect(filtered.document.background).toBe(c.background);
    if (section !== 'origin') expect(filtered.document.origin).toBe(c.origin);
    if (section !== 'equipment') expect(filtered.document.inventory).toEqual(c.inventory);
  }
  expect(record.document.background).toBe(c.background);
});

it.each(
  Array.from({ length: 16 }, (_, mask) => ({
    statistics: !!(mask & 1),
    origin: !!(mask & 2),
    background: !!(mask & 4),
    equipment: !!(mask & 8),
  })),
)('keeps all four privacy settings independent: %j', (privacy) => {
  const c = newCharacter('Niezależna prywatność');
  c.privacy = privacy;
  c.background = 'PRYWATNA-HISTORIA';
  c.origin = 'PRYWATNE-POCHODZENIE';
  c.build.attributes.strength = 12;
  c.build.skills['knowledge:PRYWATNA-WIEDZA'] = 10;
  c.build.edges = [{ id: 'alertness', target: '' }];
  c.build.hindrances = [{ id: 'enemy', severity: 2 }];
  c.conditions.wounds = 2;
  c.xp = [
    { id: crypto.randomUUID(), amount: 50, note: 'PRYWATNE-PD', date: new Date().toISOString() },
  ];
  c.legacy = {
    xp: 20,
    spent: 4,
    attributeUsed: false,
    lastLegendaryAttribute: null,
    reason: 'PRYWATNA-PODSTAWA',
  };
  c.advances = [
    {
      id: crypto.randomUUID(),
      kind: 'newSkill',
      target: 'repair',
      second: '',
      edgeTarget: '',
      note: 'PRYWATNY-ROZWÓJ',
      xp: 25,
      rank: 1,
      date: new Date().toISOString(),
    },
  ];
  c.rulings = [
    {
      id: crypto.randomUUID(),
      code: 'test',
      reason: 'PRYWATNA-DECYZJA',
      ruling: 'PRYWATNE-USTALENIE',
      date: new Date().toISOString(),
    },
  ];
  c.adjustments = { parry: 1, toughness: 2, pace: 1, charisma: 2, reason: 'PRYWATNA-KOREKTA' };
  c.cash = 99;
  c.inventory = [
    {
      ...newItem(),
      name: 'PUBLICZNY-PRZEDMIOT',
      weight: 5,
      kind: 'armor',
      armor: 4,
      equipped: true,
    },
  ];
  const record = repo.create(a, c.name, c);
  for (const actor of [b, admin]) {
    const view = characterForViewer(record, repo.identity.user(actor));
    const exported = exportView(view.document, view.visibleStats, view.redacted);
    expect(view.redacted?.sort()).toEqual(
      Object.keys(privacy)
        .filter((key) => privacy[key as keyof typeof privacy])
        .sort(),
    );
    expect(view.document.background).toBe(privacy.background ? '' : c.background);
    expect(view.document.origin).toBe(privacy.origin ? '' : c.origin);
    expect(view.document.inventory).toEqual(privacy.equipment ? [] : c.inventory);
    expect(view.document.cash).toBe(privacy.equipment ? 0 : 99);
    expect(exported.statisticsHidden).toBe(privacy.statistics);
    expect(exported.funds.includes('ukryte')).toBe(privacy.equipment);
    if (privacy.statistics) {
      expect(JSON.stringify(view)).not.toMatch(
        /PRYWATN[AEY]-(WIEDZA|PD|PODSTAWA|ROZWÓJ|DECYZJA|USTALENIE|KOREKTA)/,
      );
      expect(view.document.build).toEqual(newCharacter().build);
      expect(view.document.conditions).toEqual(newCharacter().conditions);
      expect(view.document.adjustments).toEqual(newCharacter().adjustments);
      expect(view.document.legacy).toBeNull();
      for (const key of ['xp', 'advances', 'rulings'] as const)
        expect(view.document[key]).toEqual([]);
      expect(view.visibleStats).toBeUndefined();
      expect(exported.traitGroups).toEqual([]);
      expect(exported.combatStats).toEqual([]);
      expect(exported.conditions).toBe('');
      expect(exported.load).not.toContain('udźwig');
    } else {
      expect(view.document.build).toEqual(c.build);
      expect(view.document.xp).toEqual(c.xp);
      expect(exported.stats[1][1]).toContain(String(derived(c).totalToughness));
    }
  }
  for (const actor of [a, gm])
    expect(characterForViewer(record, repo.identity.user(actor))).toEqual(record);
  expect(characterForViewer(record, repo.identity.user(admin), true)).toEqual(record);
  expect(repo.read(record.id).document).toEqual(c);
});

it('requires explicit admin reveal for edits/copies, but never for owners or GMs', () => {
  const c = newCharacter();
  c.privacy.statistics = true;
  const record = repo.create(a, c.name, c);
  expect(() => requirePrivateCharacterAccess(record, repo.identity.user(admin))).toThrow(
    'Najpierw odkryj',
  );
  expect(() =>
    requirePrivateCharacterAccess(record, repo.identity.user(admin), true),
  ).not.toThrow();
  for (const actor of [a, gm])
    expect(() => requirePrivateCharacterAccess(record, repo.identity.user(actor))).not.toThrow();
  const own = repo.create(admin, c.name, c);
  expect(characterForViewer(own, repo.identity.user(admin))).toEqual(own);
  expect(() => requirePrivateCharacterAccess(own, repo.identity.user(admin))).not.toThrow();
  c.privacy.statistics = false;
  expect(() =>
    requirePrivateCharacterAccess({ ...record, document: c }, repo.identity.user(admin)),
  ).not.toThrow();
});

it('loads pre-statistics privacy without changing existing flags', () => {
  const c = newCharacter();
  const old = { ...c, privacy: { background: true, origin: false, equipment: true } };
  expect(characterSchema.parse(old).privacy).toEqual({ ...old.privacy, statistics: false });
});
it('players submit pending entries; only GM/admin approve, with stale review protection and owner resubmission', () => {
  const doc = { category: 'Narzędzia', source: 'Gracz', item: { ...newItem(), name: 'Wiertło' } };
  let entry = repo.equipment.create(a, crypto.randomUUID(), doc);
  expect(entry.approvalStatus).toBe('pending');
  expect(repo.equipment.list()).not.toContainEqual(entry);
  expect(repo.equipment.list(true, b)).not.toContainEqual(entry);
  expect(() => repo.equipment.read(entry.id, b)).toThrow('Nie znaleziono');
  expect(() =>
    repo.equipment.change(a, entry.id, 1, crypto.randomUUID(), { type: 'approve' }),
  ).toThrow('MG');
  entry = repo.equipment.change(gm, entry.id, 1, crypto.randomUUID(), {
    type: 'reject',
    note: 'Popraw cenę',
  });
  expect(entry.reviewNote).toBe('Popraw cenę');
  expect(entry.approvalStatus).toBe('rejected');
  entry = repo.equipment.change(a, entry.id, 2, crypto.randomUUID(), {
    type: 'update',
    document: doc,
  });
  expect(entry.approvalStatus).toBe('pending');
  expect(() =>
    repo.equipment.change(gm, entry.id, 2, crypto.randomUUID(), { type: 'approve' }),
  ).toThrow('inny gracz');
  entry = repo.equipment.change(admin, entry.id, 3, crypto.randomUUID(), { type: 'approve' });
  expect(repo.equipment.list()).toContainEqual(entry);
  expect(() =>
    repo.equipment.change(a, entry.id, 4, crypto.randomUUID(), { type: 'update', document: doc }),
  ).toThrow('MG');
  expect(repo.equipment.history(entry.id).map((e) => e.kind)).toEqual([
    'approve',
    'update',
    'reject',
    'create',
  ]);
});
it('revokes only owned tokens and enforces expiry', () => {
  const token = repo.identity.createToken(a, 'guild', { name: 'read', scopes: ['read'], days: 1 });
  repo.identity.revokeToken(b, token.id);
  expect(repo.identity.token(token.token)?.id).toBe(a);
  repo.db.prepare('UPDATE api_tokens SET expires_at=? WHERE id=?').run(Date.now() - 1, token.id);
  expect(repo.identity.token(token.token)).toBeNull();
  expect(repo.identity.token('invalid')).toBeNull();
});

it('bootstraps the configured admin on their first sign-in after an empty database starts', () => {
  const previous = process.env.DEPLOYMENT_ADMIN_DISCORD_ID;
  process.env.DEPLOYMENT_ADMIN_DISCORD_ID = '100000000000000099';
  const empty = new Repository(':memory:');
  try {
    expect(empty.user('100000000000000098', 'Other').role).toBe('player');
    expect(empty.user('100000000000000099', 'Owner').role).toBe('admin');
  } finally {
    empty.db.close();
    if (previous === undefined) delete process.env.DEPLOYMENT_ADMIN_DISCORD_ID;
    else process.env.DEPLOYMENT_ADMIN_DISCORD_ID = previous;
  }
});

it('upgrades the deployed schema-4 database atomically, preserving sessions, sheets and catalog edits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'exilium-roles-migration-')),
    file = join(dir, 'data.sqlite');
  let stored = new Repository(file);
  try {
    const user = stored.user('100000000000000088', 'Existing player'),
      session = stored.createSession(user, 'campaign');
    const saved = stored.create(user.id, 'Existing sheet');
    const seed = stored.equipment.list()[0];
    const item = { ...seed.document, item: { ...seed.document.item, price: 321 } };
    stored.db
      .prepare('UPDATE equipment_catalog SET document=? WHERE id=?')
      .run(JSON.stringify(item), seed.id);
    stored.db
      .exec(`DROP TABLE api_tokens; DROP TABLE user_events; ALTER TABLE users DROP COLUMN role;
      ALTER TABLE equipment_catalog DROP COLUMN approval_status; ALTER TABLE equipment_catalog DROP COLUMN review_note;
      ALTER TABLE equipment_catalog_events DROP COLUMN review_note; DELETE FROM schema_migrations WHERE version=5;
      UPDATE characters SET document=json_remove(document,'$.privacy');`);
    stored.db.close();
    stored = new Repository(file);
    expect(stored.session(session)).toMatchObject({
      id: user.id,
      guildId: 'campaign',
      role: 'player',
    });
    expect(stored.read(saved.id).document).toEqual(saved.document);
    expect(stored.equipment.read(seed.id)).toMatchObject({
      approvalStatus: 'approved',
      document: { item: { price: 321 } },
    });
    expect(stored.equipment.list()).toHaveLength(117);
    stored.db.close();
    stored = new Repository(file);
    expect(
      stored.db.prepare('SELECT count(*) n FROM schema_migrations WHERE version=5').get()?.n,
    ).toBe(1);
    expect(stored.session(session)?.role).toBe('player');
  } finally {
    stored.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
