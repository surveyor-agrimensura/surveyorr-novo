const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const api = read('functions/surveyor-api/src/main.js');
const save = read('functions/surveyor-save/src/main.js');
const auth = read('assets/js/core/auth.js');
const config = read('assets/js/core/api.js');
const worker = read('deploy/cloudflare-geoservices/src/worker.js');

const authFn = api.match(/async function authFromRequest\(request\) \{([\s\S]*?)\n\}/)?.[1] || '';
assert.ok(authFn, 'authFromRequest deve existir');
assert.match(authFn, /verifyJwtType\(token, 'access'/, 'requisições protegidas devem validar JWT de acesso');
assert.doesNotMatch(authFn, /findProfileForLogin|getAppwriteUserById|appwriteRequest/, 'authFromRequest não deve consultar Appwrite a cada requisição');
assert.match(authFn, /payload\.user/, 'autorização normal deve usar snapshot de usuário assinado');

assert.match(api, /function accessTokenTtlSeconds\(/);
assert.match(api, /Math\.min\(maxTtl, seconds\)/, 'TTL deve ser limitado pela expiração da assinatura');
assert.match(api, /function issueAccessToken\(/);
assert.match(api, /resourceOwnerUserId/);
assert.match(api, /workspace/);

const refreshBlock = api.match(/if \(path === '\/api\/auth\/refresh'[\s\S]*?(?=\n\s*if \(path === '\/api\/auth\/logout')/)?.[0] || '';
assert.ok(refreshBlock, 'rota de refresh deve existir');
assert.match(refreshBlock, /loadRefreshSession|resolveEffectiveUser|findProfile|getAppwriteUser|rotate/i, 'refresh deve continuar revalidando estado no backend/Appwrite');

assert.doesNotMatch(save, /\/api\/auth\/me/, 'Save Function não deve consultar /api/auth/me');
assert.match(save, /function validateAccessToken\(/);
assert.match(save, /createHmac\('sha256', jwtSecret\(\)\)/);
assert.match(save, /timingSafeEqual/);
assert.match(save, /PLAN_EXPIRED/);

assert.doesNotMatch(auth, /authEndpoint\}\/me|\/api\/auth\/me/, 'watch de sessão do frontend não deve consultar /api/auth/me');
assert.match(auth, /SESSION_WATCH_VISIBLE_MS = 60_000/);
assert.match(auth, /SESSION_WATCH_HIDDEN_MS = 5 \* 60_000/);
assert.match(auth, /accessTokenExpiresSoon/);
assert.match(config, /GEORURAL_SECURE_GEOSERVICES_URL/);
assert.match(config, /GEORURAL_SECURE_GEOSERVICES_URL/);

assert.match(worker, /2\.25\.1-sicar-national-r21-no-secret/);
assert.doesNotMatch(worker, /GEOSERVICES_TOKEN_SECRET|verifyGeoServicesToken|geoservices:proxy/);
assert.match(worker, /isAllowedHost/);
assert.match(worker, /ALLOWED_HOSTS/);

for (const slug of ['basic_annual','plus_annual','pro_annual']) {
  const block = api.match(new RegExp(`id: '${slug}'[\\s\\S]*?permissions:`))?.[0] || '';
  assert.match(block, /active:\s*true/, `${slug} deve estar ativo`);
}
for (const slug of ['basic_monthly','plus_monthly','pro_monthly']) {
  const block = api.match(new RegExp(`id: '${slug}'[\\s\\S]*?permissions:`))?.[0] || '';
  assert.match(block, /active:\s*false/, `${slug} deve permanecer legado/inativo`);
}

const removed = [
  'assets/js/features/mapas/maps-v21.9.3.js',
  'assets/js/features/mapa/map-ux-v21.11.2.js',
  'assets/js/features/mapa/map-ux-v21.11.3.js',
  'assets/js/features/mapa/map-ux-v21.11.4.js',
  'assets/css/features/mapa/map-ux-v21.11.2.css',
  'assets/css/features/mapa/map-ux-v21.11.3.css',
  'assets/css/features/mapa/map-ux-v21.11.4.css',
  'tests/test-map-ux-v2112.js',
  'tests/test-map-ux-v2113.js',
  'tests/test-map-ux-v2114.js'
];
for (const rel of removed) assert.equal(exists(rel), false, `resíduo legado deve estar removido: ${rel}`);

console.log('PASS R19/R21.1: sessão por snapshot assinado, Save JWT local, GeoServices por allowlist sem secret, planos anuais e limpeza legado validados.');
