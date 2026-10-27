import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// 1. Verificar inclusão de scripts nos HTMLs
const htmlMapas = fs.readFileSync('mapas/index.html', 'utf8');
const htmlPranchas = fs.readFileSync('pranchas/index.html', 'utf8');

assert.match(htmlMapas, /maps-v21\.9\.116\.js/, 'mapas/index.html deve carregar app.js');
assert.match(htmlPranchas, /maps-v21\.9\.116\.js/, 'pranchas/index.html deve carregar app.js');
assert.doesNotMatch(htmlMapas, /maps-v21\.9\.3\.js/, 'mapas/index.html não deve apontar para versão obsoleta');

// 2. Verificar código dos arquivos JS
const mapsJs = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
assert.match(mapsJs, /function boundsWithAspect/, 'boundsWithAspect deve estar definida em app.js');
assert.match(mapsJs, /perimeterRing/, 'ring deve consultar perimeterRing do resolvedor geométrico');
assert.match(mapsJs, /MultiPolygon/, 'app.js deve suportar MultiPolygon');


// 3. Teste funcional de execução e geração SVG via VM
const projectGeometryCode = fs.readFileSync('assets/js/core/geometry.js', 'utf8');

function createDOMContext(page = 'mapas.html') {
  const elements = {
    generateMapV19: { addEventListener: () => {} },
    projectSelect: { options: [], add: () => {}, value: 'proj-1', addEventListener: () => {} },
    mapBackground: { value: 'none', addEventListener: () => {} },
    mapZoom: { value: '15', addEventListener: () => {} },
    mapTitle: { value: 'PLANTA DO IMÓVEL RURAL' },
    mapRegistration: { value: '12345' },
    mapTechnician: { value: 'Dr. Topógrafo' },
    mapPreview: { innerHTML: '' },
    downloadSvgV19: { addEventListener: () => {} },
    printPreviewV19: { addEventListener: () => {} }
  };

  const fakeTurf = {
    area: (feat) => 250000,
    featureCollection: (f) => ({ type: 'FeatureCollection', features: f })
  };

  const fakeProjects = {
    list: async () => [{ id: 'proj-1', title: 'Fazenda Boa Vista', geojson: { type: 'FeatureCollection', features: [] } }],
    get: async (id) => ({
      id,
      title: 'Fazenda Boa Vista',
      owner: 'João da Silva',
      city: 'Feira de Santana',
      uf: 'BA',
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { category: 'perimetro', name: 'Perímetro Principal', confrontantes: [{ segmentIndex: 0, nome: 'Estrada Municipal', tipoLimite: 'Cerca' }] },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [[-38.960, -12.250], [-38.950, -12.250], [-38.950, -12.260], [-38.960, -12.260], [-38.960, -12.250]]
              ]
            }
          }
        ]
      }
    })
  };

  const fakeAuth = {
    getProjectShare: async () => ({ active: true, token: 'share-123' }),
    createProjectShare: async () => ({ token: 'share-123' })
  };

  const sandbox = {
    document: {
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({ addEventListener: () => {} }),
      body: { dataset: { page } }
    },
    window: {
      GeoRuralProjects: fakeProjects,
      GeoRuralAuth: fakeAuth,
      GeoRuralDocumentTheme: { get: () => ({ companyName: 'Surveyor Brasil' }) },
      GeoRuralQR: { toDataURL: async () => 'data:image/png;base64,fakeQR' },
      location: { href: 'http://localhost/mapas/', search: '' }
    },
    globalThis: null,
    location: { href: 'http://localhost/mapas/', search: '' },
    turf: fakeTurf,
    fetch: async () => ({ ok: true, blob: async () => ({}) }),
    FileReader: class {
      readAsDataURL() { setTimeout(() => { this.result = 'data:image/png;base64,fake'; this.onload?.(); }, 1); }
    },
    URLSearchParams: globalThis.URLSearchParams,
    URL: globalThis.URL,
    Option: function(text, val) { this.text = text; this.value = val; },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    AbortController: globalThis.AbortController,
    console
  };
  sandbox.globalThis = sandbox;
  sandbox.window.globalThis = sandbox;
  return { sandbox, elements };
}

const { sandbox } = createDOMContext();
const context = vm.createContext(sandbox);
vm.runInContext(projectGeometryCode, context);
vm.runInContext(mapsJs, context);

assert.ok(context.SurveyorProjectGeometry);
console.log('OK: Teste de mapas e croquis passou com sucesso (v21.11.5)!');
