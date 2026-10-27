import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8').replace(/!important/g,'');
const html = read('mapa/index.html');
const workspaceCss = read('assets/css/features/mapa/app.css');
const layersCss = read('assets/css/features/mapa/layers.css');
const enhancementsCss = read('assets/css/features/mapa/enhancements.css');
const auditJs = read('assets/js/features/mapa/audit.js');
const mapJs = read('assets/js/features/mapa/app.js');
const interfaceJs = read('assets/js/features/mapa/interface.js');
const mapCss = read('assets/css/features/mapa/app.css');

for (const id of ['saveBtn','toggleLayersPanel','topQuickPolygonBtn','mapQuickToolsToggle']) {
  assert.match(html, new RegExp(`id="${id}"`), `controle principal do mapa ${id} deve permanecer`);
}

assert.match(html, /id="mapGlobalNavToggle"[\s\S]*sv-map-menu-hamburger/, 'menu global deve usar hambúrguer próprio e visível');
assert.match(mapCss, /#mapGlobalNavToggle \.sv-map-menu-hamburger i\{[^}]*background:(?:currentColor|#18324f)/, 'três traços do menu não podem depender de SVG');
assert.match(workspaceCss, /#mapGlobalNavToggle\.map-global-nav-toggle\{[\s\S]*position:fixed;[\s\S]*z-index:50050/, 'hambúrguer deve ficar fixo acima da barra mesmo com zoom');
assert.match(workspaceCss, /\.map-global-nav\.open[\s\S]*z-index:50020/, 'menu lateral deve ficar abaixo do botão que o controla');
assert.match(workspaceCss, /@media \(max-width:1180px\)[\s\S]*#mapGlobalNavToggle|@media \(max-width:1180px\)[\s\S]*padding-left:62px/, 'layout reduzido deve reservar o canto do menu');
assert.match(mapJs, /L\.map\('map',[\s\S]*layers: \[\]/, 'mapa principal não deve abrir tiles antes do load da página');
assert.match(mapJs, /mountInitialBaseMapAfterDocumentLoad[\s\S]*window\.addEventListener\('load'/, 'mapa base deve ser montado após o load do documento');
assert.match(interfaceJs, /mountMiniMap[\s\S]*window\.addEventListener\('load'/, 'minimapa deve adiar tiles remotos até depois do load');
assert.match(html, /id="projectDescription"/, 'painel Projeto deve conter descrição opcional');
assert.doesNotMatch(html, /class="details-kicker"/, 'painel de detalhes não deve duplicar o título técnico');
const uiJs = read('assets/js/core/ui.js');
assert.match(uiJs, /details-handle-title[\s\S]*label\.textContent = 'Detalhes do elemento'[\s\S]*handle\.append\(title\)[\s\S]*handle\.append\(close\)/, 'cabeçalho técnico deve concentrar título e botão X no topo');
assert.match(html, /id="copyCoordsBtn"/, 'detalhes devem oferecer cópia das coordenadas');
assert.match(html, /data-detail-tab="description"/, 'detalhes devem expor aba Descrição');
assert.match(html, /data-detail-tab="edit"/, 'detalhes devem expor aba Editar');
assert.match(html, /id="clearCatalogSelection"/, 'catálogo deve oferecer limpar seleção');
assert.match(html, /class="sv-audit-dialog-head"/, 'verificação deve usar cabeçalho do novo layout');
assert.match(html, /gleba-definition-card/, 'Gleba deve ter cartão de definição');
assert.match(html, /gleba-draw-card/, 'Gleba deve ter cartão de desenho');
assert.match(html, /gleba-info-card/, 'Gleba deve ter cartão de informações');
assert.match(html, /gleba-heirs-card/, 'Gleba deve ter cartão de herdeiros');

assert.match(workspaceCss, /--panel-w:400px/, 'painel lateral deve voltar à base estável anterior e continuar controlado por --panel-w');
assert.match(interfaceJs, /panelWidth: 344/, 'preferência inicial estável do painel deve voltar a 344 px');
assert.match(interfaceJs, /Math\.max\(280, Math\.min\(520, event\.clientX - left\)\)/, 'redimensionamento original do painel deve permanecer disponível na faixa estável');
const workspaceJs = read('assets/js/features/mapa/workspace.js');
assert.match(workspaceJs, /enhanceLayersPanel\(\);[\s\S]{0,180}closePanel\(\);/, 'mapa deve continuar iniciando com o painel recolhido como na base estável');
assert.match(workspaceCss, /body\.georural-map-page \.geo-workspace\.panel-collapsed\{grid-template-columns:0 minmax\(0,1fr\);?\}/, 'painel recolhido deve voltar ao colapso estrutural estável sem regras experimentais');
assert.match(workspaceCss, /body\.georural-map-page \.geo-sidepanel\.collapsed\{width:0;min-width:0;border-right:0;box-shadow:none;?\}/, 'painel recolhido deve voltar ao comportamento estável original');
assert.doesNotMatch(workspaceCss, /RC117\/V169|height:auto;[\s\S]{0,160}max-height:calc\(100vh - var\(--sv-map-operational-toolbar-height\) - 24px\)/, 'regras experimentais de altura por conteúdo não devem permanecer');
assert.match(workspaceCss, /\.details\{[\s\S]*top:78px;[\s\S]*width:420px/, 'detalhes devem ser painel técnico à direita com largura otimizada');
assert.match(workspaceCss, /map-quick-tools-drawer\.sv-map-modern-drawer[\s\S]*width:min\(760px,calc\(100vw - 36px\)\)[\s\S]*overflow:visible/, 'expansão de ferramentas deve usar a largura canônica sem scroll interno no desktop');
assert.match(workspaceCss, /grid-template-columns:repeat\(12,42px\)/, 'ferramentas rápidas devem usar a malha canônica compacta no desktop');
assert.match(layersCss, /width:min\(1160px,calc\(100vw - 36px\)\)/, 'catálogo deve usar o novo modal amplo');
assert.match(enhancementsCss, /\.sv-audit-counters/, 'verificação deve exibir contadores técnicos');
assert.match(auditJs, /svAuditFilter/, 'verificação deve permitir filtro visual');
assert.match(mapJs, /projectDescription/, 'descrição do projeto deve participar do fluxo real');
assert.match(mapJs, /copyCoordsBtn/, 'botão de copiar coordenadas deve estar funcional');

assert.doesNotMatch(html, /Ambiente conectado/, 'painel lateral não deve exibir rodapé redundante de conexão');
assert.doesNotMatch(html, /sv-advanced-tool-card[\s\S]{0,500}<small>/, 'cartões de ferramentas avançadas não devem repetir descrições explicativas');
assert.match(mapCss, /\.mega-minimap\{[^}]*width:132px;[^}]*height:108px;/, 'minimapa deve permanecer compacto no desktop');
assert.match(workspaceCss, /body\.georural-map-page \.geo-sidepanel\{[^}]*grid-template-rows:58px minmax\(0,1fr\);?/, 'painel lateral não deve reservar linha para rodapé removido');

console.log('PASS map layout: painéis, catálogo, auditoria e Gleba seguem a nova interface sem trocar a barra superior.');
