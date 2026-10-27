import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('mapa/index.html', 'utf8');
const js = fs.readFileSync('assets/js/features/mapa/territorial-navigator.js', 'utf8');
const boot = fs.readFileSync('assets/js/features/mapa/territorial-boot.js', 'utf8');
const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/territorial-navigator.css', 'utf8').replace(/!important/g,'');

assert.match(html, /id="territorialNavigator"/, 'Mapa deve conter a camada territorial isolada.');
assert.match(html, /id="territorialMapCanvas"/, 'Navegação territorial deve usar canvas próprio e não substituir #map.');
assert.match(html, /id="map"/, 'Mapa operacional existente deve continuar presente.');
assert.match(html, /territorial-boot\.js/, 'Boot territorial deve executar antes do mapa para impedir flash do mapa operacional.');
assert.match(html, /territorial-navigator\.css/, 'CSS territorial deve ser carregado somente no módulo de mapa.');
assert.match(html, /territorial-navigator\.js/, 'Runtime territorial deve ser carregado no módulo de mapa.');
assert.doesNotMatch(html, /territorialOperationalBreadcrumb/, 'Mapa operacional não deve manter breadcrumb flutuante legado.');
assert.doesNotMatch(html, /id="territorialNavigatorBtn"/, 'Acesso territorial não deve permanecer como botão duplicado na barra operacional.');
assert.doesNotMatch(html, /data-territorial-search/, 'Navegação não deve manter uma segunda barra de busca própria.');

assert.match(boot, /surveyor-territorial-pending/, 'Boot deve bloquear o mapa operacional antes do primeiro paint.');
assert.match(boot, /get\('project'\)/, 'Projeto explícito não deve receber bloqueio territorial inicial.');
assert.match(boot, /surveyor-territorial-seen-session-v1/, 'Boot deve reconhecer a navegação territorial já mostrada na sessão autenticada.');
assert.match(js, /SESSION_SEEN_KEY = 'surveyor-territorial-seen-session-v1'/, 'Runtime territorial deve marcar exibição por sessão autenticada.');
assert.match(js, /territorialAlreadyShownThisSession\(\)/, 'Retorno ao mapa na mesma sessão deve pular a entrada Brasil.');
assert.match(js, /restoreOperationalView\(\)/, 'Retorno ao mapa deve restaurar centro e zoom operacionais da sessão.');
assert.match(js, /OPERATIONAL_VIEW_KEY = 'surveyor-operational-map-view-session-v1'/, 'Centro e zoom devem usar somente sessionStorage descartável.');
assert.match(app, /BASEMAP_SESSION_KEY = 'surveyor-operational-basemap-session-v1'/, 'Mapa-base escolhido deve ser preservado durante a sessão.');
assert.match(app, /const initialKey = savedBaseMapKey\(\)/, 'Nova montagem do mapa deve recuperar o mapa-base da sessão.');

assert.match(js, /document\.getElementById\('coordSearch'\)/, 'Busca territorial deve reutilizar a busca padrão do mapa.');
assert.match(js, /document\.getElementById\('citySuggestBox'\)/, 'Sugestões territoriais devem reutilizar o dropdown padrão da busca.');
assert.match(js, /ESTADO/, 'Busca padrão deve assumir o contexto ESTADO na visão Brasil.');
assert.match(js, /MUNICÍPIO ·/, 'Busca padrão deve assumir o contexto MUNICÍPIO após selecionar uma UF.');
assert.match(js, /api\/v3\/malhas/, 'Navegação deve usar a API oficial de malhas do IBGE.');
assert.match(js, /api\/v1\/localidades/, 'Nomes municipais devem vir da API oficial de Localidades do IBGE.');
assert.match(js, /intrarregiao=UF/, 'Visão Brasil deve solicitar as UFs oficiais.');
assert.match(js, /intrarregiao=municipio/, 'Visão estadual deve solicitar municípios da UF selecionada.');
assert.match(js, /statesLayer\?\.setStyle\(stateStyle\);[\s\S]*municipalitiesLayer\.bringToFront/, 'UF deve receber municípios sem remover a malha completa do Brasil.');
assert.doesNotMatch(js, /removeLayer\(statesLayer\)/, 'Selecionar UF não pode remover o mapa completo do Brasil.');
assert.match(js, /animateToBounds\(stateBounds/, 'Clique na UF deve usar a transição controlada de centro + zoom.');
assert.doesNotMatch(js, /flyToBounds\(/, 'Navegação territorial não deve usar flyToBounds, evitando o zoom que sai do lugar e volta.');
assert.match(js, /preferCanvas: true/, 'Navegação territorial deve preferir Canvas para reduzir custo de centenas de municípios.');
assert.match(js, /zoomAnimation: true/, 'Navegação territorial deve manter animação de zoom ativa.');
assert.match(js, /fadeAnimation: true/, 'Navegação territorial deve manter fade nativo ativo.');
assert.match(js, /setView\(view\.center, view\.zoom, \{ animate: true, duration \}\)/, 'Transição deve animar centro e zoom sem usar flyToBounds.');
assert.match(js, /svTerritorialMunicipalities/, 'Municípios devem usar pane/renderer próprio para fade leve.');
assert.match(js, /municipalityCache/, 'Malhas municipais recentes devem ser reutilizadas para reduzir travamentos em revisitas.');
assert.match(js, /qualidade=minima/, 'Malha municipal visual deve usar geometria simplificada para reduzir travamentos.');
assert.doesNotMatch(js, /layer\.setStyle\(\{ fillColor: '#277e99'/, 'Hover municipal não deve forçar redraw massivo do Canvas.');
assert.match(js, /new URLSearchParams\(location\.search\)\.get\('project'\)/, 'Projeto aberto por URL deve ser detectado.');
assert.match(js, /if \(projectId\) \{[\s\S]*root\.hidden = true/, 'Projeto explícito deve entrar direto no mapa operacional sem bloquear o fluxo existente.');
assert.match(js, /window\.SurveyorMapRuntime\?\.map \|\| window\.surveyorMapInstance/, 'Transição deve reutilizar o mapa oficial em vez de criar segundo motor operacional.');
assert.match(js, /localStorage\.setItem\(LAST_KEY/, 'Último território pode ser mantido apenas como preferência descartável.');
assert.doesNotMatch(js, /saveLegacy|saveProjectBundle|drawn\.addLayer/, 'Navegação territorial não pode escrever projeto nem geometria oficial.');

assert.match(app, /surveyor-territorial-mode[\s\S]*SurveyorTerritorialNavigator\?\.search/, 'Pesquisa oficial deve delegar ao contexto territorial sem duplicar a barra.');
assert.match(app, /refreshExplicitMode/, 'Ao sair da navegação, a busca padrão deve restaurar seu modo normal.');

assert.match(css, /\.sv-territorial-navigator\{[\s\S]*position:fixed/, 'Camada territorial deve ocupar a viewport sem depender do grid operacional.');
assert.match(css, /surveyor-territorial-pending[\s\S]*#map[\s\S]*visibility:hidden/, 'Mapa operacional deve ficar oculto enquanto a navegação territorial inicializa.');
assert.match(css, /surveyor-territorial-mode \.sv-map-toolbar-modern[\s\S]*visibility:hidden/, 'Barra de ferramentas deve sumir durante Brasil/UF.');
assert.match(css, /surveyor-territorial-mode \.sv-map-search-host[\s\S]*visibility:visible/, 'Busca padrão deve permanecer visível durante Brasil/UF.');
assert.match(css, /prefers-reduced-motion/, 'Animações devem respeitar preferência de movimento reduzido.');
assert.match(css, /--sv-territorial-zoom-duration/, 'Duração do zoom territorial deve ser controlada por uma única variável visual.');

assert.match(js, /TERRITORIAL_PALETTE[\s\S]*stateFill: '#b6c1cb'[\s\S]*municipalityFill: '#9fb7c1'/, 'Paleta territorial deve reproduzir explicitamente a referência visual aprovada.');
assert.match(js, /tooltipPane[\s\S]*zIndex = '960'[\s\S]*popupPane[\s\S]*zIndex = '970'/, 'Tooltip e popup territoriais devem ficar acima das geometrias.');
assert.match(css, /leaflet-tooltip-pane\{z-index:960\}/, 'CSS deve manter tooltip territorial acima da malha municipal.');
assert.match(css, /leaflet-popup-pane\{z-index:970\}/, 'CSS deve manter popup territorial acima de todos os vetores.');
assert.doesNotMatch(css, /\.sv-territorial-map \.leaflet-pane,/, 'CSS não pode rebaixar genericamente todos os panes Leaflet.');
assert.match(js, /statesRenderer = L\.svg/, 'Estados devem usar SVG leve para preservar a leitura visual da V138.');
assert.match(js, /municipalitiesRenderer = L\.canvas/, 'Municípios devem continuar em Canvas para desempenho.');
const ui = fs.readFileSync('assets/js/core/ui.js', 'utf8');
assert.match(ui, /territorial-brazil\.webp/, 'Visão territorial deve manter miniatura real do Brasil.');
assert.doesNotMatch(ui, /<strong>Visão territorial<\/strong><small>/, 'Visão territorial não deve usar card/tipografia diferente das demais opções do menu Mapa.');
assert.match(css, /sv-territorial-entry[\s\S]*grid-template-columns:48px minmax\(0,1fr\) 18px[\s\S]*min-height:48px/, 'Visão territorial deve usar exatamente a mesma grade/altura das opções de mapa-base.');
assert.match(css, /sv-territorial-thumb[\s\S]*width:46px[\s\S]*height:32px/, 'Miniatura territorial deve ter o mesmo tamanho das miniaturas de mapas-base.');
assert.match(css, /svTerritorialMunicipalities-pane[\s\S]*transition:opacity/, 'Malha municipal deve entrar com fade progressivo.');

assert.match(fs.readFileSync('assets/js/core/ui.js', 'utf8'), /territorial-brazil\.webp/, 'Menu Mapa deve usar mini-mapa real do Brasil na Visão territorial.');
assert.match(css, /surveyor-territorial-mode \.geo-brandbar\.map-onebar[\s\S]*background:transparent/, 'Modo territorial deve manter apenas controles flutuantes, sem faixa branca superior.');

assert.match(js, /let hoveredStateLayer = null;/, 'Hover territorial deve rastrear apenas uma UF destacada por vez.');
assert.match(js, /statesLayer\.setStyle\(stateStyle\)[\s\S]*hoveredStateLayer = layer/, 'Novo hover deve restaurar todas as UFs antes de destacar somente a atual.');
assert.match(js, /mouseleave', clearStateHover/, 'Ao sair do mapa, qualquer destaque estadual residual deve ser removido.');

console.log('PASS territorial navigator: animação fluida sem fly-out, pane municipal com fade e cache otimizado.');


assert.match(js, /playOperationalChromeEntrance\(\)/, 'Entrada no mapa operacional deve disparar a animação compartilhada das barras.');
assert.match(js, /surveyor-operational-chrome-enter/, 'Runtime deve controlar uma classe transitória única para a entrada das barras.');
assert.match(css, /@keyframes svOperationalTopBarIn[\s\S]*translate3d\(0,-112%,0\)/, 'Barra superior deve entrar descendo a partir de cima.');
assert.match(css, /@keyframes svOperationalBottomBarIn[\s\S]*translate3d\(0,112%,0\)/, 'Barra técnica inferior deve entrar subindo a partir de baixo.');
assert.match(css, /surveyor-operational-chrome-enter \.geo-brandbar\.map-onebar[\s\S]*svOperationalTopBarIn/, 'Animação superior deve atuar sobre a barra operacional oficial.');
assert.match(css, /surveyor-operational-chrome-enter \.sv-map-technical-bar[\s\S]*svOperationalBottomBarIn/, 'Animação inferior deve atuar sobre a barra técnica oficial.');
