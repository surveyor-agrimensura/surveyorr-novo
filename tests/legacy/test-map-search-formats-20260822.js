import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const workspace = fs.readFileSync('assets/js/features/mapa/workspace.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(app, /function parseUtmCoordinate\(/, 'Busca deve reconhecer coordenadas UTM');
assert.match(app, /function parseDmsCoordinate\(/, 'Busca deve reconhecer DMS\/DDM');
assert.match(app, /function parseEpsgCoordinate\(/, 'Busca deve reconhecer EPSG');
assert.match(app, /31977.*31985/, 'Busca deve aceitar SIRGAS 2000 \/ UTM');
assert.match(app, /32701.*32760/, 'Busca deve aceitar WGS84 UTM sul');
assert.match(app, /32601.*32660/, 'Busca deve aceitar WGS84 UTM norte');
assert.match(app, /EPSG:3857/, 'Busca deve aceitar Web Mercator EPSG:3857');
assert.match(app, /parseUtmCoordinate\(raw\)/, 'Parser unificado deve tentar UTM antes de graus decimais');
assert.match(app, /parseDmsCoordinate\(raw\)/, 'Parser unificado deve tentar DMS antes de graus decimais');
assert.match(workspace, /Cidade, CAR, UTM ou coordenadas/, 'Placeholder deve indicar busca UTM');
assert.match(workspace, /DMS\/DDM/, 'Ajuda da busca deve citar DMS\/DDM');
assert.match(html, /map-workspace-clean-v21\.11\.5\.js\?v=[^"']+/, 'Mapa deve usar cache-busting versionado da busca ampliada');
console.log('OK: busca do mapa aceita cidade, CAR, DD, DMS\/DDM, UTM e EPSG.');
