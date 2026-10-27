import fs from 'node:fs';
import assert from 'node:assert/strict';

const js = fs.readFileSync('assets/js/features/memorial/app.js', 'utf8');
const html = fs.readFileSync('memorial/index.html', 'utf8');

assert.match(js, /\.custom-memorial-page, \.standard-memorial-page/);
assert.match(js, /async function buildStandardTemplateDocument/);
assert.match(js, /async function paginateStandardNarrative/);
assert.match(js, /standardTemplateBodyOverflows/);
assert.match(js, /width:210mm;height:297mm;min-height:297mm;max-height:297mm/);
assert.match(js, /standard-template-ident-row/);
assert.match(js, /max-width:176mm;max-height:145mm/);
assert.match(js, /standard-template-signatures/);
assert.match(js, /lastPdfHtml=currentTemplate\.id==='standard' \? standardDocument : customDocument/);
assert.doesNotMatch(js, /withVisibleHeaderFooter/);
assert.doesNotMatch(js, /const baseArticle=/);
assert.match(html, /memorial-v21\.9\.5\.js\?v=21\.11\.5-chrome-native-preview-0819/);
assert.doesNotMatch(html, /Gerador de memorial descritivo/);
assert.doesNotMatch(html, /Usa o perímetro principal do projeto salvo/);

console.log('OK v21.9.403: modelo padrão usa páginas A4 fixas, paginação medida, mapa e assinaturas sem doc.html livre.');
