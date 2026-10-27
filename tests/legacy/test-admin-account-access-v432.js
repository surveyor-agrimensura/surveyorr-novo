import assert from 'node:assert/strict';
import fs from 'node:fs';

const adminHtml = fs.readFileSync('admin/index.html', 'utf8');
const adminJs = fs.readFileSync('assets/js/admin/app.js', 'utf8');
const authJs = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const support = fs.readFileSync('functions/surveyor-support/src/main.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('RELEASE_MANIFEST.json', 'utf8'));

for (const id of ['generateUserPassword', 'copyUserPassword', 'openUserEmailChangeFromEditor', 'userEmailDialog', 'userEmailForm', 'emailChangeNew', 'emailChangeConfirm']) {
  assert.match(adminHtml, new RegExp(`id=["']${id}["']`), `Controle ausente no painel: ${id}`);
}
assert.match(adminHtml, /e-mail de acesso, a senha inicial e o Comprovante de Contratação/i);
assert.match(adminJs, /crypto\.getRandomValues/);
assert.match(adminJs, /creationRequestId/);
assert.match(adminJs, /initialPassword:\s*payload\.password/);
assert.match(adminJs, /emailVerified:\s*true/);
assert.match(adminJs, /data-user-action="change-email"/);
assert.match(adminJs, /openUserEmailChangeFromEditor[\s\S]*openUserEmailChange\(user\)/);
assert.doesNotMatch(adminHtml, /O número será salvo no padrão internacional/);
assert.doesNotMatch(adminHtml, /O investimento e o vencimento são calculados automaticamente/);
assert.doesNotMatch(adminHtml, /Confirme o pagamento fora do sistema/);
assert.match(authJs, /async function updateUserEmail/);
assert.match(authJs, /method:\s*'POST'/);
assert.match(authJs, /method:\s*'PATCH'/);
assert.match(authJs, /\/users\/\$\{encodeURIComponent\(userId\)\}\/email/);

assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2'/);
assert.match(api, /async function updateAppwriteUserEmail/);
assert.match(api, /\['POST', 'PATCH'\]\.includes\(httpMethod\)/);
assert.match(api, /async function fetchWithTimeout/);
assert.match(api, /Cache-Control, Pragma/);
assert.match(api, /\/api\/admin\/users\\\/\(\[\^\/\]\+\)\\\/email|adminUserEmailMatch/);
assert.match(api, /EMAIL_ALREADY_IN_USE/);
assert.match(api, /EMAIL_CHANGE_ROLLED_BACK/);
assert.match(api, /preservedUserId/);
assert.match(api, /user_login_email_changed/);
assert.match(api, /adminCreationRequestId/);
assert.match(api, /ONBOARDING_EMAIL_REQUIRED/);
assert.match(api, /initialPassword:\s*String\(input\.password/);
assert.match(api, /mustChangePassword:\s*true/);
assert.match(api, /type:\s*'first-access-password'/);

assert.match(support, /Senha inicial:/);
assert.match(support, /send-account-email-changed/);
assert.match(support, /A senha da conta continua a mesma/);
assert.doesNotMatch(support.slice(support.indexOf('function buildPlanDocumentEmail'), support.indexOf('function buildAccountEmailChangedEmail')), /escapeHtml\(roleLabel\)/);

assert.equal(manifest.release, '21.11.5');
assert.equal(manifest.onboarding.passwordSentByEmail, true);
assert.equal(manifest.onboarding.forcedFirstPasswordChange, true);
assert.equal(manifest.adminAccountManagement.changeLoginEmailWithoutDataLoss, true);

assert.equal(manifest.adminAccountManagement.emailChangeInsideUserEditor, true);
assert.equal(manifest.adminAccountManagement.whatsappPreferencesRemovedFromEditor, true);
assert.doesNotMatch(adminHtml, /id=["']userWhatsappOptIn["']/);
assert.doesNotMatch(adminHtml, /id=["']userReminder7["']/);
assert.doesNotMatch(adminHtml, /id=["']userReminder1["']/);
console.log('OK v21.10.0 — alteração de e-mail com POST/PATCH, timeout de notificação e painel administrativo simplificado');
