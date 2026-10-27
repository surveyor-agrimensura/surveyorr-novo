import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const vertices = fs.readFileSync('assets/js/features/mapas/vertices.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.doesNotMatch(editor,/data-selected-edge-highlight/,'Selecionar vértice não deve desenhar destaque vermelho no lado do perímetro.');
assert.match(editor,/sv-confrontante-compact-input[\s\S]*Nome do confrontante/,'Confrontante deve ter campo de nome direto em cada lado.');
assert.doesNotMatch(editor,/sv-confrontante-registration-summary sv-confrontante-registration-summary-compact/,'Card principal não deve exibir resumo cadastral redundante.');
assert.match(editor,/segmentVertexDisplayLabel[\s\S]*label\.textContent=`Do \$\{startLabel\} ao \$\{endLabel\}`[\s\S]*sv-confrontante-compact-input/,'Lista principal deve seguir lado → nome usando o identificador real do vértice, deixando ajustes avançados nos três pontos.');

assert.match(editor,/zoomBaseWidth \* zoom/,'Zoom deve alterar a dimensão real da prancha em pixels, sem usar largura percentual da página.');
assert.match(editor,/focusX[\s\S]*focusY[\s\S]*viewport\.scrollTo/,'Zoom deve preservar o foco do documento dentro do viewport.');
assert.match(editor,/sheet\.style\.marginTop = '0'/,'Zoom não deve criar área branca acima da prancha.');
assert.match(css,/\.sv-confrontante-editor-viewport\{[\s\S]*overflow-anchor:none/,'Viewport deve desativar scroll anchoring que deslocava a prancha durante o zoom.');

assert.match(editor,/function updateRangeProgress\(input\)/,'Sliders devem calcular visualmente o progresso real.');
assert.match(css,/--sv-range-progress:0%/,'Sliders devem possuir variável única de progresso.');
assert.match(css,/linear-gradient\(to right,#0f63e9 0 var\(--sv-range-progress\),#d1d5db var\(--sv-range-progress\) 100%\)/,'Preenchimento do slider deve alcançar exatamente o fim quando estiver no máximo.');

assert.match(bridge,/vertexLabelScales:\{\}/,'Bridge deve neutralizar tamanhos individuais antigos dos vértices.');
assert.doesNotMatch(vertices,/labelScales/,'Renderer de vértices não deve mais consumir escalas individuais legadas.');
assert.match(vertices,/data-individual-scale="1"/,'Todos os V-xx devem usar a mesma escala individual unitária.');
assert.match(editor,/const vertexVisual=elementVisual\('vertices'\)[\s\S]*base \* Math\.max\(\.55,Math\.min\(2\.5,Number\(vertexVisual\.scale\)\|\|1\)\)/,'Editor deve usar somente o tamanho geral do cartão Vértices para todos os V-xx.');

assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');
console.log('PASS prancha editor consistency: confrontantes compactos, zoom real, sliders completos e vértices uniformes.');
