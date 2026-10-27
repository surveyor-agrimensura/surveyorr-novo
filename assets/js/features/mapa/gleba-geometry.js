(() => {
  'use strict';

  // SURVEYOR 1.0 — núcleo geométrico de glebas. Funções puras/algorítmicas extraídas do runtime
  // principal para manter o mapa menor e cada responsabilidade isolada.

  function glebaFeatureCoords(feature) {

    const g = feature?.geometry || {};

    if (g.type === 'Polygon') return g.coordinates.flat();

    if (g.type === 'MultiPolygon') return g.coordinates.flat(2);

    return [];

  }



  function glebaAllCoords(value) {

    if (value?.type === 'FeatureCollection') return (value.features || []).flatMap((feature) => glebaFeatureCoords(feature));

    return glebaFeatureCoords(value);

  }



  function glebaBBox(feature) {

    const coords = glebaFeatureCoords(feature);

    return coords.reduce((box, c) => [

      Math.min(box[0], c[0]), Math.min(box[1], c[1]),

      Math.max(box[2], c[0]), Math.max(box[3], c[1])

    ], [Infinity, Infinity, -Infinity, -Infinity]);

  }



  function glebaProjection(feature) {

    const coords = glebaFeatureCoords(feature);

    const center = coords.reduce((sum, c) => [sum[0] + c[0], sum[1] + c[1]], [0, 0]).map((v) => v / Math.max(coords.length, 1));

    const R = 6378137;

    const lon0 = center[0] * Math.PI / 180;

    const lat0 = center[1] * Math.PI / 180;

    const cos = Math.cos(lat0) || 1;

    return {

      toXY: ([lon, lat]) => [(lon * Math.PI / 180 - lon0) * R * cos, (lat * Math.PI / 180 - lat0) * R],

      toLngLat: ([x, y]) => [(x / (R * cos) + lon0) * 180 / Math.PI, (y / R + lat0) * 180 / Math.PI]

    };

  }



  function glebaMapCoordsDeep(value, fn) {

    if (!Array.isArray(value)) return value;

    if (typeof value[0] === 'number' && typeof value[1] === 'number') return fn(value);

    return value.map((item) => glebaMapCoordsDeep(item, fn));

  }



  function glebaTransformFeature(feature, fn) {

    return {

      type: 'Feature',

      properties: { ...(feature.properties || {}) },

      geometry: { type: feature.geometry.type, coordinates: glebaMapCoordsDeep(feature.geometry.coordinates, fn) }

    };

  }



  function glebaRotatePoint([x, y], deg) {

    if (!deg) return [x, y];

    const a = deg * Math.PI / 180;

    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

  }



  function glebaRotateFeature(feature, deg) {

    return glebaTransformFeature(feature, (coord) => glebaRotatePoint(coord, deg));

  }



  function glebaRingArea(ring) {

    let sum = 0;

    for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];

    return sum / 2;

  }



  function glebaGeometryArea(geometry) {

    if (!geometry) return 0;

    if (geometry.type === 'Polygon') {

      const rings = geometry.coordinates || [];

      if (!rings.length) return 0;

      return Math.abs(glebaRingArea(rings[0] || [])) - rings.slice(1).reduce((sum, ring) => sum + Math.abs(glebaRingArea(ring || [])), 0);

    }

    if (geometry.type === 'MultiPolygon') return geometry.coordinates.reduce((sum, poly) => sum + glebaGeometryArea({ type: 'Polygon', coordinates: poly }), 0);

    return 0;

  }



  function glebaGeometryLength(geometry) {

    const rings = geometry?.type === 'Polygon' ? [geometry.coordinates?.[0] || []] : geometry?.type === 'MultiPolygon' ? geometry.coordinates.map((poly) => poly[0] || []) : [];

    let total = 0;

    rings.forEach((ring) => {

      for (let i = 0; i < ring.length - 1; i++) total += Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]);

    });

    return total;

  }



  function glebaVertexCount(geometry) {

    if (geometry?.type === 'Polygon') return Math.max((geometry.coordinates?.[0] || []).length - 1, 0);

    if (geometry?.type === 'MultiPolygon') return geometry.coordinates.reduce((sum, poly) => sum + Math.max((poly[0] || []).length - 1, 0), 0);

    return 0;

  }



  function glebaRectangle(minX, minY, maxX, maxY) {

    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]] } };

  }



  function glebaSafeIntersect(a, b) {

    if (!window.turf?.intersect) throw new Error('Turf.js não carregou.');

    try { return turf.intersect(turf.featureCollection([a, b])); }

    catch (error) {

      try { return turf.intersect(a, b); }

      catch (second) { console.warn('[GeoRural Glebas] Interseção falhou:', error, second); return null; }

    }

  }



  function glebaStripIntersection(feature, min, max, axis, bbox, pad) {

    const rect = axis === 'y'

      ? glebaRectangle(bbox[0] - pad, min, bbox[2] + pad, max)

      : glebaRectangle(min, bbox[1] - pad, max, bbox[3] + pad);

    return glebaSafeIntersect(feature, rect);

  }



  function glebaCumulativeArea(feature, value, axis, bbox, pad) {

    const strip = axis === 'y'

      ? glebaStripIntersection(feature, bbox[1] - pad, value, axis, bbox, pad)

      : glebaStripIntersection(feature, bbox[0] - pad, value, axis, bbox, pad);

    return strip ? glebaGeometryArea(strip.geometry) : 0;

  }



  function glebaCutoffForArea(feature, targetArea, totalArea, axis, bbox, pad) {

    // v21.9.37: para corte por linha guia/área igual, a busca precisa ocorrer

    // dentro do envelope real da área. Antes ela começava no bbox com padding,

    // criando longos trechos vazios e podendo gerar cortes visualmente

    // desproporcionais em imóveis inclinados ou irregulares.

    const min = axis === 'y' ? bbox[1] : bbox[0];

    const max = axis === 'y' ? bbox[3] : bbox[2];

    if (targetArea <= 0) return min;

    if (targetArea >= totalArea) return max;

    let lo = min, hi = max;

    let best = min;

    let bestDiff = Infinity;

    for (let i = 0; i < 56; i++) {

      const mid = (lo + hi) / 2;

      const area = glebaCumulativeArea(feature, mid, axis, bbox, pad);

      const diff = Math.abs(area - targetArea);

      if (diff < bestDiff) { best = mid; bestDiff = diff; }

      if (area < targetArea) lo = mid; else hi = mid;

    }

    return best;

  }



  function glebaCutTypeLabel(type) {

    const labels = {

      'area-strips': 'Corte reto',

      'frontage-guide': 'Desenhar frente/acesso'

    };

    return labels[type] || 'Corte reto';

  }



  function glebaFeatureCenter(feature, bbox = glebaBBox(feature)) {

    try {

      const centroid = window.turf?.centroid?.(feature);

      const c = centroid?.geometry?.coordinates;

      if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) return c;

    } catch (_) {}

    const coords = glebaFeatureCoords(feature);

    if (coords.length) {

      const sum = coords.reduce((acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]], [0, 0]);

      return [sum[0] / coords.length, sum[1] / coords.length];

    }

    return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];

  }



  function glebaCollectPiece(part, pieces, targetM2 = 0, minAreaM2 = 1) {

    const areaM2 = part?.geometry ? glebaGeometryArea(part.geometry) : 0;

    if (!part?.geometry || areaM2 < minAreaM2) return;

    pieces.push({ feature: part, areaM2, perimeterM: glebaGeometryLength(part.geometry), targetM2 });

  }



  function glebaClipAndCollect(projected, cutter, pieces, targetM2 = 0, minAreaM2 = 1) {

    const part = glebaSafeIntersect(projected, cutter);

    glebaCollectPiece(part, pieces, targetM2, minAreaM2);

  }



  function glebaWedge(origin, startDeg, endDeg, radius) {

    const toPoint = (deg) => {

      const a = deg * Math.PI / 180;

      return [origin[0] + Math.cos(a) * radius, origin[1] + Math.sin(a) * radius];

    };

    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[origin, toPoint(startDeg), toPoint(endDeg), origin]] } };

  }



  function glebaRadialOrigin(type, bbox, pad) {

    const cx = (bbox[0] + bbox[2]) / 2;

    const cy = (bbox[1] + bbox[3]) / 2;

    if (type === 'fan-west') return [bbox[0] - pad * 0.8, cy];

    if (type === 'fan-east') return [bbox[2] + pad * 0.8, cy];

    if (type === 'fan-south') return [cx, bbox[1] - pad * 0.8];

    if (type === 'fan-north') return [cx, bbox[3] + pad * 0.8];

    return [cx, cy];

  }



  function glebaFanAngleRange(type) {

    if (type === 'fan-west') return [-72, 72];

    if (type === 'fan-east') return [108, 252];

    if (type === 'fan-south') return [18, 162];

    if (type === 'fan-north') return [198, 342];

    return [0, 360];

  }



  function buildGlebaPiecesByStrips(projected, bbox, pad, resolved, targetAreas, widthBased = false) {

    const pieces = [];

    const count = targetAreas.length;

    let cuts = [];

    if (widthBased) {

      const min = resolved.axis === 'y' ? bbox[1] : bbox[0];

      const max = resolved.axis === 'y' ? bbox[3] : bbox[2];

      cuts = Array.from({ length: count + 1 }, (_, i) => min + (max - min) * (i / count));

    } else {

      cuts = [resolved.axis === 'y' ? bbox[1] - pad : bbox[0] - pad];

      let cumulative = 0;

      const totalArea = glebaGeometryArea(projected.geometry) || targetAreas.reduce((sum, value) => sum + value, 0);

      const targetSum = targetAreas.reduce((sum, value) => sum + value, 0) || totalArea;

      const normalizedTargets = targetAreas.map((value) => value * (totalArea / targetSum));

      for (let i = 0; i < normalizedTargets.length - 1; i++) {

        cumulative += normalizedTargets[i];

        cuts.push(glebaCutoffForArea(projected, cumulative, totalArea, resolved.axis, bbox, pad));

      }

      cuts.push(resolved.axis === 'y' ? bbox[3] + pad : bbox[2] + pad);

      targetAreas = normalizedTargets;

    }

    for (let i = 0; i < cuts.length - 1; i++) {

      const part = glebaStripIntersection(projected, cuts[i], cuts[i + 1], resolved.axis, bbox, pad);

      // v21.9.37: a interseção do strip já é a gleba; não intersectar de novo

      // evita perda/alteração de área em geometrias estreitas.

      glebaCollectPiece(part, pieces, targetAreas[i] || 0);

    }

    return pieces;

  }



  function buildGlebaPiecesByGrid(projected, bbox, pad, count) {

    const pieces = [];

    const cols = Math.ceil(Math.sqrt(count));

    const rows = Math.ceil(count / cols);

    const minX = bbox[0] - pad;

    const maxX = bbox[2] + pad;

    const minY = bbox[1] - pad;

    const maxY = bbox[3] + pad;

    for (let row = 0; row < rows; row++) {

      for (let col = 0; col < cols; col++) {

        const x1 = minX + ((maxX - minX) * col / cols);

        const x2 = minX + ((maxX - minX) * (col + 1) / cols);

        const y1 = minY + ((maxY - minY) * row / rows);

        const y2 = minY + ((maxY - minY) * (row + 1) / rows);

        glebaClipAndCollect(projected, glebaRectangle(x1, y1, x2, y2), pieces);

      }

    }

    return pieces.filter((item) => item.areaM2 > 1);

  }



  function buildGlebaPiecesByRadial(projected, bbox, pad, type, count) {

    const pieces = [];

    const extent = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1], 1000);

    const radius = extent * 4 + pad;

    const origin = type === 'radial-center' ? glebaFeatureCenter(projected, bbox) : glebaRadialOrigin(type, bbox, pad);

    const [start, end] = glebaFanAngleRange(type);

    const span = end - start;

    for (let i = 0; i < count; i++) {

      const a1 = start + span * (i / count);

      const a2 = start + span * ((i + 1) / count);

      glebaClipAndCollect(projected, glebaWedge(origin, a1, a2, radius), pieces);

    }

    return pieces.filter((item) => item.areaM2 > 1);

  }



  function glebaNormalizedRingCoords(geometry) {

    const ring = geometry?.type === 'Polygon'

      ? (geometry.coordinates?.[0] || [])

      : geometry?.type === 'MultiPolygon'

        ? (geometry.coordinates?.[0]?.[0] || [])

        : [];

    if (!ring.length) return [];

    const clean = ring.filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (clean.length > 1) {

      const first = clean[0], last = clean[clean.length - 1];

      if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) clean.pop();

    }

    return clean;

  }



  function glebaAverageGuideVector(coords) {

    const clean = (coords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (clean.length < 2) return [1, 0];

    const first = clean[0];

    const last = clean[clean.length - 1];

    let dx = last[0] - first[0];

    let dy = last[1] - first[1];

    const len = Math.hypot(dx, dy) || 1;

    dx /= len; dy /= len;

    return [dx, dy];

  }



  function glebaPointToSegmentDistance(point, a, b) {

    const dx = b[0] - a[0], dy = b[1] - a[1];

    const len2 = dx * dx + dy * dy;

    if (!len2) return Math.hypot(point[0] - a[0], point[1] - a[1]);

    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2));

    const px = a[0] + dx * t, py = a[1] + dy * t;

    return Math.hypot(point[0] - px, point[1] - py);

  }



  function glebaDistanceToBoundary(point, ring) {

    let best = Infinity;

    for (let i = 0; i < ring.length; i++) {

      const a = ring[i];

      const b = ring[(i + 1) % ring.length];

      best = Math.min(best, glebaPointToSegmentDistance(point, a, b));

    }

    return best;

  }



  function glebaMeasureFrontBack(sourceProjected, partProjected, directionVector = [1, 0], frontageGuideCoords = []) {

    const sourceRing = glebaNormalizedRingCoords(sourceProjected?.geometry);

    const ring = glebaNormalizedRingCoords(partProjected?.geometry);

    if (sourceRing.length < 2 || ring.length < 2) return { frontMeters: null, backMeters: null, frontPoint: null, backPoint: null };



    const [dx, dy] = (() => {

      const len = Math.hypot(directionVector?.[0] || 0, directionVector?.[1] || 0) || 1;

      return [(directionVector?.[0] || 1) / len, (directionVector?.[1] || 0) / len];

    })();



    const makeCandidate = (a, b) => {

      const mx = (a[0] + b[0]) / 2;

      const my = (a[1] + b[1]) / 2;

      return {

        len: Math.hypot(b[0] - a[0], b[1] - a[1]),

        score: mx * dx + my * dy,

        point: [mx, my]

      };

    };



    const weightedPoint = (items) => {

      const valid = (items || []).filter((item) => item?.point && Number.isFinite(item.len) && item.len > 0);

      const sumLen = valid.reduce((sum, item) => sum + item.len, 0);

      if (!(sumLen > 0)) return null;

      return [

        valid.reduce((sum, item) => sum + item.point[0] * item.len, 0) / sumLen,

        valid.reduce((sum, item) => sum + item.point[1] * item.len, 0) / sumLen

      ];

    };



    const bbox = glebaBBox(partProjected);

    const extent = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1], 25);

    const boundaryTolerance = Math.max(1.2, Math.min(10, extent * 0.018));

    const exposed = [];



    for (let i = 0; i < ring.length; i++) {

      const a = ring[i];

      const b = ring[(i + 1) % ring.length];

      const candidate = makeCandidate(a, b);

      if (candidate.len < 0.15) continue;

      const dist = glebaDistanceToBoundary(candidate.point, sourceRing);

      if (dist <= boundaryTolerance) exposed.push(candidate);

    }



    const candidates = exposed.length ? exposed : ring.map((a, i) => makeCandidate(a, ring[(i + 1) % ring.length]))

      .filter((item) => item.len > 0.15);



    if (!candidates.length) return { frontMeters: null, backMeters: null, frontPoint: null, backPoint: null };

    const minScore = Math.min(...candidates.map((item) => item.score));

    const maxScore = Math.max(...candidates.map((item) => item.score));

    const span = Math.max(0.001, maxScore - minScore);

    const band = Math.max(0.8, span * 0.22);

    let frontSegments = candidates.filter((item) => item.score <= minScore + band);

    let backSegments = candidates.filter((item) => item.score >= maxScore - band);

    let frontMeters = frontSegments.reduce((sum, item) => sum + item.len, 0);

    let backMeters = backSegments.reduce((sum, item) => sum + item.len, 0);



    if (!frontMeters || !backMeters) {

      const sorted = [...candidates].sort((a, b) => b.len - a.len);

      if (!frontMeters && sorted[0]) { frontMeters = sorted[0].len; frontSegments = [sorted[0]]; }

      if (!backMeters && (sorted[1] || sorted[0])) { backMeters = (sorted[1] || sorted[0]).len; backSegments = [sorted[1] || sorted[0]]; }

    }



    // Quando a divisão foi feita com uma frente/acesso desenhada, ela é a

    // referência técnica mais confiável: a borda mais próxima é a frente e a

    // mais distante é o fundo. Isso evita trocar frente por lateral em lotes

    // inclinados ou curvos.

    const guide = (frontageGuideCoords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (guide.length >= 2) {

      const withDistance = candidates.map((item) => ({

        ...item,

        guideDistance: Math.min(...guide.slice(0, -1).map((point, index) => glebaPointToSegmentDistance(item.point, point, guide[index + 1])))

      })).filter((item) => Number.isFinite(item.guideDistance));

      if (withDistance.length) {

        const nearest = Math.min(...withDistance.map((item) => item.guideDistance));

        const farthest = Math.max(...withDistance.map((item) => item.guideDistance));

        const guideBand = Math.max(0.8, Math.min(8, (farthest - nearest) * 0.18));

        const guidedFront = withDistance.filter((item) => item.guideDistance <= nearest + guideBand);

        const guidedBack = withDistance.filter((item) => item.guideDistance >= farthest - guideBand);

        const guidedFrontMeters = guidedFront.reduce((sum, item) => sum + item.len, 0);

        const guidedBackMeters = guidedBack.reduce((sum, item) => sum + item.len, 0);

        if (guidedFrontMeters > 0 && guidedBackMeters > 0) {

          return {

            frontMeters: guidedFrontMeters,

            backMeters: guidedBackMeters,

            frontPoint: weightedPoint(guidedFront),

            backPoint: weightedPoint(guidedBack)

          };

        }

      }

    }



    return {

      frontMeters: Number.isFinite(frontMeters) ? frontMeters : null,

      backMeters: Number.isFinite(backMeters) ? backMeters : null,

      frontPoint: weightedPoint(frontSegments),

      backPoint: weightedPoint(backSegments)

    };

  }



  function glebaMeasureLatLng(value) {

    if (Array.isArray(value) && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {

      return L.latLng(Number(value[1]), Number(value[0]));

    }

    if (value && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng))) {

      return L.latLng(Number(value.lat), Number(value.lng));

    }

    return null;

  }



  function drawnSegmentCoordsFromLayer(layer) {

    try {

      const geometry = layer?.toGeoJSON?.()?.geometry;

      if (!geometry) return { coords: [], closed: false };

      let coords = [];

      let closed = false;

      if (geometry.type === 'Polygon') {

        coords = geometry.coordinates?.[0] || [];

        closed = true;

      } else if (geometry.type === 'MultiPolygon') {

        coords = geometry.coordinates?.[0]?.[0] || [];

        closed = true;

      } else if (geometry.type === 'LineString') {

        coords = geometry.coordinates || [];

        closed = false;

      } else if (geometry.type === 'MultiLineString') {

        coords = geometry.coordinates?.[0] || [];

        closed = false;

      }

      const clean = (coords || []).filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));

      if (closed && clean.length > 2) {

        const first = clean[0];

        const last = clean[clean.length - 1];

        if (first && last && Math.abs(Number(first[0]) - Number(last[0])) < 1e-12 && Math.abs(Number(first[1]) - Number(last[1])) < 1e-12) clean.pop();

      }

      return { coords: clean, closed };

    } catch {

      return { coords: [], closed: false };

    }

  }



  function glebaRingFromLayer(layer) {

    return drawnSegmentCoordsFromLayer(layer).coords;

  }



  function validGlebaLabelPoint(value) {

    if (!Array.isArray(value) || !Number.isFinite(Number(value[0])) || !Number.isFinite(Number(value[1]))) return null;

    return [Number(value[0]), Number(value[1])];

  }



  function frontBackLayerCenterPoint(layer) {

    try {

      const feature = layer?.toGeoJSON?.();

      if (!feature?.geometry || !/Polygon/.test(feature.geometry.type || '')) return null;

      const projection = glebaProjection(feature);

      const projected = glebaTransformFeature(feature, projection.toXY);

      const center = glebaFeatureCenter(projected);

      return center ? projection.toLngLat(center) : null;

    } catch {

      return null;

    }

  }



  function restoreLegacyFrontBackEdge(point, center, inwardFactor = 0.08) {

    if (!point || !center) return point;

    const divisor = 1 - inwardFactor;

    if (!(divisor > 0)) return point;

    return [

      (Number(point[0]) - Number(center[0]) * inwardFactor) / divisor,

      (Number(point[1]) - Number(center[1]) * inwardFactor) / divisor

    ];

  }



  function isFrontBackPolygonLayer(layer) {

    if (!layer?.toGeoJSON || layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.CircleMarker) return false;

    const type = String(layer.toGeoJSON?.()?.geometry?.type || '');

    return type === 'Polygon' || type === 'MultiPolygon';

  }



  function glebaCutLineToProjectedCoords(feature, proj) {

    return (feature?.geometry?.coordinates || [])

      .map((coord) => proj.toXY(coord))

      .filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

  }



  function glebaLineHalfPlane(lineCoords, bbox, pad, side = 1) {

    const coords = (lineCoords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (coords.length < 2) return null;

    let p1 = coords[0];

    let p2 = coords[coords.length - 1];

    for (let i = coords.length - 2; i >= 0; i--) {

      const c = coords[i];

      if (Math.hypot(p2[0] - c[0], p2[1] - c[1]) > 0.01) { p1 = c; break; }

    }

    let dx = p2[0] - p1[0];

    let dy = p2[1] - p1[1];

    const len = Math.hypot(dx, dy);

    if (!len) return null;

    dx /= len; dy /= len;

    const nx = -dy * side;

    const ny = dx * side;

    const far = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1], 1000) + pad * 2;

    const a = [p1[0] - dx * far, p1[1] - dy * far];

    const b = [p2[0] + dx * far, p2[1] + dy * far];

    const c = [b[0] + nx * far * 2, b[1] + ny * far * 2];

    const d = [a[0] + nx * far * 2, a[1] + ny * far * 2];

    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[a, b, c, d, a]] } };

  }



  function splitGlebaPieceByCutLine(pieceFeature, lineCoords, bbox, pad) {

    const left = glebaLineHalfPlane(lineCoords, bbox, pad, 1);

    const right = glebaLineHalfPlane(lineCoords, bbox, pad, -1);

    if (!left || !right) return [pieceFeature];

    const pieces = [];

    [left, right].forEach((halfPlane) => {

      const part = glebaSafeIntersect(pieceFeature, halfPlane);

      const areaM2 = part?.geometry ? glebaGeometryArea(part.geometry) : 0;

      if (part?.geometry && areaM2 > 2) pieces.push(part);

    });

    const originalArea = glebaGeometryArea(pieceFeature.geometry);

    const sumArea = pieces.reduce((sum, part) => sum + glebaGeometryArea(part.geometry), 0);

    if (pieces.length < 2 || sumArea < originalArea * 0.78) return [pieceFeature];

    return pieces;

  }



  function glebaGuideLineAngle(lineCoords) {

    const coords = (lineCoords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (coords.length < 2) return null;

    let p1 = coords[0];

    let p2 = coords[coords.length - 1];

    for (let i = coords.length - 2; i >= 0; i--) {

      const c = coords[i];

      if (Math.hypot(p2[0] - c[0], p2[1] - c[1]) > 0.01) { p1 = c; break; }

    }

    const dx = p2[0] - p1[0];

    const dy = p2[1] - p1[1];

    if (Math.hypot(dx, dy) < 0.01) return null;

    return Math.atan2(dy, dx) * 180 / Math.PI;

  }



  function glebaLineLength(coords) {

    let length = 0;

    for (let i = 1; i < (coords || []).length; i++) length += Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);

    return length;

  }



  function glebaLimitLinePoints(coords, maxPoints = 56) {

    const clean = (coords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (clean.length <= maxPoints) return clean;

    const out = [];

    for (let i = 0; i < maxPoints; i++) {

      const index = Math.round(i * (clean.length - 1) / (maxPoints - 1));

      const coord = clean[Math.max(0, Math.min(clean.length - 1, index))];

      if (!out.length || Math.hypot(coord[0] - out[out.length - 1][0], coord[1] - out[out.length - 1][1]) > 0.01) out.push(coord);

    }

    const last = clean[clean.length - 1];

    if (out.length && Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > 0.01) out[out.length - 1] = last;

    return out.length >= 2 ? out : clean.slice(0, 2);

  }



  function glebaDensifyLine(coords, step = 18) {

    const clean = (coords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (clean.length < 2) return clean;

    const out = [clean[0]];

    for (let i = 1; i < clean.length; i++) {

      const a = clean[i - 1], b = clean[i];

      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);

      const steps = Math.max(1, Math.ceil(len / step));

      for (let s = 1; s <= steps; s++) out.push([a[0] + (b[0] - a[0]) * (s / steps), a[1] + (b[1] - a[1]) * (s / steps)]);

    }

    return out;

  }



  function glebaSmoothLine(coords, passes = 2) {

    let line = (coords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (line.length < 3) return line;

    for (let pass = 0; pass < passes; pass++) {

      const next = [line[0]];

      for (let i = 0; i < line.length - 1; i++) {

        const a = line[i], b = line[i + 1];

        next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);

        next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);

      }

      next.push(line[line.length - 1]);

      line = next;

    }

    return line;

  }



  function glebaPrepareCurveGuide(coords, bbox) {

    const clean = glebaLimitLinePoints((coords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1])), 56);

    if (clean.length < 2) throw new Error('Desenhe uma curva/arco guia com pelo menos dois pontos. Para curva real, use 3 ou mais pontos.');

    const extent = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1], 1000);

    const step = Math.max(24, Math.min(95, extent / 38));

    const smoothed = clean.length >= 3 ? glebaSmoothLine(clean, 1) : clean;

    return glebaLimitLinePoints(glebaDensifyLine(smoothed, step), 72);

  }



  function glebaSegmentNormal(a, b) {

    const dx = b[0] - a[0], dy = b[1] - a[1];

    const len = Math.hypot(dx, dy) || 1;

    return [-dy / len, dx / len, dx / len, dy / len];

  }



  function glebaOffsetCurve(coords, distance, extend = 0) {

    const line = (coords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (line.length < 2) return [];



    const intersection = (a1, a2, b1, b2) => {

      const x1 = a1[0], y1 = a1[1], x2 = a2[0], y2 = a2[1];

      const x3 = b1[0], y3 = b1[1], x4 = b2[0], y4 = b2[1];

      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

      if (Math.abs(den) < 1e-9) return null;

      const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den;

      const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den;

      return Number.isFinite(px) && Number.isFinite(py) ? [px, py] : null;

    };



    const segments = [];

    for (let i = 1; i < line.length; i++) {

      const a = line[i - 1], b = line[i];

      const dx = b[0] - a[0], dy = b[1] - a[1];

      const len = Math.hypot(dx, dy);

      if (len < 1e-9) continue;

      const nx = -dy / len, ny = dx / len;

      const tx = dx / len, ty = dy / len;

      segments.push({

        baseA: a,

        baseB: b,

        a: [a[0] + nx * distance, a[1] + ny * distance],

        b: [b[0] + nx * distance, b[1] + ny * distance],

        nx,

        ny,

        tx,

        ty

      });

    }

    if (!segments.length) return [];

    if (segments.length === 1) {

      const only = segments[0];

      const out = [[...only.a], [...only.b]];

      if (extend > 0) {

        out[0] = [out[0][0] - only.tx * extend, out[0][1] - only.ty * extend];

        out[1] = [out[1][0] + only.tx * extend, out[1][1] + only.ty * extend];

      }

      return out;

    }



    // v21.9.93: offset estável por interseção das linhas deslocadas.

    // O método anterior usava média das normais em cada vértice; com 3+ glebas

    // e guia dobrada, as cópias paralelas se quebravam/embolavam em quinas.

    const out = [];

    out.push([...segments[0].a]);

    for (let i = 1; i < line.length - 1; i++) {

      const prev = segments[i - 1];

      const next = segments[i];

      let p = intersection(prev.a, prev.b, next.a, next.b);

      const maxMiter = Math.max(Math.abs(distance) * 4.5, 30);

      if (!p || Math.hypot(p[0] - line[i][0], p[1] - line[i][1]) > maxMiter) {

        p = [(prev.b[0] + next.a[0]) / 2, (prev.b[1] + next.a[1]) / 2];

      }

      if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 0.01) out.push(p);

    }

    out.push([...segments[segments.length - 1].b]);



    if (extend > 0 && out.length >= 2) {

      const first = segments[0];

      const last = segments[segments.length - 1];

      out[0] = [out[0][0] - first.tx * extend, out[0][1] - first.ty * extend];

      const li = out.length - 1;

      out[li] = [out[li][0] + last.tx * extend, out[li][1] + last.ty * extend];

    }

    return out;

  }



  function glebaCurveBandPolygon(curveCoords, d1, d2, extend) {

    if (d2 < d1) [d1, d2] = [d2, d1];

    const a = glebaOffsetCurve(curveCoords, d1, extend);

    const b = glebaOffsetCurve(curveCoords, d2, extend);

    if (a.length < 2 || b.length < 2) return null;

    const ring = [...a, ...b.reverse(), a[0]];

    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };

  }



  function glebaSignedDistanceToCurve(point, curveCoords) {

    let bestDist = Infinity;

    let bestSigned = 0;

    for (let i = 1; i < curveCoords.length; i++) {

      const a = curveCoords[i - 1], b = curveCoords[i];

      const dx = b[0] - a[0], dy = b[1] - a[1];

      const len2 = dx * dx + dy * dy;

      if (!len2) continue;

      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2));

      const q = [a[0] + dx * t, a[1] + dy * t];

      const dist = Math.hypot(point[0] - q[0], point[1] - q[1]);

      if (dist < bestDist) {

        bestDist = dist;

        const cross = dx * (point[1] - a[1]) - dy * (point[0] - a[0]);

        bestSigned = cross >= 0 ? dist : -dist;

      }

    }

    return bestSigned;

  }



  function glebaCurveDistanceRange(feature, curveCoords, bbox, pad) {

    const coords = glebaFeatureCoords(feature);

    const samples = [

      ...coords,

      [bbox[0], bbox[1]], [bbox[0], bbox[3]], [bbox[2], bbox[1]], [bbox[2], bbox[3]],

      [(bbox[0] + bbox[2]) / 2, bbox[1]], [(bbox[0] + bbox[2]) / 2, bbox[3]], [bbox[0], (bbox[1] + bbox[3]) / 2], [bbox[2], (bbox[1] + bbox[3]) / 2]

    ];

    let min = Infinity, max = -Infinity;

    samples.forEach((coord) => {

      const d = glebaSignedDistanceToCurve(coord, curveCoords);

      if (Number.isFinite(d)) { min = Math.min(min, d); max = Math.max(max, d); }

    });

    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 1) {

      const extent = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1], 1000);

      min = -extent; max = extent;

    }

    return [min - pad, max + pad];

  }



  function glebaCurveBandIntersection(projected, curveCoords, d1, d2, extend) {

    const band = glebaCurveBandPolygon(curveCoords, d1, d2, extend);

    return band ? glebaSafeIntersect(projected, band) : null;

  }



  function glebaSafeDifference(a, b) {

    if (!a?.geometry || !b?.geometry || !window.turf?.difference) return null;

    try { return turf.difference(turf.featureCollection([a, b])); }

    catch (error) {

      try { return turf.difference(a, b); }

      catch (second) { console.warn('[GeoRural Glebas] Diferença falhou:', error, second); return null; }

    }

  }



  function glebaSafeUnionFeatures(features) {

    const valid = (features || []).filter((feature) => feature?.geometry && glebaGeometryArea(feature.geometry) > 0.5);

    if (!valid.length) return null;

    if (valid.length === 1) return valid[0];

    if (!window.turf?.union) return { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: valid.flatMap((feature) => {

      if (feature.geometry.type === 'Polygon') return [feature.geometry.coordinates];

      if (feature.geometry.type === 'MultiPolygon') return feature.geometry.coordinates;

      return [];

    }) } };

    try { return turf.union(turf.featureCollection(valid)); }

    catch (error) {

      try {

        return valid.slice(1).reduce((acc, feature) => {

          if (!acc?.geometry) return feature;

          try { return turf.union(turf.featureCollection([acc, feature])) || acc; }

          catch (_) { return acc; }

        }, valid[0]);

      } catch (second) { console.warn('[GeoRural Glebas] União falhou:', error, second); return null; }

    }

  }



  function glebaExplodePolygonParts(feature, minAreaM2 = 1) {

    const geometry = feature?.geometry;

    if (!geometry) return [];

    if (geometry.type === 'Polygon') return glebaGeometryArea(geometry) >= minAreaM2 ? [{ type: 'Feature', properties: { ...(feature.properties || {}) }, geometry }] : [];

    if (geometry.type === 'MultiPolygon') {

      return geometry.coordinates

        .map((coordinates) => ({ type: 'Feature', properties: { ...(feature.properties || {}) }, geometry: { type: 'Polygon', coordinates } }))

        .filter((item) => glebaGeometryArea(item.geometry) >= minAreaM2)

        .sort((a, b) => glebaGeometryArea(b.geometry) - glebaGeometryArea(a.geometry));

    }

    return [];

  }



  function glebaMakePiecesMutuallyExclusive(sourceFeature, rawItems, targetAreas, totalArea) {

    // v21.9.90: quando há 3, 4 ou mais glebas no modo desenhado,

    // as faixas offset da mesma linha podem se sobrepor em curvas/quinas.

    // Este pós-processamento remove a sobreposição em ordem e junta a sobra

    // ao último lote, evitando a gleba "lascada/perdida" no final.

    const minArea = Math.max(2, totalArea * 0.000001);

    const accepted = [];

    let occupied = null;



    (rawItems || []).forEach((item, index) => {

      let feature = item?.feature;

      if (!feature?.geometry) return;

      if (occupied?.geometry) {

        const diff = glebaSafeDifference(feature, occupied);

        if (diff?.geometry && glebaGeometryArea(diff.geometry) > minArea) feature = diff;

      }

      const parts = glebaExplodePolygonParts(feature, minArea);

      if (!parts.length) return;

      const merged = glebaSafeUnionFeatures(parts) || parts[0];

      const areaM2 = glebaGeometryArea(merged.geometry);

      if (!(areaM2 > minArea)) return;

      accepted.push({

        feature: merged,

        areaM2,

        perimeterM: glebaGeometryLength(merged.geometry),

        targetM2: targetAreas[index] || item.targetM2 || 0

      });

      occupied = glebaSafeUnionFeatures(accepted.map((part) => part.feature)) || occupied;

    });



    if (occupied?.geometry) {

      const remainder = glebaSafeDifference(sourceFeature, occupied);

      const remainderArea = remainder?.geometry ? glebaGeometryArea(remainder.geometry) : 0;

      if (remainderArea > Math.max(6, totalArea * 0.002) && accepted.length) {

        const lastIndex = accepted.length - 1;

        const mergedLast = glebaSafeUnionFeatures([accepted[lastIndex].feature, remainder]);

        if (mergedLast?.geometry) {

          accepted[lastIndex] = {

            ...accepted[lastIndex],

            feature: mergedLast,

            areaM2: glebaGeometryArea(mergedLast.geometry),

            perimeterM: glebaGeometryLength(mergedLast.geometry)

          };

        }

      }

    }



    const covered = accepted.reduce((sum, item) => sum + item.areaM2, 0);

    const expected = targetAreas.length;

    if (accepted.length < Math.min(2, expected) || covered < totalArea * 0.88) return rawItems;

    return accepted;

  }



  function glebaCurveCumulativeArea(projected, curveCoords, minD, value, extend) {

    const part = glebaCurveBandIntersection(projected, curveCoords, minD, value, extend);

    return part?.geometry ? glebaGeometryArea(part.geometry) : 0;

  }



  function glebaCurveCutoffForArea(projected, curveCoords, minD, maxD, targetArea, totalArea, extend) {

    if (targetArea <= 0) return minD;

    if (targetArea >= totalArea) return maxD;

    let lo = minD, hi = maxD, best = minD, bestDiff = Infinity;

    for (let i = 0; i < 32; i++) {

      const mid = (lo + hi) / 2;

      const area = glebaCurveCumulativeArea(projected, curveCoords, minD, mid, extend);

      const diff = Math.abs(area - targetArea);

      if (diff < bestDiff) { best = mid; bestDiff = diff; }

      if (area < targetArea) lo = mid; else hi = mid;

    }

    return best;

  }



  function glebaCurveStationData(coords) {

    const clean = (coords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    const stations = [0];

    for (let i = 1; i < clean.length; i++) stations.push(stations[i - 1] + Math.hypot(clean[i][0] - clean[i - 1][0], clean[i][1] - clean[i - 1][1]));

    return { coords: clean, stations, length: stations[stations.length - 1] || 0 };

  }



  function glebaCurvePointAtStation(curve, station) {

    const coords = curve?.coords || [];

    const stations = curve?.stations || [];

    if (coords.length < 2) return null;

    const s = Math.max(0, Math.min(curve.length, Number(station) || 0));

    let index = 1;

    while (index < stations.length - 1 && stations[index] < s) index++;

    const s1 = stations[index - 1] || 0;

    const s2 = stations[index] || s1;

    const a = coords[index - 1];

    const b = coords[index];

    const denom = Math.max(1e-9, s2 - s1);

    const t = Math.max(0, Math.min(1, (s - s1) / denom));

    const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    const dx = b[0] - a[0];

    const dy = b[1] - a[1];

    const len = Math.hypot(dx, dy) || 1;

    return { point, tangent: [dx / len, dy / len], index };

  }



  function glebaCurveSublineByStation(curve, startStation, endStation) {

    const coords = curve?.coords || [];

    const stations = curve?.stations || [];

    if (coords.length < 2) return [];

    let a = Math.max(0, Math.min(curve.length, Number(startStation) || 0));

    let b = Math.max(0, Math.min(curve.length, Number(endStation) || 0));

    if (b < a) [a, b] = [b, a];

    const start = glebaCurvePointAtStation(curve, a)?.point;

    const end = glebaCurvePointAtStation(curve, b)?.point;

    if (!start || !end) return [];

    const out = [start];

    for (let i = 1; i < coords.length - 1; i++) {

      if (stations[i] > a && stations[i] < b) out.push(coords[i]);

    }

    out.push(end);

    return out.filter((coord, index, arr) => index === 0 || Math.hypot(coord[0] - arr[index - 1][0], coord[1] - arr[index - 1][1]) > 0.01);

  }



  function glebaExtendCurveGuide(coords, extend) {

    const clean = (coords || []).filter((coord) => Number.isFinite(coord?.[0]) && Number.isFinite(coord?.[1]));

    if (clean.length < 2 || !(extend > 0)) return clean;

    const first = clean[0];

    const second = clean[1];

    const penultimate = clean[clean.length - 2];

    const last = clean[clean.length - 1];

    const startLen = Math.hypot(second[0] - first[0], second[1] - first[1]) || 1;

    const endLen = Math.hypot(last[0] - penultimate[0], last[1] - penultimate[1]) || 1;

    const start = [first[0] - ((second[0] - first[0]) / startLen) * extend, first[1] - ((second[1] - first[1]) / startLen) * extend];

    const end = [last[0] + ((last[0] - penultimate[0]) / endLen) * extend, last[1] + ((last[1] - penultimate[1]) / endLen) * extend];

    return [start, ...clean, end];

  }



  function glebaCurveStationSlabPolygon(curve, s1, s2, far) {

    const a = glebaCurvePointAtStation(curve, s1);

    const b = glebaCurvePointAtStation(curve, s2);

    if (!a || !b) return null;

    const n1 = [-a.tangent[1], a.tangent[0]];

    const n2 = [-b.tangent[1], b.tangent[0]];

    const p1l = [a.point[0] + n1[0] * far, a.point[1] + n1[1] * far];

    const p2l = [b.point[0] + n2[0] * far, b.point[1] + n2[1] * far];

    const p2r = [b.point[0] - n2[0] * far, b.point[1] - n2[1] * far];

    const p1r = [a.point[0] - n1[0] * far, a.point[1] - n1[1] * far];

    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[p1l, p2l, p2r, p1r, p1l]] } };

  }



  function glebaCurveStationBandPolygon(curve, s1, s2, far) {

    const sub = glebaCurveSublineByStation(curve, s1, s2);

    if (sub.length < 2) return glebaCurveStationSlabPolygon(curve, s1, s2, far);

    const left = glebaOffsetCurve(sub, far, 0);

    const right = glebaOffsetCurve(sub, -far, 0);

    if (left.length < 2 || right.length < 2) return glebaCurveStationSlabPolygon(curve, s1, s2, far);

    const ring = [...left, ...right.reverse(), left[0]];

    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };

  }



  function glebaCurveStationIntersection(projected, curve, s1, s2, far) {

    const band = glebaCurveStationBandPolygon(curve, s1, s2, far);

    let part = band ? glebaSafeIntersect(projected, band) : null;

    if (!part?.geometry) {

      const fallback = glebaCurveStationSlabPolygon(curve, s1, s2, far * 1.35);

      part = fallback ? glebaSafeIntersect(projected, fallback) : null;

    }

    return part;

  }



  function glebaCurveStationCumulativeArea(projected, curve, startStation, station, far) {

    const part = glebaCurveStationIntersection(projected, curve, startStation, station, far);

    return part?.geometry ? glebaGeometryArea(part.geometry) : 0;

  }



  function glebaCurveStationCutoffForArea(projected, curve, startStation, endStation, targetArea, totalArea, far) {

    if (targetArea <= 0) return startStation;

    if (targetArea >= totalArea) return endStation;

    let lo = startStation, hi = endStation, best = startStation, bestDiff = Infinity;

    for (let i = 0; i < 34; i++) {

      const mid = (lo + hi) / 2;

      const area = glebaCurveStationCumulativeArea(projected, curve, startStation, mid, far);

      const diff = Math.abs(area - targetArea);

      if (diff < bestDiff) { best = mid; bestDiff = diff; }

      if (area < targetArea) lo = mid; else hi = mid;

    }

    return best;

  }



  function glebaNearestStationOnCurve(point, curve) {

    let bestDist = Infinity;

    let bestStation = 0;

    const coords = curve?.coords || [];

    const stations = curve?.stations || [];

    for (let i = 1; i < coords.length; i++) {

      const a = coords[i - 1], b = coords[i];

      const dx = b[0] - a[0], dy = b[1] - a[1];

      const len2 = dx * dx + dy * dy;

      if (!len2) continue;

      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2));

      const q = [a[0] + dx * t, a[1] + dy * t];

      const dist = Math.hypot(point[0] - q[0], point[1] - q[1]);

      if (dist < bestDist) {

        bestDist = dist;

        bestStation = (stations[i - 1] || 0) + Math.sqrt(len2) * t;

      }

    }

    return bestStation;

  }



  function glebaKml(fc) {

    const escXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const polygonKml = (geometry) => {

      const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

      return polys.map((poly) => {

        const outer = (poly[0] || []).map(([lng, lat]) => `${lng},${lat},0`).join(' ');

        return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${outer}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;

      }).join('');

    };

    return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Divisão de glebas</name>${fc.features.map((feature, index) => `<Placemark><name>${escXml(feature.properties?.name || `Gleba ${index + 1}`)}</name><description>${escXml(`Herdeiro: ${feature.properties?.heir || ''} | Área: ${n(feature.properties?.areaHectares || 0, 4)} ha`)}</description>${polygonKml(feature.geometry)}</Placemark>`).join('')}</Document></kml>`;

  }



  function exportGlebaCsv(fc) {

    const rows = ['gleba;herdeiro;ordem;latitude;longitude'];

    fc.features.forEach((feature) => {

      const rings = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates.flatMap((poly) => [poly[0] || []]) : [feature.geometry.coordinates?.[0] || []];

      rings.forEach((ring) => ring.slice(0, -1).forEach(([lng, lat], index) => rows.push(`${safeCsv(feature.properties?.name)};${safeCsv(feature.properties?.heir || feature.properties?.owner)};${index + 1};${lat.toFixed(8)};${lng.toFixed(8)}`)));

    });

    return rows.join('\n');

  }


  window.SurveyorGlebaGeometry = Object.freeze({
    glebaFeatureCoords,
    glebaAllCoords,
    glebaBBox,
    glebaProjection,
    glebaMapCoordsDeep,
    glebaTransformFeature,
    glebaRotatePoint,
    glebaRotateFeature,
    glebaRingArea,
    glebaGeometryArea,
    glebaGeometryLength,
    glebaVertexCount,
    glebaRectangle,
    glebaSafeIntersect,
    glebaStripIntersection,
    glebaCumulativeArea,
    glebaCutoffForArea,
    glebaCutTypeLabel,
    glebaFeatureCenter,
    glebaCollectPiece,
    glebaClipAndCollect,
    glebaWedge,
    glebaRadialOrigin,
    glebaFanAngleRange,
    buildGlebaPiecesByStrips,
    buildGlebaPiecesByGrid,
    buildGlebaPiecesByRadial,
    glebaNormalizedRingCoords,
    glebaAverageGuideVector,
    glebaPointToSegmentDistance,
    glebaDistanceToBoundary,
    glebaMeasureFrontBack,
    glebaMeasureLatLng,
    drawnSegmentCoordsFromLayer,
    glebaRingFromLayer,
    validGlebaLabelPoint,
    frontBackLayerCenterPoint,
    restoreLegacyFrontBackEdge,
    isFrontBackPolygonLayer,
    glebaCutLineToProjectedCoords,
    glebaLineHalfPlane,
    splitGlebaPieceByCutLine,
    glebaGuideLineAngle,
    glebaLineLength,
    glebaLimitLinePoints,
    glebaDensifyLine,
    glebaSmoothLine,
    glebaPrepareCurveGuide,
    glebaSegmentNormal,
    glebaOffsetCurve,
    glebaCurveBandPolygon,
    glebaSignedDistanceToCurve,
    glebaCurveDistanceRange,
    glebaCurveBandIntersection,
    glebaSafeDifference,
    glebaSafeUnionFeatures,
    glebaExplodePolygonParts,
    glebaMakePiecesMutuallyExclusive,
    glebaCurveCumulativeArea,
    glebaCurveCutoffForArea,
    glebaCurveStationData,
    glebaCurvePointAtStation,
    glebaCurveSublineByStation,
    glebaExtendCurveGuide,
    glebaCurveStationSlabPolygon,
    glebaCurveStationBandPolygon,
    glebaCurveStationIntersection,
    glebaCurveStationCumulativeArea,
    glebaCurveStationCutoffForArea,
    glebaNearestStationOnCurve,
    glebaKml,
    exportGlebaCsv
  });
})();
