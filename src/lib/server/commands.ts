import { z } from 'zod';
import { characterSchema, itemSchema, advanceChoice, privacySchema } from '../rules/model';
import {
  derived,
  equipmentCost,
  integrityIssues,
  previewAdvance,
  startingFunds,
  validateCreation,
} from '../rules/engine';
import { DomainError, type Repository } from './db';

const body = z.discriminatedUnion('type', [
  z.object({ type: z.literal('privacy'), privacy: privacySchema }).strict(),
  z.object({ type: z.literal('saveDraft'), document: characterSchema }).strict(),
  z.object({ type: z.literal('finalize') }).strict(),
  z
    .object({
      type: z.literal('profile'),
      name: z.string().trim().min(1).max(160),
      age: z.string().max(160),
      origin: z.string().max(160),
      caste: z.string().max(160),
      profession: z.string().max(160),
      affiliation: z.string().max(160),
      motivation: z.string().max(160),
      background: z.string().max(12000),
      appearance: z.string().max(4000).optional(),
      notes: z.string().max(12000),
    })
    .strict(),
  z
    .object({
      type: z.literal('tracker'),
      field: z.enum(['wounds', 'fatigue', 'bennies']),
      delta: z.number().int().min(-100).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal('condition'),
      field: z.enum(['shaken', 'incapacitated']),
      value: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal('resetSession'), confirmed: z.literal(true) }).strict(),
  z
    .object({
      type: z.literal('money'),
      currency: z.enum(['cash', 'credits']),
      delta: z.number().int().min(-100_000_000).max(100_000_000),
      note: z.string().trim().min(1).max(160),
    })
    .strict(),
  z.object({ type: z.literal('item'), item: itemSchema, purchase: z.boolean() }).strict(),
  z.object({ type: z.literal('removeItem'), id: z.string().uuid() }).strict(),
  z
    .object({
      type: z.literal('fire'),
      id: z.string().uuid(),
      rounds: z.number().int().min(1).max(10000),
    })
    .strict(),
  z.object({ type: z.literal('reload'), id: z.string().uuid() }).strict(),
  z
    .object({
      type: z.literal('xp'),
      amount: z.number().int().min(-10000).max(10000),
      note: z.string().trim().min(1).max(160),
    })
    .strict(),
  z.object({ type: z.literal('advance'), choice: advanceChoice }).strict(),
  z
    .object({
      type: z.literal('ruling'),
      ruling: z
        .object({
          code: z.string().min(1).max(160),
          reason: z.string().min(3).max(160),
          ruling: z.string().min(3).max(160),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('adjustments'),
      adjustments: z
        .object({
          parry: z.number().int().min(-20).max(20),
          toughness: z.number().int().min(-20).max(20),
          pace: z.number().int().min(-6).max(20),
          charisma: z.number().int().min(-20).max(20),
          reason: z.string().min(3).max(160),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal('archive') }).strict(),
  z.object({ type: z.literal('restore') }).strict(),
  z.object({ type: z.literal('undo') }).strict(),
  z.object({ type: z.literal('removePortrait') }).strict(),
]);
export const commandSchema = z
  .object({ revision: z.number().int().min(1), commandId: z.string().uuid(), command: body })
  .strict();
export type Command = z.infer<typeof body>;
function fail(message: string): never {
  throw new DomainError(422, message);
}
export function execute(repo: Repository, owner: string, id: string, input: unknown) {
  const { revision, commandId, command } = commandSchema.parse(input);
  return repo.mutate(owner, id, revision, commandId, command, (record) => {
    let c = record.document;
    if (record.status === 'archived' && !['restore', 'undo'].includes(command.type))
      fail('Zarchiwizowana postać jest tylko do odczytu.');
    switch (command.type) {
      case 'saveDraft':
        if (record.status !== 'draft')
          fail('Podstawa aktywnej postaci jest zamknięta. Użyj rozwinięcia lub korekty MG.');
        if (command.document.xp.length || command.document.advances.length)
          fail('PD i rozwinięcia dodaj po zatwierdzeniu postaci.');
        record.document = command.document;
        c = record.document;
        break;
      case 'finalize': {
        if (record.status !== 'draft') fail('Postać jest już zatwierdzona.');
        const errors = validateCreation(c).filter((i) => !i.waived);
        if (errors.length) fail(errors.map((i) => i.message).join(' '));
        if (!c.legacy) {
          c.cash = Math.max(0, startingFunds(c) - equipmentCost(c));
          c.credits = 0;
        }
        c.conditions.bennies = derived(c).bennies;
        record.status = 'active';
        break;
      }
      case 'privacy':
        c.privacy = command.privacy;
        break;
      case 'removePortrait':
        c.portraitId = null;
        break;
      case 'profile': {
        const { type, ...fields } = command;
        Object.assign(c, fields);
        break;
      }
      case 'tracker': {
        const next = c.conditions[command.field] + command.delta;
        const max = command.field === 'bennies' ? 10000 : 3;
        if (next < 0 || next > max) fail('Licznik wykracza poza dozwolony zakres.');
        c.conditions[command.field] = next;
        break;
      }
      case 'condition':
        c.conditions[command.field] = command.value;
        break;
      case 'resetSession':
        c.conditions.bennies = derived(c).bennies;
        break;
      case 'money':
        if (c[command.currency] + command.delta < 0) fail('Brak środków.');
        c[command.currency] += command.delta;
        break;
      case 'item': {
        const index = c.inventory.findIndex((i) => i.id === command.item.id);
        if (command.purchase && index >= 0)
          fail('Przedmiot już istnieje. Kolejny zakup dodaj osobno.');
        if (command.purchase && record.status === 'active') {
          const cost = command.item.price * command.item.quantity;
          if (c.cash < cost) fail('Brak gotówki na zakup.');
          c.cash -= cost;
        }
        if (index >= 0) c.inventory[index] = command.item;
        else c.inventory.push(command.item);
        break;
      }
      case 'removeItem':
        c.inventory = c.inventory.filter((i) => i.id !== command.id);
        break;
      case 'fire': {
        const item = c.inventory.find((i) => i.id === command.id);
        if (!item || item.kind !== 'weapon' || item.loaded < command.rounds)
          fail('Brak amunicji w wybranej broni.');
        item.loaded -= command.rounds;
        break;
      }
      case 'reload': {
        const item = c.inventory.find((i) => i.id === command.id);
        if (!item || item.kind !== 'weapon') fail('Nie znaleziono broni.');
        const transfer = Math.min(item.capacity - item.loaded, item.reserve);
        if (!transfer) fail('Magazynek jest pełny albo brak zapasowej amunicji.');
        item.loaded += transfer;
        item.reserve -= transfer;
        break;
      }
      case 'xp':
        if (record.status !== 'active') fail('Najpierw zatwierdź postać.');
        c.xp.push({
          id: crypto.randomUUID(),
          amount: command.amount,
          note: command.note,
          date: new Date().toISOString(),
        });
        break;
      case 'advance': {
        if (record.status !== 'active') fail('Najpierw zatwierdź postać.');
        const preview = previewAdvance(c, command.choice),
          errors = preview.issues.filter((i) => !i.waived);
        if (errors.length) fail(errors.map((i) => i.message).join(' '));
        record.document = preview.next;
        c = record.document;
        break;
      }
      case 'ruling':
        c.rulings.push({
          ...command.ruling,
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
        });
        break;
      case 'adjustments':
        c.adjustments = command.adjustments;
        break;
      case 'archive':
        record.status = 'archived';
        break;
      case 'restore':
        repo.restore(record);
        break;
      case 'undo':
        repo.undo(record);
        c = record.document;
        break;
    }
    const errors = integrityIssues(c);
    if (errors.length) fail(errors.join(' '));
  });
}
