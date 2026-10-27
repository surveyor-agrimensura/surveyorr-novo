const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const workspace = fs.readFileSync('assets/js/features/mapa/workspace.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(app, /function isCarDraft\(/, 'deve detectar rascunho CAR nacional antes do código completo');
assert.match(app, /SICAR_STATE_CODES/, 'deve reconhecer prefixos CAR das 27 UFs');
assert.match(app, /isCompleteCarDraft\(value\)/, 'consulta automática do CAR deve exigir código completo');
assert.match(app, /setTimeout\(async \(\) => \{[\s\S]*searchCar\(current\)/, 'CAR completo deve disparar consulta automática com debounce');
assert.match(app, /SMART_COORDINATE_FORMATS/, 'deve oferecer seletor de formatos de coordenada');
for (const id of ['dd', 'dms', 'ddm', 'utm', 'epsg']) {
  assert.ok(app.includes(`id: '${id}'`), `formato ${id} deve existir`);
}
assert.match(app, /formatSmartDms\(/, 'deve aplicar máscara DMS\/DDM');
assert.match(app, /return 'S';[\s\S]*return 'W';/, 'DMS\/DDM deve completar hemisférios S/W quando não informados');
assert.match(app, /formatSmartUtm\(/, 'deve formatar UTM sem inventar zona');
assert.match(app, /renderCoordinateFormatSuggestions\(/, 'deve abrir seletor ao detectar coordenada');
assert.match(app, /Complete a coordenada no formato selecionado/, 'entrada técnica incompleta não deve cair em busca de cidade');
assert.match(workspace, /function looksLikeCar\(value\) \{ return Boolean\(carStateCode\(value\)\)/, 'workspace deve compartilhar detecção nacional do CAR');
assert.match(css, /#svSmartSearchMode/, 'deve mostrar chip do tipo detectado');
assert.match(css, /\.sv-smart-coordinate-grid/, 'deve estilizar seletor técnico compacto');
assert.match(html, /app-v21\.9\.0\.js\?v=[A-Za-z0-9._-]+/, 'mapa deve invalidar cache do runtime sem prender o teste a uma data antiga');

console.log('OK: busca inteligente roteia CAR e orienta DD/DMS/DDM/UTM/EPSG com máscara técnica.');
