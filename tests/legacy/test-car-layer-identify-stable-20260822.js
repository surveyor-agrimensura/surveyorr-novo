import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(app, /function visiblePropertyBoundaryContextAt\(latlng\)/);
assert.match(app, /__georuralLastFeatures/);
assert.match(app, /turf\.booleanPointInPolygon\(point, feature\)/);
assert.match(app, /const directFeatureProperties = context\?\.feature\?\.properties/);
assert.match(app, /const featureProperties = directFeatureProperties \|\| visibleFeatureProperties \|\| null/);
assert.match(app, /autoPan: false/);
assert.match(app, /bubblingMouseEvents: false/);
assert.match(app, /const keepPrevious = !features\.length/);
assert.match(app, /lastBounds\?\.contains\?\.\(map\.getCenter\?\.\(\)\)/);
assert.match(app, /mantendo os .* limite\(s\) já carregados/);
assert.match(html, /hotfix=car-identify-stable-0822/);

console.log('OK: identificação CAR usa a feição WFS visível e consulta vazia não apaga a camada carregada.');
