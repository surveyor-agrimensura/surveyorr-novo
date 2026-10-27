(() => {
  'use strict';

  // SURVEYOR 1.0 — operações geométricas puras. Funções puras/algorítmicas extraídas do runtime
  // principal para manter o mapa menor e cada responsabilidade isolada.

  function geomClone(value) {

    return JSON.parse(JSON.stringify(value));

  }



  function geomIsPosition(value) {

    return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));

  }



  function geomMapCoords(value, mapper) {

    if (geomIsPosition(value)) return mapper(value);

    if (!Array.isArray(value)) return value;

    return value.map((item) => geomMapCoords(item, mapper));

  }



  function geomFirstCoord(value) {

    if (geomIsPosition(value)) return value;

    if (!Array.isArray(value)) return null;

    for (const item of value) {

      const found = geomFirstCoord(item);

      if (found) return found;

    }

    return null;

  }



  function geomSamePoint(a, b, tolerance = 1e-12) {

    if (!geomIsPosition(a) || !geomIsPosition(b)) return false;

    return Math.abs(Number(a[0]) - Number(b[0])) <= tolerance
      && Math.abs(Number(a[1]) - Number(b[1])) <= tolerance;

  }



  function geomOuterCoords(feature) {

    const g = feature?.geometry || {};

    if (g.type === 'LineString') return g.coordinates || [];

    if (g.type === 'Polygon') {
      const ring = Array.isArray(g.coordinates?.[0]) ? g.coordinates[0] : [];
      return ring.length > 1 && geomSamePoint(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring.slice();
    }

    return [];

  }



  function geomSetOuterCoords(feature, coords) {

    const updated = geomClone(feature);

    const g = updated.geometry || {};

    if (g.type === 'LineString') g.coordinates = coords;

    if (g.type === 'Polygon') {

      const ring = coords.slice();

      const first = ring[0];

      const last = ring[ring.length - 1];

      if (first && (!last || first[0] !== last[0] || first[1] !== last[1])) ring.push(first.slice());

      g.coordinates[0] = ring;

    }

    return updated;

  }



  function geomMetersBetween(a, b) {

    try { return turf.distance(turf.point(a), turf.point(b), { units: 'meters' }); } catch (_) { return Infinity; }

  }



  function spatialIsPolygonFeature(feature) {

    const type = feature?.geometry?.type || '';

    return type === 'Polygon' || type === 'MultiPolygon';

  }



  function spatialIsLineFeature(feature) {

    const type = feature?.geometry?.type || '';

    return type === 'LineString' || type === 'MultiLineString';

  }



  function spatialFeatureAreaHa(feature) {

    try { return Number(turf.area(feature) || 0) / 10000; } catch (_) { return 0; }

  }



  function spatialBooleanIntersects(a, b) {

    try {

      if (window.turf?.booleanDisjoint) return !turf.booleanDisjoint(a, b);

      if (window.turf?.booleanIntersects) return Boolean(turf.booleanIntersects(a, b));

    } catch (_) {}

    try {

      const ba = turf.bbox(a), bb = turf.bbox(b);

      return !(ba[2] < bb[0] || ba[0] > bb[2] || ba[3] < bb[1] || ba[1] > bb[3]);

    } catch (_) { return false; }

  }



  function spatialBinary(operation, a, b) {

    const fn = window.turf?.[operation];

    if (!fn) throw new Error(`Turf.${operation} indisponível.`);

    try {

      const result = fn(a, b);

      if (result?.geometry || result === null) return result;

    } catch (_) {}

    try {

      const result = fn(turf.featureCollection([a, b]));

      if (result?.geometry || result === null) return result;

    } catch (error) {

      throw error;

    }

    return null;

  }



  function spatialUnionTwo(a, b) {

    return spatialBinary('union', a, b);

  }



  function spatialDifferenceTwo(a, b) {

    return spatialBinary('difference', a, b);

  }



  function spatialIntersectTwo(a, b) {

    return spatialBinary('intersect', a, b);

  }



  function spatialUnionMany(features) {

    const list = (features || []).filter((feature) => feature?.geometry);

    if (!list.length) return null;

    let result = geomClone(list[0]);

    for (const feature of list.slice(1)) {

      const next = spatialUnionTwo(result, feature);

      if (next?.geometry) result = { ...next, properties: { ...(result.properties || {}) } };

    }

    return result;

  }



  function spatialCountConsecutiveDuplicates(coords) {

    let count = 0;

    for (let i = 1; i < coords.length; i += 1) {

      const a = coords[i - 1], b = coords[i];

      if (a && b && Number(a[0]) === Number(b[0]) && Number(a[1]) === Number(b[1])) count += 1;

    }

    return count;

  }



  function terrainClampLat(lat) {

    return Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));

  }



  function terrainProfileCoordinates(feature) {

    const g = feature?.geometry || {};

    if (g.type === 'LineString') return g.coordinates || [];

    if (g.type === 'Polygon') return (g.coordinates?.[0] || []).slice(0, -1);

    return [];

  }



  function terrainLineFromCoords(coords) {

    const clean = (coords || []).filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]));

    return clean.length >= 2 ? turf.lineString(clean) : null;

  }



  function terrainDensifyLine(coords, spacingMeters = 100, maxSamples = 160) {

    const line = terrainLineFromCoords(coords);

    if (!line) return [];

    const totalKm = turf.length(line, { units: 'kilometers' });

    const spacingKm = Math.max(0.01, Number(spacingMeters || 100) / 1000);

    const count = Math.min(maxSamples, Math.max(2, Math.ceil(totalKm / spacingKm) + 1));

    const samples = [];

    for (let i = 0; i < count; i += 1) {

      const distKm = count === 1 ? 0 : totalKm * (i / (count - 1));

      const pt = turf.along(line, distKm, { units: 'kilometers' });

      samples.push({ lng: pt.geometry.coordinates[0], lat: pt.geometry.coordinates[1], distanceMeters: distKm * 1000 });

    }

    return samples;

  }



  function terrainStats(samples) {

    const elevations = samples.map((s) => s.elevation).filter(Number.isFinite);

    if (!elevations.length) return null;

    const min = Math.min(...elevations);

    const max = Math.max(...elevations);

    const avg = elevations.reduce((a, b) => a + b, 0) / elevations.length;

    return { min, max, avg, amplitude: max - min };

  }



  function terrainPointGridForPolygon(polygon, spacingMeters = 150, maxPoints = 260) {

    const bbox = turf.bbox(polygon);

    let points = [];

    try {

      points = turf.pointGrid(bbox, Math.max(0.02, spacingMeters / 1000), { units: 'kilometers', mask: polygon }).features || [];

    } catch (_) { points = []; }

    if (points.length > maxPoints) {

      const step = Math.ceil(points.length / maxPoints);

      points = points.filter((_, i) => i % step === 0).slice(0, maxPoints);

    }

    return points;

  }



  function terrainInterpolatePoint(a, b, level) {

    const span = b.elevation - a.elevation;

    const t = Math.abs(span) < 1e-9 ? 0.5 : (level - a.elevation) / span;

    return [a.lng + (b.lng - a.lng) * t, a.lat + (b.lat - a.lat) * t];

  }


  window.SurveyorGeometryMath = Object.freeze({
    geomClone,
    geomIsPosition,
    geomMapCoords,
    geomFirstCoord,
    geomOuterCoords,
    geomSetOuterCoords,
    geomMetersBetween,
    spatialIsPolygonFeature,
    spatialIsLineFeature,
    spatialFeatureAreaHa,
    spatialBooleanIntersects,
    spatialBinary,
    spatialUnionTwo,
    spatialDifferenceTwo,
    spatialIntersectTwo,
    spatialUnionMany,
    spatialCountConsecutiveDuplicates,
    terrainClampLat,
    terrainProfileCoordinates,
    terrainLineFromCoords,
    terrainDensifyLine,
    terrainStats,
    terrainPointGridForPolygon,
    terrainInterpolatePoint
  });
})();
