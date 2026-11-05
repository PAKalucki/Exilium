import { json } from '@sveltejs/kit';
import { repository, DomainError } from '../../../lib/server/db';
import { apiError } from '../../../lib/server/http';
import { managesGame } from '../../../lib/access';
import { APP_VERSION } from '../../../lib/version';
export function GET({ locals }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    if (!managesGame(locals.user))
      throw new DomainError(403, 'Diagnostyka wymaga roli MG lub administratora.');
    const db = repository().db;
    return json(
      {
        version: APP_VERSION,
        schema: Number(db.prepare('SELECT max(version) v FROM schema_migrations').get()!.v),
        database: db.prepare('PRAGMA quick_check').get()!.quick_check,
        counts: {
          users: Number(db.prepare('SELECT count(*) n FROM users').get()!.n),
          characters: Number(db.prepare('SELECT count(*) n FROM characters').get()!.n),
          equipment: Number(db.prepare('SELECT count(*) n FROM equipment_catalog').get()!.n),
          pendingEquipment: Number(
            db
              .prepare(
                "SELECT count(*) n FROM equipment_catalog WHERE approval_status='pending' AND status='active'",
              )
              .get()!.n,
          ),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
