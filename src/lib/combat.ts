import { z } from 'zod';
import type { CharacterRecord } from './rules/model';

export const suits = ['C', 'D', 'H', 'S'] as const;
export const actionCards = [
  ...suits.flatMap((suit) => Array.from({ length: 13 }, (_, index) => `${index + 2}${suit}`)),
  'JB',
  'JR',
];
export const cardSchema = z
  .string()
  .refine((value) => actionCards.includes(value), 'Nieprawidłowa karta.');
export function cardInfo(id: string) {
  const joker = id.startsWith('J');
  const suit = id.slice(-1);
  const rank = joker ? 15 : Number(id.slice(0, -1));
  const names: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
  return {
    rank,
    suit: suits.indexOf(suit as (typeof suits)[number]),
    joker,
    red: suit === 'D' || suit === 'H' || id === 'JR',
    label: joker
      ? id === 'JR'
        ? 'Joker czerwony'
        : 'Joker czarny'
      : `${({ 11: 'W', 12: 'D', 13: 'K', 14: 'A' } as Record<number, string>)[rank] || rank}${names[suit]}`,
  };
}
export function compareCards(a: string, b: string) {
  const x = cardInfo(a),
    y = cardInfo(b);
  return y.rank - x.rank || y.suit - x.suit;
}
const uuid = z.string().uuid();
const short = z.string().trim().min(1).max(160);
export const participantSchema = z
  .object({
    characterId: uuid,
    prone: z.boolean().default(false),
    defending: z.boolean().default(false),
    wildAttack: z.boolean().default(false),
    notes: z.string().max(1000).default(''),
    recoveryRound: z.number().int().min(0).default(0),
    fullDefense: z.number().int().min(-100).max(100).nullable().default(null),
  })
  .strict();
export const initiativeUnitSchema = z
  .object({
    id: uuid,
    name: short,
    members: z.array(uuid).min(1).max(60),
    leaderId: uuid,
    side: z.enum(['players', 'gm']),
    returnTo: uuid.nullable().default(null),
    opening: z.enum(['normal', 'ambush', 'surprised']).default('normal'),
    notice: z.number().int().min(-100).max(100).default(0),
    card: cardSchema.nullable().default(null),
    cardRound: z.number().int().min(0).default(0),
    draws: z.array(cardSchema).max(108).default([]),
    state: z.enum(['waiting', 'held', 'done', 'skipped']).default('done'),
  })
  .strict();
export const combatDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: short,
    phase: z.enum(['setup', 'active', 'finished']),
    round: z.number().int().min(0).max(10000),
    gmBennies: z.number().int().min(0).max(10000),
    participants: z.array(participantSchema).max(60),
    units: z.array(initiativeUnitSchema).max(40),
    currentId: uuid.nullable(),
    resumeIds: z.array(uuid).max(40),
    afterCurrentId: uuid.nullable(),
    simultaneousIds: z.array(uuid).max(2).default([]),
    deck: z.array(cardSchema).max(54),
    discard: z.array(cardSchema).max(54),
    shuffleAfterRound: z.boolean(),
    actions: z.number().int().min(0),
    awaitingTactics: z.boolean().default(false),
    tacticianId: uuid.nullable(),
    reserve: z.array(cardSchema).max(54),
    tacticUsedRound: z.number().int().min(0),
  })
  .strict();
export type CombatDocument = z.infer<typeof combatDocumentSchema>;
export type InitiativeUnit = z.infer<typeof initiativeUnitSchema>;
export type CombatParticipant = z.infer<typeof participantSchema>;
export type CombatRecord = {
  id: string;
  revision: number;
  createdBy: string;
  updatedAt: string;
  document: CombatDocument;
};
export type CombatSummary = {
  id: string;
  name: string;
  revision: number;
  phase: CombatDocument['phase'];
  round: number;
  participants: number;
  updatedAt: string;
};
export type CombatView = Omit<CombatDocument, 'deck' | 'discard' | 'participants' | 'reserve'> & {
  id: string;
  revision: number;
  updatedAt: string;
  participants: (CombatParticipant & { character: CharacterRecord })[];
  reserve: string[];
  remainingCards: number | null;
  canManage: boolean;
  canReveal: boolean;
  revealed: boolean;
  history: { kind: string; date: string; round: number }[];
};
const characterId = z.object({ characterId: uuid });
export const combatCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rename'), name: short }).strict(),
  z
    .object({
      type: z.literal('add'),
      characterId: uuid,
      unitId: uuid.optional(),
      side: z.enum(['players', 'gm']),
    })
    .strict(),
  z.object({ type: z.literal('remove'), characterId: uuid }).strict(),
  z
    .object({
      type: z.literal('unit'),
      unitId: uuid,
      name: short,
      opening: z.enum(['normal', 'ambush', 'surprised']),
      notice: z.number().int().min(-100).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal('start'),
      gmBennies: z.number().int().min(0).max(10000),
      tacticianId: uuid.nullable(),
      tacticsResult: z.number().int().min(-100).max(100),
    })
    .strict(),
  z.object({ type: z.literal('nextRound') }).strict(),
  z.object({ type: z.literal('ready') }).strict(),
  characterId
    .extend({
      type: z.literal('fullDefense'),
      result: z.number().int().min(-100).max(100).nullable(),
    })
    .strict(),
  z.object({ type: z.literal('complete') }).strict(),
  z.object({ type: z.literal('hold') }).strict(),
  z.object({ type: z.literal('activate'), unitId: uuid }).strict(),
  z
    .object({
      type: z.literal('interrupt'),
      unitId: uuid,
      agility: z.number().int().min(-100).max(100),
      opponent: z.number().int().min(-100).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal('tactic'),
      unitId: uuid,
      card: cardSchema,
      memberIds: z.array(uuid).min(1).max(60).optional(),
    })
    .strict(),
  z.object({ type: z.literal('gmBenny'), delta: z.number().int().min(-100).max(100) }).strict(),
  characterId
    .extend({
      type: z.literal('tracker'),
      field: z.enum(['wounds', 'fatigue', 'bennies']),
      delta: z.number().int().min(-1).max(1),
      characterRevision: z.number().int().min(1),
    })
    .strict(),
  characterId
    .extend({
      type: z.literal('condition'),
      field: z.enum(['shaken', 'incapacitated']),
      value: z.boolean(),
      characterRevision: z.number().int().min(1),
    })
    .strict(),
  characterId
    .extend({
      type: z.literal('maneuver'),
      field: z.enum(['prone', 'defending', 'wildAttack']),
      value: z.boolean(),
    })
    .strict(),
  characterId.extend({ type: z.literal('notes'), notes: z.string().max(1000) }).strict(),
  characterId
    .extend({
      type: z.literal('recover'),
      result: z.number().int().min(-100).max(100),
      characterRevision: z.number().int().min(1),
    })
    .strict(),
  characterId
    .extend({
      type: z.literal('unshake'),
      pool: z.enum(['personal', 'gm']),
      characterRevision: z.number().int().min(1),
    })
    .strict(),
  characterId
    .extend({
      type: z.literal('damage'),
      damage: z.number().int().min(0).max(100000),
      toughness: z.number().int().min(1).max(100000),
      soaked: z.number().int().min(0).max(25000),
      pool: z.enum(['none', 'personal', 'gm']),
      characterRevision: z.number().int().min(1),
    })
    .strict(),
  z.object({ type: z.literal('finish') }).strict(),
]);
export type CombatCommand = z.infer<typeof combatCommandSchema>;
export const combatChangeSchema = z
  .object({ revision: z.number().int().min(1), commandId: uuid, command: combatCommandSchema })
  .strict();
export const createCombatSchema = z.object({ commandId: uuid, name: short }).strict();
export const combatEventLabels: Record<string, string> = {
  create: 'Utworzenie starcia',
  rename: 'Nazwa starcia',
  add: 'Dodanie postaci',
  remove: 'Usunięcie postaci',
  unit: 'Ustawienie inicjatywy',
  start: 'Rozpoczęcie walki',
  nextRound: 'Nowa runda',
  ready: 'Zatwierdzenie inicjatywy',
  fullDefense: 'Pełna obrona',
  complete: 'Koniec tury',
  hold: 'Wstrzymanie akcji',
  activate: 'Podjęcie akcji',
  interrupt: 'Przerwanie akcji',
  interruptTie: 'Jednoczesne akcje - remis Zręczności',
  tactic: 'Karta Taktyka',
  gmBenny: 'Pula fuksów MG',
  tracker: 'Zmiana licznika',
  condition: 'Zmiana stanu',
  maneuver: 'Manewr',
  notes: 'Notatka bojowa',
  recover: 'Test wyjścia z Szoku',
  unshake: 'Fuks na Szok',
  damage: 'Rozliczenie obrażeń',
  finish: 'Zakończenie walki',
};

export function jokerBonus(unit: InitiativeUnit, round: number) {
  return !!unit.card && cardInfo(unit.card).joker && unit.cardRound === round;
}
