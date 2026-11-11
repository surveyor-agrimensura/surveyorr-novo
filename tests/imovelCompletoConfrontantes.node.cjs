'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){
 const p=path.resolve(root,file);if(cache.has(p))return cache.get(p).exports;
 const mod={exports:{}};cache.set(p,mod);
 const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const local=id=>{
  if(!id.startsWith('.'))return require(id);
  const candidate=path.resolve(path.dirname(p),id);
  if(candidate.endsWith('?raw'))return fs.readFileSync(candidate.slice(0,-4),'utf8');
  for(const filename of [candidate,candidate+'.ts',candidate+'.tsx',candidate+'.js'])if(fs.existsSync(filename))return load(path.relative(root,filename));
  throw Error(`Missing ${id}`);
 };
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:local,console,Math,Array,Set,Map,Object,Number,String,Boolean,Date,JSON,RegExp,Buffer,URL,TextEncoder,setTimeout,clearTimeout,structuredClone},{filename:p});
 return mod.exports;
}
const {compositeExteriorEdges,suggestCompositeConfrontants}=load('src/lib/compositeConfrontants.ts');
const {defaultSheet,normalizeSheet,renderTechnicalSheet}=load('src/features/documents/technicalSheet.ts');
const visual=load('src/lib/confrontantVisualOrganizer.ts');
const A=[[-39.1,-12.1],[-39.099,-12.1],[-39.099,-12.099],[-39.1,-12.099]];
const B=[[-39.099,-12.1],[-39.098,-12.1],[-39.098,-12.099],[-39.099,-12.099]];
const divisions=[{featureId:'A',partIndex:0,name:'Gleba A',rings:[A],properties:{},areaM2:12000,perimeterM:450,category:''},{featureId:'B',partIndex:0,name:'Gleba B',rings:[B],properties:{},areaM2:12000,perimeterM:450,category:''}];
const outer=compositeExteriorEdges(divisions);
assert.equal(outer.length,6,'o conjunto não pode incluir a divisa interna');
assert(!outer.some(e=>e.partId==='A:0'&&e.index===1),'aresta direita de A interna');
assert(!outer.some(e=>e.partId==='B:0'&&e.index===3),'aresta esquerda de B interna');
const C=A.map(([x,y])=>[x,y+.001]);
const D=B.map(([x,y])=>[x,y+.001]);
const four=[...divisions,{...divisions[0],featureId:'C',name:'Gleba C',rings:[C]}, {...divisions[1],featureId:'D',name:'Gleba D',rings:[D]}];
const outerFour=compositeExteriorEdges(four);
assert.equal(outerFour.length,8,'quatro glebas adjacentes: oito trechos exteriores e quatro divisões internas');
const project=p=>({x:(p[0]+39.1)*200000,y:-(p[1]+12.1)*200000});
const labels=[{name:'JOAO',sourceKey:'division:A:0:neighbor:3',position:{x:-30,y:100}},{name:'MARIA',sourceKey:'division:B:0:neighbor:1',position:{x:440,y:100}}];
const suggested=suggestCompositeConfrontants(outer,labels,project);
assert(suggested.some(x=>x.name==='JOAO'&&x.targets.length>0));
assert(suggested.some(x=>x.name==='MARIA'&&x.targets.length>0));
const keys=new Set(outer.map(e=>e.key));
assert(suggested.every(x=>x.targets.every(k=>keys.has(k))));
const s=defaultSheet();s.background='vector';s.elements.confrontantes.visible=true;
s.divisionNeighbors={
 'division:A:0:neighbor:0':'JOAO','division:A:0:neighbor:1':'INTERNA','division:A:0:neighbor:3':'JOAO',
 'division:B:0:neighbor:0':'MARIA','division:B:0:neighbor:1':'MARIA','division:B:0:neighbor:3':'INTERNA',
};
s.divisionNeighborDetails={'division:A:0:neighbor:3':{property:'JOAO',owner:'',cpf:'123.456.789-10',rg:'',showProperty:true,showCpf:true,showOwner:false,showRg:false}};
const original=JSON.stringify(s.divisionNeighbors);
const poly={id:'A',name:'Gleba A',properties:{},vertices:A,areaM2:12000,perimeterM:450};
const ctx={municipality:'Amargosa/BA',owner:'Técnico',company:'SURVEYOR',date:'31/10/2026',publicUrl:'',composite:true,divisions,uf:'BA'};
const svg=renderTechnicalSheet(poly,s,ctx);
assert.match(svg,/123\.456\.789-10/,'CPF de JOAO permanece mesmo se preenchido em outra aresta');
assert.equal((svg.match(/data-sheet-label="division:A:0:neighbor:/g)||[]).length,2,'A exibe apenas um JOAO e um cadastro INTERNA');
assert.equal((svg.match(/data-sheet-label="division:B:0:neighbor:/g)||[]).length,1,'B exibe MARIA apenas uma vez');
assert.equal(JSON.stringify(s.divisionNeighbors),original,'renderizador não altera cadastramento');
const first=visual.readConfrontantLabelPositions(svg,'sheet','division:A:0:').find(v=>v.source===3);
assert(first,'a posição do rótulo existente é capturada');
const after=JSON.parse(JSON.stringify(s));
after.divisionNeighbors['division:A:0:neighbor:0']='';
after.divisionNeighbors['division:A:0:neighbor:3']='';
after.divisionNeighbors['division:B:0:neighbor:1']='JOAO';
after.confrontantPins[visual.confrontantPinKey('JOAO')]=first.position;
const relocated=renderTechnicalSheet(poly,after,ctx);
const moved=visual.readConfrontantLabelPositions(relocated,'sheet','division:B:0:').find(v=>v.source===1);
assert(moved,'etiqueta passa ao trecho da outra gleba');
assert.equal(moved.position.x,first.position.x,'posição horizontal preservada');
assert.equal(moved.position.y,first.position.y,'posição vertical preservada');

const restored=normalizeSheet(JSON.parse(JSON.stringify(s)));
assert.equal(restored.divisionNeighborDetails['division:A:0:neighbor:3'].cpf,'123.456.789-10');
console.log('Imóvel completo: perímetro externo, deduplicação visual e preservação de dados aprovados.');
