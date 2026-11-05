import type { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { apiScopes, roles, type ApiScope, type Role } from '../access';
import { DomainError } from './errors';

export type User = { id: string; discordId: string; name: string; enabled: number; role: Role };
export type TokenSummary = {
  id: string;
  name: string;
  scopes: ApiScope[];
  createdAt: string;
  expiresAt: number;
  lastUsedAt: string | null;
};
export type TokenUser = User & { guildId: string; scopes: ApiScope[] };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z
      .array(z.enum(apiScopes))
      .min(1)
      .max(2)
      .transform((v) => [...new Set(v)]),
    days: z.number().int().min(1).max(90).default(30),
  })
  .strict();
export class IdentityRepository {
  constructor(
    private db: DatabaseSync,
    private bootstrapId = '',
  ) {
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version=5').get()) {
        db.exec(`
          ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('player','gm','admin'));
          CREATE TABLE user_events(id INTEGER PRIMARY KEY,actor_id TEXT REFERENCES users(id),user_id TEXT NOT NULL REFERENCES users(id),date TEXT NOT NULL,before_document TEXT NOT NULL,after_document TEXT NOT NULL);
          CREATE TABLE api_tokens(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),token_hash TEXT UNIQUE NOT NULL,name TEXT NOT NULL,scopes TEXT NOT NULL,guild_id TEXT NOT NULL,created_at TEXT NOT NULL,expires_at INTEGER NOT NULL,last_used_at TEXT);
          CREATE INDEX api_tokens_user ON api_tokens(user_id);
          ALTER TABLE equipment_catalog ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('pending','approved','rejected'));
          ALTER TABLE equipment_catalog ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
          ALTER TABLE equipment_catalog_events ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
          INSERT INTO schema_migrations VALUES(5,datetime('now'));
        `);
      }
      this.bootstrap();
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  bootstrap() {
    if (!this.bootstrapId) return;
    const row = this.db
      .prepare('SELECT id,role,enabled FROM users WHERE discord_id=?')
      .get(this.bootstrapId);
    if (row && (row.role !== 'admin' || row.enabled !== 1)) {
      this.db.prepare("UPDATE users SET role='admin',enabled=1 WHERE id=?").run(row.id);
      this.db
        .prepare(
          'INSERT INTO user_events(actor_id,user_id,date,before_document,after_document) VALUES(NULL,?,?,?,?)',
        )
        .run(
          row.id,
          new Date().toISOString(),
          JSON.stringify(row),
          JSON.stringify({ role: 'admin', enabled: 1, reason: 'DEPLOYMENT_ADMIN_DISCORD_ID' }),
        );
    }
  }
  user(id: string): User {
    const row = this.db
      .prepare('SELECT id,discord_id AS discordId,name,enabled,role FROM users WHERE id=?')
      .get(id) as User | undefined;
    if (!row?.enabled) throw new DomainError(403, 'Konto jest wyłączone lub nie istnieje.');
    return row;
  }
  private admin(actor: string) {
    if (this.user(actor).role !== 'admin')
      throw new DomainError(403, 'Tylko administrator zarządza użytkownikami i rolami.');
  }
  list(actor: string) {
    this.admin(actor);
    return this.db
      .prepare('SELECT id,discord_id AS discordId,name,enabled,role FROM users ORDER BY name,id')
      .all() as User[];
  }
  change(actor: string, id: string, input: unknown) {
    const change = z
      .object({
        role: z.enum(roles),
        enabled: z.boolean(),
        expectedRole: z.enum(roles),
        expectedEnabled: z.boolean(),
      })
      .strict()
      .parse(input);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.admin(actor);
      const target = this.db
        .prepare('SELECT id,discord_id AS discordId,name,enabled,role FROM users WHERE id=?')
        .get(id) as User | undefined;
      if (!target) throw new DomainError(404, 'Nie znaleziono użytkownika.');
      if (target.role !== change.expectedRole || !!target.enabled !== change.expectedEnabled)
        throw new DomainError(409, 'Konto zmieniło się. Odśwież panel użytkowników.');
      if (target.discordId === this.bootstrapId && (change.role !== 'admin' || !change.enabled))
        throw new DomainError(
          422,
          'Administrator wskazany w konfiguracji wdrożenia musi pozostać aktywny.',
        );
      if (
        target.role === 'admin' &&
        target.enabled &&
        (change.role !== 'admin' || !change.enabled) &&
        Number(
          this.db.prepare("SELECT count(*) n FROM users WHERE role='admin' AND enabled=1").get()!.n,
        ) <= 1
      )
        throw new DomainError(422, 'Nie można wyłączyć ani zdegradować ostatniego administratora.');
      this.db
        .prepare('UPDATE users SET role=?,enabled=? WHERE id=?')
        .run(change.role, Number(change.enabled), id);
      this.db
        .prepare(
          'INSERT INTO user_events(actor_id,user_id,date,before_document,after_document) VALUES(?,?,?,?,?)',
        )
        .run(
          actor,
          id,
          new Date().toISOString(),
          JSON.stringify(target),
          JSON.stringify({ role: change.role, enabled: change.enabled }),
        );
      if (!change.enabled) {
        this.db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id);
        this.db.prepare('DELETE FROM api_tokens WHERE user_id=?').run(id);
      }
      const users = this.db
        .prepare('SELECT id,discord_id AS discordId,name,enabled,role FROM users ORDER BY name,id')
        .all() as User[];
      this.db.exec('COMMIT');
      return users;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  history(actor: string) {
    this.admin(actor);
    return this.db
      .prepare(
        `SELECT e.id,e.date,a.name AS actorName,u.name AS userName,e.before_document AS before,e.after_document AS after FROM user_events e LEFT JOIN users a ON a.id=e.actor_id JOIN users u ON u.id=e.user_id ORDER BY e.id DESC LIMIT 100`,
      )
      .all();
  }
  tokens(actor: string) {
    this.user(actor);
    return this.db
      .prepare(
        'SELECT id,name,scopes,created_at AS createdAt,expires_at AS expiresAt,last_used_at AS lastUsedAt FROM api_tokens WHERE user_id=? ORDER BY created_at DESC',
      )
      .all(actor)
      .map(
        (row) =>
          ({
            id: String(row.id),
            name: String(row.name),
            scopes: JSON.parse(String(row.scopes)) as ApiScope[],
            createdAt: String(row.createdAt),
            expiresAt: Number(row.expiresAt),
            lastUsedAt: row.lastUsedAt ? String(row.lastUsedAt) : null,
          }) satisfies TokenSummary,
      );
  }
  createToken(actor: string, guildId: string, input: unknown) {
    this.user(actor);
    const value = tokenInput.parse(input);
    if (
      Number(
        this.db
          .prepare('SELECT count(*) n FROM api_tokens WHERE user_id=? AND expires_at>?')
          .get(actor, Date.now())!.n,
      ) >= 20
    )
      throw new DomainError(422, 'Limit 20 aktywnych tokenów. Usuń nieużywany token.');
    const token = `exi_${randomBytes(32).toString('base64url')}`,
      id = randomUUID();
    this.db
      .prepare('INSERT INTO api_tokens VALUES(?,?,?,?,?,?,?,?,NULL)')
      .run(
        id,
        actor,
        hash(token),
        value.name,
        JSON.stringify(value.scopes),
        guildId,
        new Date().toISOString(),
        Date.now() + value.days * 86400000,
      );
    return { id, token };
  }
  token(token: string): TokenUser | null {
    if (!/^exi_[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const row = this.db
      .prepare(
        'SELECT u.id,u.discord_id AS discordId,u.name,u.enabled,u.role,t.guild_id AS guildId,t.scopes,t.id AS tokenId FROM api_tokens t JOIN users u ON u.id=t.user_id WHERE token_hash=? AND expires_at>? AND u.enabled=1',
      )
      .get(hash(token), Date.now());
    if (!row) return null;
    this.db
      .prepare('UPDATE api_tokens SET last_used_at=? WHERE id=?')
      .run(new Date().toISOString(), row.tokenId);
    return {
      id: String(row.id),
      discordId: String(row.discordId),
      name: String(row.name),
      enabled: Number(row.enabled),
      role: row.role as Role,
      guildId: String(row.guildId),
      scopes: JSON.parse(String(row.scopes)),
    };
  }
  revokeToken(actor: string, id: string) {
    this.user(actor);
    this.db.prepare('DELETE FROM api_tokens WHERE id=? AND user_id=?').run(id, actor);
  }
}
