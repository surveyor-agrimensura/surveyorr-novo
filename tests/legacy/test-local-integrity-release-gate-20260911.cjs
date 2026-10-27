const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const pkg = require(path.join(root, 'package.json'));
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
assert.equal(pkg.version, version);
assert.equal(pkg.surveyorRelease, version);
for (const name of fs.readdirSync(path.join(root, 'functions'))) {
  const file = path.join(root, 'functions', name, 'package.json');
  if (!fs.existsSync(file)) continue;
  const child = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(child.version, version, `${name} version`);
  assert.equal(child.surveyorRelease, version, `${name} surveyorRelease`);
}
assert.ok(fs.existsSync(path.join(root, 'scripts', 'version.mjs')));
assert.ok(fs.existsSync(path.join(root, 'scripts', 'integrity.mjs')));
assert.ok(!fs.existsSync(path.join(root, 'tests', 'tools', 'tmp-export-test.mjs')));
assert.ok(!fs.existsSync(path.join(root, 'tmp-html')));
const bat = fs.readFileSync(path.join(root, 'TESTAR.bat'), 'utf8');
for (const command of ['npm run version:sync','npm run lint:integrity','npm run test:functions','npm test','npm run release:clean']) {
  assert.ok(bat.includes(command), `BAT deve executar ${command}`);
}
console.log('OK: centralização de versão, limpeza e release gate local validados.');
