const fs = require('fs');
const assert = require('assert');

const runtime = fs.readFileSync('assets/js/core/ui.js','utf8');
const layout = fs.readFileSync('assets/js/core/layout.js','utf8');
const admin = fs.readFileSync('admin/index.html','utf8');
const router = fs.readFileSync('assets/js/core/router.js','utf8');

assert(fs.existsSync('consulta-car/index.html'), 'Tela /consulta-car/ deve existir');
assert(fs.existsSync('admin-cards/index.html'), 'Tela /admin-cards/ deve existir');
assert.match(layout, /\/consulta-car\//, 'Layout deve conhecer Consulta Pública CAR');
assert.match(runtime, /data-tool-route=\\?"\/consulta-car/, 'Runtime deve garantir Consulta Pública CAR no menu Ferramentas');
assert.match(runtime, /Consulta Pública CAR/, 'Menu agrupado deve renderizar Consulta Pública CAR');
assert.match(admin, /class="admin-route-tab admin-home-cards-tab"[^>]+href="\/admin-cards\/"/, 'Admin deve exibir aba estática para Cards da Página Inicial');
assert.match(router, /"consulta-car"/, 'Legacy router deve reconhecer consulta-car');
assert.match(router, /"admin-cards"/, 'Legacy router deve reconhecer admin-cards');
console.log('OK: Consulta Pública CAR + aba Cards da Página Inicial protegidas contra regressão.');
