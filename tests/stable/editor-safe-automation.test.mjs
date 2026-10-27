import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = readFileSync(new URL('../../assets/js/core/technical-document-editor.js', import.meta.url), 'utf8');
function bodyBetween(start, end) {
  const a = editor.indexOf(start), b = editor.indexOf(end, a);
  assert.ok(a > -1 && b > a, `Rotinas esperadas: ${start} / ${end}`);
  return editor.slice(a, b);
}

// Exercitar as funções reais do editor com uma cena SVG mínima, sem browser e
// sem confundir teste de string com teste de comportamento visual.
const geometryCode = bodyBetween('    function autoOrganizeVertices() {', '    function applyRegulatoryPreset(');
const nodes = [
  {dataset: {vertex: 'V-01', offsetDx: '19', offsetDy: '-7'}},
  {dataset: {vertex: 'V-02', offsetDx: '0', offsetDy: '0'}},
  {dataset: {vertex: 'V-03', offsetDx: '0', offsetDy: '0'}}
];
const dimensions = [{dataset:{offsetDx:'25',offsetDy:'-8'}}];
const offsets = {'V-01':{dx:19,dy:-7}};
const docSettings = {vertexScale:1,vertexLabelOffsets:offsets,dimensionLabelOffsets:{'perimeter:1':{dx:25,dy:-8}}};
const scene = new Map([['vertex-label:V-03',{locked:true,data:{dx:0,dy:0}}]]);
let modifiedNodes = 0, lastStatus = '';
const automation = new Function('env', `
  const {overlay, documentSettings, perimeterPointsFromOverlay, polygonCentroid,
    vertexLabelKey, vertexIndexFromKey, vertexLabelBase, applyVertexOffset,
    editorEngine, snapshot, recordDocumentAutomation, scheduleNativePublish,
    markDirty, setGuideStatus} = env;
  ${geometryCode}
  return {autoOrganizeVertices,autoOrganizeDimensions,autoOrganizeLayout};
`)({
  overlay:{querySelectorAll(selector) {return selector === '.sv-vertex-label'?nodes:selector === '.sv-cad-dimension'?dimensions:[];}},
  documentSettings:docSettings,
  perimeterPointsFromOverlay:()=>[{x:0,y:0},{x:120,y:0},{x:45,y:90}],
  polygonCentroid:(a)=>({x:a.reduce((s,p)=>s+p.x,0)/a.length,y:a.reduce((s,p)=>s+p.y,0)/a.length}),
  vertexLabelKey:(node)=>node.dataset.vertex,
  vertexIndexFromKey:(k)=>Number(k.slice(2)),
  vertexLabelBase:(node)=>({x:Number(node.dataset.vertex.slice(2))*12,y:5}),
  applyVertexOffset:(node,dx,dy)=>{node.dataset.offsetDx=String(dx);node.dataset.offsetDy=String(dy); modifiedNodes++;},
  editorEngine:{scene:{get:(key)=>scene.get(key)}},
  snapshot:()=>({settings:JSON.parse(JSON.stringify(docSettings))}),
  recordDocumentAutomation:()=>true,
  scheduleNativePublish:()=>{},markDirty:()=>{},setGuideStatus:(s)=>{lastStatus=s;}
});
assert.equal(automation.autoOrganizeVertices(),1,'Somente o vértice sem posição manual ou bloqueio deve ser deslocado.');
assert.deepEqual(docSettings.vertexLabelOffsets['V-01'],{dx:19,dy:-7},'Offset previamente salvo deve ser preservado.');
assert.equal(nodes[0].dataset.offsetDx,'19','Posição manual do SVG não pode ser modificada.');
assert.ok(docSettings.vertexLabelOffsets['V-02'],'Vértice livre recebe layout automático.');
assert.equal(docSettings.vertexLabelOffsets['V-03'],undefined,'Vértice bloqueado não pode ser organizado.');
assert.equal(modifiedNodes,1);
assert.equal(automation.autoOrganizeDimensions(),0,'Cotas com deslocamento manual não podem ser zeradas.');
assert.deepEqual(docSettings.dimensionLabelOffsets['perimeter:1'],{dx:25,dy:-8});
assert.deepEqual(dimensions[0].dataset,{offsetDx:'25',offsetDy:'-8'});
assert.equal(automation.autoOrganizeLayout(),false,'Nova organização não altera vértices já classificados como posicionados.');
assert.match(lastStatus,/preservados/);

// Validar a transação real que entra no histórico ativo, incluindo seu Undo/Redo.
const transactionCode = bodyBetween('    function recordDocumentAutomation(before, label) {', '    function undoEdit() {');
let current = {segments:[{id:'s',labelDx:12}],settings:{vertexLabelOffsets:{V1:{dx:4,dy:5}}}};
const recorded = [];
const history = [];
const record = new Function('env',`
 const {snapshot,editorEngine,applySnapshot,history,future,updateHistoryControls} = env;
 ${transactionCode}
 return recordDocumentAutomation;
`)({
 snapshot:()=>structuredClone(current),
 editorEngine:{history:{pushExecuted:(command)=>recorded.push(command)}},
 applySnapshot:(state)=>{current=structuredClone(state);},
 history,future:[],updateHistoryControls:()=>{}
});
const previous={segments:[{id:'s',labelDx:7}],settings:{vertexLabelOffsets:{V1:{dx:1,dy:2}}}};
assert.equal(record(previous,'Organizar elementos'),true);
assert.equal(recorded.length,1,'Uma automação deve produzir apenas um comando.');
recorded[0].undo();
assert.deepEqual(current,previous,'Undo restaura o estado completo.');
recorded[0].do();
assert.deepEqual(current,{segments:[{id:'s',labelDx:12}],settings:{vertexLabelOffsets:{V1:{dx:4,dy:5}}}},'Redo reaplica o conjunto completo.');
assert.equal(record(structuredClone(current),'Sem alterações'),false,'Não registrar operação vazia.');
assert.equal(recorded.length,1);

const presetCode=bodyBetween('    function applyRegulatoryPreset(', '    function vertexAutoLineId');
assert.doesNotMatch(presetCode,/autoOrganizeLayout\(/, 'Perfil visual não pode movimentar elementos da prancha.');
assert.match(presetCode,/recordDocumentAutomation\(before,/, 'Perfil deve formar uma transação única.');
console.log('OK: automações conservam posições salvas, rótulos bloqueados, cotas e histórico atômico.');
