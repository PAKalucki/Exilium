import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { repository, DomainError } from '../../../lib/server/db';
import { readJson, apiError } from '../../../lib/server/http';
export async function POST({ locals, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const { name } = z
      .object({ name: z.string().trim().min(1).max(160) })
      .strict()
      .parse(await readJson(request));
    return json(repository().create(locals.user.id, name), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
