import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(editor,/data-editor-tool="zoom"/,'Editor deve ter ferramenta lateral de visualização.');
assert.doesNotMatch(editor,/data-editor-tool="names"/,'Editor não deve mais expor ferramenta lateral manual de nomes.');
assert.match(editor,/data-area-name-context-menu/,'Editor deve substituir a edição lateral de nomes por menu contextual no mapa.');
assert.match(editor,/data-editor-tool="vertices"/,'Editor deve ter ferramenta lateral de vértices.');
assert.match(editor,/data-editor-tool="lines"/,'Editor deve ter ferramenta lateral de linhas.');
assert.match(editor,/data-editor-tool="confrontantes"/,'Editor deve ter ferramenta lateral de confrontantes.');
assert.match(editor,/data-editor-tool="appearance"/,'Editor deve ter ferramenta lateral de aparência.');
assert.match(editor,/function setActiveToolPanel/,'Editor deve controlar painel lateral por uma única função.');
assert.match(editor,/Motor de edição indisponível; editor segue em modo local estável/,'Falha do engine não pode deixar toda a interface inerte.');
assert.match(editor,/function attachStableConfrontanteDrag/,'Arraste de confrontante deve usar interação estável dedicada.');
assert.match(editor,/applyOffsetDirect\(drag\.group,dx,dy\)/,'Arraste deve atualizar o rótulo diretamente sem recriá-lo.');
assert.match(css,/\.sv-editor-tool-drawer\.open/,'Painel lateral deve ser expansível.');
assert.match(css,/\.sv-editor-tool-rail/,'Barra lateral compacta deve existir.');
assert.doesNotMatch(editor,/sv-confrontante-editor-toolbar/,'Barra superior antiga não deve continuar como fonte da interface do editor.');
console.log('technical-editor-collapsible-tools: ok');
