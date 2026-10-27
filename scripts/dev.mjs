import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.SURVEYOR_LOCAL_HOST || '127.0.0.1';
const port = Number(process.env.SURVEYOR_LOCAL_PORT || 5500);
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'], ['.ico', 'image/x-icon'], ['.pdf', 'application/pdf'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.zip', 'application/zip'], ['.woff2', 'font/woff2']
]);

const publicRootFiles = new Set(['index.html', '404.html', 'VERSION', 'manifest.webmanifest', 'sw.js', 'CNAME', 'robots.txt', 'favicon.ico']);
const publicDirectories = new Set(fs.readdirSync(root, { withFileTypes:true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'index.html')))
  .map((entry) => entry.name));
publicDirectories.add('assets');

function safeFile(requestPath) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(requestPath, `http://${host}:${port}`).pathname); }
  catch { return null; }
  const normalized = path.posix.normalize(pathname).replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  const first = parts[0] || 'index.html';
  // A árvore do backend, configurações, testes e scripts nunca pertence à raiz web.
  const publicPath = !normalized || publicRootFiles.has(normalized)
    || (first === 'assets' && parts.length > 1 && !parts.some((part) => part.startsWith('.')))
    || (first === '.well-known' && normalized === '.well-known/security.txt')
    || (publicDirectories.has(first) && (parts.length === 1 || (parts.length === 2 && parts[1] === 'index.html')));
  if (!publicPath) return null;
  const candidate = path.resolve(root, normalized);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  return candidate;
}

function resolveFile(candidate) {
  if (!candidate) return null;
  try {
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      const index = path.join(candidate, 'index.html');
      return fs.existsSync(index) ? index : null;
    }
    return stat.isFile() ? candidate : null;
  } catch {
    if (!path.extname(candidate)) {
      const index = path.join(candidate, 'index.html');
      if (fs.existsSync(index)) return index;
    }
    return null;
  }
}

const server = http.createServer((req, res) => {
  const file = resolveFile(safeFile(req.url || '/'));
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Arquivo não encontrado.');
    return;
  }
  const type = mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Surveyor local disponível em http://localhost:${port}/login/`);
  console.log('Pressione Ctrl+C para encerrar.');
});
