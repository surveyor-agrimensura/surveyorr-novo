const fs = require('node:fs');
const assert = require('node:assert/strict');

const map = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const admin = fs.readFileSync('assets/js/admin/app.js','utf8');
const api = fs.readFileSync('functions/surveyor-api/src/main.js','utf8');

for (const src of [map, admin, api]) {
  assert.match(src, /uc_inema_2025/, 'UC estadual 2025 deve fazer parte da resolução oficial');
  assert.match(src, /faixa_dominio_ferrovia|faixa_dominio_ferrovias|faixa_dominio_ferroviario/, 'faixa ferroviária deve possuir aliases de domínio/servidão');
}

assert.match(map, /GEOBAHIA_HEAVY_LAYER_MIN_ZOOM/);
for (const name of ['vegetacao','geologia_2004','geomorfologia_2004','solos','bacias_ottocodificadas','bacias_otto_nivel4']) {
  assert.match(map, new RegExp(`${name}:\\s*12`), `${name} deve ser pausada abaixo do zoom 12`);
}
assert.match(map, /phase:\s*'waiting-zoom'/);
assert.match(map, /Aproxime o mapa até o zoom/);
assert.match(map, /syncCatalogLayers\(\)\.catch/);

for (const src of [admin, api]) {
  for (const layer of ['Vetor_Bases_Gerais:vegetacao','Vetor_Recursos_Hidricos:bacias_ottocodificadas','Vetor_Recursos_Hidricos:bacias_otto_nivel4','Vetor_Recursos_Naturais:geologia_2004','Vetor_Recursos_Naturais:geomorfologia_2004','Vetor_Recursos_Ambientais:solos']) {
    const idx = src.indexOf(`"layer": "${layer}"`);
    assert.ok(idx >= 0, `camada ausente: ${layer}`);
    assert.match(src.slice(idx, idx + 180), /"minZoom":\s*12/, `${layer} precisa persistir minZoom 12`);
  }
}

console.log('PASS: nomes técnicos resilientes (UC 2025/ferrovia) + minZoom 12 nas camadas WMS pesadas.');
