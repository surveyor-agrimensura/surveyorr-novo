import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const from = app.indexOf('  function ruralCarSearchVariants(');
const until = app.indexOf('\n  function propertyFeaturePoint(', from);
assert.ok(from >= 0 && until > from, 'Funções reais de recuperação por CAR devem existir.');
const source = app.slice(from, until);
const car = 'BA2901007' + 'ABCD'.repeat(8);
const wrongCar = 'BA2905206' + 'DCBA'.repeat(8);
const selected = {
  type: 'Feature', id: 'cefir_imovel_rural_limite_inema.1', geometry: null,
  properties: { cod_imovel: car, nome_imovel: 'SÍTIO TABULEIRO DE ITACHAMA', _surveyor_local_attributes_only: true, _surveyor_local_cache: 'BA' }
};
const wrong = { type:'Feature', id:selected.id, geometry:{type:'Polygon',coordinates:[]}, properties:{ nome_imovel:'FAZENDA JERICÓ' } };
const wrongWithCar = { ...wrong, properties: { ...wrong.properties, cod_imovel: wrongCar } };
const correct = { type:'Feature', id:'cefir_imovel_rural_limite_inema.98', geometry:{type:'Polygon',coordinates:[]}, properties:{ nom_imovel:'SÍTIO TABULEIRO DE ITACHAMA', cod_imovel:`BA-2901007-${'ABCD'.repeat(8)}` } };
const keyFor = (feature, state) => `${state}|CAR:${String(feature?.properties?.cod_imovel||'').replace(/[^A-Z0-9]/gi,'')}`;
const callUrls = [];
let remoteReply = { features:[wrong,wrongWithCar,correct] };
const memory = new Map();
const context = {
  URL, AbortController, Promise, console,
  window: { SurveyorPropertyLocalCache: { getVerifiedGeometry: async () => null, putVerifiedGeometry: async () => true } },
  OFFICIAL_PROPERTY_BOUNDARY_LAYER: 'Vetor_Recortes_Tematicos:cefir_imovel_rural_limite_inema',
  propertyCarFromFeature: (feature) => String(feature?.properties?.cod_imovel || ''),
  propertyGeometryCacheKey:keyFor,
  propertyGeometryMemoryCache: memory,
  normalizedCatalogState: (uf) => uf,
  propertySearchStateCode: () => 'BA',
  geoserviceEncodedProxyUrls: () => [],
  fetchTextWithTimeout: async (url) => { callUrls.push(url); return {text:JSON.stringify(remoteReply)}; },
  rememberPropertyGeometry:(key,value)=>memory.set(key,value),
};
vm.runInNewContext(source, context, {filename:'app.js'});
const { ruralCarSearchVariants, sameRuralPropertyIdentity, hydrateLocalPropertyGeometry } = context;
assert.equal(typeof hydrateLocalPropertyGeometry, 'function');
assert.equal(sameRuralPropertyIdentity(selected,wrong),false,'FID sequencial igual nunca autoriza feição sem CAR.');
assert.equal(sameRuralPropertyIdentity(selected,wrongWithCar),false,'Mesmo FID com outro CAR deve ser rejeitado.');
assert.equal(sameRuralPropertyIdentity(selected,correct),true,'Mesmo CAR oficial permite FID distinto.');
const variants=ruralCarSearchVariants(car);
assert.ok(variants.includes(car) && variants.includes(`BA-2901007-${'ABCD'.repeat(8)}`),'Buscar código CAR compacto e formatado.');
const outcome = await hydrateLocalPropertyGeometry(selected,'BA');
assert.equal(JSON.stringify(outcome),JSON.stringify(correct),'Resposta WFS pode conter imóveis de outros lugares; localizar somente o mesmo CAR.');
assert.equal(callUrls.length,1,'Uma consulta com variantes do CAR deve ser suficiente ao responder corretamente.');
const u = new URL(callUrls[0]);
assert.equal(u.searchParams.get('FEATUREID'),null,'FEATUREID transitório não pode ser consultado quando CAR existe.');
const cql = u.searchParams.get('CQL_FILTER');
assert.ok(cql.includes('cod_imovel') && cql.includes(car) && cql.includes(`BA-2901007-${'ABCD'.repeat(8)}`),'CQL precisa filtrar por CAR exato e aceitar formatação.');
// Mesmo com um cache antigo contaminado pela geometria errada, refazer a consulta.
memory.set(keyFor(selected,'BA'),wrong);
remoteReply={features:[correct]};
const fromCache=await hydrateLocalPropertyGeometry(selected,'BA');
assert.equal(JSON.stringify(fromCache),JSON.stringify(correct),'Cache contaminado por um FID colidente não pode ser reaproveitado.');
assert.equal(callUrls.length,2,'A recuperação deve consultar novamente após descartar cache incompatível.');
// Se a fonte devolver apenas a Fazenda Jericó, o polígono deve permanecer ausente.
memory.clear(); remoteReply={features:[wrong,wrongWithCar]};
const noMatch=await hydrateLocalPropertyGeometry(selected,'BA');
assert.equal(noMatch,null,'Nunca desenhar geometria de outra propriedade.');
assert.equal(callUrls.length,5,'No máximo três chaves de CAR devem ser tentadas, sem requisições por FEATUREID.');
const unknownCar={ type:'Feature',id:'cefir.1',geometry:null,properties:{_surveyor_local_attributes_only:true,ide_imovel:'OFFICIAL-123'} };
const matchedNoCar={ geometry:{type:'Point',coordinates:[0,0]},properties:{ide_imovel:'OFFICIAL-123'} };
assert.equal(sameRuralPropertyIdentity(unknownCar,matchedNoCar),true,'Sem CAR, código cadastral oficial correspondente deve ser aceito.');
assert.equal(sameRuralPropertyIdentity(unknownCar,wrong),false,'Sem CAR, FID não deve ser aceito como identidade.');
console.log('PASS property-geometry-car-runtime-rc1857: conflito de FID, formato do CAR, cache contaminado, identidade oficial e consultas exatas.');
