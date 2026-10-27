const fs = require('fs');
const assert = require('assert');
const read = (p) => fs.readFileSync(p, 'utf8');
const auth = read('assets/js/core/auth.js');
const layout = read('assets/js/core/layout.js');
const preflight = read('assets/js/core/auth-guard.js');
const api = read('functions/surveyor-api/src/main.js');
const plans = read('planos/index.html');

// Sessão: sem persistência em localStorage e reload exige login.
assert(!auth.includes('localStorage.setItem(KEYS.session'), 'auth ainda persiste sessão em localStorage');
assert(auth.includes('recoverSessionForSave'), 'faltou recuperação de sessão específica do salvamento');
assert(auth.includes('session = await recoverSessionForSave()'), 'save não tenta recuperar a sessão antes de falhar');
assert(preflight.includes("navigationType === 'reload'"), 'reload não força nova autenticação');
assert(preflight.includes('sessionStorage.removeItem(SESSION_KEY)'), 'preflight não limpa sessão no reload');
assert(!preflight.includes('readSession(localStorage)'), 'preflight ainda aceita sessão persistente em localStorage');

// Cache bust obrigatório para o hotfix de autenticação.
const mapa = read('mapa/index.html');
const login = read('login/index.html');
assert(mapa.includes('auth.js?v=20260921-r26370-session-plans-r1'), 'mapa ainda aponta para auth.js em cache antigo');
assert(login.includes('auth.js?v=20260921-r26370-session-plans-r1'), 'login ainda aponta para auth.js em cache antigo');

// Matriz comercial oficial.
const basicLine = auth.match(/const BASIC_FALLBACK_PERMISSIONS = (\[[^;]+\]);/)[1];
const plusLine = auth.match(/const PLUS_FALLBACK_PERMISSIONS = (\[[^;]+\]);/)[1];
const proLine = auth.match(/const PRO_FALLBACK_PERMISSIONS = (\[[^;]+\]);/)[1];
const basic = JSON.parse(basicLine), plus = JSON.parse(plusLine), pro = JSON.parse(proLine);
for (const forbidden of ['car:access','layers:official','ambiental:access','loteamentos:access','documents:perimetros','documents:planialtimetria','projects:version-full','projects:export-zip','company:settings']) {
  assert(!basic.includes(forbidden), `Básico recebeu indevidamente ${forbidden}`);
}
for (const required of ['car:access','layers:official','ambiental:access','loteamentos:access','documents:perimetros','documents:planialtimetria']) {
  assert(plus.includes(required), `Plus sem ${required}`);
}
for (const forbidden of ['projects:version-full','projects:export-zip','company:settings']) {
  assert(!plus.includes(forbidden), `Plus recebeu indevidamente ${forbidden}`);
}
for (const required of ['projects:version-full','projects:trash','projects:lock','projects:export-zip','company:settings','geometry:advanced','cloud:pro']) {
  assert(pro.includes(required), `Pro sem ${required}`);
}
assert(!pro.some(p => p.startsWith('admin:') || p.startsWith('backup:') || p === 'security:monitoring'), 'Pro herdou permissão administrativa global no layout');
assert(layout.includes('"company:settings"'), 'layout não reconhece personalização no Pro');
assert(api.includes("requirePermission(auth, 'company:settings', 'Seu plano não possui acesso à Personalização.')"), 'backend não protege personalização por plano');
assert(api.includes("normalized.startsWith('company:') && normalized !== 'company:settings'"), 'backend ainda remove company:settings do Pro durante sanitização');
assert(plans.includes('Personalização da empresa'), 'comparativo de planos não documenta Personalização do Pro');

console.log('PASS R26.3.70: sessão de salvamento, relogin no refresh e matriz Básico/Plus/Pro corrigidos.');
