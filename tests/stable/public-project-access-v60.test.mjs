import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=(p)=>fs.readFileSync(p,'utf8');

const assets=read('assets/js/core/document-assets.js');
assert.ok(assets.includes("return 'https://surveyorr.com.br'"),'QR/link deve usar origem pública oficial fora do domínio de produção');
assert.ok(assets.includes('publicUrlFromShare'),'acesso público deve respeitar URL/token retornado pelo backend');
assert.ok(assets.includes('auth.ensureProjectPublicShort(id)'),'documentos devem resolver o acesso público pelo link curto persistente');
assert.ok(!assets.includes("auth.createProjectShare(id, { expiresInDays: 3650 })"),'documentos não devem recriar share legado antes do link curto');
assert.ok(assets.includes('await auth.refreshSession()'),'fluxo de QR deve tentar recuperar sessão expirada');

const auth=read('assets/js/core/auth.js');
assert.ok(auth.includes('idempotencyKey: `project-share-${id}`'),'criação de compartilhamento deve ser idempotente no cliente');
assert.ok(/ensureSession,\s*refreshSession,\s*checkHealth/.test(auth),'document-assets deve poder renovar a sessão pelo auth oficial');

const api=read('functions/surveyor-api/src/main.js');
assert.ok(api.includes('allowed.includes(origin) || isOfficialWebOrigin(origin) || isLocalDevelopmentOrigin(origin)'), 'CORS deve aceitar subdomínios oficiais surveyorr.com.br');
assert.ok(api.includes('configuredCorsOrigins().includes(origin) || isOfficialWebOrigin(origin) || isLocalDevelopmentOrigin(origin)'), 'mutações devem aceitar subdomínios oficiais surveyorr.com.br');

const mapas=read('assets/js/features/mapas/app.js');
assert.ok(mapas.includes("return 'https://surveyorr.com.br';"),'fallback de mapas não deve gerar QR apontando para localhost');
assert.ok(mapas.includes('share?.publicUrl || share?.url'),'mapas deve usar o link retornado pelo backend quando disponível');

console.log('PASS public-project-access-v60: link público/QR usa origem oficial, sessão recuperável e CORS correto.');
