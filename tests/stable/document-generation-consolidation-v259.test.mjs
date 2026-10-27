import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(path,'utf8');
const dimensions=read('assets/js/features/mapas/dimensions.js');
const editor=read('assets/js/core/technical-document-editor.js');
const documents=read('assets/js/core/documents.js');
const projects=read('assets/js/core/projects.js');
const memorial=read('assets/js/features/memorial/app.js');
const mapas=read('assets/js/features/mapas/app.js');
const vertices=read('assets/js/features/mapas/vertices.js');
const bridge=read('assets/js/core/technical-map-bridge.js');
const planialt=read('assets/js/features/planialtimetria/app.js');
const css=read('assets/css/core/documents.css');

assert.match(dimensions,/const useContinuousOutsideChain = options\.lockNormalOffset === true && defaultPlacement === 'outside'/,'Perímetros densos devem manter uma cadeia externa contínua sem depender da quantidade de vértices.');
assert.doesNotMatch(editor,/>Exibir na prancha<\/span>/,'Checkboxes do cadastro de confrontante não devem repetir o texto Exibir na prancha.');
assert.match(editor,/title="Exibir nome da propriedade na prancha"[\s\S]*title="Exibir CPF\/CNPJ na prancha"/,'Checkboxes sem texto devem manter nomes acessíveis independentes.');

assert.match(editor,/function syncZoomSheetAlignment\(viewport, sheet\)/,'Zoom deve possuir alinhamento explícito da folha.');
assert.match(editor,/sheet\.style\.marginLeft = fitsX \? 'auto' : '0'/,'Quando a folha extrapola a largura, o lado esquerdo deve permanecer alcançável.');
assert.match(editor,/const focusY = Math\.max\(0, Math\.min\(1, \(centerClientY - sheetRect\.top\) \/ oldHeight\)\);/,'Zoom deve preservar o ponto visual central da folha sem desviar para margens vazias.');

assert.match(editor,/function mountStandardInlineNavigation\(\)/,'Geradores técnicos devem compartilhar organização compacta da Personalização.');
assert.match(editor,/\['planialtimetria\.html','perimetros\.html','loteamentos-reurb\.html'\]/,'Planialtimetria, Perímetros e Loteamento devem entrar na organização padronizada.');
assert.match(editor,/rail\.replaceChildren\(sheetButton,mapButton,appearanceButton,signatureButton\)/,'Editor técnico padronizado deve expor apenas Prancha, Mapa, Aparência e Assinatura.');

assert.match(mapas,/sv-editor-table-position-controls/,'Tabela técnica deve oferecer movimentação horizontal e vertical na Aparência.');
assert.match(mapas,/coordinateTableX[\s\S]*coordinateTableY/,'Posição da tabela deve reutilizar o estado visual existente nos dois eixos.');
assert.match(css,/\.sv-editor-table-position-controls\{display:grid;grid-template-columns:1fr 1fr/,'Controles horizontal e vertical devem ficar organizados lado a lado.');

assert.match(projects,/async function updateMetadata\(projectId, metadataPatch = \{\}\)/,'Projeto deve possuir atualização oficial de metadados compartilhados.');
assert.match(documents,/const SHARED_PROJECT_PROFILE_FIELDS = Object\.freeze/,'Dados de geração devem possuir um perfil compartilhado central por projeto.');
assert.match(documents,/await window\.GeoRuralProjects\.updateMetadata\(projectId, metadataPatch\)/,'Salvar documento deve sincronizar o perfil na nuvem do projeto.');
assert.match(documents,/sharedProjectSelect[\s\S]*hydrateSharedProjectProfile\(left,sharedProjectSelect\.value\)/,'Ao selecionar o projeto, os campos documentais devem ser reidratados do perfil compartilhado.');
assert.match(memorial,/memOwnerCpf:profile\.ownerCpf\|\|p\.ownerCpf\|\|metadata\.ownerCpf/,'Memorial deve herdar CPF/CNPJ cadastrado no mapa/projeto.');
assert.match(memorial,/memOwnerRg:profile\.ownerRg\|\|p\.ownerRg\|\|metadata\.ownerRg/,'Memorial deve herdar RG cadastrado no mapa/projeto.');

assert.match(documents,/overlay\.innerHTML = '<span class="sv-document-app-loader-spinner"/,'Loading genérico de geração deve ser somente o spinner limpo da autenticação.');
assert.doesNotMatch(documents,/sv-doc-live-loader-card/,'Loader documental antigo em formato de card não deve reaparecer.');
assert.match(memorial,/overlay\.className='sv-document-app-loader'/,'Memorial deve usar o loading global limpo.');
assert.match(css,/\.sv-document-app-loader-spinner\{width:34px;height:34px;border:4px solid rgba\(21,89,191,\.18\)/,'Spinner documental deve seguir as proporções do loading da tela de entrada.');

assert.match(documents,/function syncInlinePersonalizationVisibility\(workspace, betaSelected\)/,'Troca Projeto/Personalização deve limpar editores inline residuais.');
assert.match(documents,/memorial-sign-modal\.is-inline-personalization[\s\S]*modal\.hidden = true/,'Memorial não pode deixar o editor por trás da etapa Projeto.');
assert.match(documents,/sv-confrontante-editor-modal\.is-inline-beta[\s\S]*modal\.hidden = true/,'Geradores técnicos não podem deixar menu/editor invisível interceptando a tela Projeto.');

assert.match(planialt,/async function loadAndRenderSelectedProject\(\)/,'Planialtimetria deve carregar e gerar automaticamente o projeto selecionado.');
assert.match(planialt,/setPlanialtLoading\(true\)[\s\S]*loadSelectedProjectAltitudes\(\)[\s\S]*renderPlanialtimetria\(\)/,'Troca de projeto da Planialtimetria deve carregar dados e renderizar sob loading único.');
assert.match(planialt,/const mapClipId = `\$\{clipId\}-map`/,'Vértices planialtimétricos devem possuir recorte dedicado ao quadro cartográfico.');
assert.match(planialt,/const labelX=Math\.max\(map\.x\+6,Math\.min\(map\.x\+map\.w-28,[\s\S]*const labelY=Math\.max\(map\.y\+10,Math\.min\(map\.y\+map\.h-5/,'Rótulos dos vértices devem ser limitados às bordas do quadro.');
assert.match(planialt,/clip-path="url\(#\$\{mapClipId\}\)"/,'Rótulos/markers planialtimétricos não podem escapar para o topo da folha.');

assert.match(mapas,/SISTEMA DE COORDENADAS<\/text>[\s\S]*GEOGRÁFICAS<\/text>[\s\S]*Datum:<\/text>[\s\S]*Tipo:<\/text>/,'Rodapé de Mapas/Croquis deve distribuir sistema, datum e tipo em linhas próprias.');
assert.match(vertices,/font-weight="500"/,'Rótulos dos vértices devem evitar peso excessivamente forte.');
assert.match(bridge,/font-weight="650"/,'Nome de área deve usar peso técnico moderado.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V259: gerações consolidadas, zoom, cotas densas, dados compartilhados, loader e Planialtimetria padronizados.');
