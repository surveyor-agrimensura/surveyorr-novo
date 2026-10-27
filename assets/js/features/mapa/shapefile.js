(() => {
  'use strict';

  const VERSION = '1.0.0-rc.185.74';
  const BUILD = 'REV18-SEIA-STRICT';
  const BRAZIL_BOUNDS = Object.freeze({ minLng: -75.5, maxLng: -32.0, minLat: -35.5, maxLat: 7.5 });
  const BAHIA_BOUNDS = Object.freeze({ minLng: -46.9, maxLng: -37.0, minLat: -18.5, maxLat: -8.3 });

  const WKT = Object.freeze({
    'EPSG:4326': 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',
    'EPSG:4674': 'GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_Americas_2000",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6674"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4674"]]'
  });

  const PROFILES = Object.freeze([
    Object.freeze({
      id: 'seia-cefir-ba',
      label: 'SEIA / CEFIR — Bahia',
      shortLabel: 'SEIA / CEFIR',
      description: 'Pacote poligonal com estrutura simples para os sistemas ambientais da Bahia.',
      geometry: 'polygon',
      crs: 'EPSG:4674',
      crsLabel: 'SIRGAS 2000 geográfico (EPSG:4674)',
      encoding: 'WINDOWS-1252',
      cpg: '1252',
      fileSuffix: 'seia-cefir',
      stateCode: 'BA',
      strictRoot: true,
      seiaStrict: true,
      exactBaseName: 'shapeImovelRural',
      includeCpg: false,
      warning: 'No SEIA/CEFIR, extraia o ZIP e selecione juntos os quatro arquivos shapeImovelRural.shp, shapeImovelRural.shx, shapeImovelRural.dbf e shapeImovelRural.prj.'
    }),
    Object.freeze({
      id: 'sicar-car',
      label: 'SICAR / CAR — Brasil',
      shortLabel: 'SICAR / CAR',
      description: 'Pacote poligonal nacional no referencial oficial brasileiro.',
      geometry: 'polygon',
      crs: 'EPSG:4674',
      crsLabel: 'SIRGAS 2000 geográfico (EPSG:4674)',
      encoding: 'WINDOWS-1252',
      cpg: '1252',
      fileSuffix: 'sicar-car',
      strictRoot: true,
      warning: ''
    }),
    Object.freeze({
      id: 'sigef-incra',
      label: 'INCRA / SIGEF — arquivo de referência',
      shortLabel: 'INCRA / SIGEF',
      description: 'Shapefile de conferência no SIRGAS 2000. A certificação oficial continua usando a planilha ODS do SIGEF.',
      geometry: 'polygon',
      crs: 'EPSG:4674',
      crsLabel: 'SIRGAS 2000 geográfico (EPSG:4674)',
      encoding: 'WINDOWS-1252',
      cpg: '1252',
      fileSuffix: 'sigef-referencia',
      strictRoot: true,
      warning: 'Este SHP serve para conferência e interoperabilidade. O envio oficial para certificação no SIGEF é feito pela planilha ODS.'
    }),
    Object.freeze({
      id: 'qgis-arcgis',
      label: 'QGIS / ArcGIS / software SIG',
      shortLabel: 'QGIS / ArcGIS',
      description: 'Formato genérico moderno, preservando pontos, linhas e polígonos em conjuntos separados.',
      geometry: 'all',
      crs: 'EPSG:4326',
      crsLabel: 'WGS 84 geográfico (EPSG:4326)',
      encoding: 'UTF-8',
      cpg: 'UTF-8',
      fileSuffix: 'gis',
      strictRoot: true,
      warning: ''
    }),
    Object.freeze({
      id: 'other',
      label: 'Outro sistema',
      shortLabel: 'Outro sistema',
      description: 'Pacote Shapefile genérico com os componentes obrigatórios na raiz do ZIP.',
      geometry: 'all',
      crs: 'EPSG:4674',
      crsLabel: 'SIRGAS 2000 geográfico (EPSG:4674)',
      encoding: 'WINDOWS-1252',
      cpg: '1252',
      fileSuffix: 'shapefile',
      strictRoot: true,
      warning: ''
    })
  ]);

  const profileById = (id) => PROFILES.find((profile) => profile.id === id) || PROFILES[0];

  function safeBaseName(value) {
    return String(value || 'imovel')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .toLowerCase() || 'imovel';
  }

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function toFeatureCollection(value) {
    const input = clone(value || {});
    if (input.type === 'FeatureCollection' && Array.isArray(input.features)) return input;
    if (input.type === 'Feature') return { type: 'FeatureCollection', features: [input] };
    if (input.type && input.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: input }] };
    throw new Error('Não foi possível localizar as geometrias para exportação.');
  }

  function numberPair(coord) {
    const x = Number(coord?.[0]);
    const y = Number(coord?.[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }

  function samePoint(a, b, tolerance = 1e-12) {
    return Boolean(a && b && Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance);
  }

  function cleanCoordinateSequence(coords, close = false) {
    const clean = [];
    (coords || []).forEach((coord) => {
      const pair = numberPair(coord);
      if (!pair) return;
      if (!clean.length || !samePoint(clean[clean.length - 1], pair)) clean.push(pair);
    });
    if (close && clean.length >= 3 && !samePoint(clean[0], clean[clean.length - 1])) clean.push([...clean[0]]);
    return clean;
  }

  function signedRingArea(coords) {
    let sum = 0;
    for (let i = 0; i < coords.length - 1; i += 1) sum += (coords[i][0] * coords[i + 1][1]) - (coords[i + 1][0] * coords[i][1]);
    return sum / 2;
  }

  function orientRing(coords, hole = false) {
    const ring = cleanCoordinateSequence(coords, true);
    if (ring.length < 4) return [];
    const clockwise = signedRingArea(ring) < 0;
    if ((!hole && !clockwise) || (hole && clockwise)) ring.reverse();
    return ring;
  }

  function orientation(a, b, c) {
    const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
    if (Math.abs(value) < 1e-12) return 0;
    return value > 0 ? 1 : 2;
  }

  function onSegment(a, b, c) {
    return b[0] <= Math.max(a[0], c[0]) + 1e-12 && b[0] + 1e-12 >= Math.min(a[0], c[0])
      && b[1] <= Math.max(a[1], c[1]) + 1e-12 && b[1] + 1e-12 >= Math.min(a[1], c[1]);
  }

  function segmentsIntersect(a1, a2, b1, b2) {
    const o1 = orientation(a1, a2, b1);
    const o2 = orientation(a1, a2, b2);
    const o3 = orientation(b1, b2, a1);
    const o4 = orientation(b1, b2, a2);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(a1, b1, a2)) return true;
    if (o2 === 0 && onSegment(a1, b2, a2)) return true;
    if (o3 === 0 && onSegment(b1, a1, b2)) return true;
    if (o4 === 0 && onSegment(b1, a2, b2)) return true;
    return false;
  }

  function ringSelfIntersects(ring) {
    const segmentCount = ring.length - 1;
    for (let i = 0; i < segmentCount; i += 1) {
      for (let j = i + 1; j < segmentCount; j += 1) {
        if (Math.abs(i - j) <= 1) continue;
        if (i === 0 && j === segmentCount - 1) continue;
        if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
      }
    }
    return false;
  }

  function normalizeGeometry(geometry, featureLabel, issues) {
    const type = String(geometry?.type || '');
    const output = { type, coordinates: null };
    if (type === 'Point') {
      const point = numberPair(geometry.coordinates);
      if (!point) issues.push(`${featureLabel}: ponto sem coordenadas válidas.`);
      output.coordinates = point;
      return output;
    }
    if (type === 'MultiPoint') {
      output.coordinates = (geometry.coordinates || []).map(numberPair).filter(Boolean);
      if (!output.coordinates.length) issues.push(`${featureLabel}: conjunto de pontos vazio.`);
      return output;
    }
    if (type === 'LineString') {
      output.coordinates = cleanCoordinateSequence(geometry.coordinates, false);
      if (output.coordinates.length < 2) issues.push(`${featureLabel}: linha precisa ter pelo menos dois vértices.`);
      return output;
    }
    if (type === 'MultiLineString') {
      output.coordinates = (geometry.coordinates || []).map((line) => cleanCoordinateSequence(line, false)).filter((line) => line.length >= 2);
      if (!output.coordinates.length) issues.push(`${featureLabel}: conjunto de linhas vazio.`);
      return output;
    }
    if (type === 'Polygon') {
      output.coordinates = (geometry.coordinates || []).map((ring, index) => orientRing(ring, index > 0)).filter((ring) => ring.length >= 4);
      if (!output.coordinates.length) issues.push(`${featureLabel}: polígono precisa ter pelo menos três vértices distintos.`);
      output.coordinates.forEach((ring) => {
        if (Math.abs(signedRingArea(ring)) < 1e-15) issues.push(`${featureLabel}: polígono sem área válida.`);
        if (ringSelfIntersects(ring)) issues.push(`${featureLabel}: polígono possui auto-interseção.`);
      });
      return output;
    }
    if (type === 'MultiPolygon') {
      output.coordinates = (geometry.coordinates || []).map((polygon) => (polygon || []).map((ring, index) => orientRing(ring, index > 0)).filter((ring) => ring.length >= 4)).filter((polygon) => polygon.length);
      if (!output.coordinates.length) issues.push(`${featureLabel}: multipolígono vazio.`);
      output.coordinates.flat().forEach((ring) => {
        if (Math.abs(signedRingArea(ring)) < 1e-15) issues.push(`${featureLabel}: polígono sem área válida.`);
        if (ringSelfIntersects(ring)) issues.push(`${featureLabel}: polígono possui auto-interseção.`);
      });
      return output;
    }
    issues.push(`${featureLabel}: geometria ${type || 'desconhecida'} não é compatível com Shapefile.`);
    return null;
  }

  function visitCoordinates(value, callback) {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
      callback([Number(value[0]), Number(value[1])]);
      return;
    }
    value.forEach((item) => visitCoordinates(item, callback));
  }

  function insideBounds(point, bounds) {
    return point[0] >= bounds.minLng && point[0] <= bounds.maxLng && point[1] >= bounds.minLat && point[1] <= bounds.maxLat;
  }

  function validateAndNormalize(input, profile) {
    const source = toFeatureCollection(input);
    const issues = [];
    const warnings = [];
    const features = [];
    let ignored = 0;

    source.features.forEach((feature, index) => {
      if (!feature?.geometry) return;
      const label = String(feature.properties?.name || feature.properties?.nome || `Elemento ${index + 1}`);
      const geometry = normalizeGeometry(feature.geometry, label, issues);
      if (!geometry) return;
      const polygon = geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
      if (profile.geometry === 'polygon' && !polygon) {
        ignored += 1;
        return;
      }
      const next = { type: 'Feature', properties: { ...(feature.properties || {}) }, geometry };
      features.push(next);
    });

    if (!features.length) {
      if (profile.geometry === 'polygon') issues.push('O destino escolhido exige pelo menos um polígono válido.');
      else issues.push('Nenhuma geometria válida foi encontrada.');
    }

    const points = [];
    features.forEach((feature) => visitCoordinates(feature.geometry?.coordinates, (point) => points.push(point)));
    const invalidGeographic = points.some(([lng, lat]) => Math.abs(lng) > 180 || Math.abs(lat) > 90);
    if (invalidGeographic) issues.push('As coordenadas não estão em longitude/latitude. Reabra o projeto com o sistema de referência correto antes de exportar.');
    if (profile.crs === 'EPSG:4674' && points.length && !points.some((point) => insideBounds(point, BRAZIL_BOUNDS))) issues.push('As coordenadas não parecem estar localizadas no território brasileiro.');
    if (profile.id === 'seia-cefir-ba' && points.length && !points.some((point) => insideBounds(point, BAHIA_BOUNDS))) warnings.push('A geometria não parece estar na Bahia. Confirme se o perfil SEIA/CEFIR foi escolhido corretamente.');
    if (ignored) warnings.push(`${ignored} elemento(s) que não são polígonos foram ignorados porque o sistema escolhido aceita a camada poligonal.`);
    if (profile.warning) warnings.push(profile.warning);

    return {
      featureCollection: {
        type: 'FeatureCollection',
        properties: { ...(source.properties || {}), exportProfile: profile.id, crs: profile.crs, generatedBy: `Surveyor ${VERSION}`, exportedAt: new Date().toISOString() },
        features
      },
      issues: [...new Set(issues)],
      warnings: [...new Set(warnings)],
      ignored
    };
  }

  function geometryKind(type) {
    if (type === 'Point' || type === 'MultiPoint') return 'point';
    if (type === 'LineString' || type === 'MultiLineString') return 'line';
    if (type === 'Polygon' || type === 'MultiPolygon') return 'polygon';
    return '';
  }

  function collectRecords(features, kind) {
    const records = [];
    (features || []).forEach((feature, featureIndex) => {
      if (geometryKind(feature.geometry?.type) !== kind) return;
      const geometry = feature.geometry || {};
      const record = { feature, props: feature.properties || {}, featureIndex, parts: [], points: [] };
      if (kind === 'point') {
        const coordinates = geometry.type === 'Point' ? [geometry.coordinates] : (geometry.coordinates || []);
        coordinates.forEach((coord) => {
          const pair = numberPair(coord);
          if (pair) records.push({ feature, props: record.props, featureIndex, x: pair[0], y: pair[1] });
        });
        return;
      }
      if (kind === 'line') {
        const lines = geometry.type === 'LineString' ? [geometry.coordinates] : (geometry.coordinates || []);
        lines.forEach((line) => {
          const clean = cleanCoordinateSequence(line, false);
          if (clean.length >= 2) { record.parts.push(clean); record.points.push(...clean); }
        });
      }
      if (kind === 'polygon') {
        const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : (geometry.coordinates || []);
        polygons.forEach((polygon) => (polygon || []).forEach((ring, index) => {
          const clean = orientRing(ring, index > 0);
          if (clean.length >= 4) { record.parts.push(clean); record.points.push(...clean); }
        }));
      }
      if (record.parts.length) records.push(record);
    });
    return records;
  }

  function bbox(records, kind) {
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
    const add = (x, y) => { xmin = Math.min(xmin, x); ymin = Math.min(ymin, y); xmax = Math.max(xmax, x); ymax = Math.max(ymax, y); };
    records.forEach((record) => {
      if (kind === 'point') add(record.x, record.y);
      else record.points.forEach(([x, y]) => add(x, y));
    });
    return Number.isFinite(xmin) ? { xmin, ymin, xmax, ymax } : { xmin: 0, ymin: 0, xmax: 0, ymax: 0 };
  }

  function writeHeader(view, lengthWords, shapeType, box) {
    view.setInt32(0, 9994, false);
    for (let offset = 4; offset <= 20; offset += 4) view.setInt32(offset, 0, false);
    view.setInt32(24, lengthWords, false);
    view.setInt32(28, 1000, true);
    view.setInt32(32, shapeType, true);
    view.setFloat64(36, box.xmin, true); view.setFloat64(44, box.ymin, true);
    view.setFloat64(52, box.xmax, true); view.setFloat64(60, box.ymax, true);
    for (let offset = 68; offset <= 92; offset += 8) view.setFloat64(offset, 0, true);
  }

  function recordLength(record, kind) { return kind === 'point' ? 20 : 44 + (4 * record.parts.length) + (16 * record.points.length); }

  function writeRecord(view, offset, recordNumber, record, kind, shapeType) {
    const bytes = recordLength(record, kind);
    view.setInt32(offset, recordNumber, false);
    view.setInt32(offset + 4, bytes / 2, false);
    let cursor = offset + 8;
    view.setInt32(cursor, shapeType, true); cursor += 4;
    if (kind === 'point') {
      view.setFloat64(cursor, record.x, true); cursor += 8;
      view.setFloat64(cursor, record.y, true);
      return offset + 8 + bytes;
    }
    const box = bbox([record], kind);
    view.setFloat64(cursor, box.xmin, true); cursor += 8;
    view.setFloat64(cursor, box.ymin, true); cursor += 8;
    view.setFloat64(cursor, box.xmax, true); cursor += 8;
    view.setFloat64(cursor, box.ymax, true); cursor += 8;
    view.setInt32(cursor, record.parts.length, true); cursor += 4;
    view.setInt32(cursor, record.points.length, true); cursor += 4;
    let pointIndex = 0;
    record.parts.forEach((part) => { view.setInt32(cursor, pointIndex, true); cursor += 4; pointIndex += part.length; });
    record.points.forEach(([x, y]) => { view.setFloat64(cursor, x, true); cursor += 8; view.setFloat64(cursor, y, true); cursor += 8; });
    return offset + 8 + bytes;
  }

  function buildShape(records, kind) {
    const shapeType = kind === 'point' ? 1 : kind === 'line' ? 3 : 5;
    const lengths = records.map((record) => recordLength(record, kind));
    const shpBytes = 100 + lengths.reduce((sum, length) => sum + 8 + length, 0);
    const shxBytes = 100 + records.length * 8;
    const shp = new ArrayBuffer(shpBytes);
    const shx = new ArrayBuffer(shxBytes);
    const shpView = new DataView(shp);
    const shxView = new DataView(shx);
    const box = bbox(records, kind);
    writeHeader(shpView, shpBytes / 2, shapeType, box);
    writeHeader(shxView, shxBytes / 2, shapeType, box);
    let shpOffset = 100;
    let shxOffset = 100;
    records.forEach((record, index) => {
      shxView.setInt32(shxOffset, shpOffset / 2, false);
      shxView.setInt32(shxOffset + 4, lengths[index] / 2, false);
      shxOffset += 8;
      shpOffset = writeRecord(shpView, shpOffset, index + 1, record, kind, shapeType);
    });
    return { shp, shx };
  }

  const CP1252_EXTRA = Object.freeze({
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
    0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91,
    0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98,
    0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
  });

  function encodeText(value, encoding) {
    const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
    if (encoding === 'UTF-8') return new TextEncoder().encode(text);
    const bytes = [];
    for (const char of text) {
      const code = char.codePointAt(0);
      if (code <= 0xFF) bytes.push(code);
      else bytes.push(CP1252_EXTRA[code] ?? 0x3F);
    }
    return Uint8Array.from(bytes);
  }

  function fitText(value, width, encoding) {
    let text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
    let bytes = encodeText(text, encoding);
    while (bytes.length > width && text.length) { text = text.slice(0, -1); bytes = encodeText(text, encoding); }
    const out = new Uint8Array(width).fill(32);
    out.set(bytes.slice(0, width));
    return out;
  }

  function formatNumber(value, width, decimals) {
    const number = Number(value);
    const text = Number.isFinite(number) ? number.toFixed(decimals) : '';
    return text.slice(0, width).padStart(width, ' ');
  }

  function haversine(a, b) {
    const rad = Math.PI / 180;
    const lat1 = a[1] * rad, lat2 = b[1] * rad;
    const dLat = (b[1] - a[1]) * rad;
    const dLng = (b[0] - a[0]) * rad;
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  function ringAreaSquareMeters(ring) {
    if (!ring || ring.length < 4) return 0;
    const rad = Math.PI / 180;
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const p1 = ring[i], p2 = ring[i + 1];
      sum += (p2[0] - p1[0]) * rad * (2 + Math.sin(p1[1] * rad) + Math.sin(p2[1] * rad));
    }
    return Math.abs(sum * 6378137 * 6378137 / 2);
  }

  function geometryStats(feature) {
    const geometry = feature?.geometry || {};
    let area = 0, perimeter = 0, vertices = 0;
    const lineLength = (line) => {
      vertices += line.length;
      for (let i = 0; i < line.length - 1; i += 1) perimeter += haversine(line[i], line[i + 1]);
    };
    if (geometry.type === 'Polygon') {
      (geometry.coordinates || []).forEach((ring, index) => { lineLength(ring); area += (index ? -1 : 1) * ringAreaSquareMeters(ring); });
    } else if (geometry.type === 'MultiPolygon') {
      (geometry.coordinates || []).forEach((polygon) => polygon.forEach((ring, index) => { lineLength(ring); area += (index ? -1 : 1) * ringAreaSquareMeters(ring); }));
    } else if (geometry.type === 'LineString') lineLength(geometry.coordinates || []);
    else if (geometry.type === 'MultiLineString') (geometry.coordinates || []).forEach(lineLength);
    else if (geometry.type === 'Point') vertices = 1;
    else if (geometry.type === 'MultiPoint') vertices = (geometry.coordinates || []).length;
    return { areaHa: Math.max(0, area) / 10000, perimeterM: perimeter, vertices };
  }

  function seiaFeaturePriority(feature) {
    const props = feature?.properties || {};
    const haystack = [props.category, props.categoria, props.categoryLabel, props.name, props.nome, props.tipo]
      .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/\b(property|propriedade|imovel|limite|perimetro|perimetro total|area total)\b/.test(haystack)) return 3;
    if (/\b(gleba|terreno)\b/.test(haystack)) return 2;
    return 1;
  }

  function polygonAreaScore(feature) {
    try { return Number(geometryStats(feature).areaHa || 0); } catch { return 0; }
  }

  function normalizeSeiaBoundaryFeature(feature, warnings = []) {
    if (!feature?.geometry) return feature;
    if (feature.geometry.type === 'Polygon') return feature;
    if (feature.geometry.type !== 'MultiPolygon') return feature;
    const polygons = Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates : [];
    if (!polygons.length) return feature;
    const scored = polygons.map((coords, index) => ({
      index,
      coords,
      area: polygonAreaScore({ type: 'Feature', properties: feature.properties || {}, geometry: { type: 'Polygon', coordinates: coords } })
    })).sort((a, b) => b.area - a.area);
    const chosen = scored[0];
    if (polygons.length > 1) warnings.push(`O limite SEIA continha ${polygons.length} partes. Foi exportada somente a maior parte contínua para manter um único polígono de limite do imóvel.`);
    return { ...feature, geometry: { type: 'Polygon', coordinates: chosen.coords } };
  }

  function selectSeiaBoundary(features, warnings = []) {
    const polygons = (features || []).filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type));
    if (!polygons.length) return [];
    const ranked = polygons.map((feature, index) => ({
      feature,
      index,
      priority: seiaFeaturePriority(feature),
      area: polygonAreaScore(feature)
    })).sort((a, b) => (b.priority - a.priority) || (b.area - a.area) || (a.index - b.index));
    const chosen = ranked[0]?.feature;
    if (polygons.length > 1) warnings.push(`O projeto possui ${polygons.length} feições poligonais. Para o limite do imóvel no SEIA/CEFIR foi escolhida automaticamente a feição de maior prioridade/área.`);
    return chosen ? [normalizeSeiaBoundaryFeature(chosen, warnings)] : [];
  }

  function validateBinaryShapeSet({ shp, shx, dbf, prj }, kind, profile) {
    const failures = [];
    const expectedShapeType = kind === 'point' ? 1 : kind === 'line' ? 3 : 5;
    try {
      const shpView = new DataView(shp);
      const shxView = new DataView(shx);
      const dbfView = new DataView(dbf);
      if (shp.byteLength < 108) failures.push('.shp está vazio ou incompleto.');
      if (shx.byteLength < 108) failures.push('.shx está vazio ou incompleto.');
      if (dbf.byteLength < 34) failures.push('.dbf está vazio ou incompleto.');
      if (shpView.getInt32(0, false) !== 9994) failures.push('.shp não possui cabeçalho ESRI válido.');
      if (shxView.getInt32(0, false) !== 9994) failures.push('.shx não possui cabeçalho ESRI válido.');
      if (shpView.getInt32(28, true) !== 1000) failures.push('.shp não possui versão ESRI 1000.');
      if (shpView.getInt32(32, true) !== expectedShapeType) failures.push(`.shp possui tipo geométrico ${shpView.getInt32(32, true)}; esperado ${expectedShapeType}.`);
      if (shxView.getInt32(32, true) !== expectedShapeType) failures.push('.shx não corresponde ao tipo geométrico do .shp.');
      if (shpView.getInt32(24, false) * 2 !== shp.byteLength) failures.push('Tamanho declarado do .shp não confere com o arquivo gerado.');
      if (shxView.getInt32(24, false) * 2 !== shx.byteLength) failures.push('Tamanho declarado do .shx não confere com o arquivo gerado.');
      const shxRecords = Math.max(0, (shx.byteLength - 100) / 8);
      const dbfRecords = dbfView.getUint32(4, true);
      if (!Number.isInteger(shxRecords) || shxRecords < 1) failures.push('.shx não possui índice de feições.');
      if (dbfRecords !== shxRecords) failures.push(`Quantidade de registros difere entre .dbf (${dbfRecords}) e .shx (${shxRecords}).`);
      if (profile?.seiaStrict && expectedShapeType !== 5) failures.push('SEIA/CEFIR exige polígono para o limite do imóvel.');
      if (profile?.seiaStrict && !/SIRGAS\s*2000/i.test(String(prj || ''))) failures.push('.prj não identifica SIRGAS 2000.');
    } catch (error) {
      failures.push(`Falha ao validar binários Shapefile: ${error.message || error}`);
    }
    if (failures.length) {
      const error = new Error(`Pacote Shapefile inválido: ${failures.join(' ')}`);
      error.code = 'SHAPEFILE_BINARY_VALIDATION_FAILED';
      error.failures = failures;
      throw error;
    }
    return true;
  }

  function buildDbf(records, kind, profile, context = {}) {
    const fields = [
      { name: 'ID', type: 'N', width: 10, decimals: 0 },
      { name: 'NOME', type: 'C', width: 80, decimals: 0 },
      { name: 'CATEGORIA', type: 'C', width: 40, decimals: 0 },
      { name: 'MUNICIPIO', type: 'C', width: 60, decimals: 0 },
      { name: 'UF', type: 'C', width: 2, decimals: 0 },
      { name: 'AREA_HA', type: 'N', width: 18, decimals: 4 },
      { name: 'PERIM_M', type: 'N', width: 18, decimals: 2 },
      { name: 'VERTICES', type: 'N', width: 10, decimals: 0 }
    ];
    const headerLength = 32 + fields.length * 32 + 1;
    const recordLengthBytes = 1 + fields.reduce((sum, field) => sum + field.width, 0);
    const buffer = new ArrayBuffer(headerLength + records.length * recordLengthBytes + 1);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const now = new Date();
    view.setUint8(0, 0x03);
    view.setUint8(1, now.getFullYear() - 1900); view.setUint8(2, now.getMonth() + 1); view.setUint8(3, now.getDate());
    view.setUint32(4, records.length, true); view.setUint16(8, headerLength, true); view.setUint16(10, recordLengthBytes, true);
    view.setUint8(29, profile.encoding === 'WINDOWS-1252' ? 0x57 : 0x00);
    let offset = 32;
    fields.forEach((field) => {
      bytes.set(new TextEncoder().encode(field.name.slice(0, 10)), offset);
      view.setUint8(offset + 11, field.type.charCodeAt(0));
      view.setUint8(offset + 16, field.width); view.setUint8(offset + 17, field.decimals);
      offset += 32;
    });
    view.setUint8(offset, 0x0D);
    offset = headerLength;
    records.forEach((record, index) => {
      const props = record.feature?.properties || record.props || {};
      const stats = geometryStats(record.feature || { geometry: kind === 'point' ? { type: 'Point', coordinates: [record.x, record.y] } : null });
      const values = {
        ID: index + 1,
        NOME: props.name || props.nome || context.propertyName || `Elemento ${index + 1}`,
        CATEGORIA: props.categoryLabel || props.categoria || props.category || '',
        MUNICIPIO: props.municipality || props.municipio || context.municipality || context.city || '',
        UF: String(props.stateCode || props.uf || context.stateCode || context.uf || '').toUpperCase().slice(0, 2),
        AREA_HA: stats.areaHa,
        PERIM_M: stats.perimeterM,
        VERTICES: stats.vertices
      };
      view.setUint8(offset, 0x20); offset += 1;
      fields.forEach((field) => {
        const value = field.type === 'N' ? formatNumber(values[field.name], field.width, field.decimals) : values[field.name];
        bytes.set(fitText(value, field.width, profile.encoding), offset);
        offset += field.width;
      });
    });
    view.setUint8(offset, 0x1A);
    return buffer;
  }

  function addSet(zip, base, records, kind, profile, context) {
    if (!records.length) return false;
    const shape = buildShape(records, kind);
    const dbf = buildDbf(records, kind, profile, context);
    const prj = WKT[profile.crs] || WKT['EPSG:4674'];
    validateBinaryShapeSet({ shp: shape.shp, shx: shape.shx, dbf, prj }, kind, profile);
    zip.file(`${base}.shp`, shape.shp);
    zip.file(`${base}.shx`, shape.shx);
    zip.file(`${base}.dbf`, dbf);
    zip.file(`${base}.prj`, prj);
    if (profile.includeCpg !== false) zip.file(`${base}.cpg`, profile.cpg);
    return true;
  }

  async function verifyZipBlob(blob, profile, base, expectedSets = 1) {
    if (!globalThis.JSZip?.loadAsync || !blob) return true;
    const loaded = await globalThis.JSZip.loadAsync(blob);
    const files = Object.keys(loaded.files || {}).filter((name) => !loaded.files[name]?.dir);
    if (profile?.seiaStrict) {
      const required = ['shp', 'shx', 'dbf', 'prj'].map((ext) => `${base}.${ext}`);
      const missing = required.filter((name) => !files.includes(name));
      const extras = files.filter((name) => !required.includes(name));
      if (missing.length || extras.length) {
        throw new Error(`Pacote SEIA inválido antes do download. Ausentes: ${missing.join(', ') || 'nenhum'}. Extras: ${extras.join(', ') || 'nenhum'}.`);
      }
      for (const name of required) {
        const bytes = await loaded.file(name)?.async('uint8array');
        if (!bytes?.length) throw new Error(`Pacote SEIA inválido: ${name} está vazio.`);
      }
    } else if (!files.length || expectedSets < 1) {
      throw new Error('O ZIP do Shapefile foi gerado sem arquivos válidos.');
    }
    return true;
  }

  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function exportWithProfile(options, profileId) {
    if (!globalThis.JSZip) throw new Error('A biblioteca ZIP não foi carregada. Atualize a página com Ctrl+F5.');
    const profile = profileById(profileId);
    const validation = validateAndNormalize(options.featureCollection, profile);
    if (validation.issues.length) {
      const error = new Error(`O Shapefile não foi gerado:\n• ${validation.issues.join('\n• ')}`);
      error.code = 'SHAPEFILE_VALIDATION_FAILED';
      error.issues = validation.issues;
      error.warnings = validation.warnings;
      throw error;
    }
    if (profile.seiaStrict) {
      validation.featureCollection.features = selectSeiaBoundary(validation.featureCollection.features, validation.warnings);
      if (!validation.featureCollection.features.length) throw new Error('O SEIA/CEFIR exige um polígono válido para o limite do imóvel.');
    }
    const base = profile.exactBaseName || safeBaseName(options.baseName || options.context?.propertyName || 'imovel');
    const zip = new JSZip();
    const kinds = [
      ['polygon', 'poligonos'],
      ['line', 'linhas'],
      ['point', 'pontos']
    ];
    const available = kinds.map(([kind, suffix]) => ({ kind, suffix, records: collectRecords(validation.featureCollection.features, kind) })).filter((item) => item.records.length);
    if (!available.length) throw new Error('Nenhuma geometria compatível foi encontrada para o Shapefile.');
    if (profile.seiaStrict && (available.length !== 1 || available[0].kind !== 'polygon')) throw new Error('O pacote SEIA/CEFIR deve conter exatamente uma camada poligonal.');
    if (available.length === 1) addSet(zip, base, available[0].records, available[0].kind, profile, options.context || {});
    else available.forEach((item) => addSet(zip, `${base}_${item.suffix}`, item.records, item.kind, profile, options.context || {}));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    await verifyZipBlob(blob, profile, base, available.length);
    const filename = profile.seiaStrict ? 'shapeImovelRural-SEIA-CEFIR.zip' : `${base}-${profile.fileSuffix}.zip`;
    if (options.download !== false && typeof document !== 'undefined') downloadBlob(filename, blob);
    return { blob, filename, profile, validation, fileSets: available.length, featureCount: validation.featureCollection.features.length, baseName: base };
  }

  function preferredProfile(context = {}) {
    const state = String(context.stateCode || context.uf || '').toUpperCase();
    return state === 'BA' ? 'seia-cefir-ba' : 'sicar-car';
  }

  function profileIcon(profile) {
    if (profile.id === 'seia-cefir-ba') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h9l5 5v11H5z"/><path d="M14 4v5h5"/></svg>';
    if (profile.id === 'sicar-car') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16c5-5 8-9 14-12-1 8-5 13-11 15-2 0-3-1-3-3Z"/></svg>';
    if (profile.id === 'incra-sigef') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20V9l6-4 6 4v11M9 11h6"/></svg>';
    if (profile.id === 'software-gis') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="17" cy="12" r="1.5"/></svg>';
  }

  function profileIconTone(profile) {
    if (profile.id === 'seia-cefir-ba') return 'is-seia';
    if (profile.id === 'sicar-car') return 'is-car';
    if (profile.id === 'incra-sigef') return 'is-incra';
    if (profile.id === 'software-gis') return 'is-gis';
    return 'is-other';
  }

  function profileNote(profile) {
    if (profile.id === 'seia-cefir-ba') return 'Pacote poligonal com estrutura simples para os sistemas ambientais da Bahia.';
    if (profile.id === 'sicar-car') return 'Pacote poligonal nacional no referencial oficial brasileiro.';
    if (profile.id === 'incra-sigef') return 'Shapefile de conferência no SIRGAS 2000 para validação técnica.';
    if (profile.id === 'software-gis') return 'Formato genérico moderno, preservando pontos, linhas e polígonos em camadas separadas.';
    return 'Pacote Shapefile genérico com os componentes obrigatórios na raiz do ZIP.';
  }

  function ensureModalStyles() {
    if (typeof document === 'undefined' || document.getElementById('surveyor-shp-modal-style')) return;
    const style = document.createElement('style');
    style.id = 'surveyor-shp-modal-style';
    style.textContent = `
      .surveyor-shp-overlay{position:fixed;inset:0;z-index:100000;background:rgba(2,10,25,.72);display:grid;place-items:center;padding:12px}
      .surveyor-shp-modal{width:min(660px,calc(100vw - 24px));max-height:min(760px,calc(100vh - 24px));display:flex;flex-direction:column;overflow:hidden;background:#fff;color:#0f172a;border-radius:22px;box-shadow:0 24px 75px rgba(0,0,0,.36);border:1px solid #dbeafe}
      .surveyor-shp-head{flex:0 0 auto;padding:18px 22px 12px;border-bottom:1px solid #e2e8f0;position:relative}.surveyor-shp-head h2{margin:0 0 2px;font-size:20px;line-height:1.2}.surveyor-shp-head p{margin:0;color:#475569;font-size:14px}.surveyor-shp-close{position:absolute;right:18px;top:16px;width:36px;height:36px;border:0;background:transparent;color:#475569;font-size:28px;line-height:1;cursor:pointer}
      .surveyor-shp-list{min-height:0;overflow:auto;display:grid;gap:8px;padding:12px 22px}.surveyor-shp-option{display:grid;grid-template-columns:26px 48px 1fr;align-items:center;gap:12px;padding:12px 14px;border:1px solid #d6e0ec;border-radius:14px;cursor:pointer;background:#fff;transition:border-color .15s,background .15s,box-shadow .15s}.surveyor-shp-option:has(input:checked){border-color:#6fa2f8;background:#eff6ff;box-shadow:0 0 0 1px rgba(37,99,235,.09)}
      .surveyor-shp-option input{margin:0;width:18px;height:18px}.surveyor-shp-option strong{display:block;margin:0 0 2px;font-size:14px;line-height:1.22}.surveyor-shp-option small{display:block;color:#64748b;font-size:12px;line-height:1.35}.surveyor-shp-option-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;border:1px solid #d7e2ef;background:#f8fbff;color:#1f4fd1}.surveyor-shp-option-icon svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.surveyor-shp-option-icon.is-seia{background:#eff5ff;color:#225fbb}.surveyor-shp-option-icon.is-car{background:#edf9ef;color:#2f8c46}.surveyor-shp-option-icon.is-incra{background:#fff7ed;color:#c97900}.surveyor-shp-option-icon.is-gis{background:#f6f2ff;color:#6d42c8}.surveyor-shp-option-icon.is-other{background:#f8fafc;color:#64748b}
      .surveyor-shp-summary{flex:0 0 auto;margin:0 22px 10px;padding:12px 14px;border-radius:12px;background:#f5f9ff;border:1px solid #cfe0fb;font-size:12px;line-height:1.45}.surveyor-shp-summary b{color:#0f4fc9}
      .surveyor-shp-warning{flex:0 0 auto;margin:0 22px 10px;padding:12px 14px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;line-height:1.45}
      .surveyor-shp-actions{flex:0 0 auto;display:flex;justify-content:flex-end;gap:10px;padding:12px 22px 16px;border-top:1px solid #e2e8f0}.surveyor-shp-actions button{border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer}.surveyor-shp-cancel{background:#fff;border:1px solid #cbd5e1;color:#334155}.surveyor-shp-generate{display:inline-flex;align-items:center;gap:8px;background:#155fd8;border:1px solid #155fd8;color:#fff}.surveyor-shp-generate:disabled{opacity:.55;cursor:wait}
      @media(max-width:640px){.surveyor-shp-overlay{padding:6px}.surveyor-shp-modal{width:calc(100vw - 12px);max-height:calc(100vh - 12px);border-radius:12px}.surveyor-shp-head{padding:12px 14px 8px}.surveyor-shp-list{padding:8px 14px}.surveyor-shp-summary,.surveyor-shp-warning{margin-left:14px;margin-right:14px}.surveyor-shp-actions{padding-left:14px;padding-right:14px}}
      @media(max-height:680px){.surveyor-shp-modal{max-height:calc(100vh - 12px)}.surveyor-shp-head{padding-top:10px}.surveyor-shp-list{gap:5px;padding-top:7px;padding-bottom:7px}.surveyor-shp-option{padding-top:6px;padding-bottom:6px}.surveyor-shp-summary{margin-bottom:6px}.surveyor-shp-actions{padding-top:8px;padding-bottom:8px}}
    `;
    document.head.append(style);
  }

  function open(options = {}) {
    if (typeof document === 'undefined') return Promise.reject(new Error('A janela de exportação exige um navegador.'));
    ensureModalStyles();
    document.querySelector('.surveyor-shp-overlay')?.remove();
    const selected = preferredProfile(options.context || {});
    const overlay = document.createElement('div');
    overlay.className = 'surveyor-shp-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Exportar Shapefile');
    overlay.innerHTML = `
      <div class="surveyor-shp-modal">
        <div class="surveyor-shp-head"><h2>Exportar Shapefile</h2><p>Onde este arquivo será utilizado?</p><button type="button" class="surveyor-shp-close" aria-label="Fechar">×</button></div>
        <div class="surveyor-shp-list">
          ${PROFILES.map((profile) => `<label class="surveyor-shp-option"><input type="radio" name="surveyor-shp-profile" value="${profile.id}" ${profile.id === selected ? 'checked' : ''}><span class="surveyor-shp-option-icon ${profileIconTone(profile)}">${profileIcon(profile)}</span><span><strong>${profile.label}</strong><small>${profileNote(profile)}</small></span></label>`).join('')}
        </div>
        <div class="surveyor-shp-warning" hidden role="status" aria-live="polite"></div>
        <div class="surveyor-shp-actions"><button type="button" class="surveyor-shp-cancel">Cancelar</button><button type="button" class="surveyor-shp-generate"><span aria-hidden="true">⇩</span> <span>Validar e gerar</span></button></div>
      </div>`;
    document.body.append(overlay);
    const warning = overlay.querySelector('.surveyor-shp-warning');
    const generate = overlay.querySelector('.surveyor-shp-generate');
    const cancel = overlay.querySelector('.surveyor-shp-cancel');
    const closeButton = overlay.querySelector('.surveyor-shp-close');
    const update = () => {
      // A escolha do perfil já explica o destino. Mantemos esta área invisível
      // durante a seleção e a reutilizamos somente para erros de validação.
      warning.hidden = true;
      warning.textContent = '';
    };
    overlay.querySelectorAll('input[name="surveyor-shp-profile"]').forEach((input) => input.addEventListener('change', update));
    update();
    return new Promise((resolve, reject) => {
      const close = () => overlay.remove();
      cancel.addEventListener('click', () => { close(); resolve(null); });
      closeButton?.addEventListener('click', () => { close(); resolve(null); });
      overlay.addEventListener('click', (event) => { if (event.target === overlay) { close(); resolve(null); } });
      generate.addEventListener('click', async () => {
        generate.disabled = true;
        generate.textContent = 'Gerando...';
        try {
          const profileId = overlay.querySelector('input[name="surveyor-shp-profile"]:checked')?.value || selected;
          const result = await exportWithProfile(options, profileId);
          close();
          options.onStatus?.(`${result.filename} gerado com ${result.featureCount} elemento(s).`, 'success');
          if (result.validation.warnings.length) setTimeout(() => options.onStatus?.(result.validation.warnings.join(' '), 'warning'), 350);
          resolve(result);
        } catch (error) {
          generate.disabled = false;
          generate.textContent = 'Validar e gerar';
          warning.hidden = false;
          warning.textContent = error.message || 'Não foi possível gerar o Shapefile.';
          options.onStatus?.(error.message || 'Não foi possível gerar o Shapefile.', 'error');
          reject(error);
        }
      });
    });
  }

  globalThis.SurveyorShapefileExport = Object.freeze({ VERSION, BUILD, PROFILES, open, exportWithProfile, validateAndNormalize, safeBaseName, profileById, validateBinaryShapeSet, selectSeiaBoundary });
})();
