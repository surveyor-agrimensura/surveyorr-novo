import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const begin = app.indexOf('  // O clique e a antecipação compartilham a mesma promessa de geometria;');
const end = app.indexOf('  function propertyFeaturePoint(feature)', begin);
assert.ok(begin > 0 && end > begin);
assert.match(app, /resetPropertyGeometryWarmup\(features, stateCode\)/);
assert.match(app, /advancePropertyGeometryWarmup\(nextIndex\)/);
assert.match(app, /PROPERTY_GEOMETRY_PREFETCH_WINDOW = 3/);
assert.match(app, /PROPERTY_GEOMETRY_PREFETCH_CONCURRENCY = 2/);

const pending = new Map();
const requested = [];
const features = Array.from({length: 1000}, (_, i) => ({
  properties: { cod_imovel: `BA${i}`, _surveyor_local_attributes_only: true }
}));
const ctx = {
  Map, Set, Promise,
  propertyGeometryCacheKey: (feature) => feature.properties.cod_imovel,
  propertyGeometryMemoryCache: new Map(),
  hydrateLocalPropertyGeometry: (feature) => {
    const key = feature.properties.cod_imovel;
    requested.push(key);
    return new Promise((resolve) => pending.set(key, resolve));
  }
};
vm.runInNewContext(app.slice(begin,end) + `
  globalThis.prefetchApi = {
    resetPropertyGeometryWarmup, advancePropertyGeometryWarmup,
    getPropertyGeometryForSelection, warmupPropertyGeometry,
    pendingRequests: propertyGeometryRequestsInFlight,
    state:()=>({ running:propertyGeometryWarmupRunning, queued:propertyGeometryWarmupQueue.map(v=>v.key) })
  };`,ctx);
const api = ctx.prefetchApi;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const complete = async (i) => {
  const key=`BA${i}`;
  assert.ok(pending.has(key),`A geometria ${key} precisa ter começado.`);
  pending.get(key)({geometry:{type:'Polygon',coordinates:[]},properties:{cod_imovel:key}});
  pending.delete(key);
  await tick();
};
api.resetPropertyGeometryWarmup(features,'BA');
assert.deepEqual(requested, ['BA0','BA1'], 'A busca inicia em segundo plano os dois primeiros; o terceiro aguarda uma vaga.');
assert.deepEqual([...api.state().queued],['BA2']);
assert.equal(api.state().running,2);
const clickedFirst = api.getPropertyGeometryForSelection(features[0],'BA');
assert.equal(requested.length,2,'Clique no primeiro reutiliza a requisição de pré-carregamento.');
await complete(0);
await clickedFirst;
assert.deepEqual(requested,['BA0','BA1','BA2'],'Assim que uma vaga abre, antecipa o terceiro.');
api.advancePropertyGeometryWarmup(0);
assert.deepEqual([...api.state().queued],['BA3'],'Ao selecionar o primeiro, prepara o quarto depois dos dois restantes.');
await complete(1);
assert.equal(requested[3],'BA3','Avança a fila sem outra seleção manual.');
assert.equal(api.state().running,2,'Máximo de duas consultas WFS de fundo.');
api.advancePropertyGeometryWarmup(1);
assert.deepEqual([...api.state().queued],['BA4'],'Ao selecionar o segundo, agenda o quinto.');
assert.equal(requested.length,4,'Não deve disparar todas as mil geometrias ao pesquisar.');
await complete(2);
assert.equal(requested[4],'BA4');
await complete(3);
await complete(4);
assert.equal(api.state().running,0);
assert.equal(api.state().queued.length,0);
assert.equal(requested.length,5,'Não avança indefinidamente sem navegação.');

// Consultas com um, dois ou três registros preparam todos.
for (const length of [1,2,3]) {
  const starters=[];
  const sandbox={
    Map, Set, Promise,
    propertyGeometryCacheKey:(f)=>f.properties.cod_imovel,
    propertyGeometryMemoryCache:new Map(),
    hydrateLocalPropertyGeometry:(f)=>{starters.push(f.properties.cod_imovel);return Promise.resolve({geometry:{type:'Polygon'}});}
  };
  vm.runInNewContext(app.slice(begin,end)+'\nglobalThis.reset = resetPropertyGeometryWarmup;',sandbox);
  sandbox.reset(features.slice(0,length),'BA');
  await tick();
  assert.equal(starters.length,length,`Lista com ${length} resultados prepara todos os imóveis.`);
}

// Nova pesquisa descarta geometrias que estavam apenas aguardando na fila.
const older = features.slice(10,15);
api.resetPropertyGeometryWarmup(older, 'BA');
// A fila da pesquisa anterior não pode ser reutilizada quando se seleciona outra cidade.
api.resetPropertyGeometryWarmup([], 'BA');
assert.equal(api.state().queued.length,0,'Fila antiga descartada na troca da pesquisa.');

console.log('PASS property-progressive-prefetch-rc18512: janela móvel 3, duas consultas simultâneas, deduplicação, avanço e descarte de fila antiga.');
