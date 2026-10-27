const fs = require('node:fs');
const assert = require('node:assert');
const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');

const start = app.indexOf('function decorateDirectEditHandles(layer)');
const end = app.indexOf('function updateProjectGeometryCounters()', start);
assert(start >= 0 && end > start, 'Decorador dos handles de edição deve existir.');
const body = app.slice(start, end);

assert.match(body, /marker\.dragging\?\.enable\?\.\(\)/,
  'O marker do vértice precisa estar draggable.');
assert.doesNotMatch(body, /addEventListener\(['"](?:pointerdown|mousedown|touchstart)/,
  'Não deve haver listener DOM antecipado roubando o evento de início do L.Draggable.');
assert.match(body, /marker\.on\?\.\('dragstart',[\s\S]*suspendMapPanDuringVertexDrag\(\)/,
  'A proteção do mapa deve começar no dragstart do próprio marker.');
assert.match(body, /marker\.on\?\.\('drag',[\s\S]*scheduleDirectEditLiveUpdate\(layer\)/,
  'Durante o drag, a geometria/UI precisa continuar sendo sincronizada.');
assert.match(body, /marker\.on\?\.\('dragend',[\s\S]*restoreMapPanAfterVertexDrag\(\)/,
  'Ao soltar o vértice, o pan precisa ser restaurado.');

console.log('PASS: arrasto do vértice não é interceptado antes do Leaflet.Draw.');
