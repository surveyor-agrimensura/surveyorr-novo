import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function extractLiteral(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Marcador ausente: ${startMarker}`);
  const valueStart = start + startMarker.length;
  const end = source.indexOf(endMarker, valueStart);
  assert.notEqual(end, -1, `Fim ausente: ${endMarker}`);
  return vm.runInNewContext(`(${source.slice(valueStart, end).trim()})`);
}

const adminJs = read('assets/js/admin/app.js');
const apiJs = read('functions/surveyor-api/src/main.js');
const adminHtml = read('admin/index.html');
const authJs = read('assets/js/core/auth.js');
const layoutJs = read('assets/js/core/layout.js');
const layoutCss = read('assets/css/core/ui.css');

const presets = extractLiteral(adminJs, 'const planPresets = ', ';\n\n  function applyPlanPreset');
const defaults = extractLiteral(apiJs, 'const DEFAULT_PLANS = ', ';\n\n\nconst OBSOLETE_PAYMENT_TEST_PLAN_SLUGS');

const slugs = ['basic_monthly', 'plus_monthly', 'pro_monthly', 'basic_annual', 'plus_annual', 'pro_annual'];
assert.deepEqual(Object.keys(presets).sort(), [...slugs].sort(), 'Admin deve manter exatamente os seis planos oficiais.');
assert.deepEqual(Array.from(defaults, (plan) => plan.slug).sort(), [...slugs].sort(), 'Function deve manter exatamente os seis planos oficiais.');

const expectedPrices = {
  basic_monthly: 3990,
  plus_monthly: 6990,
  pro_monthly: 11990,
  basic_annual: 39900,
  plus_annual: 69900,
  pro_annual: 119900
};

for (const slug of slugs) {
  const preset = presets[slug];
  const apiPlan = defaults.find((plan) => plan.slug === slug);
  assert.equal(preset.priceCents, expectedPrices[slug], `${slug}: preço do Admin mudou.`);
  assert.equal(apiPlan.priceCents, expectedPrices[slug], `${slug}: preço da Function mudou.`);
  for (const permission of [...preset.permissions, ...apiPlan.permissions]) {
    assert.equal(/^generations:/i.test(String(permission)), false, `${slug}: limite de geração ainda presente.`);
  }
}

for (const tier of ['basic', 'plus', 'pro']) {
  assert.deepEqual(
    Array.from(presets[`${tier}_monthly`].permissions),
    Array.from(presets[`${tier}_annual`].permissions),
    `${tier}: mensal e anual devem ter as mesmas permissões.`
  );
}

for (const slug of ['plus_monthly', 'plus_annual']) {
  for (const source of [presets[slug], defaults.find((plan) => plan.slug === slug)]) {
    assert.equal(source.userLimit, 2, `${slug}: deve incluir 2 acessos totais.`);
  }
}

const storageExpected = {
  basic_monthly: 200 * 1024 * 1024, basic_annual: 200 * 1024 * 1024,
  plus_monthly: 500 * 1024 * 1024, plus_annual: 500 * 1024 * 1024,
  pro_monthly: 1024 * 1024 * 1024, pro_annual: 1024 * 1024 * 1024
};
for (const slug of slugs) {
  for (const source of [presets[slug], defaults.find((plan) => plan.slug === slug)]) {
    assert.equal(source.projectLimit, null, `${slug}: todos os planos devem ter projetos ilimitados pelo armazenamento.`);
    assert.equal(source.storageLimitBytes, storageExpected[slug], `${slug}: franquia base de armazenamento incorreta.`);
  }
}
for (const slug of ['pro_monthly', 'pro_annual']) {
  for (const source of [presets[slug], defaults.find((plan) => plan.slug === slug)]) {
    assert.equal(source.userLimit, 4, `${slug}: deve incluir 4 acessos totais.`);
    assert.equal(source.permissions.includes('projects:unlimited'), true, `${slug}: permissão de projetos ilimitados ausente.`);
    assert.equal(source.permissions.includes('white-label:basic'), false, `${slug}: white label não pode vir incluído.`);
  }
}

for (const tier of ['basic', 'plus', 'pro']) {
  const monthly = expectedPrices[`${tier}_monthly`];
  const annual = expectedPrices[`${tier}_annual`];
  assert.equal(annual, monthly * 10, `${tier}: anual deve equivaler a 10 mensalidades (2 meses grátis).`);
}

assert.match(apiJs, /async function assertProjectCapacity/);
assert.match(apiJs, /async function assertStorageCapacity/);
assert.doesNotMatch(apiJs, /Limite de \${limit} projetos ativos atingido para o plano/);
assert.match(apiJs, /STORAGE_LIMIT_REACHED/);
assert.match(apiJs, /Query\.offset/);
assert.match(apiJs, /async function listAllRows/);

assert.doesNotMatch(adminHtml, /planGenerationLimit|userGenerationUsed|userGenerationReset|Limite de gerações|Gerações usadas do plano/);
assert.doesNotMatch(adminJs, /generations:limit-|generations:unlimited|planGenerationLimit|userGenerationUsed|userGenerationReset/);
assert.match(apiJs, /function generationRuleFromPlan\(\) \{\s*return \{ unlimited: true, limit: null \};/s);
assert.match(apiJs, /let effectivePermissions = String\(role \|\| ''\)\.toLowerCase\(\) === 'admin'[\s\S]*?: expandPlanPermissions\(\{ \.\.\.plan, permissions: planPermissions \}, role\);/);
assert.match(apiJs, /if \(isSubuser\)[\s\S]*effectivePermissions = effectivePermissions\.filter/);
assert.match(apiJs, /usersUpdated/);
assert.match(adminHtml, /Criar\/atualizar 6 planos oficiais/);
assert.match(adminJs, /const result = await auth\.dedupePlans\(\);/);
assert.match(apiJs, /path === '\/api\/admin\/plans\/sync-official'/);
assert.match(apiJs, /updateProfileRow\(profile\.\$id, \{ permissions: expectedPermissions, updatedAt: now \}\)/);
assert.doesNotMatch(apiJs, /updateProfileRow\(profile\.\$id, \{[^}]*plan(?:Slug)?\s*:/s);

assert.match(authJs, /projects:unlimited/);
assert.match(layoutJs, /projects:unlimited/);
assert.match(layoutJs, /workspace-plan-diamond/);
assert.match(layoutJs, /aria-label=\"Diamante\"/);
assert.match(layoutJs, /const tierClass = tier \? `is-plan-\$\{tier\}` : '';/);
assert.match(layoutCss, /workspace-plan-status\.is-plan-basic/);
assert.match(layoutCss, /workspace-plan-status\.is-plan-plus/);
assert.match(layoutCss, /workspace-plan-status\.is-plan-pro/);
assert.match(layoutCss, /#b87333/i); // bronze
assert.match(layoutCss, /#8b5cf6/i); // roxo
assert.match(layoutCss, /#fff2b8/i); // dourado claro

console.log('R25: planos anuais com projetos ilimitados, 200 MB/500 MB/1 GB base e cotas comerciais validadas.');
