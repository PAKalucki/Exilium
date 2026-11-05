import { createServer } from 'node:http';
import { configuredOrigins } from './origins.mjs';

try {
  process.loadEnvFile('.env');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const settings = configuredOrigins();
// Host must match deployment configuration. Client/proxy forwarded headers cannot
// select a scheme, cookie policy or OAuth callback for this server.
process.env.PROTOCOL_HEADER = 'x-exilium-protocol';
process.env.HOST_HEADER = '';
process.env.PORT_HEADER = '';
const { handler } = await import('../build/handler.js');
const server = createServer((req, res) => {
  const origin = settings.hosts.get((req.headers.host || '').toLowerCase());
  if (!origin) {
    res.writeHead(421, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end('Niedozwolony adres aplikacji.');
    return;
  }
  // Cloudflare supplies the visitor scheme on requests carried by the tunnel.
  // This header can only request a redirect to a configured HTTPS origin; it can
  // never choose an OAuth callback, downgrade cookie security, or change a host.
  if (new URL(origin).protocol === 'https:') {
    let visitor;
    try {
      visitor = JSON.parse(req.headers['cf-visitor'] || 'null');
    } catch {
      visitor = null;
    }
    if (visitor?.scheme === 'http') {
      const path = req.url?.startsWith('/') ? req.url : '/';
      res.writeHead(308, { Location: `${origin}${path}`, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
  }
  req.headers['x-exilium-protocol'] = new URL(origin).protocol.slice(0, -1);
  handler(req, res, () => {
    res.writeHead(404);
    res.end();
  });
});
server.requestTimeout = 60_000;
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => {
  console.log(`Exilium listening on port ${process.env.PORT || 3000}`);
});
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      process.emit('sveltekit:shutdown', signal);
    });
    server.closeIdleConnections();
    setTimeout(
      () => {
        server.closeAllConnections();
        process.exit(1);
      },
      Number(process.env.SHUTDOWN_TIMEOUT || 15) * 1000,
    ).unref();
  });
