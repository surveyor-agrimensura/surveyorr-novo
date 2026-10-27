import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../assets/js/admin/app.js', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../assets/js/core/auth.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../functions/surveyor-api/src/main.js', import.meta.url), 'utf8');

assert.doesNotMatch(html, /data-tab="settings"/);
assert.doesNotMatch(html, /id="tab-settings"/);
assert.doesNotMatch(html, /Saúde da API|Controle de licenças|Backup automático|Autenticação extra|Registro de IP|Status de acesso/);
assert.match(html, /Último login/);
assert.match(html, /Última saída/);
assert.match(html, /Histórico de login e saída/);
assert.match(admin, /accessEventLabel/);
assert.match(admin, /Entrou no sistema/);
assert.match(admin, /Saiu do sistema/);
assert.match(auth, /Authorization: `Bearer \$\{accessToken\}`/);
assert.match(auth, /keepalive: true/);
assert.match(api, /action: 'logout'/);
assert.match(api, /lastLogoutAt/);
assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2';/);

console.log('Admin v21.9.381: integração removida, blocos inúteis removidos e auditoria exata de login/saída validada.');
