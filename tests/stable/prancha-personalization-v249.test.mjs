import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const bridge=fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const nativeDoc=fs.readFileSync('assets/js/core/native-technical-document.js','utf8');
const mapApp=fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const controls=fs.readFileSync('assets/js/features/mapa/controls.js','utf8');
const vertices=fs.readFileSync('assets/js/features/mapas/vertices.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');
const prancha=fs.readFileSync('pranchas/index.html','utf8');
const documents=fs.readFileSync('assets/js/core/documents.js','utf8');

assert.match(app,/function ensureProjectSwitchOverlay\(\)/,'Troca de projeto deve usar overlay dedicado.');
assert.match(app,/setProjectSwitchLoading\(true\)[\s\S]*await withTimeout\([\s\S]*refreshPranchaLivePreview[\s\S]*finally[\s\S]*setProjectSwitchLoading\(false\)/,'Loading deve permanecer até a nova prancha concluir a troca.');
assert.match(css,/\.sv-document-project-switch-overlay\{[\s\S]*backdrop-filter:blur\(3px\)/,'Loading de troca deve repetir o padrão opaco com blur do login.');
assert.doesNotMatch(prancha,/id="mapBackground"/,'Prancha não deve manter seletor redundante de mapa de fundo.');
assert.doesNotMatch(documents,/title:'Prancha'[\s\S]{0,180}#mapBackground/,'Personalização da Prancha não deve remontar o seletor removido.');

assert.match(editor,/data-area-name-context-rotation/,'Menu de contexto do nome deve oferecer rotação.');
assert.match(editor,/contextRotation\?\.addEventListener\('input'[\s\S]*item\.rotation=/,'Rotação deve alterar o mesmo areaNames em tempo real.');
assert.match(editor,/data-area-name-context-reset-rotation/,'Menu deve permitir zerar a rotação.');

assert.match(editor,/documentSettings\.elementVisuals=\{\.\.\.normalizeElementVisuals\(documentSettings\),vertices:\{\.\.\.elementVisual\('vertices'\),scale:value\}\}/,'Tamanho geral de Vértices deve atualizar também elementVisuals.vertices.scale.');

assert.match(controls,/vertexLabel: sourceLabel/,'Importação de planilha deve preservar o identificador original do ponto.');
assert.match(mapApp,/importedPointNames,/,'Perímetro criado por planilha deve persistir os nomes dos pontos.');
assert.match(bridge,/function vertexLabelsForFeature\(feature, count = 0\)/,'Rótulos dos vértices devem ter fonte única compartilhada.');
assert.match(vertices,/options\.labels[\s\S]*labels\[point\.index\]/,'Renderer de vértices deve respeitar nomes vindos da planilha.');
assert.match(nativeDoc,/vertexLabels\(project,vertices\.length\)/,'Documento nativo deve usar os mesmos nomes dos vértices.');
assert.match(editor,/segmentVertexDisplayLabel[\s\S]*label\.textContent=`Do \$\{startLabel\} ao \$\{endLabel\}`/,'Confrontantes devem exibir Do V1 ao V2 / Do P1 ao P2 conforme os rótulos reais.');

assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');
console.log('PASS V249: loading de troca, fundo único, rotação de nomes, escala de vértices e rótulos da planilha validados.');
