import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const bridge=fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

assert.doesNotMatch(editor,/Tamanho do nome<input[^>]+data-registration-field=\"labelScale\"/,'Cadastro completo do confrontante não deve repetir tamanho do rótulo.');
assert.doesNotMatch(editor,/Giro do nome<input[^>]+data-registration-field=\"labelRotation\"/,'Cadastro completo do confrontante não deve repetir giro do rótulo.');
assert.match(editor,/data-confrontante-context-scale/,'Clique direito do confrontante deve oferecer tamanho.');
assert.match(editor,/data-area-name-context-scale/,'Clique direito do nome no mapa deve oferecer tamanho.');
assert.match(editor,/data-polygon-context-menu/,'Polígono deve possuir menu contextual próprio.');
assert.match(editor,/data-polygon-context-stroke-color/,'Menu do polígono deve editar cor da borda.');
assert.match(editor,/data-polygon-context-stroke-width/,'Menu do polígono deve editar espessura da borda.');
assert.match(editor,/data-polygon-context-fill-color/,'Menu do polígono deve editar cor interna.');
assert.match(editor,/data-polygon-context-opacity/,'Menu do polígono deve editar opacidade.');
assert.match(editor,/closest\?\.\('\.sv-document-editable-polygon,\.sv-document-perimeter-fill,\.sv-document-polygon-outline'\)/,'Clique direito deve detectar o polígono no SVG.');
assert.match(editor,/strokeColor:[\s\S]*strokeWidth:[\s\S]*fillColor:/,'Estilo persistido do polígono deve separar borda e preenchimento.');
assert.match(bridge,/strokeWidth:[\s\S]*fillColor[\s\S]*strokeColor/,'Ponte técnica deve transportar borda, preenchimento e espessura.');
assert.doesNotMatch(app,/data-global-polygon-opacity|data-global-polygon-color/,'Aba Aparência não deve manter o bloco global substituído pelo clique direito.');
assert.match(css,/\.sv-polygon-context-menu\{min-width:230px\}/,'Menu contextual do polígono deve ter layout técnico próprio.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V252: cadastro limpo, tamanho contextual e aparência do polígono por clique direito.');
