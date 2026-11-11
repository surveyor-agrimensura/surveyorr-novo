/* Teste sem dependências npm, simulando o contrato real de documentOptions da API. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
let ts; try{ts=require('typescript');}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');}
const ROOT=path.resolve(__dirname,'..');
let customization={ options:{documentOptions:{existing:'preservado',generatedDocumentDrafts:{technicalSheets:{legado:{revision:31}}}}}};
let latestWrite=null;
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const remote=async (route,opts)=>{
 assert(['/api/customization/document','/api/customization/document/draft'].includes(route));
 if(opts.method==='POST' && route.endsWith('/draft')){
  latestWrite=opts.body;
  const {makeScopedDraftPatch}=await import('../functions/surveyor-api/src/documents/scoped-draft.js');
  const supplied=makeScopedDraftPatch(customization.options,opts.body);
  customization={...customization,options:{...customization.options,documentOptions:{...customization.options.documentOptions,...supplied}}};
 } else if(opts.method==='PUT'){
  const supplied=opts.body?.options||{};
  latestWrite=supplied;
  // Appwrite RC185 guarda PUT.options dentro de options.documentOptions, merge raso.
  customization={...customization,options:{...customization.options,documentOptions:{...customization.options.documentOptions,...supplied}}};
 }
 return {customization:structuredClone(customization)};
};
const cache=new Map();
function load(rel){
 if(cache.has(rel))return cache.get(rel);
 const filename=path.join(ROOT,rel);
 const source=fs.readFileSync(filename,'utf8');
 const converted=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};cache.set(rel,module.exports);
 const customRequire=id=>{
  if(id.endsWith('/api'))return {ApiError:class extends Error{constructor(m,status){super(m);this.status=status;}},apiRequest:remote};
  if(id.endsWith('/authenticatedRequest'))return {authenticatedRequest:remote};
  if(id.includes('authService'))return {readSession:()=>({user:{id:'u'},accessToken:'token'}),checkSession:async s=>s};
  if(id.includes('memorialEngine'))return {record};
  if(id.includes('sharedMapAppearance'))return load('src/features/croqui/sharedMapAppearance.ts');
  if(id.endsWith('/customizationApi'))return load('src/features/customization/customizationApi.ts');
  if(id.endsWith('/cloudDraft'))return load('src/features/documents/cloudDraft.ts');
  throw Error('Dependência inesperada '+id+' a partir de '+rel);
 };
 vm.runInNewContext('(function(require,module,exports){'+converted+'})',{console,URL,AbortController,setTimeout,clearTimeout,crypto:globalThis.crypto}, {filename})(customRequire,module,module.exports);
 cache.set(rel,module.exports);
 return module.exports;
}
(async()=>{
 const api=load('src/features/customization/customizationApi.ts');
 const docs=load('src/features/documents/cloudDraft.ts');
 const session={user:{id:'u'},accessToken:'token'};
 // A antiga opção aninhada não pode sobrescrever o valor novo.
 let response=api.normalizeDocumentCustomization({customization:{options:{generatedDocumentDrafts:{old:true},documentOptions:{generatedDocumentDrafts:{fromCloud:true}}}}});
 assert.deepEqual(JSON.parse(JSON.stringify(response.customization.options.generatedDocumentDrafts)),{fromCloud:true});
 assert.equal(Object.hasOwn(response.customization.options,'documentOptions'),false);
 await docs.saveDocumentDraft(session,'technicalSheets','projeto-01',{revision:101,title:'GLEBA A'},'a');
 await docs.saveDocumentDraft(session,'technicalSheets','projeto-01',{revision:102,title:'GLEBA B'},'b');
 response=await api.getDocumentCustomization(session);
 assert.equal(docs.readDocumentDraft(response.customization.options,'technicalSheets','projeto-01','a').title,'GLEBA A');
 assert.equal(docs.readDocumentDraft(response.customization.options,'technicalSheets','projeto-01','b').title,'GLEBA B');
 assert.equal(docs.readDocumentDraft(response.customization.options,'technicalSheets','projeto-01','c',false).title,undefined);
 assert.equal(docs.readDocumentDraft(response.customization.options,'technicalSheets','legado','x',false).revision,undefined);
 assert.equal(docs.readDocumentDraft(response.customization.options,'technicalSheets','legado','x',true).revision,31);
 assert.equal(Object.hasOwn(latestWrite,'documentOptions'),false);
 assert.equal(Object.hasOwn(latestWrite,'generatedDocumentDraftsByFeature'),false,'o navegador não deve enviar todos os documentos');
 assert.equal(latestWrite.kind,'technicalSheets');
 assert.equal(response.customization.options.existing,'preservado');
 console.log('SURVEYOR: integração da personalização e duas glebas isoladas aprovada.');
})().catch(e=>{console.error(e);process.exitCode=1;});
