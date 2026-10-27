import fs from 'node:fs';
import assert from 'node:assert/strict';

const homeHtml = fs.readFileSync('index.html','utf8');
const homeCss = fs.readFileSync('assets/home-hero.css','utf8').replace(/!important/g,'');
const uiCss = fs.readFileSync('assets/css/core/ui.css','utf8').replace(/!important/g,'');

assert.ok(homeHtml.includes('class="home-hero"'), 'Home deve usar o hero integral oficial.');
assert.ok(!homeHtml.includes('home-quick'), 'Home não deve manter a antiga seção de acesso rápido.');
assert.ok(homeHtml.includes('class="home-footer"'), 'Rodapé institucional deve permanecer na Home.');
assert.match(homeCss, /\.home-landing\s*\{[\s\S]*?position:fixed;[\s\S]*?inset:var\(--home-topbar\) 0 0;/, 'Home deve ocupar exatamente o viewport abaixo da topbar.');
assert.match(homeCss, /\.home-hero\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) minmax\(380px,520px\)/, 'Hero desktop deve manter texto à esquerda e marca à direita.');
assert.match(homeCss, /\.home-hero-mark img\{[^}]*width:min\(100%,480px\)/, 'Logo principal deve permanecer grande no lado direito.');
assert.match(homeCss, /\.home-footer\{height:var\(--home-footer\);/, 'Rodapé deve ter área própria no viewport, sem depender de scroll.');
assert.match(uiCss, /body\[data-page\]:not\(\[data-page="mapa\.html"\]\):not\(\[data-page="login\.html"\]\):not\(\[data-page="index\.html"\]\) > \.suite > \.main\{/, 'Home deve ser excluída do padding global do shell.');
console.log('PASS home-layout.test.mjs');
