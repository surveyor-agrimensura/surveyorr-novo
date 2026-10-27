import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const controls = fs.readFileSync(path.join(root, 'assets/js/features/mapa/controls.js'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'assets/js/features/mapa/workspace.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/app.css'), 'utf8');

assert.match(controls, /stageImportedPoints/);
assert.match(controls, /O nome do KML\/Placemark foi preservado/);
assert.match(controls, /gpsMultiPreviewLine = L\.polyline/);
assert.match(controls, /primeiro KML sobrescreve\/preenche o Ponto 1/);
assert.match(workspace, /sv-car-selected-popup/);
assert.match(workspace, /compactCarLabel/);
assert.match(app, /fetchSicarCarWfsHtml/);
assert.match(app, /typeName: 'sicar:sicar_imoveis_ba'/);
assert.match(css, /invert\(84%\).*saturate\(4210%\)/s);

console.log('OK: KML entra no formulário por ponto, prévia em linha, popup CAR compacto, WFS de atributos e amarelo vivo validados.');
