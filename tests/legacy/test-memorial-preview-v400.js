import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../memorial/index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../assets/js/features/memorial/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/features/memorial/memorial-preview.css', import.meta.url), 'utf8');

assert.match(html, /memorial-preview\.css/);
assert.match(js, /SurveyorPdfPreview\?\.showBlob/);
assert.match(html, /pdf-preview-live-v21\.11\.5\.js/);
assert.doesNotMatch(js, /toolbar=0|navpanes=0/);
assert.match(css, /width:760px/);
assert.match(css, /height:640px/);
assert.match(css, /top:7\.2mm/);
assert.match(css, /width:52mm/);
assert.match(css, /height:20mm/);
assert.match(css, /max-width:46mm/);
assert.match(css, /max-height:18mm/);
assert.match(css, /overflow:visible/);
assert.match(js, /top:7\.2mm/);
assert.match(js, /max-height:18mm/);

console.log('OK v21.9.400 — preview PDF ampliado e logotipo sem corte.');
