import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const authJs = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const portal = fs.readFileSync('assets/js/core/portal.js', 'utf8');
const admin = fs.readFileSync('assets/js/admin/app.js', 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} deve existir.`);
  let brace = source.indexOf(') {', start);
  assert.notEqual(brace, -1, `${name} deve ter corpo.`);
  brace += 2;
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Não foi possível extrair ${name}.`);
}

const serverFn = Function(`"use strict"; return (${extractFunction(api, 'noticeAppliesToAuth')});`)();
const clientFn = Function('currentPlan', `"use strict"; return (${extractFunction(authJs, 'noticeAppliesToUser')});`)(() => ({ slug: 'plus_annual' }));

const adminAuth = { sub: 'admin-1', user: { id: 'admin-1', role: 'admin', planSlug: 'pro_annual' } };
const userAAuth = { sub: 'user-a', user: { id: 'user-a', role: 'user', planSlug: 'plus_annual' } };
const userBAuth = { sub: 'user-b', user: { id: 'user-b', role: 'user', planSlug: 'basic_annual' } };
const adminUser = adminAuth.user;
const userA = userAAuth.user;
const userB = userBAuth.user;
const active = { id: 'n1', title: 'Teste', message: 'Teste', isActive: true };

for (const fnCase of [
  ['server', (n, auth) => serverFn(n, auth), adminAuth, userAAuth, userBAuth],
  ['client', (n, user) => clientFn(n, user), adminUser, userA, userB]
]) {
  const [label, applies, adminCtx, aCtx, bCtx] = fnCase;
  assert.equal(applies({ ...active, audience: 'user', targetUserId: 'user-a' }, aCtx), true, `${label}: destinatário específico deve receber.`);
  assert.equal(applies({ ...active, audience: 'user', targetUserId: 'user-a' }, bCtx), false, `${label}: outro usuário não pode receber.`);
  assert.equal(applies({ ...active, audience: 'user', targetUserId: 'user-a' }, adminCtx), false, `${label}: admin não pode receber aviso destinado a outro usuário.`);
  assert.equal(applies({ ...active, audience: 'user', targetUserId: 'admin-1' }, adminCtx), true, `${label}: admin explicitamente selecionado deve receber.`);
  assert.equal(applies({ ...active, audience: 'users' }, adminCtx), false, `${label}: público usuários comuns não inclui admin.`);
  assert.equal(applies({ ...active, audience: 'admins' }, adminCtx), true, `${label}: público admins inclui admin.`);
  assert.equal(applies({ ...active, audience: 'admins' }, aCtx), false, `${label}: usuário comum não recebe aviso de admins.`);
  assert.equal(applies({ ...active, audience: 'plan', targetPlanSlug: 'plus_annual' }, aCtx), true, `${label}: plano correspondente deve receber.`);
  assert.equal(applies({ ...active, audience: 'plan', targetPlanSlug: 'plus_annual' }, bCtx), false, `${label}: outro plano não deve receber.`);
  assert.equal(applies({ ...active, audience: 'plan', targetPlanSlug: 'pro_annual' }, adminCtx), false, `${label}: aviso por plano não deve vazar para admin.`);
  assert.equal(applies({ ...active, audience: 'all' }, adminCtx), true, `${label}: aviso global deve chegar ao admin.`);
  assert.equal(applies({ ...active, audience: 'all' }, aCtx), true, `${label}: aviso global deve chegar ao usuário.`);
  assert.equal(applies({ ...active, audience: 'invalido' }, aCtx), false, `${label}: audiência desconhecida deve falhar fechada.`);
}

assert.ok(admin.includes("targetUserId: audience === 'user' ? $('noticeUser').value : null"), 'Admin deve enviar o ID exato do usuário selecionado.');
assert.ok(api.includes('const SYSTEM_NOTICES_CACHE_TTL_MS = 30 * 1000;'), 'Cache servidor de avisos deve ser curto.');
assert.ok(authJs.includes('notices: 60_000'), 'Cache cliente de avisos deve ser curto.');
assert.ok(portal.includes('const NOTICE_POLL_MS = 60_000;'), 'Central de avisos deve atualizar em até 1 minuto.');
assert.ok(portal.includes("force ? { forceRefresh: true, noCache: true } : {}"), 'Atualização forçada deve ignorar cache cliente.');
assert.ok(authJs.includes('function noticeReadUserKey'), 'Estado lido deve ser separado por usuário.');
assert.ok(authJs.includes('writeLocalJson(LOCAL_NOTICE_READ_KEY, { byUser });'), 'Leitura local deve ser persistida por conta.');

console.log('PASS V50 notices: destinatários isolados, admin sem bypass e estado lido/cache corrigidos.');
