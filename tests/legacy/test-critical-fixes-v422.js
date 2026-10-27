import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const login = [fs.readFileSync('login/index.html', 'utf8'), fs.readFileSync('assets/js/core/login.js', 'utf8'), fs.readFileSync('assets/js/core/login-support.js', 'utf8')].join('\n');
const admin = fs.readFileSync('admin/index.html', 'utf8');
const adminJs = fs.readFileSync('assets/js/admin/app.js', 'utf8');

assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2';/);
assert.match(api, /JSON\.stringify\(\{ number: normalized \}\)/, 'Telefone deve usar o parâmetro number do Appwrite.');
assert.doesNotMatch(api, /JSON\.stringify\(\{ phone: normalized \}\)/, 'Parâmetro inválido phone não pode voltar.');
assert.match(api, /APPWRITE_FUNCTION_API_KEY/);

assert.match(api, /\/api\/auth\/password-reset\/verify/);
assert.match(api, /password-reset-authorized/);
assert.match(api, /Código incorreto\./);
assert.match(auth, /verifyPasswordResetCode/);
assert.match(login, /id="passwordResetCodeForm"/);
assert.match(login, /id="passwordResetNewPasswordForm"/);
assert.match(login, /id="passwordResetResend"/);
assert.match(login, /setPasswordResetStep\('password'\)/);
assert.ok(login.indexOf('passwordResetCodeForm') < login.indexOf('passwordResetNewPasswordForm'), 'Código deve vir antes da nova senha.');

assert.doesNotMatch(admin, /data-tab="whatsapp-center"/);
assert.doesNotMatch(admin, /id="tab-whatsapp-center"/);
assert.doesNotMatch(admin, /WhatsApp Web/i);
assert.doesNotMatch(adminJs, /web\.whatsapp\.com/i);
assert.doesNotMatch(adminJs, /whatsappCenterState/);
assert.match(admin, /Telefone de contato/);

const combined = [api, auth, login, admin, adminJs].join('\n');
assert.doesNotMatch(combined, /suporte@surveyoragrimensura\.tech/i);
console.log('OK v21.9.424: telefone Appwrite e recuperação em 3 etapas validados; WhatsApp Web removido.');
