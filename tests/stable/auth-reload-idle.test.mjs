import fs from 'node:fs';
import assert from 'node:assert/strict';

const guard = fs.readFileSync('assets/js/core/auth-guard.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const login = fs.readFileSync('assets/js/core/login.js', 'utf8');

assert.ok(!guard.includes("navigationType === 'reload'"), 'Ctrl+R não pode invalidar automaticamente a sessão.');
assert.ok(!guard.includes('reason=refresh'), 'Guard não pode redirecionar reload válido para login.');
assert.ok(guard.includes("const LAST_ACTIVITY_KEY = 'georural-auth-last-activity-v1'"), 'Guard deve persistir relógio de atividade na aba.');
assert.ok(guard.includes('const IDLE_TIMEOUT_MS = 20 * 60 * 1000'), 'Guard deve usar 20 minutos de inatividade.');
assert.ok(guard.includes('reason=idle_timeout'), 'Guard deve diferenciar expiração por inatividade.');
assert.ok(auth.includes('const SESSION_IDLE_TIMEOUT_MS = 20 * 60_000'), 'Auth deve compartilhar timeout de 20 minutos.');
assert.ok(auth.includes("const USER_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'input', 'change', 'wheel', 'touchstart']"), 'Auth deve acompanhar atividade real do usuário.');
assert.ok(auth.includes("event.key === 'F5'"), 'F5 não pode renovar a atividade antes do reload.');
assert.ok(auth.includes("String(event.key || '').toLowerCase() === 'r'"), 'Ctrl/Cmd+R não pode renovar a atividade antes do reload.');
assert.ok(auth.includes('now - previous > SESSION_IDLE_TIMEOUT_MS) return'), 'Interação tardia não pode reviver uma sessão já ociosa.');
assert.ok(login.includes("loginParams.get('reason') === 'idle_timeout'"), 'Login deve explicar expiração por inatividade.');
console.log('PASS V48 auth: reload preserva sessão ativa e timeout ocioso é 20 minutos.');
