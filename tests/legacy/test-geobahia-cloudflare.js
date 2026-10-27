import assert from 'node:assert/strict';
import worker from '../../deploy/cloudflare-geoservices/src/worker.js';

function encode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

async function withMockFetch(mock, action) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await action(); }
  finally { globalThis.fetch = original; }
}

const base = 'https://worker.example';
const rawWorkerFetch = worker.fetch.bind(worker);


// WFS deve permanecer em /geoserver/ows. Este era o defeito da v21.9.356.
{
  const upstream = 'https://geoserver.inema.ba.gov.br/geoserver/ows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=Vetor_Recortes_Tematicos%3Acefir_assentamento_limite_inema&OUTPUTFORMAT=application%2Fjson';
  const seen = [];
  const response = await withMockFetch(async (url) => {
    seen.push(String(url));
    return new Response('{"type":"FeatureCollection","features":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
  }, () => worker.fetch(new Request(`${base}/wfs-url/${encode(upstream)}`)));
  assert.equal(response.status, 200);
  assert.equal(seen.length, 1);
  const called = new URL(seen[0]);
  assert.equal(called.pathname, '/geoserver/ows');
  assert.equal(called.searchParams.get('SERVICE'), 'WFS');
}

// WMS deve usar o endpoint de imagens.
{
  const upstream = 'https://geoserver.inema.ba.gov.br/geoserver/ows?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Vetor_Recortes_Tematicos%3Acefir_assentamento_limite_inema&BBOX=-40,-14,-39,-13&WIDTH=256&HEIGHT=256&FORMAT=image%2Fpng';
  const seen = [];
  const response = await withMockFetch(async (url) => {
    seen.push(String(url));
    return new Response(new Uint8Array([137,80,78,71]), { status: 200, headers: { 'content-type': 'image/png' } });
  }, () => worker.fetch(new Request(`${base}/wms-url/${encode(upstream)}`)));
  assert.equal(response.status, 200);
  assert.equal(new URL(seen[0]).pathname, '/geoserver/wms');
  assert.match(response.headers.get('content-type') || '', /^image\/png/);
}

// INEMA oficial legado: o Worker pode tentar HTTP apenas server-to-server após falha HTTPS.
{
  const upstream = 'https://geoserver.inema.ba.gov.br/geoserver/ows?SERVICE=WMS&REQUEST=GetMap&LAYERS=Vetor_Recortes_Tematicos%3Acefir_assentamento_app_inema&FORMAT=image%2Fpng';
  const seen = [];
  const response = await withMockFetch(async (url) => {
    seen.push(String(url));
    return new Response('gateway temporário', { status: 502, headers: { 'content-type': 'text/plain' } });
  }, () => worker.fetch(new Request(`${base}/wms-url/${encode(upstream)}`)));
  assert.equal(response.status, 502);
  assert.equal(seen.length, 2);
  assert.equal(new URL(seen[0]).protocol, 'https:');
  assert.equal(new URL(seen[1]).protocol, 'http:');
}

// O fallback HTTP existe apenas por opt-in explícito para diagnóstico temporário.
{
  const upstream = 'https://geoserver.inema.ba.gov.br/geoserver/ows?SERVICE=WMS&REQUEST=GetMap&LAYERS=Vetor_Recortes_Tematicos%3Acefir_assentamento_app_inema&FORMAT=image%2Fpng';
  const seen = [];
  const response = await withMockFetch(async (url) => {
    seen.push(String(url));
    if (seen.length === 1) return new Response('gateway temporário', { status: 502, headers: { 'content-type': 'text/plain' } });
    return new Response(new Uint8Array([137,80,78,71]), { status: 200, headers: { 'content-type': 'image/png' } });
  }, () => worker.fetch(new Request(`${base}/wms-url/${encode(upstream)}`), { GEOSERVICES_ALLOW_INSECURE_HTTP: 'true' }));
  assert.equal(response.status, 200);
  assert.equal(seen.length, 2);
  assert.equal(new URL(seen[0]).protocol, 'https:');
  assert.equal(new URL(seen[1]).protocol, 'http:');
  assert.equal(response.headers.get('x-georural-upstream-protocol'), 'http');
}

// ServiceException XML não pode ser devolvida como se fosse GeoJSON WFS válido.
{
  const upstream = 'https://geoserver.inema.ba.gov.br/geoserver/ows?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=Vetor_Recortes_Tematicos%3Acefir_pct_limite_inema&OUTPUTFORMAT=application%2Fjson';
  const seen = [];
  const response = await withMockFetch(async (url) => {
    seen.push(String(url));
    if (seen.length === 1) return new Response('<ServiceExceptionReport>temporário</ServiceExceptionReport>', { status: 200, headers: { 'content-type': 'application/xml' } });
    return new Response('{"type":"FeatureCollection","features":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
  }, () => worker.fetch(new Request(`${base}/wfs-url/${encode(upstream)}`), { GEOSERVICES_ALLOW_INSECURE_HTTP: 'true' }));
  assert.equal(response.status, 200);
  assert.equal(seen.length, 2);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
}


// O resolvedor deve localizar o nome real pelo título mesmo quando o nome gravado estiver desatualizado.
{
  const capabilities = `<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs"><FeatureTypeList><FeatureType><Name>Vetor_Recortes_Tematicos:terras_indigenas_funai</Name><Title>Terra Indígena FUNAI</Title><ows:WGS84BoundingBox xmlns:ows="http://www.opengis.net/ows"><ows:LowerCorner>-46 -18</ows:LowerCorner><ows:UpperCorner>-37 -8</ows:UpperCorner></ows:WGS84BoundingBox></FeatureType></FeatureTypeList></wfs:WFS_Capabilities>`;
  const response = await withMockFetch(async () => new Response(capabilities, { status: 200, headers: { 'content-type': 'application/xml' } }), () => worker.fetch(new Request(`${base}/resolve?target=${encodeURIComponent('https://geoserver.inema.ba.gov.br/geoserver/ows')}&layer=${encodeURIComponent('Vetor_Recortes_Tematicos:terra_indigena_funai_2024')}&title=${encodeURIComponent('Terra Indígena FUNAI - 2024')}`)));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.service, 'wfs');
  assert.equal(payload.layerName, 'Vetor_Recortes_Tematicos:terras_indigenas_funai');
  assert.deepEqual(payload.bbox, [-46, -18, -37, -8]);
}

// Camada ausente no WFS, mas presente no WMS, deve ser classificada como raster/WMS.
{
  const wfsCapabilities = `<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs"><FeatureTypeList><FeatureType><Name>Vetor_Bases_Gerais:limite_estadual</Name><Title>Limite Estadual</Title></FeatureType></FeatureTypeList></wfs:WFS_Capabilities>`;
  const wmsCapabilities = `<?xml version="1.0"?><WMT_MS_Capabilities><Capability><Layer><Title>GeoBahia</Title><Layer><Name>Raster_ORTOFOTO:ortofoto_salvador_2016_2017</Name><Title>Ortofoto Salvador 2016/2017</Title><LatLonBoundingBox minx="-39" miny="-13.2" maxx="-38.2" maxy="-12.6"/></Layer></Layer></Capability></WMT_MS_Capabilities>`;
  const response = await withMockFetch(async (url) => {
    const service = new URL(String(url)).searchParams.get('SERVICE');
    return new Response(service === 'WFS' ? wfsCapabilities : wmsCapabilities, { status: 200, headers: { 'content-type': 'application/xml' } });
  }, () => worker.fetch(new Request(`${base}/resolve?target=${encodeURIComponent('https://geoserver.inema.ba.gov.br/geoserver/raster/ows')}&layer=${encodeURIComponent('Raster_ORTOFOTO:ortofoto_salvador_2016_2017')}&title=${encodeURIComponent('Ortofoto Salvador 2016/2017')}`)));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.service, 'wms-only');
  assert.equal(payload.layerName, 'Raster_ORTOFOTO:ortofoto_salvador_2016_2017');
}


// R21.1: o proxy não exige token, mas continua aceitando apenas hosts oficiais permitidos.
{
  const upstream = 'https://geoserver.inema.ba.gov.br/geoserver/ows?SERVICE=WFS&REQUEST=GetCapabilities';
  const response = await withMockFetch(async () => new Response('<ok/>', { status: 200, headers: { 'content-type': 'application/xml' } }),
    () => rawWorkerFetch(new Request(`${base}/wfs-url/${encode(upstream)}`)));
  assert.equal(response.status, 200);
}
{
  const blocked = 'https://example.com/geoserver/ows?SERVICE=WFS&REQUEST=GetCapabilities';
  const response = await rawWorkerFetch(new Request(`${base}/wfs-url/${encode(blocked)}`));
  assert.ok([400, 403].includes(response.status));
}

console.log('GeoBahia/Cloudflare: proxy sem token secret, allowlist de hosts, HTTPS-first, fallback HTTP oficial restrito e resolução WFS/WMS aprovados.');
