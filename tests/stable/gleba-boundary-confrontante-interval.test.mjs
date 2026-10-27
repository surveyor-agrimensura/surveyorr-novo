import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const start = app.indexOf('    const finish = () => {', app.indexOf('  function startManualGlebaDrawing()'));
const end = app.indexOf('\n    function addManualPoint(',start);
assert(start > 0 && end > start);
const finishSource=app.slice(start,end);
assert.doesNotMatch(finishSource,/manualGlebaInsideSource|if \(!turf\.booleanWithin\(/);

function tryClose({remainingArea=85}={}){
  const toastMessages=[],list=[],state={cleanup:0,undo:0,finished:false};
  const sourceFeature={type:'Feature',geometry:{type:'Polygon',__area:100}};
  const sourceLayer={feature:{properties:{id:'base',name:'imovel',category:'perimetro'}},toGeoJSON:()=>sourceFeature};
  list.push(sourceLayer);
  const context={
    finished:false,points:[{latlng:{lat:0,lng:0}},{latlng:{lat:0,lng:3}},{latlng:{lat:2,lng:3}},{latlng:{lat:2,lng:0}}],
    sourceFeature,sourceLayer,drawn:{getLayers:()=>list.slice(),removeLayer:l=>{const i=list.indexOf(l);if(i>=0)list.splice(i,1);}},
    selectedLayer:null,metadata:l=>l.feature?.properties||{},els:{glebaMapBaseName:{value:'Gleba'}},
    turf:{polygon:coords=>({type:'Feature',geometry:{type:'Polygon',coordinates:coords,__area:15}}),area:obj=>obj?.geometry?.__area??0,
      featureCollection:items=>({features:items}),difference:()=>({type:'Feature',geometry:{type:'Polygon',__area:remainingArea}}),
      polygonToLine:()=>({}),length:()=>.13},
    cleanup:()=>state.cleanup++,toast:(msg,t)=>toastMessages.push([msg,t]),n:(v)=>String(v),id:()=> 'id-new',
    glebaPalette:['#f00'],pushUndoSnapshot:()=>state.undo++,snapshotDrawn:()=>({}),
    L:{geoJSON:(feature)=>({eachLayer(cb){cb({feature});}})},styleFor:()=>({}),addLayer:(layer,props)=>{layer.feature.properties=props;list.push(layer);},
    select:()=>{},currentGlebaFeatureCollection:()=>({}),updateGlebaSourceOptions:()=>{},
    renderGlebaSummary:()=>{},scheduleRecoverySnapshot:()=>{},refresh:()=>{},
    lastGlebaFeatureCollection:null
  };
  const finish=vm.runInNewContext(`(function(){${finishSource};return finish;})()`,context);
  finish();state.finished=context.finished;
  return {state,list,toastMessages};
}
{
  const res=tryClose();
  assert.equal(res.state.finished,true,'Quatro vértices tocando o perímetro devem ser aceitos quando o recorte confirma a área.');
  assert.equal(res.state.undo,1,'Deve registrar histórico uma única vez.');
  assert(res.list.some(l=>l.feature?.properties?.manualGleba),'Gleba criada como área própria.');
}
{
  const res=tryClose({remainingArea:92});
  assert.equal(res.state.finished,false,'Desenho com área fora do polígono não pode ser concluído.');
  assert.equal(res.state.undo,0,'Nenhum perímetro deve ser alterado em caso de extravasamento.');
  assert.match(res.toastMessages.at(-1)[0],/ultrapassa o perímetro/);
}
const from=editor.indexOf('    function forwardConfrontanteRangeIndexes(');
const to=editor.indexOf('    function renderSegmentPanel()',from);
assert(from > 0 && to > from);
const segments=[];
const removed=[];
const context={draftSegments:segments,overlay:{},vertexCountFromOverlay:()=>20,
  safeText:x=>String(x??''),layoutItemSegmentIndexes:(item,count)=>item.segmentIndexes?.length?item.segmentIndexes.slice():[item.startVertex-1],
  clearGuidePreview:id=>removed.push(id),groupForSegment:()=>({remove:()=>{}})
};
const range=vm.runInNewContext(`(function(){${editor.slice(from,to)};return {forwardConfrontanteRangeIndexes,applyConfrontanteRange};})()`,context);
assert.deepEqual(Array.from(range.forwardConfrontanteRangeIndexes(1,13,20)),[0,1,2,3,4,5,6,7,8,9,10,11]);
{
  const main={id:'main',nome:'Davi',startVertex:1,endVertex:2,segmentIndexes:[0]};
  segments.push(main);
  for(let n=2;n<13;n++)segments.push({id:`edge${n}`,nome:'Davi',startVertex:n,endVertex:n+1,segmentIndexes:[n-1]});
  assert.equal(range.applyConfrontanteRange(main,'Davi',1,13).ok,true);
  assert.equal(segments.length,1,'Um único cadastro lógico deve substituir as duplicatas contíguas.');
  assert.equal(main.segmentIndexes.length,12,'O nome vale para todos os doze lados do intervalo.');
  assert.equal(removed.length,11,'Rótulos duplicados precisam ser retirados do SVG.');
}
{
  segments.push({id:'edson',nome:'Edson',startVertex:14,endVertex:15,segmentIndexes:[13]});
  const result=range.applyConfrontanteRange(segments[0],'Davi',1,15);
  assert.equal(result.ok,false,'Não substituir outro confrontante sem autorização.');
  assert.equal(segments.length,2);
}
assert.match(editor,/ownerByEdge\.get\(startVertex-1\)/,'Um registro de intervalo deve preencher todas as caixas correspondentes.');
assert.match(editor,/if\(otherInput && otherInput!==input\)otherInput\.value=typed/,'Campos do mesmo intervalo devem permanecer sincronizados.');
console.log('PASS: borda da gleba aceita com área conservada; extravasamento bloqueado; confrontante de 12 trechos vira um rótulo lógico.');
