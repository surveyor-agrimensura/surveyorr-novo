const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const agentRel = 'assets/js/core/telemetry.js';
const agentPath = path.join(root, agentRel);
const tag = `<script src="/${agentRel}?v=21.11.5-r15-nr1"></script>`;

const monitored = [
  'index.html',
  'acervos/index.html',
  'admin/index.html',
  'ambiental/index.html',
  'assinatura-digital/index.html',
  'car/index.html',
  'confrontacao/index.html',
  'consulta-car/index.html',
  'customizacao/index.html',
  'earth-3d/index.html',
  'glebas/index.html',
  'login/index.html',
  'loteamentos-reurb/index.html',
  'mapa/index.html',
  'mapas/index.html',
  'memorial/index.html',
  'nuvem/index.html',
  'ods/index.html',
  'perimetros/index.html',
  'planialtimetria/index.html',
  'planos/index.html',
  'pranchas/index.html',
  'sobre/index.html',
  'suporte/index.html'
];

const excluded = [
  '404.html',
  'admin-cards/index.html',
  'primeiro-acesso/index.html',
  'public-project/index.html',
  'privacidade/index.html',
  'seguranca/index.html',
  'termos/index.html'
];

assert.ok(fs.existsSync(agentPath), 'New Relic browser agent asset must exist');
const agent = fs.readFileSync(agentPath, 'utf8');
assert.match(agent, /host === 'surveyorr\.com\.br' \|\| host\.endsWith\('\.surveyorr\.com\.br'\)/, 'agent must be production-domain guarded');
assert.match(agent, /capture_payloads:'none'/, 'AJAX payload capture must stay disabled');
assert.match(agent, /distributed_tracing:\{enabled:true\}/, 'distributed tracing must stay enabled');
assert.match(agent, /logging:\{enabled:false\}/, 'console logging auto-capture must stay disabled');
assert.match(agent, /user_actions:\{enabled:false\}/, 'automatic user-action telemetry must stay disabled');
assert.doesNotMatch(agent, /session_replay:\{[^}]*enabled:!0/, 'session replay must not be enabled');
assert.doesNotMatch(agent, /<script\b/i, 'local JS asset must not contain HTML script tags');

for (const rel of monitored) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.equal(html.split(tag).length - 1, 1, `${rel}: New Relic bootstrap must appear exactly once`);
  const charsetPos = html.search(/<meta\s+charset\s*=/i);
  const agentPos = html.indexOf(tag);
  assert.ok(charsetPos >= 0 && agentPos > charsetPos, `${rel}: agent must be placed after charset`);
  const firstAppScript = html.indexOf('<script', agentPos + tag.length);
  assert.ok(firstAppScript < 0 || agentPos < firstAppScript, `${rel}: agent must load before application scripts`);
  assert.match(html, /script-src[^;]*https:\/\/js-agent\.newrelic\.com/, `${rel}: CSP must allow New Relic JS chunks`);
  assert.match(html, /connect-src[^;]*(?:https:|https:\/\/bam\.nr-data\.net)/, `${rel}: CSP must allow New Relic beacons`);
}

for (const rel of excluded) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.ok(!html.includes(agentRel), `${rel}: sensitive/static page must stay uninstrumented`);
}

console.log(`PASS: New Relic Browser Monitoring protegido e integrado em ${monitored.length} páginas operacionais.`);
