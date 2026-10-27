import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const html = fs.readFileSync('mapa/index.html','utf8');

for (const module of ['gleba-geometry.js','geometry-math.js','coordinates.js','property-export.js','draw.js','app.js']) {
  assert.ok(html.includes(`/assets/js/features/mapa/${module}?v=`), `módulo do mapa ausente no HTML: ${module}`);
}
assert.ok(!html.includes('/assets/js/features/mapa/city-search.js?v='), 'busca municipal crítica deve permanecer autocontida no app principal.');
assert.ok(!html.includes('/assets/js/features/mapa/city.js?v='), 'busca municipal não deve depender do antigo city.js');
const aliasPos = app.indexOf('const CEFIR_PROPERTY_NAME_ALIASES =');
const factoryPos = app.indexOf('PropertyExportFactory.create(');
assert.ok(aliasPos >= 0, 'aliases CEFIR ausentes');
assert.ok(factoryPos >= 0, 'factory de exportação ausente');
assert.ok(aliasPos < factoryPos, 'property-export é inicializado antes das aliases CEFIR e quebra o bootstrap do mapa');
for (const name of ['normalizeCityQuery','cityLabel','cityMatchesScore','ensureCityCache','getCitySuggestions']) {
  assert.ok(app.includes(`${name}`), `função municipal autocontida ausente: ${name}`);
}
for (const state of ['let citySuggestItems = [];','let citySuggestIndex = -1;','let citySuggestTimer = null;']) {
  assert.ok(app.includes(state), `estado crítico do autocomplete ausente: ${state}`);
}
assert.ok(app.includes("const map = L.map('map'"), 'inicialização Leaflet ausente');
console.log('PASS map-bootstrap: dependências carregadas e busca municipal autocontida com estado completo.');
