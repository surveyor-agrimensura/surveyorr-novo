import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('mapa/index.html','utf8');
const app = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const workspace = fs.readFileSync('assets/css/features/mapa/app.css','utf8').replace(/!important/g,'');
const layerLocation = fs.readFileSync('assets/css/features/mapa/layer-location.css','utf8').replace(/!important/g,'');
const publicCss = fs.readFileSync('assets/css/features/public-project/public-project.css','utf8').replace(/!important/g,'');

assert.match(html,/data-draw-tool="servitude"[^>]*>Desenhar servidão</,'Popover Desenhar deve possuir ferramenta dedicada de servidão.');
assert.doesNotMatch(html,/id="generateServitudeBtn"/,'Fluxo antigo Linha -> Gerar servidão deve ser removido da interface.');
assert.match(html,/id="servitudeRoadName"/,'Painel da servidão deve permitir revisar a identificação da via.');
assert.match(html,/id="servitudeWidthMeters"/,'Painel da servidão deve permitir ajustar a largura total.');
assert.match(app,/if \(tool === 'servitude'\) \{ startSurveyorLiveTool\('servitude', button\); return; \}/,'Ferramenta dedicada precisa iniciar o motor de desenho.');
assert.match(app,/servitudeDedicatedTool: true,[\s\S]*servitudeGenerated: true,[\s\S]*servitudeWidthMeters: 6/,'Servidão criada pela ferramenta deve nascer como fonte oficial única com largura persistente.');
assert.match(app,/category: 'outros', name: els\.areaName\.value\.trim\(\) \|\| 'Linha técnica'/,'Linha genérica não pode mais nascer como Estrada/servidão.');
assert.match(app,/els\.detailCategory\.disabled = locked \|\| dedicatedServitude/,'Categoria da servidão dedicada deve ficar fixa, eliminando conversão manual por categoria.');
assert.match(app,/function detectServitudeRoadIdentity\(layer, options = \{\}\)/,'Servidão deve possuir detecção automática da via.');
assert.match(app,/nominatim\.openstreetmap\.org\/reverse/,'Detecção deve consultar reverse geocoding no ponto central do traçado.');
assert.ok(app.includes("const brMatch = sourceText.match(/\\bBR[\\s-]?(\\d{1,4})\\b/i);"),'Detecção deve reconhecer referências federais BR.');
assert.match(app,/function renderServitudeDerivedOverlays\(\)/,'Faixa deve ser reconstruída como visual derivado da linha.');
assert.match(app,/turf\.buffer\(feature, width \/ 2, \{ units: 'meters', steps: 16 \}\)/,'Corredor visual deve respeitar metade da largura em cada lado da linha.');
assert.match(app,/function migrateLegacyServitudePolygons\(\)/,'Versões anteriores com polígono de servidão devem ser migradas.');
assert.match(app,/filter\(\(layer\) => !isLegacyGeneratedServitudeLayer\(layer\)\)/,'Payload remoto não pode persistir o antigo polígono derivado da servidão.');
assert.match(workspace,/details:not\(\.hidden\) \.detail-actions\{[\s\S]*background:transparent;[\s\S]*border-top:0/,'Rodapé de ações deve ficar transparente, sem placa branca.');
assert.match(workspace,/details:not\(\.hidden\) \.detail-actions button,[\s\S]*background:#fff/,'Somente os botões devem manter fundo branco.');
assert.match(layerLocation,/#layerCatalogDialog\.choosing-location \.catalog-dialog-tabs,[\s\S]*#layerCatalogDialog\.choosing-location \.catalog-dialog-panel\{[\s\S]*display:none;[\s\S]*visibility:hidden/,'Escolha de estado deve ocultar completamente abas e conteúdo inferior do catálogo.');
assert.match(publicCss,/public-sidebar \.public-stats>div,[\s\S]*public-sidebar \.public-layer-item,[\s\S]*public-sidebar \.public-details\{[\s\S]*background:transparent;[\s\S]*border:0/,'Página pública deve remover cartões brancos redundantes da lateral.');

console.log('PASS map-servitude-catalog-public: criação dedicada de servidão, detecção de via, persistência segura e interface enxuta validadas.');
