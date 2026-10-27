import fs from 'node:fs';
import assert from 'node:assert/strict';

const pranchas = fs.readFileSync('pranchas/index.html','utf8');
const pdf = fs.readFileSync('assets/js/core/pdf-preview.js','utf8');
const ui = fs.readFileSync('assets/js/core/ui.js','utf8');

assert.ok(!pranchas.includes('preview-engine.css'), 'Prancha Técnica não deve carregar CSS do Preview Engine piloto');
assert.ok(!pranchas.includes('preview-engine.js'), 'Prancha Técnica não deve carregar JS do Preview Engine piloto');
assert.ok(!pdf.includes('customPreviewEngine'), 'pdf-preview deve voltar ao viewer nativo, sem flag do engine piloto');
assert.match(pdf, /surveyor-pdf-native-viewer-official/, 'viewer PDF nativo deve continuar sendo a pré-visualização oficial');
assert.match(pdf, /height:clamp\(540px,68vh,920px\)/, 'viewport nativo deve ter altura interna estável');
assert.match(pdf, /scrolling="yes"/, 'iframe nativo deve manter rolagem interna explícita');
assert.match(pdf, /#page=1&zoom=page-width&toolbar=1&navpanes=1&scrollbar=1/, 'viewer nativo deve abrir com toolbar, zoom e scrollbar do navegador');

const grouped = ui.match(/const definitions = \[([\s\S]*?)\n    \];/)?.[1] || '';
const docsStart = grouped.indexOf("['Documentos e consulta'");
const analysisStart = grouped.indexOf("['Análise e campo'");
const ambient = grouped.indexOf("['/ambiental','ambiental','Relatório Ambiental'");
assert.ok(docsStart >= 0 && analysisStart > docsStart, 'grupos Ferramentas esperados devem existir');
assert.ok(ambient > docsStart && ambient < analysisStart, 'Relatório Ambiental deve ficar em Documentos e consulta');
const analysisSlice = grouped.slice(analysisStart);
assert.ok(!analysisSlice.includes("['/ambiental','ambiental','Relatório Ambiental'"), 'Relatório Ambiental não deve permanecer em Análise e campo');

assert.ok(!fs.existsSync('assets/js/core/preview-engine.js'), 'arquivo JS do engine piloto deve ser removido');
assert.ok(!fs.existsSync('assets/css/core/preview-engine.css'), 'arquivo CSS do engine piloto deve ser removido');
console.log('PASS native-preview-home-tools-v105: prévia nativa restaurada, scroll/zoom isolados e Relatório Ambiental reposicionado.');
