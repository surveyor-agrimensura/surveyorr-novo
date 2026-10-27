const VERSION = '1.0.0-rc.185.74';
// Surveyor 21.11.5: proxy oficial online para SICAR/CAR, CEFIR/INEMA e INCRA/SIGEF/SNCI.

const ALLOWED_HOSTS = new Set([
  'geoserver.inema.ba.gov.br',
  'inema.ba.gov.br',
  'acervofundiario.incra.gov.br',
  'www.acervofundiario.incra.gov.br',
  'pamgia.ibama.gov.br',
  'geo.infrasa.gov.br',
  'geoserver.car.gov.br',
  'map.geo.sei.ba.gov.br',
  'geoserver.funai.gov.br',
  'geoservicos.inde.gov.br',
  'geoservicos.ibge.gov.br',
  'portal.iphan.gov.br',
  'www.snirh.gov.br',
  'snirh.gov.br'
]);

const INTERNAL_QUERY_KEYS = new Set([
  'target',
  'targeturl',
  'url',
  'serviceurl',
  'baseurl',
  'apibaseurl',
  'geobaseurl',
  'geoservicesbaseurl',
  'wmsproxybaseurl',
  'token',
  'accesstoken',
  'authorization',
  '_georural',
  'title',
  'slug',
  'displayname',
  'layertitle'
]);

const CORS_HEADERS = {
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, range',
  'access-control-max-age': '86400',
  'vary': 'Origin'
};

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://surveyorr.com.br',
  'https://www.surveyorr.com.br',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);

function configuredAllowedOrigins(env = {}) {
  const configured = String(env.SURVEYOR_ALLOWED_ORIGINS || env.CORS_ALLOWED_ORIGINS || '')
    .split(',').map((item) => item.trim()).filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function allowedCorsOrigin(request, env = {}) {
  const origin = String(request?.headers?.get?.('Origin') || '').trim();
  if (!origin) return '';
  return configuredAllowedOrigins(env).has(origin) ? origin : '';
}

function withCors(response, request, env = {}) {
  const origin = allowedCorsOrigin(request, env);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
  headers.set('access-control-allow-origin', origin);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function text(data, status = 200, contentType = 'text/plain; charset=utf-8') {
  return new Response(data, {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': contentType,
      'cache-control': 'no-store'
    }
  });
}

function base64UrlDecode(value) {
  const textValue = String(value || '').trim();
  if (!textValue) return '';
  const normalized = textValue.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(textValue.length / 4) * 4, '=');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function isAllowedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (ALLOWED_HOSTS.has(host)) return true;
  return host.endsWith('.inema.ba.gov.br')
    || host === 'acervofundiario.incra.gov.br'
    || host === 'www.acervofundiario.incra.gov.br'
    || host === 'pamgia.ibama.gov.br'
    || host === 'geo.infrasa.gov.br'
    || host === 'geoserver.car.gov.br'
    || host === 'map.geo.sei.ba.gov.br'
    || host === 'geoserver.funai.gov.br'
    || host === 'geoservicos.inde.gov.br'
    || host === 'geoservicos.ibge.gov.br'
    || host === 'portal.iphan.gov.br'
    || host === 'www.snirh.gov.br'
    || host === 'snirh.gov.br';
}

function parseTarget(rawTarget) {
  const value = String(rawTarget || '').trim();
  if (!value) throw new Error('URL de destino ausente.');

  const target = new URL(value);
  target.username = '';
  target.password = '';
  target.hash = '';

  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('Protocolo bloqueado. Use apenas HTTP/HTTPS.');
  }
  if (!isAllowedHost(target.hostname)) {
    throw new Error(`Host não permitido: ${target.hostname}`);
  }
  return target;
}

function normalizeServiceEndpoint(target, kind) {
  const isInema = /(^|\.)inema\.ba\.gov\.br$/i.test(target.hostname);
  if (!isInema) return target;

  const genericGeoServerPath = /^\/(?:wms|wfs|ows|geoserver\/(?:wms|wfs|ows))\/?$/i.test(target.pathname);
  if (!genericGeoServerPath) return target;

  // O endpoint /geoserver/ows é o endpoint oficial usado pelo INEMA para WFS.
  // A versão anterior convertia também WFS para /geoserver/wms, impedindo o
  // fallback vetorial de Assentamentos/PCT. WMS/GetFeatureInfo continuam no
  // endpoint de imagens; WFS permanece no endpoint OWS multiprotocolo.
  target.pathname = kind === 'wfs' ? '/geoserver/ows' : '/geoserver/wms';
  return target;
}

function targetFromRequest(request, kind) {
  const requestUrl = new URL(request.url);
  const path = requestUrl.pathname;
  const encodedMatch = path.match(/\/(?:api\/geoservices\/)?(?:wms|wfs|info)-url\/([^/?#]+)/i);

  let rawTarget = '';
  if (encodedMatch) {
    rawTarget = base64UrlDecode(encodedMatch[1]);
  } else {
    rawTarget = requestUrl.searchParams.get('target')
      || requestUrl.searchParams.get('targetUrl')
      || requestUrl.searchParams.get('url')
      || requestUrl.searchParams.get('serviceUrl')
      || requestUrl.searchParams.get('baseUrl')
      || '';
  }

  const target = normalizeServiceEndpoint(parseTarget(rawTarget), kind);

  // Quando o Leaflet monta /wms?target=<base>&LAYERS=...&BBOX=..., os parâmetros
  // reais do WMS vêm na query externa. Copiamos tudo para a URL final, exceto
  // chaves internas do GeoRural.
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (INTERNAL_QUERY_KEYS.has(String(key || '').toLowerCase())) continue;
    target.searchParams.set(key, value);
  }

  if (kind === 'wms') {
    if (!target.searchParams.has('SERVICE')) target.searchParams.set('SERVICE', 'WMS');
    if (!target.searchParams.has('service')) target.searchParams.set('service', 'WMS');
  }
  if (kind === 'wfs') {
    if (!target.searchParams.has('SERVICE')) target.searchParams.set('SERVICE', 'WFS');
    if (!target.searchParams.has('service')) target.searchParams.set('service', 'WFS');
  }

  return target;
}

function upstreamCandidates(target, env = {}, options = {}) {
  const candidates = [];
  const add = (url) => {
    const value = url.toString();
    if (!candidates.includes(value)) candidates.push(value);
  };
  const allowInsecureHttp = String(env.GEOSERVICES_ALLOW_INSECURE_HTTP || 'false').toLowerCase() === 'true';
  const isInemaPublicGeoService = /(^|\.)inema\.ba\.gov\.br$/i.test(target.hostname);
  const isIncraAcervoOgc = /(^|\.)acervofundiario\.incra\.gov\.br$/i.test(target.hostname)
    && /^\/i3geo\/ogc\.php$/i.test(target.pathname);
  const allowAutomaticInemaHttp = options.allowAutomaticInemaHttp !== false;
  const allowAutomaticIncraHttp = options.allowAutomaticIncraHttp !== false;
  const httpsTarget = new URL(target.toString());
  httpsTarget.protocol = 'https:';
  add(httpsTarget);

  if (target.protocol === 'https:') add(target);

  // Alguns geosserviços públicos legados ainda expõem OGC de forma mais
  // estável em HTTP. O navegador continua falando SOMENTE HTTPS com este
  // Worker; a tentativa HTTP ocorre server-to-server e apenas para hosts e
  // caminhos oficiais previamente allowlisted (INEMA e OGC do Acervo/INCRA),
  // sem cookies nem cabeçalhos de autorização do usuário.
  const allowOfficialHttpFallback = (allowAutomaticInemaHttp && isInemaPublicGeoService)
    || (allowAutomaticIncraHttp && isIncraAcervoOgc);
  if (allowInsecureHttp || allowOfficialHttpFallback) {
    const httpFallback = new URL(target.toString());
    httpFallback.protocol = 'http:';
    add(httpFallback);
  }
  return candidates;
}

async function fetchWithTimeout(url, request, timeoutMs = 90000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const headers = new Headers();
    const accept = request.headers.get('accept');
    const range = request.headers.get('range');
    if (accept) headers.set('accept', accept);
    if (range) headers.set('range', range);
    headers.set('user-agent', 'Surveyor-GeoServices-Cloudflare/2.22.0');

    return await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
      cf: {
        cacheEverything: false,
        cacheTtl: 0
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function requestOperation(target) {
  return String(target.searchParams.get('REQUEST') || target.searchParams.get('request') || '').trim().toUpperCase();
}

function isLiveCefirPropertyBoundaryRequest(target) {
  const layerText = [
    target.searchParams.get('LAYERS'),
    target.searchParams.get('layers'),
    target.searchParams.get('TYPENAME'),
    target.searchParams.get('typeName'),
    target.searchParams.get('typenames')
  ].filter(Boolean).join(',').toLowerCase();
  return layerText.includes('cefir_imovel_rural_limite_inema');
}

function proxyCacheTtlSeconds(target, kind) {
  const operation = requestOperation(target);
  // Limites CEFIR são cadastro vivo. Consultas vetoriais/atributos continuam
  // sem cache, mas tiles GetMap podem ser reutilizados por poucos segundos.
  // Isso reduz o atraso ao repetir zoom/pan sem esconder atualizações cadastrais.
  if (isLiveCefirPropertyBoundaryRequest(target)) {
    if (kind === 'wms' && operation === 'GETMAP') return 45;
    return 0;
  }
  if (operation === 'GETCAPABILITIES') return 6 * 60 * 60;
  if (kind === 'wms' && operation === 'GETMAP') return 10 * 60;
  if (kind === 'info' || operation === 'GETFEATUREINFO') return 5 * 60;
  if (kind === 'wfs' && operation === 'GETFEATURE') return 15 * 60;
  return 0;
}

async function cachedProxyResponse(request, target, kind) {
  const ttl = proxyCacheTtlSeconds(target, kind);
  if (!ttl || request.headers.get('range')) return null;
  try {
    const cache = caches.default;
    const hit = await cache.match(request);
    if (!hit) return null;
    const headers = new Headers(hit.headers);
    headers.set('x-georural-cache', 'HIT');
    headers.set('x-georural-version', VERSION);
    return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
  } catch {
    return null;
  }
}

function storeProxyResponse(request, response, target, kind, ctx) {
  const ttl = proxyCacheTtlSeconds(target, kind);
  if (!ttl || request.headers.get('range') || response.status !== 200) return;
  try {
    const headers = new Headers(response.headers);
    headers.set('cache-control', `public, max-age=${ttl}`);
    headers.set('x-georural-cache', 'MISS');
    const cached = new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers });
    const task = caches.default.put(request, cached);
    if (ctx?.waitUntil) ctx.waitUntil(task);
    else void task.catch(() => {});
  } catch {
    // cache é apenas contingência; nunca bloqueia a consulta principal
  }
}


const CAPABILITIES_TTL_MS = 6 * 60 * 60 * 1000;
const capabilitiesMemory = new Map();

function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .trim();
}

function normalizedLayerText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b(?:geobahia|inema|remoto|camada|base|oficial|vetor|raster)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function layerTokens(value) {
  const ignored = new Set(['a', 'as', 'o', 'os', 'de', 'da', 'das', 'do', 'dos', 'e', 'em', 'para', 'por', 'bahia', 'estado', 'dados']);
  return normalizedLayerText(value).split(' ')
    .map((token) => token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token)
    .filter((token) => token.length > 1 && !ignored.has(token));
}

function parseNumberList(value) {
  const values = String(value || '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  return values.length >= 4 ? values.slice(0, 4) : null;
}

function parseWfsCapabilities(xml) {
  const entries = [];
  const blockPattern = /<(?:\w+:)?FeatureType\b[^>]*>([\s\S]*?)<\/(?:\w+:)?FeatureType>/gi;
  let match;
  while ((match = blockPattern.exec(String(xml || '')))) {
    const block = match[1];
    const name = decodeXml(block.match(/<(?:\w+:)?Name\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Name>/i)?.[1]);
    if (!name) continue;
    const title = decodeXml(block.match(/<(?:\w+:)?Title\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Title>/i)?.[1]) || name;
    let bbox = null;
    const lower = block.match(/<(?:\w+:)?LowerCorner\b[^>]*>([\s\S]*?)<\/(?:\w+:)?LowerCorner>/i)?.[1];
    const upper = block.match(/<(?:\w+:)?UpperCorner\b[^>]*>([\s\S]*?)<\/(?:\w+:)?UpperCorner>/i)?.[1];
    if (lower && upper) {
      const low = String(lower).trim().split(/\s+/).map(Number);
      const high = String(upper).trim().split(/\s+/).map(Number);
      if (low.length >= 2 && high.length >= 2 && [...low.slice(0, 2), ...high.slice(0, 2)].every(Number.isFinite)) {
        bbox = [low[0], low[1], high[0], high[1]];
      }
    }
    if (!bbox) {
      const latLon = block.match(/<(?:\w+:)?LatLongBoundingBox\b([^>]*)\/?\s*>/i)?.[1] || '';
      const attrs = Object.fromEntries([...latLon.matchAll(/(minx|miny|maxx|maxy)=["']([^"']+)["']/gi)].map((item) => [item[1].toLowerCase(), Number(item[2])]));
      if ([attrs.minx, attrs.miny, attrs.maxx, attrs.maxy].every(Number.isFinite)) bbox = [attrs.minx, attrs.miny, attrs.maxx, attrs.maxy];
    }
    entries.push({ name, title, bbox, service: 'wfs' });
  }
  return entries;
}

function parseWmsCapabilities(xml) {
  const entries = [];
  const layerStack = [];
  const tagStack = [];
  let capture = null;
  const tokens = String(xml || '').match(/<[^>]+>|[^<]+/g) || [];
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      if (capture) capture.text += token;
      continue;
    }
    if (/^<\?/.test(token) || /^<!/.test(token)) continue;
    const close = token.match(/^<\/\s*(?:\w+:)?([\w-]+)/);
    if (close) {
      const tag = close[1].toLowerCase();
      if (capture && capture.tag === tag) {
        const current = layerStack[layerStack.length - 1];
        if (current) {
          if (['west','south','east','north'].includes(capture.field)) {
            current.__geo ||= {};
            current.__geo[capture.field] = Number(decodeXml(capture.text));
            const g = current.__geo;
            if ([g.west,g.south,g.east,g.north].every(Number.isFinite)) current.bbox = [g.west,g.south,g.east,g.north];
          } else current[capture.field] = decodeXml(capture.text);
        }
        capture = null;
      }
      while (tagStack.length && tagStack[tagStack.length - 1] !== tag) tagStack.pop();
      if (tagStack[tagStack.length - 1] === tag) tagStack.pop();
      if (tag === 'layer') {
        const current = layerStack.pop();
        if (current?.name) entries.push({ ...current, service: 'wms' });
      }
      continue;
    }
    const open = token.match(/^<\s*(?:\w+:)?([\w-]+)([^>]*)>/);
    if (!open) continue;
    const tag = open[1].toLowerCase();
    const attrsText = open[2] || '';
    const parent = tagStack[tagStack.length - 1] || '';
    const selfClosing = /\/\s*>$/.test(token);
    if (tag === 'layer') layerStack.push({ name: '', title: '', bbox: null });
    const current = layerStack[layerStack.length - 1];
    if (current && parent === 'layer' && (tag === 'name' || tag === 'title')) {
      capture = { tag, field: tag, text: '' };
    }
    if (current && tag === 'latlonboundingbox') {
      const attrs = Object.fromEntries([...attrsText.matchAll(/(minx|miny|maxx|maxy)=["']([^"']+)["']/gi)].map((item) => [item[1].toLowerCase(), Number(item[2])]));
      if ([attrs.minx, attrs.miny, attrs.maxx, attrs.maxy].every(Number.isFinite)) current.bbox = [attrs.minx, attrs.miny, attrs.maxx, attrs.maxy];
    }
    if (current && parent === 'ex_geographicboundingbox') {
      const fields = { westboundlongitude:'west', southboundlatitude:'south', eastboundlongitude:'east', northboundlatitude:'north' };
      if (fields[tag]) capture = { tag, field: fields[tag], text: '' };
    }
    if (!selfClosing) tagStack.push(tag);
  }
  return entries;
}

function shortLayerName(value) {
  return String(value || '').trim().split(':').pop();
}

function similarityScore(entry, queries) {
  const candidateValues = [entry.name, shortLayerName(entry.name), entry.title].filter(Boolean);
  let best = 0;
  for (const query of queries.filter(Boolean)) {
    const qNorm = normalizedLayerText(query);
    const qTokens = new Set(layerTokens(query));
    if (!qNorm) continue;
    for (const candidate of candidateValues) {
      const cNorm = normalizedLayerText(candidate);
      if (!cNorm) continue;
      if (qNorm === cNorm) best = Math.max(best, 1);
      if (qNorm.includes(cNorm) || cNorm.includes(qNorm)) best = Math.max(best, 0.88);
      const cTokens = new Set(layerTokens(candidate));
      const intersection = [...qTokens].filter((token) => cTokens.has(token)).length;
      const union = new Set([...qTokens, ...cTokens]).size || 1;
      const jaccard = intersection / union;
      const coverage = intersection / Math.max(1, Math.min(qTokens.size, cTokens.size));
      const score = (jaccard * 0.55) + (coverage * 0.45);
      if (intersection >= 2 || (intersection === 1 && Math.min(qTokens.size, cTokens.size) === 1)) best = Math.max(best, score);
    }
  }
  return best;
}

function resolveEntry(entries, requested, title, slug, aliases = []) {
  const requestedFull = String(requested || '').trim();
  const aliasList = [...new Set([requestedFull, ...(aliases || [])].map((value) => String(value || '').trim()).filter(Boolean))];
  const requestedNames = aliasList.flatMap((value) => [value, shortLayerName(value)]).filter(Boolean);
  const normalizedNames = new Set(requestedNames.map(normalizedLayerText));
  const exact = entries.find((entry) => requestedNames.includes(entry.name))
    || entries.find((entry) => requestedNames.includes(shortLayerName(entry.name)))
    || entries.find((entry) => normalizedNames.has(normalizedLayerText(entry.name)))
    || entries.find((entry) => normalizedNames.has(normalizedLayerText(shortLayerName(entry.name))));
  if (exact) return { entry: exact, score: 1 };
  const queries = [...requestedNames, title, slug];
  let winner = null;
  let winnerScore = 0;
  let runnerUpScore = 0;
  for (const entry of entries) {
    const candidateScore = similarityScore(entry, queries);
    if (candidateScore > winnerScore) {
      runnerUpScore = winnerScore;
      winner = entry;
      winnerScore = candidateScore;
    } else if (candidateScore > runnerUpScore) {
      runnerUpScore = candidateScore;
    }
  }
  const unambiguousFuzzy = winnerScore >= 0.52 && (winnerScore - runnerUpScore >= 0.10);
  return (winnerScore >= 0.62 || unambiguousFuzzy)
    ? { entry: winner, score: winnerScore }
    : { entry: null, score: winnerScore };
}

function capabilitiesUrl(target, service, version = '') {
  const url = normalizeServiceEndpoint(new URL(target.toString()), service === 'WFS' ? 'wfs' : 'wms');
  url.search = '';
  url.searchParams.set('SERVICE', service);
  url.searchParams.set('REQUEST', 'GetCapabilities');
  url.searchParams.set('VERSION', version || (service === 'WFS' ? '1.1.0' : '1.1.1'));
  return url;
}

async function loadCapabilities(target, service, request) {
  const key = `${target.hostname}${target.pathname}|${service}`;
  const cached = capabilitiesMemory.get(key);
  if (cached && Date.now() - cached.createdAt < CAPABILITIES_TTL_MS) return cached.entries;
  const errors = [];
  const versions = service === 'WFS' ? ['1.1.0', '1.0.0'] : ['1.1.1', '1.3.0'];
  async function tryCapabilityCandidate(candidate, version) {
    try {
      const response = await fetchWithTimeout(candidate, request, 45_000);
      const textValue = await response.text();
      if (!response.ok || !/<(?:\w+:)?(?:WFS_Capabilities|WMS_Capabilities|WMT_MS_Capabilities)\b/i.test(textValue)) {
        errors.push(`${new URL(candidate).protocol}//${new URL(candidate).host} ${service} ${version}: resposta de capacidades inválida`);
        return null;
      }
      const entries = service === 'WFS' ? parseWfsCapabilities(textValue) : parseWmsCapabilities(textValue);
      if (!entries.length) {
        errors.push(`${new URL(candidate).protocol}//${new URL(candidate).host} ${service} ${version}: catálogo sem camadas legíveis`);
        return null;
      }
      capabilitiesMemory.set(key, { createdAt: Date.now(), entries });
      return entries;
    } catch (error) {
      errors.push(`${new URL(candidate).protocol}//${new URL(candidate).host} ${service} ${version}: ${error?.message || String(error)}`);
      return null;
    }
  }

  // Primeiro preserva a ordem de fallback entre versões usando HTTPS.
  // Isso mantém WFS 1.1.0 -> 1.0.0 e WMS 1.1.1 -> 1.3.0.
  for (const version of versions) {
    const capabilityTarget = capabilitiesUrl(target, service, version);
    for (const candidate of upstreamCandidates(capabilityTarget, {}, { allowAutomaticInemaHttp: false })) {
      const entries = await tryCapabilityCandidate(candidate, version);
      if (entries) return entries;
    }
  }

  // Se o TLS público do INEMA falhar em todas as versões, tenta HTTP apenas
  // server-to-server e somente para o host INEMA allowlisted.
  if (/(^|\.)inema\.ba\.gov\.br$/i.test(target.hostname)) {
    for (const version of versions) {
      const capabilityTarget = capabilitiesUrl(target, service, version);
      capabilityTarget.protocol = 'http:';
      const entries = await tryCapabilityCandidate(capabilityTarget, version);
      if (entries) return entries;
    }
  }

  throw new Error(errors.slice(0, 6).join(' | ') || `Não foi possível consultar capacidades ${service}.`);
}

async function resolveLayerRequest(request) {
  const url = new URL(request.url);
  const requested = String(url.searchParams.get('layer') || url.searchParams.get('layers') || '').trim();
  const title = String(url.searchParams.get('title') || url.searchParams.get('displayName') || '').trim();
  const slug = String(url.searchParams.get('slug') || '').trim();
  const aliases = [
    ...url.searchParams.getAll('alias'),
    ...String(url.searchParams.get('aliases') || '').split(',')
  ].map((value) => String(value || '').trim()).filter(Boolean).slice(0, 48);
  const requestedMinScore = Number(url.searchParams.get('minScore'));
  const minScore = Number.isFinite(requestedMinScore)
    ? Math.max(0, Math.min(1, requestedMinScore))
    : 0;
  let target;
  try {
    target = parseTarget(url.searchParams.get('target') || url.searchParams.get('url') || '');
  } catch (error) {
    return json({ ok: false, error: error.message }, 400);
  }
  if (!requested) return json({ ok: false, error: 'Nome técnico da camada ausente.' }, 400);

  const diagnostics = [];
  try {
    const entries = await loadCapabilities(target, 'WFS', request);
    const match = resolveEntry(entries, requested, title, slug, aliases);
    diagnostics.push({ service: 'WFS', entries: entries.length, score: Number(match.score.toFixed(3)) });
    if (match.entry && match.score >= minScore) {
      return json({
        ok: true,
        resolved: true,
        service: 'wfs',
        layerName: match.entry.name,
        title: match.entry.title,
        bbox: match.entry.bbox,
        score: match.score,
        source: 'WFS GetCapabilities',
        diagnostics
      });
    }
  } catch (error) {
    diagnostics.push({ service: 'WFS', error: error?.message || String(error) });
  }

  try {
    const entries = await loadCapabilities(target, 'WMS', request);
    const match = resolveEntry(entries, requested, title, slug, aliases);
    diagnostics.push({ service: 'WMS', entries: entries.length, score: Number(match.score.toFixed(3)) });
    if (match.entry && match.score >= minScore) {
      return json({
        ok: true,
        resolved: true,
        service: 'wms-only',
        layerName: match.entry.name,
        title: match.entry.title,
        bbox: match.entry.bbox,
        score: match.score,
        source: 'WMS GetCapabilities',
        diagnostics
      });
    }
  } catch (error) {
    diagnostics.push({ service: 'WMS', error: error?.message || String(error) });
  }

  return json({
    ok: true,
    resolved: false,
    service: /^Raster_/i.test(requested) ? 'wms-only' : 'unknown',
    layerName: requested,
    title: title || requested,
    bbox: null,
    source: 'configured-name-fallback',
    diagnostics,
    minScore
  });
}

async function validateUpstreamResponse(upstream, target, kind) {
  const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
  const operation = requestOperation(target);

  if (!upstream.ok) {
    const detail = await upstream.clone().text().catch(() => '');
    return {
      valid: false,
      reason: `HTTP ${upstream.status}${detail ? `: ${detail.slice(0, 220).replace(/\s+/g, ' ')}` : ''}`
    };
  }

  if (kind === 'wms' && operation === 'GETMAP' && !contentType.startsWith('image/')) {
    const detail = await upstream.clone().text().catch(() => '');
    return {
      valid: false,
      reason: `GetMap retornou ${contentType || 'conteúdo sem tipo'} em vez de imagem${detail ? `: ${detail.slice(0, 220).replace(/\s+/g, ' ')}` : ''}`
    };
  }

  if (kind === 'wfs' && operation === 'GETFEATURE') {
    const outputFormat = String(target.searchParams.get('OUTPUTFORMAT') || target.searchParams.get('outputFormat') || '').toLowerCase();
    const expectsJson = outputFormat.includes('json');
    if (expectsJson && !/(?:application|text)\/(?:geo\+)?json/i.test(contentType)) {
      const detail = await upstream.clone().text().catch(() => '');
      const looksJson = /^\s*[\[{]/.test(detail);
      if (!looksJson) {
        return {
          valid: false,
          reason: `GetFeature retornou ${contentType || 'conteúdo sem tipo'} em vez de GeoJSON${detail ? `: ${detail.slice(0, 220).replace(/\s+/g, ' ')}` : ''}`
        };
      }
    }
  }

  return { valid: true };
}

async function proxy(request, kind, env = {}, ctx = null) {
  let target;
  try {
    target = targetFromRequest(request, kind);
  } catch (error) {
    return json({ ok: false, error: error.message, service: 'GeoRural GeoServices Cloudflare Worker' }, 400);
  }

  const cached = await cachedProxyResponse(request, target, kind);
  if (cached) return cached;

  const attempts = [];
  for (const candidate of upstreamCandidates(target, env)) {
    try {
      const upstream = await fetchWithTimeout(candidate, request, 90000);
      const validation = await validateUpstreamResponse(upstream, target, kind);
      if (!validation.valid) {
        attempts.push(`${new URL(candidate).protocol}//${new URL(candidate).host}: ${validation.reason}`);
        continue;
      }

      const headers = new Headers(upstream.headers);
      const corsOrigin = allowedCorsOrigin(request, env);
      if (corsOrigin) headers.set('access-control-allow-origin', corsOrigin);
      else headers.delete('access-control-allow-origin');
      headers.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
      headers.set('access-control-allow-headers', 'content-type, accept, range');
      headers.set('vary', 'Origin');
      headers.set('x-georural-geoservices', 'cloudflare-worker');
      headers.set('x-georural-version', VERSION);
      headers.set('x-georural-upstream', new URL(candidate).hostname);
      headers.set('x-georural-upstream-protocol', new URL(candidate).protocol.replace(':', ''));
      headers.delete('content-security-policy');
      headers.delete('x-frame-options');
      headers.delete('set-cookie');

      if (isLiveCefirPropertyBoundaryRequest(target)) {
        headers.set('cache-control', 'no-store, no-cache, must-revalidate');
        headers.set('pragma', 'no-cache');
        headers.set('expires', '0');
      } else if (!headers.has('cache-control')) {
        const contentType = headers.get('content-type') || '';
        headers.set('cache-control', /image\//i.test(contentType) ? 'public, max-age=60' : 'no-store');
      }

      const response = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers
      });
      storeProxyResponse(request, response, target, kind, ctx);
      return response;
    } catch (error) {
      attempts.push(`${new URL(candidate).protocol}//${new URL(candidate).host}: ${error?.message || String(error)}`);
    }
  }

  return json({
    ok: false,
    error: 'Falha ao consultar o serviço externo.',
    detail: attempts.slice(0, 4).join(' | '),
    operation: requestOperation(target) || null,
    targetHost: target.hostname,
    targetPath: target.pathname,
    service: 'GeoRural GeoServices Cloudflare Worker'
  }, 502);
}

function detectKind(pathname) {
  if (/\/wfs(?:-|\/|$)|\/wfs-url\//i.test(pathname)) return 'wfs';
  if (/\/info(?:-|\/|$)|\/info-url\//i.test(pathname)) return 'info';
  return 'wms';
}

export default {
  async fetch(request, env = {}, ctx = null) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      const origin = allowedCorsOrigin(request, env);
      if (!origin) return new Response(null, { status: 403, headers: { 'cache-control': 'no-store' } });
      return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'access-control-allow-origin': origin } });
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      return json({ ok: false, error: 'Método não permitido.' }, 405);
    }

    if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'GeoRural GeoServices Cloudflare Worker',
        status: 'ready',
        version: VERSION,
        root: '/',
        colo: request.cf?.colo || null,
        country: request.cf?.country || null,
        allowedHosts: Array.from(ALLOWED_HOSTS),
        upstreamStrategy: 'Cloudflare Worker unificado: INEMA/GeoBahia + INCRA/SIGEF/SNCI',
        routes: ['/resolve?target=<url>&layer=<name>&title=<title>', '/wms-url/<payload>', '/wfs-url/<payload>', '/info-url/<payload>', '/wms?target=<url>', '/wfs?target=<url>']
      });
    }

    if (url.pathname === '/resolve' || url.pathname === '/api/geoservices/resolve') {
      return withCors(await resolveLayerRequest(request), request, env);
    }

    if (/\/(?:api\/geoservices\/)?(?:wms|wfs|info)(?:-url\/|\?|$)/i.test(url.pathname)) {
      return withCors(await proxy(request, detectKind(url.pathname), env, ctx), request, env);
    }

    return text('GeoRural GeoServices Cloudflare Worker OK. Use /health, /wms-url/<payload>, /wfs-url/<payload>.', 404);
  }
};
