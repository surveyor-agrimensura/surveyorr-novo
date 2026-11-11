'use strict';
// Regressões locais dos SVGs reais, sem acesso à nuvem ou modificações externas.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const modules=new Map();
function load(entry){
 const full=path.resolve(entry);
 if(modules.has(full))return modules.get(full).exports;
 const mod={exports:{}};modules.set(full,mod);
 const transpiled=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 function requireLocal(id){
  if(!id.startsWith('.'))return require(id);
  const target=path.resolve(path.dirname(full),id);
  if(target.endsWith('?raw'))return fs.readFileSync(target.slice(0,-4),'utf8');
  for(const file of [target,target+'.ts',target+'.tsx',target+'.js'])if(fs.existsSync(file)&&fs.statSync(file).isFile())return load(file);
  throw new Error(`Dependência não localizada ${id} em ${full}`);
 }
 vm.runInNewContext(transpiled,{module:mod,exports:mod.exports,require:requireLocal,Math,Number,Object,Array,Map,Set,RegExp,JSON,String,Date,Buffer,URL,TextEncoder,console,structuredClone,setTimeout,clearTimeout},{filename:full,timeout:15000});
 return mod.exports;
}
const from=rel=>load(path.join(root,rel));
const geom=from('src/features/croqui/croquiGeometry.ts');
const croqui=from('src/features/memorial/croquiRenderer.ts');
const sheet=from('src/features/documents/technicalSheet.ts');
let checks=0;
function check(condition,msg){assert.ok(condition,msg);checks++;}
function equal(a,b,msg){assert.equal(a,b,msg);checks++;}
function count(haystack,needle){return (haystack.match(new RegExp(needle,'g'))||[]).length;}
const v=[[-39.60,-12.99],[-39.59,-12.99],[-39.58,-12.985],[-39.58,-12.98],[-39.59,-12.97],[-39.60,-12.98]];
const polygon={id:'gleba',name:'Gleba Teste',vertices:v,properties:{},areaM2:10000,perimeterM:410};
const sources=['FAZENDA MARIA','FAZENDA MARIA','FAZENDA MARIA','SÍTIO PEDRO','SÍTIO PEDRO',''];
const groups=geom.groupConfrontations(sources);
equal(groups.length,2,'2 trechos contínuos, embora haja 5 segmentos nomeados');
equal(groups.reduce((n,g)=>n+g.indices.length,0),5,'nenhuma aresta perde o cadastro');
const longRange=Array.from({length:32},(_,i)=>i>=24&&i<30?'CONFRONTANTE DO V25 AO V30':'');
equal(geom.groupConfrontations(longRange).length,1,'V25 a V30 aparece apenas uma vez');
const road={id:'faixa',color:'#00aa00',width:18,points:[{x:200,y:200},{x:400,y:235},{x:550,y:280}]};
const croquiSettings={...croqui.defaultCroquiSettings(),background:'none',neighbors:sources,neighborDetails:{0:{property:'FAZENDA MARIA',cpf:'123.456.789-00',showProperty:true,showCpf:true}},easements:[road]};
const croquiSvg=croqui.renderCroqui(polygon,croquiSettings,{company:'AGR',municipality:'BA',mapLink:'',qr:''});
equal(count(croquiSvg,'data-croqui-label="neighbor:'),2,'Croqui: 1 identificação por trecho contínuo');
check(croquiSvg.includes('FAZENDA MARIA')&&croquiSvg.includes('SÍTIO PEDRO'),'nomes preservados');
const roadCroqui=croquiSvg.match(/<g class="croqui-road"[\s\S]*?<\/g>/)?.[0]||'';
equal(count(roadCroqui,'<polyline'),2,'Croqui: duas laterais abertas');
check(!/<polygon[^>]*stroke="#00aa00"/.test(roadCroqui),'Croqui: nenhuma linha fecha as extremidades');
const sheetSettings={...sheet.defaultSheet(),background:'vector',neighbors:sources,sheetRoads:[road]};
const context={municipality:'BA',owner:'Maria',company:'AGR',date:'31/10/2026',publicUrl:'',uf:'BA',composite:false};
const sheetSvg=sheet.renderTechnicalSheet(polygon,sheetSettings,context);
equal(count(sheetSvg,'data-sheet-label="neighbor:'),2,'Prancha individual: 1 identificação por trecho');
const roadSheet=sheetSvg.match(/<g data-sheet-road="0">[\s\S]*?<\/g>/)?.[0]||'';
equal(count(roadSheet,'<polyline'),2,'Prancha: duas laterais abertas');
check(!/<polygon[^>]*stroke="#00aa00"/.test(roadSheet),'Prancha: não fecha a boca da servidão');
const divs=[{featureId:'one',partIndex:0,name:'Parte 1',color:'#000000',category:'gleba',rings:[v],areaM2:10000,perimeterM:410},{featureId:'two',partIndex:0,name:'Parte 2',color:'#000000',category:'gleba',rings:[v.map(([lon,lat])=>[lon+.05,lat])],areaM2:10000,perimeterM:410}];
const divisionNeighbors=Object.fromEntries(sources.map((text,i)=>[`division:one:0:neighbor:${i}`,text]));
const compositeSvg=sheet.renderTechnicalSheet(polygon,{...sheetSettings,divisionNeighbors,neighbors:[]},{...context,divisions:divs,composite:true});
equal(count(compositeSvg,'data-sheet-label="division:one:0:neighbor:'),2,'Prancha completa: agrupamento de cada gleba');
const compositeCroqui=croqui.renderCroqui(polygon,{...croquiSettings,neighbors:[]},{...context,mapLink:'',divisions:divs,composite:true,areaSettings:{one:croquiSettings}});
equal(count(compositeCroqui,'data-croqui-label="division:one:0:neighbor:'),2,'Croqui completo: agrupamento por trecho');
const page=fs.readFileSync(path.join(root,'src/features/croqui/CroquiPage.tsx'),'utf8');
check(page.includes('Clique nos pontos do percurso'),'modo de clique por pontos identificado');
check(!page.includes("gesture.current={kind:'road',moved:false}"),'não inicia arraste de servidão');
const technical=fs.readFileSync(path.join(root,'src/features/documents/TechnicalSheetsPage.tsx'),'utf8');
check(technical.includes('changePreviewZoom(10)')&&technical.includes('previewZoom>=180'),'zoom + operante e com limite');
check(technical.includes('ref={viewerRef}'),'zoom mantém visor como referência');
console.log(`SURVEYOR: ${checks} verificações de servidão, confrontantes e zoom aprovadas`);
