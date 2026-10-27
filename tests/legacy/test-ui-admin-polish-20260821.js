import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(p, 'utf8');
const login = read('login/index.html');
const customCss = read('assets/css/features/customizacao/app.css');
const runtime = read('assets/js/core/ui.js');
const layout = read('assets/js/core/layout.js');
const perimetros = read('assets/js/features/perimetros/app.js');
const admin = read('admin/index.html');
const adminCards = read('admin-cards/index.html');

assert.match(login, /slideshow nítido/);
assert.match(login, /filter:\s*none !important/);
assert.match(customCss, /correção definitiva de espaçamento\/menus/);
assert.match(customCss, /document-picker-summary > div:first-child/);
assert.doesNotMatch(runtime, /suggestion\.innerHTML=.*Sugira um novo acervo/s);
assert.match(runtime, /confrontacao:'<path/);
assert.doesNotMatch(runtime, /'confrontacao':'perimetros'/);
assert.match(layout, /workspace-plan-premium-icon/);
assert.match(perimetros, /loadSelectedProject\(\{ renderNow: false \}\)/);
assert.match(perimetros, /Clique em “Calcular perímetro” antes de salvar ou baixar/);
assert.doesNotMatch(perimetros, /if \(\$\('projectSelect'\)\.value\) render\(\)/);
assert.equal((admin.match(/Cards da Página Inicial/g) || []).length, 1, 'Admin deve ter uma única entrada de Cards da Página Inicial');
assert.match(adminCards, /admin-cards-section-nav/);
assert.match(adminCards, /\/admin\/\?tab=users/);
assert.match(adminCards, /\/admin\/\?tab=advanced-admin/);

console.log('OK ui-admin-polish-20260821');
