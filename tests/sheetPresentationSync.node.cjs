const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const src=fs.readFileSync('src/features/croqui/sheetPresentationSync.ts','utf8');
const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const output={exports:{}};
const projector={
 mapPointCoordinates:()=>[{x:112,y:100},{x:912,y:500},{x:512,y:700}],
 renderTechnicalSheet:()=>`<svg><text data-sheet-label="property:title" data-sheet-base-x="100" data-sheet-base-y="100" data-sheet-visual-y="310" x="412" y="310">Sítio teste</text><text data-sheet-label="neighbor:0" data-sheet-base-x="100" data-sheet-base-y="100" data-sheet-visual-y="300" x="300" y="300">Confrontante</text></svg>`,
 normalizeSheet:val=>val
};
const croqui={
 frameCoordinates:()=>[{x:100,y:150},{x:900,y:550},{x:500,y:750}],
 layoutForCroqui:()=>({points:[]})
};
const roadGeometry={
 smoothRoadCenterline:(points)=>points,
 roadBoundaries:(points,width)=>({
  left:points.map(p=>({x:p.x,y:p.y-width/2})),
  right:points.map(p=>({x:p.x,y:p.y+width/2}))
 })
};
const dependencies={'../documents/technicalSheet':projector,'../memorial/croquiRenderer':croqui,'../documents/cloudDraft':{readDocumentDraft:()=>({})},'./croquiGeometry':roadGeometry};
const loader=name=>{if(!dependencies[name])throw Error('Unexpected dependency: '+name);return dependencies[name]};
vm.runInNewContext(code,{exports:output.exports,require:loader,Map,Set,console,Number,Math,Object,Array,RegExp,JSON});
const {applySheetLayout}=output.exports;
const polygon={id:'gleba-a',vertices:[[-40,-13],[-39.99,-13],[-39.99,-12.99]],properties:{}};
const original={background:'satellite',elements:{cotas:{visible:true},vertices:{visible:true},confrontantes:{visible:true},gleba:{visible:false},norte:{visible:true}},
 names:[],neighbors:[],labelOffsets:{},labelColors:{},labelAngles:{},labelSizes:{},absoluteLabels:{},customCotas:[],tarefaM2:0,hiddenVertices:[],neighborDetails:{},lines:[],easements:[],featureStyles:{},featureNames:{},syncRevision:100};
const sheet={revision:110,zoom:15,elements:{cotas:{visible:false,size:90,color:'#000000'},vertices:{visible:true,size:100,color:'#123456'},confrontantes:{visible:true,size:92,color:'#334455'},norte:{visible:true,size:100,color:'#556677'},gleba:{visible:false,size:100,color:'#aabbcc'}},
 names:['V-01','V-02','V-03'],neighbors:['Outro proprietário'],neighborDetails:{},polygonFill:'#ff0000',polygonStroke:'#112233',polygonStrokeWidth:2,hiddenVertices:[2],divisionColors:{},divisionNames:{},labelOffsets:{'property:title':{dx:20,dy:10}},labelColors:{'property:title':'#ff00aa'},labelAngles:{'property:title':45},labelSizes:{'property:title':175},customCotas:[{id:'c1',from:0,to:2,target:'gleba-a'}],tarefaM2:4356,
 technicalLines:[{id:'t1',start:{x:200,y:300},end:{x:400,y:500},color:'#777777'}],sheetRoads:[{id:'r1',points:[{x:200,y:300},{x:400,y:500}],color:'#008800',width:10}]};
const result=applySheetLayout(polygon,original,sheet);
assert.equal(result.labelColors['area:polygon'],'#ff00aa');
assert.equal(result.labelAngles['area:polygon'],45);
assert.equal(result.labelSizes['area:polygon'],175);
assert.equal(result.absoluteLabels['area:polygon'].x,400);
assert.equal(result.absoluteLabels['area:polygon'].y,360);
assert.equal(result.names[2],'V-03');
assert.deepEqual(Array.from(result.hiddenVertices),[2]);
assert.equal(result.customCotas.length,1);
assert.equal(result.easements[0].id,'sheet:r1');
assert.equal(result.easements[0].sourceEdges.left.length,2);
assert.equal(result.easements[0].sourceEdges.right.length,2);
// Each border is transformed consistently, maintaining its separation.
assert.ok(Math.abs(result.easements[0].sourceEdges.left[0].y-result.easements[0].sourceEdges.right[0].y)>0);
assert.equal(result.easements[0].sourceEdges.left[1].x-result.easements[0].sourceEdges.left[0].x,200);
assert.equal(result.autoAreaTitle,false);
assert.equal(applySheetLayout(polygon,original,{...sheet,labelOffsets:{}}).autoAreaTitle,true);
assert.equal(result.lines[0].id,'sheet:t1');
assert.equal(result.elements.cotas.visible,false);
assert.equal(result.polygonFill,'#ff0000');
assert.equal(applySheetLayout(polygon,{...result,syncRevision:120},sheet).syncRevision,120);
const shared={...sheet,divisionVertexNames:{'gleba-a:0:vertex:0':'P-001'},divisionNeighbors:{'gleba-a:0:neighbor:0':'Joana Silva'},hiddenDivisionVertices:{'gleba-a:0:vertex:2':true}};
const composite=applySheetLayout(polygon,original,shared,[],false,true);
assert.equal(composite.names[0],'P-001');
assert.equal(composite.neighbors[0],'Joana Silva');
assert.deepEqual(Array.from(composite.hiddenVertices),[2]);
console.log('SURVEYOR: sincronização de rótulos, estilos, vértices, cotas e servidões aprovada.');
