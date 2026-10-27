const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/features/mapa/layers.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');

// Overlay WMS/MVT acompanha a animação de zoom e retém tiles vizinhos.
const wmsStart = app.indexOf('function wmsOptions(');
const wmsEnd = app.indexOf('function createWmsLayer(', wmsStart);
const wms = app.slice(wmsStart, wmsEnd);
assert.match(wms, /updateWhenIdle:\s*false/);
assert.match(wms, /updateWhenZooming:\s*true/);
assert.match(wms, /updateInterval:\s*120/);
assert.match(wms, /keepBuffer:\s*2/);
assert.match(app, /options\.keepBuffer = Math\.max\(2,/);
const mvtStart = app.indexOf('function buildMvtCatalogLayer(');
const mvtEnd = app.indexOf('function createResilientWmsLayer(', mvtStart);
const mvt = app.slice(mvtStart, mvtEnd);
assert.match(mvt, /keepBuffer:\s*3/);
assert.match(mvt, /updateWhenIdle:\s*false/);
assert.match(mvt, /updateWhenZooming:\s*true/);

// Preview do catálogo usa fonte real e a visão regional estável da Bahia, sem geometria mock.
const previewStart = app.indexOf('let catalogMiniMapInstance = null;');
const previewEnd = app.indexOf('function renderMapLayerCatalog()', previewStart);
const preview = app.slice(previewStart, previewEnd);
assert.doesNotMatch(preview, /sampleBahiaPolygon|L\.circleMarker\(\[-12\.5, -41\.7\]/);
assert.match(preview, /createResilientWmsLayer\(/);
assert.match(preview, /loadRemoteLayerData/);
assert.match(preview, /const regionalView = catalogStateDescriptor\(\)/);
assert.match(preview, /setView\(regionalView\.center, regionalView\.zoom/);
assert.match(preview, /Prévia real indisponível para esta camada/);
assert.match(html, /map-layer-catalog-v21\.11\.5\.css/);
assert.doesNotMatch(html, /Pré-visualização simbólica/i);

// Cotas CAD são paralelas ao segmento e não usam caixas brancas nos segmentos.
assert.match(app, /function readableCadAngle\(/);
assert.match(app, /Math\.atan2\(dy, dx\) \* 180 \/ Math\.PI/);
assert.match(app, /cadSegmentMeasureIcon/);
assert.match(app, /surveyor-cad-dimension-label/);
const glebaStart = app.indexOf('function addGlebaSegmentMeasure(');
const glebaEnd = app.indexOf('function clearGlebaFrontBackMarkers', glebaStart);
const gleba = app.slice(glebaStart, glebaEnd);
assert.doesNotMatch(gleba, /background:rgba\(255,255,255|L\.polyline\(\[extA/);
assert.match(css, /rotate\(var\(--surveyor-cad-angle,0deg\)\)/);
assert.match(css, /-webkit-text-stroke:2\.2px/);
assert.match(css, /background:transparent!important/);

// Modal compacto.
assert.match(css, /width:min\(960px,calc\(100vw - 24px\)\)/);
assert.match(css, /grid-template-columns:minmax\(0,1fr\) 265px/);
assert.match(css, /min-height:52px/);
assert.match(css, /height:168px/);

console.log('OK: GIS zoom sincronizado, preview real, modal compacto e cotas CAD validados.');
