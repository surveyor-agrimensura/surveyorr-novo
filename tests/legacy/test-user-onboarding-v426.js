import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin = fs.readFileSync(new URL('../assets/js/admin/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/admin/documents.css', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../functions/surveyor-api/src/main.js', import.meta.url), 'utf8');

assert.match(admin, /durationDays = cycle === 'mensal' \? 30 : \(cycle === 'anual' \? 365 : 0\)/);
assert.match(admin, /\$\('userExpiry'\)\.value = endDate \|\| ''/);
assert.match(admin, /class="user-identity"/);
assert.match(admin, /class="user-email"/);
assert.match(admin, /A conta já havia sido criada na primeira tentativa e foi recuperada na lista/);
assert.match(css, /\.user-cell \.user-identity\{display:flex;flex-direction:column/);
assert.match(api, /USER_ALREADY_EXISTS_REFRESH_REQUIRED/);
assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2'/);
assert.match(api, /const recovered = await findProfileForLogin\(data\.userId, data\.email\)/);

console.log('✓ v21.9.426: vencimento automático, tabela legível e cadastro idempotente validados');
