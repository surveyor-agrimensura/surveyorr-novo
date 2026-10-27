import fs from 'node:fs';
import assert from 'node:assert/strict';

const typography=fs.readFileSync('assets/js/core/technical-svg-typography.js','utf8');
const pdf=fs.readFileSync('assets/js/core/pdf-preview.js','utf8');

assert.match(typography,/function preservesHalo\(node, options = \{\}\)/,'Normalizador tipográfico deve aceitar política por contexto.');
assert.match(pdf,/shared\(svg, \{ preserveConfrontanteHalo:true, preserveAreaNameHalo:false, context:'pdf-export' \}\)/,'PDF deve preservar os dados de cor/halo dos confrontantes.');
assert.match(pdf,/function addPrintableConfrontanteOutlines\(svg\)/,'PDF deve construir halo vetorial independente de paint-order.');
assert.match(pdf,/underlay\.setAttribute\('fill', 'none'\)/,'Contorno deve ser vazado, sem tinta de fundo.');
assert.match(pdf,/node\.parentNode\?\.insertBefore\(underlay, node\)/,'Halo deve ser inserido antes da fonte original.');
assert.match(pdf,/node\.setAttribute\('fill', color\)/,'PDF deve manter cor escolhida do nome do confrontante.');

console.log('PASS: exportação vetorial cria halo vazado atrás dos nomes, sem tarjas pretas.');
