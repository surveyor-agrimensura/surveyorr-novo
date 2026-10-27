import fs from 'node:fs';
const html=fs.readFileSync('admin/index.html','utf8');
const js=fs.readFileSync('assets/js/admin/app.js','utf8');
const auth=fs.readFileSync('assets/js/core/auth.js','utf8');
const api=fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(/data-admin-revision="rev(?:12|13|14|15|16)"/.test(html),'REV12 ou revisão posterior ausente');
ok(!html.includes('BLOCO 6'),'Bloco 6 ainda visível');
ok(html.includes('id="toggleSelectedLayerGroup"'),'Botão de grupo ausente');
ok(js.includes('syncSelectedLayerGroupAction'),'Sincronização do botão de grupo ausente');
ok(auth.includes("apiFetch('/api/admin/notices'"),'Avisos não usam endpoint oficial');
ok(!api.slice(api.indexOf('async function writeSystemNotices'),api.indexOf('function noticeAppliesToAuth')).includes('identity.'),'writeSystemNotices ainda usa identity indefinido');
ok(api.includes("const APP_VERSION = '2.23.1-map-ux-21.11.2'"),'API 2.22.8 ausente');
console.log('OK v21.10.0 REV12: grupos, painel compacto e avisos administrativos corrigidos.');
