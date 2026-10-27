import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'RELEASE_MANIFEST.json'), 'utf8'));
assert.equal(version, pkg.version, 'VERSION deve seguir package.json');
assert.equal(manifest.release, pkg.version, 'manifesto deve seguir package.json');
assert.equal(manifest.frontend.version, pkg.version, 'frontend.version deve seguir package.json');

for (const name of fs.readdirSync(path.join(root, 'functions'))) {
  const file = path.join(root, 'functions', name, 'package.json');
  if (!fs.existsSync(file)) continue;
  const fp = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(fp.version, pkg.version, `${name} deve usar a versão da release`);
  assert.equal(fp.surveyorRelease, pkg.version, `${name}.surveyorRelease deve seguir a release`);
}

const forbiddenName = /(?:-v\d|(?:^|[-_])r\d+(?:[-_.]|$)|hotfix|repair|current)/i;
for (const base of ['assets/js', 'assets/css']) {
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.(?:js|css)$/i.test(ent.name)) assert.ok(!forbiddenName.test(ent.name), `nome legado em produção: ${path.relative(root, full)}`);
    }
  };
  walk(path.join(root, base));
}

const rootHistorical = fs.readdirSync(root).filter((name) => /^R\d.*\.md$/i.test(name));
assert.deepEqual(rootHistorical, [], 'documentação histórica não deve ficar na raiz');
console.log(`PASS version: ${pkg.version} centralizada e nomes de produção limpos.`);
