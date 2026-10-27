const fs = require('node:fs');
const assert = require('node:assert/strict');
const map = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const car = fs.readFileSync('assets/js/features/consulta-car/app.js', 'utf8');
const worker = fs.readFileSync('deploy/cloudflare-geoservices/src/worker.js', 'utf8');

assert.match(map, /async function fetchGeoTextWithTimeout\(url, \{ signal = null, timeoutMs = 90_000 \} = \{\}\)/);
assert.match(map, /async function fetchTextWithTimeout\(url, options = \{\}, timeoutMs = 90_000\)/);
assert.equal((map.match(/function fetchTextWithTimeout\(/g) || []).length, 1, 'não deve existir helper duplicado sobrescrevendo o timeout de 90s');
assert.match(map, /fetchIncraRegistryGetFeatureInfoResult/);
assert.match(map, /WMS GetFeatureInfo text\/html oficial/);
assert.match(map, /async function fetchIncraRegistryResult\(latlng, kind\)/);
assert.match(map, /const format = 'text\/html'/);
assert.match(map, /Accept: 'text\/html/);
assert.doesNotMatch(map, /async function fetchIncraRegistryWfsResult/);
assert.doesNotMatch(map, /const bbox = registryPointBbox\(latlng, 95\)/);
assert.match(map, /Serviço oficial retornou XML em vez de GeoJSON/);
assert.match(map, /detentor_nome: 'Proprietário \/ detentor'/);

assert.match(car, /function officialInfoProxyUrl/);
assert.match(car, /fetchOfficialSigefGetFeatureInfo/);
assert.match(car, /REQUEST', 'GetFeatureInfo'/);
assert.match(car, /INFO_FORMAT', infoFormat/);
assert.match(car, /for \(const infoFormat of \['text\/html'\]\)/);
assert.match(car, /FEATURE_COUNT', '1'/);
assert.match(car, /return fetchOfficialSigefGetFeatureInfo\(geometry\)/);
assert.doesNotMatch(car, /certificada_sigef_[^\n]+OUTPUTFORMAT/);
assert.doesNotMatch(car, /MAXFEATURES', '80'/);

assert.match(worker, /fetchWithTimeout\(url, request, timeoutMs = 90000\)/);
assert.match(worker, /fetchWithTimeout\(candidate, request, 90000\)/);
console.log('PASS: SIGEF usa somente WMS GetFeatureInfo text/html e frontend respeita timeout de 90s.');
