import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const maps=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const bridge=fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const confrontantes=fs.readFileSync('assets/js/features/mapas/confrontantes.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(editor,/polygonStyles:normalizePolygonStyles\(value\)/,'configurações devem persistir estilos por polígono');
assert.match(editor,/data-polygon-style-list/,'painel Aparência deve possuir lista de polígonos');
assert.match(editor,/data-polygon-color/,'cada polígono deve possuir seletor de cor');
assert.match(editor,/data-polygon-fill/,'cada polígono deve possuir preenchimento individual');
assert.match(editor,/data-polygon-opacity/,'cada polígono deve possuir opacidade individual');
assert.match(editor,/applyPolygonStylesToOverlay\(\)/,'prévia deve aplicar estilos por polígono');
assert.match(editor,/data-coordinate-table-dependent/,'Controles derivados da tabela devem ser marcados como dependentes.');
assert.match(editor,/node\.hidden=documentSettings\.coordinateTableEnabled!==true/,'Controles da tabela devem aparecer somente quando a tabela estiver ativada.');
assert.match(editor,/data-area-name-dependent/,'Cor dos nomes deve depender da existência de nomes no mapa.');
assert.match(editor,/data-coordinate-table-dependent/,'Controles derivados da tabela devem ser marcados como dependentes.');
assert.match(editor,/node\.hidden=documentSettings\.coordinateTableEnabled!==true/,'Controles da tabela devem aparecer somente quando a tabela estiver ativada.');
assert.match(editor,/data-area-name-dependent/,'Cor dos nomes deve depender da existência de nomes no mapa.');
assert.match(editor,/sv-document-editable-polygon/,'editor deve extrair polígonos editáveis para o overlay');
assert.match(maps,/documentPolygonStyle/,'geração deve resolver estilo persistido por feição');
assert.match(maps,/technicalMapBridge\?\.normalizeSettings\?\.\(\{\s*\.\.\.value,\s*defaultAreaName\s*\}\)/,'geração deve consumir a normalização visual compartilhada da ponte técnica');
assert.match(bridge,/polygonStyles,/, 'ponte técnica deve transportar os estilos persistidos dos polígonos');
assert.match(maps,/sv-document-editable-polygon/,'polígonos internos devem ser identificáveis no SVG');
assert.match(confrontantes,/sv-document-perimeter-fill sv-document-editable-polygon/,'perímetro principal deve ser polígono editável');
assert.match(confrontantes,/sv-document-polygon-outline/,'contorno do perímetro deve acompanhar a cor escolhida');
assert.match(css,/sv-editor-polygon-style-card/,'lista deve possuir layout próprio e compacto');

console.log('PASS technical editor polygon appearance');
