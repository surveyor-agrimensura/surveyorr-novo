import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('assets/css/core/documents.css','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');

assert.match(css,/\.sv-confrontante-editor-window\{[\s\S]*grid-template-rows:minmax\(0,1fr\) auto;[\s\S]*gap:8px/,'Editor inline deve separar área principal e rodapé em linhas próprias.');
assert.match(css,/\.sv-confrontante-editor-footer\{[\s\S]*position:relative;[\s\S]*bottom:auto;[\s\S]*border:1px solid #d7e2ef/,'Rodapé não pode sobrepor o conteúdo rolável.');
assert.match(css,/\.sv-editor-map-panel[\s\S]*overflow-y:scroll;[\s\S]*scrollbar-gutter:stable/,'Mapa deve manter scrollbar vertical permanentemente disponível.');
assert.match(css,/\.sv-editor-map-panel::-webkit-scrollbar[\s\S]*width:11px/,'Scrollbar deve possuir largura visual suficiente para homologação desktop.');
assert.match(editor,/sv-editor-line-actions[\s\S]*data-editor-action="draw-line"[\s\S]*data-editor-action="edit-lines"[\s\S]*data-editor-action="delete-selected-line"[\s\S]*data-editor-action="remove-line"/,'Ações de linhas devem permanecer compactadas em ícones na mesma linha.');
assert.match(editor,/sv-editor-servitude-actions[\s\S]*data-editor-action="draw-servitude"[\s\S]*data-editor-action="finish-servitude"[\s\S]*data-editor-action="delete-servitude"/,'Ações de servidão devem usar a barra compacta de ícones.');
assert.match(css,/sv-editor-icon-action\[hidden\][\s\S]*display:none/,'Botão de finalizar servidão deve desaparecer enquanto não houver traçado ativo.');
assert.match(css,/sv-editor-icon-action\.primary:not\(:disabled\)[\s\S]*background:#0f63e9;[\s\S]*color:#fff/,'Ação primária da servidão deve manter o visto visível sobre fundo azul.');
assert.match(css,/sv-editor-icon-action\[hidden\][\s\S]*display:none/,'Botão de finalizar servidão deve desaparecer enquanto não houver traçado ativo.');
assert.match(css,/sv-editor-icon-action\.primary:not\(:disabled\)[\s\S]*background:#0f63e9;[\s\S]*color:#fff/,'Ação primária da servidão deve manter o visto visível sobre fundo azul.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS prancha inline: scroll permanente, footer desacoplado e ações compactas.');
