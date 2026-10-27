import fs from 'node:fs';
import assert from 'node:assert/strict';

const documents=fs.readFileSync('assets/js/core/documents.js','utf8');
const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(documents,/create\('div','sv-prancha-footer-download'\)/,'Download deve usar contêiner controlado, sem depender do hitbox nativo de details.');
assert.match(documents,/create\('button','sv-prancha-footer-download-trigger','Download'\)/,'A área visual inteira do Download deve ser um botão real.');
assert.match(documents,/trigger\.setAttribute\('aria-expanded'/,'Download deve expor estado aberto/fechado acessível.');
assert.match(documents,/list\.hidden = true/,'Lista de download deve sair integralmente do hit-test quando fechada.');
assert.match(css,/\.sv-prancha-footer-download-trigger\{[\s\S]*width:100%;[\s\S]*cursor:pointer;[\s\S]*pointer-events:auto/,'Botão Download deve ter hitbox integral e cursor de ação em toda a área.');
assert.match(css,/\.sv-editor-inline-download-slot\{[\s\S]*z-index:7;[\s\S]*pointer-events:auto/,'Slot do Download deve permanecer acima de elementos vizinhos no rodapé.');
assert.match(editor,/const oldWidth = Math\.max\(1, sheetRect\.width \|\| sheet\.offsetWidth \|\| 1\)/,'Zoom deve ancorar na geometria real do documento, não na razão total do scroll container.');
assert.match(editor,/const focusY = Math\.max\(0, Math\.min\(1, \(centerClientY - sheetRect\.top\) \/ oldHeight\)\);/,'Zoom deve preservar o ponto visual central da prancha também no eixo vertical.');
assert.match(editor,/requestAnimationFrame\(\(\) => requestAnimationFrame/,'Reposicionamento deve esperar o layout finalizar após alterar o tamanho do documento.');
assert.match(css,/\.sv-confrontante-editor-sheet\{[\s\S]*transition:none;/,'Editor inline não deve animar largura enquanto calcula o ponto de ancoragem do zoom.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve continuar sem !important.');

console.log('PASS V257: zoom ancorado na prancha e Download com hitbox integral.');
