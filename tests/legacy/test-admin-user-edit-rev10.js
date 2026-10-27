import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const admin = fs.readFileSync('assets/js/admin/app.js', 'utf8');

assert(api.includes("const APP_VERSION = '2.23.1-map-ux-21.11.2';"), 'API deve anunciar 2.22.8');
assert(api.includes("SYNC_CONTACT_PHONE_TO_APPWRITE_AUTH"), 'Sincronização opcional do telefone com Auth deve existir');
assert(api.includes("return { skipped: true, reason: 'contact_only' }"), 'Telefone de contato deve permanecer fora do Auth por padrão');
assert(api.includes("reason: 'duplicate_target'"), 'Colisão de target deve ser tolerada sem bloquear a edição');
assert(api.includes("PASSWORD_UPDATE_FAILED_AFTER_PROFILE"), 'Falha de senha após dados salvos deve ser explícita');
assert(api.indexOf('const profile = await createOrUpdateAdminProfile({') < api.lastIndexOf('await updateAppwriteUserPassword(userId, input.password);'), 'Senha deve ser atualizada depois da persistência dos demais dados na rota administrativa');
assert(admin.includes("dataset.originalWhatsapp"), 'Frontend deve guardar o telefone original');
assert(admin.includes("normalizedWhatsapp !== originalWhatsapp"), 'Frontend só deve enviar telefone quando ele realmente mudar');
assert(admin.includes("O telefone informado já está vinculado a outro acesso"), 'Frontend deve traduzir erro de target duplicado');

console.log('OK v21.10.0 REV10: edição administrativa, senha e telefone de contato sem colisão de target validados.');
