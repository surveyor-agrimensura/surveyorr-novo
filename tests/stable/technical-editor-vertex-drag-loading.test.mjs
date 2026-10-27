import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const css = fs.readFileSync('assets/css/core/documents.css', 'utf8').replace(/!important/g,'');

assert.match(editor, /function attachVertexLabelDrag\(svg, hooks = \{\}\)/, 'Arraste de V-xx deve receber dependências explicitamente.');
assert.match(editor, /getSettings: \(\) => documentSettings/, 'Editor deve fornecer estado atual ao manipulador de V-xx.');
assert.match(editor, /node\.setPointerCapture/, 'Rótulo V-xx deve capturar o ponteiro durante o arraste.');
assert.match(editor, /writeOffset\(drag\.key, \{ dx, dy \}\)/, 'Arraste deve atualizar o deslocamento persistível do V-xx.');
assert.doesNotMatch(editor, /sv-document-save-loading-card/, 'Loading não deve mais usar cartão branco.');
assert.match(editor, /aria-label', 'Carregando'/, 'Loading deve manter acessibilidade sem texto visual.');
assert.match(css, /\.sv-document-save-loading\{[\s\S]*background:rgba\(15,23,42,\.42\)/, 'Loading deve usar fundo opaco.');
assert.match(css, /\.sv-confrontante-editor-overlay \.sv-vertex-label\{[^}]*touch-action:none/, 'Rótulos V-xx devem aceitar arraste sem interferência de gesto do navegador.');

console.log('OK: arraste dos V-xx e loading simplificado protegidos contra regressão.');
