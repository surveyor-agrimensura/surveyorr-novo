import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const docs=readFileSync('assets/js/core/documents.js','utf8');
const editor=readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css=readFileSync('assets/css/core/action-icons.css','utf8');
assert.match(docs,/page === 'mapas\.html' \|\| page === 'pranchas\.html'\) document\.body\.classList\.add\('sv-document-icon-mode'\)/);
for(const aria of ["prev.setAttribute('aria-label','Anterior')","next.setAttribute('aria-label','Próximo')","save.setAttribute('aria-label','Salvar rascunho')","restore.setAttribute('aria-label','Restaurar rascunho')","saveButton.setAttribute('aria-label','Salvar alterações no projeto')"]){
 assert.ok(docs.includes(aria),`Rótulo acessível ausente: ${aria}`);
}
assert.match(docs,/save\.appendChild\(draftMark\)/,'Diferenciar ação local com marcador de rascunho');
assert.match(editor,/modal\.querySelectorAll\('\.sv-confrontante-editor-footer \[data-editor-action\]'\)/,'Tooltips reais do editor técnico');
assert.match(css,/body\.sv-document-icon-mode \.sv-doc-nav-btn/,'Navegação de próxima etapa com ícone');
assert.match(css,/\.sv-doc-draft-mark\{[\s\S]*lucide-file-pen-line\.svg/,'Marcação de rascunho no botão de salvamento');
assert.match(css,/\.sv-editor-tool-button \.sv-editor-tool-caption\{\s*display:none/,'Abas técnicas apenas com ícones e nome acessível preservado');
assert.ok(css.includes("[data-editor-action=\"save\"]{--sv-ui-icon:url('/assets/icons/ui/lucide-save-all.svg')"));
for(const icon of ['lucide-file-pen-line.svg','lucide-save-all.svg','lucide-x.svg','lucide-undo-2.svg','lucide-redo-2.svg','lucide-rotate-ccw.svg']){
 assert.ok(existsSync(`assets/icons/ui/${icon}`),`Ícone local ausente: ${icon}`);
}
assert.doesNotMatch(css,/!important|@import\b/,'Evitar empilhar overrides invasivos');
console.log('PASS document-icon-workspace: tooltips, ações originais, abas icon-only, rascunho/final, pack local');
