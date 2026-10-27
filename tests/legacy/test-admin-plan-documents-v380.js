import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../assets/js/admin/documents.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../functions/surveyor-api/src/main.js', import.meta.url), 'utf8');
const support = fs.readFileSync(new URL('../functions/surveyor-support/src/main.js', import.meta.url), 'utf8');

for (const id of ['planDocGeneratePdf','planDocPreviewPdf','planDocSendEmail','planDocPdfModal','planDocPdfFrame']) assert.ok(html.includes(`id="${id}"`), `faltando ${id}`);
assert.ok(!html.includes('jspdf.umd.min.js'), 'jsPDF não deve bloquear o carregamento inicial do Admin');
assert.ok(!html.includes('jszip.min.js'), 'JSZip não deve bloquear o carregamento inicial do Admin');
assert.ok(js.includes('async function ensurePdfLibrary'), 'carregamento sob demanda do jsPDF ausente');
assert.ok(js.includes('async function ensureWordLibrary'), 'carregamento sob demanda do JSZip ausente');
assert.ok(js.includes('jspdf.umd.min.js'), 'URL do jsPDF sob demanda ausente');
assert.ok(js.includes('jszip.min.js'), 'URL do JSZip sob demanda ausente');
assert.ok(js.includes('async function buildPdf'), 'gerador PDF ausente');
assert.ok(js.includes("doc.addImage(signature"), 'assinatura não é inserida no PDF');
assert.ok(js.includes("doc.line(pageW / 2 - 45"), 'linha de assinatura ausente');
assert.ok(js.indexOf("doc.addImage(signature") < js.indexOf("doc.line(pageW / 2 - 45"), 'assinatura deve ficar acima da linha');
assert.ok(js.includes('sendPlanDocumentEmail'), 'integração de envio ausente');
assert.ok(api.includes("/api/admin/plan-documents/send-email"), 'rota administrativa ausente');
assert.ok(support.includes("/api/admin/send-plan-document"), 'rota da Function de e-mail ausente');
assert.ok(support.includes('attachment:'), 'anexo Brevo ausente');
console.log('OK: documentos dos planos Word/PDF, visualização, assinatura e e-mail.');
