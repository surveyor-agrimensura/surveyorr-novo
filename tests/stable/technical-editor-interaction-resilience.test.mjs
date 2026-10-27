import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(editor,/async function handleEditorClick\(event\)/,'Ações principais devem ter delegador próprio e estável.');
const appendAt = editor.indexOf("document.body.appendChild(modal)");
const clickAt = editor.indexOf("modal.addEventListener('click', handleEditorClick)");
const engineAt = editor.indexOf('await mountEditorEngine(overlay)');
assert.ok(appendAt >= 0 && clickAt > appendAt && engineAt > clickAt,'Delegação dos botões deve ser registrada antes da inicialização opcional do engine.');
assert.match(editor,/function attachStableAreaNameDrag/,'Nome no mapa deve possuir arraste local independente do engine.');
assert.match(editor,/function attachStableVertexLabelDrag/,'Rótulos de vértices devem possuir arraste local independente do engine.');
assert.match(editor,/function attachStableConfrontanteDrag/,'Confrontantes devem possuir arraste local independente do engine.');
assert.match(editor,/engineDisposers\.push\(attachStableAreaNameDrag\(overlay\)\)/,'Fallback deve manter nomes arrastáveis se o engine não carregar.');
assert.match(editor,/engineDisposers\.push\(attachStableVertexLabelDrag\(overlay\)\)/,'Fallback deve manter vértices arrastáveis se o engine não carregar.');
assert.match(editor,/engineDisposers\.push\(attachStableConfrontanteDrag\(overlay\)\)/,'Fallback deve manter confrontantes arrastáveis se o engine não carregar.');
assert.match(css,/\.sv-editor-check-row input\[type="checkbox"\]\{[^}]*width:20px;[^}]*height:20px;/s,'Checkbox de aparência deve ter dimensões próprias e não herdar largura de inputs gerais.');
assert.match(css,/input\[type="checkbox"\]:checked\{background:#0f63e9;/,'Checkbox marcado deve ter estado visual consistente.');
console.log('technical-editor-interaction-resilience: ok');
