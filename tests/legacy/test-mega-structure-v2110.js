import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rootFiles = fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name);
assert.deepEqual(rootFiles.filter(n => n.endsWith('.js') && n !== 'sw.js'), [], 'nao deve haver JS solto na raiz fora do service worker');
assert.deepEqual(rootFiles.filter(n => n.endsWith('.css')), [], 'nao deve haver CSS solto na raiz');
assert.deepEqual(rootFiles.filter(n => n.endsWith('.html')).sort(), ['404.html','index.html'], 'raiz HTML deve conter apenas index e 404');

for (const rel of [
  'assets/js/core/auth.js','assets/js/core/api.js','assets/js/core/projects.js',
  'assets/js/admin/app.js','assets/js/features/mapa/app.js','assets/js/workers/layer-import-worker.js',
  'assets/css/core/ui.css','assets/css/features/mapa/app.css','assets/css/admin/ai.css',
  'functions/surveyor-api/src/main.js','functions/surveyor-save/src/main.js','README.md'
]) assert.ok(fs.existsSync(path.join(root, rel)), `arquivo esperado ausente: ${rel}`);
assert.ok(!fs.existsSync(path.join(root,'admin-mega.js')), 'admin-mega.js legado nao deve existir');

const legacy = fs.readFileSync(path.join(root,'assets/js/core/router.js'),'utf8');
for (const route of ['login','mapa','nuvem','admin','memorial']) assert.match(legacy, new RegExp(`['\"]${route}['\"]`));

const htmlFiles=[];
function walk(dir){ for(const ent of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,ent.name); if(ent.isDirectory()){ if(['.git','node_modules','dist'].includes(ent.name)) continue; walk(p); } else if(ent.name.endsWith('.html')) htmlFiles.push(p); }}
walk(root);
const attr=/(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/g;
for(const file of htmlFiles){ const text=fs.readFileSync(file,'utf8'); let m; while((m=attr.exec(text))){ const ref=m[1]; if(/^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(ref)) continue; const target=ref.startsWith('/')?path.join(root,ref.replace(/^\/+/,'')):path.resolve(path.dirname(file),ref); if(ref.endsWith('/')) continue; assert.ok(fs.existsSync(target), `${path.relative(root,file)} referencia arquivo ausente: ${ref}`); }}
console.log('OK: estrutura v21.11.0 organizada e referencias HTML locais validas.');
