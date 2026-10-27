export class GeometryValidationError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'GeometryValidationError';
    this.status = status;
    this.code = code;
    this.details = { code };
  }
}

function fail(status, message, code) {
  throw new GeometryValidationError(status, message, code);
}

function finiteCoord(point) {
  if (!Array.isArray(point) || point.length < 2) return false;
  const lng = Number(point[0]);
  const lat = Number(point[1]);
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

function sameCoord(a, b) {
  return finiteCoord(a) && finiteCoord(b) && Number(a[0]) === Number(b[0]) && Number(a[1]) === Number(b[1]);
}

function orientation2d(a, b, c) {
  const value = (Number(b[1]) - Number(a[1])) * (Number(c[0]) - Number(b[0]))
    - (Number(b[0]) - Number(a[0])) * (Number(c[1]) - Number(b[1]));
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function pointOnSegment(a, b, c) {
  return Number(b[0]) <= Math.max(Number(a[0]), Number(c[0])) + 1e-12
    && Number(b[0]) + 1e-12 >= Math.min(Number(a[0]), Number(c[0]))
    && Number(b[1]) <= Math.max(Number(a[1]), Number(c[1])) + 1e-12
    && Number(b[1]) + 1e-12 >= Math.min(Number(a[1]), Number(c[1]));
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation2d(a, b, c), o2 = orientation2d(a, b, d), o3 = orientation2d(c, d, a), o4 = orientation2d(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(a, c, b)) return true;
  if (o2 === 0 && pointOnSegment(a, d, b)) return true;
  if (o3 === 0 && pointOnSegment(c, a, d)) return true;
  if (o4 === 0 && pointOnSegment(c, b, d)) return true;
  return false;
}

function defaultOptions(options = {}) {
  const clamp = (value, min, max, fallback) => {
    const parsed = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
  };
  return {
    maxFeatures: clamp(options.maxFeatures, 100, 100000, 25000),
    maxVerticesTotal: clamp(options.maxVerticesTotal, 1000, 1000000, 250000),
    maxVerticesPerRing: clamp(options.maxVerticesPerRing, 20, 10000, 2000),
    maxVerticesPerLine: clamp(options.maxVerticesPerLine, 20, 50000, 10000)
  };
}

function validateRing(ring, label, limits, budget) {
  if (!Array.isArray(ring) || ring.length < 4) fail(400, `${label}: anel deve possuir pelo menos 4 coordenadas.`, 'GEOMETRY_INVALID');
  if (ring.length > limits.maxVerticesPerRing + 1) fail(413, `${label}: anel excede ${limits.maxVerticesPerRing} vértices. Simplifique a geometria antes de salvar.`, 'GEOMETRY_RING_VERTEX_LIMIT');
  if (!sameCoord(ring[0], ring[ring.length - 1])) fail(400, `${label}: anel não está fechado.`, 'GEOMETRY_RING_NOT_CLOSED');
  for (const point of ring) if (!finiteCoord(point)) fail(400, `${label}: coordenada inválida ou fora de longitude/latitude.`, 'GEOMETRY_COORDINATE_INVALID');
  budget.count += Math.max(0, ring.length - 1);
  if (budget.count > limits.maxVerticesTotal) fail(413, `O projeto excede o limite total de ${limits.maxVerticesTotal} vértices.`, 'PROJECT_VERTEX_LIMIT');

  const segmentCount = ring.length - 1;
  for (let i = 0; i < segmentCount; i += 1) {
    const a = ring[i], b = ring[i + 1];
    if (sameCoord(a, b)) fail(400, `${label}: existem vértices consecutivos duplicados.`, 'GEOMETRY_DUPLICATE_VERTEX');
    for (let j = i + 1; j < segmentCount; j += 1) {
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === segmentCount - 1) continue;
      const c = ring[j], d = ring[j + 1];
      const separated = Math.max(Number(a[0]), Number(b[0])) < Math.min(Number(c[0]), Number(d[0]))
        || Math.max(Number(c[0]), Number(d[0])) < Math.min(Number(a[0]), Number(b[0]))
        || Math.max(Number(a[1]), Number(b[1])) < Math.min(Number(c[1]), Number(d[1]))
        || Math.max(Number(c[1]), Number(d[1])) < Math.min(Number(a[1]), Number(b[1]));
      if (!separated && segmentsIntersect(a, b, c, d)) {
        fail(400, `${label}: autointerseção detectada. Corrija o polígono antes de salvar/exportar.`, 'GEOMETRY_SELF_INTERSECTION');
      }
    }
  }
}

function validateLine(line, label, limits, budget) {
  if (!Array.isArray(line) || line.length < 2) fail(400, `${label}: linha precisa de pelo menos 2 coordenadas.`, 'GEOMETRY_INVALID');
  if (line.length > limits.maxVerticesPerLine) fail(413, `${label}: linha excede ${limits.maxVerticesPerLine} vértices.`, 'GEOMETRY_LINE_VERTEX_LIMIT');
  for (let index = 0; index < line.length; index += 1) {
    if (!finiteCoord(line[index])) fail(400, `${label}: coordenada inválida ou fora de longitude/latitude.`, 'GEOMETRY_COORDINATE_INVALID');
    if (index > 0 && sameCoord(line[index - 1], line[index])) fail(400, `${label}: existem vértices consecutivos duplicados.`, 'GEOMETRY_DUPLICATE_VERTEX');
  }
  budget.count += line.length;
  if (budget.count > limits.maxVerticesTotal) fail(413, `O projeto excede o limite total de ${limits.maxVerticesTotal} vértices.`, 'PROJECT_VERTEX_LIMIT');
}

function geometryOf(feature = {}) {
  return feature.geoJson || feature.geojson || feature.geometry || null;
}

function validateGeometry(geometry, label, limits, budget) {
  if (!geometry || typeof geometry !== 'object' || !geometry.type) fail(400, `${label}: geometria ausente ou inválida.`, 'GEOMETRY_REQUIRED');
  const type = String(geometry.type);
  const coordinates = geometry.coordinates;
  if (type === 'Point') {
    if (!finiteCoord(coordinates)) fail(400, `${label}: ponto inválido.`, 'GEOMETRY_COORDINATE_INVALID');
    budget.count += 1;
  } else if (type === 'MultiPoint') {
    if (!Array.isArray(coordinates) || !coordinates.length) fail(400, `${label}: multiponto vazio.`, 'GEOMETRY_INVALID');
    if (coordinates.length > limits.maxVerticesPerLine) fail(413, `${label}: multiponto excede ${limits.maxVerticesPerLine} pontos.`, 'GEOMETRY_POINT_LIMIT');
    coordinates.forEach((point) => { if (!finiteCoord(point)) fail(400, `${label}: ponto inválido.`, 'GEOMETRY_COORDINATE_INVALID'); });
    budget.count += coordinates.length;
  } else if (type === 'LineString') {
    validateLine(coordinates, label, limits, budget);
  } else if (type === 'MultiLineString') {
    if (!Array.isArray(coordinates) || !coordinates.length) fail(400, `${label}: multilinha vazia.`, 'GEOMETRY_INVALID');
    coordinates.forEach((line, index) => validateLine(line, `${label} (linha ${index + 1})`, limits, budget));
  } else if (type === 'Polygon') {
    if (!Array.isArray(coordinates) || !coordinates.length) fail(400, `${label}: polígono sem anéis.`, 'GEOMETRY_INVALID');
    coordinates.forEach((ring, index) => validateRing(ring, `${label} (anel ${index + 1})`, limits, budget));
  } else if (type === 'MultiPolygon') {
    if (!Array.isArray(coordinates) || !coordinates.length) fail(400, `${label}: multipolígono vazio.`, 'GEOMETRY_INVALID');
    coordinates.forEach((polygon, polygonIndex) => {
      if (!Array.isArray(polygon) || !polygon.length) fail(400, `${label}: multipolígono inválido.`, 'GEOMETRY_INVALID');
      polygon.forEach((ring, ringIndex) => validateRing(ring, `${label} (polígono ${polygonIndex + 1}, anel ${ringIndex + 1})`, limits, budget));
    });
  } else {
    fail(400, `${label}: tipo de geometria não suportado (${type}).`, 'GEOMETRY_TYPE_UNSUPPORTED');
  }
  if (budget.count > limits.maxVerticesTotal) fail(413, `O projeto excede o limite total de ${limits.maxVerticesTotal} vértices.`, 'PROJECT_VERTEX_LIMIT');
}

export function validateProjectFeatures(features = [], options = {}) {
  const list = Array.isArray(features) ? features : [];
  const limits = defaultOptions(options);
  if (list.length > limits.maxFeatures) fail(413, `O projeto excede o limite de ${limits.maxFeatures} feições.`, 'PROJECT_FEATURE_LIMIT');
  const budget = { count: 0 };
  list.forEach((feature, index) => validateGeometry(geometryOf(feature), String(feature?.name || `Feição ${index + 1}`).slice(0, 120), limits, budget));
  return { features: list, vertexCount: budget.count, limits };
}
