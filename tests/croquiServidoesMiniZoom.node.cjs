'use strict';
// Regression on real renderers without Appwrite credentials or a browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const cache=new Map();
function load(input){
 const file=path.resolve(input);
 if(file.endsWith('?raw'))return fs.readFileSync(file.slice(0,-4),'utf8');
 if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 function localRequire(id){
  if(!id.startsWith('.'))return require(id);
  const target=path.resolve(path.dirname(file),id);
  if(target.endsWith('?raw'))return fs.readFileSync(target.slice(0,-4),'utf8');
  for(const f of [target,target+'.ts',target+'.tsx',target+'.js'])if(fs.existsSync(f)&&fs.statSync(f).isFile())return load(f);
  throw Error('Missing '+id+' from '+file);
 }
 vm.runInNewContext(js,{module:mod,exports:mod.exports,require:localRequire,console,Buffer,URL,TextEncoder,structuredClone,Math,Date,JSON,Array,Object,Map,Set,RegExp,Number,String,Boolean},{filename:file,timeout:10000});
 return mod.exports;
}
const geo=load(path.join(root,'src/lib/mapOverlayCoordinates.ts'));
const croqui=load(path.join(root,'src/features/memorial/croquiRenderer.ts'));
const sheet=load(path.join(root,'src/features/documents/technicalSheet.ts'));
const {mapLayout}=load(path.join(root,'src/features/memorial/memorialEngine.ts'));
const poly={id:'area-1',name:'ÁREA 1',vertices:[[-39.580,-12.990],[-39.575,-12.990],[-39.575,-12.985],[-39.580,-12.985]],properties:{},areaM2:3500,perimeterM:240};
const s=croqui.defaultCroquiSettings(),p=sheet.defaultSheet();p.background='vector';
const context={municipality:'Amargosa/BA',owner:'Teste',company:'AGR',date:'31/10/2026',publicUrl:''};
const frame={x:44,y:74,w:1112,h:590};
const mercatorFrame=(coordinate,layout)=>{
 const world=256*2**layout.zoom;
 const lat=Math.max(-85,Math.min(85,coordinate[1]))*Math.PI/180;
 const centerLat=layout.center[1]*Math.PI/180;
 const x=(coordinate[0]+180)/360*world;
 const y=(1-Math.asinh(Math.tan(lat))/Math.PI)/2*world;
 const cx=(layout.center[0]+180)/360*world;
 const cy=(1-Math.asinh(Math.tan(centerLat))/Math.PI)/2*world;
 return {x:frame.x+frame.w/2+x-cx,y:frame.y+frame.h/2+y-cy};
};
let count=0;
for(const zoom of [8,12,15,19,22]){
 const view=croqui.layoutForCroqui(poly,{...s,zoom});
 for(const point of poly.vertices){
  const xy=mercatorFrame(point,view);
  const actual=geo.framePointToGeo(xy,frame,view.zoom,view.center);
  assert.ok(Math.abs(actual[0]-point[0])<1e-8&&Math.abs(actual[1]-point[1])<1e-8,'Croqui → WGS84 round-trip');count++;
 }
}
const a=[-39.579,-12.988],b=[-39.577,-12.987];
const currentLayout=croqui.layoutForCroqui(poly,s);
const road={id:'r-1',points:[mercatorFrame(a,currentLayout),mercatorFrame(b,currentLayout)],geoPoints:[a,b],color:'#00aaee',width:20};
const restored=croqui.normalizeCroquiSettings(JSON.parse(JSON.stringify({...s,easements:[road]})));
assert.equal(restored.easements[0].geoPoints.length,2);count++;
for(const zoom of [8,15,20]){
 const view={...restored,zoom};
 const svg=croqui.renderCroqui(poly,view,{...context,mapLink:''});
 const handle=croqui.renderCroqui(poly,view,{...context,mapLink:'',editing:true});
 assert.match(svg,/data-croqui-road="0"/);
 const shape=svg.match(/<g class="croqui-road" data-croqui-road="0"><polygon points="([^"]+)"/);
 assert.ok(shape,'geographic road rendered');
 assert.match(handle,/data-croqui-road-handle="0:0"/);
 const expected=mercatorFrame(a,croqui.layoutForCroqui(poly,view));
 const pointTag=handle.match(/<circle data-croqui-road-handle="0:0" cx="([^"]+)" cy="([^"]+)"/);
 assert.ok(pointTag&&Math.abs(Number(pointTag[1])-expected.x)<.15&&Math.abs(Number(pointTag[2])-expected.y)<.15,'road follows map zoom instead of old pixels');
 count+=4;
}
const sheetSvg=sheet.renderTechnicalSheet(poly,p,{...context,croqui:restored});
assert.match(sheetSvg,/data-sheet-mini-croqui-road="0"/,'Croqui road appears in minimap');count++;
assert.match(sheetSvg,/class="sheet-easement" data-sheet-road="0"/,'Croqui road appears in main map');count++;
const miniGroup=sheetSvg.match(/<polygon data-sheet-mini-croqui-road="0" points="([^"]+)"/);
const parsePoints=part=>part.trim().split(' ').map(p=>p.split(',').map(Number));
assert.ok(miniGroup);const miniPts=parsePoints(miniGroup[1]);
const miniLayout=mapLayout(poly,330,210,0,'satellite');
const world=256*2**miniLayout.zoom;
const mercatorY=lat=>(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*world;
const expectedMini={x:964+165+(a[0]-miniLayout.center[0])/360*world,y:644+105+mercatorY(a[1])-mercatorY(miniLayout.center[1])};
const firstCenter={x:(miniPts[0][0]+miniPts[miniPts.length-1][0])/2,y:(miniPts[0][1]+miniPts[miniPts.length-1][1])/2};
assert.ok(Math.hypot(firstCenter.x-expectedMini.x,firstCenter.y-expectedMini.y)<.3,'road starts at true geographic coordinate on minimap');count++;
assert.ok(miniPts.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&x>=944&&x<=1314&&y>=624&&y<=874),'road coordinates inside minimap with tolerance');count++;
const hidden=sheet.renderTechnicalSheet(poly,p,{...context,croqui:{...restored,easements:[{...road,visible:false}]}});
assert.doesNotMatch(hidden,/data-sheet-mini-croqui-road="0"/);count++;
const localRoad={id:'sheet-road',points:[{x:350,y:280},{x:510,y:360}],width:20,color:'#ff0099'};
const local=sheet.renderTechnicalSheet(poly,{...p,sheetRoads:[localRoad]},context);
assert.match(local,/data-sheet-mini-local-road="0"/,'sheet road appears in minimap');count++;
const geographicalRoad={...localRoad,geoPoints:localRoad.points.map(sheet.sheetProjection(poly,p).unproject)};
for(const z of [12,15,18]){
 const atZoom={...p,zoom:z,sheetRoads:[geographicalRoad]};
 const picture=sheet.renderTechnicalSheet(poly,atZoom,context);
 const localTrace=picture.match(/data-sheet-mini-local-road="0" points="([^"]+)"/);
 assert.ok(localTrace,'geographic local road must render in minimap after map zoom');
 const screenTrace=picture.match(/data-sheet-road="0"><polygon points="([^"]+)"/);
 assert.ok(screenTrace,'same road must remain on main map');
 count+=2;
}
const revivedSheet=sheet.normalizeSheet(JSON.parse(JSON.stringify({...p,sheetRoads:[geographicalRoad]})));
assert.equal(revivedSheet.sheetRoads[0].geoPoints.length,2,'sheet geographic road survives save and reload');count++;
const full=sheet.renderTechnicalSheet(poly,{...p,sheetRoads:[localRoad]},{...context,croqui:restored});
assert.match(full,/data-sheet-mini-local-road="0"/);assert.match(full,/data-sheet-mini-croqui-road="0"/);count+=2;
const proj=sheet.sheetProjection(poly,p);
for(const vertex of poly.vertices){
 const again=proj.unproject(proj.project(vertex));
 assert.ok(Math.abs(vertex[0]-again[0])<1e-9&&Math.abs(vertex[1]-again[1])<1e-9,'Prancha projection is reversible');count++;
}
const old={id:'old',points:[{x:100,y:190},{x:210,y:230}],width:17,color:'#2288ff'};
const legacy=sheet.renderTechnicalSheet(poly,p,{...context,croqui:{...s,easements:[old]}});
assert.match(legacy,/data-sheet-mini-croqui-road="0"/,'legacy roads remain visible without migration');count++;
const page=fs.readFileSync(path.join(root,'src/features/croqui/CroquiPage.tsx'),'utf8');
assert.match(page,/setPreviewZoom\(value=>clamp\(value\+5,40,180\)\)/,'zoom preview increases 5');
assert.match(page,/setPreviewZoom\(value=>clamp\(value-5,40,180\)\)/,'zoom preview decreases 5');
assert.doesNotMatch(page,/update\(\{zoomPreview:clamp/,'preview zoom must not resend SVG to Appwrite');count+=3;
console.log('SURVEYOR: '+count+' verificações de zoom, georreferenciamento e servidões no minimapa aprovadas.');

if(process.env.SURVEYOR_MINI_FIXTURE_DIR){
 const out=process.env.SURVEYOR_MINI_FIXTURE_DIR;fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'croqui.svg'),croqui.renderCroqui(poly,restored,{...context,mapLink:''}));
 fs.writeFileSync(path.join(out,'prancha.svg'),full);
}
