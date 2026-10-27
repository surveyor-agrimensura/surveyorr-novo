const fs = require('fs');
const assert = require('assert');
const src = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
assert(src.includes('fetchCefirPropertiesByMunicipalityArea'), 'fallback espacial municipal ausente');
assert(src.includes("upstream.searchParams.set('BBOX'"), 'busca espacial não usa BBOX municipal');
assert(src.includes("upstream.searchParams.set('MAXFEATURES', '2500')"), 'janela municipal insuficiente');
assert(src.includes('await fetchCefirPropertiesByMunicipalityArea(safeQuery, municipality, collected)'), 'fallback espacial não integrado à busca por nome');
assert(src.includes('boundingbox'), 'geocodificação municipal não preserva bounding box');
console.log('PASS: busca por nome usa fallback espacial municipal no CEFIR/GeoBahia.');
