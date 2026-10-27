import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime = fs.readFileSync('assets/js/core/ui.js', 'utf8');
const mapHtml = fs.readFileSync('mapa/index.html', 'utf8');
const mapJs = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');

assert.doesNotMatch(runtime, /\['\/earth-3d','earth-3d','Earth 3D'/);
assert.doesNotMatch(mapHtml, /id="earthExploreBtn"/);
assert.match(mapJs, /const featureCarHtml = sourceFeatureHasProps/);
assert.match(mapJs, /fetchConfiguredPropertyLayerEnrichment\(sourceLayer, latlng\)/);
assert.match(mapJs, /fetchSicarCarWfsHtml\(latlng\)/);
assert.match(mapJs, /fetchCarWfsEnrichment\(latlng\)/);
assert.match(mapJs, /fetchCarArcgisEnrichment\(latlng\)/);
assert.doesNotMatch(mapJs, /geometryOnlyFeature/);
assert.match(mapJs, /autoPan: false/);
console.log('OK: Earth 3D removido dos menus de ferramentas e CAR usa atributos da feição/camadas oficiais sem JSONL.');
