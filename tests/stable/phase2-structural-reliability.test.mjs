import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(name, 'utf8');
const maps = read('assets/js/features/mapas/app.js');
const memorial = read('assets/js/features/memorial/app.js');
const downloads = read('assets/js/core/downloads.js');
const api = read('functions/surveyor-api/src/main.js');
const save = read('functions/surveyor-save/src/main.js');
const projects = read('assets/js/core/projects.js');
const slice = (raw, first, last) => {
  const from = raw.indexOf(first), to = raw.indexOf(last, from + first.length);
  assert.ok(from >= 0 && to > from, `Trecho não encontrado: ${first}`);
  return raw.slice(from, to);
};
const run = (source, context, expression) => vm.runInNewContext(`${source}\n${expression}`, context);

// Memorial: a chave de cache deve incorporar conteúdo do projeto e visual,
// não somente um ID, sem reaproveitar PNG de outro SVG.
assert.match(memorial, /geojson:p\?\.geojson/);
assert.match(memorial, /metadata:p\?\.metadata/);
assert.match(memorial, /theme:themeNow/);
assert.match(memorial, /const mapRenderKey=`\$\{String\(p\?\.id/);
assert.match(memorial, /png=livePreview\?'':await withTimeout\(svgToPngDataUrl\(svg\)/);
assert.doesNotMatch(memorial, /png=livePreview\?\(lastMapPng\|\|''\)/);
assert.match(maps, /const sceneSource=JSON\.stringify\(\{/);
assert.match(maps, /const assertSameProject = \(\) => \{/);
assert.match(maps, /assertSameProject\(\);/);
assert.match(maps, /features:project\?\.geojson\?\.features/);

// Fonte oficial unificada: SVG, Word e PDF aguardam a mesma preparação.
assert.match(maps, /window\.SurveyorPranchaExportSourceReady = readyPranchaExportSvg/);
assert.match(maps, /exportSvg = await readyPranchaExportSvg\(\)/);
assert.match(downloads, /const sourceHtml=await preparedMapDocumentSvg\(preview\)/);
assert.match(downloads, /const html=await preparedMapDocumentSvg\(\$\('mapPreview'\)\)/);
assert.match(downloads, /state\.sourceHtml !== sourceHtml \|\| state\.pageFormat !== requestedFormat/);
const prepareSrc=slice(downloads,'  async function preparedMapDocumentSvg(preview) {','  async function isolatedMapPdf() {');
const current=await run(prepareSrc,{window:{SurveyorPranchaExportSourceReady:async()=>'<svg id="current"></svg>'},previewPdfState:()=>({sourceHtml:'<svg id="old"></svg>'})},'preparedMapDocumentSvg({})');
assert.equal(current,'<svg id="current"></svg>');
const fallback=await run(prepareSrc,{window:{},previewPdfState:()=>({sourceHtml:'<svg id="saved"></svg>'})},'preparedMapDocumentSvg({})');
assert.equal(fallback,'<svg id="saved"></svg>');

// Confrontantes: verificar cada nome esperado e não apenas presença da classe.
const expectedBlock=slice(maps,'    function expectedConfrontanteNames(project) {','    async function readyPranchaExportSvg() {');
function makeDomParser() {
  return class DOMParser {
    parseFromString(raw) {
      const found=[...String(raw).matchAll(/<g\s+class="[^"]*sv-confrontante-callout[^"]*"[^>]*data-confrontante-name="([^"]*)"[^>]*>([\s\S]*?)<\/g>/g)];
      const entries=found.map(m=>({
        querySelector:()=>m[2].includes('sv-confrontante-name-text') ? {} : null,
        getAttribute:()=>m[1]
      }));
      return {querySelector:()=>null,querySelectorAll:()=>entries};
    }
  };
}
const project={geojson:{features:[{properties:{confrontanteTrechos:[{nome:'Maria'},{nome:'José'}]}}]}};
const funcs=run(expectedBlock,{perimeter:(p)=>p.geojson.features[0],currentPranchaLiveElementValues:()=>({confrontantes:true}),DOMParser:makeDomParser()},'({expectedConfrontanteNames,hasPrintableConfrontante})');
assert.equal(funcs.expectedConfrontanteNames(project).length,2);
const one='<svg><g class="sv-confrontante-callout" data-confrontante-name="Maria"><text class="sv-confrontante-name-text">Maria</text></g></svg>';
const both='<svg>'+one.replace('<svg>','').replace('</svg>','')+'<g class="sv-confrontante-callout" data-confrontante-name="José"><text class="sv-confrontante-name-text">José</text></g></svg>';
assert.equal(funcs.hasPrintableConfrontante(one,project),false,'um rótulo não representa dois confrontantes');
assert.equal(funcs.hasPrintableConfrontante(both,project),true);

// Quota: falha parcial de listagem/leitura não pode se transformar em 0 bytes.
const quotaSaveSrc=slice(save,'async function storageUsageForOwner(ownerId) {','function payloadStorageOwner(');
const quotaEnv={
  Query:{equal:(key,value)=>[key,value]},
  listAllRows:async(collection)=>collection==='projects'?[{geojsonFileId:'f1',status:'active'}]:[],
  readFileText:async()=>'{"value":42}', bucketId:()=> 'project_files',
  safeJson:()=>({}), Buffer, statusError:(status,message,extra)=>Object.assign(new Error(message),{status,...extra})
};
assert.equal(await run(quotaSaveSrc,quotaEnv,'storageUsageForOwner("user")'),12);
const quotaFailed=run(quotaSaveSrc,{...quotaEnv,readFileText:async()=>''},'storageUsageForOwner("user")');
await assert.rejects(quotaFailed,(error)=>error.status===503);
const quotaListFailed=run(quotaSaveSrc,{...quotaEnv,listAllRows:async()=>{throw new Error('sem rede')}},'storageUsageForOwner("user")');
await assert.rejects(quotaListFailed,/sem rede/);

const apiLockSrc=slice(api,'const dailyUsageLocks = new Map();','async function dailyUsageStatus(');
const lockCtx={setTimeout};
const lock=run(apiLockSrc,lockCtx,'({withDailyUsageLock,dailyUsageLocks})');
const sequence=[];
await Promise.all([1,2,3].map((i)=>lock.withDailyUsageLock('same',async()=>{
  sequence.push(`begin${i}`);
  await new Promise((resolve)=>setTimeout(resolve,3));
  sequence.push(`end${i}`);
})));
assert.deepEqual(sequence,['begin1','end1','begin2','end2','begin3','end3']);
assert.equal(lock.dailyUsageLocks.size,0,'travas concluídas devem ser liberadas');
await assert.rejects(lock.withDailyUsageLock('same',async()=>{throw new Error('erro')},),/erro/);
assert.equal(lock.dailyUsageLocks.size,0,'trava deve ser liberada após erro');
assert.match(api,/const sizes=await Promise\.all\(active\.slice\(i,i\+6\)\.map\(\(row\)=>storedProjectBytes\(row\)\)\)/);
assert.match(api,/code:'STORAGE_USAGE_UNAVAILABLE'/);
// Mutação exige confirmação atual do status da conta e revogação de sessão.
assert.match(api, /if \(\['POST','PUT','PATCH','DELETE'\]\.includes\(method\(request\)\)\)/);
assert.match(api, /assertTokenNotRemotelyRevoked\(payload,liveAccount\)/);
assert.match(api, /profileIsActive\(liveProfile,liveAccount\)/);
const liveAccessSrc=slice(save,'async function assertLiveSaveAccess(user) {','function normalizeWorkspaceRole(');
const activeUser={id:'u1',__tokenSessionVersion:'sessao-atual',__tokenIssuedAt:100};
const validAccount={status:true,prefs:{surveyor:{status:'active',sessionVersion:'sessao-atual'}}};
const liveContext={
  awFetch:async()=>validAccount,actorUserId:(u)=>u.id,
  statusError:(status,message,details)=>Object.assign(new Error(message),{status,details})
};
await run(liveAccessSrc,liveContext,'assertLiveSaveAccess('+JSON.stringify(activeUser)+')');
await assert.rejects(
  run(liveAccessSrc,{...liveContext,awFetch:async()=>({...validAccount,status:false})},'assertLiveSaveAccess('+JSON.stringify(activeUser)+')'),
  (error)=>error.status===403
);
await assert.rejects(
  run(liveAccessSrc,{...liveContext,awFetch:async()=>({...validAccount,prefs:{surveyor:{sessionVersion:'revogada'}}})},'assertLiveSaveAccess('+JSON.stringify(activeUser)+')'),
  (error)=>error.status===401
);
assert.match(projects, /surveyor:projects-cache-fallback/);
assert.match(projects, /remoteConfirmed:false/);
assert.match(projects, /notifyCloudCacheFallback\('project',id\)/);
console.log('PASS phase2-structural-reliability: snapshots técnicos, caches, confrontantes, quota, locks e aviso de cache.');
