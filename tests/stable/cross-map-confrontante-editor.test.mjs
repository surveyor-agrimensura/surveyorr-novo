import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const planHtml = read('planialtimetria/index.html');
const periHtml = read('perimetros/index.html');
const plan = read('assets/js/features/planialtimetria/app.js');
const peri = read('assets/js/features/perimetros/app.js');
const shared = read('assets/js/core/technical-document-editor.js');
const docsCss = read('assets/css/core/documents.css');

for (const [name, html] of [['planialtimetria', planHtml], ['perimetros', periHtml]]) {
  assert.ok(html.includes('/assets/js/features/mapas/confrontantes.js'), `${name}: motor de confrontantes ausente`);
  assert.ok(html.includes('/assets/js/core/technical-document-editor.js'), `${name}: editor compartilhado ausente`);
}
assert.ok(plan.includes('smartConfrontanteLabels'), 'Planialtimetria deve renderizar confrontantes editáveis.');
assert.ok(peri.includes('smartConfrontanteLabels'), 'Azimute deve renderizar confrontantes editáveis.');
assert.ok(plan.includes('confrontanteEditor?.readOffsets?.()'), 'Planialtimetria deve reaplicar posições salvas.');
assert.ok(peri.includes('confrontanteEditor?.readOffsets?.()'), 'Azimute deve reaplicar posições salvas.');
assert.ok(shared.includes('sv-confrontante-editor-modal'), 'Editor comum deve abrir modal próprio.');
assert.ok(shared.includes('rasterize(parts.background)'), 'Editor comum deve rasterizar a prancha de fundo.');
assert.ok(shared.includes('setPointerCapture'), 'Editor comum deve usar Pointer Events.');
assert.ok(shared.includes('const ZOOM_MIN = 0.50')&&shared.includes('const ZOOM_MAX = 3.00'), 'Editor comum deve preservar faixa única de zoom útil entre as gerações.');
assert.ok(plan.includes("previewCard.classList.toggle('sv-planialt-preview-only', true)"), 'Planialtimetria deve deixar a direita exclusiva para prévia.');
assert.ok(plan.includes('dataHost.appendChild(idwOutput)'), 'IDW deve sair da área de prévia.');
assert.ok(docsCss.includes('.sv-planialt-preview-only #elevationPreview'), 'CSS da prévia exclusiva de Planialtimetria ausente.');
console.log('PASS V46: editor de confrontantes replicado e Planialtimetria com prévia exclusiva.');
