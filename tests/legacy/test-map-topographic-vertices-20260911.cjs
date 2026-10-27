const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');

assert.match(app, /function vertexTopographicLabelLayout\(/, 'deve calcular direção/offset do rótulo para fora do perímetro');
assert.match(app, /direction: layout\.direction/, 'o tooltip deve receber a direção topográfica calculada');
assert.match(app, /L\.circleMarker\(latlng, \{[\s\S]*radius: 1\.6/, 'deve manter ponto de ancoragem discreto');
assert.match(app, /marker\.on\('click', \(\) => openConfrontanteEditor\(selectedLayer, index\)\)/, 'o ponto técnico continua clicável para editar confrontante');

const start = css.indexOf('.leaflet-tooltip.vertex-label-tooltip{');
const end = css.indexOf('.vertex-tooltip{', start);
const vertexCss = css.slice(start, end);
assert.match(vertexCss, /background:transparent!important/);
assert.match(vertexCss, /-webkit-text-stroke:1\.8px rgba\(255,255,255,.98\)!important/);
assert.match(vertexCss, /vertex-label-tooltip/);
assert.match(vertexCss, /font:800 9px\/1/);
assert.match(app, /direction: 'right'/);
assert.match(app, /direction: 'left'/);
assert.match(app, /direction: 'top'/);
assert.match(app, /direction: 'bottom'/);
assert.doesNotMatch(vertexCss, /background:#2563eb!important/);
assert.doesNotMatch(vertexCss, /border-radius:999px/);

console.log('OK: vértices topográficos discretos, com halo e ancoragem técnica validados.');
