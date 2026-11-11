'use strict';
// Regressão independente de navegador: não conecta contas reais nem muda projetos.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative, mocks = {}) {
 const file = path.join(root, relative);
 const js = ts.transpileModule(fs.readFileSync(file,'utf8'), {
  fileName:file, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const module = {exports:{}};
 const sandbox={module,exports:module.exports,require:name=>{
  if (Object.prototype.hasOwnProperty.call(mocks,name)) return mocks[name];
  throw Error(`Dependência inesperada: ${name}`);
 },console, setTimeout, clearTimeout,crypto:require('node:crypto').webcrypto};
 vm.runInNewContext(js,sandbox,{filename:relative});
 return module.exports;
}
async function main(){
 const rec=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const cloud=load('src/features/documents/cloudDraft.ts',{
  '../customization/customizationApi':{getDocumentCustomization(){},updateDocumentCustomization(){}},
  '../memorial/memorialEngine':{record:rec},
  '../croqui/sharedMapAppearance':{mapAppearancePatch:()=>({})}
 });
 const options={generatedDocumentDrafts:{memorial:{p1:{fields:{reference:'ANTIGO'}}}},generatedDocumentDraftsByFeature:{memorial:{p1:{g1:{fields:{reference:'G1'}},g2:{fields:{reference:'G2'}}}}}};
 assert.equal(cloud.readDocumentDraft(options,'memorial','p1','g1',false).fields.reference,'G1');
 assert.equal(cloud.readDocumentDraft(options,'memorial','p1','g2',false).fields.reference,'G2');
 assert.equal(Object.keys(cloud.readDocumentDraft(options,'memorial','p1','g3',false)).length,0);
 assert.equal(cloud.readDocumentDraft(options,'memorial','p1','g3',true).fields.reference,'ANTIGO');
 const geo=load('src/features/map/mapCloudPersistence.ts');
 const make=(id,color)=>({type:'Feature',id,geometry:{type:'Polygon',coordinates:[[[0,0],[0.1,0],[0.1,0.1],[0,0]]]},properties:{name:'Área '+id,strokeColor:'#222',fillColor:color,confrontants:{'0-1':'Maria','1-2':'Valdemir'}}});
 const local=[make('g1','#ff0000'),make('g2','#00ff00')];
 const remote=local.map((f,i)=>({id:'db-'+i,geoJson:f.geometry,properties:geo.serializeMapFeature(f)}));
 assert.equal(geo.hasVerifiedMapEdits(remote,local),true);
 assert.equal(geo.hasVerifiedMapEdits(remote.slice(0,1),local),false);
 assert.equal(geo.hasVerifiedMapEdits([{...remote[0],properties:{...remote[0].properties,fillColor:'#123456'}},remote[1]],local),false);
 assert.equal(geo.hasVerifiedMapEdits([remote[0],{...remote[1],properties:{...remote[1].properties,confrontants:{'0-1':'Maria'}}}],local),false);
 // Simula o contrato do backend: mesclagem rasa de documentOptions.
 let store={documentOptions:{croquiDraftsByFeature:{p1:{g1:{names:['V1']}}}}};
 class ApiError extends Error{}
 const mockApi=async (_path,request)=>{
  if(request.method==='GET')return {customization:{options:{...store}}};
  if(request.method==='PUT'){
   await Promise.resolve();
   store={...store,documentOptions:{...store.documentOptions,...rec(request.body.options)}};
   return {customization:{options:{...store}}};
  }
  throw Error('Método inesperado');
 };
 const customization=load('src/features/customization/customizationApi.ts',{
  '../../lib/api':{ApiError,apiRequest:mockApi},
  '../../lib/authenticatedRequest':{authenticatedRequest:mockApi},
  '../auth/authService':{readSession:()=>null,checkSession:async s=>s}
 });
 const session={accessToken:'token',user:{id:'user1'}};
 await Promise.all([
  customization.updateDocumentCustomization(session,s=>({options:{croquiDraftsByFeature:{...rec(rec(s.options).croquiDraftsByFeature),p1:{g1:{names:['V1']},g2:{names:['V2']}}}}})),
  customization.updateDocumentCustomization(session,s=>({options:{confrontantRegistry:{p1:{g1:{neighbors:['Maria','Valdemir']}}}}}))
 ]);
 const read=await customization.getDocumentCustomization(session);
 assert.equal(rec(rec(rec(read.customization.options).croquiDraftsByFeature).p1).g2.names[0],'V2');
 assert.equal(rec(rec(rec(read.customization.options).confrontantRegistry).p1).g1.neighbors[1],'Valdemir');
 console.log('SURVEYOR Etapa 74: 9 verificações de isolamento, edição e fila de gravação aprovadas.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
