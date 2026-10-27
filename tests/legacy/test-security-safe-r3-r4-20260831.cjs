const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const api = read('functions/surveyor-api/src/main.js');
const auth = read('assets/js/core/auth.js');
const loginPage = read('assets/js/core/login.js');
const firstAccess = read('assets/js/core/first-access.js');
const adminLegacy = read('assets/js/admin/app.js');
const adminOrg = read('assets/js/admin/organization.js');
const adminHtml = read('admin/index.html');
const sw = read('sw.js');
const apiPkg = JSON.parse(read('functions/surveyor-api/package.json'));
const rootPkg = JSON.parse(read('package.json'));

assert(api.includes("const APP_VERSION = '2.26.9-security-safe-r3-r4'"), 'API R3+R4 não versionada');
assert.strictEqual(apiPkg.version, rootPkg.version, 'package da API deve seguir a versão central da release');
assert.strictEqual(apiPkg.surveyorRelease, rootPkg.version, 'surveyorRelease da API deve seguir a release raiz');

// Login: exatamente 3 erros, mensagens progressivas e bloqueio por cinco horas.
assert(/LOGIN_ACCOUNT_LOCK_ATTEMPTS = 3/.test(api), 'limite de tentativas deixou de ser 3');
assert(/LOGIN_ACCOUNT_LOCK_MS = 5 \* 60 \* 60 \* 1000/.test(api), 'bloqueio deixou de ser 5 horas');
assert(/Senha incorreta\. Você só tem \$\{remainingAttempts\} \$\{attemptWord\}\./.test(api), 'mensagem dinâmica de tentativas restantes ausente');
assert(/remainingAttempts === 1 \? 'tentativa restante' : 'tentativas restantes'/.test(api), 'singular/plural das tentativas ausente');
assert(/Suas tentativas se esgotaram[\s\S]*login foi bloqueado por 5 horas/.test(api), 'mensagem final de bloqueio ausente');
assert(/code: 'INVALID_CREDENTIALS', failedAttempts, remainingAttempts/.test(api), '401 não carrega tentativas restantes');
assert(/ACCOUNT_TEMPORARILY_LOCKED[\s\S]*remainingAttempts: 0/.test(api), '429 de bloqueio não zera tentativas');
assert(/'remainingAttempts'/.test(api), 'detalhe seguro remainingAttempts não é enviado ao cliente');
assert(/status === 429 && code === 'ACCOUNT_TEMPORARILY_LOCKED'/.test(auth), 'frontend troca mensagem de bloqueio por 429 genérico');
assert(/code === 'INVALID_CREDENTIALS'[\s\S]*remainingAttempts/.test(auth), 'frontend não preserva aviso de tentativas restantes');

// Tokens transitórios: produção usa cookie HttpOnly; fallback de desenvolvimento permanece compatível.
for (const cookie of [
  '__Secure-surveyor_login_verify',
  '__Secure-surveyor_first_access',
  '__Secure-surveyor_password_reset',
  '__Secure-surveyor_password_reset_auth'
]) assert(api.includes(cookie), `cookie transitório ausente: ${cookie}`);
assert(/function secureAuthCookieHeader/.test(api), 'helper de cookie seguro ausente');
assert(/HttpOnly/.test(api) && /Secure/.test(api) && /SameSite=Strict/.test(api), 'cookies de autenticação sem flags seguras');
assert(/function transientAuthDelivery/.test(api), 'entrega transitória server-side ausente');
assert(/function transientAuthTokenFromRequest/.test(api), 'leitura de token transitório por cookie ausente');
assert(/verificationCookie/.test(auth) && /firstAccessCookie/.test(auth), 'frontend não entende cookies transitórios');
assert(/credentials: 'include'/.test(auth), 'fetch autenticado não envia/recebe cookies cross-origin');
assert(/'Access-Control-Allow-Credentials': 'true'/.test(api), 'API não permite credenciais CORS para cookies HttpOnly');
assert(/resetAuthorizationCookie/.test(auth), 'reset de senha não entende autorização em cookie');
assert(/lastLoginVerificationJti/.test(api) && /LOGIN_VERIFICATION_ALREADY_USED/.test(api), 'código de verificação de login pode ser reutilizado');
assert(/lastPasswordResetAuthorizationJti/.test(api) && /RESET_AUTHORIZATION_USED/.test(api), 'autorização de reset pode ser reutilizada');
assert(/cookie: result\.firstAccessCookie === true/.test(loginPage), 'primeiro acesso ainda exige JWT transitório no sessionStorage em produção');
assert(/!payload\?\.token && payload\?\.cookie !== true/.test(firstAccess), 'página de primeiro acesso não aceita fluxo HttpOnly');

// Auditoria: metadados sensíveis redigidos e eventos assinados usando segredo já existente.
assert(/const AUDIT_REDACT_KEY/.test(api), 'redação de auditoria ausente');
assert(/function redactAuditMetadata/.test(api), 'sanitização recursiva de auditoria ausente');
assert(/function signAuditEventIntegrity/.test(api), 'assinatura HMAC de auditoria ausente');
assert(/crypto\.createHmac\('sha256', jwtSecret\(\)\)/.test(api), 'integridade de auditoria não usa HMAC SHA-256 com segredo existente');
assert(/function auditIntegrityStatus/.test(api), 'verificação de integridade de auditoria ausente');
assert((api.match(/const integrity = \{/g) || []).length >= 2 && /verified: .*integrityStatus === 'verified'/.test(api) && /legacy: .*integrityStatus === 'legacy'/.test(api) && /invalid: .*integrityStatus === 'invalid'/.test(api), 'API admin não resume integridade dos logs');
assert(adminHtml.includes('auditIntegrityBanner'), 'Admin sem indicador de integridade');
assert(/integrity/.test(adminOrg), 'Admin não renderiza integridade de auditoria');

// Mutações autenticadas exigem origem confiável; endpoints sensíveis não são cacheados.
assert(/\['POST', 'PUT', 'PATCH', 'DELETE'\]\.includes\(httpMethod\)\) assertTrustedMutationOrigin\(request\)/.test(api), 'mutações autenticadas sem gate de origem');
assert(/function sensitiveApiNoStoreHeaders/.test(api), 'headers no-store de APIs sensíveis ausentes');
assert(/frame-ancestors 'none'/.test(api), 'CSP defensiva da API ausente');

// Admin: sessão não expõe sessionVersion e loader legado não duplica o painel organizado.
const sessionRoute = api.match(/if \(path === '\/api\/admin\/sessions'[\s\S]*?\n  }/);
assert(sessionRoute, 'rota admin sessions ausente');
assert(!/sessionVersion\s*:/.test(sessionRoute[0]), 'sessionVersion interno ainda é exposto na rota de sessões');
assert(/activeRefreshSessionCount/.test(sessionRoute[0]), 'resumo seguro de sessões ausente');
assert(/document\.querySelector\('\.admin-security-organized'\)\) return/.test(adminLegacy), 'loader legado ainda duplica painel de segurança');
assert(adminHtml.includes('Segurança e sessões'), 'aba de segurança não foi consolidada');

// Cache bust obrigatório para os JS de autenticação alterados.
assert(sw.includes('21.11.5-security-safe-r3-r4-20260831'), 'Service Worker sem versão R3+R4');
for (const file of ['login/index.html', 'primeiro-acesso/index.html', 'admin/index.html']) {
  const html = read(file);
  assert(html.includes('20260831-security-safe-r34'), `cache-bust R3+R4 ausente em ${file}`);
}

console.log('✓ Security Safe R3+R4: login progressivo, cookies HttpOnly, auditoria, CSRF/origin e Admin validados');
