import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT || 4178);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

function sendFile(request, response, filePath) {
  const stat = statSync(filePath);
  response.statusCode = 200;
  response.setHeader('Content-Type', contentTypes[extname(filePath)] || 'application/octet-stream');
  response.setHeader('Content-Length', stat.size);
  response.setHeader('Cache-Control', filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600');
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

createServer((request, response) => {
  response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Invalid URL');
    return;
  }

  const relative = pathname.replace(/^[/\\]+/, '');
  const filePath = resolve(root, relative);
  if (filePath !== root && !filePath.toLowerCase().startsWith((root + sep).toLowerCase())) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    if (statSync(filePath).isFile()) {
      sendFile(request, response, filePath);
      return;
    }
  } catch {}

  if (!extname(pathname)) {
    sendFile(request, response, resolve(root, 'index.html'));
    return;
  }
  response.writeHead(404).end('Not found');
}).listen(port, '0.0.0.0', () => {
  process.stdout.write('Lexica Mobile Web disponivel em http://localhost:' + port + '\n');
  process.stdout.write('Use Ctrl+C para encerrar o servidor.\n');
});
