'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){
 const p=path.resolve(file);
 if(cache.has(p))return cache.get(p).exports;
 if(p.endsWith('?raw'))return fs.readFileSync(p.slice(0,-4),'utf8');
 const mod={exports:{}};cache.set(p,mod);
 const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const requireFile=id=>{
  if(!id.startsWith('.'))return require(id);
  const candidate=path.resolve(path.dirname(p),id);
  if(candidate.endsWith('?raw'))return fs.readFileSync(candidate.slice(0,-4),'utf8');
  for(const fname of [candidate,candidate+'.ts',candidate+'.tsx',candidate+'.js'])if(fs.existsSync(fname))return load(fname);
  throw Error(`Cannot resolve ${id} in ${p}`);
 };
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:requireFile,console,Buffer,URL,TextEncoder,structuredClone,setTimeout,clearTimeout,Math,Date,JSON,Array,Object,Map,Set,RegExp,Number,String,Boolean}, {filename:p,timeout:30000});
 return mod.exports;
}
const u=load('src/lib/confrontantVisualOrganizer.ts');
const geo=load('src/features/croqui/croquiGeometry.ts');
const {defaultSheet,normalizeSheet,renderTechnicalSheet}=load('src/features/documents/technicalSheet.ts');
const {defaultCroquiSettings,normalizeCroquiSettings,renderCroqui}=load('src/features/memorial/croquiRenderer.ts');
const raw=['JOAO','JOAO','JOAO','JOAO','JOAO','MARIA','',''];
const details=Object.fromEntries(raw.slice(0,6).map((_,i)=>[String(i),{property:raw[i],cpf:i<5?'111.222.333-44':'555.666.777-88'}]));
const proposed=[{source:0,caption:'JOAO',targets:[1,2,3],cardinal:'Norte',confidence:.95}];
const result=u.applyConfrontantSuggestions(raw,details,proposed,raw.length);
assert.deepEqual(Array.from(result.neighbors),['','JOAO','JOAO','JOAO','','MARIA','','']);
assert.equal(result.details['1'].cpf,'111.222.333-44');
assert.equal(result.details['0'],undefined);
assert.equal(result.details['4'],undefined);
assert.equal(result.details['5'].property,'MARIA');
assert.equal(geo.groupConfrontations(result.neighbors).filter(g=>g.label==='JOAO').length,1);
assert.equal(u.uniqueConfrontantLabels(geo.groupConfrontations(['JOAO','MARIA','JOAO'])).filter(g=>g.label==='JOAO').length,1);
const before='<svg><text data-sheet-label="neighbor:0" data-sheet-base-x="240.00" data-sheet-base-y="120.00" data-sheet-visual-y="290.40" x="380.50" y="283.0">JOAO</text></svg>';
const pins=u.captureConfrontantPins(before,'sheet',raw);
assert.equal(pins[u.confrontantPinKey('JOAO')].x,380.5);
assert.equal(pins[u.confrontantPinKey('JOAO')].y,290.4);
const style=u.transferConfrontantAppearance(raw,result.neighbors,'',{'neighbor:0':-45,'vertex:0':15});
assert.equal(style['neighbor:1'],-45);
assert.equal(style['neighbor:0'],undefined);
assert.equal(style['vertex:0'],15);
assert.deepEqual(Array.from(u.transferHiddenConfrontantLabels(['JOAO','MARIA'],['MARIA','JOAO'],'',['neighbor:0','vertex:1'])),['vertex:1','neighbor:1']);
const poly={id:'test-1',name:'Fazenda',properties:{},vertices:[[-39.503,-13.51],[-39.501,-13.51],[-39.499,-13.505],[-39.499,-13.503],[-39.502,-13.502],[-39.506,-13.502],[-39.508,-13.506],[-39.507,-13.51]],areaM2:12345,perimeterM:123};
const ctx={municipality:'Amargosa/BA',owner:'Maria',company:'Teste',date:'31/10/2026',publicUrl:'',uf:'BA'};
const base=defaultSheet();base.background='vector';base.neighbors=result.neighbors;base.confrontantPins=pins;
const svg=renderTechnicalSheet(poly,base,ctx);
assert.equal((svg.match(/data-sheet-label="neighbor:/g)||[]).length,2,'um rótulo JOAO e outro MARIA');
const label=svg.match(/<text data-sheet-label="neighbor:1"[^>]*>/)?.[0];
assert(label,'rótulo reatribuído presente');
assert.match(label,/x="380\.50"/);
assert.match(label,/data-sheet-visual-y="290\.40"/);
const restored=normalizeSheet(JSON.parse(JSON.stringify(base)));
assert.equal(restored.confrontantPins[u.confrontantPinKey('JOAO')].y,290.4);
assert.equal((renderTechnicalSheet(poly,restored,ctx).match(/data-sheet-label="neighbor:/g)||[]).length,2);
const croqui=defaultCroquiSettings();croqui.background='none';croqui.neighbors=result.neighbors;croqui.confrontantPins=pins;
const csvg=renderCroqui(poly,croqui,{company:'AGR',municipality:'Amargosa/BA',mapLink:''});
assert.match(csvg,/<text data-croqui-label="neighbor:1"[^>]*data-croqui-visual-y="290\.40"/);
const crestored=normalizeCroquiSettings(JSON.parse(JSON.stringify(croqui)));
assert.equal(crestored.confrontantPins[u.confrontantPinKey('JOAO')].x,380.5);
// Verificar regressões de um mesmo confrontante repartido em grupos separados.
const dupSettings={...base,neighbors:['JOAO','','MARIA','JOAO','','','','']};
assert.equal((renderTechnicalSheet(poly,dupSettings,ctx).match(/data-sheet-label="neighbor:/g)||[]).length,2);

// Cenário integrado: o texto foi ARRASTADO e muda de trecho, sem mudar um pixel.
const former={...defaultSheet(),background:'vector',neighbors:['JOAO','JOAO','','','MARIA','','',''],
 labelOffsets:{'neighbor:0':{dx:90,dy:35}},labelAngles:{'neighbor:0':27},labelColors:{'neighbor:0':'#1177aa'}};
const formerSvg=renderTechnicalSheet(poly,former,ctx);
const formerPositions=u.readConfrontantLabelPositions(formerSvg,'sheet');
const formerPosition=formerPositions.find(item=>item.source===0)?.position;
assert(formerPosition,'o rótulo arrastado existe na prévia original');
const relocated=u.applyConfrontantSuggestions(former.neighbors,{'0':{property:'JOAO',cpf:'999'}},
 [{source:0,caption:'JOAO',targets:[2,3],cardinal:'Leste',confidence:1}],8);
const locked={...former,neighbors:relocated.neighbors,
 confrontantPins:u.captureConfrontantPins(formerSvg,'sheet',former.neighbors),
 labelOffsets:{},
 labelColors:u.transferConfrontantAppearance(former.neighbors,relocated.neighbors,'',former.labelColors),
 labelAngles:u.transferConfrontantAppearance(former.neighbors,relocated.neighbors,'',former.labelAngles)};
const movedSvg=renderTechnicalSheet(poly,locked,ctx);
const movedPosition=u.readConfrontantLabelPositions(movedSvg,'sheet').find(item=>item.source===2)?.position;
assert(movedPosition,'o rótulo segue visível após atualizar apenas a barra');
assert.equal(movedPosition.x,formerPosition.x,'posição X permanece idêntica');
assert.equal(movedPosition.y,formerPosition.y,'posição Y permanece idêntica');
assert.match(movedSvg,/<text data-sheet-label="neighbor:2"[^>]*fill="#1177aa"/);
assert.equal((movedSvg.match(/data-sheet-label="neighbor:/g)||[]).length,2);
const oldCroqui={...defaultCroquiSettings(),background:'none',neighbors:former.neighbors,
 labelOffsets:{'neighbor:0':{dx:83,dy:-45}}};
const beforeCroquiSvg=renderCroqui(poly,oldCroqui,{company:'AGR',municipality:'Amargosa/BA',mapLink:''});
const croquiOriginal=u.readConfrontantLabelPositions(beforeCroquiSvg,'croqui').find(item=>item.source===0)?.position;
assert(croquiOriginal,'rótulo original do Croqui foi encontrado');
const newCroquiSvg=renderCroqui(poly,{...oldCroqui,neighbors:relocated.neighbors,labelOffsets:{},
 confrontantPins:u.captureConfrontantPins(beforeCroquiSvg,'croqui',former.neighbors)},
 {company:'AGR',municipality:'Amargosa/BA',mapLink:''});
const croquiRemapped=u.readConfrontantLabelPositions(newCroquiSvg,'croqui').find(item=>item.source===2)?.position;
assert(croquiRemapped,'novo trecho na barra não apaga o rótulo do Croqui');
assert.equal(croquiRemapped.x,croquiOriginal.x);
assert.equal(croquiRemapped.y,croquiOriginal.y);

console.log('SURVEYOR: confrontantes no Croqui/Prancha, posição exata, dados e exportação: 32 verificações aprovadas.');
