import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
assert.ok(fs.existsSync('AGENTS.md'));
assert.ok(fs.existsSync('docs/history/README.md'));
assert.ok(fs.existsSync('docs/architecture/storage.md'));
for(const forbidden of ['RODAR_SURVEYOR_LOCAL.bat','RODAR_TESTES_INTEGRIDADE_LOCAL.bat','DEPLOY_PROXY_CLOUDFLARE.bat']) assert.ok(!fs.existsSync(forbidden),`launcher legado ainda existe: ${forbidden}`);
const names=[]; const walk=(dir)=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,ent.name);if(ent.isDirectory())walk(full);else names.push(path.relative(root,full))}}; walk('assets');
assert.ok(!names.some(n=>/hotfix|repair|current/i.test(path.basename(n))), 'assets de produção não podem usar nomes de remendo');
for(const file of fs.readdirSync(root).filter(name=>name.endsWith('.html')).map(name=>path.join(root,name)).concat((()=>{const out=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory()&&!['dist','node_modules','docs','tests'].includes(e.name))walk(f);else if(e.isFile()&&e.name.endsWith('.html'))out.push(f)}};walk(root);return out})())){
  const html=fs.readFileSync(file,'utf8');
  assert.ok(!/frame-ancestors\s/i.test(html),`frame-ancestors não deve ficar em meta CSP: ${path.relative(root,file)}`);
}
console.log('PASS source-policy: fonte 1.0 organizada e documentação ativa separada do histórico.');
