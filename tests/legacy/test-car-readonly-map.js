import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('car/index.html', 'utf8');
const js = fs.readFileSync('assets/js/features/car/app.js', 'utf8');
const css = fs.readFileSync('assets/css/core/ui.css', 'utf8');

assert.match(html, /id="openCarMap" type="button">Abrir mapa</);
assert.doesNotMatch(html, /Abrir mapa e desenhar/);
assert.match(html, /id="carMapViewerDialog"/);
assert.match(html, /Somente visualização/);
assert.match(html, /id="carReadonlyMap"/);
assert.match(html, /id="carMapLayerList"/);
assert.match(html, /data-car-basemap="satellite"[^>]*>Satélite</);
assert.match(html, /data-car-basemap="map"[^>]*>Mapa</);
assert.match(html, /id="carMapBaseStatus">Satélite</);
assert.doesNotMatch(html, /leaflet\.draw/i, 'O popup não pode carregar ferramentas de desenho');

assert.match(js, /function openReadonlyMap\(focusIndex=null\)/);
assert.match(js, /function renderReadonlyMap\(focusIndex=null\)/);
assert.match(js, /function focusReadonlyFeature\(index\)/);
assert.match(js, /function normalizeReadonlyFeature\(f\)/);
assert.match(js, /function readonlySavedStyle\(f, feature = null\)/);
assert.match(js, /parseReadonlyJson\(f\?\.geoJson/);
assert.match(js, /properties\.styleColor \|\| properties\.strokeColor/);
assert.match(js, /parseReadonlyJson\(f\?\.style\)/);
assert.match(html, /id="carReadonlyDrawingOverlay"/);
assert.match(js, /function renderReadonlyDrawingOverlay\(\)/);
assert.match(js, /function readonlyGeometryMarkup\(geometry, style, featureIndex\)/);
assert.match(js, /latLngToContainerPoint/);
assert.match(js, /case 'Polygon'/);
assert.match(js, /case 'MultiPolygon'/);
assert.doesNotMatch(js, /carReadonlyRenderer = L\.svg/);
assert.match(js, /https:\/\/mt1\.google\.com\/vt\/lyrs=s/);
assert.match(js, /https:\/\/\{s\}\.tile\.openstreetmap\.org/);
assert.match(js, /function setReadonlyBase\(mode\)/);
assert.match(js, /entry\.visible=input\.checked;renderReadonlyDrawingOverlay\(\)/);
assert.doesNotMatch(js, /carReadonlyGroup\s*=\s*L\.featureGroup/);
assert.doesNotMatch(js, /Editar no mapa/);
assert.doesNotMatch(js, /location\.href=`\/mapa\/\?project=.*module=car/);
assert.match(js, /data-feature-index/);

assert.match(css, /\.car-map-viewer-dialog/);
assert.match(css, /\.car-simple-tabs/);
assert.match(css, /#carReadonlyMap/);
assert.match(css, /\.car-map-base-switch/);
assert.match(css, /\.car-map-style-swatch/);
assert.match(css, /\.car-readonly-drawing-overlay/);
assert.match(css, /z-index:470/);
assert.match(fs.readFileSync('VERSION','utf8'), /21\.11\.5/);

console.log('Módulo CAR v21.9.373: validação restaurada e mapa somente leitura preservado.');

assert.match(html, /id="validateCarProject"/);
assert.match(html, /car-validate-project-btn/);
assert.match(js, /\$\('validateCarProject'\)\.onclick=validateProject/);
