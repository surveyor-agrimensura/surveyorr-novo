import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const absent = ['catalogo-camadas.html', 'catalogo-camadas', 'catalogo.js', 'assets/module-icons/catalogo-camadas.png'];
for (const relative of absent) {
  assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} ainda existe`);
}

for (const relative of ['assets/js/core/portal.js', 'assets/js/core/layout.js', 'assets/js/core/auth.js', 'login/index.html', 'admin/index.html', 'sobre/index.html']) {
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.equal(text.includes('/catalogo-camadas/'), false, `${relative} ainda aponta para o catálogo público`);
}

const mapHtml = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');
assert.ok(mapHtml.includes('layerCatalogDialog'), 'O catálogo interno do mapa foi removido por engano');
const adminJs = fs.readFileSync(path.join(root, 'assets/js/admin/app.js'), 'utf8');
assert.ok(adminJs.includes("layers: 'Catálogo de camadas'"), 'A gestão de camadas do Admin foi removida por engano');
console.log('Catálogo público removido; catálogo interno do mapa e gestão do Admin preservados.');
