import fs from 'node:fs';
import assert from 'node:assert/strict';

const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(documents,/function makePranchaFooterDownload\(\)/,'Pranchas deve ter um único construtor das opções explícitas de download.');
assert.match(documents,/target:'printPreviewV19'.*title:'PDF técnico'/s,'O menu inferior deve expor o PDF técnico oficial.');
assert.match(documents,/target:'downloadSvgV19'.*title:'SVG vetorial'/s,'O menu inferior deve expor o SVG oficial.');
assert.match(documents,/target:'downloadMapWordV197'.*title:'Word editável'/s,'O menu inferior deve expor o Word oficial.');
assert.match(documents,/const downloadMenu = page === 'pranchas\.html' \? makePranchaFooterDownload\(\) : null/,'Pranchas deve manter handlers oficiais e criar uma única instância de download no rodapé.');
assert.match(documents,/if \(page === 'pranchas\.html' \|\| cfg\.compactModel\) return \{ setReady: \(\) => \{\} \};/,'Pranchas não deve deslocar novamente o menu de download para o cabeçalho da prévia.');
assert.match(css,/\.sv-prancha-footer-download\{/,'Menu Baixar deve possuir layout próprio no rodapé.');
assert.match(css,/\.sv-prancha-footer-download-item\{/,'Cada formato deve ser uma ação explícita e independente.');

console.log('PASS prancha-download-options-v212: PDF, SVG e Word ficam no menu inferior sem duplicar os handlers de exportação.');
