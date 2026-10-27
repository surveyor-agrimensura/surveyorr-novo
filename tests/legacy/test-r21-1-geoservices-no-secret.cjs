const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const worker = read('deploy/cloudflare-geoservices/src/worker.js');
const api = read('functions/surveyor-api/src/main.js');
const config = read('assets/js/core/api.js');
const wrangler = read('deploy/cloudflare-geoservices/wrangler.toml');

assert.match(worker, /2\.25\.1-sicar-national-r21-no-secret/);
assert.doesNotMatch(worker, /GEOSERVICES_TOKEN_SECRET/);
assert.doesNotMatch(worker, /verifyGeoServicesToken/);
assert.doesNotMatch(worker, /GeoServices authentication is not configured/);
assert.match(worker, /ALLOWED_HOSTS/);
assert.match(worker, /geoserver\.car\.gov\.br/);
assert.match(worker, /isAllowedHost/);
assert.match(worker, /Método não permitido/);
assert.doesNotMatch(api, /GEOSERVICES_TOKEN_SECRET/);
assert.doesNotMatch(api, /signGeoServicesToken/);
assert.doesNotMatch(config, /geoservicesTokenFromSession/);
assert.doesNotMatch(config, /searchParams\.set\('token'/);
assert.doesNotMatch(wrangler, /GEOSERVICES_TOKEN_SECRET/);
console.log('PASS R21.1: GeoServices voltou ao modo sem token secret, preservando allowlist de hosts oficiais.');
