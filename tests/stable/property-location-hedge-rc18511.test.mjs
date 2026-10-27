import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const begin = app.indexOf('  // RC185.11: ao receber 502/erro de uma rota');
const end = app.indexOf('  // A consulta de geometria é distinta da busca rápida', begin);
assert.ok(begin > 0 && end > begin);
const CAR = 'BA2901007' + 'ABCD'.repeat(8);
const feature = {geometry: null, properties: {cod_imovel: CAR}};
const correct = {geometry: {type:'Polygon',coordinates:[]}, properties: {cod_imovel: CAR}};
const wrong = {geometry: {type:'Polygon',coordinates:[]}, properties: {cod_imovel: 'BA2905206' + 'DCBA'.repeat(8)}};
const called = [];
let active=0;
let highestActive=0;
let slowResolver;
const fetcher = async (url) => {
  called.push(url);
  active++;
  highestActive = Math.max(highestActive, active);
  try {
    if (url.includes('proxy-b')) return await new Promise((resolve)=>{ slowResolver=resolve; });
    if (url.includes('proxy-a')) throw new Error('HTTP 502 Bad Gateway');
    if (url.includes('direct')) return { text:JSON.stringify({features:[wrong,correct]}) };
    throw new Error('unexpected route');
  } finally { active--; }
};
const context = {
  URL, Date, AbortController, Promise, Map, Set,
  propertyCarFromFeature:(f)=>f?.properties?.cod_imovel||'',
  sameRuralPropertyIdentity:(selected,candidate)=>Boolean(candidate?.geometry && selected?.properties?.cod_imovel === candidate?.properties?.cod_imovel),
  fetchTextWithTimeout:fetcher,
  console
};
vm.runInNewContext(app.slice(begin, end), context);
const {fetchVerifiedPropertyGeometry, rankedPropertyGeometryUrls}=context;
assert.equal(typeof fetchVerifiedPropertyGeometry, 'function');
const start=Date.now();
const result=await Promise.race([
  fetchVerifiedPropertyGeometry([
    'https://proxy-a.example/wfs',
    'https://proxy-b.example/wfs',
    'https://direct.example/wfs'
  ], feature),
  new Promise((_,reject)=>setTimeout(()=>reject(new Error('Não iniciou a alternativa após 502')),220))
]);
assert.equal(result?.properties?.cod_imovel,CAR,'A rota alternativa precisa conferir o CAR correto.');
assert.ok(called.some((url)=>url.includes('direct')),'502 libera vaga e inicia terceira rota imediatamente.');
assert.ok(Date.now()-start<220,'Não esperar o gateway lento ao falhar o outro.');
assert.ok(highestActive <= 2,'No máximo duas consultas simultâneas.');
assert.equal(rankedPropertyGeometryUrls(['https://proxy-a.example/x','https://direct.example/x'])[0], 'https://direct.example/x', 'Gateway com sucesso anterior deve ganhar prioridade sobre gateway em pausa.');
if (slowResolver) slowResolver({text:JSON.stringify({features:[wrong]})});
await new Promise((resolve)=>setTimeout(resolve,0));

// Novas buscas curtas antecipam também o segundo imóvel; busca genérica não baixa centenas.
assert.match(app,/resetPropertyGeometryWarmup\(features, stateCode\)/);
assert.match(app,/advancePropertyGeometryWarmup\(nextIndex\)/);
assert.match(app,/PROPERTY_GEOMETRY_PREFETCH_CONCURRENCY = 2/);
assert.match(app,/PROPERTY_GEOMETRY_PREFETCH_WINDOW = 3/);
assert.match(app,/}, 75\);/,'A passagem breve do cursor inicia a recuperação, sem espera anterior de 250 ms.');
// Executa a função real de warmup: dois resultados diferentes começam juntos,
// um terceiro não invade as vagas e um clique reutiliza o mesmo carregamento.
const fromWarmup = app.indexOf('  // O clique e a antecipação compartilham a mesma promessa de geometria;');
const toWarmup = app.indexOf('  function propertyFeaturePoint(', fromWarmup);
let pendingResolvers = [];
let launched = 0;
const warmCtx = {
  Map, Promise,
  propertyGeometryCacheKey:(f)=>'BA|CAR:'+f.properties.cod_imovel,
  propertyGeometryMemoryCache:new Map(),
  hydrateLocalPropertyGeometry:() => {
    launched += 1;
    return new Promise((resolve)=>{pendingResolvers.push(resolve);});
  }
};
vm.runInNewContext(app.slice(fromWarmup,toWarmup) + '\nglobalThis.testWarmup = {warmupPropertyGeometry,getPropertyGeometryForSelection};', warmCtx);
const f1={properties:{_surveyor_local_attributes_only:true,cod_imovel:'BA-A'}};
const f2={properties:{_surveyor_local_attributes_only:true,cod_imovel:'BA-B'}};
const f3={properties:{_surveyor_local_attributes_only:true,cod_imovel:'BA-C'}};
warmCtx.testWarmup.warmupPropertyGeometry(f1,'BA');
warmCtx.testWarmup.warmupPropertyGeometry(f2,'BA');
warmCtx.testWarmup.warmupPropertyGeometry(f3,'BA');
assert.equal(launched,2,'O primeiro e o segundo imóvel devem ser antecipados sem iniciar o terceiro.');
const clickSecond=warmCtx.testWarmup.getPropertyGeometryForSelection(f2,'BA');
assert.equal(launched,2,'O clique no segundo imóvel reutiliza a consulta já antecipada.');
pendingResolvers[1]({geometry:{type:'Polygon',coordinates:[]}});
await clickSecond;
await new Promise((resolve)=>setImmediate(resolve));
warmCtx.testWarmup.warmupPropertyGeometry(f3,'BA');
assert.equal(launched,3,'Ao liberar uma vaga, outro item pode ser antecipado.');
pendingResolvers[0]({geometry:{type:'Polygon',coordinates:[]}});
pendingResolvers[2]({geometry:{type:'Polygon',coordinates:[]}});
await new Promise((resolve)=>setImmediate(resolve));

console.log('PASS property-location-hedge-rc18511: fallback imediato após 502, identidade estrita, dois gateways por vez e aquecimento dos dois primeiros imóveis.');
