import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cache = fs.readFileSync('assets/js/features/mapa/property-local-cache.js', 'utf8');
const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const text = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const scoreStart = cache.indexOf('  const GENERIC_PROPERTY_NAME_WORDS =');
const scoreEnd = cache.indexOf('  async function getAllByIndex(', scoreStart);
assert.ok(scoreStart > 0 && scoreEnd > scoreStart, 'Extrair a pontuação real do índice local.');
const scoreContext = { normalizeText: text, Set, String, Math };
vm.runInNewContext(`${cache.slice(scoreStart, scoreEnd)}\nglobalThis.score = recordScore;`, scoreContext);
const score = scoreContext.score;
const record = (name) => ({ nn: text(name), c:'', d:'' });
assert.ok(score(record('Sítio Bahia'), text('Sítio Bahia'), '') > 0, 'Nome exato deve ser encontrado.');
assert.equal(score(record('Sítio Bahia'), text('Sítio Riu Bahia'), ''), -1, 'Termo ausente não deve produzir falso positivo.');
assert.ok(score(record('Sítio Rio Bahia'), text('Sítio Rio Bahia'), '') > 0, 'Nome composto completo deve funcionar.');
assert.ok(score(record('Sítio Tabuleiro de Itachama'), text('Tabuleiro Itachama'), '') > 0, 'Busca por palavras relevantes sem o tipo genérico deve funcionar.');
assert.ok(score(record('Sítio Bahia'), text('Sítio'), '') > 0, 'Busca genérica por Sítio deve continuar funcionando.');

const matcherStart = app.indexOf('  function propertyNameMatchScore(');
const matcherEnd = app.indexOf('  const sicarPropertySchemaCache', matcherStart);
assert.ok(matcherStart > 0 && matcherEnd > matcherStart);
const matcherContext = {
  normalizePropertyNameSearch: text,
  canonicalPropertyNameSearch: (name) => text(name).split(' ').filter((w) => !['SITIO','FAZENDA'].includes(w)).join(' '),
  propertyNameFromFeature: (feature) => feature?.properties?.nome_imovel || '',
  Math, String
};
vm.runInNewContext(`${app.slice(matcherStart, matcherEnd)}\nglobalThis.score = propertyNameMatchScore;`, matcherContext);
assert.equal(matcherContext.score({properties:{nome_imovel:'Sítio Bahia'}}, 'Sítio Riu Bahia'), -1, 'Busca online também deve exigir todos os termos relevantes.');
assert.ok(matcherContext.score({properties:{nome_imovel:'Sítio Rio Bahia'}}, 'Sítio Rio Bahia') > 0);

const resolveStart = app.indexOf('  async function fetchRuralPropertiesByName(');
const resolveEnd = app.indexOf('  async function locateRuralPropertyByName(', resolveStart);
assert.ok(resolveStart > 0 && resolveEnd > resolveStart);
let online = 0;
const state = {
  normalizedCatalogState: () => 'BA',
  fetchLocalRuralProperties: async () => [],
  fetchCefirPropertiesByName: async () => { online++; return []; },
  fetchSicarPropertiesByName: async () => { online++; return []; },
  window: { SurveyorPropertyLocalCache: { getManifest: async () => ({status:'installed', generation:42}) } },
  console: {debug() {}}
};
vm.runInNewContext(`${app.slice(resolveStart, resolveEnd)}\nglobalThis.resolve = fetchRuralPropertiesByName;`, state);
assert.equal((await state.resolve('Sítio Riu Bahia', {id:'2901007',name:'Amargosa'}, 'BA')).length, 0);
assert.equal(online, 0, 'Índice instalado sem resultado não pode disparar consulta online lenta automaticamente.');
state.window.SurveyorPropertyLocalCache.getManifest = async () => null;
await state.resolve('Sítio Rio Bahia', {id:'2901007',name:'Amargosa'}, 'BA');
assert.ok(online > 0, 'Município sem índice local deve manter fallback online.');

assert.match(app,/!configuredLayerResult && sourceLayer && !isSicarBoundarySource && !sourceFeatureHasProps/,'Dados oficiais já recebidos devem dispensar consulta WFS duplicada no painel.');
assert.match(app,/sourceFeatureHasProps && isCefirBoundarySource\s*\? Promise\.resolve\(null\)/,'Detalhes CEFIR não devem aguardar nova consulta SICAR por ponto.');
console.log('PASS property-search-precision-speed-rc1858: busca local/online precisa, zero resultados rápidos, painel sem espera WFS redundante.');
