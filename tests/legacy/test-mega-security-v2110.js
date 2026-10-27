import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
assert.match(api,/const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2';/);
assert.match(api,/ensureSurveyorProfile\(\{ email, name = 'Usuário', role = 'user', plan = 'basic_monthly' \}/);
const ensure=api.slice(api.indexOf('async function ensureSurveyorProfile'), api.indexOf('function permissionCandidates'));
assert.doesNotMatch(ensure,/role \|\| 'admin'/,'auto-reparo nao pode promover usuario a admin');
assert.doesNotMatch(ensure,/plan \|\| 'pro_annual'/,'auto-reparo nao pode promover plano para Pro');
assert.doesNotMatch(ensure,/admin: true/,'auto-reparo nao pode criar permissoes administrativas');
const health=api.slice(api.indexOf("if (path === '/api/health')"), api.indexOf("if (path === '/api/favicon.ico')"));
for(const leaked of ['OPENROUTER','BREVO','GOOGLE_DRIVE','CONECTA','apiKey','configured:']) assert.ok(!health.includes(leaked),`health publico nao deve revelar ${leaked}`);
assert.match(api,/if \(!origin\) return '';/);

// Fast secret scan for high-signal credential formats/private keys in source-controlled text.
const roots=['assets','functions','config','scripts','tests'];
const secretPatterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,/\bAKIA[0-9A-Z]{16}\b/];
function walk(dir){ if(!fs.existsSync(dir)) return []; const out=[]; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=`${dir}/${e.name}`; if(e.isDirectory()){ if(['node_modules','.git','dist'].includes(e.name)) continue; out.push(...walk(p)); } else if(/\.(?:js|mjs|json|md|txt|html|css|example|bat|ps1)$/i.test(e.name) || e.name==='.env.example') out.push(p); } return out; }
for(const file of roots.flatMap(walk)){ const text=fs.readFileSync(file,'utf8'); for(const re of secretPatterns) assert.doesNotMatch(text,re,`possivel segredo real em ${file}`); }
console.log('OK: hardening principal v21.11.0 validado.');
