import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const mapDocs = read('assets/js/features/mapas/app.js');
const mapRuntime = read('assets/js/features/mapa/app.js');
const suite = read('assets/js/core/suite.js');
const memorial = read('assets/js/features/memorial/app.js');
const planialt = read('assets/js/features/planialtimetria/app.js');
const projectsSource = read('assets/js/core/projects.js');

// Regression: V50 shared confrontante editor must never abort Mapas/Pranchas boot.
const toastIndex = mapDocs.indexOf('function toast(message, type = \'\')');
const editorIndex = mapDocs.indexOf('technicalDocumentEditor = ensureTechnicalDocumentEditorInstance()');
assert.ok(toastIndex >= 0, 'Mapas/Pranchas precisa declarar toast local para o editor compartilhado.');
assert.ok(editorIndex > toastIndex, 'toast deve existir antes da criação do editor de confrontantes.');
assert.ok(mapDocs.includes("$('generateMapV19').addEventListener('click', generateSelected);"), 'Gerar croqui/prancha deve continuar ligado ao runtime real.');

// Document modules must ask for a current project instead of a stale session cache.
assert.ok(suite.includes('window.GeoRuralProjects.get(id,true)'), 'Suite documental deve buscar a versão atual do projeto selecionado.');
assert.ok(suite.includes('list({full:false,refresh:true})'), 'Suite documental deve atualizar a lista de projetos ao abrir.');
assert.ok(suite.includes('async function selectedProjectReady()'), 'Geradores legados devem aguardar o projeto completo na primeira tentativa.');
assert.ok(memorial.includes("window.GeoRuralProjects.get(id,false)") && memorial.includes("window.GeoRuralProjects.get(id,true)"), 'Memorial deve usar cache fresco primeiro e atualizar remotamente somente quando o projeto completo não estiver disponível.');
assert.ok(planialt.includes('window.GeoRuralProjects.get(id, true)'), 'Planialtimetria deve carregar a versão mais recente do projeto.');

// Map save must invalidate the document-side cache after cloud confirmation.
assert.ok(mapRuntime.includes('function invalidateDocumentProjectCache()'), 'Mapa deve possuir invalidação explícita do cache documental.');
assert.ok(mapRuntime.includes('invalidateDocumentProjectCache();'), 'Salvamento confirmado deve invalidar cache documental.');

// Confrontantes edited in the map live in feature properties and must be part of cloud payload.
assert.ok(mapRuntime.includes('p.confrontantes = coords.map'), 'Mapa deve persistir confrontantes nos metadados da geometria.');
assert.ok(mapRuntime.includes('properties: sanitizeForJson(props) || {}'), 'Payload da feição deve levar propriedades/confrontantes para a nuvem.');
assert.ok(mapDocs.includes('feature?.properties?.confrontantes') || read('assets/js/features/mapas/confrontantes.js').includes('feature?.properties?.confrontantes'), 'Gerador cartográfico deve consumir confrontantes da feição salva.');

// Exercise GeoRuralProjects refresh forwarding and confrontante preservation through toLegacy.
const storage = new Map();
const sessionStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  key: (index) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; }
};
let listOptions = null;
let getOptions = null;
const remoteProject = {
  id: 'p-1', propertyName: 'Sítio Teste', ownerName: 'Proprietário', municipality: 'Amargosa', stateCode: 'BA', metadata: {}
};
const remoteFeature = {
  id: 'f-1', name: 'Perímetro', category: 'perimetro',
  geoJson: { type: 'Polygon', coordinates: [[[-39.6,-13.0],[-39.5,-13.0],[-39.5,-13.1],[-39.6,-13.0]]] },
  properties: {
    confrontantes: [{ segmentIndex: 0, from: 'V-01', to: 'V-02', nome: 'JOSEFA', tipoLimite: 'Cerca' }]
  }
};
const window = {
  GeoRuralAuth: {
    listProjects: async (options = {}) => { listOptions = options; return [remoteProject]; },
    getProject: async (_id, options = {}) => { getOptions = options; return { project: remoteProject, features: [remoteFeature] }; }
  },
  dispatchEvent() {}
};
const context = vm.createContext({
  window, sessionStorage, navigator: { onLine: true }, console,
  indexedDB: undefined,
  CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  setTimeout, clearTimeout, Date, JSON, Map, Set, WeakSet, Promise, Number, String, Array, Object, Math
});
vm.runInContext(projectsSource, context, { filename: 'projects.js' });
await window.GeoRuralProjects.list({ refresh: true });
assert.equal(listOptions?.forceRefresh, true, 'refresh=true deve atravessar até a API de listagem.');
assert.equal(listOptions?.noCache, true, 'refresh=true deve ignorar cache HTTP da listagem.');
const legacy = await window.GeoRuralProjects.get('p-1', true);
assert.equal(getOptions?.forceRefresh, true, 'get(id,true) deve atravessar até a API do projeto.');
assert.equal(getOptions?.noCache, true, 'get(id,true) deve ignorar cache HTTP do projeto.');
assert.equal(legacy.geojson.features[0].properties.confrontantes[0].nome, 'JOSEFA', 'Confrontantes salvos no mapa precisam chegar intactos ao documento.');

console.log('PASS V50: geração documental inicializa, usa projeto fresco e preserva confrontantes do mapa.');
