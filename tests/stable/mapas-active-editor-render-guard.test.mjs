import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const source = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');

const begin = app.indexOf('  function mapasInlineEditorActive()');
const end = app.indexOf('  async function refreshPranchaLivePreview', begin);
assert.ok(begin > 0 && end > begin, 'Localiza fluxos reais de prévia do Mapas.');
const editor = {isActive:()=>true,presentationMode:()=> 'inline', patchLiveFields:(data)=>calls.push(data)};
const calls=[];
const ctx={
  document:{body:{dataset:{page:'mapas.html'}},querySelector:()=>({dataset:{betaPersonalizationSelected:'1'}})},
  technicalDocumentEditor:editor,editorSessionProjectId:'P1',select:{value:'P1'},
  projects:[{id:'P1'}],currentPranchaLiveFieldValues:()=>({mapTitle:'Novo título'}),
  mapasProjectPreviewDeferred:false,mapasLiveBusy:false,mapasLiveQueued:false,
  generateSelected:()=>{calls.push('rebuild');return Promise.resolve(true);},
  window:{setTimeout:()=>1},clearTimeout:()=>{},console,Boolean,String
};
vm.runInNewContext(`${app.slice(begin,end)}\nthis.helpers = {patchMapasEditorLiveFields,refreshMapasLivePreview,mapasInlineEditorActive};`,ctx);
assert.equal(ctx.helpers.patchMapasEditorLiveFields(),true,'Texto deve ser aplicado diretamente na cena em edição.');
assert.equal(calls.length,1);
assert.equal(calls[0].mapTitle,'Novo título');
assert.equal(ctx.mapasProjectPreviewDeferred,true,'Prévia antiga fica marcada para atualizar após sair.');
assert.equal(await ctx.helpers.refreshMapasLivePreview(),false,'O timer antigo não deve iniciar rebuild durante edição.');
assert.equal(calls.filter(v=>v==='rebuild').length,0);
ctx.document.querySelector=()=>({dataset:{betaPersonalizationSelected:'0'}});
assert.equal(await ctx.helpers.refreshMapasLivePreview(),true);
assert.equal(calls.filter(v=>v==='rebuild').length,1,'Fora da edição a prévia volta a atualizar.');
assert.match(app,/if \(control\.tagName === 'SELECT'\) control\.addEventListener\('change',schedule\)/,'Select estrutural dispara somente um change.');

const startMark = source.indexOf('    function markDirty(value = true) {');
const endMark = source.indexOf('    function polygonKeyOf(',startMark);
assert.ok(startMark>0 && endMark>startMark);
const notifications=[];const dirtyCtx={hasUnsavedChanges:false,updatePrimaryActionState:()=>notifications.push('render'),window:{dispatchEvent:(e)=>notifications.push(e.detail.dirty)},CustomEvent:class{constructor(_name,{detail}){this.detail=detail}},safeText:String,optionValue:()=>'',options:{},document:{body:{dataset:{page:'mapas.html'}}}};
vm.runInNewContext(`${source.slice(startMark,endMark)}\nthis.markDirty=markDirty;`,dirtyCtx);
dirtyCtx.markDirty(true);dirtyCtx.markDirty(true);dirtyCtx.markDirty(true);dirtyCtx.markDirty(false);
assert.deepEqual(notifications,['render',true,'render',false],'Não notificar o documento repetidamente quando dirty não mudou.');

const beginDrag=source.indexOf('    function attachStableConfrontanteDrag(svg) {');
const endDrag=source.indexOf('    function attachStableAreaNameDrag(svg)',beginDrag);
assert.ok(beginDrag>0 && endDrag>beginDrag);
const listeners={};const raf=new Map();let nextFrame=1;let updates=0;const segment={id:'s1',labelDx:0,labelDy:0};
const group={dataset:{segmentId:'s1',dx:'0',dy:'0',mapW:'300',mapH:'300'},classList:{add:()=>{},remove:()=>{}},querySelector:()=>({style:{},removeAttribute:()=>{}})};
const svg={contains:()=>true,classList:{contains:()=>false},setPointerCapture:()=>{},addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:()=>{}};
const ctxDrag={
  safeText:String, svgPoint:(_s,e)=>({x:e.clientX,y:e.clientY}),segmentById:()=>segment,
  selectSegmentRow:()=>{},editorEngine:null,updateHistoryControls:()=>{},
  applyOffsetDirect:(_group,dx,dy)=>{updates++;group.dataset.dx=String(dx);group.dataset.dy=String(dy);},
  requestAnimationFrame:(fn)=>{const id=nextFrame++;raf.set(id,fn);return id;},
  cancelAnimationFrame:(id)=>raf.delete(id)
};
vm.runInNewContext(`${source.slice(beginDrag,endDrag)}\nthis.attach=attachStableConfrontanteDrag;`,ctxDrag);
const dispose=ctxDrag.attach(svg);
const target={closest:(selector)=>selector==='.sv-confrontante-callout'?group:null};
listeners.pointerdown({target,clientX:10,clientY:10,pointerId:2,preventDefault(){},stopPropagation(){}});
for(let x=11;x<=40;x++){listeners.pointermove({clientX:x,clientY:20,pointerId:2,preventDefault(){}});}
assert.equal(updates,0,'Muitos eventos no mesmo frame não redesenham rótulos imediatamente.');
assert.equal(raf.size,1,'Eventos de movimento são agrupados em um único frame.');
for(const fn of raf.values()) fn();raf.clear();
assert.equal(updates,1,'Somente última posição do frame é aplicada.');
assert.equal(segment.labelDx,30);
listeners.pointerup({type:'pointerup',clientX:45,clientY:25,pointerId:2});
assert.equal(segment.labelDx,35,'Posição exata do pointerup deve ser preservada.');
assert.equal(raf.size,0,'Nenhum frame pendente após soltar rótulo.');
dispose();
console.log('PASS mapas-active-editor-render-guard: rebuild oculto evitado, atualização leve, dirty estável e arrasto limitado a um frame.');
