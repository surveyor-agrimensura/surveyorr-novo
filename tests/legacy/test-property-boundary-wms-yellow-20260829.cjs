const fs = require('fs');
const assert = require('assert');
const app = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const ok = (condition, message) => assert.ok(condition, message);
ok(app.includes("clientRasterRecolor: 'property-yellow'"), 'Limites de Propriedade devem manter recolor amarelo local');
ok(app.includes("wmsStrokeColor: '#D9E000'"), 'contorno técnico amarelo ausente');
ok(app.includes('buildGeobahiaPropertyBoundaryWmsLayer'), 'fonte CEFIR/INEMA BA ausente');
ok(app.includes('buildSicarPropertyBoundaryWmsLayer'), 'fonte SICAR nacional ausente');
console.log('PASS: Limites de Propriedade mantêm visual amarelo em CEFIR/INEMA BA e SICAR nas demais UFs.');
