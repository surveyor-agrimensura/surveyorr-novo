(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SICAR_WFS = 'https://geoserver.car.gov.br/geoserver/sicar/ows';
  const SICAR_WMS = 'https://geoserver.car.gov.br/geoserver/sicar/wms';
  const CEFIR_WFS = 'https://geoserver.inema.ba.gov.br/geoserver/ows';
  const IBGE_MUNICIPIOS_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/BA/municipios';
  const MAX_MUNICIPIO_RESULTS = 500;
  const SUPPORTED_UF = 'BA';
  const stateIndexCache = new Map();
  const geometryCache = new Map();

  let mode = 'registro';
  let map = null;
  let resultLayer = null;
  let resultHaloLayer = null;
  let selectedWmsLayer = null;
  let selectedMarker = null;
  let selectedPulse = null;
  let ruralPropertiesLayer = null;
  let satelliteLayer = null;
  let streetLayer = null;
  let layerControl = null;
  let customLayerControl = null;
  let currentItems = [];
  let geometryRequestToken = 0;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function toast(message, type = 'info') {
    if (window.SurveyorToast) return window.SurveyorToast(message, type);
    const host = $('suiteToast');
    if (!host) return;
    host.textContent = message;
    host.className = `toast show ${type}`;
    window.setTimeout(() => { host.className = 'toast'; }, type === 'error' ? 5000 : 3000);
  }

  function setDataState(state, text) {
    const node = $('consultaCarApiState');
    if (!node) return;
    node.dataset.state = state;
    node.innerHTML = `<span></span>${escapeHtml(text)}`;
  }

  function setGeometryState(state, text) {
    const node = $('consultaCarGeometryState');
    if (!node) return;
    node.dataset.state = state;
    node.textContent = text;
  }

  function normalizeText(value) {
    return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

  function parseCar(value) {
    const clean = String(value || '').trim().toUpperCase();
    const match = clean.match(/^([A-Z]{2})-(\d{7})-([A-F0-9]{32})$/i);
    if (!match) return null;
    return { car: clean, uf: match[1].toUpperCase(), municipioCodigo: match[2] };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function getStateIndex(uf) {
    const state = String(uf || '').trim().toUpperCase();
    if (!state) throw new Error('UF não informada.');
    if (state !== SUPPORTED_UF) throw new Error('No momento, a Consulta CAR do Surveyor está disponível para a Bahia.');
    if (stateIndexCache.has(state)) return stateIndexCache.get(state);

    const response = await fetch(IBGE_MUNICIPIOS_URL, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`IBGE indisponível (HTTP ${response.status}).`);
    const payload = await response.json();
    const municipalities = (Array.isArray(payload) ? payload : [])
      .map((item) => ({ codigo: String(item?.id || ''), nome: String(item?.nome || '').trim() }))
      .filter((item) => item.codigo && item.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const byCode = new Map(municipalities.map((item) => [String(item.codigo), item]));
    const byName = new Map(municipalities.map((item) => [normalizeText(item.nome), item]));
    const index = { municipalities, byCode, byName, source: 'IBGE oficial' };
    stateIndexCache.set(state, index);
    return index;
  }

  function formatNumber(value, suffix = '') {
    if (value === undefined || value === null || value === '') return '—';
    const number = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(number)) return String(value);
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(number)}${suffix}`;
  }

  function formatCompact(value, suffix = '') {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    if (Math.abs(number) < 10000) return `${formatNumber(number)}${suffix}`;
    try {
      return `${new Intl.NumberFormat('pt-BR', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 2
      }).format(number)}${suffix}`;
    } catch {
      return `${formatNumber(number)}${suffix}`;
    }
  }

  function formatDateBR(value) {
    if (!value) return '—';
    const raw = String(value).trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return raw;
  }

  function statusLabel(code) {
    const labels = {
      AT: 'Cadastro ativo',
      PE: 'Cadastro pendente',
      CA: 'Cadastro cancelado',
      SU: 'Cadastro suspenso',
      RE: 'Cadastro retificado'
    };
    return labels[String(code || '').toUpperCase()] || 'Cadastro público';
  }

  function typeLabel(code) {
    const labels = {
      IRU: 'Imóvel',
      AST: 'Assentamento',
      PCT: 'Povos e comunidades tradicionais'
    };
    return labels[String(code || '').toUpperCase()] || String(code || 'Não informado');
  }

  function renderStatsValues(stats = {}) {
    $('carStatImoveis').textContent = formatNumber(stats.imoveis);
    const areaImoveis = $('carStatAreaImoveis');
    if (areaImoveis) areaImoveis.textContent = `${formatNumber(stats.area_imovel_ha)} ha cadastrados`;
    $('carStatReserva').textContent = `${formatNumber(stats.reserva_legal_ha)} ha`;
    $('carStatApp').textContent = `${formatNumber(stats.app_ha)} ha`;
    $('carStatVegetacao').textContent = `${formatNumber(stats.vegetacao_nativa_ha)} ha`;
    $('carStatConsolidada').textContent = `${formatNumber(stats.area_consolidada_ha)} ha`;
  }

  async function loadInitialStats() {
    // A versão online não mantém mais os 416 JSONL municipais dentro do
    // aplicativo. Os indicadores agregados antigos dependiam desse pacote
    // local e poderiam ficar defasados; por isso são ocultados em vez de
    // exibir números estáticos como se fossem dados ao vivo.
    const head = document.querySelector('.consulta-car-overview-head');
    const stats = document.querySelector('.consulta-car-stats');
    if (head) head.hidden = true;
    if (stats) stats.hidden = true;
  }

  async function loadMunicipalities(uf) {
    const datalist = $('consultaCarMunicipios');
    if (!datalist) return;
    datalist.innerHTML = '';
    if (!uf) return;
    try {
      const index = await getStateIndex(uf);
      index.municipalities.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.nome;
        option.dataset.code = item.codigo;
        datalist.appendChild(option);
      });
    } catch {
    }
  }

  // Os registros de imóveis são consultados exclusivamente nos serviços oficiais.


  function geoserviceBase() {
    return String(window.GEORURAL_CONFIG?.geoservicesBaseUrl || window.GEORURAL_GEOSERVICES_URL || '').replace(/\/+$/, '');
  }

  function base64UrlEncode(value) {
    const bytes = new TextEncoder().encode(String(value || ''));
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function officialSicarProxyUrl(upstream) {
    const base = geoserviceBase();
    const url = base ? `${base}/wfs-url/${base64UrlEncode(upstream)}` : '';
    return url && typeof window.GEORURAL_SECURE_GEOSERVICES_URL === 'function' ? window.GEORURAL_SECURE_GEOSERVICES_URL(url) : url;
  }

  function officialSicarWmsProxyUrl(upstream) {
    const base = geoserviceBase();
    const url = base ? `${base}/wms-url/${base64UrlEncode(upstream)}` : upstream;
    return base && typeof window.GEORURAL_SECURE_GEOSERVICES_URL === 'function' ? window.GEORURAL_SECURE_GEOSERVICES_URL(url) : url;
  }

  function officialInfoProxyUrl(upstream) {
    const base = geoserviceBase();
    const url = base ? `${base}/info-url/${base64UrlEncode(upstream)}` : upstream;
    return base && typeof window.GEORURAL_SECURE_GEOSERVICES_URL === 'function' ? window.GEORURAL_SECURE_GEOSERVICES_URL(url) : url;
  }

  function officialIncraInfoCandidateUrls(upstream) {
    const direct = String(upstream || '').trim();
    const proxy = officialInfoProxyUrl(direct);
    // Tenta o INCRA diretamente pelo navegador primeiro. Se o servidor não
    // liberar CORS ou a rota direta falhar, usa o Worker como contingência.
    return [...new Set([direct, proxy].filter(Boolean))];
  }

  function officialSicarSearchUrl({ uf = SUPPORTED_UF, cql = '', maxFeatures = MAX_MUNICIPIO_RESULTS } = {}) {
    const params = new URLSearchParams({
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: sicarTypeName(uf),
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      maxFeatures: String(Math.max(1, Math.min(1000, Number(maxFeatures) || MAX_MUNICIPIO_RESULTS)))
    });
    if (cql) params.set('CQL_FILTER', cql);
    return `${SICAR_WFS}?${params.toString()}`;
  }

  async function fetchOfficialSicarFeatures(upstreamUrl) {
    const urls = [officialSicarProxyUrl(upstreamUrl), upstreamUrl].filter(Boolean);
    const errors = [];
    for (let i = 0; i < urls.length; i += 1) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), i === 0 ? 26000 : 14000);
      try {
        const response = await fetch(urls[i], {
          cache: 'no-store',
          mode: 'cors',
          signal: controller.signal,
          headers: { Accept: 'application/geo+json,application/json;q=0.9,*/*;q=0.2' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload?.features)) throw new Error('Resposta WFS sem coleção de feições.');
        return payload.features;
      } catch (error) {
        errors.push(error?.name === 'AbortError' ? 'tempo limite' : (error?.message || String(error)));
      } finally {
        window.clearTimeout(timer);
      }
    }
    throw new Error(`SICAR/WFS oficial indisponível (${errors.slice(0, 2).join(' / ')}).`);
  }

  function featureProperty(properties, ...names) {
    const source = properties && typeof properties === 'object' ? properties : {};
    const lower = new Map(Object.entries(source).map(([key, value]) => [String(key).toLowerCase(), value]));
    for (const name of names) {
      const key = String(name || '').toLowerCase();
      if (lower.has(key) && lower.get(key) !== undefined && lower.get(key) !== null && lower.get(key) !== '') return lower.get(key);
    }
    return null;
  }

  function optionalNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(String(value).replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  }

  function officialPropertyValue(properties, aliases = []) {
    return featureProperty(properties, ...aliases);
  }

  function normalizeOfficialFieldKey(key = '') {
    return String(key || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function normalizeOfficialCarCode(value = '') {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function semanticOfficialValue(properties = {}, kind = '') {
    const entries = Object.entries(properties || {}).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
    const patterns = kind === 'owner'
      ? [/(^|_)(nome_?)?(propriet|proprietario|titular|detentor|possuidor|posseiro|ocupante|requerente|beneficiario)(_|$)/]
      : kind === 'propertyName'
        ? [/(^|_)(nome|nom|nm)?_?(imovel|area|fazenda|sitio|propriedade|estabelecimento)(_|$)/, /(^|_)denominac(a|ã)o(_|$)/]
        : kind === 'municipality'
          ? [/(^|_)(municipio|nome_municipio|nom_munici|nommun)(_|$)/]
          : [];
    for (const [key, value] of entries) {
      const normalized = normalizeOfficialFieldKey(key);
      if (kind === 'owner' && /responsavel_tecnico|resp_tecnico|cadastrante|nome_rt|tecnico/.test(normalized)) continue;
      if (patterns.some((pattern) => pattern.test(normalized))) return value;
    }
    return null;
  }

  function officialFeatureMatchesCar(feature, car) {
    const target = normalizeOfficialCarCode(car);
    if (!target) return false;
    return Object.values(feature?.properties || {}).some((value) => {
      if (value === undefined || value === null || typeof value === 'object') return false;
      return normalizeOfficialCarCode(value) === target;
    });
  }

  function bboxOverlapScore(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return 0;
    const left = Math.max(Number(a[0]), Number(b[0]));
    const bottom = Math.max(Number(a[1]), Number(b[1]));
    const right = Math.min(Number(a[2]), Number(b[2]));
    const top = Math.min(Number(a[3]), Number(b[3]));
    if (![left, bottom, right, top].every(Number.isFinite) || right <= left || top <= bottom) return 0;
    const overlap = (right - left) * (top - bottom);
    const areaA = Math.max(1e-12, (Number(a[2]) - Number(a[0])) * (Number(a[3]) - Number(a[1])));
    return overlap / areaA;
  }

  function geometryBbox(geometry) {
    const coords = geometry?.coordinates;
    if (!coords) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const walk = (value) => {
      if (!Array.isArray(value)) return;
      if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) && !Array.isArray(value[0])) {
        const x = Number(value[0]), y = Number(value[1]);
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        return;
      }
      value.forEach(walk);
    };
    walk(coords);
    return [minX, minY, maxX, maxY].every(Number.isFinite) ? [minX, minY, maxX, maxY] : null;
  }

  function mergeOfficialProperties(...sets) {
    const merged = {};
    sets.filter(Boolean).forEach((set) => {
      Object.entries(set || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || String(value).trim() === '') return;
        if (!(key in merged)) merged[key] = value;
      });
    });
    return merged;
  }

  async function fetchOfficialCefirProperties(car, geometry = null) {
    if (!car) return null;
    const targetCar = normalizeOfficialCarCode(car);
    const escaped = targetCar.replace(/'/g, "''");
    const common = {
      SERVICE: 'WFS', VERSION: '1.0.0', REQUEST: 'GetFeature',
      TYPENAME: 'Vetor_Recortes_Tematicos:cefir_imovel_rural_limite_inema',
      OUTPUTFORMAT: 'application/json', SRSNAME: 'EPSG:4326', MAXFEATURES: '20'
    };
    const requests = [];
    [
      'cod_imovel', 'codigo_imovel', 'codigoimovel', 'num_sicar',
      'numero_sicar', 'numero_car', 'cod_car', 'nr_car', 'registro_car'
    ].forEach((field) => requests.push({ type: 'car', field, value: `${field}='${escaped}'` }));
    const targetBbox = geometryBbox(geometry);
    if (targetBbox) requests.push({ type: 'bbox', value: `${targetBbox.join(',')},EPSG:4326` });

    for (const request of requests) {
      const upstream = new URL(CEFIR_WFS);
      Object.entries(common).forEach(([key, value]) => upstream.searchParams.set(key, value));
      if (request.type === 'car') upstream.searchParams.set('CQL_FILTER', request.value);
      else upstream.searchParams.set('BBOX', request.value);
      try {
        // INEMA/GeoBahia passa pelo Worker HTTPS. Cada alias de campo é
        // consultado separadamente porque os nomes do schema CEFIR variam.
        const urls = [officialSicarProxyUrl(upstream.toString())].filter(Boolean);
        for (const url of urls) {
          const response = await fetch(url, {
            cache: 'no-store', credentials: 'omit',
            headers: { Accept: 'application/geo+json,application/json;q=0.9,*/*;q=0.1' }
          });
          if (!response.ok) continue;
          const payload = await response.json().catch(() => null);
          const features = Array.isArray(payload?.features) ? payload.features : [];
          if (!features.length) continue;
          let feature = features.find((item) => officialFeatureMatchesCar(item, targetCar)) || null;
          if (!feature && targetBbox) {
            feature = [...features]
              .map((item) => ({ item, score: bboxOverlapScore(targetBbox, geometryBbox(item?.geometry)) }))
              .sort((a, b) => b.score - a.score)[0];
            feature = feature?.score > 0.25 ? feature.item : null;
          }
          if (!feature && request.type === 'car' && features.length === 1) feature = features[0];
          if (feature?.properties && Object.keys(feature.properties).length) return feature.properties;
        }
      } catch {
        // Um alias de campo inválido não cancela os demais aliases/fallbacks.
      }
    }
    return null;
  }

  function representativePointFromGeometry(geometry = null) {
    if (!geometry) return null;
    try {
      if (window.turf?.pointOnFeature) {
        const point = window.turf.pointOnFeature({ type: 'Feature', properties: {}, geometry });
        const coords = point?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2 && coords.slice(0, 2).every(Number.isFinite)) {
          return { lng: Number(coords[0]), lat: Number(coords[1]) };
        }
      }
    } catch {}
    const bbox = geometryBbox(geometry);
    if (!bbox) return null;
    return { lng: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 };
  }

  function pointBbox(point, radiusMeters = 25) {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const dLat = Math.max(0.00002, Number(radiusMeters || 25) / 111320);
    const cosLat = Math.max(0.2, Math.cos(lat * Math.PI / 180));
    const dLng = Math.max(0.00002, Number(radiusMeters || 25) / (111320 * cosLat));
    return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
  }

  function parseOfficialHtmlTableProperties(text) {
    const html = String(text || '');
    if (!/<table|<tr|<td|<th/i.test(html)) return null;
    try {
      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const properties = {};
        for (const table of Array.from(doc.querySelectorAll('table'))) {
          const rows = Array.from(table.querySelectorAll('tr'));
          const matrix = rows.map((row) => ({
            cells: Array.from(row.querySelectorAll('th,td'))
              .map((cell) => String(cell.textContent || '').replace(/\s+/g, ' ').trim()),
            headerCount: row.querySelectorAll('th').length,
            dataCount: row.querySelectorAll('td').length
          })).filter((row) => row.cells.some(Boolean));

          if (matrix.length >= 2 && matrix[0].headerCount >= 2 && matrix[1].dataCount >= 2) {
            const headers = matrix[0].cells;
            const values = matrix[1].cells;
            const count = Math.min(headers.length, values.length);
            for (let i = 0; i < count; i += 1) {
              const key = String(headers[i] || '').replace(/:\s*$/, '').trim();
              const value = String(values[i] || '').trim();
              if (key && value && !(key in properties)) properties[key] = value;
            }
          }

          for (const row of matrix) {
            if (row.cells.length < 2) continue;
            const key = String(row.cells[0] || '').replace(/:\s*$/, '').trim();
            const value = row.cells.slice(1).join(' ').trim();
            if (key && value && !(key in properties)) properties[key] = value;
          }
        }
        return Object.keys(properties).length ? properties : null;
      }
    } catch {}
    return null;
  }

  function parseOfficialFeatureInfoProperties(text, contentType = '') {
    const raw = String(text || '').trim();
    if (!raw) return null;
    if (/<(?:\w+:)?(?:ServiceException|ExceptionReport|Exception)\b/i.test(raw)) return null;
    const htmlTable = parseOfficialHtmlTableProperties(raw);
    if (htmlTable) return htmlTable;
    if (String(contentType).includes('json') || /^[\[{]/.test(raw)) {
      try {
        const payload = JSON.parse(raw);
        return payload?.features?.[0]?.properties || payload?.properties || null;
      } catch {}
    }
    const properties = {};
    const ignored = /^(?:boundedBy|the_geom|geom|geometry|coordinates|coord|pos|posList)$/i;
    const xmlPattern = /<(?:[A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)\b[^>]*>([^<]{1,1200})<\/(?:[A-Za-z_][\w.-]*:)?\1>/g;
    let match;
    while ((match = xmlPattern.exec(raw))) {
      const key = String(match[1] || '').trim();
      const value = String(match[2] || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
      if (!key || !value || ignored.test(key)) continue;
      if (!(key in properties)) properties[key] = value;
    }
    if (Object.keys(properties).length) return properties;
    const plain = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const pairPattern = /([A-Za-z_][\w.-]*)\s*=\s*['"]?([^'";|]+)['"]?/g;
    while ((match = pairPattern.exec(plain))) {
      const key = String(match[1] || '').trim();
      const value = String(match[2] || '').trim();
      if (key && value && !ignored.test(key) && !(key in properties)) properties[key] = value;
    }
    return Object.keys(properties).length ? properties : null;
  }

  async function fetchOfficialSigefGetFeatureInfo(geometry = null) {
    const point = representativePointFromGeometry(geometry);
    if (!point) return null;
    const themes = ['certificada_sigef_particular_ba', 'certificada_sigef_publico_ba'];
    const delta = 0.00035;
    for (const theme of themes) {
      for (const infoFormat of ['text/html']) {
        try {
          const upstream = new URL('https://acervofundiario.incra.gov.br/i3geo/ogc.php');
          upstream.searchParams.set('tema', theme);
          upstream.searchParams.set('SERVICE', 'WMS');
          upstream.searchParams.set('VERSION', '1.1.1');
          upstream.searchParams.set('REQUEST', 'GetFeatureInfo');
          upstream.searchParams.set('LAYERS', theme);
          upstream.searchParams.set('QUERY_LAYERS', theme);
          upstream.searchParams.set('STYLES', '');
          upstream.searchParams.set('FORMAT', 'image/png');
          upstream.searchParams.set('TRANSPARENT', 'true');
          upstream.searchParams.set('SRS', 'EPSG:4326');
          upstream.searchParams.set('BBOX', [point.lng - delta, point.lat - delta, point.lng + delta, point.lat + delta].join(','));
          upstream.searchParams.set('WIDTH', '101');
          upstream.searchParams.set('HEIGHT', '101');
          upstream.searchParams.set('X', '50');
          upstream.searchParams.set('Y', '50');
          upstream.searchParams.set('INFO_FORMAT', infoFormat);
          upstream.searchParams.set('FEATURE_COUNT', '1');
          for (const url of officialIncraInfoCandidateUrls(upstream.toString())) {
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort('timeout'), 90000);
            try {
              const isDirectIncra = /^https:\/\/acervofundiario\.incra\.gov\.br\//i.test(url);
              const response = await fetch(url, {
                cache: 'no-store', credentials: 'omit', signal: controller.signal,
                ...(isDirectIncra ? { mode: 'cors' } : {}),
                headers: { Accept: 'text/html, text/plain;q=0.7, */*;q=0.1' }
              });
              if (!response.ok) continue;
              const text = await response.text().catch(() => '');
              const properties = parseOfficialFeatureInfoProperties(text, String(response.headers.get('content-type') || '').toLowerCase());
              if (properties && Object.keys(properties).length) {
                return {
                  properties,
                  theme,
                  feature: { type: 'Feature', geometry: null, properties },
                  source: isDirectIncra
                    ? 'INCRA/Acervo Fundiário WMS GetFeatureInfo oficial — acesso direto'
                    : 'INCRA/Acervo Fundiário WMS GetFeatureInfo oficial — via Worker'
                };
              }
            } catch (error) {
              const routeLabel = /^https:\/\/acervofundiario\.incra\.gov\.br\//i.test(url) ? 'direto' : 'Worker';
              console.debug(`SIGEF ${theme} GetFeatureInfo (${routeLabel}) indisponível:`, error?.message || error);
            } finally {
              window.clearTimeout(timer);
            }
          }
        } catch {
          // Tenta o próximo tema oficial do Acervo Fundiário.
        }
      }
    }
    return null;
  }

  async function fetchOfficialSigefProperties(geometry = null) {
    // O enriquecimento fundiário usa exclusivamente WMS GetFeatureInfo em
    // text/html. O WFS do i3geo/INCRA bloqueia JSON/GeoJSON para estas camadas
    // e não deve participar deste fluxo de identificação pontual.
    return fetchOfficialSigefGetFeatureInfo(geometry);
  }

  function decodeOfficialSicarFeature(feature, municipality = null, fallbackUf = SUPPORTED_UF) {
    const props = feature?.properties || {};
    const car = String(featureProperty(props, 'cod_imovel', 'codigo_imovel', 'codigoimovel', 'car') || '').trim().toUpperCase();
    if (!car) return null;
    const parsed = parseCar(car);
    const uf = String(featureProperty(props, 'uf', 'cod_estado', 'estado') || parsed?.uf || fallbackUf || SUPPORTED_UF).toUpperCase();
    const municipioCodigo = String(featureProperty(props, 'cod_municipio_ibge', 'cod_munici', 'cod_municipio', 'codigo_municipio', 'codmun') || parsed?.municipioCodigo || municipality?.codigo || '');
    const municipio = String(featureProperty(props, 'municipio', 'nom_munici', 'nome_municipio', 'nommun') || semanticOfficialValue(props, 'municipality') || municipality?.nome || 'Município não identificado');
    const owner = featureProperty(props,
      'proprietario', 'nome_proprietario', 'nom_proprietario', 'nm_proprietario', 'proprietario_nome', 'titular', 'nome_titular',
      'detentor', 'detentor_nome', 'nome_detentor', 'possuidor', 'nome_possuidor', 'nome_propr', 'nom_propr')
      || semanticOfficialValue(props, 'owner');
    const propertyName = featureProperty(props,
      'nome_imovel', 'nom_imovel', 'nm_imovel', 'nome_area', 'nom_area', 'nomearea', 'denominacao', 'denominaca',
      'nome_fazenda', 'nom_fazenda', 'nome_sitio', 'nom_sitio', 'nome_propriedade')
      || semanticOfficialValue(props, 'propertyName');
    return {
      car,
      registro: car,
      proprietario: owner || '',
      nomeImovel: propertyName || '',
      dataCriacao: featureProperty(props, 'dat_criacao', 'dat_criaca', 'data_criacao', 'dt_criacao') || '',
      dataAtualizacao: featureProperty(props, 'data_atualizacao', 'dat_atuali', 'dt_atualizacao') || '',
      numRetificacoes: optionalNumber(featureProperty(props, 'num_retifi', 'num_retificacoes', 'retificacoes')),
      moduloFiscal: optionalNumber(featureProperty(props, 'm_fiscal', 'num_modulo', 'modulo_fiscal', 'qtd_mod_fiscal', 'num_modulo_fiscal')),
      tipoImovel: featureProperty(props, 'tipo_imovel', 'ind_tipo', 'tip_imovel') || '',
      situacao: featureProperty(props, 'situacao', 'condicao', 'condicao_i', 'des_status') || '',
      condicao: featureProperty(props, 'condicao', 'condicao_i', 'situacao') || '',
      statusCodigo: featureProperty(props, 'status_imovel', 'ind_status', 'status_codigo', 'cod_status') || '',
      areaImovelHa: optionalNumber(featureProperty(props, 'area', 'num_area', 'area_imovel', 'area_imovel_ha')),
      appHa: optionalNumber(featureProperty(props, 'num_area_app', 'app_ha', 'area_app')),
      areaConsolidadaHa: optionalNumber(featureProperty(props, 'num_area_consolidada', 'area_consolidada_ha', 'area_consolidada')),
      pousioHa: optionalNumber(featureProperty(props, 'num_area_pousio', 'pousio_ha', 'area_pousio')),
      hidrografiaHa: optionalNumber(featureProperty(props, 'num_area_hidro', 'hidrografia_ha', 'area_hidrografia')),
      reservaLegalHa: optionalNumber(featureProperty(props, 'num_area_reserva', 'reserva_legal_ha', 'area_reserva_legal')),
      servidaoAdministrativaHa: optionalNumber(featureProperty(props, 'num_area_servidao', 'servidao_administrativa_ha')),
      usoRestritoHa: optionalNumber(featureProperty(props, 'num_area_uso_restrito', 'uso_restrito_ha')),
      vegetacaoNativaHa: optionalNumber(featureProperty(props, 'num_area_veg', 'vegetacao_nativa_ha', 'area_vegetacao_nativa')),
      municipio,
      municipioCodigo,
      uf,
      officialProperties: { ...props },
      feature: feature?.geometry ? { type: 'Feature', properties: props, geometry: feature.geometry } : null,
      source: 'sicar-wfs-oficial'
    };
  }

  async function enrichOfficialCarItem(item) {
    if (!item) return item;
    const [cefir, sigefResult] = await Promise.all([
      fetchOfficialCefirProperties(item.car || item.registro, item.feature?.geometry || null),
      fetchOfficialSigefProperties(item.feature?.geometry || null)
    ]);
    const sigef = sigefResult?.properties || null;
    if (!cefir && !sigef) return item;
    item.cefirProperties = cefir || null;
    item.sigefProperties = sigef || null;
    item.officialProperties = mergeOfficialProperties(item.officialProperties, cefir, sigef);
    item.proprietario = item.proprietario || officialPropertyValue(cefir || {}, [
      'proprietario', 'nome_proprietario', 'nom_proprietario', 'nm_proprietario', 'proprietario_nome', 'titular', 'nome_titular',
      'detentor', 'detentor_nome', 'nome_detentor', 'possuidor', 'nome_possuidor', 'nome_propr', 'nom_propr'
    ]) || semanticOfficialValue(cefir || {}, 'owner') || officialPropertyValue(sigef, [
      'detentor', 'detentor_nome', 'nome_detentor', 'proprietario', 'nome_proprietario', 'titular', 'nome_titular'
    ]) || semanticOfficialValue(sigef, 'owner') || '';
    item.nomeImovel = item.nomeImovel || officialPropertyValue(cefir || {}, [
      'nome_imovel', 'nom_imovel', 'nm_imovel', 'nome_area', 'nom_area', 'nomearea', 'denominacao', 'denominaca',
      'nome_fazenda', 'nom_fazenda', 'nome_sitio', 'nom_sitio', 'nome_propriedade'
    ]) || semanticOfficialValue(cefir || {}, 'propertyName') || officialPropertyValue(sigef, [
      'nome_area', 'nomearea', 'nome_imovel', 'nom_imovel', 'denominacao'
    ]) || semanticOfficialValue(sigef, 'propertyName') || '';
    item.dataCriacao = item.dataCriacao || officialPropertyValue(cefir || {}, ['dat_criacao', 'dat_criaca', 'data_criacao', 'dt_criacao']) || '';
    item.dataAtualizacao = item.dataAtualizacao || officialPropertyValue(cefir || {}, ['data_atualizacao', 'dat_atuali', 'dt_atualizacao']) || '';
    item.situacao = item.situacao || officialPropertyValue(cefir || {}, ['situacao', 'condicao', 'condicao_i', 'des_status']) || '';
    item.condicao = item.condicao || officialPropertyValue(cefir || {}, ['condicao', 'condicao_i', 'situacao']) || '';
    item.statusCodigo = item.statusCodigo || officialPropertyValue(cefir || {}, ['status_imovel', 'ind_status', 'status_codigo', 'cod_status']) || '';
    item.tipoImovel = item.tipoImovel || officialPropertyValue(cefir || {}, ['tipo_imovel', 'ind_tipo', 'tip_imovel']) || '';
    if (!item.municipio || /não identificado/i.test(item.municipio)) {
      item.municipio = String(officialPropertyValue(cefir || {}, ['municipio', 'nome_municipio', 'nom_munici', 'nommun']) || semanticOfficialValue(cefir || {}, 'municipality') || item.municipio || '');
    }
    const fillNumber = (current, aliases) => current == null ? optionalNumber(officialPropertyValue(cefir || {}, aliases)) : current;
    item.areaImovelHa = fillNumber(item.areaImovelHa, ['area', 'num_area', 'area_imovel', 'area_imovel_ha']);
    item.moduloFiscal = fillNumber(item.moduloFiscal, ['m_fiscal', 'num_modulo', 'modulo_fiscal', 'qtd_mod_fiscal']);
    item.numRetificacoes = fillNumber(item.numRetificacoes, ['num_retifi', 'num_retificacoes', 'retificacoes']);
    item.appHa = fillNumber(item.appHa, ['num_area_app', 'app_ha', 'area_app']);
    item.areaConsolidadaHa = fillNumber(item.areaConsolidadaHa, ['num_area_consolidada', 'area_consolidada_ha', 'area_consolidada']);
    item.pousioHa = fillNumber(item.pousioHa, ['num_area_pousio', 'pousio_ha', 'area_pousio']);
    item.hidrografiaHa = fillNumber(item.hidrografiaHa, ['num_area_hidro', 'hidrografia_ha', 'area_hidrografia']);
    item.reservaLegalHa = fillNumber(item.reservaLegalHa, ['num_area_reserva', 'reserva_legal_ha', 'area_reserva_legal']);
    item.servidaoAdministrativaHa = fillNumber(item.servidaoAdministrativaHa, ['num_area_servidao', 'servidao_administrativa_ha']);
    item.usoRestritoHa = fillNumber(item.usoRestritoHa, ['num_area_uso_restrito', 'uso_restrito_ha']);
    item.vegetacaoNativaHa = fillNumber(item.vegetacaoNativaHa, ['num_area_veg', 'vegetacao_nativa_ha', 'area_vegetacao_nativa']);
    item.source = [item.source || 'sicar-wfs-oficial', cefir ? 'cefir-inema-oficial' : '', sigef ? 'sigef-incra-oficial' : ''].filter(Boolean).join('+');
    return item;
  }

  async function findByCar(registro) {
    const parsed = parseCar(registro);
    if (!parsed) throw new Error('Número CAR inválido. Use o formato BA-0000000-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.');
    if (parsed.uf !== SUPPORTED_UF) throw new Error('No momento, a Consulta CAR do Surveyor está disponível apenas para imóveis da Bahia.');
    const index = await getStateIndex(SUPPORTED_UF);
    const municipality = index.byCode.get(parsed.municipioCodigo) || { codigo: parsed.municipioCodigo, nome: 'Município não identificado' };
    const escaped = parsed.car.replace(/'/g, "''");
    const features = await fetchOfficialSicarFeatures(officialSicarSearchUrl({
      uf: parsed.uf,
      cql: `cod_imovel IN ('${escaped}')`,
      maxFeatures: 5
    }));
    const exact = features.find((feature) => String(featureProperty(feature?.properties, 'cod_imovel') || '').toUpperCase() === parsed.car) || features[0] || null;
    const item = exact ? decodeOfficialSicarFeature(exact, municipality, parsed.uf) : null;
    if (!item) return { items: [], total: 0, municipality, source: 'official' };
    await enrichOfficialCarItem(item);
    return { items: [item], total: 1, municipality, source: 'official' };
  }

  async function findByMunicipality(uf, municipalityName) {
    const state = SUPPORTED_UF;
    const index = await getStateIndex(state);
    const municipality = index.byName.get(normalizeText(municipalityName));
    if (!municipality) return { items: [], total: 0, municipality: null, source: 'official' };
    const prefix = `${state}-${municipality.codigo}-%`.replace(/'/g, "''");
    const features = await fetchOfficialSicarFeatures(officialSicarSearchUrl({
      uf: state,
      cql: `cod_imovel LIKE '${prefix}'`,
      maxFeatures: MAX_MUNICIPIO_RESULTS
    }));
    const items = features.map((feature) => decodeOfficialSicarFeature(feature, municipality, state)).filter(Boolean).slice(0, MAX_MUNICIPIO_RESULTS);
    return { items, total: items.length, municipality, source: 'official' };
  }

  function itemMeta(item) {
    return {
      registro: item.registro || item.car || 'Registro sem código',
      municipio: item.municipio || 'Não informado',
      uf: item.uf || '',
      area: item.areaImovelHa ?? '',
      proprietario: item.proprietario || '',
      nomeImovel: item.nomeImovel || ''
    };
  }

  function geometryFromItem(item) {
    const candidates = [item.geojson, item.geoJson, item.feature, item.geometry, item.geometria, item.geom];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (typeof candidate === 'string') {
        try { return JSON.parse(candidate); } catch { continue; }
      }
      if (typeof candidate === 'object') return candidate;
    }
    return null;
  }

  function normalizeGeoJson(value) {
    if (!value || typeof value !== 'object') return null;
    if (value.type === 'FeatureCollection' || value.type === 'Feature') return value;
    if (value.type && (value.coordinates || value.geometries)) return { type: 'Feature', properties: {}, geometry: value };
    return null;
  }

  function sicarTypeName(uf) {
    const state = String(uf || '').toUpperCase();
    return `sicar:sicar_imoveis_${state === 'DF' ? 'DF' : state.toLowerCase()}`;
  }

  function buildWfsUrl(item) {
    const params = new URLSearchParams({
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: sicarTypeName(item.uf),
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      CQL_FILTER: `cod_imovel IN ('${String(item.car || item.registro).replace(/'/g, "''")}')`
    });
    return `${SICAR_WFS}?${params.toString()}`;
  }

  async function fetchOfficialGeometry(item) {
    const key = String(item?.car || item?.registro || '').toUpperCase();
    if (!key) return null;
    if (geometryCache.has(key)) return geometryCache.get(key);
    const features = await fetchOfficialSicarFeatures(buildWfsUrl(item));
    const feature = features.find((f) => String(f?.properties?.cod_imovel || '').toUpperCase() === key) || features[0] || null;
    if (!feature?.geometry) return null;
    const geojson = { type: 'Feature', properties: feature.properties || {}, geometry: feature.geometry };
    geometryCache.set(key, geojson);
    return geojson;
  }

  function buildCustomLayerControl() {
    if (!map || customLayerControl) return;
    const Control = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'consulta-car-layer-control leaflet-control');
        container.innerHTML = `
          <button class="consulta-car-layer-toggle" type="button" aria-expanded="false" aria-label="Escolher mapa e camadas" title="Camadas">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3.8 7.5 12 12l8.2-4.5L12 3Z"></path><path d="m4.4 11.2 7.6 4.2 7.6-4.2"></path><path d="m4.4 15.2 7.6 4.2 7.6-4.2"></path></svg>
          </button>
          <div class="consulta-car-layer-panel" hidden>
            <div class="consulta-car-layer-title">Visualização</div>
            <label class="consulta-car-layer-option is-active"><input type="radio" name="consultaCarBaseMap" value="satellite" checked><span class="consulta-car-radio"></span><span><strong>Satélite</strong><small>Imagem aérea / satélite</small></span></label>
            <label class="consulta-car-layer-option"><input type="radio" name="consultaCarBaseMap" value="street"><span class="consulta-car-radio"></span><span><strong>Mapa</strong><small>Ruas e localidades</small></span></label>
            <div class="consulta-car-layer-separator"></div>
            <div class="consulta-car-layer-title">Camada CAR</div>
            <label class="consulta-car-layer-option consulta-car-overlay-option is-active"><input type="checkbox" id="consultaCarRuralToggle" checked><span class="consulta-car-check"></span><span><strong>Imóveis rurais (CAR)</strong><small>Perímetros públicos do CAR</small></span><i class="consulta-car-layer-swatch"></i></label>
          </div>`;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        const toggle = container.querySelector('.consulta-car-layer-toggle');
        const panel = container.querySelector('.consulta-car-layer-panel');
        const setOpen = (open) => {
          panel.hidden = !open;
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          container.classList.toggle('is-open', open);
        };
        toggle.addEventListener('click', () => setOpen(panel.hidden));
        container.querySelectorAll('input[name="consultaCarBaseMap"]').forEach((input) => {
          input.addEventListener('change', () => {
            if (!input.checked || !map) return;
            if (input.value === 'satellite') {
              if (streetLayer && map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
              if (satelliteLayer && !map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
            } else {
              if (satelliteLayer && map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
              if (streetLayer && !map.hasLayer(streetLayer)) streetLayer.addTo(map);
            }
            container.querySelectorAll('.consulta-car-layer-option').forEach((row) => {
              const radio = row.querySelector('input[type="radio"]');
              if (radio) row.classList.toggle('is-active', radio.checked);
            });
          });
        });
        const ruralToggle = container.querySelector('#consultaCarRuralToggle');
        ruralToggle?.addEventListener('change', () => {
          if (!map || !ruralPropertiesLayer) return;
          if (ruralToggle.checked) {
            if (!map.hasLayer(ruralPropertiesLayer)) ruralPropertiesLayer.addTo(map);
          } else if (map.hasLayer(ruralPropertiesLayer)) {
            map.removeLayer(ruralPropertiesLayer);
          }
          ruralToggle.closest('.consulta-car-layer-option')?.classList.toggle('is-active', ruralToggle.checked);
        });
        document.addEventListener('click', (event) => {
          if (!container.contains(event.target)) setOpen(false);
        });
        return container;
      }
    });
    customLayerControl = new Control().addTo(map);
  }

  function initMap() {
    if (!window.L || map) return;
    map = L.map('consultaCarMap', { zoomControl: true, attributionControl: true, preferCanvas: true }).setView([-12.9, -41.7], 6);
    map.createPane('ruralCarPane');
    map.getPane('ruralCarPane').style.zIndex = '430';
    map.createPane('selectedHaloPane');
    map.getPane('selectedHaloPane').style.zIndex = '640';
    map.createPane('selectedCarPane');
    map.getPane('selectedCarPane').style.zIndex = '650';
    map.createPane('selectedMarkerPane');
    map.getPane('selectedMarkerPane').style.zIndex = '720';

    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Imagem: Esri World Imagery'
    }).addTo(map);

    streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    });

    if (window.L?.tileLayer?.wms) {
      ruralPropertiesLayer = L.tileLayer.wms(SICAR_WMS, {
        layers: sicarTypeName(SUPPORTED_UF),
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        opacity: 0.34,
        pane: 'ruralCarPane',
        className: 'consulta-car-rural-wms',
        attribution: 'CAR/SICAR'
      });
      ruralPropertiesLayer.on('tileload', (event) => {
        if (!event?.tile?.style) return;
        event.tile.style.filter = 'invert(91%) sepia(99%) saturate(3600%) hue-rotate(1deg) brightness(108%) contrast(106%)';
        event.tile.style.mixBlendMode = 'normal';
      });
      ruralPropertiesLayer.addTo(map);
    }

    buildCustomLayerControl();
  }

  function removeMapLayers() {
    if (resultHaloLayer && map) { map.removeLayer(resultHaloLayer); resultHaloLayer = null; }
    if (resultLayer && map) { map.removeLayer(resultLayer); resultLayer = null; }
    if (selectedWmsLayer && map) { map.removeLayer(selectedWmsLayer); selectedWmsLayer = null; }
    if (selectedPulse && map) { map.removeLayer(selectedPulse); selectedPulse = null; }
    if (selectedMarker && map) { map.removeLayer(selectedMarker); selectedMarker = null; }
  }

  function clearResultLayer(message = 'Selecione ou pesquise um imóvel para carregar a geometria oficial do SICAR.') {
    removeMapLayers();
    $('consultaCarFit').disabled = true;
    const empty = $('consultaCarMapEmpty');
    if (empty) {
      empty.textContent = message;
      empty.classList.remove('hidden');
    }
  }


  function addSelectedMarker(item, bounds) {
    if (!map || !bounds?.isValid?.()) return;
    if (selectedPulse) { map.removeLayer(selectedPulse); selectedPulse = null; }
    if (selectedMarker) { map.removeLayer(selectedMarker); selectedMarker = null; }

    const meta = itemMeta(item);
    const center = bounds.getCenter();
    selectedPulse = L.circleMarker(center, {
      pane: 'selectedMarkerPane',
      radius: 20,
      color: '#0b63f6',
      weight: 2,
      opacity: .34,
      fillColor: '#0b63f6',
      fillOpacity: .08,
      interactive: false,
      className: 'consulta-car-selected-pulse'
    }).addTo(map);

    const icon = L.divIcon({
      className: 'consulta-car-selected-marker-wrap',
      html: '<span class="consulta-car-selected-marker"><span class="consulta-car-selected-marker-dot"></span></span>',
      iconSize: [34, 44],
      iconAnchor: [17, 42],
      popupAnchor: [0, -40],
      tooltipAnchor: [0, -32]
    });

    selectedMarker = L.marker(center, {
      pane: 'selectedMarkerPane',
      icon,
      zIndexOffset: 3000,
      title: 'Imóvel selecionado'
    }).addTo(map);

    selectedMarker.bindTooltip('Imóvel selecionado', {
      permanent: true,
      direction: 'top',
      offset: [0, -35],
      className: 'consulta-car-selected-tooltip'
    });
    selectedMarker.bindPopup(propertyPopupHtml(meta), { maxWidth: 300, closeButton: true });
  }

  function propertyPopupHtml(meta) {
    return `<div class="consulta-car-popup-card"><span class="consulta-car-popup-kicker">Imóvel consultado</span><strong>${escapeHtml(meta.municipio || 'Imóvel')}</strong><small>${escapeHtml(String(meta.registro || ''))}</small><button type="button" data-consulta-car-details="${escapeHtml(String(meta.registro || ''))}">Ver detalhes do imóvel</button></div>`;
  }

  function featureCarCode(properties = {}) {
    const candidates = [properties.cod_imovel, properties.codigo_imovel, properties.codImovel, properties.codigoImovel, properties.car];
    return String(candidates.find(Boolean) || '').trim().toUpperCase();
  }

  function buildFeatureInfoUrl(latlng) {
    if (!map) return '';
    const size = map.getSize();
    const point = map.latLngToContainerPoint(latlng, map.getZoom());
    const bounds = map.getBounds();
    const layerName = sicarTypeName(SUPPORTED_UF);
    const params = new URLSearchParams({
      service: 'WMS',
      request: 'GetFeatureInfo',
      version: '1.1.1',
      layers: layerName,
      query_layers: layerName,
      styles: '',
      bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(','),
      width: String(Math.max(1, Math.round(size.x))),
      height: String(Math.max(1, Math.round(size.y))),
      srs: 'EPSG:4326',
      format: 'image/png',
      transparent: 'true',
      info_format: 'application/json',
      feature_count: '5',
      x: String(Math.round(point.x)),
      y: String(Math.round(point.y))
    });
    return `${SICAR_WMS}?${params.toString()}`;
  }

  async function handleMapFeatureClick(event) {
    if (!map || !ruralPropertiesLayer || !map.hasLayer(ruralPropertiesLayer)) return;
    const target = event?.originalEvent?.target;
    if (target?.classList?.contains('leaflet-interactive')) return;
    try {
      const response = await fetch(buildFeatureInfoUrl(event.latlng), { cache: 'no-store', mode: 'cors' });
      if (!response.ok) return;
      const payload = await response.json();
      const features = Array.isArray(payload?.features) ? payload.features : [];
      const feature = features.find((candidate) => featureCarCode(candidate?.properties));
      const car = featureCarCode(feature?.properties);
      if (!car) return;
      const municipality = feature?.properties?.municipio || feature?.properties?.nom_munici || 'Imóvel';
      L.popup({ maxWidth: 330 })
        .setLatLng(event.latlng)
        .setContent(propertyPopupHtml({ registro: car, municipio: municipality }))
        .openOn(map);
    } catch {
      // Alguns servidores WMS bloqueiam GetFeatureInfo por CORS. O mapa e a consulta por CAR continuam funcionando normalmente.
    }
  }

  function focusPropertyDetails() {
    const panel = document.querySelector('.consulta-car-results-card');
    if (!panel || panel.hidden) return;
    panel.classList.remove('consulta-car-results-highlight');
    void panel.offsetWidth;
    panel.classList.add('consulta-car-results-highlight');
    window.setTimeout(() => panel.classList.remove('consulta-car-results-highlight'), 1300);
    if (window.innerWidth < 1180) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function openPropertyByCar(car) {
    const normalized = String(car || '').trim().toUpperCase();
    if (!normalized) return;
    const existing = currentItems.find((item) => String(item?.car || item?.registro || '').toUpperCase() === normalized);
    const propertyAlreadyOpen = Boolean(document.querySelector('.consulta-car-property-card'));
    if (existing && propertyAlreadyOpen) {
      focusPropertyDetails();
      return;
    }
    if (existing) {
      // A lista municipal permanece leve. O enriquecimento oficial completo
      // (SICAR + CEFIR/INEMA) é feito somente quando o usuário abre um imóvel.
      await enrichOfficialCarItem(existing);
      renderResults([existing], 1, { mode: 'registro' });
      $('consultaCarRegistro').value = normalized;
      focusPropertyDetails();
      return;
    }
    setMode('registro');
    $('consultaCarUf').value = SUPPORTED_UF;
    $('consultaCarRegistro').value = normalized;
    await runSearch();
    focusPropertyDetails();
  }

  async function downloadSelectedGeometry(car) {
    const normalized = String(car || '').trim().toUpperCase();
    const item = currentItems.find((candidate) => String(candidate?.car || candidate?.registro || '').toUpperCase() === normalized);
    if (!item) return toast('Pesquise o imóvel antes de baixar o perímetro.', 'info');
    let geometry = geometryCache.get(normalized) || normalizeGeoJson(geometryFromItem(item));
    if (!geometry) {
      try { geometry = await fetchOfficialGeometry(item); } catch {}
    }
    if (!geometry) return toast('O perímetro não está disponível para download neste momento.', 'error');
    const blob = new Blob([JSON.stringify(geometry, null, 2)], { type: 'application/geo+json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${normalized.replace(/[^A-Z0-9-]+/g, '_')}.geojson`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function drawGeoJson(item, geometry, fit = true) {
    initMap();
    if (!map) return false;
    removeMapLayers();
    const normalized = normalizeGeoJson(geometry);
    if (!normalized) return false;
    try {
      const meta = itemMeta(item);
      resultHaloLayer = L.geoJSON(normalized, {
        pane: 'selectedHaloPane',
        interactive: false,
        style: { color: '#ffffff', weight: 9, opacity: .96, fillOpacity: 0 },
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
          pane: 'selectedHaloPane', radius: 9, color: '#fff', weight: 5, fillOpacity: 0, interactive: false
        })
      }).addTo(map);
      resultLayer = L.geoJSON(normalized, {
        pane: 'selectedCarPane',
        style: { color: '#005cff', weight: 6, opacity: 1, fillColor: '#1380ff', fillOpacity: .14, dashArray: null },
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
          pane: 'selectedCarPane', radius: 7, color: '#0b63f6', weight: 4, fillColor: '#fff', fillOpacity: 1
        }),
        onEachFeature: (_feature, layer) => {
          layer.bindPopup(propertyPopupHtml(meta), { maxWidth: 300, closeButton: true });
        }
      }).addTo(map);
      const bounds = resultLayer.getBounds?.();
      if (bounds?.isValid?.()) addSelectedMarker(item, bounds);
      if (fit && bounds?.isValid?.()) map.fitBounds(bounds.pad(.24), { maxZoom: 17 });
      resultLayer.bringToFront?.();
      $('consultaCarFit').disabled = !(bounds?.isValid?.());
      $('consultaCarMapEmpty').classList.add('hidden');
      setGeometryState('ok', 'Imóvel localizado no mapa');
      return true;
    } catch {
      return false;
    }
  }

  async function geocodeMunicipality(item) {
    const query = `${item.municipio || ''}, ${item.uf || 'BA'}, Brasil`;
    const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'br', q: query });
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        cache: 'force-cache',
        mode: 'cors',
        signal: controller.signal,
        headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
      });
      if (!response.ok) return false;
      const payload = await response.json();
      const hit = Array.isArray(payload) ? payload[0] : null;
      if (!hit) return false;
      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
      map?.setView([lat, lon], 12);
      return true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function drawWmsFallback(item) {
    initMap();
    if (!map || !window.L?.tileLayer?.wms) return false;
    removeMapLayers();
    try {
      selectedWmsLayer = L.tileLayer.wms(officialSicarWmsProxyUrl(SICAR_WMS), {
        layers: sicarTypeName(item.uf),
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        opacity: 0.86,
        pane: 'selectedCarPane',
        className: 'consulta-car-selected-wms',
        cql_filter: `cod_imovel IN ('${String(item.car || item.registro).replace(/'/g, "''")}')`
      }).addTo(map);
      selectedWmsLayer.on('tileload', (event) => {
        if (!event?.tile?.style) return;
        event.tile.style.filter = 'invert(35%) sepia(95%) saturate(4200%) hue-rotate(210deg) brightness(96%) contrast(110%)';
      });
      await geocodeMunicipality(item);
      $('consultaCarMapEmpty').classList.add('hidden');
      $('consultaCarFit').disabled = true;
      setGeometryState('fallback', 'Geometria exibida via SICAR/WMS');
      return true;
    } catch {
      return false;
    }
  }

  async function showGeometry(item, fit = true) {
    initMap();
    if (!map || !item) return;
    const token = ++geometryRequestToken;
    clearResultLayer('Localizando o imóvel no mapa…');
    setGeometryState('loading', 'Localizando imóvel…');

    const embedded = normalizeGeoJson(geometryFromItem(item));
    if (embedded && token === geometryRequestToken) {
      drawGeoJson(item, embedded, fit);
      return;
    }

    try {
      const geometry = await fetchOfficialGeometry(item);
      if (token !== geometryRequestToken) return;
      if (geometry && drawGeoJson(item, geometry, fit)) return;
      throw new Error('Geometria não retornada pelo SICAR.');
    } catch (error) {
      if (token !== geometryRequestToken) return;
      console.warn('[Surveyor Consulta CAR] WFS indisponível, tentando WMS.', error);
      const shown = await drawWmsFallback(item);
      if (token !== geometryRequestToken) return;
      if (!shown) {
        clearResultLayer('Não foi possível carregar a geometria agora. Os dados cadastrais oficiais permanecem exibidos.');
        setGeometryState('error', 'Geometria temporariamente indisponível');
      }
    }
  }

  function metric(label, value, tone = '') {
    return `<div class="consulta-car-env-metric ${tone}"><small>${escapeHtml(label)}</small><span>${escapeHtml(formatNumber(value, ' ha'))}</span></div>`;
  }

  function bahiaFlag() {
    return '<span class="consulta-car-ba-flag" role="img" aria-label="Bandeira da Bahia"><i></i></span>';
  }

  function publicOwnerText(item) {
    return item?.proprietario ? String(item.proprietario) : 'Não disponibilizado pelo serviço público consultado';
  }

  function officialFieldsTable(item) {
    const props = item?.officialProperties && typeof item.officialProperties === 'object' ? item.officialProperties : {};
    const skip = new Set(['boundedBy', 'geo_area_imovel', 'the_geom', 'geom', 'geometry']);
    const preferredLabels = {
      cod_imovel: 'Número do CAR', area: 'Área (ha)', num_area: 'Área (ha)', cod_municipio_ibge: 'Código IBGE',
      municipio: 'Município', nom_munici: 'Município', uf: 'UF', m_fiscal: 'Módulo fiscal', num_modulo: 'Módulo fiscal',
      tipo_imovel: 'Tipo do imóvel', ind_tipo: 'Tipo do imóvel', situacao: 'Situação', condicao: 'Condição', condicao_i: 'Condição',
      status_imovel: 'Status do imóvel', ind_status: 'Status do imóvel', dat_criacao: 'Data de criação', dat_criaca: 'Data de criação',
      data_atualizacao: 'Última atualização', dat_atuali: 'Última atualização', nome_imovel: 'Nome do imóvel', nom_imovel: 'Nome do imóvel',
      nome_area: 'Nome do imóvel', denominacao: 'Denominação', proprietario: 'Proprietário', nome_proprietario: 'Proprietário',
      detentor_nome: 'Detentor', nome_detentor: 'Detentor'
    };
    const entries = Object.entries(props)
      .filter(([key, value]) => value !== undefined && value !== null && String(value).trim() !== '' && !skip.has(key) && !String(key).startsWith('_'))
      .sort(([a], [b]) => {
        const ai = Object.prototype.hasOwnProperty.call(preferredLabels, a) ? 0 : 1;
        const bi = Object.prototype.hasOwnProperty.call(preferredLabels, b) ? 0 : 1;
        return ai - bi || a.localeCompare(b);
      });
    if (!entries.length) return '';
    const rows = entries.map(([key, value]) => {
      const label = preferredLabels[key] || String(key).replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
      const rendered = /data|dat_|atualizacao|criacao/i.test(key) ? formatDateBR(value) : value;
      return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(rendered))}</td></tr>`;
    }).join('');
    return `<details class="consulta-car-official-fields"><summary>Todos os atributos publicados pelo serviço oficial</summary><div class="consulta-car-official-fields-scroll"><table>${rows}</table></div></details>`;
  }

  function renderSigefOfficialSummary(item) {
    const props = item?.sigefProperties && typeof item.sigefProperties === 'object' ? item.sigefProperties : null;
    if (!props) return '';
    const value = (...aliases) => featureProperty(props, ...aliases) || null;
    const owner = value('detentor', 'detentor_nome', 'nome_detentor', 'proprietario', 'nome_proprietario') || semanticOfficialValue(props, 'owner');
    const name = value('nome_area', 'nomearea', 'nome_imovel', 'nom_imovel', 'denominacao') || semanticOfficialValue(props, 'propertyName');
    const parcel = value('parcela_co', 'parcelacodigo', 'parcela_codigo', 'codigo_parcela', 'id_parcela');
    const registry = value('registro_m', 'registro_matricula', 'matricula', 'registro');
    const cns = value('registrocns', 'registro_cns', 'cns');
    const rows = [
      ['Nome da parcela / imóvel', name],
      ['Detentor', owner],
      ['Código da parcela', parcel],
      ['Matrícula / registro', registry],
      ['CNS', cns]
    ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
    if (!rows.length) return '';
    return `<section class="consulta-car-sigef-summary"><div class="consulta-car-section-heading"><strong>Vínculo fundiário oficial — SIGEF/INCRA</strong><small>Parcela certificada encontrada sobre a geometria do CAR.</small></div><div class="consulta-car-property-main-grid">${rows.map(([label, v]) => `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(String(v))}</strong></div>`).join('')}</div></section>`;
  }

  function renderSingleProperty(item) {
    const meta = itemMeta(item);
    const areaText = meta.area === '' ? 'Não informada' : `${formatNumber(meta.area)} ha`;
    const updated = formatDateBR(item.dataAtualizacao);
    return `
      <article class="consulta-car-property-card">
        <div class="consulta-car-property-hero">
          <div class="consulta-car-location-chip">${item.uf === 'BA' ? bahiaFlag() : ''}<span><strong>${escapeHtml(meta.municipio)}</strong><small>${escapeHtml(meta.uf || '—')}</small></span></div>
          <span class="consulta-car-status-soft">${escapeHtml(statusLabel(item.statusCodigo))}</span>
        </div>
        <div class="consulta-car-property-code"><span>Número do CAR</span><strong>${escapeHtml(meta.registro)}</strong></div>
        <div class="consulta-car-property-main-grid">
          <div><small>Nome do imóvel</small><strong>${escapeHtml(meta.nomeImovel || 'Não disponibilizado pelo serviço público')}</strong></div>
          <div><small>Proprietário / detentor</small><strong>${escapeHtml(publicOwnerText(item))}</strong></div>
          <div><small>Área do imóvel</small><strong>${escapeHtml(areaText)}</strong></div>
          <div><small>Módulo fiscal</small><strong>${escapeHtml(formatNumber(item.moduloFiscal))}</strong></div>
          <div><small>Data de criação</small><strong>${escapeHtml(formatDateBR(item.dataCriacao))}</strong></div>
          <div><small>Última atualização</small><strong>${escapeHtml(updated)}</strong></div>
          <div><small>Condição</small><strong>${escapeHtml(item.condicao || item.situacao || '—')}</strong></div>
          <div><small>Status</small><strong>${escapeHtml(statusLabel(item.statusCodigo))}</strong></div>
          <div><small>Retificações</small><strong>${escapeHtml(item.numRetificacoes == null ? '—' : String(item.numRetificacoes))}</strong></div>
          <div><small>Tipo</small><strong>${escapeHtml(typeLabel(item.tipoImovel))}</strong></div>
        </div>
        ${renderSigefOfficialSummary(item)}
        <div class="consulta-car-env-head"><div><strong>Informações ambientais</strong><span>Exibidas quando publicadas pelo serviço oficial consultado</span></div></div>
        <div class="consulta-car-env-grid consulta-car-env-grid-rich">
          ${metric('APP', item.appHa, 'app')}
          ${metric('Reserva Legal', item.reservaLegalHa, 'reserva')}
          ${metric('Vegetação Nativa', item.vegetacaoNativaHa, 'vegetacao')}
          ${metric('Área Consolidada', item.areaConsolidadaHa, 'consolidada')}
          ${metric('Hidrografia', item.hidrografiaHa, 'hidro')}
          ${metric('Pousio', item.pousioHa)}
          ${metric('Servidão Administrativa', item.servidaoAdministrativaHa)}
          ${metric('Uso Restrito', item.usoRestritoHa)}
        </div>
        ${officialFieldsTable(item)}
        <div class="consulta-car-property-actions">
          <button type="button" data-download-geometry="${escapeHtml(meta.registro)}">Baixar perímetro (GeoJSON)</button>
          <a href="https://consultapublica.car.gov.br/publico/" target="_blank" rel="noopener noreferrer">Abrir Consulta Pública oficial</a>
        </div>
      </article>`;
  }

  function renderMunicipalityList(items, total, municipalityName) {
    const list = document.createElement('div');
    list.className = 'consulta-car-result-list';

    const summary = document.createElement('div');
    summary.className = 'consulta-car-municipality-summary';
    summary.innerHTML = `<strong>${escapeHtml(formatNumber(total))} imóveis</strong><span>${escapeHtml(municipalityName || 'Município')} · exibindo até ${MAX_MUNICIPIO_RESULTS}</span>`;
    list.appendChild(summary);

    items.forEach((item) => {
      const meta = itemMeta(item);
      const article = document.createElement('article');
      article.className = 'consulta-car-result-item';
      article.tabIndex = 0;
      const areaText = meta.area === '' ? 'Não informada' : `${formatNumber(meta.area)} ha`;
      article.innerHTML = `
        <div class="consulta-car-result-item-head"><strong>${escapeHtml(String(meta.registro))}</strong><span class="consulta-car-result-selected-badge">No mapa</span></div>
        <div class="consulta-car-result-location">${item.uf === 'BA' ? bahiaFlag() : ''}<span>${escapeHtml(meta.municipio)} · ${escapeHtml(meta.uf || '—')}</span></div>
        <div class="consulta-car-result-meta compact">
          <div><small>Área do imóvel</small><span>${escapeHtml(areaText)}</span></div>
          <div><small>Criação</small><span>${escapeHtml(formatDateBR(item.dataCriacao))}</span></div>
        </div>`;
      const activate = () => {
        list.querySelectorAll('.consulta-car-result-item').forEach((node) => {
          const active = node === article;
          node.classList.toggle('active', active);
          node.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        article.setAttribute('aria-selected', 'true');
        showGeometry(item, true);
      };
      article.addEventListener('click', activate);
      article.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
      });
      list.appendChild(article);
    });
    return list;
  }

  function setResultsPanelVisible(visible) {
    const workspace = document.querySelector('.consulta-car-workspace');
    const panel = document.querySelector('.consulta-car-results-card');
    if (!workspace || !panel) return;
    panel.hidden = !visible;
    workspace.classList.toggle('has-results', Boolean(visible));
    window.setTimeout(() => map?.invalidateSize(), 40);
  }

  function showSourceNotice() {
    const modal = $('consultaCarSourceModal');
    const ok = $('consultaCarSourceOk');
    if (!modal || !ok) return;
    modal.hidden = false;
    document.body.classList.add('consulta-car-modal-open');
    window.setTimeout(() => ok.focus(), 20);
    const close = () => {
      modal.hidden = true;
      document.body.classList.remove('consulta-car-modal-open');
    };
    ok.addEventListener('click', close, { once: true });
  }

  function renderResults(items, total = items.length, context = {}) {
    setResultsPanelVisible(true);
    currentItems = items;
    const body = $('consultaCarResultBody');
    const title = $('consultaCarResultTitle');
    const count = $('consultaCarResultCount');
    if (count) count.hidden = true;

    if (!items.length) {
      if (title) title.textContent = 'Nenhum imóvel localizado';
      body.innerHTML = '<div class="consulta-car-empty-state"><div class="consulta-car-empty-icon">∅</div><strong>Nenhum imóvel localizado</strong><p>Revise o número do CAR ou tente outro município.</p></div>';
      clearResultLayer();
      setGeometryState('idle', 'Geometria sob demanda');
      return;
    }

    if (context.mode === 'registro' && items.length === 1) {
      if (title) title.textContent = 'Dados do imóvel';
      body.innerHTML = renderSingleProperty(items[0]);
      showGeometry(items[0], true);
      return;
    }

    if (title) title.textContent = context.municipalityName ? `Imóveis de ${context.municipalityName}` : 'Imóveis do município';
    body.innerHTML = '';
    body.appendChild(renderMunicipalityList(items, total, context.municipalityName));
    clearResultLayer('Selecione um imóvel da lista para carregar a geometria oficial.');
    setGeometryState('idle', 'Selecione um imóvel');
  }

  async function runSearch() {
    const uf = $('consultaCarUf').value.trim().toUpperCase();
    const municipio = $('consultaCarMunicipio').value.trim();
    const registro = $('consultaCarRegistro').value.trim();

    if (mode === 'registro' && !registro) {
      toast('Informe o número de registro no CAR.', 'error');
      $('consultaCarRegistro').focus();
      return;
    }
    if (mode === 'municipio' && (!uf || !municipio)) {
      toast('Selecione a UF e informe o município.', 'error');
      (!uf ? $('consultaCarUf') : $('consultaCarMunicipio')).focus();
      return;
    }

    const button = $('consultaCarBuscar');
    button.disabled = true;
    button.querySelector('span').textContent = 'Consultando…';

    try {
      const response = mode === 'registro'
        ? await findByCar(registro)
        : await findByMunicipality(uf, municipio);

      setDataState('ok', 'Consulta realizada diretamente nos serviços públicos oficiais do SICAR/CAR.');

      renderResults(response.items, response.total, {
        mode,
        municipalityName: response.municipality?.nome || municipio
      });

      // Os cinco cards permanecem como panorama da Bahia e não mudam após a pesquisa.
      await loadInitialStats();

      if (!response.total) {
        toast('Nenhum imóvel localizado para os filtros informados.', 'info');
      } else if (mode === 'municipio' && response.total > response.items.length) {
        toast(`${formatNumber(response.total)} imóveis no município. Exibindo os primeiros ${response.items.length}.`, 'success');
      } else if (mode === 'registro') {
        toast('Dados do imóvel carregados.', 'success');
      }
    } catch (error) {
      console.error('[Surveyor Consulta CAR local]', error);
      renderResults([], 0, { mode });
      await loadInitialStats();
      const unavailable = Number(error?.status) === 404;
      const helper = $('consultaCarHelper');
      if (helper) helper.textContent = unavailable
        ? 'Não há dados disponíveis para essa UF ou município nesta versão.'
        : 'Não foi possível concluir a consulta agora. Tente novamente.';
      toast(error?.message || 'Não foi possível concluir a consulta do CAR.', 'error');
    } finally {
      button.disabled = false;
      button.querySelector('span').textContent = 'Buscar CAR';
    }
  }

  function setMode(nextMode) {
    mode = nextMode === 'municipio' ? 'municipio' : 'registro';
    document.querySelectorAll('.consulta-car-mode button').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const registro = $('consultaCarRegistro');
    registro.disabled = mode === 'municipio';
    if (mode === 'municipio') registro.value = '';
    $('consultaCarHelper').innerHTML = mode === 'registro'
      ? 'Informe o número do CAR para localizar o cadastro e visualizar o imóvel no mapa.'
      : `Informe o município da Bahia. São exibidos até <strong>${MAX_MUNICIPIO_RESULTS}</strong> registros por vez.`;
  }

  async function bind() {
    initMap();
    $('consultaCarForm')?.addEventListener('submit', (event) => { event.preventDefault(); runSearch(); });
    document.querySelectorAll('.consulta-car-mode button').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
    $('consultaCarUf')?.addEventListener('change', async (event) => {
      $('consultaCarMunicipio').value = '';
      await loadMunicipalities(event.target.value);
      await loadInitialStats();
    });
    $('consultaCarFit')?.addEventListener('click', () => {
      if (!map || !resultLayer) return;
      const bounds = resultLayer.getBounds?.();
      if (bounds?.isValid?.()) map.fitBounds(bounds.pad(.18), { maxZoom: 17 });
    });
    $('consultaCarReset')?.addEventListener('click', () => {
      geometryRequestToken += 1;
      clearResultLayer('Selecione ou pesquise um imóvel para carregar a geometria oficial do SICAR.');
      setGeometryState('idle', 'Geometria sob demanda');
      if (map) map.setView([-12.9, -41.7], 6);
    });

    document.addEventListener('click', (event) => {
      const details = event.target.closest?.('[data-consulta-car-details]');
      if (details) {
        event.preventDefault();
        openPropertyByCar(details.dataset.consultaCarDetails);
        return;
      }
      const download = event.target.closest?.('[data-download-geometry]');
      if (download) {
        event.preventDefault();
        downloadSelectedGeometry(download.dataset.downloadGeometry);
      }
    });

    setResultsPanelVisible(false);
    showSourceNotice();

    if ($('consultaCarUf')) $('consultaCarUf').value = SUPPORTED_UF;
    await loadMunicipalities(SUPPORTED_UF);
    await loadInitialStats();
    setMode('registro');
    clearResultLayer('Pesquise um imóvel para visualizar o seu perímetro oficial no mapa.');
    setGeometryState('idle', 'Geometria sob demanda');
    window.setTimeout(() => map?.invalidateSize(), 180);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
