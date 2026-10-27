import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('assets/css/core/ui.css','utf8').replace(/!important/g,'');
const layoutCss = fs.readFileSync('assets/css/core/layout.css','utf8').replace(/!important/g,'');
const layoutJs = fs.readFileSync('assets/js/core/layout.js','utf8');
const workspaceCss = fs.readFileSync('assets/css/features/mapa/app.css','utf8').replace(/!important/g,'');
const mapCss = fs.readFileSync('assets/css/features/mapa/app.css','utf8').replace(/!important/g,'');
const mapApp = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const propertyExport = fs.readFileSync('assets/js/features/mapa/property-export.js','utf8');

assert.match(ui, /body\.sv-toolmenu-page \.sv-home-nav>a[\s\S]{0,500}border-radius:999px(?:)?/,'navegação superior fora do mapa deve usar pílulas');
assert.match(ui, /body\[data-page="acervos\.html"\] \.sv-acervos-filters button\{[\s\S]{0,260}border-radius:999px(?:)?/,'filtros de Acervos devem ser arredondados');
assert.match(ui,/background-image:url\([\"']\/assets\/module-icons\/projetos\.svg[\"']\)(?:)?/,'Projetos deve usar SVG de ícone real');
assert.match(ui,/background-image:url\([\"']\/assets\/module-icons\/suporte\.svg[\"']\)(?:)?/,'Suporte deve usar SVG de ícone real');
assert.match(ui, /body\[data-page="nuvem\.html"\][\s\S]{0,600}filter:none(?:)?/,'ícones SVG de cabeçalho não podem virar blocos pretos por filtro');

assert.ok(workspaceCss.includes('width:min(760px,calc(100vw - 36px))'),'gaveta de ferramentas deve usar largura compacta sem recorte');
assert.ok(workspaceCss.includes('grid-template-columns:repeat(12,42px)'),'gaveta deve usar grade compacta sem scroll');
assert.match(workspaceCss, /map-quick-tools-drawer\.sv-map-modern-drawer[\s\S]{0,260}overflow:visible(?:)?/,'gaveta desktop não deve criar barra de rolagem interna');
assert.ok(mapCss.includes('.layer-visibility-toggle[data-state="hidden"]'),'olho de camada deve ter estado visual oculto');
assert.ok(mapApp.includes("button.classList.toggle('is-hidden', !visible)"),'estado do olho deve acompanhar visibilidade real');
assert.ok(mapApp.includes("button.classList.add('is-state-changing')"),'troca de olho deve ter feedback animado');


assert.ok(layoutJs.includes('sv-compact-nav-item'),'topbar global deve usar itens compactos por ícone');
assert.match(ui,/sv-home-nav\.sv-compact-nav>a\.active \.sv-compact-nav-label[\s\S]{0,900}opacity:1(?:)?/,'item ativo como Acervos oficiais deve manter o rótulo visível');
assert.match(ui,/transition:max-width \.38s cubic-bezier/,'expansão dos itens do topo deve ser mais suave e menos abrupta');
assert.ok(ui.includes('.official-card:not([hidden])'),'cards filtrados de Acervos não podem forçar display sobre o atributo hidden');
assert.ok(layoutJs.includes('sv-compact-brand-copy'),'marca Surveyor deve expandir nome e subtítulo no hover');
assert.match(layoutCss, /sv-compact-nav-item:hover[\s\S]{0,220}max-width:190px/,'itens compactos devem expandir o rótulo ao passar o mouse');
assert.match(layoutCss, /sv-home-brand\.sv-compact-brand>a:hover[\s\S]{0,180}width:258px/,'logo deve expandir lateralmente no hover');
assert.ok(workspaceCss.includes('#svMapSearchSubmit'),'busca do mapa deve manter lupa integrada ao campo universal');
assert.ok(!workspaceCss.includes('.sv-map-search-mode-menu'),'busca do mapa não deve exibir seletor segmentado de tipo');
assert.ok(mapApp.includes("setCatalogApplyLoading(true)"),'aplicar camada deve ativar loading global');
assert.ok(mapApp.includes("await waitForCatalogLayersVisible(newlyEnabled)"),'loading só deve terminar após a nova camada ficar visível');
assert.ok(mapApp.includes("'Cancelar ferramenta'"),'menu de contexto deve permitir cancelar a ferramenta ativa');
assert.ok(mapApp.includes("sv-map-history-available"),'histórico superior deve depender de histórico real');
assert.ok(mapApp.includes("GEOBAHIA_BOUNDARY_UI_WEIGHT = 1.0"),'Limites de Propriedade devem iniciar com linha fina');
assert.ok(mapApp.includes("GEOBAHIA_BOUNDARY_FILL_OPACITY = 0.16"),'Limites de Propriedade devem ter preenchimento translúcido');
assert.ok(mapApp.includes("GEOBAHIA_BOUNDARY_UI_OPACITY = 0.55"),'transparência oficial deve ser controlada');
const supportJs = fs.readFileSync('assets/js/core/support.js','utf8');
assert.ok(supportJs.includes('hydrateAccountEmail'),'Suporte deve preencher o e-mail usando a conta autenticada');
assert.ok(supportJs.includes("accountUser()?.email"),'e-mail de Suporte deve vir do currentUser da autenticação');
const acervosJs = fs.readFileSync('assets/js/core/ui.js','utf8');
assert.ok(acervosJs.includes("card.hidden=!(okCat&&okQ)"),'filtro de Acervos deve ocultar fisicamente categorias não selecionadas');
assert.ok(acervosJs.includes("return 'rural'"), 'classificação de Imóveis rurais deve existir');
assert.ok(acervosJs.includes("return 'ambiente'"), 'classificação de Ambiente deve existir');
assert.ok(acervosJs.includes("return 'cartografia'"), 'classificação de Cartografia deve existir');

for (const folder of ['GeoJSON','KML','CSV','DXF','WKT','Shapefile']) {
  assert.ok(mapApp.includes(`folder('${folder}')`), `dossiê deve conter ${folder}`);
}
assert.ok(mapApp.includes("'Baixar imóvel (.zip)'"),'menu de contexto deve manter o download do imóvel');
assert.ok(mapApp.includes('await downloadSelectedRuralPropertyPackage();'),'download rápido deve reutilizar o mesmo pacote completo da ficha');
assert.ok(mapApp.includes('const project = currentProjectDossierContext();'),'ZIP deve receber contexto do projeto atual');
assert.ok(propertyExport.includes("'SISTEMA E PROJETO'"),'TXT deve identificar sistema e projeto');
assert.ok(propertyExport.includes('`Número CAR: ${car || \'Não informado\'}`'),'TXT deve conter o número CAR quando disponível');

console.log('PASS interface-polish: navegação arredondada, ícones corretos, gaveta sem scroll, olho reativo, estilo CEFIR e dossiê ZIP verificados.');
