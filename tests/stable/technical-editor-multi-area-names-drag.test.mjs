import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(editor,/normalizeAreaNames/, 'Editor deve manter uma coleção real de nomes do mapa.');
assert.match(editor,/data-editor-action="add-area-name"/, 'Editor deve permitir adicionar vários nomes ao mapa.');
assert.match(editor,/data-area-name-select/, 'Usuário deve conseguir selecionar qual nome está editando.');
assert.match(editor,/document-area-name:\$\{item\.id\}/, 'Cada nome deve possuir nó próprio no motor de edição.');
assert.match(editor,/applyOffsetDirect\(group,sceneNode\.data\.dx,sceneNode\.data\.dy\)/, 'Arraste do confrontante deve aplicar deslocamento direto sem reclamp destrutivo no render.');
assert.match(editor,/removeAttribute\('display'\)/, 'Arraste deve restaurar explicitamente a visibilidade do rótulo.');
assert.match(mapas,/areaNames/, 'Gerador deve receber a coleção de nomes persistida.');
assert.match(mapas,/data-area-name-id/, 'Cada nome deve ser renderizado de forma identificável na geração.');
assert.match(css,/\.sv-confrontante-editor-overlay \.sv-confrontante-name-text\{[\s\S]*visibility:visible/, 'CSS deve impedir desaparecimento visual do nome do confrontante durante edição.');

console.log('PASS editor: confrontantes estáveis no drag e múltiplos nomes de mapa persistentes.');
