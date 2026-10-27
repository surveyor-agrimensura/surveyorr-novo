const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'mapa', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'css', 'features', 'mapa', 'app.css'), 'utf8');

assert(/surveyor-map-current-v21\.11\.5\.css\?v=[^"']+/.test(html), 'Mapa deve manter cache-bust versionado do CSS, sem prender o teste a uma data específica.');
assert(html.includes('<summary role="button" aria-label="Opções de download do elemento selecionado">Download</summary>'), 'Download deve ter semântica explícita de botão.');
assert(/\.details:not\(\.hidden\)\{[\s\S]*?width:min\(340px,calc\(100vw - 22px\)\)!important/.test(css), 'Painel de detalhes deve ter largura desktop compacta de 340px.');
assert(/top:74px!important;right:10px!important;bottom:42px!important/.test(css), 'Painel deve caber entre a barra superior e a barra de status.');
assert(/border-radius:16px!important/.test(css), 'Painel deve usar cantos arredondados no desktop.');
assert(/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/.test(css), 'Ações principais devem ocupar três colunas uniformes.');
assert(/selected-download-menu:not\(\[open\]\) > \.selected-download-list\{[\s\S]*?display:none!important;[\s\S]*?pointer-events:none!important/.test(css), 'Menu Download fechado não pode interceptar cliques.');
assert(/touch-action:manipulation!important/.test(css), 'Botões devem possuir hitbox/touch explícito.');
assert(/#deleteBtn\{[\s\S]*?z-index:6!important/.test(css), 'Excluir deve permanecer acima de elementos auxiliares da barra de ações.');

console.log('OK — painel de detalhes compacto e ações com hitbox integral.');
