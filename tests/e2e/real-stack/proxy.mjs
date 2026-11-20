// Throwaway same-origin host for acceptance: serves frontend/dist and forwards /api/v1 to the API, as the production
// ingress does. `__Host-` cookies need http://localhost and antiforgery needs HTTPS as seen by the API, hence the header.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { createGzip } from 'node:zlib';

const [, , dist = 'frontend/dist', port = '4190', api = '5090'] = process.argv;
const types = { '.ttf': 'font/ttf', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path.startsWith('/api/')) {
    const forward = request({ host: '127.0.0.1', port: Number(api), path: req.url, method: req.method, headers: { ...req.headers, 'x-forwarded-proto': 'https', 'x-forwarded-for': '127.0.0.1' } }, answer => {
      res.writeHead(answer.statusCode, answer.headers);
      answer.pipe(res);
    });
    forward.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(forward);
    return;
  }
  const file = join(dist, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  const target = existsSync(file) && statSync(file).isFile() ? file : join(dist, 'index.html');
  const type = types[extname(target)] ?? 'application/octet-stream';
  // What the web image does (DD-P11-12), so the NFR-02 measure sees the bytes production sends.
  if (/gzip/.test(req.headers['accept-encoding'] ?? '') && ['.ttf', '.js', '.css'].includes(extname(target))) {
    res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    createReadStream(target).pipe(createGzip()).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': type });
  createReadStream(target).pipe(res);
}).listen(Number(port), '127.0.0.1');
