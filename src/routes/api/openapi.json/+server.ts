import { json } from '@sveltejs/kit';
import { APP_VERSION } from '../../../lib/version';
import { openApiDocument } from '../../../lib/server/openapi';
export function GET({ locals }: import('./$types').RequestEvent) {
  if (!locals.user) return json({ error: 'Zaloguj się ponownie.' }, { status: 401 });
  return json(openApiDocument(APP_VERSION), { headers: { 'Cache-Control': 'no-store' } });
}
