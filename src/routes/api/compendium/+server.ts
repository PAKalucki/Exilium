import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { repository, DomainError } from '../../../lib/server/db';
import { apiError, readJson } from '../../../lib/server/http';
import { equipmentDocumentSchema } from '../../../lib/compendium';
export function GET({ locals, url }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json(repository().equipment.list(url.searchParams.get('archived') === '1'));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST({ locals, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const body = z
      .object({ commandId: z.string().uuid(), document: equipmentDocumentSchema })
      .strict()
      .parse(await readJson(request));
    return json(repository().equipment.create(locals.user.id, body.commandId, body.document), {
      status: 201,
    });
  } catch (e) {
    return apiError(e);
  }
}
