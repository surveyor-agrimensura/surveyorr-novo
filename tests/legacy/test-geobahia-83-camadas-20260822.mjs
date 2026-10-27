import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../deploy/cloudflare-geoservices/src/worker.js';

const admin = fs.readFileSync('assets/js/admin/app.js', 'utf8');
const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const map = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');

function arrayBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `Marcador ausente: ${marker}`);
  const begin = source.indexOf('[', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = begin; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '[') depth += 1;
    if (char === ']' && --depth === 0) return source.slice(begin, i + 1);
  }
  throw new Error(`Array não fechado: ${marker}`);
}
function technicalNames(source, marker) {
  return [...arrayBlock(source, marker).matchAll(/"layer"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
}
const adminNames = technicalNames(admin, 'const geobahiaAutomaticCatalog');
const apiNames = technicalNames(api, 'const GEOBAHIA_OFFICIAL_CATALOG');
assert.equal(adminNames.length, 82, 'Admin deve conter as 82 camadas GeoBahia após migração do limite de propriedade para o SICAR');
assert.equal(new Set(adminNames).size, 82, 'As 82 camadas GeoBahia do Admin devem ser únicas');
assert.deepEqual(apiNames, adminNames, 'Catálogo Admin e API devem permanecer idênticos');

const officialMapBlock = map.slice(map.indexOf('const OFFICIAL_GEOBAHIA_WMS_LAYERS = {'), map.indexOf('\n};', map.indexOf('const OFFICIAL_GEOBAHIA_WMS_LAYERS = {')));
const officialTargets = [...officialMapBlock.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map((m) => m[2]);
assert.ok(new Set(officialTargets).size >= 82, 'Mapa deve manter os alvos GeoBahia ativos e aliases compatíveis');
assert.match(officialMapBlock, /"uc_estadual":\s*"Vetor_Recursos_Ambientais:uc_inema_2025"/);
assert.match(officialMapBlock, /"solos":\s*"Vetor_Recursos_Ambientais:solos"/);

assert.match(map, /WMS-first para o catálogo GeoBahia\/INEMA/);
assert.match(map, /GEOBAHIA_WFS_MIN_ZOOM = 15/);
assert.match(map, /GEOBAHIA_WFS_MAX_FEATURES = 50/);
assert.doesNotMatch(map, /return geobahiaLayerShouldPreferWfs\(layer\) \|\| isUsingHuggingFaceGeoServices\(\);/);
assert.match(map, /params\.append\('alias', clean\)/);
assert.match(map, /previousFailure\?\.phase === 'error'.*retryAt/s);
assert.match(map, /Nova tentativa automática em/);
assert.match(admin, /Vetor_Recursos_Ambientais/);
assert.match(api, /Vetor_Recursos_Ambientais/);

async function withMockFetch(mock, action) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await action(); } finally { globalThis.fetch = original; }
}
const base = 'https://worker.example';


// Alias confirmado: nome gravado antigo deve resolver para o nome oficial presente no servidor.
{
  const capabilities = `<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs"><FeatureTypeList><FeatureType><Name>Vetor_Recursos_Ambientais:uc_inema_2025</Name><Title>Unidades de Conservação Estaduais</Title></FeatureType></FeatureTypeList></wfs:WFS_Capabilities>`;
  const target = encodeURIComponent('https://geoserver.inema.ba.gov.br/geoserver/audit83-uc');
  const url = `${base}/resolve?target=${target}&layer=${encodeURIComponent('Vetor_Recortes_Tematicos:uc_estadual')}&alias=${encodeURIComponent('Vetor_Recursos_Ambientais:uc_inema_2025')}`;
  const response = await withMockFetch(async () => new Response(capabilities, { status: 200, headers: {'content-type':'application/xml'} }), () => worker.fetch(new Request(url)));
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.layerName, 'Vetor_Recursos_Ambientais:uc_inema_2025');
  assert.equal(payload.score, 1);
}

// Se WFS 1.1.0 estiver quebrado no órgão, o resolvedor tenta 1.0.0 antes de desistir.
{
  const seen = [];
  const good = `<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs"><FeatureTypeList><FeatureType><Name>Vetor_Bases_Gerais:limite_estadual</Name><Title>Limite Estadual</Title></FeatureType></FeatureTypeList></wfs:WFS_Capabilities>`;
  const target = encodeURIComponent('https://geoserver.inema.ba.gov.br/geoserver/audit83-version');
  const response = await withMockFetch(async (u) => {
    const parsed = new URL(String(u)); seen.push(parsed.searchParams.get('VERSION'));
    if (parsed.searchParams.get('VERSION') === '1.1.0') return new Response('indisponível', {status:502, headers:{'content-type':'text/plain'}});
    return new Response(good, {status:200, headers:{'content-type':'application/xml'}});
  }, () => worker.fetch(new Request(`${base}/resolve?target=${target}&layer=${encodeURIComponent('Vetor_Bases_Gerais:limite_estadual')}`)));
  const payload = await response.json();
  assert.equal(payload.layerName, 'Vetor_Bases_Gerais:limite_estadual');
  assert.deepEqual(seen.slice(0,2), ['1.1.0','1.0.0']);
}

// WMS 1.3: EX_GeographicBoundingBox deve ser entendido quando a camada só existe no WMS.
{
  const wfs = `<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs"><FeatureTypeList><FeatureType><Name>foo:outra</Name><Title>Outra</Title></FeatureType></FeatureTypeList></wfs:WFS_Capabilities>`;
  const wms13 = `<?xml version="1.0"?><WMS_Capabilities><Capability><Layer><Title>Raiz</Title><Layer><Name>Raster_ORTOFOTO:ortofoto_salvador_2016_2017</Name><Title>Ortofoto Salvador 2016 2017</Title><EX_GeographicBoundingBox><westBoundLongitude>-39.2</westBoundLongitude><eastBoundLongitude>-38.1</eastBoundLongitude><southBoundLatitude>-13.3</southBoundLatitude><northBoundLatitude>-12.5</northBoundLatitude></EX_GeographicBoundingBox></Layer></Layer></Capability></WMS_Capabilities>`;
  const target = encodeURIComponent('https://geoserver.inema.ba.gov.br/geoserver/audit83-wms13');
  const response = await withMockFetch(async (u) => {
    const parsed = new URL(String(u));
    const service = parsed.searchParams.get('SERVICE'); const version = parsed.searchParams.get('VERSION');
    if (service === 'WFS') return new Response(wfs, {status:200, headers:{'content-type':'application/xml'}});
    if (version === '1.1.1') return new Response('temporário', {status:502, headers:{'content-type':'text/plain'}});
    return new Response(wms13, {status:200, headers:{'content-type':'application/xml'}});
  }, () => worker.fetch(new Request(`${base}/resolve?target=${target}&layer=${encodeURIComponent('Raster_ORTOFOTO:ortofoto_salvador_2016_2017')}`)));
  const payload = await response.json();
  assert.equal(payload.service, 'wms-only');
  assert.equal(payload.layerName, 'Raster_ORTOFOTO:ortofoto_salvador_2016_2017');
  assert.deepEqual(payload.bbox, [-39.2,-13.3,-38.1,-12.5]);
}



// Matriz completa: as 82 entradas GeoBahia restantes precisam ser resolvíveis pelo
// fluxo GetCapabilities (WFS para vetores e WMS para o raster), inclusive
// quando o workspace/nome cadastrado é legado.
{
  const officialPairs = [...officialMapBlock.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)]
    .map((m) => [m[1], m[2]])
    .filter(([key]) => key !== 'cefir_imovel_rural_propriedade_inema');
  const canonicalByShort = new Map(officialPairs);
  const vectorTargets = [...new Set(officialPairs.map(([, value]) => value).filter((value) => !/^Raster_/i.test(value)))];
  const rasterTargets = [...new Set(officialPairs.map(([, value]) => value).filter((value) => /^Raster_/i.test(value)))];
  const wfsCapabilities = `<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs"><FeatureTypeList>${vectorTargets.map((name) => `<FeatureType><Name>${name}</Name><Title>${name.split(':').pop().replaceAll('_',' ')}</Title></FeatureType>`).join('')}</FeatureTypeList></wfs:WFS_Capabilities>`;
  const wmsCapabilities = `<?xml version="1.0"?><WMT_MS_Capabilities><Capability><Layer><Title>GeoBahia</Title>${rasterTargets.map((name) => `<Layer><Name>${name}</Name><Title>${name.split(':').pop().replaceAll('_',' ')}</Title><LatLonBoundingBox minx="-47" miny="-19" maxx="-37" maxy="-8"/></Layer>`).join('')}</Layer></Capability></WMT_MS_Capabilities>`;
  const targetValue = 'https://geoserver.inema.ba.gov.br/geoserver/audit83-all';
  const workspaces = ['Vetor_Recortes_Tematicos','Vetor_Bases_Gerais','Vetor_Recursos_Hidricos','Vetor_Recursos_Naturais','Vetor_Recursos_Ambientais','Vetor_Biodiversidade','Raster','Raster_ORTOFOTO'];
  const results = await withMockFetch(async (u) => {
    const parsed = new URL(String(u));
    return new Response(parsed.searchParams.get('SERVICE') === 'WFS' ? wfsCapabilities : wmsCapabilities, {status:200, headers:{'content-type':'application/xml'}});
  }, async () => {
    const out = [];
    for (const configured of adminNames) {
      const short = configured.split(':').pop();
      const canonical = canonicalByShort.get(short) || configured;
      const q = new URLSearchParams({target:targetValue, layer:canonical, title:short.replaceAll('_',' ')});
      for (const ws of workspaces) q.append('alias', `${ws}:${short}`);
      if (short === 'uc_inema_2025' || short === 'uc_estadual') q.append('alias','Vetor_Recursos_Ambientais:uc_inema_2025');
      const response = await worker.fetch(new Request(`${base}/resolve?${q.toString()}`));
      out.push(await response.json());
    }
    return out;
  });
  assert.equal(results.length, 82);
  const unresolved = results.filter((item) => !item?.resolved);
  assert.deepEqual(unresolved, [], `Todas as 82 camadas GeoBahia devem resolver; falharam ${unresolved.length}`);
}

console.log('Auditoria GeoBahia: 82/82 camadas BA preservadas; Limites de Propriedade migrados ao CAR/SICAR nacional.');
