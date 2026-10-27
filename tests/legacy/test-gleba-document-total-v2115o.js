import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const helperPath = 'assets/js/core/geometry.js';
const helper = fs.readFileSync(helperPath, 'utf8');
assert.match(helper, /resolvePerimeter/);
assert.match(helper, /gleba-union/);
assert.match(helper, /rootSourceLayerId/);

const requiredPages = [
  'memorial/index.html', 'mapas/index.html', 'pranchas/index.html', 'ods/index.html',
  'planialtimetria/index.html', 'perimetros/index.html', 'ambiental/index.html',
  'confrontacao/index.html', 'public-project/index.html'
];
for (const page of requiredPages) {
  const html = fs.readFileSync(page, 'utf8');
  assert.match(html, /project-geometry-v21\.11\.5o\.js\?v=21\.11\.5(?:o-gleba-total|s-document-scope)/, `${page} precisa carregar o resolvedor de perímetro`);
}

const patched = [
  'assets/js/core/suite.js',
  'assets/js/features/mapas/app.js',
  'assets/js/features/memorial/app.js',
  'assets/js/features/ods/app.js',
  'assets/js/features/perimetros/app.js',
  'assets/js/features/planialtimetria/app.js'
];
for (const file of patched) {
  assert.match(fs.readFileSync(file, 'utf8'), /SurveyorProjectGeometry\?\.resolvePerimeter/, `${file} ainda pode escolher uma única gleba`);
}

const square = (id, x0, x1, category = 'gleba', extra = {}) => ({
  type: 'Feature',
  properties: { id, category, generatedBy: category === 'gleba' ? 'map-glebas' : undefined, ...extra },
  geometry: { type: 'Polygon', coordinates: [[[x0,0],[x1,0],[x1,1],[x0,1],[x0,0]]] }
});

const polygonArea = (feature) => {
  const ring = feature?.geometry?.coordinates?.[0] || [];
  if (ring.length < 4) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) sum += ring[i][0] * ring[i+1][1] - ring[i+1][0] * ring[i][1];
  return Math.abs(sum) / 2;
};

const context = {
  console,
  turf: {
    area: polygonArea,
    featureCollection: (features) => ({ type: 'FeatureCollection', features }),
    union: (fc) => {
      const fs = fc.features || [];
      const xs = fs.flatMap((f) => f.geometry.coordinates[0].map((p) => p[0]));
      const ys = fs.flatMap((f) => f.geometry.coordinates[0].map((p) => p[1]));
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      return { type:'Feature', properties:{}, geometry:{ type:'Polygon', coordinates:[[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY],[minX,minY]]] } };
    }
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(helper, context);
const geom = context.SurveyorProjectGeometry;
assert.ok(geom);

const glebaA = square('g1', 0, 1, 'gleba', { rootSourceLayerId: 'root' });
const glebaB = square('g2', 1, 2, 'gleba', { rootSourceLayerId: 'root' });
const projectOnlyGlebas = { geojson: { type:'FeatureCollection', features:[glebaA, glebaB] } };
const derived = geom.resolvePerimeter(projectOnlyGlebas);
assert.equal(derived.properties.category, 'perimetro');
assert.equal(derived.properties.derivedFrom, 'gleba-union');
assert.equal(polygonArea(derived), 2, 'duas glebas adjacentes precisam resultar na área total, não em uma única gleba');

const root = square('root', 0, 2, 'perimetro');
const projectWithRoot = { geojson: { type:'FeatureCollection', features:[glebaA, glebaB, root] } };
assert.equal(geom.resolvePerimeter(projectWithRoot).properties.id, 'root', 'o perímetro-fonte deve prevalecer quando está preservado');

const wrongSmallPerimeter = square('wrong', 0, 1, 'perimetro');
const projectWithWrongPerimeter = { geojson: { type:'FeatureCollection', features:[wrongSmallPerimeter, glebaA, glebaB] } };
assert.equal(polygonArea(geom.resolvePerimeter(projectWithWrongPerimeter)), 2, 'um perímetro com tamanho de apenas uma gleba não pode dominar os documentos');

const suite = fs.readFileSync('assets/js/core/suite.js', 'utf8');
assert.match(suite, /const totalAreaHa=perArea;/, 'croqui genérico não deve somar perímetro + glebas');
assert.match(suite, /if\(c==='gleba'\|\|f\.properties\?\.generatedBy==='map-glebas'\)return;/, 'relatório ambiental não deve contar glebas como área temática adicional');

console.log('OK: v21.11.5o — mapas, croquis, memorial, ODS e módulos técnicos usam o perímetro total do imóvel mesmo quando existem glebas.');
