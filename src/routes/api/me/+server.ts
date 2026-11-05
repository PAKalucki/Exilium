import { json } from '@sveltejs/kit';
export function GET({ locals }: import('./$types').RequestEvent) {
  if (!locals.user) return json({ error: 'Zaloguj się ponownie.' }, { status: 401 });
  return json({
    user: { id: locals.user.id, name: locals.user.name, role: locals.user.role },
    scopes: locals.apiScopes,
  });
}
