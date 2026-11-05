import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Character, CharacterRecord } from '../rules/model';
import { newCharacter, characterSchema } from '../rules/model';
import { RULESET } from '../content/catalog';
import { config } from './config';

export type User = { id: string; discordId: string; name: string; enabled: number };
export type SessionUser = User & { guildId: string };
export type PortraitImage = { data: Uint8Array; width: number; height: number };
export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export class Repository {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec(
      'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;',
    );
    this.db.exec(`
   CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, discord_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);
   CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS ruleset_releases (id TEXT PRIMARY KEY,description TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','active','archived')),revision INTEGER NOT NULL,updated_at TEXT NOT NULL,document TEXT NOT NULL CHECK(json_valid(document)));
   CREATE INDEX IF NOT EXISTS characters_owner ON characters(owner_id);
   CREATE TABLE IF NOT EXISTS character_events (id INTEGER PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id),actor_id TEXT NOT NULL REFERENCES users(id),command_id TEXT NOT NULL,command_hash TEXT NOT NULL,kind TEXT NOT NULL,date TEXT NOT NULL,before_document TEXT NOT NULL,before_status TEXT NOT NULL,after_document TEXT NOT NULL,UNIQUE(character_id,command_id));
   CREATE TABLE IF NOT EXISTS xp_entries (id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id),amount INTEGER NOT NULL,note TEXT NOT NULL,date TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS advancements (id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id),position INTEGER NOT NULL,document TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS rule_exceptions (id TEXT PRIMARY KEY,character_id TEXT NOT NULL REFERENCES characters(id),code TEXT NOT NULL,document TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS portrait_images (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),data BLOB NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL);
   INSERT OR IGNORE INTO schema_migrations VALUES(1,datetime('now'));
   INSERT OR IGNORE INTO schema_migrations VALUES(2,datetime('now'));
  `);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const columns = this.db.prepare('PRAGMA table_info(auth_sessions)').all();
      if (!columns.some((column) => column.name === 'guild_id'))
        this.db.exec("ALTER TABLE auth_sessions ADD COLUMN guild_id TEXT NOT NULL DEFAULT '';");
      this.db.exec("INSERT OR IGNORE INTO schema_migrations VALUES(3,datetime('now')); COMMIT;");
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    this.db
      .prepare('INSERT OR IGNORE INTO ruleset_releases VALUES(?,?)')
      .run(RULESET, 'SW PL 2015; Exilium; 400 dollars; current-rank advancement');
  }
  user(discordId: string, name: string): User {
    this.db
      .prepare(
        'INSERT INTO users(id,discord_id,name) VALUES(?,?,?) ON CONFLICT(discord_id) DO UPDATE SET name=excluded.name',
      )
      .run(randomUUID(), discordId, name.slice(0, 160));
    return this.db
      .prepare('SELECT id,discord_id AS discordId,name,enabled FROM users WHERE discord_id=?')
      .get(discordId) as User;
  }
  createSession(user: User, guildId = '') {
    if (!user.enabled) throw new DomainError(403, 'Konto jest wyłączone.');
    const token = randomBytes(32).toString('base64url');
    this.db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(Date.now());
    this.db
      .prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,guild_id) VALUES(?,?,?,?)')
      .run(tokenHash(token), user.id, Date.now() + 7 * 86400_000, guildId);
    return token;
  }
  session(token: string): SessionUser | null {
    return (
      (this.db
        .prepare(
          'SELECT u.id,u.discord_id AS discordId,u.name,u.enabled,s.guild_id AS guildId FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.enabled=1',
        )
        .get(tokenHash(token), Date.now()) as SessionUser) || null
    );
  }
  logout(token: string) {
    this.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(tokenHash(token));
  }
  create(ownerId: string, name: string, document: Character = newCharacter(name)) {
    if (document.portraitId) this.portrait(ownerId, document.portraitId);
    const id = randomUUID(),
      date = new Date().toISOString();
    this.db
      .prepare('INSERT INTO characters VALUES(?,?,?,?,?,?,?)')
      .run(id, ownerId, name, 'draft', 1, date, JSON.stringify(document));
    return this.get(ownerId, id);
  }
  private record(row: Record<string, unknown>): CharacterRecord {
    return {
      id: row.id as string,
      ownerId: row.owner_id as string,
      ownerName: row.owner_name as string,
      status: row.status as CharacterRecord['status'],
      revision: Number(row.revision),
      updatedAt: row.updated_at as string,
      document: characterSchema.parse(JSON.parse(row.document as string)),
    };
  }
  get(ownerId: string, id: string): CharacterRecord {
    const row = this.db
      .prepare(
        'SELECT c.*,u.name AS owner_name FROM characters c JOIN users u ON u.id=c.owner_id WHERE c.id=? AND c.owner_id=?',
      )
      .get(id, ownerId);
    if (!row) throw new DomainError(404, 'Nie znaleziono postaci.');
    return this.record(row);
  }
  list(ownerId: string) {
    return this.db
      .prepare(
        'SELECT c.*,u.name AS owner_name FROM characters c JOIN users u ON u.id=c.owner_id WHERE c.owner_id=? ORDER BY c.updated_at DESC',
      )
      .all(ownerId)
      .map((row) => this.record(row));
  }
  // Shared reads are for authenticated routes only. Writes must continue to use get(ownerId, id).
  read(id: string): CharacterRecord {
    const row = this.db
      .prepare(
        'SELECT c.*,u.name AS owner_name FROM characters c JOIN users u ON u.id=c.owner_id WHERE c.id=?',
      )
      .get(id);
    if (!row) throw new DomainError(404, 'Nie znaleziono postaci.');
    return this.record(row);
  }
  listAll() {
    return this.db
      .prepare(
        'SELECT c.*,u.name AS owner_name FROM characters c JOIN users u ON u.id=c.owner_id ORDER BY c.updated_at DESC',
      )
      .all()
      .map((row) => this.record(row));
  }
  history(ownerId: string, id: string) {
    this.get(ownerId, id);
    return this.events(id);
  }
  readHistory(id: string) {
    this.read(id);
    return this.events(id);
  }
  private events(id: string) {
    return this.db
      .prepare(
        'SELECT id,kind,date FROM character_events WHERE character_id=? ORDER BY id DESC LIMIT 80',
      )
      .all(id) as { id: number; kind: string; date: string }[];
  }
  mutate(
    ownerId: string,
    id: string,
    revision: number,
    commandId: string,
    command: unknown,
    apply: (record: CharacterRecord) => void,
  ): CharacterRecord {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const record = this.get(ownerId, id),
        before = JSON.stringify(record.document),
        beforeStatus = record.status;
      const hash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
      const existing = this.db
        .prepare('SELECT command_hash FROM character_events WHERE character_id=? AND command_id=?')
        .get(id, commandId);
      if (existing) {
        if (existing.command_hash !== hash)
          throw new DomainError(409, 'Identyfikator działania został już użyty do innego żądania.');
        this.db.exec('COMMIT');
        return record;
      }
      if (record.revision !== revision)
        throw new DomainError(
          409,
          'Postać zmieniła się w innej karcie. Odśwież dane przed ponownym zapisem.',
        );
      apply(record);
      record.document = characterSchema.parse(record.document);
      if (record.document.portraitId) this.portrait(ownerId, record.document.portraitId);
      const date = new Date().toISOString(),
        after = JSON.stringify(record.document);
      this.db
        .prepare(
          'UPDATE characters SET name=?,status=?,revision=revision+1,updated_at=?,document=? WHERE id=? AND owner_id=?',
        )
        .run(record.document.name, record.status, date, after, id, ownerId);
      this.db
        .prepare(
          'INSERT INTO character_events(character_id,actor_id,command_id,command_hash,kind,date,before_document,before_status,after_document) VALUES(?,?,?,?,?,?,?,?,?)',
        )
        .run(
          id,
          ownerId,
          commandId,
          hash,
          (command as { type: string }).type,
          date,
          before,
          beforeStatus,
          after,
        );
      for (const table of ['xp_entries', 'advancements', 'rule_exceptions'])
        this.db.prepare(`DELETE FROM ${table} WHERE character_id=?`).run(id);
      record.document.xp.forEach((e) =>
        this.db
          .prepare('INSERT INTO xp_entries VALUES(?,?,?,?,?)')
          .run(e.id, id, e.amount, e.note, e.date),
      );
      record.document.advances.forEach((a, index) =>
        this.db
          .prepare('INSERT INTO advancements VALUES(?,?,?,?)')
          .run(a.id, id, index + 1, JSON.stringify(a)),
      );
      record.document.rulings.forEach((r) =>
        this.db
          .prepare('INSERT INTO rule_exceptions VALUES(?,?,?,?)')
          .run(r.id, id, r.code, JSON.stringify(r)),
      );
      this.db.exec('COMMIT');
      return this.get(ownerId, id);
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  restore(record: CharacterRecord) {
    if (record.status !== 'archived') throw new DomainError(422, 'Postać nie jest w archiwum.');
    const archived = this.db
      .prepare(
        "SELECT before_status FROM character_events WHERE character_id=? AND kind='archive' ORDER BY id DESC LIMIT 1",
      )
      .get(record.id);
    record.status = archived?.before_status === 'draft' ? 'draft' : 'active';
  }
  portrait(ownerId: string, id: string): PortraitImage {
    const row = this.db
      .prepare('SELECT data,width,height FROM portrait_images WHERE id=? AND owner_id=?')
      .get(id, ownerId);
    if (!row) throw new DomainError(404, 'Nie znaleziono portretu.');
    return { data: row.data as Uint8Array, width: Number(row.width), height: Number(row.height) };
  }
  attachPortrait(
    ownerId: string,
    recordId: string,
    revision: number,
    commandId: string,
    digest: string,
    image: PortraitImage,
  ) {
    return this.mutate(
      ownerId,
      recordId,
      revision,
      commandId,
      { type: 'portrait', digest },
      (record) => {
        if (record.status === 'archived')
          throw new DomainError(422, 'Zarchiwizowana postać jest tylko do odczytu.');
        const id = randomUUID();
        this.db
          .prepare('INSERT INTO portrait_images VALUES(?,?,?,?,?)')
          .run(id, ownerId, image.data, image.width, image.height);
        record.document.portraitId = id;
      },
    );
  }
  undo(record: CharacterRecord) {
    const last = this.db
      .prepare(
        'SELECT before_document,before_status,kind FROM character_events WHERE character_id=? ORDER BY id DESC LIMIT 1',
      )
      .get(record.id);
    if (!last || last.kind === 'undo')
      throw new DomainError(
        422,
        'Nie ma działania do cofnięcia. Możesz cofnąć tylko ostatnią zmianę.',
      );
    record.document = characterSchema.parse(JSON.parse(last.before_document as string));
    record.status = last.before_status as CharacterRecord['status'];
  }
}
let singleton: Repository | undefined;
export const repository = () => (singleton ??= new Repository(config().databasePath));
