/** Executable focused regressions without requiring a Vite browser bundle. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
function load(relative,dependencies){
 const module={exports:{}};
 const source=fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 vm.runInNewContext(outputText,{module,exports:module.exports,require:(id)=>{
  if(id in dependencies)return dependencies[id];
  throw new Error(`Unmocked module: ${id}`);
 },console}, {filename:relative});
 return module.exports;
}
const geom={id:'area1',vertices:[[1,2],[2,2],[2,3]],properties:{},areaM2:20000,perimeterM:100};
const reference={
 zoom:10,absoluteLabels:{'area1':{x:130,y:230}},
 confrontantPins:{'john':{x:150,y:240}},
 labelOffsets:{'area1':{dx:8,dy:-4}},vertexOffsets:[{dx:2,dy:3}],
 lines:[{id:'line1',from:0,start:{x:120,y:210},x:140,y:240,color:'#000000'}],
 easements:[{id:'legacy',points:[{x:130,y:230},{x:140,y:235}],width:12,color:'#167c36',sourceEdges:{left:[{x:120,y:220},{x:135,y:225}],right:[{x:125,y:225},{x:140,y:230}]}},
 {id:'geodetic',points:[{x:115,y:215},{x:120,y:220}],geoPoints:[[1,2],[1.1,2.1]],widthMeters:6,width:15,color:'#167c36'}]
};
const zoom=load('src/features/croqui/zoomCroquiOverlays.ts',{
 '../memorial/croquiRenderer':{
  layoutForCroqui:(_poly,settings)=>({zoom:settings.zoom,points:[{x:100+20*(settings.zoom-10),y:200+20*(settings.zoom-10)}]}),
  frameCoordinates:(map)=>map.points
 }
}).zoomCroquiOverlays;
const zoomed=zoom(geom,reference,11,[]);
assert.equal(zoomed.zoom,11);
assert.deepEqual({...zoomed.absoluteLabels.area1},{x:180,y:280});
assert.deepEqual({...zoomed.confrontantPins.john},{x:220,y:300});
assert.deepEqual({...zoomed.labelOffsets.area1},{dx:16,dy:-8});
assert.deepEqual({...zoomed.vertexOffsets[0]},{dx:4,dy:6});
assert.deepEqual({...zoomed.lines[0].start},{x:160,y:240});
assert.deepEqual({...zoomed.easements[0].sourceEdges.left[0]},{x:160,y:260});
assert.equal(zoomed.easements[0].width,24);
assert.equal(zoomed.easements[1].widthMeters,6);
assert.deepEqual(JSON.parse(JSON.stringify(zoomed.easements[1].geoPoints)),[[1,2],[1.1,2.1]]);
const back=zoom(geom,zoomed,10,[]);
assert.ok(Math.abs(back.absoluteLabels.area1.x-reference.absoluteLabels.area1.x)<1e-8);
assert.ok(Math.abs(back.easements[0].points[1].y-reference.easements[0].points[1].y)<1e-8);
assert.equal(reference.zoom,10,'original settings unchanged');

const fakeSheet={revision:7,labelOffsets:{},labelColors:{'division:area1:0:title':'#2255ff','property:area':'#225588'},labelAngles:{'division:area1:0:title':-35},labelSizes:{'division:area1:0:title':65},divisionColors:{},divisionNames:{},divisionVertexNames:{},divisionNeighbors:{},divisionNeighborDetails:{},hiddenDivisionVertices:{},hiddenVertices:[],elements:{cotas:{size:100,color:'#123456',visible:true},gleba:{size:100,color:'#000000',visible:true},vertices:{size:100,color:'#000000',visible:true},confrontantes:{size:100,color:'#000000',visible:true},norte:{size:100,color:'#000000',visible:true}},names:[],neighbors:[],neighborDetails:{},mapNames:[],confrontantPins:{},customCotas:[],technicalLines:[],sheetRoads:[],exteriorCotas:false,polygonFill:'#ffffff',polygonStroke:'#000000',polygonStrokeWidth:1,polygonFillOpacity:0.1,tarefaM2:0};
const croqui={...reference,elements:{...fakeSheet.elements},hiddenVertices:[],neighbors:[],names:[],neighborDetails:{},featureStyles:{},featureNames:{},mapNames:[],customCotas:[],tarefaM2:0,exteriorCotas:false,polygonFill:'#ffffff',polygonStroke:'#000000',polygonStrokeWidth:1};
const presentation=load('src/features/croqui/sheetPresentationSync.ts',{
 '../memorial/croquiRenderer':{layoutForCroqui:()=>({zoom:15,points:[{x:100,y:200},{x:200,y:200},{x:200,y:300}]}),frameCoordinates:(map)=>map.points},
 '../documents/cloudDraft':{readDocumentDraft:()=>({})},
 '../documents/technicalSheet':{mapPointCoordinates:()=>[{x:100,y:200},{x:200,y:200},{x:200,y:300}],renderTechnicalSheet:()=>'<svg><text data-sheet-label="division:area1:0:title" x="160" y="280" data-sheet-visual-y="280">A</text><text data-sheet-label="division:area1:0:area" x="175" y="295">B</text><text data-sheet-label="property:area" x="180" y="310">C</text></svg>',normalizeSheet:x=>x},
 './croquiGeometry':{roadBoundaries:()=>({left:[],right:[]}),smoothRoadCenterline:points=>points}
}).applySheetLayout;
const imported=presentation(geom,croqui,fakeSheet,[{featureId:'area1',partIndex:0,rings:[geom.vertices],properties:{}}],true);
assert.deepEqual({...imported.absoluteLabels.area1},{x:160,y:280});
assert.equal(imported.labelColors.area1,'#2255ff');
assert.equal(imported.labelAngles.area1,-35);
assert.equal(imported.labelSizes.area1,65);
assert.equal(imported.labelColors['area:metrics'],'#225588');
assert.equal(imported.absoluteLabels['division:area1:0:area'],undefined);
const croquiPage=fs.readFileSync(path.join(__dirname,'../src/features/croqui/CroquiPage.tsx'),'utf8');
const pranchaPage=fs.readFileSync(path.join(__dirname,'../src/features/documents/TechnicalSheetsPage.tsx'),'utf8');
assert.match(croquiPage,/aria-label="Cor das cotas externas e seus números"/);
assert.match(pranchaPage,/aria-label="Cor das cotas externas e seus números"/);
console.log('SURVEYOR: 22 checks de zoom de sobreposições, chaves da Prancha e cor das cotas aprovados.');
