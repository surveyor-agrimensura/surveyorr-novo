(() => {
  'use strict';

  const BRAZIL_BOUNDS = { minLng: -75, maxLng: -30, minLat: -35, maxLat: 7 };
  const CRS_DEFINITIONS = new Map([
    ['EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs +type=crs'],
    ['EPSG:4674', '+proj=longlat +ellps=GRS80 +no_defs +type=crs'],
    ['EPSG:4618', '+proj=longlat +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +no_defs +type=crs'],
    ['EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs']
  ]);

  for (let zone = 18; zone <= 25; zone += 1) {
    CRS_DEFINITIONS.set(`EPSG:${31960 + zone}`, `+proj=utm +zone=${zone} +south +ellps=GRS80 +units=m +no_defs +type=crs`);
    CRS_DEFINITIONS.set(`EPSG:${32700 + zone}`, `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs +type=crs`);
    CRS_DEFINITIONS.set(`EPSG:${29170 + zone}`, `+proj=utm +zone=${zone} +south +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +units=m +no_defs +type=crs`);
  }

  const SUPPORTED = new Set(CRS_DEFINITIONS.keys());

  function normalizeCode(value) {
    const text = String(value || '').trim().toUpperCase();
    if (!text) return '';
    const match = text.match(/(?:EPSG[:/ ]*|URN:OGC:DEF:CRS:EPSG::|CRS[:/ ]*)(\d{4,5})/i) || text.match(/\b(\d{4,5})\b/);
    const code = match ? `EPSG:${match[1]}` : '';
    return SUPPORTED.has(code) ? code : '';
  }

  function registerDefinitions() {
    if (!window.proj4) return;
    CRS_DEFINITIONS.forEach((definition, code) => {
      try { window.proj4.defs(code, definition); } catch (error) { console.warn(`[Surveyor CRS] Falha ao registrar ${code}:`, error); }
    });
  }

  function utmZoneForLongitude(longitude) {
    const lng = Number(longitude);
    if (!Number.isFinite(lng)) return null;
    return Math.max(1, Math.min(60, Math.floor((lng + 180) / 6) + 1));
  }

  function sirgas2000UtmCodeForLngLat(longitude, latitude) {
    const zone = utmZoneForLongitude(longitude);
    const lat = Number(latitude);
    if (!zone || !Number.isFinite(lat) || lat >= 0 || zone < 18 || zone > 25) return '';
    return `EPSG:${31960 + zone}`;
  }

  function projectToSirgasUtm(longitude, latitude, preferredCode = '') {
    const lng = Number(longitude);
    const lat = Number(latitude);
    const target = normalizeCode(preferredCode) || sirgas2000UtmCodeForLngLat(lng, lat);
    if (!target || !/^EPSG:319(?:7[8-9]|8[0-5])$/.test(target)) throw new Error('Não foi possível determinar o fuso SIRGAS 2000 / UTM para esta coordenada.');
    if (!window.proj4) throw new Error('A biblioteca de reprojeção não foi carregada.');
    const projected = window.proj4('EPSG:4326', target, [lng, lat]);
    const easting = Number(projected?.[0]);
    const northing = Number(projected?.[1]);
    if (!Number.isFinite(easting) || !Number.isFinite(northing)) throw new Error(`Falha ao projetar coordenada para ${target}.`);
    return { easting, northing, epsg: target, zone: Number(target.slice(5)) - 31960, hemisphere: 'S' };
  }

  function explicitCrs(collection) {
    const candidates = [
      collection?.crs?.properties?.name,
      collection?.crs?.properties?.code,
      collection?.crs?.name,
      collection?.properties?.crs,
      collection?.properties?.epsg,
      collection?.metadata?.crs,
      collection?.metadata?.epsg
    ];
    for (const candidate of candidates) {
      const code = normalizeCode(candidate);
      if (code) return code;
    }
    return '';
  }

  function visitCoordinates(value, callback) {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
      callback(value);
      return;
    }
    value.forEach((item) => visitCoordinates(item, callback));
  }

  function collectSamples(collection, max = 80) {
    const samples = [];
    const add = (coord) => {
      if (samples.length >= max) return;
      samples.push([Number(coord[0]), Number(coord[1])]);
    };
    const fc = collection?.type === 'FeatureCollection'
      ? collection
      : collection?.type === 'Feature'
        ? { type: 'FeatureCollection', features: [collection] }
        : collection?.type && collection?.coordinates
          ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: collection }] }
          : collection;
    (fc?.features || []).some((feature) => {
      visitCoordinates(feature?.geometry?.coordinates, add);
      return samples.length >= max;
    });
    return samples;
  }

  function isProjected(samples) {
    return samples.some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90);
  }

  function insideBrazil(lng, lat) {
    return lng >= BRAZIL_BOUNDS.minLng && lng <= BRAZIL_BOUNDS.maxLng && lat >= BRAZIL_BOUNDS.minLat && lat <= BRAZIL_BOUNDS.maxLat;
  }

  function shouldSwapGeographicAxis(samples) {
    if (!samples.length || isProjected(samples)) return false;
    let normal = 0;
    let swapped = 0;
    samples.forEach(([x, y]) => {
      if (insideBrazil(x, y)) normal += 1;
      if (insideBrazil(y, x)) swapped += 1;
    });
    return swapped > normal && swapped >= Math.ceil(samples.length * 0.6);
  }

  function looksLikeUtmSouth(samples) {
    if (!samples.length) return false;
    const matches = samples.filter(([x, y]) => x >= 100000 && x <= 900000 && y >= 5000000 && y <= 10000000).length;
    return matches >= Math.ceil(samples.length * 0.7);
  }

  function analyzeGeoJSON(collection) {
    const samples = collectSamples(collection);
    const detectedCrs = explicitCrs(collection);
    const projected = isProjected(samples);
    return {
      detectedCrs,
      projected,
      likelyUtmSouth: projected && looksLikeUtmSouth(samples),
      swapAxis: shouldSwapGeographicAxis(samples),
      coordinateCountSampled: samples.length,
      samples
    };
  }

  function transformPair(coord, sourceCrs, swapAxis) {
    let x = Number(coord[0]);
    let y = Number(coord[1]);
    const tail = coord.slice(2);
    if (swapAxis) [x, y] = [y, x];

    if (sourceCrs === 'EPSG:4674' || sourceCrs === 'EPSG:4326' || !sourceCrs) {
      return [x, y, ...tail];
    }
    if (!window.proj4) throw new Error('A biblioteca de reprojeção não foi carregada. Atualize a página e tente novamente.');
    if (!SUPPORTED.has(sourceCrs)) throw new Error(`O sistema de coordenadas ${sourceCrs} ainda não é suportado automaticamente.`);
    const result = window.proj4(sourceCrs, 'EPSG:4326', [x, y]);
    if (!Number.isFinite(result?.[0]) || !Number.isFinite(result?.[1])) throw new Error(`Falha ao reprojetar coordenadas de ${sourceCrs} para EPSG:4326.`);
    return [Number(result[0]), Number(result[1]), ...tail];
  }

  function mapCoordinates(value, callback) {
    if (!Array.isArray(value)) return value;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) return callback(value);
    return value.map((item) => mapCoordinates(item, callback));
  }

  function normalizeGeoJSON(input, options = {}) {
    const clone = typeof structuredClone === 'function' ? structuredClone(input) : JSON.parse(JSON.stringify(input));
    const collection = clone?.type === 'FeatureCollection'
      ? clone
      : clone?.type === 'Feature'
        ? { type: 'FeatureCollection', features: [clone] }
        : clone?.type && clone?.coordinates
          ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: clone }] }
          : clone;
    if (!Array.isArray(collection?.features)) throw new Error('GeoJSON inválido: coleção de feições não encontrada.');

    const analysis = analyzeGeoJSON(collection);
    let sourceCrs = normalizeCode(options.sourceCrs) || analysis.detectedCrs;
    if (!sourceCrs && analysis.projected) {
      const error = new Error('As coordenadas parecem projetadas, mas o arquivo não informa o EPSG. Informe o sistema de origem para continuar.');
      error.code = 'CRS_REQUIRED';
      error.analysis = analysis;
      throw error;
    }
    if (!sourceCrs) sourceCrs = 'EPSG:4326';
    if (!SUPPORTED.has(sourceCrs)) {
      const error = new Error(`O CRS ${sourceCrs} não está entre os sistemas suportados nesta versão.`);
      error.code = 'CRS_UNSUPPORTED';
      throw error;
    }

    const swapAxis = sourceCrs === 'EPSG:4326' || sourceCrs === 'EPSG:4674' ? analysis.swapAxis : false;
    let changed = sourceCrs !== 'EPSG:4326' || swapAxis;
    collection.features.forEach((feature) => {
      if (!feature?.geometry?.coordinates) return;
      feature.geometry.coordinates = mapCoordinates(feature.geometry.coordinates, (coord) => transformPair(coord, sourceCrs, swapAxis));
      feature.properties = { ...(feature.properties || {}) };
    });
    collection.crs = { type: 'name', properties: { name: 'EPSG:4326' } };
    collection.properties = {
      ...(collection.properties || {}),
      georuralCrs: {
        source: sourceCrs,
        normalizedTo: 'EPSG:4326',
        axisSwapped: swapAxis,
        normalizedAt: new Date().toISOString()
      }
    };
    return { geojson: collection, changed, sourceCrs, targetCrs: 'EPSG:4326', axisSwapped: swapAxis, analysis };
  }

  registerDefinitions();

  window.GeoRuralCRS = Object.freeze({
    normalizeCode,
    analyzeGeoJSON,
    normalizeGeoJSON,
    supportedCrs: [...SUPPORTED],
    definitionFor(code) { return CRS_DEFINITIONS.get(normalizeCode(code) || String(code || '').toUpperCase()) || ''; },
    utmZoneForLongitude,
    sirgas2000UtmCodeForLngLat,
    projectToSirgasUtm
  });
})();
