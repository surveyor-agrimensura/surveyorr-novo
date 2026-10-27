import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import shp from 'shpjs';

const APP_VERSION = '1.0.0-rc.185.74';
// Surveyor 21.11.5q: hosts adicionais permitidos somente para consultas fundiárias pontuais.
const MAX_RESPONSE_BYTES = Number(process.env.GEOSERVICES_MAX_RESPONSE_BYTES || 25 * 1024 * 1024);
const TIMEOUT_MS = Number(process.env.GEOSERVICES_TIMEOUT_MS || 8500);
const INEMA_TRY_HTTPS = String(process.env.GEOSERVICES_INEMA_TRY_HTTPS || 'true').toLowerCase() === 'true';
const ALLOW_INSECURE_INEMA_HTTP = String(process.env.GEOSERVICES_ALLOW_INSECURE_INEMA_HTTP || 'false').toLowerCase() === 'true';
const ALLOW_INSECURE_INEMA_TLS = String(process.env.GEOSERVICES_ALLOW_INSECURE_INEMA_TLS || 'false').toLowerCase() === 'true';
const MAX_REDIRECTS = Number(process.env.GEOSERVICES_MAX_REDIRECTS || 4);

const DEFAULT_ALLOWED_HOSTS = [
  'geoserver.inema.ba.gov.br',
  'inema.ba.gov.br',
  'acervofundiario.incra.gov.br',
  'www.acervofundiario.incra.gov.br',
  'pamgia.ibama.gov.br',
  'geo.infrasa.gov.br'
];

function statusError(status, message, details = null) {
  const err = new Error(message || 'Erro interno.');
  err.status = status;
  err.details = details;
  if (details?.retryAfterSeconds) err.retryAfterSeconds = Number(details.retryAfterSeconds) || 0;
  return err;
}

function headerValue(req, name) {
  const wanted = String(name || '').toLowerCase();
  const headers = req?.headers || {};
  if (headers instanceof Headers) return headers.get(name) || headers.get(wanted) || '';
  const key = Object.keys(headers).find((item) => String(item || '').toLowerCase() === wanted);
  const value = key ? headers[key] : '';
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function pathFromRequest(req) {
  const raw = req?.path || req?.url || req?.originalUrl || req?.href || '/';
  try {
    return new URL(String(raw || '/'), 'https://surveyor.local').pathname || '/';
  } catch {
    return String(raw || '/').split('?')[0] || '/';
  }
}

function method(req) {
  return String(req?.method || req?.methodName || 'GET').toUpperCase();
}

function corsOrigin(req) {
  const origin = String(headerValue(req, 'origin') || '').trim().replace(/\/+$/, '');
  const defaults = [
    'https://surveyorr.com.br',
    'https://www.surveyorr.com.br',
    'https://admin.surveyorr.com.br'
  ];
  if (String(process.env.ENABLE_LEGACY_CORS_ORIGINS || 'false').toLowerCase() === 'true') {
    defaults.push('https://surveyoragrimensura.tech', 'https://www.surveyoragrimensura.tech', 'https://admin.surveyoragrimensura.tech');
  }
  const configured = String(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter((item) => item && item !== '*');
  const allowed = [...new Set([...defaults, ...configured])];
  return origin && allowed.includes(origin) ? origin : '';
}

function corsHeaders(req, extra = {}) {
  const allowedOrigin = corsOrigin(req);
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With, X-Surveyor-Internal-Token, Origin',
    'Vary': 'Origin',
    'Access-Control-Expose-Headers': 'Content-Type, Content-Length, X-Surveyor-Upstream-Url',
    'Access-Control-Max-Age': '86400',
    ...extra
  };
}

function sendJson(res, req, status, payload, extra = {}) {
  const headers = corsHeaders(req, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  if (typeof res.json === 'function') return res.json(payload, status, headers);
  return res.send(JSON.stringify(payload), status, headers);
}

function sendText(res, req, status, text, contentType = 'text/plain; charset=utf-8', extra = {}) {
  const headers = corsHeaders(req, { 'Content-Type': contentType, ...extra });
  return res.send(String(text || ''), status, headers);
}

function sendBinary(res, req, status, buffer, contentType, extra = {}) {
  const headers = corsHeaders(req, {
    'Content-Type': contentType || 'application/octet-stream',
    'Content-Length': String(buffer.length),
    ...extra
  });
  if (typeof res.binary === 'function') return res.binary(buffer, status, headers);
  return res.send(buffer, status, headers);
}

function decodeBase64UrlText(value) {
  const raw = String(value || '').trim();
  if (!raw) throw statusError(400, 'Payload não informado.');
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function allowedHosts() {
  const extra = String(process.env.GEOSERVICES_ALLOWED_HOSTS || process.env.WMS_PROXY_ALLOWED_HOSTS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_HOSTS, ...extra]);
}

function isInemaHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'inema.ba.gov.br' || host.endsWith('.inema.ba.gov.br');
}

const GEOSERVICES_RATE_BUCKETS = new Map();

function boundedIntegerEnv(name, fallback, min, max) {
  const parsed = Number(process.env[name]);
  const value = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  return Math.max(min, Math.min(max, value));
}

function trustedRequestIp(req) {
  const candidates = [
    headerValue(req, 'cf-connecting-ip'),
    headerValue(req, 'x-real-ip'),
    String(headerValue(req, 'x-forwarded-for') || '').split(',')[0].trim()
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (/^[0-9a-f:.]{2,80}$/i.test(value)) return value.slice(0, 80);
  }
  return 'unknown';
}

function assertProxyRateLimit(req) {
  const ip = trustedRequestIp(req);
  const now = Date.now();
  const windowMs = boundedIntegerEnv('GEOSERVICES_RATE_WINDOW_MS', 60_000, 10_000, 15 * 60_000);
  const limit = boundedIntegerEnv('GEOSERVICES_RATE_LIMIT', 180, 10, 5000);
  const maxBuckets = boundedIntegerEnv('GEOSERVICES_RATE_MAX_BUCKETS', 2500, 100, 20000);
  const key = `proxy-rate|${ip}`;
  const current = GEOSERVICES_RATE_BUCKETS.get(key) || { attempts: [], updatedAt: now };
  const attempts = current.attempts.filter((ts) => Number.isFinite(ts) && now - ts < windowMs);

  if (attempts.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((Math.min(...attempts) + windowMs - now) / 1000));
    throw statusError(429, 'Limite de requisições ao proxy geográfico excedido. Aguarde alguns instantes.', {
      code: 'GEOSERVICES_RATE_LIMITED',
      retryAfterSeconds
    });
  }

  attempts.push(now);
  GEOSERVICES_RATE_BUCKETS.set(key, { attempts, updatedAt: now });

  if (GEOSERVICES_RATE_BUCKETS.size > maxBuckets) {
    for (const [bucketKey, value] of GEOSERVICES_RATE_BUCKETS.entries()) {
      if (now - Number(value?.updatedAt || 0) > windowMs) GEOSERVICES_RATE_BUCKETS.delete(bucketKey);
      if (GEOSERVICES_RATE_BUCKETS.size <= Math.floor(maxBuckets * 0.8)) break;
    }
  }

  return { limit, remaining: Math.max(0, limit - attempts.length), windowMs };
}

function assertAllowed(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw statusError(400, 'URL upstream deve usar HTTP ou HTTPS.');
  const host = String(url.hostname || '').toLowerCase();
  if (!allowedHosts().has(host)) throw statusError(403, `Domínio não autorizado no proxy geográfico: ${host}`);
  if (url.port && !((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80'))) {
    throw statusError(403, 'Porta upstream não autorizada no proxy geográfico.');
  }
  if (url.protocol === 'http:' && !(isInemaHost(host) && ALLOW_INSECURE_INEMA_HTTP)) {
    throw statusError(403, 'Upstream HTTP inseguro desativado. Use HTTPS ou habilite explicitamente a exceção controlada para o INEMA.');
  }
}

const OGC_ALLOWED_PARAMS = {
  wms: new Set(['SERVICE','REQUEST','VERSION','LAYERS','STYLES','FORMAT','TRANSPARENT','CRS','SRS','BBOX','WIDTH','HEIGHT','TILED','TIME','CQL_FILTER','SLD_BODY','BGCOLOR','DPI','MAP_RESOLUTION']),
  info: new Set(['SERVICE','REQUEST','VERSION','LAYERS','QUERY_LAYERS','STYLES','FORMAT','INFO_FORMAT','TRANSPARENT','CRS','SRS','BBOX','WIDTH','HEIGHT','I','J','X','Y','FEATURE_COUNT','CQL_FILTER']),
  wfs: new Set(['SERVICE','REQUEST','VERSION','TYPENAME','TYPENAMES','OUTPUTFORMAT','SRSNAME','BBOX','COUNT','MAXFEATURES','STARTINDEX','PROPERTYNAME','CQL_FILTER']),
  wmts: new Set(['SERVICE','REQUEST','VERSION','LAYER','STYLE','FORMAT','TILEMATRIXSET','TILEMATRIX','TILEROW','TILECOL'])
};

const OGC_ALLOWED_REQUESTS = {
  wms: new Set(['GETMAP','GETCAPABILITIES','GETLEGENDGRAPHIC']),
  info: new Set(['GETFEATUREINFO']),
  wfs: new Set(['GETFEATURE','GETCAPABILITIES','DESCRIBEFEATURETYPE']),
  wmts: new Set(['GETTILE','GETCAPABILITIES'])
};

function ogcExpectedService(kind) {
  if (kind === 'wfs') return 'WFS';
  if (kind === 'wmts') return 'WMTS';
  return 'WMS';
}

function validateOgcScalar(name, rawValue, kind) {
  const value = String(rawValue ?? '').trim();
  if (!value) return '';
  if (value.length > (name === 'SLD_BODY' ? 16_000 : 4_096)) throw statusError(400, `Parâmetro OGC ${name} excede o limite permitido.`);
  if (/[\u0000-\u001F\u007F\r\n]/.test(value)) throw statusError(400, `Parâmetro OGC ${name} contém caracteres de controle.`);

  if (name === 'REQUEST') {
    const normalized = value.toUpperCase();
    if (!OGC_ALLOWED_REQUESTS[kind]?.has(normalized)) throw statusError(400, `Operação OGC não permitida nesta rota: ${value}`);
    return normalized;
  }
  if (name === 'SERVICE') {
    const normalized = value.toUpperCase();
    const expected = ogcExpectedService(kind);
    if (normalized !== expected) throw statusError(400, `SERVICE inválido para a rota ${kind.toUpperCase()}.`);
    return expected;
  }
  if (name === 'VERSION' && !/^\d{1,2}\.\d{1,2}\.\d{1,2}$/.test(value)) throw statusError(400, 'VERSION OGC inválida.');
  if (['CRS','SRS','SRSNAME'].includes(name) && !/^(?:EPSG:\d{3,6}|CRS:84)$/i.test(value)) throw statusError(400, `${name} OGC inválido.`);
  if (name === 'BBOX') {
    const parts = value.split(',').map((item) => item.trim());
    if (parts.length < 4 || parts.length > 5 || parts.slice(0, 4).some((item) => !Number.isFinite(Number(item)))) throw statusError(400, 'BBOX OGC inválido.');
    if (parts[4] && !/^(?:EPSG:\d{3,6}|CRS:84)$/i.test(parts[4])) throw statusError(400, 'CRS do BBOX inválido.');
    return parts.join(',');
  }
  if (['WIDTH','HEIGHT'].includes(name)) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 4096) throw statusError(400, `${name} OGC fora do limite.`);
    return String(number);
  }
  if (['I','J','X','Y','FEATURE_COUNT','COUNT','MAXFEATURES','STARTINDEX','TILEROW','TILECOL'].includes(name)) {
    const number = Number(value);
    const maximum = name === 'STARTINDEX' ? 1_000_000 : (['TILEROW','TILECOL'].includes(name) ? 100_000_000 : 10_000);
    if (!Number.isInteger(number) || number < 0 || number > maximum) throw statusError(400, `${name} OGC fora do limite.`);
    return String(number);
  }
  if (name === 'TRANSPARENT' && !/^(?:true|false)$/i.test(value)) throw statusError(400, 'TRANSPARENT deve ser true ou false.');
  if (['LAYERS','QUERY_LAYERS','TYPENAME','TYPENAMES','LAYER','TILEMATRIXSET','TILEMATRIX','PROPERTYNAME'].includes(name)
      && !/^[\w.:-]+(?:,[\w.:-]+)*$/u.test(value)) throw statusError(400, `${name} contém identificador inválido.`);
  if (name === 'FORMAT' || name === 'INFO_FORMAT' || name === 'OUTPUTFORMAT') {
    if (!/^[\w.+-]+\/[\w.+-]+(?:\s*;\s*charset=[\w-]+)?$|^(?:json|geojson|GML2|GML3)$/i.test(value)) throw statusError(400, `${name} OGC inválido.`);
  }
  if (name === 'SLD_BODY') {
    if (/<!DOCTYPE|<!ENTITY|xlink:href|OnlineResource|RemoteOWS/i.test(value)) throw statusError(400, 'SLD_BODY contém recurso externo ou declaração não permitida.');
    if (!/StyledLayerDescriptor/i.test(value)) throw statusError(400, 'SLD_BODY inválido.');
  }
  if (name === 'CQL_FILTER' && /(?:https?:|file:|ftp:|gopher:|\\\\|\0)/i.test(value)) throw statusError(400, 'CQL_FILTER contém referência externa não permitida.');
  return value;
}

function sanitizeOgcUpstream(url, kind) {
  const safeKind = String(kind || '').toLowerCase();
  if (!OGC_ALLOWED_PARAMS[safeKind]) throw statusError(400, 'Tipo de proxy OGC inválido.');
  const cleaned = new URL(url.toString());
  const entries = [...cleaned.searchParams.entries()];
  cleaned.search = '';
  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey || '').trim().toUpperCase();
    if (!OGC_ALLOWED_PARAMS[safeKind].has(key)) continue;
    const value = validateOgcScalar(key, rawValue, safeKind);
    if (value !== '') cleaned.searchParams.set(key, value);
  }

  const expectedService = ogcExpectedService(safeKind);
  if (!cleaned.searchParams.has('SERVICE')) cleaned.searchParams.set('SERVICE', expectedService);
  if (!cleaned.searchParams.has('VERSION')) cleaned.searchParams.set('VERSION', safeKind === 'wfs' ? '1.0.0' : (safeKind === 'wmts' ? '1.0.0' : '1.1.1'));
  if (!cleaned.searchParams.has('REQUEST')) {
    cleaned.searchParams.set('REQUEST', safeKind === 'wfs' ? 'GETFEATURE' : safeKind === 'wmts' ? 'GETTILE' : safeKind === 'info' ? 'GETFEATUREINFO' : 'GETMAP');
  }
  validateOgcScalar('SERVICE', cleaned.searchParams.get('SERVICE'), safeKind);
  validateOgcScalar('REQUEST', cleaned.searchParams.get('REQUEST'), safeKind);
  assertAllowed(cleaned);
  return cleaned;
}

function upstreamFromPayload(req, kind) {
  const path = pathFromRequest(req);
  const patterns = [
    /^\/(wms|wfs|wmts|info)-url\/([^/?#]+)$/i,
    /^\/api\/(?:geoservices\/)?(wms|wfs|wmts|wms-info|info)-url\/([^/?#]+)$/i
  ];
  for (const pattern of patterns) {
    const match = path.match(pattern);
    if (!match) continue;
    const routeKind = String(match[1] || '').toLowerCase().replace(/^wms-info$/, 'info');
    if (kind && routeKind !== kind) continue;
    const decoded = decodeBase64UrlText(decodeURIComponent(match[2]));
    if (!/^https?:\/\//i.test(decoded)) throw statusError(400, 'Payload sem URL HTTP(S).');
    const url = new URL(decoded);
    url.username = '';
    url.password = '';
    url.hash = '';
    assertAllowed(url);
    return sanitizeOgcUpstream(url, routeKind);
  }
  return null;
}

function queryStringSources(req) {
  const sources = [];
  const push = (value) => {
    if (value === undefined || value === null) return;
    if (value instanceof URLSearchParams) {
      const text = value.toString();
      if (text) sources.push(text);
      return;
    }
    if (typeof value === 'object') return;
    let text = String(value || '').trim();
    if (!text) return;
    if (text.startsWith('?')) text = text.slice(1);
    if (text.includes('?')) text = text.slice(text.indexOf('?') + 1);
    if (text) sources.push(text);
  };

  for (const key of ['query', 'params', 'queryString', 'rawQueryString', 'rawQuery', 'search']) {
    const value = req?.[key];
    if (typeof value === 'string' || value instanceof URLSearchParams) push(value);
  }
  for (const value of [req?.url, req?.path, req?.originalUrl, req?.href]) {
    if (typeof value === 'string') push(value);
  }
  for (const headerName of ['x-original-uri', 'x-forwarded-uri', 'x-rewrite-url', 'x-appwrite-path']) {
    const value = headerValue(req, headerName);
    if (typeof value === 'string') push(value);
  }
  return sources;
}

function queryValue(req, name) {
  const wanted = String(name || '').toLowerCase();
  for (const query of [req?.query, req?.params]) {
    if (!query) continue;
    if (query instanceof URLSearchParams) {
      const value = query.get(name) || query.get(wanted);
      if (value != null) return value;
      continue;
    }
    if (typeof query === 'object') {
      const key = Object.keys(query).find((item) => String(item || '').toLowerCase() === wanted);
      const value = key ? query[key] : undefined;
      if (value != null) return Array.isArray(value) ? value[0] : value;
    }
  }
  for (const raw of queryStringSources(req)) {
    try {
      const params = new URLSearchParams(raw);
      const value = params.get(name) || params.get(wanted);
      if (value != null) return value;
    } catch {}
  }
  try {
    const rawUrl = req?.url || req?.path || '';
    const url = new URL(String(rawUrl || '/'), 'https://surveyor.local');
    return url.searchParams.get(name) || url.searchParams.get(wanted) || undefined;
  } catch {
    return undefined;
  }
}

function requestQueryEntries(req) {
  const entries = [];
  const seen = new Set();
  const addEntry = (key, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) return value.forEach((item) => addEntry(key, item));
    const k = String(key || '');
    const v = String(value);
    const fingerprint = `${k.toLowerCase()}=${v}`;
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    entries.push([k, v]);
  };

  for (const query of [req?.query, req?.params]) {
    if (!query) continue;
    if (query instanceof URLSearchParams) {
      for (const [key, value] of query.entries()) addEntry(key, value);
    } else if (typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) addEntry(key, value);
    }
  }
  for (const raw of queryStringSources(req)) {
    try {
      const params = new URLSearchParams(raw);
      for (const [key, value] of params.entries()) addEntry(key, value);
    } catch {}
  }
  for (const source of [req?.url, req?.path, req?.originalUrl, req?.href]) {
    try {
      const url = new URL(String(source || '/'), 'https://surveyor.local');
      for (const [key, value] of url.searchParams.entries()) addEntry(key, value);
    } catch {}
  }
  return entries;
}

function proxyTarget(req) {
  return queryValue(req, 'target')
    || queryValue(req, 'targetUrl')
    || queryValue(req, 'url')
    || queryValue(req, 'serviceUrl')
    || queryValue(req, 'baseUrl');
}

function upstreamFromQuery(req, kind) {
  const path = pathFromRequest(req);
  const route = path.match(/^\/(?:api\/(?:geoservices\/)?)?(wms|wfs|wmts|wms-info|info)$/i);
  if (!route) return null;
  const routeKind = String(route[1] || '').toLowerCase().replace(/^wms-info$/, 'info');
  if (kind && routeKind !== kind) return null;

  const target = proxyTarget(req);
  if (!target || !/^https?:\/\//i.test(String(target))) {
    throw statusError(400, 'Informe target/url/serviceUrl HTTP(S) para o proxy geográfico.');
  }
  const upstream = new URL(String(target));
  upstream.username = '';
  upstream.password = '';
  upstream.hash = '';
  if (isInemaHost(upstream.hostname) && /^\/(?:wms|ows|geoserver\/wms|geoserver\/ows)\/?$/i.test(upstream.pathname)) {
    upstream.pathname = '/geoserver/ows';
  }

  const reserved = new Set(['target', 'targeturl', 'url', 'serviceurl', 'baseurl', 'token', 'accesstoken', 'api', 'apibaseurl']);
  const allowedParams = OGC_ALLOWED_PARAMS[routeKind] || new Set();
  for (const [key, value] of requestQueryEntries(req)) {
    const normalizedKey = String(key || '').trim().toUpperCase();
    if (reserved.has(normalizedKey.toLowerCase()) || !allowedParams.has(normalizedKey)) continue;
    if (value === undefined || value === null || value === '') continue;
    upstream.searchParams.set(normalizedKey, validateOgcScalar(normalizedKey, value, routeKind));
  }
  if (routeKind === 'wms' && !upstream.searchParams.has('STYLES')) upstream.searchParams.set('STYLES', '');
  return sanitizeOgcUpstream(upstream, routeKind);
}

function upstreamCandidates(url) {
  const candidates = [];
  const add = (candidate) => {
    const parsed = candidate instanceof URL ? candidate : new URL(String(candidate));
    assertAllowed(parsed);
    if (!candidates.some((item) => item.toString() === parsed.toString())) candidates.push(parsed);
  };

  if (isInemaHost(url.hostname)) {
    const query = url.search || '';
    const preferredPath = /\/wms(?:$|\?)/i.test(url.pathname) ? 'wms' : 'ows';
    const secondaryPath = preferredPath === 'wms' ? 'ows' : 'wms';

    if (INEMA_TRY_HTTPS) {
      add(`https://geoserver.inema.ba.gov.br/geoserver/${preferredPath}${query}`);
      add(`https://geoserver.inema.ba.gov.br/geoserver/${secondaryPath}${query}`);
    }
    if (ALLOW_INSECURE_INEMA_HTTP) {
      add(`http://geoserver.inema.ba.gov.br/geoserver/${preferredPath}${query}`);
      add(`http://geoserver.inema.ba.gov.br/geoserver/${secondaryPath}${query}`);
    }
    if (!candidates.length) throw statusError(503, 'Nenhum transporte seguro do INEMA está habilitado.');
    return candidates;
  }

  add(url);
  if (url.protocol === 'http:') {
    const httpsUrl = new URL(url.toString());
    httpsUrl.protocol = 'https:';
    candidates.unshift(httpsUrl);
  }

  return candidates;
}


async function fetchBinaryWithFetch(url, { redirectsLeft = MAX_REDIRECTS } = {}) {
  assertAllowed(url);
  if (typeof fetch !== 'function' || typeof AbortController !== 'function') {
    return fetchBinary(url);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'image/png,image/jpeg,image/*,application/json,application/geo+json,application/xml,text/xml,text/plain,*/*;q=0.2',
        'Accept-Encoding': 'identity',
        'User-Agent': `Surveyor-GeoServices/${APP_VERSION}`
      }
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirecionamento HTTP ${response.status} sem destino.`);
      if (redirectsLeft <= 0) throw new Error('Limite de redirecionamentos excedido.');
      const nextUrl = new URL(location, url);
      assertAllowed(nextUrl);
      return fetchBinaryWithFetch(nextUrl, { redirectsLeft: redirectsLeft - 1 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    if (!response.ok) {
      const detail = buffer.toString('utf8', 0, Math.min(buffer.length, 900)).replace(/\s+/g, ' ').trim();
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    if (!buffer.length) throw new Error('Resposta vazia do serviço geográfico.');
    if (buffer.length > MAX_RESPONSE_BYTES) throw new Error('Resposta geográfica excedeu o limite configurado.');

    return { status: response.status, buffer, contentType, targetUrl: url.toString() };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Tempo limite de ${Math.round(TIMEOUT_MS / 1000)}s excedido.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function fetchBinary(url, { redirectsLeft = MAX_REDIRECTS } = {}) {
  assertAllowed(url);
  const transport = url.protocol === 'https:' ? https : http;
  const bypassBrokenInemaTls = url.protocol === 'https:' && isInemaHost(url.hostname) && ALLOW_INSECURE_INEMA_TLS;

  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method: 'GET',
      headers: {
        Accept: 'image/png,image/jpeg,image/*,application/json,application/geo+json,application/xml,text/xml,text/plain,*/*;q=0.2',
        'Accept-Encoding': 'identity',
        'User-Agent': `Surveyor-GeoServices/${APP_VERSION}`,
        Connection: 'close'
      },
      ...(isInemaHost(url.hostname) ? { family: 4 } : {}),
      ...(url.protocol === 'https:' ? { rejectUnauthorized: !bypassBrokenInemaTls, servername: url.hostname } : {})
    }, (upstream) => {
      const statusCode = Number(upstream.statusCode || 0);
      const location = upstream.headers.location;
      if (statusCode >= 300 && statusCode < 400 && location) {
        upstream.resume();
        if (redirectsLeft <= 0) return reject(new Error('Limite de redirecionamentos excedido.'));
        let next;
        try {
          next = new URL(location, url);
          assertAllowed(next);
        } catch (err) {
          return reject(err);
        }
        fetchBinary(next, { redirectsLeft: redirectsLeft - 1 }).then(resolve, reject);
        return;
      }

      const chunks = [];
      let total = 0;
      upstream.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_RESPONSE_BYTES) {
          upstream.destroy(new Error('Resposta geográfica excedeu o limite configurado.'));
          return;
        }
        chunks.push(chunk);
      });
      upstream.once('error', reject);
      upstream.once('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = String(upstream.headers['content-type'] || 'application/octet-stream');
        if (statusCode < 200 || statusCode >= 300) {
          const detail = buffer.toString('utf8', 0, Math.min(buffer.length, 900)).replace(/\s+/g, ' ').trim();
          reject(new Error(`HTTP ${statusCode}${detail ? `: ${detail}` : ''}`));
          return;
        }
        if (!buffer.length) return reject(new Error('Resposta vazia do serviço geográfico.'));
        resolve({ status: statusCode, buffer, contentType, targetUrl: url.toString() });
      });
    });

    request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error(`Tempo limite de ${Math.round(TIMEOUT_MS / 1000)}s excedido.`)));
    request.once('error', reject);
    request.end();
  });
}

async function fetchFirst(candidates) {
  const errors = [];
  for (const candidate of candidates) {
    try {
      return await fetchBinaryWithFetch(candidate);
    } catch (error) {
      errors.push(`${candidate.protocol}//${candidate.host}${candidate.pathname}: ${error.message || String(error)}`);
    }
  }
  throw statusError(502, `GeoServices não conseguiu consultar o serviço externo. ${errors.slice(0, 4).join(' | ')}`);
}

function isImagePayload(buffer, contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isGif = buffer.length >= 6 && buffer.subarray(0, 6).toString('ascii').startsWith('GIF');
  return type.startsWith('image/') || isPng || isJpeg || isGif;
}

function isDynamicRuralRegistryMap(upstream) {
  const value = String(upstream || '').toLowerCase();
  return value.includes('cefir_imovel_rural_limite_inema')
    || value.includes('sicar_imoveis_ba');
}

async function proxy(req, res, kind) {
  assertProxyRateLimit(req);
  const upstream = upstreamFromPayload(req, kind) || upstreamFromQuery(req, kind);
  if (!upstream) throw statusError(404, 'Rota GeoServices não encontrada.');
  const result = await fetchFirst(upstreamCandidates(upstream));
  const cache = (kind === 'wms' || kind === 'wmts')
    ? (isDynamicRuralRegistryMap(upstream)
      ? 'public, max-age=30, stale-while-revalidate=30'
      : 'public, max-age=900, stale-while-revalidate=86400')
    : 'no-store';
  const headers = {
    'Cache-Control': cache,
    'X-Surveyor-Upstream-Url': result.targetUrl
  };

  if ((kind === 'wms' || kind === 'wmts') && isImagePayload(result.buffer, result.contentType)) {
    return sendBinary(res, req, result.status, result.buffer, result.contentType, headers);
  }

  // WFS/GetFeatureInfo/GetCapabilities são consumidos por fetch(), então resposta textual
  // via send() mantém CORS de forma mais confiável nos runtimes Appwrite.
  const textType = result.contentType || (kind === 'wfs' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8');
  return sendText(res, req, result.status, result.buffer.toString('utf8'), textType, headers);
}

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function appwriteEndpoint() {
  return String(env('APPWRITE_ENDPOINT') || env('APPWRITE_FUNCTION_API_ENDPOINT') || 'https://cloud.appwrite.io/v1').replace(/\/+$/, '');
}

function appwriteProjectId() {
  return env('APPWRITE_PROJECT_ID') || env('APPWRITE_FUNCTION_PROJECT_ID');
}

function appwriteDatabaseId() {
  return env('APPWRITE_DATABASE_ID', 'surveyor_db');
}

function appwriteApiKey() {
  return env('APPWRITE_API_KEY');
}

function layersCollectionId() {
  return env('APPWRITE_COLLECTION_LAYERS', 'layers');
}

function projectFilesBucketId() {
  return env('APPWRITE_BUCKET_PROJECT_FILES', 'project_files');
}

function appwriteHeaders(extra = {}) {
  return {
    'X-Appwrite-Project': appwriteProjectId(),
    ...(appwriteApiKey() ? { 'X-Appwrite-Key': appwriteApiKey() } : {}),
    ...extra
  };
}

function safeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

function internalToken() {
  return env('GEOSERVICES_INTERNAL_TOKEN') || env('SURVEYOR_INTERNAL_TOKEN') || '';
}

function safeTokenEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (!a.length || a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

function assertInternal(req) {
  const expected = String(internalToken() || '').trim();
  if (expected.length < 24) {
    throw statusError(503, 'Processamento interno de camadas indisponível: token interno não configurado com segurança.', { code: 'GEOSERVICES_INTERNAL_TOKEN_REQUIRED' });
  }
  const got = String(headerValue(req, 'x-surveyor-internal-token') || '').trim();
  if (!safeTokenEqual(got, expected)) throw statusError(401, 'Token interno inválido para processamento de camadas.');
}

async function requestJson(req) {
  if (req.bodyJson && typeof req.bodyJson === 'object') return req.bodyJson;
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = req.bodyText || req.body || '';
  if (!raw) return {};
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

async function parseAppwriteResponse(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  return response.text();
}

async function awFetch(path, options = {}) {
  const response = await fetch(`${appwriteEndpoint()}${path}`, {
    ...options,
    headers: appwriteHeaders({ ...(options.headers || {}) })
  });
  const payload = await parseAppwriteResponse(response).catch(() => null);
  if (!response.ok) throw statusError(response.status, payload?.message || payload?.error || 'Erro Appwrite.', payload);
  return payload;
}

async function getLayer(layerId) {
  const legacy = `/databases/${encodeURIComponent(appwriteDatabaseId())}/collections/${encodeURIComponent(layersCollectionId())}/documents/${encodeURIComponent(layerId)}`;
  try { return await awFetch(legacy); } catch (error) { if (![404, 405].includes(Number(error.status))) throw error; }
  return awFetch(`/tablesdb/${encodeURIComponent(appwriteDatabaseId())}/tables/${encodeURIComponent(layersCollectionId())}/rows/${encodeURIComponent(layerId)}`);
}

async function updateLayer(layerId, data) {
  const legacy = `/databases/${encodeURIComponent(appwriteDatabaseId())}/collections/${encodeURIComponent(layersCollectionId())}/documents/${encodeURIComponent(layerId)}`;
  try {
    return await awFetch(legacy, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } catch (error) { if (![404, 405].includes(Number(error.status))) throw error; }
  return awFetch(`/tablesdb/${encodeURIComponent(appwriteDatabaseId())}/tables/${encodeURIComponent(layersCollectionId())}/rows/${encodeURIComponent(layerId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

async function downloadFileBuffer(bucket, fileId) {
  const response = await fetch(`${appwriteEndpoint()}/storage/buckets/${encodeURIComponent(bucket)}/files/${encodeURIComponent(fileId)}/view`, {
    headers: appwriteHeaders()
  });
  if (!response.ok) throw statusError(response.status, `Não foi possível baixar arquivo ${fileId} do Storage.`);
  return Buffer.from(await response.arrayBuffer());
}

async function createStorageFile(bucket, fileName, content, mimeType = 'application/json') {
  const fileId = cryptoRandomId();
  const form = new FormData();
  form.append('fileId', fileId);
  form.append('file', new Blob([content ?? ''], { type: mimeType }), fileName || `${fileId}.json`);
  const response = await fetch(`${appwriteEndpoint()}/storage/buckets/${encodeURIComponent(bucket)}/files`, {
    method: 'POST',
    headers: appwriteHeaders(),
    body: form
  });
  const payload = await parseAppwriteResponse(response).catch(() => null);
  if (!response.ok) throw statusError(response.status, payload?.message || 'Erro ao salvar arquivo processado no Storage.', payload);
  return payload;
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function rowId(row = {}) { return row.$id || row.id || row._id; }

function normalizeFeatureCollection(result) {
  if (!result) return { type: 'FeatureCollection', features: [] };
  if (Array.isArray(result)) {
    return { type: 'FeatureCollection', features: result.flatMap((item) => normalizeFeatureCollection(item).features) };
  }
  if (result.type === 'FeatureCollection') return { ...result, features: Array.isArray(result.features) ? result.features : [] };
  if (result.type === 'Feature') return { type: 'FeatureCollection', features: [result] };
  if (result.features) return { type: 'FeatureCollection', features: result.features || [] };
  return { type: 'FeatureCollection', features: [] };
}

function coordinatesBbox(coords, box = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (!Array.isArray(coords)) return box;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      box[0] = Math.min(box[0], lon); box[1] = Math.min(box[1], lat);
      box[2] = Math.max(box[2], lon); box[3] = Math.max(box[3], lat);
    }
    return box;
  }
  for (const item of coords) coordinatesBbox(item, box);
  return box;
}

function featureBbox(feature) {
  const box = coordinatesBbox(feature?.geometry?.coordinates);
  return box.every(Number.isFinite) ? box : null;
}

function bboxCenter(box) {
  if (!box) return [0, 0];
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

function extendBbox(total, box) {
  if (!box) return total;
  if (!total) return [...box];
  total[0] = Math.min(total[0], box[0]); total[1] = Math.min(total[1], box[1]);
  total[2] = Math.max(total[2], box[2]); total[3] = Math.max(total[3], box[3]);
  return total;
}

function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat) || 0));
  const x = Math.floor(((Number(lon) + 180) / 360) * n);
  const rad = clampedLat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)), z };
}

function inferGeometryType(features) {
  const found = features.find((feature) => feature?.geometry?.type)?.geometry?.type;
  return found || 'Geometry';
}

async function updateProgress(layerId, sourceUpload, patch = {}) {
  const layer = await getLayer(layerId).catch(() => null);
  const metadata = safeJson(layer?.metadata, {});
  const nextUpload = { ...(metadata.sourceUpload || sourceUpload || {}), ...patch, updatedAt: new Date().toISOString() };
  await updateLayer(layerId, { metadata: JSON.stringify({ ...metadata, sourceUpload: nextUpload }), status: patch.status === 'ready' ? 'ready' : 'processing', updatedAt: new Date().toISOString() });
  return nextUpload;
}

async function processLayerImport(req, res) {
  assertInternal(req);
  const input = await requestJson(req);
  const layerId = String(input.layerId || '').trim();
  if (!layerId) throw statusError(400, 'layerId não informado.');
  if (!appwriteProjectId() || !appwriteApiKey()) throw statusError(500, 'APPWRITE_PROJECT_ID/API_KEY não configurados na GeoServices.');
  const bucket = input.bucketId || projectFilesBucketId();
  const chunkFileIds = Array.isArray(input.chunkFileIds) ? input.chunkFileIds.filter(Boolean) : [];
  const sourceFileId = String(input.sourceFileId || '').trim();
  if (!chunkFileIds.length && !sourceFileId) throw statusError(400, 'Nenhum ZIP informado para processamento.');
  const layer = await getLayer(layerId);
  const metadata = safeJson(layer.metadata, {});
  const sourceUpload = metadata.sourceUpload || {};

  await updateProgress(layerId, sourceUpload, { status: 'processing', progress: 38, message: 'Baixando ZIP do Storage para a GeoServices...' });
  let downloaded = 0;
  let zipBuffer;
  if (sourceFileId) {
    zipBuffer = await downloadFileBuffer(bucket, sourceFileId);
    downloaded = zipBuffer.length;
    await updateProgress(layerId, sourceUpload, { status: 'processing', progress: 50, message: 'ZIP direto baixado. Iniciando conversão...' });
  } else {
    const buffers = [];
    for (let i = 0; i < chunkFileIds.length; i += 1) {
      const buffer = await downloadFileBuffer(bucket, chunkFileIds[i]);
      buffers.push(buffer);
      downloaded += buffer.length;
      if (i % 2 === 0 || i === chunkFileIds.length - 1) {
        await updateProgress(layerId, sourceUpload, { status: 'processing', progress: 38 + Math.round(((i + 1) / chunkFileIds.length) * 12), message: `Baixando blocos do ZIP: ${i + 1}/${chunkFileIds.length}...` });
      }
    }
    zipBuffer = Buffer.concat(buffers);
    buffers.length = 0;
  }

  const maxBytes = Number(env('LAYER_IMPORT_MAX_ZIP_BYTES', String(256 * 1024 * 1024)));
  if (downloaded > maxBytes) throw statusError(413, 'ZIP acima do limite configurado para a GeoServices.');

  await updateProgress(layerId, sourceUpload, { status: 'processing', progress: 55, message: 'Convertendo Shapefile ZIP para GeoJSON...' });
  let parsed;
  try {
    parsed = await shp(zipBuffer);
  } catch (error) {
    throw statusError(422, `Não foi possível converter o Shapefile. Confira .shp, .shx, .dbf e .prj no ZIP. ${error.message || ''}`.trim());
  }
  const collection = normalizeFeatureCollection(parsed);
  const features = collection.features.filter((feature) => feature?.geometry?.coordinates);
  if (!features.length) throw statusError(422, 'O ZIP foi lido, mas nenhuma geometria foi encontrada.');
  const maxImportedFeatures = Math.max(1000, Math.min(300000, Number(env('LAYER_IMPORT_MAX_FEATURES', '150000')) || 150000));
  if (features.length > maxImportedFeatures) throw statusError(413, `A camada excede ${maxImportedFeatures.toLocaleString('pt-BR')} feições. Divida o arquivo antes de importar.`);
  const maxImportedVertices = Math.max(10000, Math.min(5000000, Number(env('LAYER_IMPORT_MAX_VERTICES', '2000000')) || 2000000));
  let importedVertices = 0;
  const countCoords = (value) => {
    if (!Array.isArray(value)) return 0;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) return 1;
    return value.reduce((sum, item) => sum + countCoords(item), 0);
  };
  for (const feature of features) {
    importedVertices += countCoords(feature?.geometry?.coordinates);
    if (importedVertices > maxImportedVertices) throw statusError(413, `A camada excede ${maxImportedVertices.toLocaleString('pt-BR')} vértices. Simplifique ou divida o arquivo antes de importar.`);
  }
  zipBuffer = null;

  const tileZoom = Math.max(4, Math.min(16, Number(env('LAYER_IMPORT_TILE_ZOOM', '12')) || 12));
  const maxFeaturesPerTile = Math.max(500, Number(env('LAYER_IMPORT_MAX_FEATURES_PER_TILE', '6000')) || 6000);
  const tileMap = new Map();
  let bounds = null;

  for (let i = 0; i < features.length; i += 1) {
    const feature = features[i];
    const box = featureBbox(feature);
    if (!box) continue;
    bounds = extendBbox(bounds, box);
    const [lon, lat] = bboxCenter(box);
    const tile = lonLatToTile(lon, lat, tileZoom);
    const key = `${tile.z}/${tile.x}/${tile.y}`;
    const entry = tileMap.get(key) || { ...tile, features: [], bbox: null };
    entry.features.push(feature);
    entry.bbox = extendBbox(entry.bbox, box);
    tileMap.set(key, entry);
    if (i % 5000 === 0) {
      await updateProgress(layerId, sourceUpload, { status: 'processing', progress: 62 + Math.round((i / features.length) * 16), message: `Organizando blocos: ${i.toLocaleString('pt-BR')} de ${features.length.toLocaleString('pt-BR')} feições...` });
    }
  }

  const tileEntries = [];
  const rawTiles = [...tileMap.values()];
  let savedParts = 0;
  for (const tile of rawTiles) {
    for (let offset = 0; offset < tile.features.length; offset += maxFeaturesPerTile) {
      const part = Math.floor(offset / maxFeaturesPerTile);
      const partFeatures = tile.features.slice(offset, offset + maxFeaturesPerTile);
      const content = JSON.stringify({ type: 'FeatureCollection', features: partFeatures });
      const file = await createStorageFile(projectFilesBucketId(), `layers/${layerId}/tiles/${tile.z}-${tile.x}-${tile.y}-${part}.geojson`, content, 'application/geo+json');
      tileEntries.push({
        z: tile.z,
        x: tile.x,
        y: tile.y,
        part,
        fileId: file.$id || file.id,
        bucketId: projectFilesBucketId(),
        featureCount: partFeatures.length,
        bytes: Buffer.byteLength(content),
        bbox: tile.bbox
      });
      savedParts += 1;
      if (savedParts % 5 === 0) {
        await updateProgress(layerId, sourceUpload, { status: 'processing', progress: 78 + Math.round((savedParts / Math.max(rawTiles.length, savedParts)) * 14), message: `Salvando blocos prontos: ${savedParts.toLocaleString('pt-BR')}...` });
      }
    }
  }

  const manifest = {
    version: '1.0',
    storageMode: 'tiled-geojson',
    generatedBy: 'surveyor-geoservices-appwrite',
    generatedAt: new Date().toISOString(),
    layerId,
    originalFileName: input.originalFileName || sourceUpload.originalFileName || 'camada.zip',
    originalBytes: Number(input.originalBytes || sourceUpload.totalBytes || zipBuffer.length),
    tileZoom,
    featureCount: features.length,
    geometryType: inferGeometryType(features),
    bounds,
    tiles: tileEntries
  };
  const manifestFile = await createStorageFile(projectFilesBucketId(), `layers/${layerId}/metadata.json`, JSON.stringify(manifest), 'application/json');
  const manifestFileId = manifestFile.$id || manifestFile.id;
  const readyUpload = {
    ...sourceUpload,
    status: 'ready',
    progress: 100,
    message: `Camada processada em ${tileEntries.length.toLocaleString('pt-BR')} bloco(s).`,
    processedAt: new Date().toISOString(),
    featureCount: features.length,
    tileCount: tileEntries.length,
    tileZoom
  };
  await updateLayer(layerId, {
    geometryType: inferGeometryType(features),
    serviceType: 'geojson',
    serviceUrl: '',
    status: 'ready',
    dataAvailable: true,
    dataFileId: manifestFileId,
    dataBucketId: projectFilesBucketId(),
    dataSizeBytes: tileEntries.reduce((sum, item) => sum + Number(item.bytes || 0), Buffer.byteLength(JSON.stringify(manifest))),
    featureCount: features.length,
    metadata: JSON.stringify({
      ...metadata,
      sourceUpload: readyUpload,
      storageMode: 'tiled-geojson',
      tileManifestFileId: manifestFileId,
      tileZoom,
      tileCount: tileEntries.length,
      bounds,
      originalFormat: 'shapefile-zip',
      convertedAt: new Date().toISOString()
    }),
    updatedAt: new Date().toISOString()
  });

  return sendJson(res, req, 200, { ok: true, upload: readyUpload, manifest: { fileId: manifestFileId, tileCount: tileEntries.length, featureCount: features.length, bounds } });
}

export default async function main({ req, res, error }) {
  try {
    const path = pathFromRequest(req);
    const httpMethod = method(req);

    if (httpMethod === 'OPTIONS') return res.send('', 204, corsHeaders(req));

    if (path === '/health' || path === '/api/health' || path === '/live' || path === '/ready') {
      return sendJson(res, req, 200, {
        ok: true,
        service: 'Surveyor GeoServices Appwrite Function',
        status: 'ready',
        version: APP_VERSION,
        publicProxy: true,
        allowedHosts: [...allowedHosts()]
      });
    }

    if (path === '/api/geoservices/import/process' || path === '/import/process') {
      if (httpMethod !== 'POST') return sendJson(res, req, 405, { ok: false, error: 'Use POST para processar camada.' });
      return processLayerImport(req, res);
    }

    if (/^\/(?:api\/(?:geoservices\/)?)?wms(?:$|-url\/|\/)/i.test(path)) return proxy(req, res, 'wms');
    if (/^\/(?:api\/(?:geoservices\/)?)?wfs(?:$|-url\/|\/)/i.test(path)) return proxy(req, res, 'wfs');
    if (/^\/(?:api\/(?:geoservices\/)?)?wmts(?:$|-url\/|\/)/i.test(path)) return proxy(req, res, 'wmts');
    if (/^\/(?:api\/(?:geoservices\/)?)?(?:wms-info|info)(?:$|-url\/|\/)/i.test(path)) return proxy(req, res, 'info');

    return sendJson(res, req, 404, { ok: false, error: 'Rota GeoServices não encontrada.', path });
  } catch (err) {
    if (typeof error === 'function') error(err.stack || err.message || String(err));
    const status = Number(err.status || 500);
    const retryAfterSeconds = Number(err.retryAfterSeconds || err.details?.retryAfterSeconds || 0);
    return sendJson(
      res,
      req,
      status,
      { ok: false, error: err.message || 'Erro interno no GeoServices.', code: err.details?.code || undefined, version: APP_VERSION },
      retryAfterSeconds > 0 ? { 'Retry-After': String(retryAfterSeconds) } : {}
    );
  }
}
