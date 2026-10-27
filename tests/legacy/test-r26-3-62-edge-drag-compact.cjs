const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const app = read('assets/js/features/mapa/app.js');
const appDist = read('dist/surveyor-frontend/assets/js/features/mapa/app.js');
const css = read('assets/css/features/mapa/app.css');
const cssDist = read('dist/surveyor-frontend/assets/css/features/mapa/app.css');
const html = read('mapa/index.html');
const htmlDist = read('dist/surveyor-frontend/mapa/index.html');

// Painel: a R26.3.63 substituiu a estatística visual de Arestas por Tarefas,
// mas o arraste de aresta introduzido na R26.3.62 deve continuar intacto.
assert(!html.includes('<span>Arestas</span><b id="detailEdges">—</b>'), 'Arestas não deve ocupar o resumo do painel');
assert(!html.includes('id="detailEdgesSummary"'), 'bloco grande de Arestas editáveis ainda ocupa o painel');
assert(html.includes('<span>Tarefas</span><b id="detailTasks">—</b>'), 'estatística de Tarefas ausente');
assert(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))!important'), 'estatísticas não estão em quatro colunas compactas');

// Aresta: detecção geométrica independente do stroke e captura antes do pan do mapa.
[
  'let directEditEdgeDescriptors = [];',
  'function directEditNearestEdge',
  'function onDirectEditEdgeContainerMove',
  'function onDirectEditEdgeContainerDown',
  "container.addEventListener('mousemove', onDirectEditEdgeContainerMove, true)",
  "container.addEventListener('mousedown', onDirectEditEdgeContainerDown, true)",
  'startDirectEditEdgeDrag({ latlng, originalEvent }, nearest.descriptor);',
  "map.getPane('directEditEdgePane').classList.add('surveyor-direct-edit-edge-pane')",
  'directEditEdgeDescriptors.push(descriptor);',
  "document.addEventListener('mousemove', onDirectEditEdgeDragMove, true);"
].forEach((needle) => assert(app.includes(needle), `fallback de aresta incompleto: ${needle}`));

assert(css.includes('stroke-width:24px!important'), 'faixa invisível da aresta não foi ampliada');
assert(css.includes('pointer-events:stroke!important'), 'faixa da aresta não captura ponteiro pelo stroke');
assert(css.includes('surveyor-edge-hovering.surveyor-direct-editing #map'), 'cursor de hover da aresta ausente');
assert(css.includes('stroke:#ef2b2d!important'), 'destaque vermelho da aresta ausente');

// Cache bust: o navegador local não pode reaproveitar o JS/CSS defeituoso da R60.
assert(html.includes('20260920-tarefas-ba-r63'), 'cache-bust atual do mapa ausente');

assert.strictEqual(app, appDist, 'app.js fonte/dist divergentes');
assert.strictEqual(css, cssDist, 'CSS fonte/dist divergentes');
assert.strictEqual(html, htmlDist, 'mapa/index fonte/dist divergentes');

console.log('OK R26.3.62/R26.3.63: arraste de aresta preservado e painel atualizado para Tarefas.');
