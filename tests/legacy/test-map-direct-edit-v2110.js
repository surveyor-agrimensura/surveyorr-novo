import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(app, /function updateDetails\(layer\)/, 'Detalhes precisam ter atualização leve durante o arraste.');
assert.match(app, /function decorateDirectEditHandles\(layer\)/, 'Edição precisa decorar handles de vértice e intermediários.');
assert.match(app, /surveyor-edit-midpoint-handle/, 'Pontos intermediários precisam ser identificados separadamente.');
assert.match(app, /marker\.dragging\?\.enable\?\.\(\)/, 'Handles devem ter arraste explicitamente habilitado.');
assert.match(app, /map\.on\('draw:editvertex', onEditVertex\)/, 'Edição de vértice precisa atualizar em tempo real sem rebuild total.');
assert.doesNotMatch(app, /map\.on\('draw:editvertex', onEdited\)/, 'draw:editvertex não deve executar refresh pesado a cada movimento.');
assert.match(css, /\.surveyor-edit-handle::after/, 'Handle visível deve ser um ponto técnico pequeno.');
assert.match(css, /width:32px!important;[\s\S]*height:32px!important;/, 'Área de clique desktop deve ser ampliada sem aumentar o ponto visual.');
assert.match(css, /@media \(pointer:coarse\)/, 'Dispositivos touch precisam de alvo ainda maior.');
assert.match(html, /21\.11\.2-session-watch/, 'Mapa precisa invalidar cache dos arquivos atualizados.');

console.log('OK: edição de polígonos v21.11.1 com handles técnicos, midpoints arrastáveis e atualização leve.');
