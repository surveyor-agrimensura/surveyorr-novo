import assert from 'node:assert/strict';
import fs from 'node:fs';

const docs = fs.readFileSync('assets/js/core/document-assets.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');

assert.ok(auth.includes('ensureProjectPublicShort'), 'cliente deve ativar link curto persistente');
assert.ok(auth.includes('/public-short'), 'cliente deve usar a rota dedicada de link curto');
assert.ok(docs.includes("reason: 'PUBLIC_SHORT'"), 'documentos devem usar o link curto persistente como caminho principal');
assert.ok(docs.includes('auth.ensureProjectPublicShort(id)'), 'documentos devem ativar o link curto antes de qualquer URL longa');
assert.ok(api.includes("subRoute === 'public-short'"), 'backend deve expor ativação autenticada do link curto');
assert.ok(api.includes('metadata.publicShortEnabled'), 'backend deve persistir a ativação pública curta');
assert.ok(api.includes("code: 'PUBLIC_SHORT_INACTIVE'"), 'rota pública deve negar código não ativado');
assert.ok(api.includes('syntheticShare'), 'rota curta deve servir projeto ativado mesmo sem secureShare');

console.log('PASS V63: documentos usam link curto persistente mesmo quando secureShares falha.');
