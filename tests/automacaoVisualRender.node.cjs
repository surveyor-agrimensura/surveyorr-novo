'use strict';
// Teste do renderizador SVG real, sem alterar serviços, banco ou dados do usuário.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const cache=new Map();
function load(input){
  const p=path.resolve(input);
  if(p.endsWith('?raw'))return fs.readFileSync(p.slice(0,-4),'utf8');
  if(cache.has(p))return cache.get(p).exports;
  const mod={exports:{}};cache.set(p,mod);
  const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const localRequire=(id)=>{
    if(!id.startsWith('.'))return require(id);
    const file=path.resolve(path.dirname(p),id);
    if(file.endsWith('?raw'))return fs.readFileSync(file.slice(0,-4),'utf8');
    for(const f of [file,file+'.ts',file+'.tsx',file+'.js'])if(fs.existsSync(f)&&fs.statSync(f).isFile())return load(f);
    throw Error(`Missing dependency: ${id} from ${p}`);
  };
  vm.runInNewContext(js,{module:mod,exports:mod.exports,require:localRequire,console,Buffer,URL,TextEncoder,structuredClone,setTimeout,clearTimeout,Math,Date,JSON,Array,Object,Map,Set,RegExp,Number,String,Boolean}, {filename:p,timeout:15000});
  return mod.exports;
}
const {renderTechnicalSheet,defaultSheet,normalizeSheet}=load(path.join(root,'src/features/documents/technicalSheet.ts'));
const {renderCroqui,defaultCroquiSettings,normalizeCroquiSettings}=load(path.join(root,'src/features/memorial/croquiRenderer.ts'));
const a=[[-39.58,-12.99],[-39.575,-12.99],[-39.575,-12.985],[-39.58,-12.985]],b=[[-39.575,-12.99],[-39.57,-12.99],[-39.57,-12.985],[-39.575,-12.985]];
const parts=[a,b].map((ring,i)=>({featureId:`gleba-${i+1}`,partIndex:0,name:`Gleba ${i+1}`,color:'#111111',areaM2:9000,perimeterM:420,rings:[ring],category:'gleba',properties:{}}));
const poly={id:'gleba-1',name:'Gleba 1',vertices:a,properties:{},areaM2:9000,perimeterM:420};
const context={municipality:'BA',owner:'Teste',company:'AGR',date:'31/10/2026',publicUrl:'',divisions:parts,composite:true};
const sheet=defaultSheet();assert.equal(sheet.exteriorCotas,false);
const normal=renderTechnicalSheet(poly,sheet,context);
assert.doesNotMatch(normal,/data-exterior-cota=/);
const adjusted={...sheet,exteriorCotas:true,hiddenDivisionVertices:{'division:gleba-1:0:vertex:1':true}};
const outside=renderTechnicalSheet(poly,adjusted,context);
assert.match(outside,/data-exterior-cota=/);
assert.match(outside,/stroke-dasharray="5 4"/);
assert.equal(normalizeSheet(JSON.parse(JSON.stringify(adjusted))).exteriorCotas,true);
assert.ok(!/data-sheet-label="division:gleba-2:0:cota:0"/.test(outside),'old inner dimensions disabled in exterior mode');
const single=renderTechnicalSheet(poly,{...sheet,exteriorCotas:true,hiddenVertices:[1]},{...context,composite:false});
assert.match(single,/data-exterior-cota=/);
const croqui=defaultCroquiSettings();const croquiOuter={...croqui,exteriorCotas:true};
const cs=renderCroqui(poly,croquiOuter,{company:'AGR',mapLink:'',municipality:'BA',composite:true,divisions:parts});
assert.match(cs,/data-exterior-cota=/);
assert.match(cs,/stroke-dasharray="5 4"/);
assert.equal(normalizeCroquiSettings(JSON.parse(JSON.stringify(croquiOuter))).exteriorCotas,true);
assert.deepEqual(a,poly.vertices,'geometria não modificada');
console.log('11 verificações dos renderizadores reais e persistência local passaram');
