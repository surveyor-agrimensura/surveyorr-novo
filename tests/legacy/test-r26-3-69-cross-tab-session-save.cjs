const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const srcPath = path.join(root, 'assets/js/core/auth.js');
const distPath = path.join(root, 'dist/surveyor-frontend/assets/js/core/auth.js');
const src = fs.readFileSync(srcPath, 'utf8');
const dist = fs.readFileSync(distPath, 'utf8');
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(src === dist, 'auth.js fonte e dist precisam estar sincronizados');
assert(src.includes("if (key === KEYS.session) {"), 'sessão precisa ter tratamento dedicado');
assert(src.includes("localStorage.setItem(key, raw)"), 'sessão precisa ter espelho compartilhado entre abas');
assert(src.includes("const sharedRaw = localStorage.getItem(key)"), 'leitura precisa consultar sessão compartilhada');
assert(src.includes("sharedAt >= tabAt ? sharedValue : tabValue"), 'troca de conta precisa priorizar a sessão mais nova');
assert(src.includes("window.addEventListener('storage', (event) =>"), 'abas já abertas precisam receber sincronização de sessão');
assert(src.includes("if (event.key !== KEYS.session) return;"), 'listener não deve sincronizar outras chaves');
assert(src.includes("sessionStorage.setItem(KEYS.session, event.newValue)"), 'nova sessão precisa ser copiada para a aba ativa');
assert(src.includes("sessionStorage.removeItem(KEYS.session)"), 'logout em outra aba precisa derrubar a sessão local');
assert(src.includes("accessToken: String(session.accessToken || '')"), 'Save Function deve continuar recebendo accessToken no envelope');
console.log('PASS R26.3.69: sessão de cliente sincronizada entre abas e token preservado no salvamento.');
