import fs from 'node:fs';
import assert from 'node:assert/strict';

const adminHtml = fs.readFileSync('admin/index.html', 'utf8');
const adminJs = fs.readFileSync('assets/js/admin/app.js', 'utf8');
const smartForms = fs.readFileSync('assets/js/core/ui.js', 'utf8');
const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const envExample = fs.readFileSync('config/.env.example', 'utf8');
const planDocuments = fs.readFileSync('assets/js/admin/documents.js', 'utf8');

assert.match(adminHtml, /id="userWhatsapp"/, 'Admin precisa ter campo de WhatsApp.');
assert.doesNotMatch(adminHtml, /id="userWhatsappOptIn"/, 'A autorização de WhatsApp deve ter sido removida da edição administrativa.');
assert.doesNotMatch(adminHtml, /id="userReminder7"/, 'O aviso de 7 dias deve ter sido removido da edição administrativa.');
assert.doesNotMatch(adminHtml, /id="userReminder1"/, 'O aviso de 1 dia deve ter sido removido da edição administrativa.');
assert.match(adminHtml, /<th>Telefone<\/th>/, 'Tabela de usuários precisa mostrar o telefone de contato.');
assert.match(adminJs, /whatsappOptIn\s*=\s*false|whatsappOptIn:\s*false/, 'O painel deve manter o contato sem ativar avisos de WhatsApp.');
assert.match(adminJs, /whatsappReminderDays\s*=\s*\[\]|whatsappReminderDays:\s*\[\]/, 'O painel deve manter lembretes automáticos desativados.');
assert.doesNotMatch(adminJs, /https:\/\/wa\.me\//, 'O painel não deve abrir WhatsApp Web ou wa.me.');
assert.match(smartForms, /\['userWhatsapp', 'phone'\]/, 'Campo do WhatsApp precisa usar máscara explícita.');
assert.match(planDocuments, /planDocClientPhone[\s\S]*user\.whatsappDisplay/, 'Documentos dos planos precisam aproveitar o telefone cadastrado.');

assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2';/, 'Function precisa anunciar v2.22.8.');
assert.match(api, /CONECTA_PLUS_API_KEY/, 'Function precisa exigir chave própria do Conecta+.');
assert.match(api, /crypto\.timingSafeEqual/, 'Comparação da chave precisa ser resistente a timing attack.');
assert.match(api, /path === '\/api\/integrations\/conecta-plus\/users' && httpMethod === 'GET'/, 'Endpoint de consulta de usuários precisa existir.');
assert.match(api, /\/api\/integrations\/conecta-plus\/users\/expiring/, 'Endpoint de vencimentos precisa existir.');
assert.match(api, /\/api\/integrations\/conecta-plus\/notifications\/mark-sent/, 'Endpoint para evitar mensagens duplicadas precisa existir.');
assert.match(api, /\/api\/integrations\/conecta-plus\/support/, 'Endpoint de suporte do Conecta+ precisa existir.');
assert.match(api, /path === '\/api\/integrations\/conecta-plus\/plans' && httpMethod === 'GET'/, 'Endpoint de consulta de planos precisa existir.');
assert.match(api, /\/api\/integrations\/conecta-plus\/plans/, 'Endpoint de planos do Conecta+ precisa existir.');
assert.match(api, /whatsappReminderDays: normalizeReminderDays/, 'Backend precisa normalizar alertas de 7 e 1 dia.');
assert.match(api, /phone: normalizedWhatsapp[\s\S]*whatsapp: normalizedWhatsapp/, 'Telefone precisa ser salvo no perfil e nas preferências do Surveyor.');
assert.match(api, /SYNC_CONTACT_PHONE_TO_APPWRITE_AUTH/, 'Sincronização com o telefone de autenticação deve ser opcional.');
assert.match(api, /conectaPlusNotifications/, 'Histórico de mensagens precisa impedir duplicação.');
assert.match(envExample, /CONECTA_PLUS_API_KEY=.{32,}/, 'Exemplo de ambiente precisa documentar chave forte.');

assert.doesNotMatch(api, /CONECTA_PLUS_API_KEY\s*=\s*['"][^'"]+['"]/, 'A chave do Conecta+ não pode ficar fixa no código.');
console.log('OK v21.9.433: telefone preservado, preferências de WhatsApp removidas do painel e API do Conecta+ mantida.');
