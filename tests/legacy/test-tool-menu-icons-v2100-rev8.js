import fs from 'node:fs';

const css = fs.readFileSync('assets/css/core/ui.css', 'utf8');
const layout = fs.readFileSync('assets/js/core/layout.js', 'utf8');
const index = fs.readFileSync('customizacao/index.html', 'utf8');

const required = [
  '.sv-home-tools-menu .tool-icon',
  'width:34px!important',
  'height:34px!important',
  '.sv-home-tools-menu .tool-icon .module-icon-safe',
  'width:24px!important',
  'height:24px!important',
  'grid-auto-rows:56px!important',
  'object-position:center!important'
];
for (const token of required) {
  if (!css.includes(token)) throw new Error(`REV8: regra ausente: ${token}`);
}
if (!layout.includes('<span class="tool-icon">${moduleIcon(item.icon, item.label)}</span>')) {
  throw new Error('REV8: estrutura de ícone do menu Ferramentas foi alterada inesperadamente.');
}
if (!/assets\/css\/core\/surveyor-ui-current-v21\.11\.5\.css\?v=21\.11\.5-(?:customizacao-fix-0818|ui-polish-0820)/.test(index)) {
  throw new Error('REV8: cache-busting do shell não foi atualizado na página inicial.');
}
console.log('OK v21.10.0 REV8: ícones do menu Ferramentas centralizados, dimensionados e alinhados por linha.');
