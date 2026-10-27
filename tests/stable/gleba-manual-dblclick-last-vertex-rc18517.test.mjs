import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const begin = code.indexOf('  function startManualGlebaDrawing()');
const end = code.indexOf('  function buildGlebaPiecesByGuideLine', begin);
assert(begin > 0 && end > begin);
const drawing = code.slice(begin, end);
const from = drawing.indexOf('    function addManualPoint(event) {');
const to = drawing.indexOf('    function onMove(event)', from);
assert(from > 0 && to > from, 'Encontrar os handlers efetivos da gleba manual.');
const realHandlers = drawing.slice(from, to);
assert.match(realHandlers, /const finalClick = pendingManualClick/);
assert.match(realHandlers, /if \(!addManualPoint\(finalClick\)\) return/);

function drawFixture({ invalid = false } = {}) {
  const points = [];
  const timers = new Map();
  const saved = [];
  const toasts = [];
  let timerId = 0;
  const context = {
    points, finished: false, pendingManualClick: null, singleClickTimer: null,
    finishButton: { disabled: true },
    glebaSnapToSourceBoundary: (point) => ({ latlng: point, snapped: !invalid, type: 'free' }),
    sourceFeature: {type:'Feature',geometry:{type:'Polygon',coordinates:[]}},
    almostSamePoint: (a,b) => Boolean(a && b && Math.hypot(a.lat-b.lat,a.lng-b.lng)<0.00001),
    redraw:()=>{},
    toast: (msg, severity)=>toasts.push({msg,severity}),
    turf: {booleanPointInPolygon:()=>!invalid,point: coords=>coords},
    L: {DomEvent:{stop:()=>{}}},
    setTimeout: (fn)=>{const key=++timerId;timers.set(key,fn);return key;},
    clearTimeout: (key)=>timers.delete(key),
    finish: ()=>{ saved.push(points.map(p=>[p.latlng.lat,p.latlng.lng])); context.finished=true; }
  };
  const handlers = vm.runInNewContext(`(function(){${realHandlers};return {onClick,onDoubleClick};})()`,context);
  function click(lat,lng,detail=1) {handlers.onClick({latlng:{lat,lng},originalEvent:{detail}});}
  function doubleClick(lat,lng) {handlers.onDoubleClick({latlng:{lat,lng},originalEvent:{detail:2}});}
  function flushTimers() {for(const [id,fn] of Array.from(timers)){timers.delete(id);fn();}}
  return {points,saved,toasts,timers,context,click,doubleClick,flushTimers};
}

// Reproduz o bug real: três vértices normais e o quarto marcado com duplo clique.
{
  const s=drawFixture();
  for(const [lat,lng] of [[1,1],[1,3],[3,3]]) {s.click(lat,lng);s.flushTimers();}
  assert.equal(s.points.length,3);
  s.click(3,1,1); // primeiro click do par ainda em espera (190 ms)
  s.click(3,1,2); // segundo click do duplo clique é ignorado
  assert.equal(s.points.length,3,'Antes do evento dblclick o último vértice ainda está pendente.');
  s.doubleClick(3,1);
  assert.equal(s.saved.length,1,'Gleba finalizada uma única vez.');
  assert.equal(s.saved[0].length,4,'O quarto vértice precisa ser preservado.');
  assert.deepEqual(Array.from(s.saved[0].at(-1)),[3,1]);
  assert.equal(s.timers.size,0,'Nenhum timer fantasma permanece após finalizar.');
}

// Duplo clique sobre um vértice já registrado não cria ponto duplicado.
{
  const s=drawFixture();
  for(const [lat,lng] of [[1,1],[1,3],[3,3],[3,1]]) {s.click(lat,lng);s.flushTimers();}
  s.click(3,1);s.doubleClick(3,1);
  assert.equal(s.saved[0].length,4);
}

// Fechar sobre o primeiro vértice também não duplica o início do anel.
{
  const s=drawFixture();
  for(const [lat,lng] of [[1,1],[1,3],[3,3],[3,1]]) {s.click(lat,lng);s.flushTimers();}
  s.click(1,1);s.doubleClick(1,1);
  assert.equal(s.saved[0].length,4);
}

// Se o ponto terminal for recusado, NÃO fechar com o triângulo anterior.
{
  const s=drawFixture({invalid: true});
  s.points.push(...[[1,1],[1,3],[3,3]].map(([lat,lng])=>({latlng:{lat,lng},snapType:'free'})));
  s.click(3,1);s.doubleClick(3,1);
  assert.equal(s.saved.length,0,'Rejeitar o ponto final não deve fechar uma gleba incorreta.');
  assert.equal(s.points.length,3);
}

console.log('PASS: duplo clique preserva quarto vértice, não duplica vértices e rejeita final inválido sem fechar.');
