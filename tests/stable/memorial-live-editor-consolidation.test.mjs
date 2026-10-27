import fs from 'node:fs';
import assert from 'node:assert/strict';

const memorial = fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(memorial,/function setMemorialModelLoading\(active,message='Aplicando modelo…'\)/,'Troca de modelo deve possuir loading dedicado e real.');
assert.match(memorial,/memorialTemplateSelect'\)\?\.addEventListener\('change',async\(\)=>\{[\s\S]*await rebuildMemorialModel\(\)/,'Troca de modelo deve reconstruir integralmente o documento selecionado.');
assert.match(memorial,/function scheduleMemorialLiveRegeneration\(delay=\d+,\{showLoader=false\}=\{\}\)[\s\S]*generate\(\{reason:'live',silent:true\}\)/,'Edições comuns do Memorial devem atualizar silenciosamente e permitir loading apenas nas trocas cartográficas explícitas.');
assert.match(memorial,/function updateMemorialFont\(delta\)[\s\S]*memorialPreviewZoom[\s\S]*scaleMemorialLivePreview\(\)/,'Controle inferior +/- deve atuar apenas como zoom de visualização, sem regenerar o documento.');
assert.match(memorial,/function memorialTechnicalMapMarkup\(mapVisual=\{\},className='standard-template-map'\)[\s\S]*if\(svg\)[\s\S]*memorial-technical-map-vector/,'Mapa do Memorial deve priorizar a prancha SVG vetorial real.');
assert.match(memorial,/\.standard-template-map\.memorial-technical-map-vector\{width:176mm;height:145mm/,'CSS do documento exportado deve conter enquadramento próprio para o mapa vetorial padrão.');
assert.match(memorial,/\.custom-template-map\.memorial-technical-map-vector\{width:168mm;height:150mm/,'Modelos personalizados devem enquadrar o mapa vetorial sem invadir cabeçalho/rodapé.');

assert.match(documents,/\['mapas\.html','pranchas\.html','memorial\.html'\]\.includes\(page\)\) return;/,'Memorial não deve usar o loader genérico a cada alteração de campo.');
assert.match(documents,/data-memorial-footer-right/,'Ações reais do Memorial devem ser encaminhadas para o rodapé canônico da Personalização.');
assert.match(documents,/function setupProjectLivePreview\(workspace\)[\s\S]*\['mapas\.html','pranchas\.html','memorial\.html'\]\.includes\(page\)\) return;/,'Renderizadores vivos próprios não devem receber loader/watcher genérico concorrente na troca de projeto.');
assert.match(mapas,/function projectHasRenderablePerimeter\(project\)/,'Mapas/Pranchas devem distinguir resumo cache-first de projeto geométrico completo.');
assert.match(mapas,/GeoRuralProjects\?\.get\?\.\(id, false\)[\s\S]*refreshIfIncomplete[\s\S]*GeoRuralProjects\?\.get\?\.\(id, true\)/,'Projeto incompleto deve hidratar geometria antes da pré-visualização, com refresh apenas quando necessário.');
assert.match(mapas,/const satellite = isGoogleBackground\(kind\) \|\| kind === 'satClarity' \|\| kind === 'satWayback2023';[\s\S]*arcgisTileBackgroundDataUrl/,'Prévia satélite deve resolver mosaico validado antes de inserir o fundo no SVG.');
assert.match(mapas,/function arcgisTileZoomForViewport\(/,'Exportação cartográfica deve calcular zoom de tile adequado à resolução final.');

assert.match(mapas,/function scheduleMapasLivePreview\(delay=\d+\)/,'Mapas/Croquis deve possuir atualização silenciosa e debounceada.');
assert.match(mapas,/generateSelected\(\{silent:true,livePreview:true,fastPreview:true,preferCache:false\}\)/,'Atualização viva de Mapas/Croquis deve manter a cena editor-ready até a nova estar pronta.');
assert.match(mapas,/function backgroundTileUrl\(kind, service, zoom, row, col\)[\s\S]*return `\$\{base\}\/tile\/\$\{zoom\}/,'Fontes tradicionais devem continuar usando mosaico ArcGIS com rotas válidas.');
assert.match(mapas,/async function resolveBackgroundImage[\s\S]*tileFirst/,'Prévia viva deve resolver fundo cartográfico sem depender de um único endpoint de exportação.');
assert.match(mapas,/const miniMapData = miniKind === 'sat'[\s\S]*fastPreview \? \(cachedMiniMap \|\| miniUrl\)/,'Minimapa rápido deve resolver o mosaico cloudless e manter fallback de cache para os demais mapas.');

for (const [pattern, label] of [
  [/^\.sv-confrontante-editor-toolbar\{/gm,'toolbar técnico'],
  [/^\.sv-confrontante-editor-main\{/gm,'main técnico'],
  [/^\.sv-confrontante-editor-viewport\{/gm,'viewport técnico'],
  [/^body\[data-page="pranchas\.html"\] \.sv-prancha-inline-preparing,$/gm,'shell compartilhado Pranchas/Mapas'],
  [/^body\.sv-document-inline-personalization \.memorial-sign-modal\.is-inline-personalization \.memorial-sign-dialog\{$/gm,'dialog do Memorial'],
  [/^body\.sv-document-inline-personalization \.memorial-sign-modal\.is-inline-personalization \.memorial-sign-dialog-foot\{$/gm,'rodapé do Memorial']
]) {
  const count=(css.match(pattern)||[]).length;
  assert.equal(count,1,`Bloco base duplicado em documents.css: ${label}`);
}

assert.match(documents,/runtimePersonalization:true/,'Memorial/Mapas/Pranchas devem declarar montagem de Personalização em runtime sem placeholder intermediário.');
assert.match(documents,/if \(!spec\.runtimePersonalization\) \{[\s\S]*sv-beta-personalization-placeholder/,'Placeholder genérico só pode existir para módulos sem editor runtime próprio.');
assert.doesNotMatch(memorial,/As opções desta área serão exibidas assim que a etapa Personalização estiver pronta\./,'Memorial não deve piscar mensagem intermediária antes dos controles definitivos.');
assert.match(css,/body\[data-page="mapas\.html"\] #mapPreview\.is-live-svg-preview>svg text,[\s\S]*stroke:none;[\s\S]*paint-order:normal/,'Prévia de Mapas/Croquis deve remover halo/contorno branco da tipografia técnica em tela.');
assert.match(css,/text\[font-weight="800"\][\s\S]*font-weight:600/,'Pesos 800 da prévia técnica devem ser suavizados somente na apresentação em tela.');

for (const [pattern,label] of [
  [/^\.sv-confrontante-editor-window\{/gm,'janela do editor técnico'],
  [/^\.sv-confrontante-editor-modal \.sv-editor-guide-extension\{/gm,'linha técnica do editor'],
  [/^\.sv-confrontante-editor-modal \.sv-editor-guide-handle\{/gm,'handle da linha técnica'],
  [/^\.sv-confrontante-segment-panel-head>div\{/gm,'cabeçalho do painel de confrontante'],
  [/^body\[data-page="loteamentos-reurb\.html"\] \.sv-lote-step-zone\{/gm,'zona de loteamentos'],
  [/^body\[data-page="loteamentos-reurb\.html"\] \.sv-lote-step-zone \.table-wrap\{/gm,'tabela de loteamentos']
]) {
  const count=(css.match(pattern)||[]).length;
  assert.equal(count,1,`Seletor estrutural duplicado em documents.css: ${label}`);
}
assert.match(mapas,/class="sv-technical-footer" fill="#0f172a"/,'Rodapé cartográfico deve declarar texto técnico escuro sem aparência esbranquiçada.');
assert.match(mapas,/font-family="'Segoe UI', Arial, Helvetica, sans-serif"/,'Documentos cartográficos devem usar tipografia de tela consistente com a interface.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS memorial-live-editor-consolidation: modelo, zoom, mapa vetorial, atualização silenciosa e CSS canônico validados.');
