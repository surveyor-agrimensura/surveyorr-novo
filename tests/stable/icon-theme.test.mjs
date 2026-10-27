import fs from 'node:fs';
import assert from 'node:assert/strict';

const uiCss = fs.readFileSync('assets/css/core/ui.css','utf8').replace(/!important/g,'');
const layoutCss = fs.readFileSync('assets/css/core/layout.css','utf8').replace(/!important/g,'');

assert.match(uiCss, /\.workspace-page-head>div:first-child:before,\.top>div:first-child:before\{[^}]*background-color:transparent[^}]*box-shadow:none[^}]*filter:grayscale\(1\) brightness\(0\)/, 'Ícones dos cabeçalhos devem ficar pretos e sem badge azul.');
assert.match(uiCss, /\.workspace-shell-v131 \.module-icon-img,[\s\S]*?filter:grayscale\(1\) brightness\(0\);/, 'Ícones de módulos no shell devem ser monocromáticos pretos.');
assert.match(layoutCss, /\.workspace-shell-v131 \.module-icon-img,[\s\S]*?filter:grayscale\(1\) brightness\(0\);/, 'Ícones de módulos no layout administrativo devem ser monocromáticos pretos.');
console.log('PASS icon-theme.test.mjs');
