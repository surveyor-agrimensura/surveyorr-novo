import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const baseline = JSON.parse(fs.readFileSync('scripts/css-important-baseline.json', 'utf8'));
for (const file of ['assets/home-hero.css', 'assets/home-showcase.css']) {
  assert.ok(fs.existsSync(file), `CSS da página inicial ausente: ${file}`);
  const css = fs.readFileSync(file, 'utf8');
  assert.ok(Object.hasOwn(baseline, file), `CSS da página inicial não auditado: ${file}`);
  for (const line of css.split(/\r?\n/).filter(line => line.includes('!important'))) {
    assert.ok(baseline[file][line.trim()] > 0, `Declaração não auditada em ${file}`);
  }
}
const script = fs.readFileSync('scripts/css-integrity.mjs', 'utf8');
// Verifica o comportamento com uma folha nova e restaura o diretório em todos os casos.
const probe = 'assets/css/css-audit-probe.css';
assert.equal(fs.existsSync(probe), false, 'A folha temporária não pode sobrescrever um arquivo existente.');
try {
  fs.writeFileSync(probe, '.probe { display: block; }\n');
  const blocked = spawnSync(process.execPath, ['scripts/css-integrity.mjs'], { encoding: 'utf8' });
  assert.notEqual(blocked.status, 0, 'Uma folha CSS nova sem revisão deve bloquear a auditoria.');
  assert.match(blocked.stderr, /folha sem registro na auditoria/, 'O bloqueio deve explicar a causa.');
} finally {
  fs.rmSync(probe, { force: true });
}

assert.match(script, /cssFiles\('assets'\)/, 'A auditoria deve incluir todas as folhas CSS em assets');
const run = spawnSync(process.execPath, ['scripts/css-integrity.mjs'], { encoding: 'utf8' });
assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
console.log('PASS css-audit-coverage: folhas da home incluídas na proteção de regressões.');
