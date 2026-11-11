// Proxy geográfico da API. Dependências fornecidas pelo orquestrador para preservar
// rotas, autenticação, CORS e configurações existentes.
export function createGeoserviceProxy({ env, statusError, queryValue, parsePath, queryStringSources, corsOrigin, appVersion }) {
  const APP_VERSION = appVersion;

function remoteLayerDetection(input = {}) {
  const serviceUrl = String(input.serviceUrl || input.sourceUrl || '').trim();
  const lower = serviceUrl.toLowerCase();
  let serviceType = String(input.serviceType || input.type || '').toLowerCase();
  if (!serviceType) {
    if (lower.includes('service=wms') || lower.includes('/wms')) serviceType = 'wms';
    else if (lower.includes('/featureserver') || lower.includes('/mapserver')) serviceType = 'arcgis';
    else serviceType = 'geojson';
  }
  return { serviceType, serviceUrl, ok: Boolean(serviceUrl), message: serviceUrl ? 'URL reconhecida para cadastro no Appwrite.' : 'Informe uma URL para testar.' };
}

function isInemaProxyTarget(url) {
  try {
    const parsed = new URL(String(url || ''));
    return parsed.hostname === 'geoserver.inema.ba.gov.br'
      || parsed.hostname === 'inema.ba.gov.br'
      || parsed.hostname.endsWith('.inema.ba.gov.br');
  } catch {
    return /(?:^|\.)inema\.ba\.gov\.br(?:[/:?#]|$)/i.test(String(url || ''));
  }
}

const DEFAULT_WMS_PROXY_ALLOWED_HOSTS = new Set([
  'geoserver.inema.ba.gov.br',
  'geoserver.car.gov.br',
  'geoservicos.ibge.gov.br',
  'geoservicos.inde.gov.br',
  'www.geoservicos.inde.gov.br',
  'geoinfo.dados.embrapa.br',
  'geo.infrasa.gov.br',
  'sig.valec.gov.br',
  'acervofundiario.incra.gov.br'
]);

const WMS_PROXY_TIMEOUT_MS = 45_000;
const WMS_PROXY_MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const WMS_PROXY_MAX_REDIRECTS = 4;

function allowedWmsProxyHosts() {
  const configured = String(env('WMS_PROXY_ALLOWED_HOSTS', ''))
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_WMS_PROXY_ALLOWED_HOSTS, ...configured]);
}

function isInemaHostname(hostname) {
  const value = String(hostname || '').trim().toLowerCase();
  return value === 'inema.ba.gov.br' || value.endsWith('.inema.ba.gov.br');
}

function assertAllowedProxyUrl(url) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw statusError(400, 'O upstream WMS deve usar HTTP ou HTTPS.');
  }
  const hostname = String(url.hostname || '').toLowerCase();
  if (!allowedWmsProxyHosts().has(hostname)) {
    throw statusError(403, `Domínio WMS não autorizado no proxy: ${hostname}`);
  }
}

function geoserviceProxyTarget(request) {
  return queryValue(request, 'target')
    || queryValue(request, 'targetUrl')
    || queryValue(request, 'url')
    || queryValue(request, 'serviceUrl')
    || queryValue(request, 'baseUrl');
}


function decodeBase64UrlText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function geoserviceEncodedUpstreamFromPath(request) {
  const path = parsePath(request);
  const match = path.match(/^\/(?:api\/(?:geoservices\/)?)?(?:wms|wfs|wms-info|info)-url\/([^/?#]+)$/i);
  if (!match) return null;
  let decoded = '';
  try {
    decoded = decodeBase64UrlText(decodeURIComponent(match[1]));
  } catch {
    throw statusError(400, 'Payload do proxy geográfico inválido.');
  }
  if (!/^https?:\/\//i.test(decoded)) {
    throw statusError(400, 'Payload do proxy geográfico sem URL HTTP(S).');
  }
  const targetUrl = new URL(decoded);
  targetUrl.username = '';
  targetUrl.password = '';
  targetUrl.hash = '';
  assertAllowedProxyUrl(targetUrl);
  return targetUrl;
}

function geoserviceDefaultTargetForRequest(request) {
  const path = parsePath(request);
  const hasLayer = Boolean(
    queryValue(request, 'LAYERS')
    || queryValue(request, 'layers')
    || queryValue(request, 'TYPENAME')
    || queryValue(request, 'typeName')
    || queryValue(request, 'typenames')
  );
  const service = String(queryValue(request, 'SERVICE') || queryValue(request, 'service') || '').toUpperCase();
  const operation = String(queryValue(request, 'REQUEST') || queryValue(request, 'request') || '').toUpperCase();
  const looksLikeGeoRequest = hasLayer
    || ['GETMAP', 'GETFEATURE', 'GETFEATUREINFO', 'GETCAPABILITIES', 'GETLEGENDGRAPHIC'].includes(operation)
    || ['WMS', 'WFS'].includes(service);

  if ((path.startsWith('/api/geoservices/') || /^\/(?:api\/(?:geoservices\/)?)?(?:wms|wfs|wms-info|info)(?:$|-url\/|\/)/i.test(path)) && looksLikeGeoRequest) {
    // Contingência segura: se algum runtime/proxy perder o parâmetro target,
    // o catálogo oficial GeoBahia/INEMA ainda consegue funcionar sem abrir
    // proxy genérico para outros domínios. O domínio continua preso à allowlist.
    return 'https://geoserver.inema.ba.gov.br/geoserver/ows';
  }
  return '';
}

function normalizeProxyBaseTarget(rawTarget) {
  if (!rawTarget || !/^https?:\/\//i.test(String(rawTarget))) {
    throw statusError(400, 'Informe target/url/serviceUrl HTTP(S) para o proxy geográfico.');
  }
  const targetUrl = new URL(String(rawTarget));
  assertAllowedProxyUrl(targetUrl);

  targetUrl.username = '';
  targetUrl.password = '';
  targetUrl.hash = '';

  if (isInemaHostname(targetUrl.hostname)) {
    // /geoserver/ows atende WMS e WFS no GeoServer. Não forçamos /wms aqui,
    // porque o fallback WFS por URL também passa por esta normalização.
    if (/^\/(?:wms|ows|geoserver\/wms|geoserver\/ows)\/?$/i.test(targetUrl.pathname)) {
      targetUrl.pathname = '/geoserver/ows';
    }
  }

  const dynamicParams = new Set([
    'bbox', 'width', 'height', 'request', 'service', 'layers', 'layer',
    'styles', 'format', 'transparent', 'srs', 'crs', 'version', 'tiled',
    'exceptions', 'dpi', 'map_resolution', 'format_options', 'bgcolor',
    'query_layers', 'info_format', 'feature_count', 'x', 'y', 'i', 'j'
  ]);
  for (const key of [...targetUrl.searchParams.keys()]) {
    if (dynamicParams.has(String(key).toLowerCase())) targetUrl.searchParams.delete(key);
  }
  return targetUrl;
}

function requestQueryEntries(request) {
  const entries = [];
  const seen = new Set();
  const addEntry = (key, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => addEntry(key, item));
      return;
    }
    const k = String(key || '');
    const v = String(value);
    const fingerprint = `${k.toLowerCase()}=${v}`;
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    entries.push([k, v]);
  };

  for (const query of [request?.query, request?.params]) {
    if (!query) continue;
    if (query instanceof URLSearchParams) {
      for (const [key, value] of query.entries()) addEntry(key, value);
    } else if (typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) addEntry(key, value);
    }
  }

  for (const raw of queryStringSources(request)) {
    try {
      const params = new URLSearchParams(raw);
      for (const [key, value] of params.entries()) addEntry(key, value);
    } catch {}
  }

  for (const source of [request?.url, request?.path, request?.originalUrl, request?.href]) {
    try {
      const url = new URL(String(source || '/'), 'https://surveyor.local');
      for (const [key, value] of url.searchParams.entries()) addEntry(key, value);
    } catch {}
  }

  return entries;
}

function buildGeoserviceUpstreamUrl(request, rawTarget) {
  const targetUrl = normalizeProxyBaseTarget(rawTarget);
  const reserved = new Set([
    'target', 'targeturl', 'url', 'serviceurl', 'baseurl',
    'accesstoken', 'token', 'apibaseurl', 'api'
  ]);

  for (const [key, value] of requestQueryEntries(request)) {
    const normalizedKey = String(key || '').toLowerCase();
    if (reserved.has(normalizedKey)) continue;
    if (!/^[a-z0-9_.:-]{1,80}$/i.test(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    targetUrl.searchParams.set(key.toUpperCase(), String(value));
  }

  const operation = String(targetUrl.searchParams.get('REQUEST') || '').toUpperCase();
  if (!targetUrl.searchParams.has('SERVICE')) {
    targetUrl.searchParams.set('SERVICE', operation === 'GETFEATURE' ? 'WFS' : 'WMS');
  }
  if (!targetUrl.searchParams.has('VERSION')) {
    targetUrl.searchParams.set('VERSION', operation === 'GETFEATURE' ? '1.0.0' : '1.1.1');
  }
  if (String(targetUrl.searchParams.get('SERVICE') || '').toUpperCase() === 'WMS' && !targetUrl.searchParams.has('STYLES')) {
    targetUrl.searchParams.set('STYLES', '');
  }
  assertAllowedProxyUrl(targetUrl);
  return targetUrl;
}

function geoserviceUpstreamCandidates(targetUrl) {
  const candidates = [];
  const add = (value) => {
    const text = value instanceof URL ? value.toString() : String(value || '');
    if (text && !candidates.some((url) => url.toString() === text)) candidates.push(new URL(text));
  };

  if (isInemaHostname(targetUrl.hostname)) {
    const query = targetUrl.search || '';
    // Commercial readiness: o proxy legado da API não faz downgrade para HTTP
    // nem ignora certificado TLS. Fontes com TLS problemático devem passar pelo
    // GeoServices dedicado/Cloudflare, que possui política explícita e isolada.
    add(`https://geoserver.inema.ba.gov.br/geoserver/ows${query}`);
    add(`https://geoserver.inema.ba.gov.br/geoserver/wms${query}`);
    return candidates;
  }

  add(targetUrl);

  if (targetUrl.protocol === 'http:') {
    const httpsFallback = new URL(targetUrl.toString());
    httpsFallback.protocol = 'https:';
    candidates.unshift(httpsFallback);
  }

  return candidates;
}

async function requestBinaryViaNode(url, { redirectsLeft = WMS_PROXY_MAX_REDIRECTS, expectImage = false } = {}) {
  assertAllowedProxyUrl(url);
  const transport = url.protocol === 'https:' ? await import('node:https') : await import('node:http');

  return new Promise((resolve, reject) => {
    const req = transport.request(url, {
      method: 'GET',
      headers: {
        Accept: 'image/png,image/jpeg,image/*,application/json,text/plain,application/xml,*/*;q=0.2',
        'Accept-Encoding': 'identity',
        'User-Agent': `Surveyor-Appwrite-WMS-Proxy/${APP_VERSION}`,
        Connection: 'close'
      },
      ...(isInemaHostname(url.hostname) ? { family: 4 } : {}),
      ...(url.protocol === 'https:' ? {
        rejectUnauthorized: true,
        servername: url.hostname
      } : {})
    }, (upstream) => {
      const statusCode = Number(upstream.statusCode || 0);
      const location = upstream.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        upstream.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('O WMS excedeu o limite de redirecionamentos.'));
          return;
        }
        let redirectUrl;
        try {
          redirectUrl = new URL(location, url);
          assertAllowedProxyUrl(redirectUrl);
        } catch (error) {
          reject(error);
          return;
        }
        requestBinaryViaNode(redirectUrl, { redirectsLeft: redirectsLeft - 1, expectImage }).then(resolve, reject);
        return;
      }

      const chunks = [];
      let totalBytes = 0;
      upstream.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > WMS_PROXY_MAX_RESPONSE_BYTES) {
          upstream.destroy(new Error('A resposta WMS excedeu o limite de 20 MB.'));
          return;
        }
        chunks.push(chunk);
      });
      upstream.once('error', reject);
      upstream.once('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = String(upstream.headers['content-type'] || 'application/octet-stream');
        const normalizedType = contentType.split(';')[0].trim().toLowerCase();
        const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

        if (statusCode < 200 || statusCode >= 300) {
          const detail = buffer.toString('utf8', 0, Math.min(buffer.length, 700)).replace(/\s+/g, ' ').trim();
          reject(new Error(`WMS respondeu HTTP ${statusCode}${detail ? `: ${detail}` : ''}`));
          return;
        }
        if (!buffer.length) {
          reject(new Error('O WMS retornou uma resposta vazia.'));
          return;
        }

        const isImage = normalizedType.startsWith('image/') || isPng || isJpeg;
        if (expectImage && !isImage) {
          const detail = buffer.toString('utf8', 0, Math.min(buffer.length, 900)).replace(/\s+/g, ' ').trim();
          reject(new Error(detail || `O WMS respondeu com Content-Type ${contentType}, sem imagem.`));
          return;
        }

        const finalContentType = normalizedType.startsWith('image/')
          ? contentType
          : (isPng ? 'image/png' : (isJpeg ? 'image/jpeg' : contentType));

        resolve({
          upstream: { status: statusCode, headers: upstream.headers },
          contentType: finalContentType,
          buffer,
          targetUrl: url.toString(),
          isImage
        });
      });
    });

    req.setTimeout(WMS_PROXY_TIMEOUT_MS, () => {
      req.destroy(new Error(`O WMS excedeu o tempo limite de ${Math.round(WMS_PROXY_TIMEOUT_MS / 1000)} segundos.`));
    });
    req.once('error', reject);
    req.end();
  });
}

async function fetchFirstAvailableGeoservice(candidates, { expectImage = false } = {}) {
  const errors = [];
  for (const candidate of candidates) {
    try {
      return await requestBinaryViaNode(candidate, { expectImage });
    } catch (error) {
      errors.push(`${candidate.protocol}//${candidate.host}${candidate.pathname}: ${error?.message || String(error)}`);
    }
  }
  throw statusError(502, `O proxy geográfico não conseguiu receber uma imagem válida do serviço externo. ${errors.slice(0, 3).join(' | ')}`.trim());
}

function binaryResponse(response, buffer, status, headers) {
  if (typeof response.binary === 'function') {
    return response.binary(buffer, status, headers);
  }
  if (typeof response.send === 'function') {
    return response.send(buffer, status, headers);
  }
  throw statusError(500, 'Runtime Appwrite sem suporte a resposta binária.');
}

async function proxyGeoService(request, response) {
  const encodedTargetUrl = geoserviceEncodedUpstreamFromPath(request);
  const target = geoserviceProxyTarget(request) || geoserviceDefaultTargetForRequest(request);
  const targetUrl = encodedTargetUrl || buildGeoserviceUpstreamUrl(request, target);
  const requestedOperation = String(targetUrl.searchParams.get('REQUEST') || queryValue(request, 'request') || '').toUpperCase();
  const path = parsePath(request);
  const requestedService = String(targetUrl.searchParams.get('SERVICE') || queryValue(request, 'service') || '').toUpperCase();
  const expectImage = requestedService === 'WMS'
    && requestedOperation !== 'GETFEATUREINFO'
    && requestedOperation !== 'GETCAPABILITIES'
    && requestedOperation !== 'GETLEGENDGRAPHIC'
    && !path.includes('wms-info');
  const result = await fetchFirstAvailableGeoservice(geoserviceUpstreamCandidates(targetUrl), { expectImage });

  const headers = {
    'Access-Control-Allow-Origin': corsOrigin(request),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Type, Content-Length, X-Surveyor-Upstream-Url',
    'Content-Type': result.contentType,
    'Content-Length': String(result.buffer.length),
    'Cache-Control': result.isImage ? 'public, max-age=900, stale-while-revalidate=86400' : 'no-store',
    'X-Surveyor-Upstream-Url': result.targetUrl
  };

  // WFS/GetCapabilities/GetFeatureInfo são consumidos por fetch() no navegador.
  // Em alguns runtimes do Appwrite, respostas textuais por res.binary() não
  // preservam CORS corretamente. Para JSON/XML/texto usamos res.send().
  if (!result.isImage) {
    const text = result.buffer.toString('utf8');
    if (typeof response.send === 'function') return response.send(text, result.upstream.status, headers);
  }

  return binaryResponse(response, result.buffer, result.upstream.status, headers);
}


  return { remoteLayerDetection, proxyGeoService, buildGeoserviceUpstreamUrl, normalizeProxyBaseTarget, geoserviceUpstreamCandidates, geoserviceEncodedUpstreamFromPath };
}
