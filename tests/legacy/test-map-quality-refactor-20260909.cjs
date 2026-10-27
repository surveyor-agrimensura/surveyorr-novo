const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const workspace = fs.readFileSync('assets/js/features/mapa/workspace.js', 'utf8');
const runtime = fs.readFileSync('assets/js/core/ui.js', 'utf8');
const save = fs.readFileSync('assets/js/features/mapa/save-status.js', 'utf8');
const mapCss = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');
const enhancementCss = fs.readFileSync('assets/css/features/mapa/enhancements.css', 'utf8');
const coreCss = fs.readFileSync('assets/css/core/ui.css', 'utf8');
const layout = fs.readFileSync('assets/js/core/layout.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');

// 1 — estado de salvamento: não ocupa mais uma célula/badge independente.
assert.ok(save.includes("dot.className = 'sv-save-state-dot'"), 'Estado de save deve ser um ponto integrado ao Salvar.');
assert.ok(save.includes('button.appendChild(dot)'), 'Ponto de save deve ser filho do botão Salvar.');
assert.ok(!save.includes('sv-project-save-status'), 'Badge grande autônomo não deve voltar.');
assert.ok(enhancementCss.includes('.sv-save-state-dot'), 'Ponto de status deve possuir estilo dedicado.');

// 2 — espessura: valor do usuário é a fonte de verdade e o CSS final usa a variável da camada.
assert.doesNotMatch(app, /liveDrawCreated\s*&&\s*weight\s*>=\s*5\.5/, 'Espessura não pode cair por heurística legada.');
assert.match(app, /return Math\.max\(1, Math\.min\(10, weight\)\);/, 'Espessura deve apenas ser validada/clampada.');
assert.match(mapCss, /surveyor-final-draw-shape[\s\S]{0,180}stroke-width:var\(--surveyor-layer-weight/, 'Traço final deve respeitar a variável real da camada.');
assert.match(mapCss, /surveyor-direct-editing \.leaflet-pane path\.leaflet-interactive\{[\s\S]{0,120}var\(--surveyor-layer-weight/, 'Edição direta deve preservar a espessura escolhida.');

// 3 — concluir desenho libera a ferramenta e limpa o estado visual moderno.
assert.match(app, /finishSurveyorLiveTool[\s\S]*stopSurveyorLiveTool\(\{ keepActiveTool: false \}\)/, 'Finalização deve encerrar a ferramenta de desenho.');
assert.ok(app.includes("surveyor:map-tool-finished"), 'App deve sinalizar fim do modo de desenho.');
assert.ok(workspace.includes("surveyor:map-tool-finished") && workspace.includes('clearTransientToolbarActive'), 'Toolbar deve limpar o modo ativo ao finalizar.');

// 4 — ações instantâneas não fingem ser modos persistentes.
assert.ok(runtime.includes("if(versions) versions.dataset.svActivation='action'"), 'Versões deve ser ação pontual.');
assert.ok(runtime.includes("verify.dataset.svActivation='action'"), 'Verificar deve ser ação pontual.');
assert.match(workspace, /item\.dataset\.svActivation === 'action'\) clearTransientToolbarActive\(\)/, 'Clique em ação pontual deve limpar destaque persistente.');

// 5 — ocultar/mostrar usa uma única rotina e reaplica aparência persistida.
assert.match(app, /function setDrawnLayerVisibility\(layer, visible\)[\s\S]*map\.addLayer\(layer\)[\s\S]*applyStyleToDrawn\(layer\)/, 'Mostrar deve reaplicar estilo salvo.');
assert.match(app, /toggle\.onclick = \(\) => \{[\s\S]{0,250}setDrawnLayerVisibility\(layer, !currentlyVisible\)/, 'Card deve usar a rotina canônica de visibilidade.');

// 6 — bússola: uma implementação canônica, núcleo central não muda de centro no hover.
assert.ok(mapCss.includes('Controle de orientação do mapa — implementação canônica'), 'Bússola deve possuir implementação canônica única.');
assert.match(mapCss, /orientation-nav-pad\{[\s\S]{0,260}overflow:hidden!important/, 'Pad da bússola deve conter seus elementos.');
assert.match(mapCss, /orientation-compass-core:hover[\s\S]{0,220}transform:translate\(-50%,-50%\)!important/, 'Hover não pode deslocar o centro da bússola.');
assert.match(mapCss, /compass-north-label\{[\s\S]{0,260}transform:translate\(-50%,-50%\)!important/, 'Norte deve permanecer centralizado.');

// 7 — navegação global anexada ao canto do mapa, não popup flutuante solto.
assert.match(mapCss, /map-global-nav\.open,[\s\S]{0,650}left:0!important;top:0!important;bottom:0!important/, 'Menu lateral deve nascer no canto superior esquerdo, cobrindo a origem do hamburger.');
assert.doesNotMatch(mapCss, /map-global-nav\{top:10px!important;left:10px!important/, 'Não deve existir override tardio que faça o menu voltar a flutuar com margem.');
assert.ok(mapCss.includes('border-radius:0 18px 18px 0!important'), 'Menu lateral deve arredondar apenas o lado externo.');

// 8 — rodapé do painel tem hierarquia e espaçamento próprios.
assert.match(mapCss, /\.geo-side-footer\{[\s\S]{0,360}grid-template-columns:9px minmax\(0,1fr\)/, 'Rodapé deve separar status e texto em grade.');
assert.match(mapCss, /\.geo-side-footer small\{[\s\S]{0,220}margin-top:3px!important/, 'Texto secundário deve ter respiro próprio.');

// 9 — detalhes cabem entre toolbar e statusbar, com scroll interno e cantos arredondados.
assert.match(mapCss, /\.details:not\(\.hidden\)\{[\s\S]{0,320}top:74px!important;right:10px!important;bottom:42px!important/, 'Detalhes deve respeitar limites superior/inferior.');
assert.match(mapCss, /\.details:not\(\.hidden\)\{[\s\S]{0,450}width:min\(340px/, 'Painel de detalhes deve ser mais compacto.');
assert.match(mapCss, /\.details:not\(\.hidden\)\{[\s\S]{0,550}border-radius:16px!important/, 'Painel de detalhes deve ter cantos arredondados.');

// 10 — mega menu Ferramentas fica anexado, arredondado e anima sem display:none.
assert.ok(!coreCss.includes('.sv-home-tools-menu.hidden{display:none!important'), 'Mega menu não pode usar display:none se precisa animar a abertura.');
assert.match(coreCss, /Mega menu ancorado à barra superior[\s\S]{0,650}border-radius:0 0 22px 22px!important/, 'Mega menu deve ficar colado à barra com cantos inferiores arredondados.');
assert.match(coreCss, /\.sv-home-tools-menu\.hidden\{[\s\S]{0,260}opacity:0!important[\s\S]{0,260}translateY\(-10px\)/, 'Estado fechado deve permitir animação de fade/slide.');
assert.ok(layout.includes('aria-hidden="true"') && layout.includes("menu?.setAttribute('aria-hidden', open ? 'false' : 'true')"), 'Menu animado deve manter acessibilidade sincronizada.');

// Cache bust: navegador não pode continuar mostrando a versão anterior.
assert.ok(html.includes('20260909-nav-corner-r2'), 'Mapa deve invalidar cache dos assets alterados.');

console.log('PASS: refatoração funcional/visual 2026-09-09 validada nos 10 itens.');
