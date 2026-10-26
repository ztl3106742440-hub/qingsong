import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/qingsong') { response.writeHead(302, { Location: '/qingsong/' }); response.end(); return; }
      if (pathname.startsWith('/qingsong/')) pathname = pathname.slice('/qingsong'.length);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const path = resolve(root, '.' + pathname);
      if (!path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
      if (!(await stat(path)).isFile()) throw new Error('Not a file');
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(await readFile(path));
    } catch { response.writeHead(404); response.end('Not found'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4174);
  createServer().listen(port, '127.0.0.1', () => console.log(`清松本地预览：http://127.0.0.1:${port}/qingsong/`));
}
