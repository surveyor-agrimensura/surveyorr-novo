import assert from 'node:assert/strict';
import fs from 'node:fs';

const docs = fs.readFileSync('assets/js/core/document-assets.js', 'utf8');
const shortAttempt = docs.indexOf("auth.ensureProjectPublicShort(id)");
const legacyShare = docs.indexOf("auth.getProjectShare(id)");
assert.ok(shortAttempt >= 0, 'documentos devem resolver link curto persistente');
assert.ok(legacyShare < 0 || shortAttempt < legacyShare, 'link curto deve ser resolvido antes do share legado');
assert.ok(docs.includes("reason: 'PUBLIC_SHORT_UNAVAILABLE'"), 'falha do backend curto deve ser explícita');
assert.ok(!docs.includes("return persistentShortAccess('SHARE_UNAVAILABLE'"), 'documentos não devem criar fluxo paralelo de compartilhamento');
assert.ok(docs.includes("reason: 'PUBLIC_SNAPSHOT_FALLBACK'"), 'documentos devem usar o perímetro completo quando o link curto estiver indisponível');
assert.ok(docs.includes("reason: 'PUBLIC_LOCATION_FALLBACK'"), 'fallback de ponto deve existir somente como última alternativa');
console.log('PASS V64: documentos preferem link curto e, na falha, preservam a geometria do perímetro no QR.');
