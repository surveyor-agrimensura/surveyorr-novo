import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const ux = fs.readFileSync('assets/js/features/mapa/ux.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

const identifyStart = app.indexOf('async function identifyRuralRegistriesAt');
const identifyEnd = app.indexOf('async function identifyVisibleWmsAt', identifyStart);
const identify = app.slice(identifyStart, identifyEnd);

assert.match(app, /function sicarPropertyVisibleWfsUrls\(layer = null\)/);
assert.match(app, /configuredWmsLayerName\(layer\) \|\| OFFICIAL_PROPERTY_BOUNDARY_LAYER/);
assert.match(app, /geoserviceEncodedProxyUrls\(upstream\.toString\(\), 'wfs'\)/);
assert.match(app, /geobahia-property-wfs/);
assert.match(app, /GeoBahia\/INEMA/);
assert.doesNotMatch(identify, /fetchCarWfsEnrichment/);
assert.doesNotMatch(identify, /fetchCarArcgisEnrichment/);
assert.doesNotMatch(identify, /fetchSicarCarWfsHtml/);
assert.doesNotMatch(identify, /fetchCarBahiaFeatureInfo/);
assert.match(identify, /context\?\.feature\?\.properties/);
assert.match(app, /nome_posseiro/);
assert.match(app, /nome_ocupante/);
assert.match(app, /nome_beneficiario/);
assert.match(app, /const requestedOpacity = Number\(styleOrPref\?\.opacity\)/);
assert.match(app, /persistLiveCatalogPreference/);
assert.match(app, /existing\?\.leafletLayer\?\.__georuralPropertyBoundary/);
assert.match(ux, /resetBearing\(\{ immediate: true \}\)/);
assert.match(ux, /style\.setProperty\('transition', 'none', 'important'\)/);
assert.match(ux, /SurveyorMapOrientation/);
assert.match(app, /SurveyorMapOrientation\?\.resetForEditing/);
assert.match(html, /car-layer-only-rotation-opacity-0822/);

console.log('OK: CAR/CEFIR usa somente a camada no Mapa, SIGEF aceita proprietário, opacidade é estável e desenho zera rotação sem transição.');
