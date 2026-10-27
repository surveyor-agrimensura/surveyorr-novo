import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd(), dist=path.join(root,'dist/surveyor-frontend');
assert.ok(fs.existsSync(dist),'dist ausente; execute npm run build');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const compareTree=(srcRel,dstRel)=>{
  const src=path.join(root,srcRel), dst=path.join(dist,dstRel);
  const walk=(dir)=>{
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,ent.name), rel=path.relative(src,full), target=path.join(dst,rel);
      if(ent.isDirectory()){ walk(full); continue; }
      assert.ok(fs.existsSync(target),`dist sem ${path.join(dstRel,rel)}`);
      assert.equal(hash(full),hash(target),`dist divergente: ${path.join(dstRel,rel)}`);
    }
  };
  walk(src);
};
compareTree('assets','assets');
for(const rel of ['index.html','404.html','VERSION','manifest.webmanifest','sw.js']){
  assert.ok(fs.existsSync(path.join(dist,rel)),`dist sem ${rel}`);
  assert.equal(hash(path.join(root,rel)),hash(path.join(dist,rel)),`dist divergente: ${rel}`);
}
console.log('PASS dist: assets e arquivos públicos centrais reproduzem exatamente a fonte.');
