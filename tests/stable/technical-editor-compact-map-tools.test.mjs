import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const bridge=fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

for (const id of ['mapShowCotas','mapShowGlebaCotas','mapShowVertices','mapShowConfrontantes','mapShowNorth','mapShowGrid','mapShowScale']) {
  assert.ok(app.includes(`${id}:{`), `Elementos compactos deve conter ${id}.`);
}
assert.match(app,/function mountCompactElementCards\(modal\)/,'Elementos deve possuir montador compacto único.');

assert.match(app,/grid\.classList\.remove\('sv-doc-options-grid'\)/,'Grade compacta deve remover a classe legada que estiliza labels como cards internos.');
assert.match(app,/sv-editor-element-color-control/,'Cor deve usar seletor compacto próprio com swatch e indicador de abertura.');
assert.match(app,/card\.classList\.toggle\('is-active',checkbox\.checked\)/,'Estado visual ativo deve acompanhar o checkbox real.');
assert.match(app,/data-element-visual-key="\$\{meta\.key\}" data-element-visual-scale/,'Cada elemento deve concentrar seu controle de tamanho.');
assert.match(app,/data-element-visual-key="\$\{meta\.key\}" data-element-visual-color/,'Cada elemento deve concentrar seu controle de cor.');
assert.match(app,/mergeConfrontantesIntoVertices\(modal\)/,'Confrontantes devem ser incorporados ao bloco Vértices.');
assert.match(app,/removeLegacyDimensionPanel\(modal\)/,'Painel Editar cotas duplicado deve ser removido.');
assert.doesNotMatch(app,/const PRANCHA_MAP_TOOL_ORDER = \[[^\]]*'dimensions'/,'Editar cotas não deve permanecer no fluxo de ferramentas Mapa.');
assert.doesNotMatch(app,/const PRANCHA_MAP_TOOL_ORDER = \[[^\]]*'confrontantes'/,'Confrontantes não deve permanecer como bloco separado de Vértices.');

assert.match(editor,/row\.className='sv-confrontante-compact-row'/,'Cada lado deve possuir linha compacta de confrontante.');
assert.match(editor,/segmentVertexDisplayLabel[\s\S]*label\.textContent=`Do \${startLabel} ao \${endLabel}`/,'Cada campo deve indicar diretamente os identificadores reais dos vértices do lado correspondente.');
assert.match(editor,/input\.addEventListener\('input',syncName\)/,'Digitação do confrontante deve atualizar ao vivo.');
assert.match(editor,/const liveGroup=ensureManualSegmentCallout\(current\)/,'Nome digitado deve ser aplicado imediatamente ao SVG do mapa.');
assert.doesNotMatch(editor,/data-registration-field="labelScale"|data-registration-field="labelRotation"/,'Cadastro completo não deve repetir controles visuais do rótulo.');
assert.match(editor,/data-confrontante-context-scale[\s\S]*data-confrontante-context-rotation/,'Tamanho e rotação devem ficar no menu contextual do confrontante.');
assert.match(editor,/elementVisuals:normalizeElementVisuals\(value\)/,'Estado visual compacto deve fazer parte das configurações persistidas do documento.');
assert.match(bridge,/elementVisuals: normalizeElementVisuals\(value\)/,'Bridge cartográfica deve preservar os visuais compactos ao recarregar o projeto.');

assert.match(css,/\.sv-editor-element-card\.is-active \.sv-editor-element-toggle\{[\s\S]*background:#0f63e9;[\s\S]*color:#fff/,'Elemento ativo deve ficar azul.');
assert.match(css,/\.sv-editor-element-card:not\(\.is-active\) \.sv-editor-element-controls/,'Elemento inativo deve apresentar controles visualmente apagados.');
assert.match(css,/\.sv-confrontante-compact-row/,'UX compacta de confrontantes deve possuir estilo próprio.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS ferramentas compactas: Elementos concentra tamanho/cor, confrontantes são diretos por lado e Editar cotas duplicado foi removido.');
