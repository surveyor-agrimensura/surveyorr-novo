import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(bridge,/const inferredDefault = safe\(value\?\.defaultAreaName \?\? value\?\.projectAreaName\)\.trim\(\);/,'Bridge deve aceitar o nome principal do projeto como rótulo padrão.');
assert.match(bridge,/inferredDefault \? \[{ id:'area-1', text:inferredDefault, scale:1, rotation:0 }\] : \[]/,'Quando não houver coleção persistida, o nome do imóvel deve nascer automaticamente.');
assert.match(editor,/function showAreaNameContextMenu\(clientX,clientY,areaId=''/,'Editor deve abrir menu de contexto para o nome do imóvel.');
assert.match(editor,/overlay\?\.addEventListener\('contextmenu',[\s\S]*showAreaNameContextMenu/,'Clique direito no nome do imóvel deve abrir o menu contextual.');
assert.match(editor,/data-area-name-context-delete>Excluir nome/,'Menu contextual deve oferecer a exclusão do nome do imóvel.');
assert.match(css,/\.sv-area-name-context-menu\{[\s\S]*position:fixed;[\s\S]*min-width:148px;/,'Menu contextual do nome deve ter posicionamento próprio e largura mínima estável.');
assert.match(app,/const defaultAreaName = cleanDocumentValue\(p\?\.propertyName \|\| p\?\.title \|\| p\?\.name \|\| ''\);/,'Pranchas devem derivar o nome padrão do imóvel a partir do projeto salvo.');

console.log('PASS V224: nome padrão do imóvel e exclusão por clique direito garantidos.');
