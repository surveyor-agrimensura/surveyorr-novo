import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

// Página inicial institucional: hero simples e menu global, sem painel antigo.
const index = read('index.html');
assert.match(index, /<main class="main" aria-label="Página inicial">[\s\S]*?<section class="home-hero"/);
for (const removed of ['Painel inicial', 'Acervos Oficiais', 'Acesso Rápido', 'Projetos recentes', 'generationLimitPanel', 'recentDocs']) {
  assert.equal(index.includes(removed), false, `A página inicial ainda contém: ${removed}`);
}
assert.equal(index.includes('assets/js/core/projects.js'), false, 'A página inicial ainda carrega o módulo antigo de projetos recentes');
assert.equal(index.includes('suite-v21.'), false, 'A página inicial ainda carrega módulos do painel antigo');

// Menu superior final e ordem solicitada.
const layout = read('assets/js/core/layout.js');
const quickBlock = layout.match(/function topbarQuickLinks\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
const expectedOrder = [
  "label: 'Mapa'",
  "label: 'Projetos'",
  "label: 'Acervos oficiais'",
  "label: 'Suporte'"
];
let lastIndex = -1;
for (const token of expectedOrder) {
  const current = quickBlock.indexOf(token);
  assert.ok(current > lastIndex, `Ordem incorreta no menu superior: ${token}`);
  lastIndex = current;
}
assert.ok(quickBlock.trim().endsWith("].filter((item) => canAccessPermission(item.permission, authUser()));\n  }"));

// Ferramentas não pode repetir itens que já estão no topo.
const toolsBlock = layout.match(/function topbarToolGroups\(\) \{[\s\S]*?\n  \}\n\n  function topbarQuickLinks/)?.[0] || '';
for (const route of ["routeUrl('/mapa/')", "routeUrl('/nuvem/')", "routeUrl('/acervos/')", "routeUrl('/suporte/')", "routeUrl('/orcamentos/')"]) {
  assert.equal(toolsBlock.includes(route), false, `Ferramentas ainda contém ${route}`);
}

// Módulo Orçamentos removido de arquivos, rotas, permissões e código ativo.
for (const relative of ['orcamentos', 'orcamentos.html', 'assets/module-icons/orcamentos.png']) {
  assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} ainda existe`);
}
const activeSources = [
  'assets/js/core/layout.js', 'assets/js/core/portal.js', 'assets/js/core/auth.js', 'assets/js/admin/app.js',
  'assets/js/features/customizacao/app.js', 'customizacao/index.html',
  'assets/js/core/suite.js', 'assets/js/core/downloads.js',
  'functions/surveyor-api/src/main.js', 'login/index.html',
  'nuvem/index.html', 'assets/js/features/cloud/app.js'
];
for (const relative of activeSources) {
  const source = read(relative);
  for (const forbidden of ['/orcamentos/', 'orcamentos:access', 'orcamentos:full', 'generateBudget', 'budgetOutput', 'serviceRows', "data-target=\"orcamento\"", 'value="orcamento"', "orcamento: 'Orçamento'"]) {
    assert.equal(source.includes(forbidden), false, `${relative} ainda contém ${forbidden}`);
  }
}


assert.equal(read('assets/js/features/cloud/app.js').includes('orcamento'), false, 'A pagina Projetos ainda contem codigo de orcamentos');

// Todos os HTMLs públicos devem estar sem rota antiga de Orçamentos.
const htmlFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
};
walk(root);
for (const file of htmlFiles) {
  assert.equal(fs.readFileSync(file, 'utf8').includes('/orcamentos/'), false, `${path.relative(root, file)} ainda aponta para Orçamentos`);
}

// Acervos e módulos principais foram preservados.
assert.equal(fs.existsSync(path.join(root, 'acervos/index.html')), true);
assert.equal(fs.existsSync(path.join(root, 'mapa/index.html')), true);
assert.equal(fs.existsSync(path.join(root, 'nuvem/index.html')), true);
assert.match(read('nuvem/index.html'), /<title>Projetos — Surveyor<\/title>/);

// A limpeza de permissões do backend exige a Function 2.19.359; Worker fica intacto.
assert.match(read('functions/surveyor-api/src/main.js'), /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2';/);
assert.match(read('deploy/cloudflare-geoservices/src/worker.js'), /2\.19\.359-cloudflare-security-hardening/);

console.log('UI v21.9.382: Projetos sem pastas, menu renomeado e interface limpa com sucesso.');
