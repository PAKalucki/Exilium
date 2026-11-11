import { describe, expect, it } from 'vitest';
import { archetypes } from '../src/lib/content/archetypes';
import { edges, skills } from '../src/lib/content/catalog';
import { applyArchetype } from '../src/lib/rules/archetypes';
import {
  creationBudget,
  integrityIssues,
  startingFunds,
  validateCreation,
} from '../src/lib/rules/engine';
import { characterSchema, newCharacter, newItem, type Character } from '../src/lib/rules/model';
import { execute } from '../src/lib/server/commands';
import { Repository } from '../src/lib/server/db';

// Unallocated skill points in the printed templates (SW PL 2015 pp. 11–12).
const unspent: Record<string, number> = {
  investigator: 0,
  face: 0,
  driver: 7,
  rogue: 0,
  scientist: 0,
  pilot: 1,
  leader: 3,
  gunslinger: 4,
  sniper: 5,
  brute: 4,
  fencer: 0,
  'martial-artist': 6,
};

function finishChoices(c: Character) {
  c.build.hindrances = [
    { id: 'heroic', severity: 2 },
    { id: 'loyal', severity: 1 },
    { id: 'stubborn', severity: 1 },
  ];
  for (const skill of skills) {
    if (creationBudget(c).skillSpent === 15) break;
    if (!c.build.skills[skill.id]) c.build.skills[skill.id] = 4;
  }
  return c;
}

describe('book archetypes for Exilium', () => {
  it.each(archetypes)(
    '$name needs only the documented player choices to pass normal creation',
    (archetype) => {
      const c = applyArchetype(newCharacter('Gotowa postać'), archetype.id);
      expect(characterSchema.safeParse(c).success).toBe(true);
      expect(integrityIssues(c)).toEqual([]);
      const budget = creationBudget(c);
      expect(budget.attributeSpent).toBe(budget.attributeTotal);
      expect(budget.skillTotal - budget.skillSpent).toBe(unspent[archetype.id]);
      expect(budget.spentHindrance).toBeLessThanOrEqual(4);
      expect(c.build.hindrances).toEqual([]);
      expect(
        validateCreation(c).every(
          (issue) =>
            issue.code.startsWith('budget.hindrances:') || issue.code.startsWith('budget.skills:'),
        ),
      ).toBe(true);
      expect(startingFunds(c)).toBe(400);
      expect(validateCreation(finishChoices(c))).toEqual([]);
      expect(c.rulings).toEqual([]);
      expect(c.legacy).toBeNull();
    },
  );

  it('offers twelve grounded book templates with known mundane Edges and no supernatural skills', () => {
    expect(archetypes).toHaveLength(12);
    expect(new Set(archetypes.map((a) => a.id)).size).toBe(archetypes.length);
    expect(archetypes.map((a) => a.id).sort()).toEqual(Object.keys(unspent).sort());
    for (const archetype of archetypes) {
      expect(
        archetype.build.edges.every((edge) => edges.some((known) => known.id === edge.id)),
      ).toBe(true);
      expect(
        Object.keys(archetype.build.skills).every(
          (key) => key.startsWith('knowledge:') || skills.some((skill) => skill.id === key),
        ),
      ).toBe(true);
    }
    for (const id of ['mage', 'priest', 'mad-scientist', 'pirate'])
      expect(() => applyArchetype(newCharacter(), id)).toThrow('Nie znaleziono');
  });

  it('sets both Scholar targets and explicitly identifies the Rębacz budget correction', () => {
    const scientist = applyArchetype(newCharacter(), 'scientist');
    expect(scientist.build.edges.find((edge) => edge.id === 'scholar')?.target).toBe(
      'knowledge:Inna|knowledge:Nauka',
    );
    expect(scientist.build.skills['knowledge:Inna']).toBe(10);
    expect(scientist.build.skills['knowledge:Nauka']).toBe(10);
    const brute = archetypes.find((archetype) => archetype.id === 'brute')!;
    expect(brute.build.attributes.strength).toBe(8);
    expect(brute.note).toContain('k8 zamiast drukowanego k10');
    expect(creationBudget(applyArchetype(newCharacter(), 'brute')).spentHindrance).toBe(4);
  });

  it('replaces only the build and never mutates the source or another loaded template', () => {
    const original = newCharacter('Własne imię');
    Object.assign(original, {
      origin: 'Alexandria',
      profession: 'Medyk terenowy',
      background: 'Własna historia',
      appearance: 'Blizna',
      portraitId: crypto.randomUUID(),
      cash: 75,
      credits: 100,
      privacy: { statistics: true, origin: true, background: true, equipment: true },
      inventory: [{ ...newItem(), name: 'Osobisty sprzęt' }],
    });
    original.build.hindrances = [{ id: 'young', severity: 2 }];
    const before = structuredClone(original);
    const loaded = applyArchetype(original, 'driver');
    expect(original).toEqual(before);
    expect({ ...loaded, build: before.build }).toEqual(before);
    expect(loaded.build.hindrances).toEqual([]);
    loaded.build.attributes.agility = 4;
    loaded.build.edges[0].target = 'zmienione';
    const another = applyArchetype(newCharacter(), 'driver');
    expect(another.build.attributes.agility).toBe(8);
    expect(another.build.edges[0].target).toBe('');
  });

  it('rejects historical baselines, XP and advances without replacing their statistics', () => {
    const c = newCharacter();
    c.legacy = {
      xp: 0,
      spent: 0,
      attributeUsed: false,
      lastLegendaryAttribute: null,
      reason: 'Istniejąca karta',
    };
    expect(() => applyArchetype(c, 'driver')).toThrow('nowej postaci');
    c.legacy = null;
    c.xp = [{ id: crypto.randomUUID(), amount: 5, note: 'Sesja', date: new Date().toISOString() }];
    expect(() => applyArchetype(c, 'driver')).toThrow('nowej postaci');
    c.xp = [];
    c.advances = [
      {
        id: crypto.randomUUID(),
        kind: 'skill',
        target: 'fighting',
        second: '',
        edgeTarget: '',
        note: '',
        xp: 5,
        rank: 0,
        date: new Date().toISOString(),
      },
    ];
    expect(() => applyArchetype(c, 'driver')).toThrow('nowej postaci');
    expect(c.build).toEqual(newCharacter().build);
  });

  it('persists a template as an ordinary draft and enforces completion before activation', () => {
    const repo = new Repository(':memory:');
    try {
      const owner = repo.user('archetype-test', 'Gracz');
      let record = repo.create(owner.id, 'Kierowca');
      const send = (command: unknown) =>
        execute(repo, owner.id, record.id, {
          revision: record.revision,
          commandId: crypto.randomUUID(),
          command,
        });
      record = send({ type: 'saveDraft', document: applyArchetype(record.document, 'driver') });
      expect(() => send({ type: 'finalize' })).toThrow('Umiejętności');
      record = send({ type: 'saveDraft', document: finishChoices(record.document) });
      record = send({ type: 'finalize' });
      expect(record.status).toBe('active');
      expect(repo.read(record.id).document.build.attributes.agility).toBe(8);
      expect(record.document.cash).toBe(400);
    } finally {
      repo.db.close();
    }
  });
});
