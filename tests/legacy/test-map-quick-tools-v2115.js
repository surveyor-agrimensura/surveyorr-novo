import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('RELEASE_MANIFEST.json', 'utf8'));
const version = fs.readFileSync('VERSION', 'utf8').trim();
const html = fs.readFileSync('mapa/index.html', 'utf8');
const js = fs.readFileSync('assets/js/features/mapa/ux.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');
const apiConfig = fs.readFileSync('assets/js/core/api.js', 'utf8');

assert.equal(pkg.version, '21.11.5');
assert.equal(version, '21.11.5');
assert.equal(manifest.release, '21.11.5');
assert.equal(manifest.frontend.version, '21.11.5');
assert.equal(manifest.mapQuickTools?.enabled, true);

for (const id of ['topQuickPolygonBtn','topQuickMarkPointBtn','mapQuickToolsToggle','mapQuickToolsDrawer','mapQuickToolsGrid']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Controle rápido ausente: ${id}`);
}
assert.match(html, /surveyor-map-current-v21\.11\.5\.css\?v=21\.11\.5-clean-current/);
assert.match(html, /map-ux-v21\.11\.5\.js\?v=21\.11\.5[a-z]?(?:-[^\"']+)?/);
assert.match(js, /const SURVEYOR_MAP_UX_VERSION = '21\.11\.5[a-z]?'/);
assert.match(js, /function bindQuickTools\(/);
assert.match(js, /function quickToolDefinitions\(/);
assert.match(js, /\[data-draw-tool="polygon"\]/);
assert.doesNotMatch(js, /\$\('markGpsPointBtn'\)\?\.click\(\)/);
assert.match(js, /launchers = \[\$\('markGpsPointBtn'\), \$\('topQuickMarkPointBtn'\)\]/);
assert.match(js, /if \(item\.selector === '#markGpsPointBtn'\) \{[\s\S]*openGpsPanel\(\)/);
assert.match(js, /setQuickToolsDrawerOpen/);
assert.match(css, /\.map-quick-tools-anchor/);
assert.match(css, /\.map-quick-tools-drawer/);
assert.match(css, /\.map-quick-tools-grid/);
assert.match(apiConfig, /21\.11\.5-map-ui/);

console.log('OK: Surveyor v21.11.5 — barra rápida superior, ferramentas principais e gaveta expansível validadas.');
