import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const from = source.indexOf('function ruralCarSearchVariants(');
const to = source.indexOf('function propertyFeaturePoint(', from);
assert.ok(from > 0 && to > from, 'Localizar o código efetivo de identidade e hidratação.');
const section = source.slice(from, to);
const setup = ({ responses }) => {
  const requested = [];
  const cache = new Map();
  const sandbox = {
    URL, Map, Number, String, AbortController, Promise, window:{SurveyorPropertyLocalCache:{getVerifiedGeometry:async()=>null,putVerifiedGeometry:async()=>true}}, console: { debug() {}, warn() {} },
    normalizedCatalogState: () => 'BA',
    propertySearchStateCode: () => 'BA',
    OFFICIAL_PROPERTY_BOUNDARY_LAYER: 'Vetor_Recortes_Tematicos:cefir_imovel_rural_limite_inema',
    propertyGeometryMemoryCache: cache,
    propertyGeometryCacheKey: (feature) => `BA|${feature?.id}`,
    propertyCarFromFeature: (feature) => feature?.properties?.cod_imovel || '',
    geoserviceEncodedProxyUrls: (url) => [`https://surveyor.test/wfs-url/${encodeURIComponent(url)}`],
    fetchTextWithTimeout: async (url, opts, timeoutMs) => {
      requested.push({ url, timeoutMs });
      const next = responses[requested.length - 1];
      if (next instanceof Error) throw next;
      if (next === null || next === undefined) throw new Error('Gateway indisponível');
      return { text:JSON.stringify(next) };
    },
    rememberPropertyGeometry: (key, feature) => cache.set(key, feature)
  };
  vm.runInNewContext(`${section}\nglobalThis.__hydrate = hydrateLocalPropertyGeometry;`, sandbox, { filename: 'app-hydration-runtime.js' });
  return { sandbox, requested, cache };
};
const selected = { type:'Feature', id:'cefir.1001', properties: { cod_imovel:'BA2901007EXEMPLOCARIDENTIDADE', _surveyor_local_attributes_only:true, _surveyor_local_source_id:'cefir.1001' }, geometry:null };
const wrong = { type:'Feature', id:'cefir.5555', properties: { cod_imovel:'BA2905206OUTROIMOVEL' }, geometry:{type:'Point',coordinates:[-42,-14]} };
const correct = { type:'Feature', id:'cefir.1001', properties: {cod_imovel:'BA2901007EXEMPLOCARIDENTIDADE',nome_imovel:'Sítio correto'}, geometry:{type:'Point',coordinates:[-39,-13]} };

// A consulta por CAR deve tentar outra chave cadastral caso a primeira
// consulta falhe, sem recorrer a FID sequencial não confiável.
const recover = setup({ responses:[null,{type:'FeatureCollection',features:[wrong,correct]}] });
assert.equal(JSON.stringify(await recover.sandbox.__hydrate(selected,'BA')),JSON.stringify(correct),'Depois da falha de FEATUREID, a busca exata pelo CAR precisa recuperar a geometria correta.');
assert.equal(recover.requested.length,2,'Fallback por CAR pode avançar para segunda chave quando a primeira falhar.');
assert.ok(recover.requested.every((entry)=>decodeURIComponent(entry.url).includes('CQL_FILTER=')),'Todas as consultas devem usar o CAR em CQL.');
assert.ok(recover.requested.every((entry)=>!decodeURIComponent(entry.url).includes('FEATUREID=')),'Nunca usar FID sequencial como referência de CAR.');

// Mesmo se o serviço devolver um imóvel diferente, NUNCA projetá-lo no mapa.
const mismatch = setup({ responses:[{features:[wrong]},{features:[wrong]},{features:[wrong]}] });
assert.equal(await mismatch.sandbox.__hydrate(selected,'BA'),null,'Não associar imóvel de outro CAR.');
assert.equal(mismatch.cache.size,0,'Não colocar geometria errada no cache.');

// Na indisponibilidade completa, nenhuma geometria é inventada.
const offline = setup({ responses:[null,null,null] });
assert.equal(await offline.sandbox.__hydrate(selected,'BA'),null,'WFS indisponível não pode gerar polígono artificial.');
assert.ok(offline.requested.length<=6,'No máximo três campos CAR por dois gateways, sem avalanche de pedidos.');

assert.match(source,/if \(ok\) \{[\s\S]{0,170}propertyContextSearchState\.selectedIndex = nextIndex/,'Visualizando somente depois da confirmação da geometria.');
console.log('PASS property-geometry-retry-runtime-v186: fallback por campos CAR, identidade verificável, erro de gateway limitado e estado UI após sucesso.');
