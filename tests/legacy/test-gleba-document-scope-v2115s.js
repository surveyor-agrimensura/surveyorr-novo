import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const memory = new Map();
const context = {
  console,
  location: { pathname: '/memorial/' },
  sessionStorage: {
    getItem: (key) => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key)
  },
  document: {
    readyState: 'complete',
    getElementById: () => null,
    createElement: () => ({ id: '', textContent: '', appendChild() {} }),
    head: { appendChild() {} }
  },
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  dispatchEvent() {},
  setTimeout,
  clearTimeout,
  MutationObserver: class MutationObserver { observe() {} disconnect() {} }
};
context.globalThis = context;
context.window = context;
vm.createContext(context);
vm.runInContext(read('assets/js/core/geometry.js'), context);
vm.runInContext(read('assets/js/core/document-scope.js'), context);

const project = {
  id: 'p1',
  propertyName: 'Fazenda Boa Esperança',
  owner: 'Proprietário geral',
  geojson: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { id: 'per1', name: 'Perímetro', category: 'perimetro' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[4,0],[4,2],[0,2],[0,0]]] } },
      { type: 'Feature', properties: { id: 'g1', name: 'Gleba 01', category: 'gleba', owner: 'Ana' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,2],[0,0]]] } },
      { type: 'Feature', properties: { id: 'g2', name: 'Gleba 02', category: 'gleba', owner: 'Bruno' }, geometry: { type: 'Polygon', coordinates: [[[2,0],[4,0],[4,2],[2,2],[2,0]]] } }
    ]
  }
};

assert.equal(context.SurveyorProjectGeometry.listGlebas(project).length, 2);
memory.set('surveyor.documentScope./memorial.p1', 'g2');
const scoped = context.SurveyorDocumentScope.apply(project);
assert.notEqual(scoped, project);
assert.equal(scoped.geojson.features.length, 1);
assert.equal(scoped.geojson.features[0].properties.category, 'perimetro');
assert.equal(scoped.geojson.features[0].properties.scopeLabel, 'Gleba 02');
assert.equal(scoped.owner, 'Bruno');
assert.match(scoped.propertyName, /Gleba 02/);
assert.equal(JSON.stringify(scoped.geojson.features[0].geometry.coordinates), JSON.stringify(project.geojson.features[2].geometry.coordinates));

memory.set('surveyor.documentScope./memorial.p1', 'property');
assert.equal(context.SurveyorDocumentScope.apply(project), project);

const pages = ['memorial','ods','confrontacao','mapas','pranchas','planialtimetria','perimetros','ambiental'];
for (const page of pages) {
  const html = read(`${page}/index.html`);
  assert.match(html, /document-scope-v21\.11\.5s\.js\?v=21\.11\.5s-(?:gleba-scope|gleba-conditional-0820)/, `${page} deve carregar seletor de escopo`);
}

const modules = [
  'assets/js/core/suite.js',
  'assets/js/features/memorial/app.js',
  'assets/js/features/mapas/app.js',
  'assets/js/features/planialtimetria/app.js',
  'assets/js/features/ods/app.js',
  'assets/js/features/perimetros/app.js'
];
for (const module of modules) assert.match(read(module), /SurveyorDocumentScope\?\.apply/, `${module} deve aplicar a gleba selecionada`);

console.log('OK: v21.11.5s — documentos técnicos podem usar imóvel completo ou uma gleba específica como escopo exclusivo.');
