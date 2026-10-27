const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const app = read('assets/js/features/mapa/app.js');
const appDist = read('dist/surveyor-frontend/assets/js/features/mapa/app.js');
const mapHtml = read('mapa/index.html');
const mapHtmlDist = read('dist/surveyor-frontend/mapa/index.html');
const maps = read('assets/js/features/mapas/app.js');
const mapsDist = read('dist/surveyor-frontend/assets/js/features/mapas/app.js');
const css = read('assets/css/features/mapa/app.css');
const cssDist = read('dist/surveyor-frontend/assets/css/features/mapa/app.css');

assert(mapHtml.includes('id="ruralInfoDownloadProperty"'), 'botão Baixar propriedade ausente');
assert(mapHtml.includes('Informações + polígono'), 'descrição do botão de download ausente');
assert(css.includes('.rural-info-download-btn'), 'estilo do botão de download ausente');

[
  "folder('01_Informacoes')",
  "folder('02_Poligono')",
  "folder('GeoJSON')",
  "folder('KML')",
  "folder('CSV')",
  "folder('DXF')",
  "folder('WKT')",
  "folder('Shapefile')",
  'informacoes-do-imovel.txt',
  'metadados.json',
  'SurveyorShapefileExport.exportWithProfile',
  "stateCode || '').toUpperCase() === 'BA' ? 'seia-cefir-ba' : 'sicar-car'"
].forEach((needle) => assert(app.includes(needle), `pacote de propriedade incompleto: ${needle}`));

assert(app.includes('function propertyNameAccentTolerantCql'), 'fallback de acentuação ausente');
assert(app.includes('fetchCefirPropertiesByMunicipalityArea'), 'fallback espacial municipal CEFIR ausente');
assert(app.includes("if (uf === 'BA')"), 'prioridade Bahia ausente');
assert(app.includes('if (cefirFeatures.length) return cefirFeatures;'), 'CEFIR não está priorizado na Bahia');
assert(app.includes('const isCefirBoundarySource = Boolean(isPropertyBoundarySource && /cefir|inema|geobahia/.test(sourceBoundarySignature));'), 'a fonte real CEFIR/INEMA não está sendo detectada no painel');
assert(app.includes("sourceName: 'CEFIR / INEMA — GeoBahia'"), 'resultado de busca BA não referencia CEFIR/INEMA');
assert(app.includes('const features = await fetchRuralPropertiesByName(query, municipality, stateCode);'), 'busca contextual ainda duplica resolvedores de fonte');
assert(app.includes('visibleBoundaryLeaflet?.__georuralOriginalServiceUrl'), 'painel não preserva a fonte WMS realmente desenhada');

const start = maps.indexOf('function smartConfrontanteLabels');
const end = maps.indexOf('function confrontanteLabel', start);
assert(start >= 0 && end > start, 'função de confrontantes não localizada');
const smartLabels = maps.slice(start, end);
assert(!smartLabels.includes('sv-confrontante-callout'), 'linha de chamada ainda é renderizada');
assert(!smartLabels.includes('<circle'), 'ponto de chamada ainda é renderizado');
assert(!smartLabels.includes('<rect'), 'caixa branca ainda é renderizada');
assert(!smartLabels.includes('stroke="#ffffff"'), 'halo branco ainda é renderizado');
assert(smartLabels.includes('R26.3.59 — confrontante limpo'), 'marcador da revisão de confrontantes ausente');

assert.strictEqual(app, appDist, 'app.js fonte/dist divergentes');
assert.strictEqual(mapHtml, mapHtmlDist, 'mapa/index fonte/dist divergentes');
assert.strictEqual(maps, mapsDist, 'maps.js fonte/dist divergentes');
assert.strictEqual(css, cssDist, 'CSS fonte/dist divergentes');

console.log('OK R26.3.59: download da propriedade, busca CEFIR e confrontantes limpos.');
