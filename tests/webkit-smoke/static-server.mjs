// Tiny static file server for the WebKit smoke. Serves the repo root with correct
// MIME types (notably .mjs -> text/javascript, which the game relies on for ES modules)
// and ignores the "?v=..." cache-busting query strings the game appends to imports.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function startServer(root = REPO_ROOT, port = 0) {
  const server = http.createServer((req, res) => {
    try {
      // Strip query (?v=...) and fragment; decode %XX.
      let pathname = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if (pathname.endsWith('/')) pathname += 'index.html';
      // Resolve inside root; reject traversal.
      const filePath = path.normalize(path.join(root, pathname));
      if (!filePath.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
      fs.stat(filePath, (err, stat) => {
        let target = filePath;
        if (!err && stat.isDirectory()) target = path.join(filePath, 'index.html');
        fs.readFile(target, (e, data) => {
          if (e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found: ' + pathname); return; }
          const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
          res.end(data);
        });
      });
    } catch (e) {
      res.writeHead(500); res.end('server error');
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      resolve({ server, port: actual, url: `http://127.0.0.1:${actual}/` });
    });
  });
}

// Allow running standalone: `node static-server.mjs [port]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2]) || 8765;
  startServer(REPO_ROOT, port).then(({ url }) => console.log('serving', REPO_ROOT, 'at', url));
}
