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
const rings=[
 [[-39.58,-12.99],[-39.57,-12.99],[-39.57,-12.98],[-39.58,-12.98]],
 [[-39.56,-12.99],[-39.55,-12.99],[-39.55,-12.98],[-39.56,-12.98]],
 [[-39.58,-12.97],[-39.57,-12.97],[-39.57,-12.96],[-39.58,-12.96]],
 [[-39.56,-12.97],[-39.55,-12.97],[-39.55,-12.96],[-39.56,-12.96]],
];
const divisions=rings.map((ring,i)=>({featureId:`gleba-${i+1}`,partIndex:0,name:`GLEBA ${i+1} - OTAVIO`,category:'gleba',color:'#2255aa',areaM2:6194+i*1000,perimeterM:385.77+i*5,rings:[ring]}));
const poly=(index)=>({id:divisions[index].featureId,name:divisions[index].name,vertices:rings[index],areaM2:divisions[index].areaM2,perimeterM:divisions[index].perimeterM,properties:{sourceFeatureId:divisions[index].featureId,partIndex:0}});
const settings={...defaultSheet(),background:'vector'};
const ctx={municipality:'Amargosa/BA',owner:'Teste',company:'AGR',date:'30/10/2026',publicUrl:'',divisions,uf:'BA'};
const select=renderTechnicalSheet(poly(3),settings,{...ctx,composite:false,projectTitle:'SÍTIO SETE VOLTA - GLEBA 04'});
const quadro=select.match(/<g data-sheet-area-scope="individual">[\s\S]*?<\/g>/)?.[0];
assert.ok(quadro,'quadro individual gerado');
assert.match(quadro,/GLEBA 4/);
assert.doesNotMatch(quadro,/GLEBA 1|GLEBA 2|GLEBA 3|Total \(4\)/);
assert.match(quadro,/0,9194/,'hectares da gleba 4, não soma das quatro');
assert.match(quadro,/400,77/,'perímetro da gleba 4');
assert.match(quadro,/tarefas/,'equivalência regional da Bahia');
const name=select.match(/<text data-sheet-label="property:title"[^>]*>[\s\S]*?<\/text>/)?.[0];
const measures=select.match(/<text data-sheet-label="property:area"[^>]*>[\s\S]*?<\/text>/)?.[0];
assert.ok(name&&measures,'nome e segunda linha de medidas na planta individual');
assert.match(measures,/0,9194 ha/);
assert.match(measures,/400,77 m/);
assert.match(measures,/tarefas/);
assert.ok(!/data-sheet-label="division:gleba-1:0:area"/.test(select),'a medida de outra gleba não substitui a selecionada');
const customized=renderTechnicalSheet(poly(3),{...settings,labelColors:{'property:area':'#1188dd'},labelSizes:{'property:area':125},labelOffsets:{'property:area':{dx:12,dy:6}}},{...ctx,composite:false});
assert.match(customized,/data-sheet-label="property:area"[^>]*fill="#1188dd"/,'a cor individual continua ajustável');
const persisted=normalizeSheet(JSON.parse(JSON.stringify({...settings,labelColors:{'property:area':'#1188dd'},labelSizes:{'property:area':125},labelOffsets:{'property:area':{dx:12,dy:6}}})));
assert.equal(persisted.labelColors['property:area'],'#1188dd','a cor permanece após salvar/reabrir');
assert.equal(persisted.labelSizes['property:area'],125,'o tamanho permanece após salvar/reabrir');
assert.equal(persisted.labelOffsets['property:area'].dx,12,'o deslocamento permanece após salvar/reabrir');
const all=renderTechnicalSheet(poly(0),settings,{...ctx,composite:true});
assert.doesNotMatch(all,/data-sheet-area-scope="individual"/);
for(const d of divisions)assert.match(all,new RegExp(`data-sheet-division="${d.featureId}"`),`gleba ${d.name} na prancha completa`);
assert.match(all,/Total \(4\)/);
assert.match(all,/GLEBA 1/);
assert.match(all,/GLEBA 4/);
assert.doesNotMatch(all,/data-sheet-label="property:area"/,'no modo completo não aparece rótulo de medida individual');
// Botão direito: excluir o rótulo somente da Prancha, sem alterar cadastro ou geometria.
const sourceNeighbors=['CONFRONTANTE NORTE','CONFRONTANTE LESTE','CONFRONTANTE SUL','CONFRONTANTE OESTE'];
const withNeighbors={...settings,neighbors:sourceNeighbors};
const visibleNeighbors=renderTechnicalSheet(poly(3),withNeighbors,{...ctx,composite:false});
assert.match(visibleNeighbors,/data-sheet-label="neighbor:0"/,'rótulo original fica visível');
const hiddenNeighborSettings={...withNeighbors,hiddenLabels:['neighbor:0']};
const hiddenNeighborSvg=renderTechnicalSheet(poly(3),hiddenNeighborSettings,{...ctx,composite:false});
assert.doesNotMatch(hiddenNeighborSvg,/data-sheet-label="neighbor:0"/,'nome removido da prévia e da exportação');
assert.match(hiddenNeighborSvg,/data-sheet-label="neighbor:1"/,'outros confrontantes continuam visíveis');
assert.match(hiddenNeighborSvg,/data-sheet-label="property:title"/,'nome do imóvel permanece visível');
assert.deepEqual(hiddenNeighborSettings.neighbors,sourceNeighbors,'cadastro de confrontantes não é alterado');
assert.deepEqual(poly(3).vertices,rings[3],'geometria é preservada');
const revived=normalizeSheet(JSON.parse(JSON.stringify(hiddenNeighborSettings)));
assert.deepEqual(Array.from(revived.hiddenLabels),['neighbor:0'],'rótulo excluído persiste após salvar e reabrir');
const restored=renderTechnicalSheet(poly(3),{...revived,hiddenLabels:[]},{...ctx,composite:false});
assert.match(restored,/data-sheet-label="neighbor:0"/,'rótulo pode ser restaurado');
const multiLabel=renderTechnicalSheet(poly(0),{...settings,hiddenLabels:['division:gleba-2:0:title']},{...ctx,composite:true});
assert.doesNotMatch(multiLabel,/data-sheet-label="division:gleba-2:0:title"/,'rótulo isolado na gleba correspondente');
assert.match(multiLabel,/data-sheet-label="division:gleba-3:0:title"/,'demais glebas continuam identificadas');
const hiddenProperty=renderTechnicalSheet(poly(3),{...settings,hiddenLabels:['property:title']},{...ctx,composite:false});
assert.doesNotMatch(hiddenProperty,/data-sheet-label="property:title"/,'rótulo individual do imóvel pode ser ocultado');
assert.match(hiddenProperty,/data-sheet-label="property:area"/,'rótulo de área permanece independente');
const mapName={id:'teste',text:'Nome livre',lon:-39.557,lat:-12.965,color:'#111827',size:13,angle:0};
const hiddenFree=renderTechnicalSheet(poly(3),{...settings,mapNames:[mapName],hiddenLabels:['map-name:teste']},{...ctx,composite:false});
assert.doesNotMatch(hiddenFree,/data-sheet-label="map-name:teste"/,'nome livre excluído somente da prancha');

console.log('SURVEYOR: Glebas e 14 verificações novas de exclusão/restauração de rótulos passaram.');
if(process.env.SURVEYOR_SHEET_FIXTURE_DIR){
 fs.mkdirSync(process.env.SURVEYOR_SHEET_FIXTURE_DIR,{recursive:true});
 fs.writeFileSync(path.join(process.env.SURVEYOR_SHEET_FIXTURE_DIR,'individual.svg'),select);
 fs.writeFileSync(path.join(process.env.SURVEYOR_SHEET_FIXTURE_DIR,'completo.svg'),all);
}
