import type { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { equipmentSeeds } from '../content/equipment-seed';
import { newItem } from '../rules/model';
import {
  equipmentDocumentSchema,
  equipmentCommandSchema,
  type EquipmentDocument,
  type EquipmentRecord,
  type EquipmentEvent,
} from '../compendium';
import { DomainError } from './errors';
import { managesGame, type Role } from '../access';

const commandIdSchema = z.string().uuid();
const revisionSchema = z.number().int().min(1);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class EquipmentRepository {
  constructor(private db: DatabaseSync) {
    this.transaction(() => {
      if (this.db.prepare('SELECT 1 FROM schema_migrations WHERE version=4').get()) return;
      this.db.exec(`
        CREATE TABLE equipment_catalog (
          id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('active','archived')),revision INTEGER NOT NULL,
          created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
          created_by TEXT REFERENCES users(id),updated_by TEXT REFERENCES users(id),
          document TEXT NOT NULL CHECK(json_valid(document))
        );
        CREATE TABLE equipment_catalog_events (
          id INTEGER PRIMARY KEY,item_id TEXT NOT NULL REFERENCES equipment_catalog(id),
          actor_id TEXT REFERENCES users(id),command_id TEXT NOT NULL,command_hash TEXT NOT NULL,
          kind TEXT NOT NULL,date TEXT NOT NULL,before_document TEXT,after_document TEXT NOT NULL,
          UNIQUE(actor_id,command_id)
        );
        CREATE INDEX equipment_catalog_events_item ON equipment_catalog_events(item_id,id);
      `);
      const date = new Date().toISOString();
      for (const seed of equipmentSeeds) {
        const item = { ...newItem(), ...seed.values, name: seed.name };
        const document = equipmentDocumentSchema.parse({
          category: seed.category,
          source: seed.source,
          item,
        });
        this.insert(item.id, document, null, date);
        this.event(item.id, null, randomUUID(), hash(document), 'create', date, null, document);
      }
      this.db.prepare('INSERT INTO schema_migrations VALUES(4,?)').run(date);
    });
  }
  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  private select = `SELECT c.*,a.name AS creator,b.name AS editor FROM equipment_catalog c
    LEFT JOIN users a ON a.id=c.created_by LEFT JOIN users b ON b.id=c.updated_by`;
  private record(row: Record<string, unknown>): EquipmentRecord {
    return {
      id: String(row.id),
      revision: Number(row.revision),
      status: row.status as EquipmentRecord['status'],
      approvalStatus: (row.approval_status || 'approved') as EquipmentRecord['approvalStatus'],
      reviewNote: String(row.review_note || ''),
      createdBy: row.created_by ? String(row.created_by) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      createdByName: row.creator ? String(row.creator) : 'Zestaw początkowy',
      updatedByName: row.editor ? String(row.editor) : 'Zestaw początkowy',
      document: equipmentDocumentSchema.parse(JSON.parse(String(row.document))),
    };
  }
  private actor(id: string) {
    const row = this.db.prepare('SELECT id,role,enabled FROM users WHERE id=?').get(id);
    if (!row?.enabled) throw new DomainError(403, 'Konto jest wyłączone.');
    return { id: String(row.id), role: row.role as Role };
  }
  private canRead(record: EquipmentRecord, actor: string) {
    if (
      record.approvalStatus !== 'approved' &&
      record.createdBy !== actor &&
      !managesGame(this.actor(actor))
    )
      throw new DomainError(404, 'Nie znaleziono wpisu kompendium.');
  }
  read(id: string, actor?: string): EquipmentRecord {
    const row = this.db.prepare(this.select + ' WHERE c.id=?').get(id);
    if (!row) throw new DomainError(404, 'Nie znaleziono wpisu kompendium.');
    const record = this.record(row);
    if (actor) this.canRead(record, actor);
    return record;
  }
  list(includeArchived = false, actor?: string): EquipmentRecord[] {
    const user = actor ? this.actor(actor) : null;
    return this.db
      .prepare(this.select + ' ORDER BY c.name COLLATE NOCASE,c.id')
      .all()
      .map((row) => this.record(row))
      .filter((record) => {
        if (!includeArchived)
          return record.status === 'active' && record.approvalStatus === 'approved';
        return (
          record.approvalStatus === 'approved' ||
          (user && (managesGame(user) || record.createdBy === user.id))
        );
      });
  }
  history(id: string, actor?: string): EquipmentEvent[] {
    this.read(id, actor);
    return this.db
      .prepare(
        `SELECT e.*,u.name AS actor FROM equipment_catalog_events e LEFT JOIN users u ON u.id=e.actor_id
      WHERE e.item_id=? ORDER BY e.id DESC LIMIT 100`,
      )
      .all(id)
      .map((row) => ({
        id: Number(row.id),
        kind: row.kind as EquipmentEvent['kind'],
        date: String(row.date),
        actorName: row.actor ? String(row.actor) : 'Zestaw początkowy',
        reviewNote: String(row.review_note || ''),
        before: row.before_document
          ? equipmentDocumentSchema.parse(JSON.parse(String(row.before_document)))
          : null,
        after: equipmentDocumentSchema.parse(JSON.parse(String(row.after_document))),
      }));
  }
  private insert(id: string, doc: EquipmentDocument, actor: string | null, date: string) {
    this.db
      .prepare(
        'INSERT INTO equipment_catalog(id,name,category,status,revision,created_at,updated_at,created_by,updated_by,document) VALUES(?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        doc.item.name,
        doc.category,
        'active',
        1,
        date,
        date,
        actor,
        actor,
        JSON.stringify(doc),
      );
  }
  private event(
    id: string,
    actor: string | null,
    commandId: string,
    digest: string,
    kind: EquipmentEvent['kind'],
    date: string,
    before: EquipmentDocument | null,
    after: EquipmentDocument,
  ) {
    this.db
      .prepare(
        `INSERT INTO equipment_catalog_events(item_id,actor_id,command_id,command_hash,kind,date,before_document,after_document)
      VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        actor,
        commandId,
        digest,
        kind,
        date,
        before ? JSON.stringify(before) : null,
        JSON.stringify(after),
      );
  }
  private retry(actor: string, commandId: string, digest: string): EquipmentRecord | null {
    const event = this.db
      .prepare(
        'SELECT item_id,command_hash FROM equipment_catalog_events WHERE actor_id=? AND command_id=?',
      )
      .get(actor, commandId);
    if (!event) return null;
    if (event.command_hash !== digest)
      throw new DomainError(409, 'Identyfikator zapisu został użyty do innej zmiany.');
    return this.read(String(event.item_id));
  }
  create(actor: string, commandId: string, input: unknown): EquipmentRecord {
    const user = this.actor(actor);
    commandIdSchema.parse(commandId);
    const document = equipmentDocumentSchema.parse(input),
      digest = hash({ type: 'create', document });
    return this.transaction(() => {
      const retried = this.retry(actor, commandId, digest);
      if (retried) return retried;
      const id = randomUUID(),
        date = new Date().toISOString();
      document.item.id = id;
      this.insert(id, document, actor, date);
      if (!managesGame(user))
        this.db
          .prepare("UPDATE equipment_catalog SET approval_status='pending' WHERE id=?")
          .run(id);
      this.event(id, actor, commandId, digest, 'create', date, null, document);
      return this.read(id);
    });
  }
  change(
    actor: string,
    id: string,
    revision: number,
    commandId: string,
    input: unknown,
  ): EquipmentRecord {
    const user = this.actor(actor);
    commandIdSchema.parse(commandId);
    revisionSchema.parse(revision);
    const command = equipmentCommandSchema.parse(input),
      digest = hash({ id, command });
    return this.transaction(() => {
      const retried = this.retry(actor, commandId, digest);
      if (retried) return retried;
      const current = this.read(id, actor);
      if (
        !managesGame(user) &&
        !(
          current.createdBy === actor &&
          current.approvalStatus !== 'approved' &&
          ['update', 'archive'].includes(command.type)
        )
      )
        throw new DomainError(
          403,
          'Zmiany opublikowanego kompendium i decyzje wymagają roli MG lub administratora.',
        );
      if (
        ['approve', 'reject'].includes(command.type) &&
        (current.approvalStatus !== 'pending' || current.status !== 'active')
      )
        throw new DomainError(422, 'Ten wpis nie czeka na zatwierdzenie.');
      if (current.revision !== revision)
        throw new DomainError(
          409,
          'Ten wpis zmienił inny gracz. Wczytaj aktualną wersję i porównaj swoje zmiany.',
        );
      if (command.type === 'update' && current.status === 'archived')
        throw new DomainError(422, 'Najpierw przywróć wpis z archiwum.');
      if (command.type === 'archive' && current.status === 'archived')
        throw new DomainError(422, 'Wpis jest już w archiwum.');
      if (command.type === 'restore' && current.status !== 'archived')
        throw new DomainError(422, 'Wpis nie jest w archiwum.');
      const document = command.type === 'update' ? command.document : current.document;
      document.item.id = id;
      const approval =
        command.type === 'reject'
          ? 'rejected'
          : command.type === 'approve'
            ? 'approved'
            : command.type === 'update'
              ? managesGame(user)
                ? 'approved'
                : 'pending'
              : current.approvalStatus;
      const note =
        command.type === 'reject'
          ? command.note
          : ['update', 'approve'].includes(command.type)
            ? ''
            : current.reviewNote;
      const status = command.type === 'archive' ? 'archived' : 'active',
        date = new Date().toISOString();
      this.db
        .prepare(
          `UPDATE equipment_catalog SET name=?,category=?,status=?,revision=revision+1,updated_at=?,updated_by=?,document=?,approval_status=?,review_note=? WHERE id=? AND revision=?`,
        )
        .run(
          document.item.name,
          document.category,
          status,
          date,
          actor,
          JSON.stringify(document),
          approval,
          note,
          id,
          revision,
        );
      this.event(id, actor, commandId, digest, command.type, date, current.document, document);
      if (command.type === 'reject')
        this.db
          .prepare(
            'UPDATE equipment_catalog_events SET review_note=? WHERE actor_id=? AND command_id=?',
          )
          .run(command.note, actor, commandId);
      return this.read(id);
    });
  }
}
