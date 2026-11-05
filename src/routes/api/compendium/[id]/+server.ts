import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { repository, DomainError } from '../../../../lib/server/db';
import { apiError, readJson } from '../../../../lib/server/http';
import { equipmentCommandSchema } from '../../../../lib/compendium';
export function GET({ locals, params }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const catalog = repository().equipment;
    return json({
      record: catalog.read(params.id, locals.user.id),
      history: catalog.history(params.id, locals.user.id),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST({ locals, params, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const body = z
      .object({
        commandId: z.string().uuid(),
        revision: z.number().int().min(1),
        command: equipmentCommandSchema,
      })
      .strict()
      .parse(await readJson(request));
    return json(
      repository().equipment.change(
        locals.user.id,
        params.id,
        body.revision,
        body.commandId,
        body.command,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
