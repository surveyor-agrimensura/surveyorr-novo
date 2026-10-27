import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const begin = app.indexOf('  // O clique e a antecipação compartilham a mesma promessa de geometria;');
const end = app.indexOf('  function propertyFeaturePoint(feature)', begin);
assert.ok(begin > 0 && end > begin, 'A rotina de navegação rápida deve existir.');

const source = app.slice(begin, end) + `
  globalThis.fastNavigationTestApi = { getPropertyGeometryForSelection, warmupPropertyGeometry, pending: propertyGeometryRequestsInFlight };`;
let calls = 0;
let resolveRequest;
const fixture = { properties: { _surveyor_local_attributes_only: true, cod_imovel: 'BA2901007EXEMPLO' } };
const loaded = { geometry: { type: 'Polygon', coordinates: [] }, properties: { cod_imovel: 'BA2901007EXEMPLO' } };
const ctx = {
  propertyGeometryCacheKey: () => 'BA|CAR:2901007EXEMPLO',
  propertyGeometryMemoryCache: new Map(),
  hydrateLocalPropertyGeometry: () => {
    calls += 1;
    return new Promise((resolve) => { resolveRequest = resolve; });
  }
};
vm.runInNewContext(source, ctx);
const { warmupPropertyGeometry, getPropertyGeometryForSelection, pending } = ctx.fastNavigationTestApi;
warmupPropertyGeometry(fixture, 'BA');
assert.equal(calls, 1, 'Permanecer sobre um item deve iniciar somente uma busca antecipada.');
const clicked = getPropertyGeometryForSelection(fixture, 'BA');
assert.equal(calls, 1, 'O clique deve reutilizar a consulta iniciada pelo hover.');
resolveRequest(loaded);
const result = await clicked;
assert.equal(result.geometry.type, 'Polygon', 'O mesmo polígono recuperado deve ser usado no clique.');
await new Promise((resolve) => setImmediate(resolve));
assert.equal(pending.size, 0, 'A promessa concluída não pode bloquear buscas futuras.');
assert.match(app, /item\.addEventListener\('pointerenter',[\s\S]{0,650}warmupPropertyGeometry\(feature, stateCode, \{ priority: true \}\)/, 'O hover deve antecipar a geometria do item apontado.');
assert.match(app, /PROPERTY_GEOMETRY_PREFETCH_CONCURRENCY = 2/, 'Pré-carregamento não pode disparar consultas ilimitadas.');
assert.match(app, /action\.textContent = 'Abrindo…'/, 'O clique precisa indicar imediatamente que está abrindo o imóvel.');
assert.match(app, /map\.fitBounds\(destination, \{ maxZoom: 18, animate: false \}\)/, 'Saltos longos não devem aguardar a animação da câmera.');
assert.match(app, /sameRuralPropertyIdentity\((?:feature|selected), item\)/, 'A geometria oficial deve continuar sendo validada pela identidade.');
console.log('PASS property-navigation-video-rc1859: hover compartilha WFS com o clique, navegação é imediata e identidade permanece obrigatória.');
