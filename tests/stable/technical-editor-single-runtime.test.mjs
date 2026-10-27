import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(app,/function ensureTechnicalDocumentEditorInstance\(\)/,'Mapas/Pranchas deve inicializar explicitamente o editor técnico formal.');
assert.match(app,/async function loadTechnicalDocumentEditorInstance\(\)/,'Editor formal deve possuir recuperação de carregamento sem cair no editor legado.');
assert.match(app,/return editor\.start\(\)/,'Botão de edição deve abrir exclusivamente o editor técnico formal.');
assert.doesNotMatch(app,/Clique e arraste um confrontante\. A marcação azul aparece somente no editor e não sai no PDF\./,'Texto legado não pode reaparecer na interface.');
assert.doesNotMatch(app,/modal\.innerHTML = `[\s\S]*sv-confrontante-editor-help/,'App de mapas não pode manter uma segunda implementação completa do modal de edição.');
assert.match(editor,/data-editor-action="draw-line"/,'Editor formal deve manter Desenhar linha.');
assert.match(editor,/data-editor-action="edit-lines"/,'Editor formal deve manter Editar linhas.');
assert.match(editor,/data-editor-action="add-area-name"/,'Editor formal deve manter múltiplos nomes no mapa.');
assert.match(editor,/sv-confrontante-segment-panel/,'Editor formal deve manter painel lateral de confrontantes.');
assert.match(editor,/data-document-setting="vertexScale"/,'Editor formal deve manter controle global dos vértices.');
assert.doesNotMatch(editor,/Arraste nomes, vértices e use “Editar linhas” para reposicionar traçados\./,'Instrução técnica não deve ocupar espaço visível no editor.');
assert.match(css,/\.sv-confrontante-editor-help\{display:none\}/,'CSS deve esconder qualquer ajuda legada residual.');

console.log('PASS editor: runtime formal único, controles completos e sem instruções legadas visíveis.');
