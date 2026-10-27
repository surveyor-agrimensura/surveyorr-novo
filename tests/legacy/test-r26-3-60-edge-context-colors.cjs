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

// Edição pela aresta inteira, sem perder o editor de vértices.
[
  "map.createPane('directEditEdgePane')",
  'function rebuildDirectEditEdges',
  'function startDirectEditEdgeDrag',
  'function onDirectEditEdgeDragMove',
  'surveyor-edit-edge-highlight',
  'surveyor-edit-edge-hit',
  'state.ring[state.indexA] = nextA;',
  'state.ring[state.indexB] = nextB;',
  'const amount = dx * state.normal.x + dy * state.normal.y;',
  "hit.on('mouseover'",
  "hit.on('mousedown'",
  'rebuildDirectEditEdges(layer);'
].forEach((needle) => assert(app.includes(needle), `edição por aresta incompleta: ${needle}`));
assert(css.includes('stroke:#ef2b2d!important'), 'aresta selecionada não fica vermelha');
assert(css.includes('surveyor-direct-editing .leaflet-marker-pane'), 'vértices não foram preservados acima da faixa de aresta');

// Menu de contexto deve existir somente na área do mapa e oferecer atalhos do projeto/imóvel.
[
  'function openSurveyorMapContextMenu',
  "map.getContainer().addEventListener('contextmenu'",
  "map.on('contextmenu'",
  "'Editar polígono'",
  "'Mais informações'",
  "'Baixar polígono'",
  "'Informações do imóvel'",
  "'Baixar imóvel (.zip)'",
  'downloadSelectedRuralPropertyPackage()'
].forEach((needle) => assert(app.includes(needle), `menu rápido incompleto: ${needle}`));
assert(!app.includes("document.addEventListener('contextmenu', (event) => event.preventDefault()"), 'menu nativo foi bloqueado globalmente, e não somente no mapa');
assert(css.includes('.sv-map-context-menu'), 'CSS do menu rápido ausente');

// Seletor de cor deve confirmar a escolha ao fechar o picker nativo.
assert(app.includes("input.addEventListener('input', commit);"), 'cor não atualiza durante seleção');
assert(app.includes("input.addEventListener('change', commit);"), 'cor não confirma no fechamento do seletor');
assert(app.includes("input.addEventListener('blur', commit);"), 'cor não confirma ao clicar fora');

// Painel compacto preservado. A R26.3.63 substituiu o indicador visual de Arestas por Tarefas.
assert(html.includes('id="detailTasks"'), 'indicador de Tarefas ausente');
assert(!html.includes('id="detailEdges"'), 'indicador antigo de Arestas ainda está visível');
assert(app.includes('const BAHIA_TASK_M2 = 4356;'), 'conversão para tarefa baiana ausente');
assert(css.includes('width:min(280px,calc(100vw - 18px))') || css.includes('width:min(294px,calc(100vw - 18px))'), 'painel de detalhes não foi compactado');

assert.strictEqual(app, appDist, 'app.js fonte/dist divergentes');
assert.strictEqual(css, cssDist, 'CSS fonte/dist divergentes');
assert.strictEqual(html, htmlDist, 'mapa/index fonte/dist divergentes');

console.log('OK R26.3.60/R26.3.63: arraste por aresta e menu preservados; painel compacto usa Tarefas.');
