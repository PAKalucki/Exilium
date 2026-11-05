import { json } from '@sveltejs/kit';
import { repository } from '../../../lib/server/db';
import { authConfigured } from '../../../lib/server/config';
import { APP_VERSION } from '../../../lib/version';
export function GET() {
  try {
    repository().db.prepare('SELECT 1').get();
    return json(
      { status: 'ok', version: APP_VERSION, authenticationConfigured: authConfigured() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return json({ status: 'error' }, { status: 503 });
  }
}
