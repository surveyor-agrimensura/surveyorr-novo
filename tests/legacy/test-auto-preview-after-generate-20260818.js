import assert from 'node:assert/strict';
import fs from 'node:fs';

const modules = {
  ambiental: ['environmentOutput','generateEnvironmental'],
  car: ['carReportPreview','generateCarReport'],
  confrontacao: ['letterOutput','generateLetter'],
  glebas: ['glebaPreview','glebaGenerate'],
  mapas: ['mapPreview','generateMapV19'],
  memorial: ['memorialOutput','generateMemorial'],
  perimetros: ['azimuthPreview','generateAzimuth'],
  planialtimetria: ['elevationPreview','analyzeElevation'],
  pranchas: ['mapPreview','generateMapV19']
};

for (const [folder,[preview,generate]] of Object.entries(modules)) {
  const html = fs.readFileSync(`${folder}/index.html`,'utf8');
  assert.doesNotMatch(html,/data-document-preview-open=/,`${folder}: não deve existir botão separado Visualizar/Ocultar.`);
  assert.match(html,new RegExp(`id="${preview}"[^>]*data-document-preview-generate="${generate}"|id="${preview}"[^>]*hidden[^>]*data-document-preview-generate="${generate}"`),`${folder}: preview deve estar associado ao botão Gerar.`);
  assert.match(html,new RegExp(`id="${preview}"[^>]*hidden|id="${preview}" hidden`),`${folder}: preview deve iniciar oculto.`);
}

const lotHtml = fs.readFileSync('loteamentos-reurb/index.html','utf8');
assert.doesNotMatch(lotHtml,/data-document-preview-open=/,'Loteamentos: não deve existir botão separado Visualizar/Ocultar.');
assert.match(lotHtml,/id="lotPreview"[^>]*data-document-preview-auto="mutation"|id="lotPreview"[^>]*hidden[^>]*data-document-preview-auto="mutation"/,'Loteamentos: preview deve aparecer automaticamente após conteúdo ser gerado.');

const runtime = fs.readFileSync('assets/js/core/preview-toggle.js','utf8');
assert.doesNotMatch(runtime,/Ocultar visualização|button\.textContent\s*=\s*['"]Visualizar/,'Runtime não deve reintroduzir o botão de alternância.');
assert.match(runtime,/dataset\.documentPreviewGenerate === trigger\.id/,'Runtime deve vincular o clique em Gerar à pré-visualização.');
assert.match(runtime,/revealPreview\(preview\)/,'Runtime deve revelar a pré-visualização automaticamente.');

console.log('OK: Gerar => pré-visualização automática, sem botão Visualizar/Ocultar nos módulos de documentos.');
