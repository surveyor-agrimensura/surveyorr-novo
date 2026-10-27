import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../memorial/index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../assets/js/features/memorial/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/features/memorial/memorial-preview.css', import.meta.url), 'utf8');

assert.match(html, /html2canvas\/1\.4\.1\/html2canvas\.min\.js/);
assert.match(html, /jspdf\/2\.5\.1\/jspdf\.umd\.min\.js/);
assert.match(html, /memorial-preview\.css/);
assert.match(js, /async function paginateCustomNarrative/);
assert.match(js, /customTemplateBodyOverflows/);
assert.match(js, /await buildCustomTemplateDocument/);
assert.match(js, /async function buildMemorialPdfBlob/);
assert.match(js, /SurveyorPdfPreview\?\.showBlob/);
assert.match(html, /pdf-preview-live-v21\.11\.5\.js/);
assert.match(js, /doc\.addImage\(canvas\.toDataURL/);
assert.doesNotMatch(js, /\$\('memorialOutput'\)\.innerHTML=lastMemorialHtml/);
assert.match(css, /height:297mm/);
assert.match(css, /padding:38mm 18mm 35mm/);
assert.match(css, /height:640px/);
assert.match(css, /overflow:hidden/);

console.log('OK v21.9.400 — Memorial A4, paginação medida e preview PDF ampliado.');
