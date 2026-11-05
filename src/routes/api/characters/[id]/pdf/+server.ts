import { DomainError, repository } from '../../../../../lib/server/db';
import { apiError } from '../../../../../lib/server/http';
import { characterPdf } from '../../../../../lib/server/pdf';
export async function GET({ locals, params }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const record = repository().get(locals.user.id, params.id);
    const portrait = record.document.portraitId
      ? repository().portrait(locals.user.id, record.document.portraitId)
      : null;
    const pdf = await characterPdf(record.document, portrait?.data);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="exilium.pdf"; filename*=UTF-8''${encodeURIComponent(record.document.name)}.pdf`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
