import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const adminHtml = fs.readFileSync('admin/index.html', 'utf8');
const admin = fs.readFileSync('assets/js/admin/app.js', 'utf8');
const css = fs.readFileSync('assets/css/admin/documents.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const apiPkg = JSON.parse(fs.readFileSync('functions/surveyor-api/package.json', 'utf8'));

assert.equal(pkg.version, '21.11.5');
assert.equal(apiPkg.version, '2.23.0');
assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2';/);

assert.match(api, /userDeletionImpact/);
assert.match(api, /USER_DELETE_HAS_PROTECTED_DATA/);
assert.match(api, /complete_without_data/);
assert.match(api, /user_deleted_without_data/);
assert.match(api, /deleteUserCustomizations/);
assert.match(api, /incomplete_user_deleted/);
assert.doesNotMatch(api, /COMPLETE_USER_DELETE_BLOCKED/);

assert.match(auth, /async function deleteRemoteUser\(userId\)/);
assert.match(auth, /method: 'DELETE'/);

assert.match(admin, /data-user-action="delete-user"/);
assert.match(admin, /Excluir usuário/);
assert.match(admin, /Digite EXCLUIR/);
assert.match(admin, /data-user-action="toggle"/);
assert.match(admin, /Usuário bloqueado\./);
assert.match(css, /\.user-actions/);
assert.match(css, /danger-link/);

assert.doesNotMatch(adminHtml, /Central WhatsApp/);
assert.doesNotMatch(adminHtml, /WhatsApp Web/i);
assert.doesNotMatch(admin, /web\.whatsapp\.com/i);
assert.doesNotMatch(admin, /wa\.me\//i);
assert.ok(!fs.existsSync('admin-whatsapp-center.css'), 'CSS da Central WhatsApp não deve existir.');

console.log('OK v21.9.424: exclusão visível e segura, bloqueio preservado e WhatsApp Web removido.');
