import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

assert.doesNotMatch(css,/\.sv-confrontante-editor-overlay \.sv-document-perimeter-fill\{pointer-events:none\}/,'Preenchimento do perímetro não pode bloquear o clique direito.');
assert.match(css,/\.sv-document-perimeter-fill,[\s\S]*\.sv-document-editable-polygon\{pointer-events:fill;cursor:context-menu\}/,'Área interna do polígono deve participar do hit-test contextual.');
assert.match(css,/\.sv-document-polygon-outline\{pointer-events:stroke;cursor:context-menu\}/,'Borda do polígono deve participar do hit-test contextual.');
assert.match(editor,/function polygonNodeAtContextEvent\(event\)/,'Editor deve resolver polígono mesmo quando grade ou outro elemento SVG estiver sobre a área clicada.');
assert.match(editor,/polygon=polygonNodeAtContextEvent\(event\)/,'Contextmenu deve usar o resolvedor geométrico do polígono.');
assert.match(editor,/node\.isPointInFill\(domPoint\)/,'Fallback geométrico deve detectar clique dentro do preenchimento mesmo se o alvo DOM não for o polígono.');
assert.match(editor,/showPolygonContextMenu\(event\.clientX,event\.clientY,polygonKey\)/,'Clique direito válido deve abrir o menu de aparência do polígono.');

console.log('PASS V254: clique direito no interior/borda do polígono abre o menu contextual mesmo sob camadas SVG.');
