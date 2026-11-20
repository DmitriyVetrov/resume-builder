// Static files for the gate pages: the bundle, fonts, fixtures. Same origin only, so nothing depends on the network.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { ROOT } from './shared.mjs';

const TYPES = { '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.html': 'text/html' };
const allowed = [['/build/', resolve(import.meta.dirname, 'build')], ['/fonts/', resolve(ROOT, 'frontend/src/assets/fonts')], ['/fixtures/', resolve(ROOT, 'tests/fixtures/resumes')], ['/out/', resolve(import.meta.dirname, 'out')]];
createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://x');
  if (pathname === '/health') { response.end('ok'); return; }
  if (pathname === '/page') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html><head><meta charset="utf-8"><title>gate</title></head><body style="margin:0;background:#fff"></body></html>'); return; }
  const match = allowed.find(([prefix]) => pathname.startsWith(prefix));
  if (!match || pathname.includes('..')) { response.statusCode = 404; response.end(); return; }
  try {
    const body = await readFile(resolve(match[1], pathname.slice(match[0].length)));
    response.setHeader('content-type', TYPES[extname(pathname)] ?? 'application/octet-stream');
    response.end(body);
  } catch { response.statusCode = 404; response.end(); }
}).listen(4179, '127.0.0.1');
