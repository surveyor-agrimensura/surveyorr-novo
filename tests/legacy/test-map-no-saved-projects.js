import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('mapa/index.html', 'utf8');
const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const portal = fs.readFileSync('assets/js/core/portal.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');
const car = fs.readFileSync('car/index.html', 'utf8');
const carJs = fs.readFileSync('assets/js/features/car/app.js', 'utf8');

for (const token of ['savedProjectsToggle','savedProjectsStatus','savedProjectDetails','savedProjectsPane','loadSavedProjectOverlays','savedProjectVectorStyle']) {
  assert.doesNotMatch(html + app + css, new RegExp(token));
}
assert.doesNotMatch(html, /<span>Projetos<\/span>/);
assert.match(portal, /if \(page === 'mapa\.html'\) \{[\s\S]*setMapNav\(false\)/);
assert.match(car, /id="validateCarProject"/);
assert.match(carJs, /validateCarProject/);
assert.match(fs.readFileSync('VERSION','utf8'), /21\.11\.5/);

console.log('Mapa: projetos automáticos removidos; navegação global inicia fechada como popup e validação do CAR preservada.');
