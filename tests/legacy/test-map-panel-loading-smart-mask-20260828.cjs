const fs = require('node:fs');
const assert = require('node:assert/strict');

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');
const smartCss = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

assert.match(app, /loading: true,[\s\S]{0,180}showCar: true,[\s\S]{0,80}showSigef: true/, 'CAR/SIGEF devem aparecer já durante a consulta');
assert.match(app, /loading: false,[\s\S]{0,260}showCar: true,[\s\S]{0,80}showSigef: true/, 'CAR/SIGEF devem permanecer visíveis após a consulta, mesmo vazios');
assert.match(app, /panel\.classList\.toggle\('rural-info-loading', Boolean\(loading\)\)/, 'painel deve conhecer estado de carregamento');
assert.match(css, /\.rural-info-panel-scroll\{[\s\S]{0,420}overflow:hidden!important;[\s\S]{0,260}grid-template-rows:/, 'painel principal não deve ter scroll global; deve reservar espaço para os cards');
assert.match(css, /#ruralInfoCar,[\s\S]{0,120}#ruralInfoSigef\{[\s\S]{0,360}overflow-y:scroll!important;/, 'CAR e SIGEF devem ter scroll vertical próprio em cada quadrado');
assert.match(css, /#ruralInfoCar \.registry-section-body,[\s\S]{0,700}max-height:none!important;[\s\S]{0,180}overflow:visible!important;/, 'conteúdo interno não deve criar um terceiro scroll dentro do card');
assert.match(css, /\.rural-info-coordinates dl\{[\s\S]{0,360}overflow-y:auto!important;/, 'quadrado de coordenadas também deve rolar internamente se precisar');
assert.match(css, /rural-info-panel\.rural-info-coordinates-only \.rural-info-panel-scroll\{[\s\S]{0,260}overflow:hidden!important;/, 'estado sem cadastro também não pode voltar ao scroll global');
assert.match(css, /#ruralInfoCar::-webkit-scrollbar,[\s\S]{0,180}width:8px!important/, 'scrollbar individual deve ser visível e compacto no Chromium/Edge');

const fnStart = app.indexOf('  function renderCoordinateFormatSuggestions(value, forceOpen = false) {');
const fnEnd = app.indexOf('\n  const CITY_CACHE_KEY', fnStart);
const selectorFn = app.slice(fnStart, fnEnd);
assert.ok(fnStart >= 0 && fnEnd > fnStart, 'seletor de coordenadas deve existir');
assert.ok(!selectorFn.includes('sv-smart-search-head'), 'seletor deve mostrar somente as opções de formato');
assert.ok(!selectorFn.includes('sv-smart-search-foot'), 'texto explicativo inferior deve ser removido do seletor');
assert.ok(!selectorFn.includes('format.example'), 'exemplos longos devem sair dos cards do seletor');
assert.match(app, /formatCoordinateDraftProgressive\(/, 'máscara progressiva deve existir');
assert.match(app, /if \(selectedCoordinateInputMode && isCoordinateModeDraft\(value\)\) \{[\s\S]*applySelectedCoordinateFormatting\(\);[\s\S]*hideCitySuggestions\(\);/, 'após escolher o formato, digitação deve formatar sem reabrir o menu');
assert.match(smartCss, /\.sv-smart-coordinate-option\{[\s\S]*min-height:38px!important;/, 'opções devem ser compactas');
assert.match(html, /surveyor-map-current-v21\.11\.5\.css\?v=[A-Za-z0-9._-]+/, 'cache-bust deve carregar o CSS corrigido sem prender o teste a uma data antiga');
console.log('OK: painel CAR/SIGEF carrega sempre visível, cada card possui scroll próprio e a busca técnica usa seletor compacto com máscara progressiva.');
