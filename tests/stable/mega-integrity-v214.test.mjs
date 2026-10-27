import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

function runBrowserModule(file, extra = {}) {
  const code = fs.readFileSync(file, 'utf8');
  const window = { ...extra.window };
  const { window: _ignoredWindow, ...rest } = extra;
  const context = vm.createContext({ window, console, structuredClone: globalThis.structuredClone, ...rest });
  vm.runInContext(code, context, { filename: file });
  return window;
}

{
  const window = runBrowserModule('assets/js/features/mapa/coordinates.js');
  const c = window.SurveyorCoordinates;
  assert.equal(c.parseFlexibleNumber('500,250'), 500.25);
  assert.equal(c.parseFlexibleNumber('120,450'), 120.45);
  assert.equal(c.parseFlexibleNumber('100.000,25'), 100000.25);
  assert.equal(c.parseProjectedNumber('434634,250'), 434634.25);
  assert.equal(c.parseProjectedNumber('8.559.272,125'), 8559272.125);
  assert.deepEqual({ ...c.epsgToUtmContext(31978) }, { zone: 18, hemisphere: 'S', datum: 'SIRGAS2000', label: 'SIRGAS 2000 / UTM 18S' });
  assert.deepEqual({ ...c.epsgToUtmContext(29195) }, { zone: 25, hemisphere: 'S', datum: 'SAD69', label: 'SAD69 / UTM 25S' });
}

{
  const defs = new Map();
  function proj4(from, to, pair) { if (arguments.length === 3) return [pair[0] + 1, pair[1] + 1]; return pair; }
  proj4.defs = (code, definition) => defs.set(code, definition);
  const window = runBrowserModule('assets/js/features/mapa/crs.js', { window: { proj4 } });
  const crs = window.GeoRuralCRS;
  for (let zone = 18; zone <= 25; zone += 1) {
    assert.ok(crs.supportedCrs.includes(`EPSG:${31960 + zone}`));
    assert.ok(crs.supportedCrs.includes(`EPSG:${32700 + zone}`));
    assert.ok(crs.supportedCrs.includes(`EPSG:${29170 + zone}`));
  }
  assert.equal(crs.normalizeCode('EPSG:31978'), 'EPSG:31978');
  assert.equal(crs.normalizeCode('EPSG:29195'), 'EPSG:29195');
  assert.equal(crs.sirgas2000UtmCodeForLngLat(-60, -10), 'EPSG:31981');
}

{
  const window = runBrowserModule('assets/js/features/mapa/geometry-math.js', { turf: {} });
  const g = window.SurveyorGeometryMath;
  const open = { geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1]]] } };
  const closed = { geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } };
  assert.equal(g.geomOuterCoords(open).length, 3, 'polígono aberto não pode perder vértice legítimo');
  assert.equal(g.geomOuterCoords(closed).length, 3, 'anel fechado deve remover somente o ponto repetido');
}

{
  const propertyExport = fs.readFileSync('assets/js/features/mapa/property-export.js','utf8');
  const mapApp = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
  assert.match(propertyExport, /LWPOLYLINE/);
  assert.match(propertyExport, /SIRGAS 2000 \/ UTM zona/);
  assert.doesNotMatch(propertyExport, /111320\s*\*/);
  assert.match(mapApp, /return surveyorDxf\(collection\(\)\.features/);
  assert.doesNotMatch(mapApp, /function lonLatToLocalMeters/);
}

{
  const api = fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
  assert.match(api, /createHash\('sha256'\).*surveyor-public-project:v3/s);
  assert.match(api, /publicShortIndexFileId/);
  assert.match(api, /readPublicShortIndex/);
  assert.match(api, /createFile\(bucket, `public-short-/);
}

{
  const worker = fs.readFileSync('deploy/cloudflare-geoservices/src/worker.js','utf8');
  assert.doesNotMatch(worker, /access-control-allow-origin': '\*'/);
  assert.match(worker, /DEFAULT_ALLOWED_ORIGINS/);
  assert.match(worker, /SURVEYOR_ALLOWED_ORIGINS/);
}

{
  const mapApp = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
  assert.match(mapApp, /function disposeCatalogPreview\(\)/);
  assert.match(mapApp, /clearTimeout\(catalogPreviewTimer\)/);
  assert.match(mapApp, /catalogMiniMapInstance\?\.remove/);
  assert.match(mapApp, /addEventListener\('cancel', disposeCatalogPreview\)/);
}

{
  for (const dir of fs.readdirSync('.', { withFileTypes: true })) {
    if (!dir.isDirectory() || ['dist','node_modules','.git'].includes(dir.name)) continue;
    const html = path.join(dir.name, 'index.html');
    if (!fs.existsSync(html)) continue;
    const text = fs.readFileSync(html,'utf8');
    assert.ok(!text.includes('../assets/'), `${html} ainda usa asset relativo legado`);
  }
}

console.log('PASS mega-integrity-v214: precisão geodésica, DXF, QR, CORS, lifecycle e assets consolidados.');
