import { json } from '@sveltejs/kit';
import { repository } from '../../../lib/server/db';
import { authConfigured } from '../../../lib/server/config';
export function GET() {
  try {
    repository().db.prepare('SELECT 1').get();
    return json(
      { status: 'ok', version: '0.1.0', authenticationConfigured: authConfigured() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return json({ status: 'error' }, { status: 503 });
  }
}
