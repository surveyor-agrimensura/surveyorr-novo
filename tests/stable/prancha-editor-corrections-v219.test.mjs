import fs from 'node:fs';
import assert from 'node:assert/strict';

const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const docsCss = fs.readFileSync('assets/css/core/documents.css','utf8');
const uiCss = fs.readFileSync('assets/css/core/ui.css','utf8');

assert.match(docsCss,/\.sv-prancha-footer-download-menu\{[\s\S]*right:0;left:auto;[\s\S]*z-index:120/,'Menu Baixar deve abrir para dentro da viewport e acima do rodapé.');
assert.match(docsCss,/is-inline-beta \.sv-confrontante-editor-window\{[\s\S]*overflow:visible/,'Editor inline não pode cortar o menu de download.');
assert.match(editor,/activateTool:setActiveToolPanel/,'Editor deve expor ativação determinística das abas principais.');
assert.match(app,/function bindPranchaInlineNavigation\(modal\)/,'Pranchas devem vincular as abas superiores diretamente ao editor.');
assert.match(app,/stopImmediatePropagation\(\);[\s\S]*activatePranchaInlineTool/,'Clique nas abas deve ter um único controlador.');
assert.match(app,/mapPanel\.dataset\.toolPanel = 'map'/,'Mapa deve ser um painel único.');
assert.match(app,/sectionTitles = \{[\s\S]*elements:'Elementos'[\s\S]*miniMap:'Minimapa'[\s\S]*vertices:'Vértices'[\s\S]*lines:'Linhas técnicas'[\s\S]*servitudes:'Servidões'/,'Mapa deve reunir somente as seções canônicas compactas.');
assert.match(app,/mergeConfrontantesIntoVertices\(modal\)/,'Confrontantes devem ser incorporados ao bloco Vértices.');
assert.match(app,/removeLegacyDimensionPanel\(modal\)/,'Editar cotas legado deve ser removido da Personalização.');
assert.match(editor,/data-editor-download-slot/,'Rodapé deve possuir slot exclusivo para Baixar.');
assert.match(editor,/function markDirty\(value = true\)/,'Editor deve controlar estado alterado/salvo.');
assert.match(editor,/saveButton\.hidden = !hasUnsavedChanges/,'Salvar alterações deve aparecer somente quando houver edição pendente.');
assert.match(editor,/downloadSlot\.hidden = hasUnsavedChanges/,'Baixar deve reaparecer quando a edição estiver salva.');
assert.match(documents,/save\.innerHTML = hasSaved \? 'Salvar rascunho <span aria-hidden=\"true\">✓<\/span>'/,'Status de rascunho deve ficar no próprio botão.');
assert.match(app,/function mountPranchaPreparingShell\(workspace\)/,'Projeto deve montar imediatamente o shell padrão enquanto prepara a primeira cena.');
assert.match(docsCss,/\.sv-prancha-inline-preparing\{[\s\S]*grid-template-columns:clamp\(330px,24vw,365px\) minmax\(0,1fr\)/,'Projeto e Personalização devem compartilhar a mesma proporção visual.');
assert.match(editor,/data-vertex-guide-list/,'Painel de vértices deve listar os lados do perímetro de forma compacta.');
assert.match(editor,/data-vertex-guide-toggle/,'Cada vértice deve possuir checkbox para selecionar o lado correspondente.');
assert.doesNotMatch(editor,/data-selected-edge-highlight/,'Seleção de vértice não deve criar linha vermelha de destaque no perímetro.');
assert.doesNotMatch(editor,/data-selected-edge-distance[\s\S]*min="1" max="10"/,'Painel de vértices não deve reexibir o controle inline de distância do confrontante.');
assert.match(uiCss,/ícones centralizados geometricamente[\s\S]*justify-content:center;gap:0;padding-left:0;padding-right:0/,'Ícones circulares da barra superior devem ficar geometricamente centralizados.');
assert.equal((docsCss.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V219: navegação funcional, download contido, estado Salvar/Baixar, projeto estável, vértices e topbar centralizada.');
