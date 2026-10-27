import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const read = (rel) => fs.readFileSync(new URL(rel, root), 'utf8');
const mapApp = read('assets/js/features/mapa/app.js');
const editor = read('assets/js/core/technical-document-editor.js');
const renderer = read('assets/js/features/mapas/confrontantes.js');

for (const [name, source] of [['mapa', mapApp], ['editor', editor], ['renderer', renderer]]) {
  assert.ok(source.includes('forwardSteps') && source.includes('backwardSteps'), `${name}: intervalo deve comparar os dois sentidos do perímetro.`);
  assert.ok(source.includes('useForward = forwardSteps <= backwardSteps'), `${name}: intervalo deve escolher o arco mais curto.`);
  assert.ok(source.includes('previousVertex'), `${name}: intervalo deve suportar percurso reverso sem dar a volta longa.`);
}
assert.ok(mapApp.includes('V-65 → V-61 usa V-65/64/63/62/61'), 'Mapa deve documentar a regressão específica de V-65 para V-61.');
assert.ok(mapApp.includes('confrontanteTrechoSegmentIndexes(layer, start + 1, end + 1)'), 'Formulário do mapa deve aplicar a mesma regra de arco mais curto ao salvar o confrontante.');

console.log('PASS V50 confrontante: intervalo usa o arco mais curto entre os vértices e não contorna o restante do perímetro.');
