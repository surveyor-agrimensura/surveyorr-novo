import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Executa o renderer ODS com o cabeçalho já reorganizado pelo layout global.
// O link Editar vértices pode não existir nessa composição; não pode invalidar a planilha.
const odsSource = fs.readFileSync('assets/js/features/ods/app.js', 'utf8');
const match = odsSource.match(/  function render\(\) \{[\s\S]*?\n  \}\n\n  let projectLoadToken/);
assert.ok(match, 'O renderer da planilha deve existir.');
const renderCode = match[0].replace(/\n\n  let projectLoadToken$/, '');
const feature={type:'Feature',geometry:{type:'Polygon',coordinates:[[[0,0],[.01,0],[.01,.01],[0,0]]]},properties:{}};
function tryRender(withLink) {
  const elements = Object.fromEntries(['sheetBody','sheetArea','sheetPerimeter','ownerSummary','neighborsBody','odsStatus'].map(id=>[id,{textContent:'',innerHTML:''}]));
  if(withLink) elements.editVertices={href:''};
  const current={id:'lot-1',title:'Gleba teste',geojson:{features:[feature]}};
  const context=vm.createContext({
    current, rows:[{code:'V-01',lng:0,lat:0,az:0,distance:7,neighbor:'Vizinho',limit:'Cerca'}],
    $:id=>elements[id]||null, window:{turf:{area:()=>1234}}, turf:{area:()=>1234},
    perimeter:()=>feature, escapeHtml:v=>String(v??''), formatCoord:()=>({lon:'0',lat:'0',e:'0',n:'0',quad:'24S'}),
    console, encodeURIComponent
  });
  vm.runInContext(`${renderCode}\nrender();`,context);
  assert.match(elements.odsStatus.textContent,/vértice/);
  if (withLink) assert.equal(elements.editVertices.href,'/mapa/?project=lot-1');
}
tryRender(true);
tryRender(false);

// A falha de um gerador NÃO pode impedir os outros de serem colocados no ZIP.
const batch=fs.readFileSync('assets/js/features/central-lotes/app.js','utf8');
const functionMatch=batch.match(/  async function documentsForLot\(lot, selectedDocs\) \{[\s\S]*?\n  \}\n  async function generate\(/);
assert.ok(functionMatch,'Rotina de geração por lote não localizada');
const documentGenerator=functionMatch[0].replace(/\n  async function generate\($/, '');
const batchContext=vm.createContext({
  core:{ isolate:()=>({}),officialProject:()=>({id:'lot-1'}) },project:{id:'p'},
  officialTypes:{memorial:{name:'Memorial.pdf',route:'memorial'},ods:{name:'Planilha.ods',route:'ods'}},
  generateOfficialDoc:async name=>{if(name==='ods')throw new Error('Falha no renderer ODS');return new Uint8Array([1,2,3]);},
  status:()=>{},
  window:{SurveyorProjectDossier:{lotDocuments:async(_data,types)=>({[types[0]+'.txt']:'OK'})}},
  console:{...console,error:()=>{}}
});
vm.runInContext(`${documentGenerator}\nthis.documentsForLot=documentsForLot;`,batchContext);
const res=await batchContext.documentsForLot({label:'Gleba 01'},['memorial','ods','geojson']);
assert.deepEqual(Object.keys(res.files).sort(),['Memorial.pdf','geojson.txt']);
assert.equal(res.errors.length,1);
assert.match(res.errors[0].mensagem,/renderer ODS/);
assert.match(batch,/errors\.length \? 'parcial' : 'ok'/,'Uma geração incompleta precisa ter status parcial.');
assert.match(batch,/RELATORIO_GERACAO\.json/);
console.log('PASS central-lotes-runtime-recovery: render ODS sem link e falhas isoladas por documento.');
