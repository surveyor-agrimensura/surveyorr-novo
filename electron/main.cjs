const { app, BrowserWindow, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 5500;
let server;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

function startStaticServer() {
  const root = path.join(app.getAppPath(), 'dist');
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${PORT}`).pathname);
    const candidate = path.resolve(root, `.${pathname}`);
    if (!candidate.startsWith(root + path.sep) && candidate !== path.join(root, 'index.html')) {
      res.writeHead(403).end('Forbidden'); return;
    }
    const file = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });
}

async function createWindow() {
  await startStaticServer();
  const win = new BrowserWindow({ width: 1440, height: 920, minWidth: 1024, minHeight: 700, backgroundColor: '#f4f7fb', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) void shell.openExternal(url); return { action: 'deny' }; });
  await win.loadURL(`http://localhost:${PORT}/`);
}

app.whenReady().then(createWindow).catch(error => { console.error('Não foi possível iniciar o SURVEYOR:', error); app.quit(); });
app.on('window-all-closed', () => { server?.close(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
