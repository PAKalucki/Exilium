import { redirect } from '@sveltejs/kit';
export function load({ locals }: import('./$types').RequestEvent) {
  if (!locals.user) redirect(303, '/');
}
