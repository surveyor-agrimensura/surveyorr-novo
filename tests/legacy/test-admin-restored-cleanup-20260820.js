import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const admin = read('admin/index.html');
const runtime = read('assets/js/core/ui.js');

assert.match(admin, /<title>Administração — Surveyor<\/title>/);
assert.match(admin, /Painel administrativo/);
assert.match(admin, /data-tab="users"/);
assert.match(admin, /data-tab="plans"/);
assert.match(admin, /data-tab="layers"/);
assert.match(admin, /data-tab="notices"/);
assert.match(admin, /\/admin-cards\//);
assert.match(runtime, /enhanceAdminHomeCardsLink/);
assert.equal(/AGR Admin|AGR Gestão|Atualizações GCU|ADMIN_API_KEY/.test(admin), false);

for (const forbidden of ['src/main','src/renderer','src/preload','installer-src','build','cloudflare']) {
  assert.equal(fs.existsSync(path.join(root, forbidden)), false, `Artefato externo não deve existir: ${forbidden}`);
}
for (const forbidden of ['AGR-Admin.exe','AGR-Atualizacao.gcu.example','canal-atualizacao.txt']) {
  assert.equal(fs.existsSync(path.join(root, forbidden)), false, `Arquivo externo não deve existir: ${forbidden}`);
}

console.log('OK Admin Surveyor restaurado e artefatos externos removidos.');
