import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { repository, DomainError } from '../../../lib/server/db';
import { characterForViewer } from '../../../lib/server/visibility';
import { readJson, apiError } from '../../../lib/server/http';
import { characterCategorySchema, newCharacter } from '../../../lib/rules/model';
export async function POST({ locals, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const { name, category } = z
      .object({
        name: z.string().trim().min(1).max(160),
        category: characterCategorySchema.default('wildCard'),
      })
      .strict()
      .parse(await readJson(request));
    return json(repository().create(locals.user.id, name, newCharacter(name, category)), {
      status: 201,
    });
  } catch (e) {
    return apiError(e);
  }
}

export function GET({ locals }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    return json(
      repository()
        .listAll()
        .map((record) => characterForViewer(record, locals.user!)),
    );
  } catch (e) {
    return apiError(e);
  }
}
