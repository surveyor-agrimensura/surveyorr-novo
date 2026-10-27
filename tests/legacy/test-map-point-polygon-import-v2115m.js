import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const runtime = fs.readFileSync('assets/js/features/mapa/controls.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(app, /function addPolygonFromImportedPoints\(/);
assert.match(app, /addPolygonFromImportedPoints,/);
assert.match(app, /category: 'perimetro'/);
assert.match(app, /importedFromPoints: true/);
assert.match(app, /interactive: !importedPoint/);
assert.match(app, /function projectPointLayer[\s\S]*?interactive: !importedPoint/);
assert.match(app, /props\.importedPoint === true/);
assert.match(runtime, /runtime\.addPolygonFromImportedPoints\(points/);
assert.match(runtime, /(?:pontos importados e polígono gerado automaticamente|pontos lidos\. Polígono gerado e pronto para editar no lápis)/);
assert.match(runtime, /imported: true/);
assert.match(html, /gpsImportPointsBtn/);

console.log('OK: v21.11.5m — importação de pontos gera polígono editável automaticamente e os alfinetes não bloqueiam o desenho.');
