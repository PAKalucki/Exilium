import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { repository, DomainError } from '../../../../../lib/server/db';
import { apiError } from '../../../../../lib/server/http';
import { normalizePortrait, portraitBody } from '../../../../../lib/server/portraits';

export function GET({ locals, params, url, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const record = repository().read(params.id),
      id = record.document.portraitId;
    if (!id || (url.searchParams.has('v') && url.searchParams.get('v') !== id))
      throw new DomainError(404, 'Nie znaleziono portretu.');
    const etag = `"portrait-${id}"`;
    const headers = {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, no-cache',
      'Content-Disposition': 'inline; filename="portrait.jpg"',
      ETag: etag,
      Vary: 'Cookie',
    };
    const matches = request.headers
      .get('If-None-Match')
      ?.split(',')
      .some((tag) => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === etag);
    if (matches) return new Response(null, { status: 304, headers });
    const image = repository().portrait(record.ownerId, id);
    return new Response(new Uint8Array(image.data), {
      headers,
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST({ locals, params, request }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const record = repository().get(locals.user.id, params.id);
    if (record.status === 'archived')
      throw new DomainError(422, 'Zarchiwizowana postać jest tylko do odczytu.');
    const { revision, commandId } = z
      .object({ revision: z.coerce.number().int().min(1), commandId: z.string().uuid() })
      .parse({
        revision: request.headers.get('X-Character-Revision'),
        commandId: request.headers.get('X-Command-Id'),
      });
    const body = await portraitBody(request),
      image = normalizePortrait(body);
    return json(
      repository().attachPortrait(
        locals.user.id,
        params.id,
        revision,
        commandId,
        createHash('sha256').update(body).digest('hex'),
        image,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
