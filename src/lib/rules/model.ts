import { z } from 'zod';
import { RULESET, attributes, skillInfo } from '../content/catalog';

const short = z.string().trim().max(160);
const note = z.string().max(12000);
const die = z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12)]);
const amount = z.number().int().min(0).max(100_000_000);
export const edgeChoice = z.object({ id: short.min(1), target: short.default('') }).strict();
export const buildSchema = z
  .object({
    attributes: z
      .object({ agility: die, smarts: die, spirit: die, strength: die, vigor: die })
      .strict(),
    skills: z.record(
      z
        .string()
        .max(90)
        .refine((k) => !!skillInfo(k), 'Nieznana umiejętność'),
      die,
    ),
    edges: z.array(edgeChoice).max(120),
    hindrances: z
      .array(
        z.object({ id: short.min(1), severity: z.union([z.literal(1), z.literal(2)]) }).strict(),
      )
      .max(30),
    bonus: z
      .object({
        attributes: z.number().int().min(0).max(2),
        skills: z.number().int().min(0).max(4),
        funds: z.number().int().min(0).max(4),
      })
      .strict(),
  })
  .strict();
export function hasAmmunitionCounters(item: {
  kind: string;
  capacity: number;
  loaded: number;
  reserve: number;
}) {
  return item.kind === 'weapon' && (item.capacity > 0 || item.loaded > 0 || item.reserve > 0);
}
export const itemSchema = z
  .object({
    id: z.string().uuid(),
    name: short.min(1),
    kind: z.enum(['gear', 'weapon', 'armor', 'cybernetic']),
    quantity: z.number().int().min(1).max(10000),
    weight: z.number().min(0).max(100000).nullable(),
    price: amount,
    equipped: z.boolean(),
    carried: z.boolean(),
    notes: note,
    armor: z.number().int().min(0).max(100),
    coverage: z.enum(['torso', 'head', 'arms', 'legs', 'all']),
    damage: short,
    range: short,
    loaded: z.number().int().min(0).max(10000),
    capacity: z.number().int().min(0).max(10000),
    reserve: z.number().int().min(0).max(100000),
    parry: z.number().int().min(-10).max(10),
  })
  .strict()
  .refine((i) => i.loaded <= i.capacity, 'Amunicja przekracza pojemność magazynka')
  .refine((i) => !hasAmmunitionCounters(i) || i.quantity === 1, {
    message: 'Broń z licznikiem amunicji dodawaj pojedynczo, z własnym magazynkiem i zapasem.',
    path: ['quantity'],
  });
export const advanceChoice = z
  .object({
    kind: z.enum(['edge', 'attribute', 'skill', 'twoSkills', 'newSkill']),
    target: short.min(1),
    second: short.default(''),
    edgeTarget: short.default(''),
    note: short.default(''),
  })
  .strict();
export const privacySchema = z
  .object({
    statistics: z.boolean().default(false),
    background: z.boolean().default(false),
    origin: z.boolean().default(false),
    equipment: z.boolean().default(false),
  })
  .strict();
export type HiddenSection = keyof z.infer<typeof privacySchema>;
export type VisibleStats = {
  parry: number;
  totalToughness: number;
  toughness: number;
  armor: number;
  pace: number;
  running: number;
  charisma: number;
};
export const characterSchema = z
  .object({
    schemaVersion: z.literal(1),
    privacy: privacySchema.default({
      statistics: false,
      background: false,
      origin: false,
      equipment: false,
    }),
    ruleset: z.literal(RULESET),
    name: short.min(1),
    age: short,
    origin: short,
    caste: short,
    profession: short,
    affiliation: short,
    motivation: short,
    background: note,
    appearance: z.string().max(4000).default(''),
    portraitId: z.string().uuid().nullable().default(null),
    notes: note,
    build: buildSchema,
    legacy: z
      .object({
        xp: amount,
        spent: amount,
        attributeUsed: z.boolean(),
        lastLegendaryAttribute: z.number().int().min(0).max(10000).nullable(),
        reason: short.min(3),
      })
      .strict()
      .nullable(),
    conditions: z
      .object({
        wounds: z.number().int().min(0).max(3),
        fatigue: z.number().int().min(0).max(3),
        shaken: z.boolean(),
        incapacitated: z.boolean(),
        bennies: z.number().int().min(0).max(10000),
      })
      .strict(),
    cash: amount,
    credits: amount,
    inventory: z.array(itemSchema).max(200),
    xp: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            amount: z.number().int().min(-10000).max(10000),
            note: short.min(1),
            date: z.string().datetime(),
          })
          .strict(),
      )
      .max(2000),
    advances: z
      .array(
        advanceChoice.extend({
          id: z.string().uuid(),
          xp: amount,
          rank: z.number().int().min(0).max(4),
          date: z.string().datetime(),
        }),
      )
      .max(2000),
    rulings: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            code: short.min(1),
            reason: short.min(3),
            ruling: short.min(3),
            date: z.string().datetime(),
          })
          .strict(),
      )
      .max(100),
    adjustments: z
      .object({
        parry: z.number().int().min(-20).max(20),
        toughness: z.number().int().min(-20).max(20),
        pace: z.number().int().min(-6).max(20),
        charisma: z.number().int().min(-20).max(20),
        reason: short,
      })
      .strict(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.inventory.length !== new Set(c.inventory.map((i) => i.id)).size)
      ctx.addIssue({ code: 'custom', message: 'Powtórzony przedmiot' });
    if (
      Object.values(c.adjustments).some((v) => typeof v === 'number' && v !== 0) &&
      c.adjustments.reason.length < 3
    )
      ctx.addIssue({ code: 'custom', message: 'Wpisz uzasadnienie korekt MG' });
  });
export type Build = Omit<z.infer<typeof buildSchema>, 'skills'> & {
  skills: Record<string, number>;
};
export type Character = z.infer<typeof characterSchema>;
export type Item = z.infer<typeof itemSchema>;
export type AdvanceChoice = z.infer<typeof advanceChoice>;
export type Advance = Character['advances'][number];
export type CharacterRecord = {
  id: string;
  ownerId: string;
  ownerName: string;
  status: 'draft' | 'active' | 'archived';
  revision: number;
  updatedAt: string;
  document: Character;
  redacted?: HiddenSection[];
  visibleStats?: VisibleStats;
};
export function newCharacter(name = 'Nowa postać'): Character {
  return {
    schemaVersion: 1,
    privacy: { statistics: false, background: false, origin: false, equipment: false },
    ruleset: RULESET,
    name,
    age: '',
    origin: 'Jericho',
    caste: 'Wolni',
    profession: '',
    affiliation: '',
    motivation: '',
    background: '',
    appearance: '',
    portraitId: null,
    notes: '',
    build: {
      attributes: Object.fromEntries(
        Object.keys(attributes).map((k) => [k, 4]),
      ) as Build['attributes'],
      skills: {},
      edges: [],
      hindrances: [],
      bonus: { attributes: 0, skills: 0, funds: 0 },
    },
    legacy: null,
    conditions: { wounds: 0, fatigue: 0, shaken: false, incapacitated: false, bennies: 3 },
    cash: 400,
    credits: 0,
    inventory: [],
    xp: [],
    advances: [],
    rulings: [],
    adjustments: { parry: 0, toughness: 0, pace: 0, charisma: 0, reason: '' },
  };
}
export function newItem(): Item {
  return {
    id: crypto.randomUUID(),
    name: 'Nowy przedmiot',
    kind: 'gear',
    quantity: 1,
    weight: null,
    price: 0,
    equipped: false,
    carried: true,
    notes: '',
    armor: 0,
    coverage: 'torso',
    damage: '',
    range: '',
    loaded: 0,
    capacity: 0,
    reserve: 0,
    parry: 0,
  };
}
