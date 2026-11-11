import { DomainError, repository } from '../../../../../lib/server/db';
import { apiError } from '../../../../../lib/server/http';
import { characterPdf } from '../../../../../lib/server/pdf';
import { characterForViewer } from '../../../../../lib/server/visibility';
export async function GET({ locals, params, url }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const record = characterForViewer(
      repository().read(params.id),
      locals.user,
      url.searchParams.get('revealPrivate') === '1',
    );
    const portrait = record.document.portraitId
      ? repository().portrait(record.ownerId, record.document.portraitId)
      : null;
    const pdf = await characterPdf(
      record.document,
      portrait?.data,
      record.visibleStats,
      record.redacted,
    );
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
