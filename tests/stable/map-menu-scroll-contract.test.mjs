import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8').replace(/!important/g, '');

assert.match(css, /\.gps-point-card-multi\{[^}]*max-height:min\(720px,calc\(100vh - 110px\)\);[^}]*overflow-x:hidden;[^}]*overflow-y:auto;[^}]*scrollbar-gutter:stable;/, 'Marcar pontos deve rolar internamente quando houver muitos pontos/campos.');
assert.match(css, /\.rural-info-panel-scroll\{[^}]*overflow-x:hidden;[^}]*overflow-y:auto;[^}]*scrollbar-gutter:stable;[^}]*flex:1 1 0%;[^}]*height:0;/, 'Informações do imóvel deve possuir rolagem vertical própria sem perder o cabeçalho.');
assert.doesNotMatch(css, /\.rural-info-panel-scroll\{[^}]*overflow-y:auto;[^}]*overflow:hidden;/, 'Rolagem do painel do imóvel não pode ser anulada por overflow hidden no mesmo contrato.');
assert.match(css, /\.confrontante-dialog\{[^}]*max-height:calc\(100vh - 32px\);[^}]*overflow-y:auto;/, 'Cadastro de confrontante deve continuar acessível em telas baixas.');
assert.match(css, /\.map-basemap-list\{[^}]*max-height:min\(360px,calc\(100vh - 86px\)\);[^}]*overflow-y:auto;/, 'Menu de mapa base deve rolar quando necessário.');
assert.match(css, /\.map-download-list\{[^}]*max-height:min\(360px,calc\(100vh - 86px\)\);[^}]*overflow-y:auto;/, 'Menu de downloads deve rolar quando necessário.');
assert.match(css, /\.map-project-list\{[^}]*max-height:min\(420px,calc\(100vh - 92px\)\);[^}]*overflow-y:auto;/, 'Lista de projetos deve rolar quando necessário.');
assert.match(css, /\.sv-smart-search-panel\{[^}]*max-height:min\(420px,calc\(100vh - 92px\)\);[^}]*overflow-y:auto;/, 'Resultados da busca inteligente devem rolar sem cortar opções.');
assert.match(css, /\.sv-search-mode-menu, body\[data-page="mapa\.html"\] \.sv-coordinate-subtype-menu\{[^}]*max-height:min\(360px,calc\(100vh - 92px\)\);[^}]*overflow-y:auto;/, 'Menus de busca/coordenadas devem rolar quando excederem o viewport.');
assert.match(css, /\.sv-map-coordinate-mode-menu\{[^}]*max-height:min\(360px,calc\(100vh - 92px\)\);[^}]*overflow-y:auto;/, 'Menu de modo de coordenadas deve rolar quando necessário.');
assert.match(css, /body\.georural-map-page \.details:not\(\.hidden\)\{[^}]*overflow-y:scroll;[^}]*overflow-x:hidden;[^}]*scrollbar-gutter:stable;/, 'Painel lateral direito Detalhes do elemento deve manter scrollbar vertical permanente e conteúdo acessível.');
assert.match(css, /body\.georural-map-page \.details:not\(\.hidden\)::\-webkit-scrollbar\{[^}]*width:9px;/, 'Scrollbar do painel Detalhes do elemento deve ser visível no Chromium\/Edge.');

console.log('PASS map-menu-scroll-contract: painéis e menus longos do mapa mantêm rolagem interna e ações acessíveis.');
