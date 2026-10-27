import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const obsolete = [
  'admin-plan-documents-v21.9.375.js',
  'admin-plan-documents-v21.9.375.css',
  'admin-plan-documents-v21.9.380.js',
  'admin-plan-documents-v21.9.380.css',
  'memorial-preview-v21.9.399.css',
  'memorial-preview-v21.9.400.css',
  'smart-forms-v21.9.401.js',
  'smart-forms-v21.9.401.css',
  'customizacao-v21.9.118.css',
  'suite-v21.8.js',
  'suite-v21.9.0.js',
  'assets/surveyor-pro-logo.png',
  'assets/suporte-tecnico.png'
];
for (const file of obsolete) assert.equal(fs.existsSync(file), false, `Arquivo obsoleto ainda presente: ${file}`);
for (const file of ['assets/js/admin/documents.js','assets/css/admin/documents.css','assets/css/features/memorial/memorial-preview.css','assets/js/core/ui.js','assets/css/core/ui.css','assets/js/core/suite.js']) {
  assert.ok(fs.existsSync(file), `Arquivo consolidado ausente: ${file}`);
}

const customPage = fs.readFileSync('customizacao/index.html', 'utf8');
assert.ok(customPage.length > 1500, 'página real de customização deve permanecer em customizacao/index.html');
const legacyRouter = fs.readFileSync('assets/js/core/router.js', 'utf8');
assert.match(legacyRouter, /['"']customizacao['"']/, 'rota legada customizacao.html deve ser centralizada no 404 router');

const admin = fs.readFileSync('admin/index.html', 'utf8');
assert.match(admin, /admin-plan-documents\.css\?v=21\.9\.433-security-registry/);
assert.match(admin, /admin-plan-documents\.js\?v=21\.10\.1-rev11-lazy/);
const memorial = fs.readFileSync('memorial/index.html', 'utf8');
assert.match(memorial, /memorial-preview\.css\?v=21\.9\.(?:403|409)(?:-[^\"]+)?/);
const layerImport = fs.readFileSync('assets/js/features/mapa/import.js', 'utf8');
assert.match(layerImport, /\/assets\/js\/workers\/layer-import-worker\.js\?v=21\.9\.403/);

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git','node_modules'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
walk(root);
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `IDs duplicados em ${path.relative(root, file)}`);
  assert.doesNotMatch(html, /smart-forms-v21\.9\.401|admin-plan-documents-v21\.9\.(375|380)|memorial-preview-v21\.9\.(399|400)|suite-v21\.(8|9\.0)/, `Referência obsoleta em ${path.relative(root, file)}`);
}

console.log('OK v21.9.403: arquivos consolidados, redirects limpos e referências obsoletas removidas.');
