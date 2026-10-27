import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('assets/css/core/action-icons.css','utf8');
const documents = readFileSync('assets/js/core/documents.js','utf8');
const legacy = readFileSync('assets/css/core/documents.css','utf8');

// Reproduz o conflito: documents.css dá prioridade ao tamanho textual 11px.
assert.match(legacy,/body\.sv-document-compact-model\.sv-document-workspace-page \.sv-doc-compact-footer-actions>\.export-menu>\.btn\{[\s\S]*font-size:11px/);
assert.match(legacy,/body\[data-page="pranchas\.html"\]\.sv-document-workspace-page \.sv-prancha-footer-download-trigger\{[\s\S]*font-size:11px/);
// A regra correta precisa ter especificidade superior sem !important.
assert.match(css,/body\.sv-document-icon-mode\.sv-document-compact-model\.sv-document-workspace-page \.sv-doc-compact-footer-actions > \.export-menu > \.btn,[\s\S]*body\[data-page="pranchas\.html"\]\.sv-document-icon-mode\.sv-document-workspace-page \.sv-prancha-footer-download-trigger\{[\s\S]*font-size:0/);
assert.match(css,/\.sv-prancha-footer-download-trigger::after\{\s*content:none/);
assert.match(documents,/trigger\.title = 'Baixar documento';\s*trigger\.setAttribute\('aria-label','Baixar documento'\)/);
assert.match(documents,/const options = \[\s*\{ target:'printPreviewV19'[\s\S]*\{ target:'downloadSvgV19'[\s\S]*\{ target:'downloadMapWordV197'/);
assert.match(documents,/trigger\.addEventListener\('click',\(event\)=>\{/);
assert.doesNotMatch(css,/!important/);
console.log('PASS download-icon-only-footer: ícone exclusivo, prioridade CSS, acessibilidade e opções mantidas');
