const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
const api = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'functions/surveyor-api/package.json'), 'utf8'));
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const apiVersion = (api.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';
assert(/^2\.26\.\d+-security-safe-r\d+(?:-r\d+)?$/i.test(apiVersion), 'versão Security Safe compatível com R1 ausente');
assert.strictEqual(pkg.version, rootPkg.version, 'package da API deve seguir a versão central da release');
assert.strictEqual(pkg.surveyorRelease, rootPkg.version, 'surveyorRelease da API deve seguir a release raiz');

// Login público do Appwrite: o helper de Account não pode receber chave administrativa.
const publicFetch = api.match(/async function awPublicAccountFetch[\s\S]*?\n}\n\nasync function createEmailSession/);
assert(publicFetch, 'awPublicAccountFetch ausente');
assert(!/X-Appwrite-Key/.test(publicFetch[0]), 'login público ainda injeta X-Appwrite-Key');
assert(/return awPublicAccountFetch\('\/account\/sessions\/email'/.test(api), 'createEmailSession não usa helper público');

// Bloqueio: 3 falhas genuínas dentro da janela => 5 horas.
assert(/LOGIN_ACCOUNT_LOCK_MS = 5 \* 60 \* 60 \* 1000/.test(api), 'bloqueio não é 5h');
assert(/LOGIN_ACCOUNT_LOCK_ATTEMPTS = 3/.test(api), 'bloqueio não é após 3 erros');
assert(/loginLocks: store\.loginLocks/.test(api), 'readSystemSecurityStore não lê loginLocks');
assert(/loginLocks: compactLoginLocks\(store\.loginLocks\)/.test(api), 'saveSystemSecurityStore não persiste loginLocks');
assert(/isInvalidLoginCredentialError\(error\)/.test(api), 'erros de infraestrutura podem estar sendo contados como senha errada');
assert(/login_upstream_error/.test(api), 'auditoria de falha upstream ausente');

// Rate limit não pode derrubar autenticação por falha do storage.
assert(/usando fallback local/.test(api), 'fallback local do rate limit ausente');
assert(!/throw statusError\(503, 'Proteção de segurança temporariamente indisponível/.test(api), 'rate limit ainda tem fail-closed 503');
assert(/assertGeneralApiRateLimit\(request, path, httpMethod\)/.test(api), 'rate limit geral da API ausente');

// Autorização comercial no backend.
assert(/function requirePermission\(auth/.test(api), 'requirePermission backend ausente');
assert(/requirePermission\(auth, 'projects:create'\)/.test(api), 'criação de projeto sem gate de plano');
assert(/requirePermission\(auth, 'projects:trash'/.test(api), 'lixeira de projeto sem gate Pro');
assert(/requirePermission\(auth, 'projects:lock'/.test(api), 'lock de projeto sem gate Pro');
assert(/requirePermission\(auth, 'projects:version-full'/.test(api), 'versões sem gate Pro');
assert(/requirePermission\(auth, 'sharing:readonly'/.test(api), 'compartilhamento sem gate Plus');
assert(/requirePermission\(auth, 'cloud:access'/.test(api), 'documentos/cloud sem gate server-side');
assert(/userAllowedForLayer\(publicLayer, auth\)/.test(api), 'rota direta de dados da camada ignora allowedPlans');

// Sessão/revogação continuam server-side.
assert(/assertTokenNotRemotelyRevoked/.test(api), 'revogação remota de sessão ausente');
assert(/sessionVersion/.test(api), 'sessionVersion ausente');
assert(/__Secure-surveyor_refresh/.test(api), 'refresh cookie oficial ausente');
assert(/HttpOnly/.test(api), 'refresh cookie sem HttpOnly');


const save = fs.readFileSync(path.join(root, 'functions/surveyor-save/src/main.js'), 'utf8');
const saveVersion = (save.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';
assert(/^2\.2\.\d+-security-safe-r\d+(?:-r\d+)?$/i.test(saveVersion), 'Save Function regrediu abaixo da Safe R1');
assert(/assertSaveRateLimit\(request\)/.test(save), 'Save Function sem rate limit de rajada');
assert(/validateAccessToken\(transport\.accessToken\)/.test(save), 'Save Function deixou de validar token no backend');

console.log('✓ Security Safe R1: contratos críticos validados');
