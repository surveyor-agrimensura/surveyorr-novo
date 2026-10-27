import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout = fs.readFileSync('assets/js/core/layout.js', 'utf8');
const css = fs.readFileSync('assets/css/core/ui.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.match(layout, /function planStatusMeta\(user = authUser\(\)\)/);
assert.match(layout, /function formatPlanDate\(value\)/);
assert.match(layout, /user\.planName \|\| plan\?\.name/);
assert.match(layout, /Ativo até \$\{formattedDate\}/);
assert.match(layout, /Vencido em \$\{formattedDate\}/);
assert.match(layout, /Vence hoje/);
assert.match(layout, /workspace-plan-status/);
assert.doesNotMatch(layout, /if \(!user \|\| isAdminUser\(user\)\) return null;/, 'Administrador não pode ser excluído do indicador');
assert.match(layout, /label: 'Conta administrativa'/);
assert.match(layout, /detail: 'Acesso sem vencimento'/);
assert.doesNotMatch(layout, /\/renovacao\//, 'O indicador não deve apontar para portal/token');
assert.match(layout, /<span class="workspace-plan-status/);
assert.match(layout, /workspace-plan-diamond/);
assert.match(layout, /aria-label=\"Diamante\"/);
assert.doesNotMatch(layout, /tier === 'pro' \? '◆'/, 'Plano Pro deve usar SVG de diamante, não caractere genérico');
assert.match(css, /\.workspace-plan-diamond/);
assert.match(css, /\.workspace-topbar-actions \.workspace-plan-status/);
assert.match(css, /\.workspace-plan-status\.is-warning/);
assert.match(css, /\.workspace-plan-status\.is-expired/);
assert.match(css, /\.workspace-plan-status\.is-admin/);
assert.match(index, /<section class="home-hero"/, 'A tela inicial institucional deve estar presente');
assert.doesNotMatch(index, /Recursos e usos|Sua conta|Projetos recentes|Acesso Rápido/);
assert.match(index, /21\.9\.372-diamante-pro/);

console.log('UI v21.9.379: plano e validade no cabeçalho, com tela inicial institucional preservada.');
