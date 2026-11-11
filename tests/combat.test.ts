import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { Repository } from '../src/lib/server/db';
import { execute } from '../src/lib/server/commands';
import {
  actionCards,
  compareCards,
  initiativeUnitSchema,
  jokerBonus,
  type CombatCommand,
  type CombatDocument,
  type CombatRecord,
} from '../src/lib/combat';
import {
  cardZones,
  damageOutcome,
  dealRound,
  drawInitiative,
  combatParry,
  newCombat,
  selectNext,
  startCombat,
} from '../src/lib/rules/combat';
import { newCharacter } from '../src/lib/rules/model';
import { sample } from './fixtures';

const uuid = () => crypto.randomUUID();
const input = <T>(revision: number, command: T, commandId = uuid()) => ({
  revision,
  commandId,
  command,
});
function unit(characterId: string, overrides = {}) {
  return initiativeUnitSchema.parse({
    id: uuid(),
    name: 'Grupa',
    members: [characterId],
    leaderId: characterId,
    side: 'players',
    ...overrides,
  });
}
function deckFirst(cards: string[]) {
  return [...cards, ...actionCards.filter((card) => !cards.includes(card))];
}
const unchangedShuffle = () => 0.999999;
describe('SW PL 2015 initiative and damage', () => {
  it('uses the 2015 prone Parry and never reduces Parry with a low Full Defense roll', () => {
    const p = {
      prone: false,
      defending: false,
      wildAttack: false,
      fullDefense: null as number | null,
    };
    expect(combatParry(7, { ...p, prone: true })).toBe(2);
    expect(combatParry(7, { ...p, fullDefense: 3 })).toBe(7);
    expect(combatParry(7, { ...p, fullDefense: 11 })).toBe(11);
    expect(combatParry(7, { ...p, wildAttack: true })).toBe(5);
  });
  it('uses 54 unique cards, descending rank and spade/heart/diamond/club tie breaks', () => {
    expect(new Set(actionCards).size).toBe(54);
    expect(['2S', '14C', '13S', '14D', '14H', '14S', 'JR'].sort(compareCards)).toEqual([
      'JR',
      '14S',
      '14H',
      '14D',
      '14C',
      '13S',
      '2S',
    ]);
  });
  it('chooses Level Headed cards before applying Quick and keeps every discarded card', () => {
    const c = newCombat('Test'),
      character = newCharacter();
    character.build.edges = [
      { id: 'level-headed', target: '' },
      { id: 'quick', target: '' },
    ];
    c.deck = deckFirst(['2S', '5H', '4D', '6C']);
    const hand = drawInitiative(c, character, unchangedShuffle);
    expect(hand).toEqual({ card: '6C', draws: ['2S', '5H', '4D', '6C'] });
    expect(c.discard).toEqual(['2S', '5H', '4D']);
    expect(new Set([...c.deck, ...c.discard, hand.card]).size).toBe(54);
  });
  it('gives Improved Level Headed three cards and treats any drawn Joker as a reshuffle trigger', () => {
    const c = newCombat('Test'),
      character = newCharacter();
    character.build.edges = [
      { id: 'improved-level-headed', target: '' },
      { id: 'quick', target: '' },
    ];
    c.deck = deckFirst(['JR', 'JB', '14S']);
    const hand = drawInitiative(c, character, unchangedShuffle);
    expect(hand.draws).toHaveLength(3);
    expect(hand.card).toMatch(/^J/);
    expect(c.shuffleAfterRound).toBe(true);
  });
  it('retains a held Joker across rounds without extending its bonus or duplicating reserved cards', () => {
    const c = newCombat('Test'),
      a = uuid(),
      b = uuid();
    c.phase = 'active';
    c.round = 1;
    c.shuffleAfterRound = true;
    c.units = [
      unit(a, { card: 'JR', cardRound: 1, state: 'held' }),
      unit(b, { card: '14S', cardRound: 1, state: 'done' }),
    ];
    c.reserve = ['13H'];
    c.deck = actionCards.filter((card) => !['JR', '14S', '13H'].includes(card));
    dealRound(
      c,
      new Map([
        [a, newCharacter()],
        [b, newCharacter()],
      ]),
      unchangedShuffle,
    );
    expect(c.units[0].card).toBe('JR');
    expect(c.units[0].state).toBe('held');
    expect(jokerBonus(c.units[0], 2)).toBe(false);
    expect(cardZones(c).sort()).toEqual([...actionCards].sort());
    expect(c.units[1].card).not.toBe('13H');
  });
  it('starts ambushers on Hold and gives surprised characters a first-round card only on Notice success', () => {
    const c = newCombat('Test'),
      ids = [uuid(), uuid(), uuid()];
    c.units = [
      unit(ids[0], { opening: 'ambush' }),
      unit(ids[1], { opening: 'surprised', notice: 3 }),
      unit(ids[2], { opening: 'surprised', notice: 4 }),
    ];
    const characters = new Map(ids.map((id) => [id, newCharacter()]));
    startCombat(c, characters, unchangedShuffle, null, 0);
    expect(c.units[0]).toMatchObject({ state: 'held', card: null });
    expect(c.units[1]).toMatchObject({ state: 'skipped', card: null });
    expect(c.units[2].card).not.toBeNull();
    c.units[2].state = 'done';
    dealRound(c, characters, unchangedShuffle);
    expect(c.units[1].card).not.toBeNull();
    expect(cardZones(c).sort()).toEqual([...actionCards].sort());
  });
  it('forces a Shaken held actor to act after another turn and resumes interrupted turns in stack order', () => {
    const c = newCombat('Test'),
      ids = [uuid(), uuid(), uuid()];
    c.round = 1;
    c.units = [
      unit(ids[0], { card: '12S', state: 'done' }),
      unit(ids[1], { card: '8S', state: 'held' }),
      unit(ids[2], { card: '7H', state: 'waiting' }),
    ];
    const characters = new Map(ids.map((id) => [id, newCharacter()]));
    characters.get(ids[1])!.conditions.shaken = true;
    c.resumeIds = [c.units[2].id];
    selectNext(c, characters, true);
    expect(c.currentId).toBe(c.units[1].id);
    c.units[1].state = 'done';
    selectNext(c, characters, true);
    expect(c.currentId).toBe(c.units[2].id);
  });
  it('reserves Tactician cards outside the deck before ordinary initiative', () => {
    const c = newCombat('Test'),
      id = uuid(),
      character = newCharacter();
    character.build.edges = [{ id: 'tactician', target: '' }];
    c.units = [unit(id)];
    startCombat(c, new Map([[id, character]]), unchangedShuffle, id, 8);
    expect(c.reserve).toHaveLength(2);
    expect(c.reserve).not.toContain(c.units[0].card);
    expect(cardZones(c).sort()).toEqual([...actionCards].sort());
  });
  it('conserves the deck through 200 rounds with Quick, Level Headed, held cards and reshuffles', () => {
    const c = newCombat('Długie starcie'),
      ids = Array.from({ length: 8 }, uuid);
    const characters = new Map(
      ids.map((id, index) => {
        const character = newCharacter();
        character.build.edges =
          index % 2
            ? [
                { id: 'quick', target: '' },
                { id: 'level-headed', target: '' },
              ]
            : [];
        return [id, character] as const;
      }),
    );
    c.units = ids.map((id) => unit(id));
    let seed = 42;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    startCombat(c, characters, rng, null, 0);
    for (let round = 1; round < 200; round++) {
      for (const u of c.units) u.state = rng() < 0.15 ? 'held' : 'done';
      dealRound(c, characters, rng);
      expect(cardZones(c).sort()).toEqual([...actionCards].sort());
    }
  });
  it('applies repeated damage-Shaken as one wound but does not add a wound to a raised hit', () => {
    const character = newCharacter();
    character.conditions.shaken = true;
    expect(damageOutcome(character, 7, 5).conditions.wounds).toBe(1);
    expect(damageOutcome(character, 13, 5).conditions.wounds).toBe(2);
    expect(damageOutcome(character, 4, 5).conditions).toEqual(character.conditions);
  });
  it('incapacitates a Wild Card only beyond three wounds and an Extra on its first wound', () => {
    const character = newCharacter();
    expect(damageOutcome(character, 17, 5).conditions).toMatchObject({
      wounds: 3,
      incapacitated: false,
    });
    expect(damageOutcome(character, 21, 5).conditions).toMatchObject({
      wounds: 3,
      incapacitated: true,
    });
    expect(damageOutcome(newCharacter('BN', 'extra'), 9, 5).conditions).toMatchObject({
      wounds: 1,
      incapacitated: true,
    });
  });
  it('clears all Shaken when every wound from the hit is Soaked and rejects excessive Soak', () => {
    const character = newCharacter();
    character.conditions.shaken = true;
    expect(damageOutcome(character, 13, 5, 2).conditions).toMatchObject({
      wounds: 0,
      shaken: false,
    });
    expect(damageOutcome(character, 13, 5, 1).conditions).toMatchObject({
      wounds: 1,
      shaken: true,
    });
    expect(() => damageOutcome(character, 9, 5, 2)).toThrow('więcej');
  });
});

let repo: Repository, gm: string, player: string, admin: string;
beforeEach(() => {
  repo = new Repository(':memory:');
  gm = repo.user('combat-gm', 'MG').id;
  player = repo.user('combat-player', 'Gracz').id;
  admin = repo.user('combat-admin', 'Admin').id;
  repo.db.prepare("UPDATE users SET role='gm' WHERE id=?").run(gm);
  repo.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin);
});
afterEach(() => repo.db.close());
function character(owner = player, extra = false) {
  const document = extra ? newCharacter('Strażnik', 'extra') : sample();
  const r = repo.create(owner, document.name, document);
  return execute(repo, owner, r.id, input(r.revision, { type: 'finalize' }));
}
function create() {
  return repo.combat.create(gm, { name: 'Potyczka', commandId: uuid() });
}
function change(r: CombatRecord, command: CombatCommand, actor = gm, reveal = false) {
  return repo.combat.change(actor, r.id, input(r.revision, command), reveal);
}
function add(
  r: CombatRecord,
  characterId: string,
  side: 'players' | 'gm' = 'players',
  unitId?: string,
) {
  return change(r, { type: 'add', characterId, side, ...(unitId ? { unitId } : {}) });
}
function start(r: CombatRecord) {
  return change(r, { type: 'start', gmBennies: 2, tacticianId: null, tacticsResult: 0 });
}
function setDocument(r: CombatRecord, patch: (c: CombatDocument) => void) {
  patch(r.document);
  repo.db.prepare('UPDATE combats SET document=? WHERE id=?').run(JSON.stringify(r.document), r.id);
  return repo.combat.read(r.id);
}
describe('combat persistence, linked sheets and access', () => {
  it('lets Tactician detach Extra allies for a separate card and rejoins them after their turn', () => {
    const a = character(gm, true),
      b = character(gm, true);
    const document = structuredClone(a.document);
    document.build.edges.push({ id: 'tactician', target: '' });
    execute(repo, gm, a.id, input(a.revision, { type: 'saveExtra', document }));
    let r = add(create(), a.id, 'gm');
    const host = r.document.units[0].id;
    r = add(r, b.id, 'gm', host);
    r = change(r, { type: 'start', gmBennies: 2, tacticianId: a.id, tacticsResult: 8 });
    r = change(r, { type: 'tactic', unitId: host, card: r.document.reserve[0], memberIds: [b.id] });
    expect(r.document.units).toHaveLength(2);
    const split = r.document.units.find((u) => u.returnTo === host)!;
    expect(split.members).toEqual([b.id]);
    expect(r.document.units.find((u) => u.id === host)!.members).toEqual([a.id]);
    r = setDocument(r, (c) => {
      for (const u of c.units) u.state = 'done';
      c.currentId = null;
    });
    r = change(r, { type: 'nextRound' });
    expect(r.document.units).toHaveLength(1);
    expect(r.document.units[0].members.sort()).toEqual([a.id, b.id].sort());
    expect(cardZones(r.document).sort()).toEqual([...actionCards].sort());
    if (r.document.awaitingTactics) r = change(r, { type: 'ready' });
    expect(r.document.awaitingTactics).toBe(false);
  });
  it('resolves a Tactician replacement before starting a turn and keeps defense until the actual turn starts', () => {
    const a = character(gm, true),
      b = character(gm, true);
    const document = structuredClone(a.document);
    document.build.edges.push({ id: 'tactician', target: '' });
    execute(repo, gm, a.id, input(a.revision, { type: 'saveExtra', document }));
    let r = add(add(create(), a.id, 'gm'), b.id, 'gm');
    r = change(r, { type: 'start', gmBennies: 2, tacticianId: a.id, tacticsResult: 8 });
    expect(r.document.awaitingTactics).toBe(true);
    expect(r.document.currentId).toBeNull();
    expect(r.document.reserve).toHaveLength(2);
    expect(() => change(r, { type: 'nextRound' })).toThrow('Taktyka');
    r = change(r, { type: 'fullDefense', characterId: b.id, result: 11 });
    const target = r.document.units.find((u) => u.leaderId === b.id)!;
    // A Joker cannot be a retained held card in this first-round setup.
    r = change(r, { type: 'tactic', unitId: target.id, card: r.document.reserve[0] });
    expect(r.document.awaitingTactics).toBe(false);
    expect(r.document.tacticUsedRound).toBe(1);
    expect(r.document.reserve).toHaveLength(1);
    expect(cardZones(r.document).sort()).toEqual([...actionCards].sort());
    expect(() =>
      change(r, { type: 'tactic', unitId: target.id, card: r.document.reserve[0] }),
    ).toThrow('początku rundy');
    const remaining = r.document.participants.find((p) => p.characterId === b.id)!;
    expect(remaining.fullDefense).toBe(r.document.currentId === target.id ? null : 11);
  });
  it('allows GM/Admin management, denies Player mutation and applies admin reveal to private participants', () => {
    expect(() => repo.combat.create(player, { name: 'Zabronione', commandId: uuid() })).toThrow(
      'Walkę prowadzi',
    );
    expect(repo.combat.create(admin, { name: 'Admin', commandId: uuid() }).revision).toBe(1);
    const extra = character(gm, true);
    let r = add(create(), extra.id, 'gm');
    expect(() =>
      change(r, { type: 'start', gmBennies: 2, tacticianId: null, tacticsResult: 0 }, player),
    ).toThrow('Walkę prowadzi');
    expect(() =>
      change(r, { type: 'start', gmBennies: 2, tacticianId: null, tacticsResult: 0 }, admin),
    ).toThrow('odkryj');
    r = change(
      r,
      { type: 'start', gmBennies: 2, tacticianId: null, tacticsResult: 0 },
      admin,
      true,
    );
    expect(r.document.phase).toBe('active');
    expect(repo.combat.view(r.id, admin).canManage).toBe(false);
    expect(repo.combat.view(r.id, admin, true).canManage).toBe(true);
  });
  it('projects privacy, never exposes the future deck, and hides private notes and initiative draws', () => {
    const extra = character(gm, true);
    let r = add(create(), extra.id, 'gm');
    r = change(r, { type: 'notes', characterId: extra.id, notes: 'TAJNE-TAKTYKI' });
    r = start(r);
    const view = repo.combat.view(r.id, player);
    expect(JSON.stringify(view)).not.toContain('TAJNE-TAKTYKI');
    expect(view).not.toHaveProperty('deck');
    expect(view).not.toHaveProperty('discard');
    expect(view.participants[0].character.redacted).toHaveLength(4);
    expect(view.units[0].draws).toEqual([]);
    expect(view.reserve).toEqual([]);
    expect(repo.combat.view(r.id, gm).participants[0].notes).toBe('TAJNE-TAKTYKI');
    expect(repo.combat.view(r.id, admin, true).participants[0].notes).toBe('TAJNE-TAKTYKI');
  });
  it('shares one initiative card with NPC group members and gives each Wild Card its own', () => {
    const a = character(),
      b = character(gm, true),
      c = character(gm, true),
      figure = character();
    let r = add(create(), a.id);
    r = add(r, b.id, 'players', r.document.units[0].id);
    r = add(r, c.id, 'gm');
    expect(() => add(r, figure.id, 'players', r.document.units[0].id)).toThrow('Każda Figura');
    expect(() => add(r, a.id)).toThrow('już w walce');
    r = start(r);
    expect(r.document.units).toHaveLength(2);
    expect(r.document.participants).toHaveLength(3);
    expect(cardZones(r.document).sort()).toEqual([...actionCards].sort());
  });
  it('rejects drafts and archives and prevents a character from fighting in two active encounters', () => {
    const draft = repo.create(player, 'Szkic'),
      a = character();
    expect(() => add(create(), draft.id)).toThrow('zatwierdzoną');
    let first = start(add(create(), a.id));
    const second = add(create(), a.id);
    expect(() => start(second)).toThrow('innej trwającej');
    first = change(first, { type: 'finish' });
    expect(() => change(first, { type: 'rename', name: 'Nowa' })).toThrow('tylko do odczytu');
    expect(start(second).document.phase).toBe('active');
  });
  it('updates linked conditions and audit exactly once when a response is retried', () => {
    const a = character();
    let r = start(add(create(), a.id));
    const request = input(r.revision, {
      type: 'tracker',
      characterId: a.id,
      characterRevision: a.revision,
      field: 'wounds',
      delta: 1,
    });
    r = repo.combat.change(gm, r.id, request);
    const retry = repo.combat.change(gm, r.id, request);
    expect(retry.revision).toBe(r.revision);
    expect(repo.read(a.id).document.conditions.wounds).toBe(1);
    expect(repo.read(a.id).revision).toBe(a.revision + 1);
    expect(repo.readHistory(a.id).filter((e) => e.kind === 'tracker')).toHaveLength(1);
    expect(() =>
      repo.combat.change(gm, r.id, { ...request, command: { ...request.command, delta: -1 } }),
    ).toThrow('Identyfikator');
  });
  it('rejects stale combat and character revisions without overwriting independent sheet edits', () => {
    const a = character();
    let r = start(add(create(), a.id));
    execute(repo, player, a.id, input(a.revision, { type: 'tracker', field: 'wounds', delta: 1 }));
    const before = repo.combat.read(r.id);
    expect(() =>
      change(r, {
        type: 'tracker',
        characterId: a.id,
        characterRevision: a.revision,
        field: 'wounds',
        delta: 1,
      }),
    ).toThrow('Karta postaci zmieniła');
    expect(repo.combat.read(r.id)).toEqual(before);
    r = change(r, { type: 'gmBenny', delta: 1 });
    expect(() => repo.combat.change(gm, r.id, input(r.revision - 1, { type: 'complete' }))).toThrow(
      'Walka zmieniła',
    );
    expect(repo.read(a.id).document.conditions.wounds).toBe(1);
  });
  it('rolls a linked-sheet mutation back if saving the combat event fails', () => {
    const a = character(),
      r = start(add(create(), a.id));
    const before = repo.read(a.id),
      events = repo.readHistory(a.id);
    repo.db.exec(
      "CREATE TRIGGER fail_combat BEFORE INSERT ON combat_events BEGIN SELECT RAISE(ABORT,'fixture combat failure'); END;",
    );
    expect(() =>
      change(r, {
        type: 'tracker',
        characterId: a.id,
        characterRevision: a.revision,
        field: 'wounds',
        delta: 1,
      }),
    ).toThrow('fixture combat failure');
    expect(repo.read(a.id)).toEqual(before);
    expect(repo.readHistory(a.id)).toEqual(events);
    expect(repo.combat.read(r.id).revision).toBe(r.revision);
  });
  it('resolves a 2015 Shaken recovery on a success of 4 and allows only one test per own turn', () => {
    const a = character();
    let r = start(add(create(), a.id));
    r = setDocument(r, (c) => {
      c.units[0].state = 'waiting';
      c.currentId = c.units[0].id;
    });
    execute(
      repo,
      player,
      a.id,
      input(a.revision, { type: 'condition', field: 'shaken', value: true }),
    );
    const revised = repo.read(a.id);
    r = change(r, {
      type: 'recover',
      characterId: a.id,
      characterRevision: revised.revision,
      result: 3,
    });
    expect(repo.read(a.id).document.conditions.shaken).toBe(true);
    expect(() =>
      change(r, {
        type: 'recover',
        characterId: a.id,
        characterRevision: revised.revision,
        result: 4,
      }),
    ).toThrow('raz');
    expect(() => change(r, { type: 'hold' })).toThrow('tylko akcje darmowe');
    r = change(r, {
      type: 'unshake',
      characterId: a.id,
      characterRevision: revised.revision,
      pool: 'personal',
    });
    expect(repo.read(a.id).document.conditions).toMatchObject({ shaken: false, bennies: 2 });
    r = change(r, { type: 'complete' });
    r = change(r, { type: 'nextRound' });
    if (!r.document.currentId) r = change(r, { type: 'activate', unitId: r.document.units[0].id });
    const source = repo.read(a.id);
    execute(
      repo,
      player,
      a.id,
      input(source.revision, { type: 'condition', field: 'shaken', value: true }),
    );
    change(r, {
      type: 'recover',
      characterId: a.id,
      characterRevision: source.revision + 1,
      result: 4,
    });
    expect(repo.read(a.id).document.conditions.shaken).toBe(false);
  });
  it('spends a GM pool Benny to Soak NPC damage without granting personal Bennies', () => {
    const a = character(gm, true);
    let r = start(add(create(), a.id, 'gm'));
    r = change(r, {
      type: 'damage',
      characterId: a.id,
      characterRevision: a.revision,
      damage: 9,
      toughness: 5,
      soaked: 1,
      pool: 'gm',
    });
    expect(r.document.gmBennies).toBe(1);
    expect(repo.read(a.id).document.conditions).toMatchObject({
      wounds: 0,
      shaken: false,
      bennies: 0,
    });
    const source = repo.read(a.id);
    r = change(r, {
      type: 'damage',
      characterId: a.id,
      characterRevision: source.revision,
      damage: 9,
      toughness: 5,
      soaked: 0,
      pool: 'none',
    });
    expect(repo.read(a.id).document.conditions).toMatchObject({ wounds: 1, incapacitated: true });
    expect(r.document.units[0].state).toBe('skipped');
  });
  it('resolves interrupt losses after the current actor and resumes the interrupted actor after a win', () => {
    const a = character(),
      b = character();
    let r = start(add(add(create(), a.id), b.id));
    r = setDocument(r, (c) => {
      c.units[0].state = 'waiting';
      c.units[1].state = 'held';
      c.units[1].cardRound = 0;
      c.currentId = c.units[0].id;
    });
    r = change(r, { type: 'interrupt', unitId: r.document.units[1].id, agility: 3, opponent: 4 });
    expect(r.document.currentId).toBe(r.document.units[0].id);
    r = change(r, { type: 'complete' });
    expect(r.document.currentId).toBe(r.document.units[1].id);
    r = change(r, { type: 'complete' });
    r = change(r, { type: 'nextRound' });
    r = setDocument(r, (c) => {
      c.units[0].state = 'waiting';
      c.units[1].state = 'held';
      c.units[1].cardRound = 0;
      c.currentId = c.units[0].id;
      c.units[1].cardRound = 0;
    });
    r = change(r, { type: 'interrupt', unitId: r.document.units[1].id, agility: 5, opponent: 4 });
    expect(r.document.currentId).toBe(r.document.units[1].id);
    r = change(r, { type: 'complete' });
    expect(r.document.currentId).toBe(r.document.units[0].id);
  });
  it('preserves both simultaneous actions on a tied interrupt even if one actor is incapacitated', () => {
    const a = character(),
      b = character();
    let r = start(add(add(create(), a.id), b.id));
    r = setDocument(r, (c) => {
      c.units[0].state = 'waiting';
      c.units[1].state = 'held';
      c.units[1].cardRound = 0;
      c.currentId = c.units[0].id;
    });
    r = change(r, { type: 'interrupt', unitId: r.document.units[1].id, agility: 4, opponent: 4 });
    r = change(r, {
      type: 'damage',
      characterId: a.id,
      characterRevision: a.revision,
      damage: 25,
      toughness: 5,
      soaked: 0,
      pool: 'none',
    });
    expect(repo.read(a.id).document.conditions.incapacitated).toBe(true);
    r = change(r, { type: 'complete' });
    expect(r.document.currentId).toBe(r.document.units[0].id);
    expect(r.document.units[0].state).toBe('waiting');
    r = change(r, { type: 'complete' });
    expect(r.document.simultaneousIds).toEqual([]);
  });
});
