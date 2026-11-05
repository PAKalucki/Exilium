import { error } from '@sveltejs/kit';
import js from 'swagger-ui-dist/swagger-ui-bundle.js?url';
import css from 'swagger-ui-dist/swagger-ui.css?url';
import { openApiDocument } from '../../../lib/server/openapi';
import { APP_VERSION } from '../../../lib/version';
export function GET({ locals }: import('./$types').RequestEvent) {
  if (!locals.user) error(401, 'Zaloguj się ponownie.');
  const spec = JSON.stringify(openApiDocument(APP_VERSION)).replaceAll('<', '\\u003c');
  return new Response(
    `<!doctype html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Exilium API Swagger</title><link rel="stylesheet" href="${css}"><style>body{margin:0;background:#fff}.swagger-ui .topbar{display:none}</style></head><body><div id="swagger-ui"></div><script src="${js}"></script><script>SwaggerUIBundle({dom_id:'#swagger-ui',spec:${spec},validatorUrl:null,persistAuthorization:false,withCredentials:false,queryConfigEnabled:false,deepLinking:true,requestInterceptor:function(request){request.credentials='omit';if(new URL(request.url,location.origin).origin!==location.origin)throw new Error('Dozwolone są tylko wywołania bieżącej aplikacji.');return request;}});</script></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // This private same-origin frame is embedded only in our own authenticated docs.
        'Content-Security-Policy': "frame-ancestors 'self'",
        'X-Frame-Options': 'SAMEORIGIN',
      },
    },
  );
}
