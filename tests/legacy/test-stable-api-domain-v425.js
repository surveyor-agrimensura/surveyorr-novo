import assert from 'node:assert/strict';
import fs from 'node:fs';

const official = 'https://api.surveyorr.com.br';
const deprecated = '6a6e42720018b34a10f7.nyc.appwrite.run';
const apiConfig = fs.readFileSync('assets/js/core/api.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const envRoot = fs.readFileSync('config/.env.example', 'utf8');
const envApi = fs.readFileSync('functions/surveyor-api/.env.example', 'utf8');

assert.ok(apiConfig.includes(`api: '${official}'`), 'assets/js/core/api.js não usa o domínio oficial da API.');
assert.ok(auth.includes(`apiBaseUrl: '${official}'`), 'assets/js/core/auth.js não usa o fallback oficial da API.');
assert.ok(envRoot.includes(`${official}/api/integrations/google-drive/callback`), 'Callback Google Drive raiz não foi atualizado.');
assert.ok(envApi.includes(`${official}/api/integrations/google-drive/callback`), 'Callback Google Drive da Function não foi atualizado.');
for (const [name, content] of Object.entries({ apiConfig, auth, envRoot, envApi })) {
  assert.equal(content.includes(deprecated), false, `${name} ainda contém o domínio automático antigo.`);
}
console.log('OK v21.9.426: domínio permanente api.surveyorr.com.br aplicado e protegido contra regressão.');
