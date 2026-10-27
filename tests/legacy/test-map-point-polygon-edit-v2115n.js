import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('assets/js/features/mapa/controls.js', 'utf8');
const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(runtime, /if \(points\.length >= 3\) \{[\s\S]*?addPolygonFromImportedPoints\(points/);
assert.match(runtime, /Para 1–2 pontos, mantém os alfinetes/);
assert.match(runtime, /Polígono gerado e pronto para editar no lápis/);
assert.match(app, /L\.polygon\(normalized, \{ \.\.\.surveyorFinalStyle\('perimetro'\), interactive: true, bubblingMouseEvents: false \}\)/);
assert.match(app, /editableImportedPolygon: true/);
assert.match(app, /new L\.EditToolbar\.Edit\(map, \{[\s\S]*?featureGroup: drawn/);
assert.match(html, /21\.11\.5n-editable-import/);

console.log('OK: v21.11.5n — importação com perímetro remove alfinetes e gera polígono real editável pelo lápis.');
