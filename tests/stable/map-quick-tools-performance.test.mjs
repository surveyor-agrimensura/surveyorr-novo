import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('assets/css/features/mapa/app.css','utf8').replace(/!important/g,'');

assert.match(css,/#mapQuickToolsDrawer\.map-quick-tools-drawer\{[\s\S]*background:rgba\(242,247,250,\.90\);[\s\S]*backdrop-filter:none;[\s\S]*contain:layout paint style;/,'Drawer aberto deve preservar o visual fosco sem aplicar backdrop-filter sobre o mapa vivo.');
assert.match(css,/#mapQuickToolsDrawer\.map-quick-tools-drawer \.map-quick-tools-grid\{[\s\S]*contain:layout paint;/,'Grade de ferramentas deve ficar isolada de repaint externo.');
assert.match(css,/#mapQuickToolsDrawer\.map-quick-tools-drawer \.map-quick-tools-grid button,[\s\S]*transition:background-color \.12s ease,border-color \.12s ease,color \.12s ease;[\s\S]*transform:none;/,'Botões não devem animar transform/sombra pesada durante interação com o mapa.');
console.log('map quick tools performance: ok');
