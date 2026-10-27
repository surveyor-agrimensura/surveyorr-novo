import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');

assert.match(app, /map\.createPane\('vertexSelectionPane'\)/, 'Mapa deve criar uma pane dedicada para os vértices selecionáveis.');
assert.match(app, /getPane\('vertexSelectionPane'\)\.style\.zIndex\s*=\s*670/, 'Pane dos vértices deve ficar acima do polígono para não bloquear o clique.');
assert.match(app, /const vertexSelectionRenderer = L\.svg\(\{ pane: 'vertexSelectionPane', padding: 0\.7 \}\);/, 'Pane dos vértices deve ter renderer próprio.');
assert.match(app, /pane:\s*'vertexSelectionPane'[\s\S]*renderer:\s*vertexSelectionRenderer[\s\S]*bubblingMouseEvents:\s*false/, 'Marcadores de seleção dos vértices devem renderizar na pane superior e sem propagar clique.');

console.log('PASS map-confrontante-vertex-click-pane-v174: vértices clicáveis acima do polígono.');
