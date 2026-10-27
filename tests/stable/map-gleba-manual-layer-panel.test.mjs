import fs from 'node:fs';
import assert from 'node:assert/strict';

const mapApp = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const workspace = fs.readFileSync('assets/js/features/mapa/workspace.js', 'utf8');
const mapHtml = fs.readFileSync('mapa/index.html', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8').replace(/!important/g,'');

const manualStart = mapApp.indexOf('function startManualGlebaDrawing()');
const manualEnd = mapApp.indexOf('function buildGlebaPiecesByGuideLine', manualStart);
const manualBlock = mapApp.slice(manualStart, manualEnd);

assert.match(mapHtml, /id="glebaDrawManualPolygon"/, 'Painel de glebas deve expor o desenho manual.');
assert.match(mapApp, /function startManualGlebaDrawing\(/, 'Mapa deve implementar desenho manual de gleba.');
assert.match(mapApp, /glebaSnapToSourceBoundary/, 'Desenho manual deve possuir snap na borda do polígono base.');
assert.match(mapApp, /type: 'vertex'/, 'Snap deve reconhecer vértices.');
assert.match(mapApp, /type: 'edge'/, 'Snap deve reconhecer arestas quando não houver vértice próximo.');
assert.match(manualBlock, /const outsideM2 = areaM2 - \(originalAreaM2 - remainingAreaM2\)/, 'Gleba deve validar o extravasamento por diferença de área, aceitando contato com a borda.');
assert.doesNotMatch(manualBlock, /if \(!turf\.booleanWithin\(feature, sourceFeature\)/, 'Não rejeitar gleba apenas por compartilhar pontos com o perímetro.');
assert.match(mapApp, /points\.length < 3/, 'Gleba manual deve exigir no mínimo 3 pontos para finalizar.');
assert.match(mapApp, /pointMarker\.on\('dblclick'/, 'Duplo clique sobre um ponto marcado deve finalizar a gleba manual.');
assert.match(manualBlock, /map\.on\('dblclick', onDoubleClick\)/, 'A gleba manual deve registrar seu próprio handler de duplo clique.');
assert.doesNotMatch(manualBlock, /nearest\.distance > 18/, 'Duplo clique deve finalizar em qualquer ponto depois do terceiro vértice.');
assert.match(manualBlock, /finishButton\?\.addEventListener\('click', onFinishButton\)/, 'Botão Finalizar gleba deve encerrar o desenho.');
assert.match(manualBlock, /turf\.difference/, 'Gleba manual deve retirar a área desenhada do imóvel original.');
assert.match(manualBlock, /let singleClickTimer = null;/, 'A gleba manual deve possuir timer de clique local, sem depender de outro modo de desenho.');
assert.doesNotMatch(manualBlock, /lastClickAt/, 'A gleba manual não deve referenciar estado de clique inexistente.');
assert.match(manualBlock, /setTimeout\(\(\) => \{[\s\S]*addManualPoint\(pending\)/, 'Clique simples deve ser atrasado, mas seu vértice não pode se perder durante o duplo clique.');
assert.match(manualBlock, /const finalClick = pendingManualClick/, 'O handler de duplo clique deve confirmar o ponto terminal pendente.');
assert.match(mapApp, /ponto livre/, 'Desenho manual deve permitir pontos livres no interior do polígono.');
assert.doesNotMatch(manualBlock, /points\.length\s*>\s*\d+/, 'Desenho manual não deve impor limite máximo de pontos.');

assert.match(workspace, /className = 'sv-layer-header-add'/, 'Adicionar camada deve ficar no cabeçalho do painel.');
assert.doesNotMatch(workspace, /sv-layer-panel-actions[\s\S]*Adicionar camada/, 'Botão grande antigo não deve voltar ao corpo do painel.');
assert.match(mapApp, /data-layer-card-tab="description"/, 'Cartão deve ter aba Descrição.');
assert.match(mapApp, /data-layer-card-tab="edit"/, 'Cartão deve ter aba Editar.');
assert.match(mapApp, /Editar geometria/, 'Aba Editar deve preservar edição geométrica.');
assert.match(css, /\.layer-card-tabs/, 'Layout das abas deve possuir estilo dedicado.');

assert.match(mapApp, /function isLayerLocked\(/, 'Mapa deve possuir estado persistente de bloqueio por camada.');
assert.match(mapApp, /p\.locked = Boolean\(locked\)/, 'Bloqueio deve ser salvo nos metadados oficiais da camada.');
assert.match(mapApp, /className = `layer-lock-toggle\$\{locked \? ' is-locked' : ''\}`/, 'Aba Editar deve expor cadeado por camada.');
assert.match(mapApp, /if \(!requireUnlockedLayer\(targetLayer, 'editar a geometria'\)\) return/, 'Editor geométrico deve recusar camada trancada.');
assert.match(mapApp, /disabled: locked/, 'Controles de estilo devem ser desabilitados quando a camada estiver trancada.');
assert.match(css, /\.layer-actions \.layer-lock-toggle/, 'Cadeado deve possuir estilo dedicado.');

console.log('OK: gleba manual livre, finalização robusta e bloqueio de camadas validados.');
