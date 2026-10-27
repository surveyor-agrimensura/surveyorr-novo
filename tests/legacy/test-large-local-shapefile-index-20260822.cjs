const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const workerSource = fs.readFileSync(path.join(root, 'assets/js/workers/layer-import-worker.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const importSource = fs.readFileSync(path.join(root, 'assets/js/features/mapa/import.js'), 'utf8');

assert(importSource.includes('queryLargeSession'), 'API de consulta local grande ausente');
assert(importSource.includes('disposeLargeSession'), 'API de descarte local grande ausente');
assert(appSource.includes('addLocalLargeReferenceLayer'), 'Mapa não registra camada local grande');
assert(appSource.includes('updateLocalLargeReferences'), 'Mapa não atualiza camada local por viewport');
assert(appSource.includes("result?.localLarge"), 'Importação não prioriza modo local grande');
assert(appSource.includes('LOCAL INDEXADA'), 'UI não identifica camada local indexada');

const messages = [];
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  TextDecoder,
  Blob,
  Map,
  Set,
  Float64Array,
  Math,
  Number,
  Array,
  String,
  JSON,
  RegExp,
  Date,
  importScripts() {},
  self: {
    postMessage(message) { messages.push(message); },
    close() {}
  }
});
vm.runInContext(workerSource, context, { filename: 'layer-import-worker.js' });

const featureCount = 10000;
const features = [];
for (let i = 0; i < featureCount; i++) {
  const x = -40 + (i % 100) * 0.001;
  const y = -13 + Math.floor(i / 100) * 0.001;
  features.push({
    type: 'Feature',
    properties: { id: i },
    geometry: { type: 'Polygon', coordinates: [[[x,y],[x+0.0004,y],[x+0.0004,y+0.0004],[x,y+0.0004],[x,y]]] }
  });
}
context.__fc = { type: 'FeatureCollection', features };
const bounds = vm.runInContext('largeCollection = __fc; buildLargeSpatialIndex(__fc)', context);
assert(Array.isArray(bounds) && bounds.length === 4, 'Índice não retornou bounds');
const result = vm.runInContext('queryLargeCollection([-39.99,-12.99,-39.97,-12.97], 1500)', context);
assert(result.type === 'FeatureCollection', 'Consulta não retornou FeatureCollection');
assert(result.features.length > 0, 'Consulta viewport não retornou elementos');
assert(result.features.length <= 1500, 'Consulta ultrapassou o limite de renderização');
assert(result.meta && typeof result.meta.truncated === 'boolean', 'Metadados de truncamento ausentes');
console.log(`OK large-local: ${featureCount} indexados; ${result.features.length} retornados no viewport.`);
