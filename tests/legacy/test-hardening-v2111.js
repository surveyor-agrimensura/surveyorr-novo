import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const save = fs.readFileSync('functions/surveyor-save/src/main.js', 'utf8');
const support = fs.readFileSync('functions/surveyor-support/src/main.js', 'utf8');
const geo = fs.readFileSync('functions/surveyor-geoservices/src/main.js', 'utf8');
const worker = fs.readFileSync('deploy/cloudflare-geoservices/src/worker.js', 'utf8');
const map = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const publicProject = fs.readFileSync('assets/js/features/public-project/public-project.js', 'utf8');
const firstAccess = [fs.readFileSync('primeiro-acesso/index.html', 'utf8'), fs.readFileSync('assets/js/core/first-access.js', 'utf8')].join('\n');
const workflow = fs.readFileSync('.github/workflows/validate-appwrite-functions.yml', 'utf8');
const wrangler = JSON.parse(fs.readFileSync('deploy/cloudflare-geoservices/package.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('RELEASE_MANIFEST.json', 'utf8'));

assert.ok(['21.11.1','21.11.2','21.11.3','21.11.4','21.11.5'].includes(manifest.release));
assert.equal(manifest.onboarding.forcedFirstPasswordChange, true);
assert.match(api, /const PASSWORD_MIN_LENGTH = Math\.max\(12/);
assert.match(api, /type:\s*'first-access-password'/);
assert.match(api, /requiresPasswordChange:\s*true/);
assert.match(api, /mustChangePassword:\s*false/); // somente após confirmar a senha definitiva
assert.match(firstAccess, /\[\^A-Za-z0-9\]/);

assert.match(api, /SHARE_NOT_FOUND_OR_REVOKED/);
assert.doesNotMatch(api, /shares\.find\(\(item\) => shareActive\(item\)\)/, 'Token revogado não pode cair em outro compartilhamento ativo.');

assert.match(map, /allowIntersection:\s*false/);
assert.match(map, /validateDirectEditGeometry/);
assert.match(map, /restoreDrawnSnapshot\(editStartSnapshot/);
assert.doesNotMatch(map.slice(map.indexOf('function beginDirectEditMode'), map.indexOf('function endDirectEditMode')), /promoteLocalReferenceLayersForEditing\(\)/);
assert.match(api, /function assertValidProjectFeatures/);
assert.ok((api.match(/assertValidProjectFeatures\(features\)/g) || []).length >= 4);

assert.match(api, /ADMIN_AI_INCLUDE_PII', 'false'/);
assert.match(api, /privacyMode:\s*includePii \? 'explicit-pii-enabled' : 'anonymized-default'/);
assert.match(api, /function safeHttpUrl/);
assert.match(api, /CUSTOMIZATION_WEBSITE_URL_INVALID/);
assert.match(api, /localHttpAllowed/);
assert.match(api, /CUSTOMIZATION_LOGO_MAX_BYTES/);
assert.match(api, /CUSTOMIZATION_SIGNATURE_MAX_BYTES/);
assert.ok(publicProject.includes("if(!/^https:\\/\\//i.test(raw))return''"));
assert.match(api, /function publicCommerceOrder/);
assert.match(api, /function maskPersonName/);
assert.match(api, /email:\s*maskEmail\(email\)/);
assert.match(api, /whatsapp:\s*maskPhone\(row\.customerWhatsapp/);

assert.match(api, /persistentRateLimitCheck\('login'/);
assert.match(api, /rateLimits: store\.rateLimits/);
assert.match(api, /persistentRateLimitCheck\('share-password'/);
assert.match(api, /recordSharePasswordRateLimitFailure/);
assert.match(api, /persistentRateLimitCheck\('password-reset-request'/);
assert.match(api, /persistentRateLimitCheck\('password-reset-verify'/);
assert.match(api, /persistentRateLimitCheck\('password-reset-confirm'/);
assert.doesNotMatch(api, /const passwordResetRateLimit = new Map/);
assert.match(api, /cf-connecting-ip[\s\S]{0,120}x-real-ip[\s\S]{0,120}x-forwarded-for/);

assert.match(api, /ALLOW_LOCAL_DEV_ORIGINS', 'false'/);
assert.match(save, /ALLOW_LOCAL_DEV_ORIGINS', 'false'/);
assert.match(support, /ALLOW_LOCAL_DEV_ORIGINS', 'false'/);
assert.match(geo, /GEOSERVICES_ALLOW_INSECURE_INEMA_HTTP \|\| 'false'/);
assert.match(geo, /GEOSERVICES_ALLOW_INSECURE_INEMA_TLS \|\| 'false'/);
assert.doesNotMatch(worker, /GEOSERVICES_ALLOW_INSECURE_HTTP \|\| 'true'/);

assert.notEqual(wrangler.devDependencies.wrangler, 'latest');
assert.match(workflow, /run:\s*npm test/);
assert.match(workflow, /npm audit --package-lock-only --audit-level=(?:high|critical)/);

console.log('OK v21.11.1: hardening crítico de autenticação, compartilhamento, geometria, CORS, privacidade, rate limit e CI validado.');
