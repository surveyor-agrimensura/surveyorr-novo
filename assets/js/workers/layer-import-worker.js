/* Surveyor v21.11.5 — Shapefile em Worker + índice espacial local para camadas grandes. */
'use strict';

const SHPJS_URL = 'https://cdn.jsdelivr.net/npm/shpjs@6.1.0/dist/shp.min.js';
const MB = 1024 * 1024;
const LARGE_FEATURE_THRESHOLD = 120000;
const LARGE_ESTIMATED_BYTES = 96 * MB;

let largeCollection = null;
let largeFeatureBboxes = null;
let largeSpatialIndex = null;
let largeGrid = null;
let largeOversized = [];

function progress(percent, message, stage = 'parsing') {
  self.postMessage({ type: 'progress', percent, message, stage });
}

function normalizeCollection(value) {
  if (Array.isArray(value)) {
    const features = value.flatMap((item) => normalizeCollection(item).features || []);
    return { type: 'FeatureCollection', features };
  }
  if (value?.type === 'FeatureCollection') return value;
  if (value?.type === 'Feature') return { type: 'FeatureCollection', features: [value] };
  if (value?.type && value?.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: value }] };
  throw new Error('O ZIP não contém um Shapefile reconhecido.');
}

function fileByExtension(files, extension) {
  const pattern = new RegExp(`\\.${extension}$`, 'i');
  return (files || []).find((item) => pattern.test(String(item.name || '')));
}

function decodeText(buffer) {
  if (!buffer) return undefined;
  try { return new TextDecoder('utf-8').decode(buffer); }
  catch { return undefined; }
}

async function loadParser() {
  if (typeof self.shp === 'function') return;
  progress(4, 'Carregando leitor de Shapefile...', 'loading');
  importScripts(SHPJS_URL);
  if (typeof self.shp !== 'function') throw new Error('O leitor de Shapefile não pôde ser carregado.');
}

async function parseZip(buffer) {
  progress(18, 'Abrindo o ZIP e identificando SHP, SHX, DBF e PRJ...');
  const parsed = await self.shp(buffer);
  return normalizeCollection(parsed);
}

async function parseParts(files) {
  const shpPart = fileByExtension(files, 'shp');
  const dbfPart = fileByExtension(files, 'dbf');
  if (!shpPart || !dbfPart) throw new Error('O Shapefile precisa conter pelo menos .SHP e .DBF. Recomenda-se incluir também .SHX e .PRJ.');
  if (typeof self.shp.parseShp !== 'function' || typeof self.shp.parseDbf !== 'function' || typeof self.shp.combine !== 'function') {
    throw new Error('O leitor atual não suporta arquivos separados. Compacte os componentes em um ZIP.');
  }
  progress(24, 'Lendo geometrias e atributos do Shapefile...');
  const prj = decodeText(fileByExtension(files, 'prj')?.buffer);
  const cpg = decodeText(fileByExtension(files, 'cpg')?.buffer)?.trim();
  const geometries = self.shp.parseShp(shpPart.buffer, prj);
  const attributes = self.shp.parseDbf(dbfPart.buffer, cpg);
  return normalizeCollection(self.shp.combine([geometries, attributes]));
}

function bboxOfGeometry(geometry) {
  if (!geometry) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
      const x = Number(value[0]); const y = Number(value[1]);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      return;
    }
    for (const child of value) visit(child);
  };
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries || []) {
      const box = bboxOfGeometry(child);
      if (!box) continue;
      minX = Math.min(minX, box[0]); minY = Math.min(minY, box[1]);
      maxX = Math.max(maxX, box[2]); maxY = Math.max(maxY, box[3]);
    }
  } else visit(geometry.coordinates);
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

function estimateCollectionBytes(collection) {
  const features = collection?.features || [];
  if (!features.length) return 0;
  const sampleCount = Math.min(240, features.length);
  let total = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const index = Math.min(features.length - 1, Math.floor((i / sampleCount) * features.length));
    try { total += JSON.stringify(features[index]).length; } catch { total += 512; }
  }
  return Math.round((total / Math.max(1, sampleCount)) * features.length + 64);
}

function buildLargeSpatialIndex(collection) {
  const features = collection?.features || [];
  const count = features.length;
  const boxes = new Float64Array(count * 4);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  progress(85, `Criando índice local para ${count.toLocaleString('pt-BR')} elemento(s)...`, 'indexing');
  for (let i = 0; i < count; i += 1) {
    const box = bboxOfGeometry(features[i]?.geometry) || [NaN, NaN, NaN, NaN];
    boxes[i * 4] = box[0]; boxes[i * 4 + 1] = box[1]; boxes[i * 4 + 2] = box[2]; boxes[i * 4 + 3] = box[3];
    if (Number.isFinite(box[0])) {
      minX = Math.min(minX, box[0]); minY = Math.min(minY, box[1]);
      maxX = Math.max(maxX, box[2]); maxY = Math.max(maxY, box[3]);
    }
    if (i && i % 60000 === 0) progress(Math.min(93, 85 + Math.round((i / count) * 8)), `Indexando ${i.toLocaleString('pt-BR')} de ${count.toLocaleString('pt-BR')}...`, 'indexing');
  }

  if (!Number.isFinite(minX)) throw new Error('Nenhuma geometria válida foi encontrada no Shapefile.');
  if (minX < -180.5 || maxX > 180.5 || minY < -90.5 || maxY > 90.5) {
    throw new Error('O Shapefile parece usar coordenadas projetadas sem CRS reconhecido. Inclua o arquivo .PRJ ou reprojete para SIRGAS 2000 / EPSG:4326.');
  }

  const targetPerBucket = 650;
  const side = Math.max(8, Math.min(96, Math.ceil(Math.sqrt(count / targetPerBucket))));
  const width = Math.max(1e-9, maxX - minX);
  const height = Math.max(1e-9, maxY - minY);
  const cellW = width / side;
  const cellH = height / side;
  const buckets = new Map();
  const oversized = [];
  const cellKey = (col, row) => `${col}:${row}`;

  for (let i = 0; i < count; i += 1) {
    const x1 = boxes[i * 4], y1 = boxes[i * 4 + 1], x2 = boxes[i * 4 + 2], y2 = boxes[i * 4 + 3];
    if (!Number.isFinite(x1)) continue;
    const spanCols = Math.max(1, Math.ceil((x2 - x1) / cellW));
    const spanRows = Math.max(1, Math.ceil((y2 - y1) / cellH));
    if (spanCols > 2 || spanRows > 2) { oversized.push(i); continue; }
    const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2;
    const col = Math.max(0, Math.min(side - 1, Math.floor((cx - minX) / cellW)));
    const row = Math.max(0, Math.min(side - 1, Math.floor((cy - minY) / cellH)));
    const key = cellKey(col, row);
    let bucket = buckets.get(key);
    if (!bucket) { bucket = []; buckets.set(key, bucket); }
    bucket.push(i);
  }

  largeFeatureBboxes = boxes;
  largeSpatialIndex = buckets;
  largeOversized = oversized;
  largeGrid = { minX, minY, maxX, maxY, side, cellW, cellH };
  progress(98, `Índice local pronto: ${buckets.size.toLocaleString('pt-BR')} setores.`, 'indexing');
  return [minX, minY, maxX, maxY];
}

function intersectsBox(index, bbox) {
  const x1 = largeFeatureBboxes[index * 4]; const y1 = largeFeatureBboxes[index * 4 + 1];
  const x2 = largeFeatureBboxes[index * 4 + 2]; const y2 = largeFeatureBboxes[index * 4 + 3];
  return Number.isFinite(x1) && x2 >= bbox[0] && x1 <= bbox[2] && y2 >= bbox[1] && y1 <= bbox[3];
}

function queryLargeCollection(bbox, limit = 1500) {
  if (!largeCollection || !largeGrid || !largeSpatialIndex) throw new Error('A camada local grande não está mais disponível. Importe o arquivo novamente.');
  const clean = (bbox || []).map(Number);
  if (clean.length !== 4 || clean.some((v) => !Number.isFinite(v))) throw new Error('Área de consulta inválida.');
  const maxReturn = Math.max(50, Math.min(2500, Number(limit || 1500)));
  const { minX, minY, side, cellW, cellH } = largeGrid;
  const colMin = Math.max(0, Math.floor((clean[0] - minX) / cellW) - 2);
  const colMax = Math.min(side - 1, Math.floor((clean[2] - minX) / cellW) + 2);
  const rowMin = Math.max(0, Math.floor((clean[1] - minY) / cellH) - 2);
  const rowMax = Math.min(side - 1, Math.floor((clean[3] - minY) / cellH) + 2);
  const seen = new Set();
  const result = [];
  let truncated = false;

  const consider = (index) => {
    if (seen.has(index)) return true;
    seen.add(index);
    if (!intersectsBox(index, clean)) return true;
    if (result.length >= maxReturn) { truncated = true; return false; }
    result.push(largeCollection.features[index]);
    return true;
  };

  for (let row = rowMin; row <= rowMax && !truncated; row += 1) {
    for (let col = colMin; col <= colMax && !truncated; col += 1) {
      const bucket = largeSpatialIndex.get(`${col}:${row}`) || [];
      for (const index of bucket) if (!consider(index)) break;
    }
  }
  if (!truncated) for (const index of largeOversized) if (!consider(index)) break;

  return {
    type: 'FeatureCollection',
    features: result,
    meta: { returned: result.length, truncated, candidates: seen.size }
  };
}

self.onmessage = async (event) => {
  const payload = event.data || {};

  if (payload.type === 'query-large-layer') {
    try {
      const data = queryLargeCollection(payload.bbox, payload.limit);
      self.postMessage({ type: 'query-result', requestId: payload.requestId, data });
    } catch (error) {
      self.postMessage({ type: 'query-error', requestId: payload.requestId, message: error?.message || 'Falha ao consultar a camada local.' });
    }
    return;
  }

  if (payload.type === 'dispose-large-layer') {
    largeCollection = null; largeFeatureBboxes = null; largeSpatialIndex = null; largeGrid = null; largeOversized = [];
    self.close();
    return;
  }

  if (payload.type !== 'parse-shapefile') return;
  try {
    await loadParser();
    const collection = payload.files?.length ? await parseParts(payload.files) : await parseZip(payload.buffer);
    const featureCount = Number(collection.features?.length || 0);
    progress(82, `Validando ${featureCount.toLocaleString('pt-BR')} elemento(s)...`, 'finalizing');
    const estimatedBytes = estimateCollectionBytes(collection);

    if (featureCount >= LARGE_FEATURE_THRESHOLD || estimatedBytes >= LARGE_ESTIMATED_BYTES) {
      largeCollection = collection;
      const bounds = buildLargeSpatialIndex(collection);
      progress(100, 'Camada grande indexada localmente. O mapa carregará apenas os elementos visíveis.', 'ready');
      self.postMessage({ type: 'result', largeLocal: true, bounds, estimatedBytes, bytes: estimatedBytes, featureCount });
      return;
    }

    const jsonBlob = new Blob([JSON.stringify(collection)], { type: 'application/geo+json' });
    progress(100, 'Shapefile convertido com sucesso.', 'ready');
    self.postMessage({ type: 'result', jsonBlob, bytes: jsonBlob.size, featureCount });
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || 'Falha ao converter o Shapefile.' });
  }
};
