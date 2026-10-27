import fs from 'node:fs';
import assert from 'node:assert/strict';

const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const downloads = fs.readFileSync('assets/js/core/downloads.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

const pranchaConfig = documents.slice(documents.indexOf("'pranchas.html':"), documents.indexOf("'planialtimetria.html':"));
assert.match(pranchaConfig,/noFinalStep:true/,'Pranchas deve manter apenas Projeto e Personalização nas abas superiores.');
assert.doesNotMatch(pranchaConfig,/finalTitle:'Baixar'|finalHeading:'Download da prancha'/,'Baixar não pode reaparecer como aba superior.');
assert.match(documents,/function makePranchaFooterDownload\(\)/,'Download deve ter uma única fábrica no rodapé documental.');
assert.match(documents,/target:'printPreviewV19'[\s\S]*target:'downloadSvgV19'[\s\S]*target:'downloadMapWordV197'/,'Rodapé deve reutilizar PDF, SVG e Word oficiais.');
assert.match(documents,/workspace\.querySelector\('\.sv-confrontante-editor-modal\.is-inline-beta \[data-editor-footer-left\]'\)/,'Ações documentais devem migrar para o rodapé do editor inline.');

assert.match(app,/PRANCHA_MAP_TOOL_ORDER = \['elements','miniMap','vertices','lines','servitudes'\]/,'Mapa deve concentrar as funções cartográficas sem blocos redundantes.');
assert.match(app,/mergeConfrontantesIntoVertices\(modal\)/,'Nomes de confrontantes devem ficar incorporados ao bloco Vértices.');
assert.match(app,/removeLegacyDimensionPanel\(modal\)/,'Editar cotas isolado deve ser removido do layout final.');
assert.match(app,/mapButton\.title = 'Mapa'/,'Função Mapa deve ser explícita no menu principal.');
assert.match(app,/mapPanel\.dataset\.toolPanel = 'map'/,'Funções do mapa devem possuir um painel único.');
assert.match(app,/rail\.querySelector\('\[data-editor-tool="zoom"\]'\)\?\.remove\(\)/,'Zoom lateral deve ser removido no editor inline.');
assert.match(app,/drawer\.querySelector\('\[data-tool-panel="zoom"\]'\)\?\.remove\(\)/,'Painel lateral de zoom deve ser removido no editor inline.');
assert.match(app,/rail\.querySelector\('\[data-editor-tool="history"\]'\)\?\.remove\(\)/,'Histórico lateral deve ser removido no editor inline.');

assert.match(editor,/data-editor-footer-left/,'Rodapé deve possuir área de comandos à esquerda.');
assert.match(editor,/data-editor-action="undo"[\s\S]*data-editor-action="redo"/,'Desfazer e refazer devem estar disponíveis no rodapé.');
assert.match(editor,/sv-editor-inline-zoom[\s\S]*data-editor-action="zoom-out"[\s\S]*data-editor-zoom-label[\s\S]*data-editor-action="zoom-in"/,'Zoom deve ficar centralizado no rodapé.');
assert.match(editor,/sheet\.style\.width = `\$\{Math\.round\(zoomBaseWidth \* zoom\)\}px`/,'Zoom deve alterar a dimensão real da prancha sem prioridade forçada.');
assert.ok(!editor.includes("sheet.style.setProperty('width'"),'Zoom da Prancha não pode usar prioridade forçada inline.');

assert.match(css,/\.sv-editor-map-panel[\s\S]*overflow-y:(?:auto|scroll);[\s\S]*overflow-x:hidden/,'Painel Mapa deve concentrar as funções em uma única área rolável.');
assert.match(css,/\.sv-confrontante-editor-footer\{[\s\S]*grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/,'Rodapé deve manter zoom geometricamente central.');
assert.match(css,/\.sv-prancha-footer-download-menu\{[\s\S]*bottom:calc\(100% \+ 7px\)/,'Menu de download deve expandir para cima sem cobrir a prancha.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve continuar sem !important.');

assert.match(app,/window\.SurveyorPranchaExportSource = \(\) => currentPranchaExportSvg\(\)/,'Exportação deve partir da cena vetorial corrente.');
assert.match(downloads,/async function preparedMapDocumentSvg\(preview\)[\s\S]*SurveyorPranchaExportSourceReady/,'PDF/Word devem aguardar a cena vetorial corrente.');
assert.match(downloads,/SurveyorPdfPreview\.renderHtml\(preview, sourceHtml/,'PDF deve ser montado do SVG documental, não de captura da tela.');

console.log('PASS V217: menu Mapa agrupado, zoom/histórico no rodapé e download direto do documento técnico.');
