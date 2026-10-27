import fs from 'node:fs';
import assert from 'node:assert/strict';

const mapJs = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const worker = fs.readFileSync('deploy/cloudflare-geoservices/src/worker.js', 'utf8');
const fallback = fs.readFileSync('functions/surveyor-geoservices/src/main.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(mapJs, /function fetchCarWfsEnrichment\(/);
assert.match(mapJs, /cefir_imovel_rural_limite_inema/);
assert.match(mapJs, /AREA_IMOVEL_CAR_AC_BA_GO_MT_PE_RO\/FeatureServer\/17\/query/);
assert.match(mapJs, /lim_imovel_sigef_publico_a\/FeatureServer\/10\/query/);
assert.match(mapJs, /lim_imovel_sigef_privado_a\/MapServer\/9\/query/);
assert.match(mapJs, /outFields', '\*'/);
assert.match(mapJs, /titulares/);
assert.match(mapJs, /Proprietário \/ detentor/);
assert.match(mapJs, /Código do imóvel INCRA/);
assert.match(mapJs, /fetchCarWfsEnrichment\(latlng\)/);
assert.match(mapJs, /fetchCarArcgisEnrichment\(latlng\)/);
assert.match(mapJs, /fetchSigefPamgiaEnrichment\(latlng\)/);
assert.match(worker, /pamgia\.ibama\.gov\.br/);
assert.match(worker, /geo\.infrasa\.gov\.br/);
assert.match(fallback, /pamgia\.ibama\.gov\.br/);
assert.match(fallback, /geo\.infrasa\.gov\.br/);
assert.match(html, /app-v21\.9\.0\.js\?v=(?:21\.11\.5(?:q-owner-enrichment|-car-layerdata-outline-0821)|20260822-car-layer-r1)/);

console.log('OK: v21.11.5q — consulta fundiária usa enriquecimento multi-fonte CAR/CEFIR/SIGEF e prioriza proprietário/detentor quando publicado.');
