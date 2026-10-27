import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const docs = fs.readFileSync('assets/js/core/document-assets.js', 'utf8');
const redirect = fs.readFileSync('assets/js/core/short-link.js', 'utf8');
const viewer = fs.readFileSync('assets/js/features/public-project/public-project.js', 'utf8');

assert.match(api, /PUBLIC_SHORT_LENGTH = 10/);
assert.match(api, /PUBLIC_SHORT_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'/);
assert.match(api, /`\/p\/\?c=\$\{encodeURIComponent\(displayPublicShortCode\(code\)\)\}`/);
assert.match(api, /normalizePublicShortCode/);
assert.match(api, /findProjectRowByShortCode/);
assert.match(api, /PUBLIC_SHORT_INACTIVE/);
assert.match(docs, /share\?\.shortUrl \|\| share\?\.publicUrl \|\| share\?\.url/);
assert.match(redirect, /params\.get\('c'\)/);
assert.match(redirect, /\{10\}/);
assert.match(viewer, /\[0-9A-HJKMNP-TV-Z\]\{10\}/);
assert.doesNotMatch(api, /project-short:v1/);
console.log('OK: V62 links públicos curtos mantêm código normalizado e resolução pública controlada.');
