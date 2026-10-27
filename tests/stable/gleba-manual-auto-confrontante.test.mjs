import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app=fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const html=fs.readFileSync('mapa/index.html','utf8');
const drawing=app.slice(app.indexOf('  function startManualGlebaDrawing()'),app.indexOf('  function buildGlebaPiecesByGuideLine'));
assert.match(html,/id="glebaFinishManualPolygon"[^>]*hidden disabled/,'O botão explícito só deve surgir durante o desenho.');
assert.match(drawing,/finishButton\.hidden = false; finishButton\.disabled = true/);
assert.match(drawing,/finishButton\.hidden = true; finishButton\.disabled = true/);
assert.match(drawing,/map\.on\('dblclick', onDoubleClick\)/);
assert.match(drawing,/drawn\.removeLayer\(sourceLayer\)/,'A fonte deve ser substituída pelo polígono remanescente.');
assert.match(drawing,/turf\.difference\(turf\.featureCollection\(\[sourceFeature, feature\]\)\)/);
assert.match(drawing,/pushUndoSnapshot\(snapshotDrawn\(\)/,'A separação precisa ser desfeita.');

// Executa o handler real. O duplo clique em qualquer ponto termina após 3 vértices.
const doubleClickSrc=drawing.slice(drawing.indexOf('    function onDoubleClick(event) {'),drawing.indexOf('    function onMove(event)'));
function probeDoubleClick(count){
 const state={finished:0,stopped:0,toasts:[]};
 const context={
   points:Array.from({length:count},()=>({latlng:{lat:1,lng:2}})), finished:false,
   singleClickTimer:null,pendingManualClick:null,clearTimeout:()=>{},L:{DomEvent:{stop:()=>state.stopped++}},
   finish:()=>state.finished++,toast:(m)=>state.toasts.push(m)
 };
 const run=vm.runInNewContext(`(function () {${doubleClickSrc}; return onDoubleClick;})()`,context);
 run({latlng:{lat:0,lng:0},originalEvent:{}});
 return state;
}
assert.equal(probeDoubleClick(3).finished,1);
assert.equal(probeDoubleClick(2).finished,0);
assert.equal(probeDoubleClick(2).toasts.length,1);

const first=editor.indexOf('    function namedConfrontantesForLines()');
const end=editor.indexOf('    function clearSelectedLine()',first);
assert(first>0&&end>first);
const src=editor.slice(first,end);
const autoState={names:[{id:'davi',nome:'Davi',startVertex:1,endVertex:30}],technicalLines:[], checkpoints:0, rendered:0, messages:[]};
const select={value:'',options:[],replaceChildren(){this.options=[];this.value='';},appendChild(o){this.options.push(o);}};
const host={hidden:true};const picker={hidden:true};
const modal={querySelector(q){return q==='[data-confrontante-auto-tools]'?host:q==='[data-confrontante-auto-select]'?select:q==='[data-confrontante-auto-picker]'?picker:null;}};
const context={draftSegments:autoState.names,documentSettings:{technicalLines:autoState.technicalLines},modal,overlay:{},
 vertexCountFromOverlay:()=>40,safeText:(s)=>String(s??''),
 document:{createElement:()=>({value:'',textContent:''})},
 vertexAutoLineGeometry:(key)=>({x1:Number(key.slice(2)),y1:1,x2:Number(key.slice(2))+20,y2:11}),
 setTechnicalLineAbsolute:(item,state)=>{Object.assign(item,{x1G:state.x1,y1G:state.y1,x2G:state.x2,y2G:state.y2});},
 normalizeDocumentSettings:v=>v,
 safeCheckpoint:()=>autoState.checkpoints++,renderTechnicalLinePreview:()=>autoState.rendered++,
 updateLineEditControls:()=>{},scheduleNativePublish:()=>{},markDirty:()=>{},
 setGuideStatus:(x)=>autoState.messages.push(x),toast:(x)=>autoState.messages.push(x)
};
const api=vm.runInNewContext(`(function(){${src}return {namedConfrontantesForLines,refreshConfrontanteAutoControls,generateConfrontanteAutoLines};})()`,context);
api.refreshConfrontanteAutoControls();
assert.equal(host.hidden,false,'Com Davi cadastrado o botão Auto aparece.');
assert.equal(select.options.length,2,'O seletor contém opção vazia e o confrontante real.');
select.value='davi';api.generateConfrontanteAutoLines();
assert.equal(context.documentSettings.technicalLines.length,2,'Gera somente duas linhas.');
assert.deepEqual(Array.from(context.documentSettings.technicalLines,x=>x.x1G),[1,30]);
api.generateConfrontanteAutoLines();
assert.equal(context.documentSettings.technicalLines.length,2,'Repetir Auto não duplica as linhas.');
context.draftSegments=[];api.refreshConfrontanteAutoControls();
assert.equal(host.hidden,true,'Sem confrontante o Auto desaparece.');
console.log('PASS: Auto condicionado ao confrontante, duas linhas editáveis, idempotência e gleba com finalização livre/área remanescente.');
