import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const version = read('VERSION').trim();
const exporter = read('assets/js/features/mapa/shapefile.js');
const api = read('functions/surveyor-api/src/main.js');
const support = read('functions/surveyor-support/src/main.js');
const manifest = JSON.parse(read('RELEASE_MANIFEST.json'));

assert.equal(version, '21.11.5');
assert.equal(manifest.api.version, '2.23.1-map-ux-21.11.2');
assert.equal(manifest.support.version, '1.1.0');

// Modal Shapefile compacto: menor, com lista interna rolável e cards baixos.
assert.match(exporter, /width:min\(570px,calc\(100vw - 24px\)\)/);
assert.match(exporter, /max-height:min\(660px,calc\(100vh - 24px\)\)/);
assert.match(exporter, /surveyor-shp-list\{min-height:0;overflow:auto;display:grid;gap:6px;padding:10px 18px\}/);
assert.match(exporter, /surveyor-shp-option\{[^}]*padding:8px 10px/);
assert.doesNotMatch(exporter, /width:min\(650px,100%\)/);

// Compartilhamento: senha apenas em header, KDF resistente e comparação constante.
assert.match(api, /crypto\.scryptSync/);
assert.match(api, /passwordAlgorithm: password \? 'scrypt-v1'/);
assert.match(api, /verifySharePassword/);
assert.match(api, /timingSafeEqual/);
assert.match(api, /headerValue\(request, 'x-share-password'\)/);
assert.doesNotMatch(api, /url\.searchParams\.get\('password'\)/);
assert.match(api, /assertSharePasswordRateLimit/);

// Recuperação não revela se o e-mail existe.
assert.match(api, /password_reset_unknown_email/);
assert.match(api, /Se existir uma conta para/);
assert.doesNotMatch(api, /Este e-mail não possui conta criada no sistema/);

// Endurecimento operacional.
assert.match(api, /ENABLE_DEBUG_ROUTES/);
assert.match(api, /X-Request-ID/);
assert.match(api, /X-Content-Type-Options/);
assert.match(api, /Dependência principal indisponível/);
assert.match(api, /MAX_JSON_BODY_BYTES/);
assert.match(api, /JSON inválido/);
assert.match(api, /safeDetails/);

// Function de suporte protegida contra abuso e upstream travado.
assert.match(support, /supportRateBuckets/);
assert.match(support, /SUPPORT_RATE_LIMIT_IP/);
assert.match(support, /companyWebsite/);
assert.match(support, /TURNSTILE_SECRET_KEY/);
assert.match(support, /fetchWithTimeout/);
assert.match(support, /safeSecretEqual/);
assert.match(support, /readJson\(request, 64 \* 1024\)/);
assert.match(support, /X-Request-ID/);

console.log('OK v21.10.0: modal Shapefile compacto e endurecimento adicional de segurança validados.');
