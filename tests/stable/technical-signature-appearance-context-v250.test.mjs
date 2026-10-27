import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const native=fs.readFileSync('assets/js/core/native-technical-document.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(editor,/IMPORTED_SIGNATURE_PREFIX/,'Assinatura externa deve possuir armazenamento próprio por projeto, sem entrar na assinatura da conta.');
assert.match(editor,/data-document-imported-signature/,'Assinatura externa deve virar objeto SVG editável próprio.');
assert.match(editor,/data-import-signature-input/,'Painel Assinatura deve oferecer importação de imagem.');
assert.match(native,/id:'imported-signature', type:'signature'/,'Documento nativo deve representar a assinatura importada como objeto técnico.');

assert.match(app,/polygonSection\.hidden=polygonCards\.length<=1/,'Polígono único não deve duplicar controles globais e individuais na Aparência.');
assert.match(editor,/polygonSection\.hidden=inventory\.length<=1/,'A ocultação da duplicidade deve acompanhar a quantidade real de polígonos.');

assert.match(editor,/data-confrontante-context-menu/,'Confrontante deve possuir menu de contexto próprio.');
assert.match(editor,/data-confrontante-context-rotation/,'Menu do confrontante deve permitir rotação direta.');
assert.match(editor,/data-confrontante-context-scale/,'Menu do confrontante deve permitir tamanho direto.');
assert.match(editor,/data-confrontante-context-delete/,'Menu do confrontante deve permitir exclusão direta.');
assert.match(editor,/closest\?\.\('\.sv-confrontante-callout'\)/,'Clique direito deve identificar o confrontante diretamente no SVG.');
assert.match(css,/\[data-document-imported-signature\]/,'Assinatura importada deve compartilhar o comportamento visual editável da assinatura da conta.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V250 base: assinatura externa, Aparência sem duplicidade e contexto completo de confrontantes preservados.');
