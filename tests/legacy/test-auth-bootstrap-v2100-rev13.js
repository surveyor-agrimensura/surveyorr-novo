import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');
const auth = fs.readFileSync(path.join(root, 'assets/js/core/auth.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const declaration = auth.indexOf('function normalizeAuthLoginPayload(data)');
const loginUse = auth.indexOf('const normalizedLogin = normalizeAuthLoginPayload(data)');
const publicExport = auth.indexOf('normalizeAuthLoginPayload,');
const publicObject = auth.indexOf('window.GeoRuralAuth = {');

assert(declaration >= 0, 'normalizeAuthLoginPayload precisa estar declarada.');
assert(loginUse > declaration, 'A normalização precisa ser declarada antes do login.');
assert(publicObject > declaration, 'A normalização precisa existir antes do objeto público.');
assert(publicExport > publicObject, 'A função precisa continuar exportada no objeto público.');
assert((auth.match(/function normalizeAuthLoginPayload\(data\)/g) || []).length === 1,
  'A função de normalização deve possuir uma única declaração.');

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(root);
const authPages = htmlFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('assets/js/core/auth.js?v='));
assert(authPages.length > 0, 'Nenhuma página carrega assets/js/core/auth.js.');
for (const file of authPages) {
  const html = fs.readFileSync(file, 'utf8');
  assert(/auth\.js\?v=21\.11\.2-session-watch/.test(html),
    `Cache antigo do assets/js/core/auth.js ainda presente em ${path.relative(root, file)}.`);
}

console.log(`OK v21.10.0 REV13: bootstrap de autenticação restaurado e cache atualizado em ${authPages.length} página(s).`);
