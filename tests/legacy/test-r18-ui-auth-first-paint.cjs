const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const preflightRef = '/assets/js/core/auth-guard.js';

const portalPages = [];
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'dist' || entry.name === 'node_modules') continue;
  const rel = `${entry.name}/index.html`;
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  const html = fs.readFileSync(abs, 'utf8');
  if (html.includes('/assets/js/core/portal.js')) portalPages.push(rel);
}

assert(portalPages.length >= 15, `Esperava várias rotas protegidas; encontrei ${portalPages.length}.`);
for (const rel of portalPages) {
  const html = read(rel);
  assert(html.includes(preflightRef), `Rota protegida sem preflight de autenticação: ${rel}`);
  assert(html.indexOf(preflightRef) < html.indexOf('</head>'), `Preflight deve executar no <head>: ${rel}`);
}
assert(!read('login/index.html').includes(preflightRef), 'Login não deve executar o gate de rota protegida.');
assert(!read('primeiro-acesso/index.html').includes(preflightRef), 'Primeiro acesso não deve executar o gate de rota protegida.');

const preflight = read('assets/js/core/auth-guard.js');
assert(preflight.includes("html.classList.add('surveyor-auth-pending')"), 'Preflight precisa bloquear o primeiro paint.');
assert(preflight.includes("html.style.visibility = 'hidden'"), 'Preflight precisa ocultar a rota protegida antes do body.');
assert(preflight.includes("location.replace(`/login/?return=${target}`)"), 'Rota sem sessão precisa ir diretamente para login.');
assert(preflight.includes("georural-auth-session-v3"), 'Preflight precisa usar a sessão atual do Surveyor.');

const portal = read('assets/js/core/portal.js');
assert(portal.includes('const validSession = await auth.ensureSession?.();'), 'Portal precisa validar a sessão antes de liberar o paint.');
assert(portal.includes("window.dispatchEvent(new CustomEvent('surveyor:portal-ready'))"), 'Portal precisa sinalizar quando o shell protegido terminou.');

const runtime = read('assets/js/core/ui.js');
assert(runtime.includes("html.classList.contains('surveyor-auth-pending')"), 'Runtime precisa respeitar o gate de autenticação.');
assert(runtime.includes("window.addEventListener('surveyor:portal-ready', tryReveal"), 'Runtime precisa esperar o Portal nas rotas protegidas.');
assert(runtime.includes("requestAnimationFrame(() => requestAnimationFrame"), 'Reveal deve aguardar dois frames para evitar flash do layout legado.');
assert(!runtime.includes("window.setTimeout(() => document.documentElement.classList.remove('surveyor-ui-booting'), 2200)"), 'Fallback antigo não pode expor o layout protegido antes da autenticação.');

const docCss = read('assets/css/core/documents.css');
assert(docCss.includes('R18 — cabeçalho dos módulos técnicos alinhado às extremidades da área útil.'), 'CSS R18 de alinhamento do cabeçalho ausente.');
assert(docCss.includes('justify-content:space-between!important'), 'Cabeçalho técnico deve distribuir título e status nas extremidades.');
assert(docCss.includes('.sv-doc-head-status'), 'Status Projeto/Módulo precisa de regra própria.');
assert(docCss.includes('margin-left:auto!important'), 'Status Projeto/Módulo deve ficar ancorado à direita.');

console.log(`PASS R18: ${portalPages.length} rotas protegidas com login-first, reveal sem layout legado e cabeçalhos técnicos alinhados.`);
