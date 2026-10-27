import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const js = fs.readFileSync(path.join(root, 'assets/js/features/consulta-car/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/consulta-car/app.css'), 'utf8');

assert.match(js, /selectedMarkerPane/);
assert.match(js, /function addSelectedMarker/);
assert.match(js, /bindTooltip\('Imóvel selecionado'/);
assert.match(js, /weight: 6/);
assert.match(js, /consulta-car-result-selected-badge/);
assert.match(css, /consulta-car-selected-marker/);
assert.match(css, /consulta-car-selected-tooltip/);
assert.match(css, /consulta-car-result-item\.active/);
console.log('OK: imóvel selecionado recebe pin, rótulo, destaque de perímetro e destaque na lista.');
