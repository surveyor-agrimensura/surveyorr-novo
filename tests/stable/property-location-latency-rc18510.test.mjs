import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const disk = fs.readFileSync('assets/js/features/mapa/property-local-cache.js', 'utf8');
const from = app.indexOf('  function ruralCarSearchVariants(');
const until = app.indexOf('  function propertyFeaturePoint(', from);
assert.ok(from > 0 && until > from);
const source = app.slice(from, until) + '\nglobalThis.lookup = hydrateLocalPropertyGeometry;';
const CAR = 'BA2901007' + 'ABCD'.repeat(8);
const selected = {type:'Feature',id:'cefir.1',geometry:null,properties:{cod_imovel:CAR,_surveyor_local_attributes_only:true}};
const correct = {type:'Feature',id:'cefir.50',geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]},properties:{cod_imovel:CAR}};
const wrong = {type:'Feature',id:'cefir.1',geometry:{type:'Polygon',coordinates:[[[2,0],[3,0],[3,1],[2,0]]]},properties:{cod_imovel:'BA2905206'+'DCBA'.repeat(8)}};
const persisted = new Map();
let calls = 0;
const createContext = (fetchReply) => {
  const memory = new Map();
  const window = {SurveyorPropertyLocalCache:{
    getVerifiedGeometry:async(key)=>persisted.get(key)||null,
    putVerifiedGeometry:async(key, feature)=>{ persisted.set(key,feature); return true; }
  }};
  const context = {
    URL, Promise, Map, AbortController, window,
    console:{debug(){},warn(){}},
    propertyGeometryMemoryCache:memory,
    normalizedCatalogState:(value)=>value || 'BA',
    propertySearchStateCode:()=> 'BA',
    propertyCarFromFeature:(feature)=>feature?.properties?.cod_imovel||'',
    OFFICIAL_PROPERTY_BOUNDARY_LAYER:'Vetor_Recortes_Tematicos:cefir_imovel_rural_limite_inema',
    propertyGeometryCacheKey:(feature)=>`BA|CAR:${String(feature?.properties?.cod_imovel||'').replace(/[^A-Z0-9]/gi,'')}`,
    rememberPropertyGeometry:(key, feature)=>memory.set(key,feature),
    geoserviceEncodedProxyUrls:()=>['https://proxy-one.example/wfs','https://proxy-two.example/wfs'],
    fetchTextWithTimeout:async(url,options,timeoutMs)=>{
      calls++;
      assert.ok(timeoutMs <= 6500, 'Consulta de localização não deve ter espera serial de 10s em cada gateway.');
      return await fetchReply(url,options);
    }
  };
  vm.runInNewContext(source,context);
  return { lookup:context.lookup,memory };
};

// A segunda rota responde rapidamente sem aguardar uma primeira rota lenta.
const first = createContext(async (url)=> {
  await new Promise(resolve=>setTimeout(resolve,url.includes('one')?150:10));
  return {text:JSON.stringify({features:[wrong,correct]})};
});
const start=Date.now();
const found=await first.lookup(selected,'BA');
assert.equal(found?.properties?.cod_imovel,CAR,'Geometria correta tem prioridade, ainda que outra tenha o FID igual.');
assert.ok(Date.now()-start<130,'Gateway rápido deve vencer sem aguardar o gateway lento.');
assert.ok(calls<=2,'No máximo dois gateways para a primeira consulta de CAR.');
await new Promise(resolve=>setImmediate(resolve));
assert.ok(persisted.size===1,'Geometria com CAR confirmado deve ser persistida.');

// Reabrir a página é representado por outro contexto, com memória vazia.
const afterReload=createContext(async()=>{throw new Error('Uma geometria já verificada não deve voltar ao WFS.');});
const beforeCalls=calls;
const repeated=await afterReload.lookup(selected,'BA');
assert.equal(repeated?.properties?.cod_imovel,CAR);
assert.equal(calls,beforeCalls,'Índice de geometria persistida remove espera de rede após recarregar a página.');

// Cache persistente contaminado nunca autoriza troca de imóvel.
persisted.set(`BA|CAR:${CAR}`,wrong);
const invalid=createContext(async()=>({text:JSON.stringify({features:[correct]})}));
assert.equal((await invalid.lookup(selected,'BA'))?.properties?.cod_imovel,CAR);
assert.ok(calls>beforeCalls,'Cache com CAR divergente deve refazer a consulta oficial.');
assert.match(disk,/VERIFIED_GEOMETRY_DB = 'surveyor-property-verified-geometry-v1'/,'Geometrias são salvas em banco separado do índice legado.');
assert.match(disk,/VERIFIED_GEOMETRY_TTL/);
assert.match(app,/resetPropertyGeometryWarmup\(features, stateCode\)/,
  'A lista deve usar uma fila móvel de geometria sem baixar mil imóveis.');
console.log('PASS property-location-latency-rc18510: duas rotas em paralelo, identidade intacta, cache persistente e aquecimento moderado.');
