const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const support = read('functions/surveyor-support/src/main.js');
assert.match(support, /const safePageHtml = escapeHtml\(page\);/);
assert.match(support, /const safeUserAgentHtml = escapeHtml\(userAgent\);/);
assert.match(support, /<strong>Página:<\/strong> \$\{safePageHtml\}/);
assert.match(support, /User-Agent: \$\{safeUserAgentHtml\}/);

const geoservices = read('functions/surveyor-geoservices/src/main.js');
assert.match(geoservices, /GEOSERVICES_RATE_WINDOW_MS/);
assert.match(geoservices, /GEOSERVICES_RATE_LIMIT/);
assert.match(geoservices, /retryAfterSeconds/);
assert.match(geoservices, /const OGC_ALLOWED_PARAMS = \{/);
assert.match(geoservices, /wmts: new Set\(/);
assert.match(geoservices, /function sanitizeOgcUpstream\(/);
assert.match(geoservices, /Porta upstream não autorizada/);
assert.match(geoservices, /redirect: 'manual'/);
assert.match(geoservices, /const nextUrl = new URL\(location, url\);[\s\S]{0,120}assertAllowed\(nextUrl\);/);
assert.match(geoservices, /SLD_BODY contém recurso externo/);
assert.match(geoservices, /CQL_FILTER contém referência externa/);
assert.match(geoservices, /Retry-After/);

const api = read('functions/surveyor-api/src/main.js');
assert.match(api, /const APPWRITE_DATE_FIELD_PATTERN = \/\(\?:At\|Date\|Until\)\$\/i/);
assert.match(api, /function toStrictIsoUtc\(/);
assert.match(api, /return new Date\(timestamp\)\.toISOString\(\);/);
assert.match(api, /normalizeAppwriteDateFields\(data\)/);
assert.match(api, /ALLOW_LEGACY_INTEGER_DATE_SCHEMA/);

const save = read('functions/surveyor-save/src/main.js');
assert.match(save, /function validateAccessToken\(accessToken\)/);
assert.match(save, /crypto\.createHmac\('sha256', jwtSecret\(\)\)/);
assert.match(save, /payload\?\.iss !== 'surveyor-appwrite-function'/);
assert.match(save, /payload\?\.type !== 'access'/);
assert.doesNotMatch(save, /\/api\/auth\/me/);
assert.match(save, /JWT_SECRET não configurado na Save Function/);

console.log('OK: hardening unificado de support, GeoServices, datas e save validado.');
