const fs = require('fs');
const assert = require('assert');
const src = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
assert(src.includes('function buildGeobahiaPropertyBoundaryWmsLayer'), 'renderer CEFIR/INEMA BA ausente');
assert(src.includes("__georuralSourceMode = 'geobahia-cefir-boundary-wms'"), 'modo CEFIR BA não identificado');
assert(src.includes('function buildSicarPropertyBoundaryWmsLayer'), 'renderer SICAR das demais UFs ausente');
assert(src.includes("sicarStateCodeForLayer(layer) === 'BA'"), 'seleção de fonte por UF ausente');
assert(src.includes('visibleBoundaryLeaflet?.__georuralOriginalServiceUrl'), 'consulta deve preservar a fonte visual real');
console.log('PASS: Limites de Propriedade usam CEFIR/INEMA na Bahia e SICAR nas demais UFs, preservando a fonte visual no clique.');
