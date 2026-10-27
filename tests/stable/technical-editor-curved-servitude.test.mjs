import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (file) => fs.readFileSync(file, 'utf8');
const editor = read('assets/js/core/technical-document-editor.js');
const bridgeSource = read('assets/js/core/technical-map-bridge.js');
const css = read('assets/css/core/documents.css');

assert.ok(editor.includes('data-editor-action="finish-servitude"'), 'Desenho multiponto deve possuir ação explícita de finalização.');
assert.match(editor, /servitudeDrawState=\{points:\[\],widthG:/, 'Novo desenho deve acumular vários pontos de controle.');
assert.match(editor, /servitudeDrawState\.points\.push/, 'Cada clique deve acrescentar um novo ponto ao eixo da servidão.');
assert.match(editor, /appendManualServitudePoint/, 'Desenho multiponto deve concentrar a adição de pontos em um helper único.');
assert.match(editor, /svg\.addEventListener\('dblclick',dbl,true\)/, 'Duplo clique no último ponto deve finalizar o traçado.');
assert.match(editor, /finishManualServitudeDrawing/, 'Editor deve consolidar os pontos ao finalizar.');
assert.match(editor, /pointsG,widthG/, 'Persistência deve gravar a lista multiponto em geometry-v1.');
assert.match(editor, /servitudePoint/, 'Cada ponto de controle deve continuar editável após a suavização.');
assert.match(editor, /3 ou mais pontos/, 'Interface deve explicar quando a curva automática é aplicada.');
assert.ok(css.includes('.sv-editor-servitude-temp path'), 'Prévia curva deve ser desenhada como path SVG.');
assert.ok(css.includes('stroke-linejoin:round'), 'Junções da curva devem ser visualmente contínuas.');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(bridgeSource, context);
const bridge = context.window.SurveyorTechnicalMapBridge;
assert.equal(typeof bridge.sampleManualServitudeCenterline, 'function', 'Ponte técnica deve expor o mesmo suavizador usado pelo editor e documentos.');
assert.equal(typeof bridge.manualServitudeGeometry, 'function', 'Geometria das duas bordas deve ter uma única implementação compartilhada.');

const curved = {
  id:'srv-curva', coordinateSpace:'geometry-v1', widthG:.06,
  pointsG:[
    {xG:.08,yG:.72},
    {xG:.30,yG:.36},
    {xG:.56,yG:.52},
    {xG:.76,yG:.22},
    {xG:.92,yG:.46}
  ]
};
const geom = bridge.manualServitudeGeometry(curved, {x:100,y:200,w:500,h:300});
assert.ok(geom, 'Traçado multiponto deve produzir geometria documental.');
assert.equal(geom.controlPoints.length, 5, 'Os pontos marcados pelo usuário devem ser preservados como controles editáveis.');
assert.ok(geom.centerline.length > geom.controlPoints.length * 4, 'Curva automática deve amostrar o eixo com densidade maior que a poligonal clicada.');
assert.equal(geom.left.length, geom.centerline.length, 'Borda esquerda deve acompanhar todo o eixo suavizado.');
assert.equal(geom.right.length, geom.centerline.length, 'Borda direita deve acompanhar todo o eixo suavizado.');
assert.deepEqual([geom.centerline[0].x,geom.centerline[0].y], [140,416], 'Curva deve começar exatamente no primeiro ponto marcado.');
assert.deepEqual([geom.centerline.at(-1).x,geom.centerline.at(-1).y], [560,338], 'Curva deve terminar exatamente no último ponto marcado.');

const feature = { geometry:{ type:'Polygon', coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]]] } };
const projector = ([x,y]) => [100+x*50,200+y*30];
const markup = bridge.manualServitudeMarkup(feature, projector, {x:90,y:190,w:520,h:320}, {manualServitudes:[curved]});
assert.equal((markup.match(/class="sv-document-manual-servitude-line"/g)||[]).length, 2, 'Geração final deve continuar contendo só duas bordas.');
assert.equal((markup.match(/<path class="sv-document-manual-servitude-line"/g)||[]).length, 2, 'As duas bordas curvas devem ser paths independentes.');
assert.ok((markup.match(/ L /g)||[]).length > 20, 'Path final deve conter a curva densamente suavizada, não apenas segmentos entre cliques.');
assert.equal(/<polygon/i.test(markup), false, 'Curva documental continua sem polígono preenchido/buffer.');
assert.ok(markup.includes('data-points-g='), 'SVG deve transportar os pontos de controle do traçado multiponto.');

console.log('PASS servidão curva: múltiplos pontos, suavização automática, duas bordas paralelas, controles editáveis e persistência geometry-v1.');
