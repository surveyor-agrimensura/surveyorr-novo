const fs = require('fs');
const assert = require('assert');
const src = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
assert.match(src, /sv-cad-dimension-witness/, 'deve desenhar linhas auxiliares dos vértices');
assert.match(src, /sv-cad-dimension-line/, 'deve desenhar linha de cota paralela ao segmento');
assert.match(src, /sv-cad-dimension-tick/, 'deve desenhar terminais da cota');
assert.match(src, /data-role=\"value\"/, 'deve manter a metragem centralizada na cota');
assert.match(src, /normalDistance/, 'a cota deve ser deslocada na normal do segmento');
console.log('ok - cotas entre vertices r26.3.41');
