import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const htmlFiles=[];
const walk=(dir)=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(['dist','node_modules','.git','docs','tests'].includes(ent.name))continue;const full=path.join(dir,ent.name);if(ent.isDirectory())walk(full);else if(ent.name.endsWith('.html'))htmlFiles.push(full)}};
walk(root);
const refs=[];
for(const file of htmlFiles){const html=fs.readFileSync(file,'utf8');const re=/(?:src|href)=["']((?:\/|\.\.\/|\.\/)*assets\/[^"']+)["']/g;let m;while((m=re.exec(html))){refs.push([file,m[1]]);const [raw,q='']=m[1].split('?');assert.equal(q,`v=${version}`,`${path.relative(root,file)} deve usar cache-buster único ${version}: ${m[1]}`);const normalized=raw.replace(/^\.\.\//g,'').replace(/^\.\//,'').replace(/^\//,'');assert.ok(fs.existsSync(path.join(root,normalized)),`asset ausente em ${path.relative(root,file)}: ${normalized}`)}}
assert.ok(refs.length>50,'esperado conjunto relevante de assets locais');
console.log(`PASS assets: ${htmlFiles.length} HTMLs e ${refs.length} referências locais válidas com ?v=${version}.`);
