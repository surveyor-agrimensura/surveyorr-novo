const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const manifest = JSON.parse(read('manifest.webmanifest'));
assert(manifest.short_name === 'Surveyor', 'Manifest sem short_name Surveyor');
assert(manifest.display === 'standalone', 'Manifest não está em standalone');
assert(Array.isArray(manifest.icons) && manifest.icons.some(i => i.sizes === '192x192'), 'Ícone 192 ausente');
assert(manifest.icons.some(i => i.sizes === '512x512'), 'Ícone 512 ausente');
assert(fs.existsSync(path.join(root, 'assets/pwa/surveyor-192.png')), 'Arquivo ícone 192 ausente');
assert(fs.existsSync(path.join(root, 'assets/pwa/surveyor-512.png')), 'Arquivo ícone 512 ausente');
assert(fs.existsSync(path.join(root, 'sw.js')), 'Service Worker ausente');

const layout = read('assets/js/core/layout.js');
assert(layout.includes('beforeinstallprompt'), 'Captura beforeinstallprompt ausente');
assert(layout.includes('appinstalled'), 'Tratamento appinstalled ausente');
assert(layout.includes('data-surveyor-pwa-install'), 'Botão instalar ausente');
assert(layout.includes("navigator.serviceWorker.register"), 'Registro de Service Worker ausente');

const css = read('assets/css/core/ui.css');
assert(css.includes('.sv-pwa-install-button'), 'Estilo do botão Instalar ausente');
assert(css.includes('.sv-pwa-install-button[hidden]'), 'Regra para esconder botão ausente');

const index = read('index.html');
assert(index.includes('rel="manifest"'), 'Manifest não ligado ao index');
assert(index.includes('pwa-install-0823'), 'Cache-busting PWA ausente');

console.log('OK: PWA instalável configurada, botão condicionado ao prompt e ícones presentes.');
