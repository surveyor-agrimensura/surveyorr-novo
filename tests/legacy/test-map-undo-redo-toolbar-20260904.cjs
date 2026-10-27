const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('mapa/index.html','utf8');
const app = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const runtime = fs.readFileSync('assets/js/core/ui.js','utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css','utf8');

assert.match(html, /id="undoToolBtn"[^>]*disabled/, 'Desfazer deve iniciar desativado sem histórico.');
assert.match(html, /id="redoToolBtn"[^>]*disabled/, 'Refazer deve iniciar desativado sem histórico.');
assert.match(app, /const undoStack = \[\];\s*const redoStack = \[\];/, 'Histórico deve manter pilhas separadas de undo e redo.');
assert.match(app, /if \(options\.preserveRedo !== true\) redoStack\.length = 0;/, 'Nova alteração deve invalidar a linha futura de Refazer.');
assert.match(app, /function undoLastProjectChange\(\)[\s\S]*const current = snapshotDrawn\(\);[\s\S]*restoreDrawnSnapshot\(previous\)[\s\S]*undoStack\.pop\(\);[\s\S]*pushRedoSnapshot\(current\)/, 'Desfazer deve restaurar primeiro e só então mover o estado atual para Refazer.');
assert.match(app, /function redoLastProjectChange\(\)[\s\S]*const current = snapshotDrawn\(\);[\s\S]*restoreDrawnSnapshot\(next\)[\s\S]*redoStack\.pop\(\);[\s\S]*pushUndoSnapshot\(current, \{ preserveRedo: true \}\)/, 'Refazer deve restaurar a geometria antes de consumir o passo e devolver o estado atual para Desfazer.');
assert.match(app, /function clearProjectHistory\(\) \{[\s\S]*undoStack\.length = 0;[\s\S]*redoStack\.length = 0;/, 'Trocar de projeto deve limpar o histórico local para não desfazer outro projeto.');

assert.match(runtime, /group\('Projeto',\[share\]\),sep\(\),\s*group\('Histórico',\[undo,redo\]\)/, 'As setas devem aparecer após Compartilhar na barra superior.');
assert.match(runtime, /Desfazer \(Ctrl\+Z\)/, 'Botão superior deve identificar Desfazer.');
assert.match(runtime, /Refazer \(Ctrl\+Y\)/, 'Botão superior deve identificar Refazer.');
assert.match(runtime, /sv-map-history-glyph[^>]*[^]*>↶<\/span>/, 'Desfazer deve usar a seta curva ↶ solicitada.');
assert.match(runtime, /sv-map-history-glyph[^>]*[^]*>↷<\/span>/, 'Refazer deve usar a seta curva ↷ solicitada.');
assert.match(css, /\.sv-map-history-action \.sv-map-history-glyph/, 'Setas curvas devem possuir estilo próprio no topo.');

// Regressão: ao desfazer um polígono, os rótulos V-01/V-02 ficam num LayerGroup
// separado. Eles precisam sumir para não capturar os cliques do próximo desenho.
assert.match(app, /function restoreDrawnSnapshot\(collection\)[\s\S]*vertexMarkers\.clearLayers\(\)[\s\S]*confrontanteHighlightGroup\.clearLayers\(\)[\s\S]*drawn\.clearLayers\(\)/, 'Restore do histórico deve limpar marcadores de vértices e overlays antes de restaurar a geometria.');
assert.match(app, /onEachFeature: \(feature, leafletLayer\) => \{[\s\S]*attach\(leafletLayer\);[\s\S]*drawn\.addLayer\(leafletLayer\);[\s\S]*applyStyleToDrawn\(leafletLayer\);/, 'Refazer snapshot não vazio deve reconstruir cada geometria usando attach(), o vínculo real do SURVEYOR.');
assert.doesNotMatch(app, /onEachFeature: \(feature, leafletLayer\) => \{[\s\S]{0,220}bindLayer\(leafletLayer\)/, 'Restore do histórico não pode chamar bindLayer(), função inexistente que quebrava o Refazer.');
assert.match(app, /editingConfrontanteLayer = null;[\s\S]*editingSegmentIndex = -1;/, 'Restore deve limpar o editor de confrontantes associado à seleção removida.');
assert.match(app, /document\.querySelectorAll\('\.leaflet-editing-icon\.surveyor-edit-handle'\)/, 'Restore deve remover qualquer handle de edição órfão como rede de segurança.');

assert.match(html, /app\.js\?v=[^"\s]+/, 'Cache-buster do app deve ser atualizado.');
assert.match(html, /ui\.js\?v=[^"\s]+/, 'Cache-buster do runtime deve ser atualizado.');

console.log('OK: Refazer restaura snapshots não vazios com attach(), preserva histórico em erro e mantém ↶ ↷.');
