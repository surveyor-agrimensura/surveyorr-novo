import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(editor,/const ZOOM_MIN = 0\.50;[\s\S]*const ZOOM_MAX = 3\.00;/,'Zoom deve ter faixa útil de 50% a 300%.');
assert.match(editor,/zoomBaseWidth = availableWidth;/,'100% deve representar a largura útil da bancada, não uma folha previamente reduzida pela altura.');
assert.match(editor,/const fitScale = Math\.min\(1, availableHeight \/ Math\.max\(1, zoomBaseWidth \/ Math\.max\(\.01, aspect\)\)\);/,'Ajustar à tela deve calcular o percentual sobre a base de largura real.');
assert.match(editor,/const focusX = Math\.max\(0, Math\.min\(1, \(centerClientX - sheetRect\.left\) \/ oldWidth\)\);/,'Zoom deve preservar o ponto horizontal efetivamente visível da prancha.');
assert.match(editor,/const focusY = Math\.max\(0, Math\.min\(1, \(centerClientY - sheetRect\.top\) \/ oldHeight\)\);/,'Zoom deve preservar o ponto vertical efetivamente visível da prancha.');
assert.match(editor,/const targetX = Number\(sheet\.offsetLeft \|\| 0\) \+ focusX \* newWidth;/,'Reposicionamento horizontal deve usar a coordenada real da folha dentro do viewport.');
assert.match(editor,/const targetY = Number\(sheet\.offsetTop \|\| 0\) \+ focusY \* newHeight;/,'Reposicionamento vertical deve usar a coordenada real da folha dentro do viewport.');
assert.match(editor,/requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{/,'Scroll deve ser recalculado somente após o novo tamanho entrar no layout.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V264: zoom usa largura real, preserva o foco da prancha e elimina margem lateral como base de escala.');
