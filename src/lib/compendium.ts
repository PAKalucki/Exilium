import { z } from 'zod';
import { itemSchema, type Item } from './rules/model';

export const equipmentDocumentSchema = z
  .object({
    category: z.string().trim().min(1).max(80),
    source: z.string().trim().min(1).max(160),
    item: itemSchema,
  })
  .strict();
export type EquipmentDocument = z.infer<typeof equipmentDocumentSchema>;
export type EquipmentRecord = {
  id: string;
  revision: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  updatedByName: string;
  document: EquipmentDocument;
};
export type EquipmentEvent = {
  id: number;
  kind: 'create' | 'update' | 'archive' | 'restore';
  date: string;
  actorName: string;
  before: EquipmentDocument | null;
  after: EquipmentDocument;
};
export const equipmentCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('update'), document: equipmentDocumentSchema }).strict(),
  z.object({ type: z.literal('archive') }).strict(),
  z.object({ type: z.literal('restore') }).strict(),
]);
export type EquipmentCommand = z.infer<typeof equipmentCommandSchema>;
// Inventory entries are independent snapshots, never live references to catalog data.
export function copyEquipment(record: EquipmentRecord): Item {
  return { ...JSON.parse(JSON.stringify(record.document.item)), id: crypto.randomUUID() };
}
