import fs from 'node:fs';
import assert from 'node:assert/strict';

const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const pdfPreview = fs.readFileSync('assets/js/core/pdf-preview.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.ok(documents.includes('function setupEmptyProjectPreview()'), 'deve existir recuperação central do preview vazio');
assert.ok(documents.includes('sv-doc-canonical-empty-preview'), 'estado vazio deve usar a fonte única técnica');
assert.ok(documents.includes('sv-prancha-inline-empty-sheet'), 'as demais gerações devem reutilizar a mesma folha vazia da Prancha Técnica');
assert.ok(documents.includes('sv-prancha-inline-empty-message'), 'a mensagem deve usar o mesmo overlay central da Prancha Técnica');
assert.ok(!documents.includes('sv-doc-preview-shell-placeholder'), 'shell alternativo antigo deve ser removido');
assert.ok(!css.includes('sv-doc-preview-shell-page'), 'folha pequena/vertical antiga não deve permanecer no CSS');
assert.ok(css.includes('.sv-doc-canonical-empty-preview .sv-prancha-inline-empty-sheet'), 'CSS central deve dimensionar a folha técnica reutilizada');
assert.ok(css.includes('aspect-ratio:1.6/1'), 'estado vazio deve manter proporção horizontal da interface técnica');
assert.ok(css.includes('body.sv-document-workspace-page:not([data-page="pranchas.html"]) .sv-doc-canonical-empty-preview .sv-prancha-inline-empty-sheet'), 'demais gerações devem ter enquadramento próprio sem alterar a Prancha Técnica homologada');
assert.ok(css.includes('height:100%;') && css.includes('max-height:100%;'), 'folha vazia das demais gerações deve caber integralmente na altura útil do preview');
assert.ok(css.includes('width:auto;'), 'largura da folha vazia deve derivar da altura disponível para preservar o enquadramento completo');
assert.ok(pdfPreview.includes('.sv-doc-canonical-empty-preview,.sv-prancha-inline-empty-sheet'), 'PDF preview não pode converter o estado vazio técnico em PDF');
for (const label of ['memorial.html','planialtimetria.html','perimetros.html','loteamentos-reurb.html','ambiental.html']) {
  assert.ok(documents.includes(label), `${label} deve permanecer coberto pelo workspace documental`);
}
assert.ok(mapas.includes("const anchor = i === 0 ? 'start' : (i === vx ? 'end' : 'middle')"), 'coordenadas horizontais extremas devem continuar ancoradas para dentro');
assert.ok(mapas.includes('if (i > 0 && i < vy)'), 'coordenadas verticais de canto não devem colidir com quadros adjacentes');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS preview técnico unificado: todas as gerações reutilizam a folha vazia da Prancha Técnica.');
