import fs from 'node:fs';
import assert from 'node:assert/strict';

const layout = fs.readFileSync('assets/js/core/layout.js', 'utf8');
const css = fs.readFileSync('assets/css/core/ui.css', 'utf8').replace(/!important/g,'');
const page = fs.readFileSync('cursos/index.html', 'utf8');

assert.ok(layout.includes("routeUrl('/cursos/')"), 'Topbar global deve incluir o caminho /cursos/.');
assert.ok(layout.includes("label: 'Cursos'"), 'Topbar global deve exibir Cursos.');
assert.ok(layout.includes("icon: 'courses'"), 'Cursos deve usar o ícone próprio na topbar.');
assert.ok(layout.indexOf("routeUrl('/cursos/')") < layout.indexOf("routeUrl('/suporte/')"), 'Cursos deve aparecer antes de Suporte na barra superior.');
assert.ok(page.includes('data-page="cursos.html"'), 'Página Cursos deve declarar o data-page correto.');
assert.ok(page.includes('Cursos e treinamentos'), 'Página Cursos deve ter o título da área.');
assert.ok(page.includes('Em breve'), 'Página Cursos deve comunicar o estado Em breve.');
assert.ok(page.includes('/assets/module-icons/cursos.png'), 'Página Cursos deve usar o ícone de formatura fornecido.');
assert.ok(css.includes('body[data-page="cursos.html"] .sv-courses-preview'), 'Página Cursos deve ter área de cursos em preparação.');
console.log('PASS V49: área Cursos em breve e acesso na topbar global.');
