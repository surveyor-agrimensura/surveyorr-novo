import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('central-lotes/index.html', 'utf8');
const css = fs.readFileSync('assets/css/features/central-lotes/app.css', 'utf8');

assert.match(html, /<h1>Central de Lotes<\/h1>/, 'Conservar título principal');
assert.doesNotMatch(html, /Produção técnica\s*·\s*Teste experimental/i, 'Retirar etiqueta de experimento do topo');
assert.doesNotMatch(html, /Selecione um projeto salvo e gere documentos organizados/i, 'Retirar parágrafo redundante sob título');
assert.doesNotMatch(html, /Esta primeira versão gera peças preliminares/i, 'Retirar aviso extenso da lateral de peças');
assert.match(html, /class="batch-header"/, 'Preservar cabeçalho funcional');
assert.match(html, /class="batch-open-map"[^>]*>Abrir mapa<\/a>/, 'Preservar navegação para mapa');
for (const name of ['memorial','prancha','croqui','confrontantes','ods','coordenadas','geojson','kml']) {
  assert.match(html, new RegExp(`data-batch-doc="${name}"`), `Preservar opção ${name}`);
}
for (const id of ['batchProject','reloadBatch','selectAllLots','lotItems','generateBatch','downloadBatch','batchStatus']) {
  assert.match(html, new RegExp(`id="${id}"`), `Preservar controle funcional ${id}`);
}
assert.match(css, /\.batch-doc\s+input\[type="checkbox"\]/, 'Checkboxes de peças devem ter CSS próprio');
assert.match(css, /\.batch-lot\s+input\[type="checkbox"\]/, 'Checkboxes dos lotes devem ter CSS próprio');
assert.match(css, /min-height:\s*16px/, 'Neutralizar altura mínima global de 42px');
assert.match(css, /width:\s*16px/, 'Neutralizar largura global de 100%');
assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, 'Manter peças em duas colunas responsivas');
assert.match(css, /@media\s*\(max-width:\s*600px\)/, 'Manter layout adequado a telas móveis');
console.log('PASS central-lotes-layout: topo enxuto, checkboxes compactos e seleções funcionais preservadas.');
