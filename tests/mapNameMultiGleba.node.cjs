'use strict';
/** Regression: contextual styling must update the same MapName properties that both SVG renderers consume. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const cache=new Map();
function load(input){
 const filename=path.resolve(input);
 if(filename.endsWith('?raw'))return fs.readFileSync(filename.slice(0,-4),'utf8');
 if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const requireLocal=(id)=>{
  if(!id.startsWith('.'))return require(id);
  const base=path.resolve(path.dirname(filename),id);
  if(base.endsWith('?raw'))return fs.readFileSync(base.slice(0,-4),'utf8');
  for(const candidate of [base,`${base}.ts`,`${base}.tsx`,`${base}.js`])if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())return load(candidate);
  throw new Error(`Dependency not found: ${id}`);
 };
 vm.runInNewContext(output,{module,exports:module.exports,require:requireLocal,console,Buffer,URL,TextEncoder,structuredClone,setTimeout,clearTimeout,Math,Date,JSON,Array,Object,Map,Set,RegExp,Number,String,Boolean},{filename,timeout:15000});
 return module.exports;
}
const {mapNameForLabel,updateMapNameAppearance,mapAppearancePatch,readMapAppearance}=load(path.join(root,'src/features/croqui/sharedMapAppearance.ts'));
const {defaultCroquiSettings,normalizeCroquiSettings,renderCroqui}=load(path.join(root,'src/features/memorial/croquiRenderer.ts'));
const {defaultSheet,normalizeSheet,renderTechnicalSheet}=load(path.join(root,'src/features/documents/technicalSheet.ts'));
const ringA=[[-39.580,-12.990],[-39.575,-12.990],[-39.575,-12.985],[-39.580,-12.985]];
const ringB=[[-39.570,-12.990],[-39.565,-12.990],[-39.565,-12.985],[-39.570,-12.985]];
const divisions=[ringA,ringB].map((ring,i)=>({featureId:`gleba-${i+1}`,partIndex:0,name:`GLEBA ${i+1}`,category:'gleba',color:'#2255aa',areaM2:3000,perimeterM:240,rings:[ring]}));
const polygon={id:'gleba-1',name:'GLEBA 1',vertices:ringA,areaM2:3000,perimeterM:240,properties:{}};
const names=[
 {id:'a',text:'Nome independente A',lon:-39.5775,lat:-12.9875,size:13,angle:0,color:'#111827'},
 {id:'b',text:'Nome independente B',lon:-39.5675,lat:-12.9875,size:19,angle:20,color:'#224466'},
];
const key='map-name:a';
assert.equal(mapNameForLabel(names,key).text,'Nome independente A');
assert.equal(mapNameForLabel(names,'division:gleba-1:0:title'),undefined);
const updated=updateMapNameAppearance(names,key,{size:6,angle:-65,color:'#0055cc'});
assert.equal(updated[0].size,6);
assert.equal(updated[0].angle,-65);
assert.equal(updated[0].color,'#0055cc');
assert.deepEqual(updated[1],names[1],'other labels do not change');
assert.deepEqual(names[0],{id:'a',text:'Nome independente A',lon:-39.5775,lat:-12.9875,size:13,angle:0,color:'#111827'},'input is not mutated');
assert.equal(updateMapNameAppearance(updated,'map-name:missing',{angle:60}).length,2);
const raw=JSON.parse(JSON.stringify(updated));
const restoredCroqui=normalizeCroquiSettings({...defaultCroquiSettings(),mapNames:raw,background:'none'});
const restoredSheet=normalizeSheet({...defaultSheet(),background:'none',mapNames:raw});
assert.equal(restoredCroqui.mapNames[0].size,6);
assert.equal(restoredSheet.mapNames[0].angle,-65);
const context={municipality:'Amargosa/BA',owner:'Teste',company:'AGR',date:'30/10/2026',publicUrl:'',divisions,composite:true,uf:'BA'};
const croquiSvg=renderCroqui(polygon,restoredCroqui,{company:'AGR',municipality:'Amargosa/BA',propertyName:'Teste',mapLink:'',divisions,composite:true});
const sheetSvg=renderTechnicalSheet(polygon,restoredSheet,context);
for(const [svg,attribute] of [[croquiSvg,'data-croqui-label'],[sheetSvg,'data-sheet-label']]){
 const markup=svg.match(new RegExp(`<text ${attribute}="map-name:a"[^>]*>`))?.[0];
 assert.ok(markup,`${attribute} present in composite mode`);
 assert.match(markup,/font-size="6\.00"/,'new size is used in the actual renderer');
 assert.match(markup,/rotate\(-65\.00 /,'rotation is used in the actual renderer');
 assert.match(markup,/fill="#0055cc"/,'selected color is used in the actual renderer');
 const other=svg.match(new RegExp(`<text ${attribute}="map-name:b"[^>]*>`))?.[0];
 assert.ok(other,`${attribute} still has the second free name`);
 assert.match(other,/rotate\(20\.00 /,'other name unchanged');
}
const updatedSettings=normalizeSheet({...restoredSheet,labelSizes:{'division:gleba-1:0:title':60},labelAngles:{'division:gleba-1:0:title':-50}});
const multiSheet=renderTechnicalSheet(polygon,updatedSettings,context);
const firstTitle=multiSheet.match(/<text data-sheet-label="division:gleba-1:0:title"[^>]*>/)?.[0]||'';
assert.match(firstTitle,/rotate\(-50\.00 /,'native division name rotates in multi-gleba document');
assert.match(firstTitle,/font-size="[0-9.]+"/);
const secondTitle=multiSheet.match(/<text data-sheet-label="division:gleba-2:0:title"[^>]*>/)?.[0]||'';
assert.doesNotMatch(secondTitle,/rotate\(-50\.00 /,'other division name unaffected');
const opts=mapAppearancePatch({},'project-alpha','__imovel_completo__',{mapNames:updated});
const cloud=readMapAppearance(opts,'project-alpha','__imovel_completo__');
assert.equal(cloud.mapNames[0].angle,-65,'shared map appearance persisted and read back');
assert.equal(readMapAppearance(opts,'project-beta','__imovel_completo__').mapNames,undefined,'different project isolated');
const croquiSource=fs.readFileSync(path.join(root,'src/features/croqui/CroquiPage.tsx'),'utf8');
const sheetSource=fs.readFileSync(path.join(root,'src/features/documents/TechnicalSheetsPage.tsx'),'utf8');
assert.match(croquiSource,/contextMapName\?\(/,'Croqui has a dedicated map-name contextual editor');
assert.match(croquiSource,/mapNames:updateMapNameAppearance\(settings\.mapNames,croquiContext\.key,\{angle:Number/,'Croqui rotates through MapName data');
assert.match(croquiSource,/mapNames:updateMapNameAppearance\(settings\.mapNames,croquiContext\.key,\{size:Number/,'Croqui resizes through MapName data');
assert.match(sheetSource,/contextMapName\?<><label>/,'Prancha has a dedicated map-name contextual editor');
assert.match(sheetSource,/mapNames:updateMapNameAppearance\(settings\.mapNames,sheetContext\.key,\{angle:Number/,'Prancha rotates through MapName data');
assert.match(sheetSource,/mapNames:updateMapNameAppearance\(settings\.mapNames,sheetContext\.key,\{size:Number/,'Prancha resizes through MapName data');
console.log('SURVEYOR: 26 context, size, rotation, persistence and composite SVG checks passed.');
