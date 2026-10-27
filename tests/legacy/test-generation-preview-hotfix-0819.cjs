
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (msg) => { throw new Error(msg); };

const pdfPages = ['mapas','pranchas','planialtimetria','perimetros','confrontacao','ambiental','memorial','car','glebas','loteamentos-reurb'];
for (const name of pdfPages) {
  const html = read(`${name}/index.html`);
  if (!html.includes('pdf-preview.js')) fail(`${name}: gerador de preview PDF não carregado.`);
  if (!/frame-src[^;]*blob:/i.test(html)) fail(`${name}: CSP não permite blob: no frame-src do visualizador PDF nativo.`);
}


const sharedPreview = read('assets/js/core/pdf-preview.js');
if (!sharedPreview.includes('nativeViewerHash')) fail('preview: helper do visualizador PDF nativo ausente.');
if (!sharedPreview.includes('toolbar=1&navpanes=1&scrollbar=1')) fail('preview: controles nativos do Chromium não estão habilitados.');
if (!sharedPreview.includes('while (doc.getNumberOfPages() > 1)')) fail('preview: proteção contra página branca extra em documentos vetoriais ausente.');
const memorialJs = read('assets/js/features/memorial/app.js');
if (!memorialJs.includes('SurveyorPdfPreview?.showBlob')) fail('memorial: preview não usa o visualizador PDF nativo compartilhado.');
if (/toolbar=0|navpanes=0/.test(memorialJs)) fail('memorial: controles do visualizador nativo continuam desativados.');

const ambiental = read('ambiental/index.html');
if (!ambiental.includes('data-document-preview-generate="generateEnvironmental"')) fail('ambiental: preview não está ligado ao botão Gerar relatório.');
if (!ambiental.includes('id="environmentOutput"') || !ambiental.includes('hidden')) fail('ambiental: preview deve começar oculto.');

const perimetros = read('assets/js/features/perimetros/app.js');
if (!perimetros.includes('async function ensureAzimuthResult()')) fail('perímetros: fallback do perímetro existente ausente.');
if (perimetros.includes("if (!azimuthGeojson) return alert('Calcule o perímetro primeiro.')")) fail('perímetros: ainda existe bloqueio antigo exigindo recalcular o perímetro.');
if (!perimetros.includes('await ensureAzimuthResult()')) fail('perímetros: download/salvamento não reutilizam o perímetro já existente.');

console.log('OK: previews PDF liberados por CSP e perímetro existente reutilizado sem recalcular.');
