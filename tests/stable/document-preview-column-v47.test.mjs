import assert from 'node:assert/strict';
import fs from 'node:fs';

const docs = fs.readFileSync(new URL('../../assets/js/core/documents.js', import.meta.url), 'utf8');
const downloads = fs.readFileSync(new URL('../../assets/js/core/downloads.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../assets/css/core/documents.css', import.meta.url), 'utf8');

assert.match(docs, /'planialtimetria\.html'[\s\S]*?compactModel:true,[\s\S]*?noFinalStep:true,[\s\S]*?autoPreviewOnProject:true/, 'Planialtimetria deve usar a bancada compacta com prévia viva.');
assert.match(docs, /'perimetros\.html'[\s\S]*?compactModel:true,[\s\S]*?noFinalStep:true,[\s\S]*?autoPreviewOnProject:true/, 'Perímetros deve usar a bancada compacta com prévia viva.');
assert.ok(docs.includes("const finalExtras = [];"), 'Workspace continua compatível com módulos legados que ainda usem extras, sem exigir esse fluxo nos módulos compactos.');
assert.ok(downloads.includes("page === 'planialtimetria.html'"), 'Download/zoom da planialtimetria deve continuar reconhecendo o módulo.');
assert.match(css, /body\[data-page="planialtimetria\.html"\][\s\S]*?> :not\(#elevationPreview\)[\s\S]*?display:none/, 'Direita da planialtimetria deve conter somente a prévia.');
assert.match(css, /body\[data-page="perimetros\.html"\][\s\S]*?> :not\(#azimuthPreview\)[\s\S]*?display:none/, 'Direita de perímetros deve conter somente a prévia.');
assert.match(css, /body\[data-page="perimetros\.html"\][\s\S]*?\.table-wrap[\s\S]*?border-radius:0/, 'Tabela de perímetros deve manter cantos quadrados quando exibida no documento.');
console.log('PASS V47: colunas de prévia limpas e módulos técnicos consolidados na bancada compacta.');
