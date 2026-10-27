const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');

// R26.3.62 pode capturar mousedown no contêiner para mover uma aresta inteira,
// mas deve excluir explicitamente os handles antes de cancelar o evento.
if (/addEventListener\('mousedown'/.test(app) && /onDirectEditEdgeContainerDown/.test(app)) {
  assert.match(app, /target\?\.closest\?\.\('\.leaflet-editing-icon,\.surveyor-edit-handle'\)[\s\S]*return;/,
    'A captura de aresta deve ignorar a bolinha antes de preventDefault/stopPropagation.');
}
assert.doesNotMatch(app, /lockBeforeMap|bindDirectEditHandlePressGuard/,
  'A proteção antiga em capture não pode permanecer porque bloqueia o início do drag nativo.');
assert.match(app, /marker\.on\?\.\('dragstart',[\s\S]*suspendMapPanDuringVertexDrag\(\)/,
  'O pan deve ser suspenso somente depois que o marcador iniciar o drag nativo.');
assert.match(app, /marker\.on\?\.\('dragend',[\s\S]*restoreMapPanAfterVertexDrag\(\)/,
  'O pan deve voltar quando o arrasto do vértice terminar.');
assert.match(app, /marker\.dragging\?\.enable\?\.\(\)/,
  'Cada handle deve manter o L.Marker dragging nativo habilitado.');
assert.match(css, /surveyor-direct-editing \.surveyor-edit-handle[\s\S]*cursor:crosshair!important/,
  'A bolinha deve continuar usando o cursor +/crosshair.');
assert.match(css, /surveyor-direct-editing #map[\s\S]*cursor:crosshair!important/,
  'O mapa deve continuar mostrando o cursor de edição durante a sessão.');

console.log('PASS: vértice usa drag nativo do Leaflet e pan só é suspenso após dragstart.');
