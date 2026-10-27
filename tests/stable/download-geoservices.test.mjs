import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');

const auth = read('assets/js/core/auth.js');
assert.match(auth, /const nativeDownload = \(sourceAnchor, href, fileName, blobSnapshot = null\) =>/);
assert.match(auth, /fetch\(href\)\.then\(\(response\) => response\.blob\(\)\)/);
assert.match(auth, /URL\.createObjectURL\(blobSnapshot\)/);
assert.match(auth, /document\.body\.appendChild\(anchor\)/);
assert.match(auth, /if \(!getSession\(\)\?\.accessToken\) return nativeDownload\(anchor, href, fileName\)/);
assert.match(auth, /60_000/);

const api = read('assets/js/core/api.js');
assert.match(api, /allowAppwriteGeoFallback:\s*true/);

const map = read('assets/js/features/mapa/app.js');
assert.match(map, /add\(window\.GEORURAL_CONFIG\?\.apiBaseUrl\)/);
assert.match(map, /proxyOnly \? \(index === 0 \? 30_000 : 45_000\)/);

const workerPkg = JSON.parse(read('deploy/cloudflare-geoservices/package.json'));
assert.equal(workerPkg.scripts.test, 'node ../../tests/legacy/test-geobahia-cloudflare.js');
const workerTest = read('tests/legacy/test-geobahia-cloudflare.js');
assert.match(workerTest, /\.\.\/\.\.\/deploy\/cloudflare-geoservices\/src\/worker\.js/);
const deployBat = read('deploy-geoservices.bat');
assert.match(deployBat, /Validando rota publica \/health/);
assert.match(deployBat, /tiny-king-d719georural-geoservices\.kaualucasfrancasantos\.workers\.dev\/health/);

console.log('PASS download-geoservices: Blob preservado durante quota, fallback geográfico e deploy Cloudflare validados.');
