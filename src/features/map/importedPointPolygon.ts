import type { Feature, Geometry, GeoJsonProperties } from 'geojson';

/** A ordem dos vértices corresponde à ordem original do arquivo importado. */
export type MapGeometryFeature = Feature<Geometry, GeoJsonProperties>;
export type PointBatch = { id: string; label: string; points: MapGeometryFeature[] };
export type PolygonFromPoints = { ring: number[][]; skippedDuplicates: number; uniqueVertices: number };
const LEGACY_GROUP = 'pontos-importados-anteriores';

export function importedPointBatches(features: MapGeometryFeature[]): PointBatch[] {
  const polygons = new Set(features.filter(f => f.geometry.type === 'Polygon').map(f => String(f.id)));
  const groups = new Map<string, PointBatch>();
  for (const point of features) {
    if (point.geometry.type !== 'Point' || point.properties?.hidden === true) continue;
    if (point.properties?.pointOrigin !== 'importado' && point.properties?.source !== 'importação de coordenadas') continue;
    const polygonId = String(point.properties?.pointPolygonId ?? '');
    if (polygonId && polygons.has(polygonId)) continue;
    const batchId = String(point.properties?.pointBatchId || LEGACY_GROUP);
    let group = groups.get(batchId);
    if (!group) {
      group = {id: batchId, label: String(point.properties?.pointBatchName || (batchId === LEGACY_GROUP ? 'Pontos importados anteriormente' : 'Importação de pontos')), points: []};
      groups.set(batchId, group);
    }
    group.points.push(point);
  }
  return Array.from(groups.values()).filter(group => group.points.length >= 4);
}

/** Os alfinetes somem só quando existe um polígono vinculado ao conjunto.
 * Os registros de pontos originais nunca são excluídos ou alterados geometricamente. */
export function visibleOnMap(feature: MapGeometryFeature, all: MapGeometryFeature[]): boolean {
  if (feature.properties?.hidden === true) return false;
  if (feature.geometry.type !== 'Point') return true;
  const polygonId = String(feature.properties?.pointPolygonId ?? '');
  return !polygonId || !all.some(f => f.geometry.type === 'Polygon' && String(f.id) === polygonId);
}

// Coordenadas repetidas ocorrem em planilhas (marco de fechamento, registro duplicado etc.).
// Tolerância apenas para ruído numérico muito pequeno; pontos distintos não são fundidos.
const sameCoordinate = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) <= 1e-10 && Math.abs(a[1] - b[1]) <= 1e-10;
type XY = { x: number; y: number };
const cross = (a: XY, b: XY, c: XY) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function segmentsIntersect(a: XY, b: XY, c: XY, d: XY): boolean {
  // Computar no plano local (metros), não em graus. Em graus um epsilon absoluto
  // fazia segmentos de 20-100 m parecerem colineares, produzindo falsos erros.
  const epsilon = 1e-8;
  const abC = cross(a, b, c), abD = cross(a, b, d);
  const cdA = cross(c, d, a), cdB = cross(c, d, b);
  const between = (p: XY, q: XY, r: XY) => r.x >= Math.min(p.x, q.x) - 1e-7 && r.x <= Math.max(p.x, q.x) + 1e-7 && r.y >= Math.min(p.y, q.y) - 1e-7 && r.y <= Math.max(p.y, q.y) + 1e-7;
  if (((abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon)) &&
      ((cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon))) return true;
  return (Math.abs(abC) <= epsilon && between(a, b, c)) ||
    (Math.abs(abD) <= epsilon && between(a, b, d)) ||
    (Math.abs(cdA) <= epsilon && between(c, d, a)) ||
    (Math.abs(cdB) <= epsilon && between(c, d, b));
}

/** Gera um perímetro sem apagar/editar os pontos originais do projeto.
 * Ignora repetição de QUALQUER coordenada no mesmo lote (não só primeira/última),
 * preservando a ordem relativa de todas as posições únicas.
 * Erros reais, como auto-interseção e área nula, continuam bloqueados. */
export function buildPolygonFromBatch(batch: PointBatch): PolygonFromPoints {
  if (batch.points.length < 4) throw new Error('Importe pelo menos quatro pontos para gerar um polígono.');
  const raw = batch.points.map(p => p.geometry.type === 'Point' ? p.geometry.coordinates : []);
  if (raw.some(p => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) {
    throw new Error('Há pontos com coordenadas inválidas. Confira o arquivo.');
  }
  const unique: number[][] = [];
  for (const coord of raw) {
    if (!unique.some(point => sameCoordinate(point, coord))) unique.push([...coord]);
  }
  if (unique.length < 3) throw new Error('A importação contém menos de três coordenadas distintas. Não é possível formar um polígono.');

  const origin = unique[0];
  const latitude = unique.reduce((sum, p) => sum + p[1], 0) / unique.length;
  const cosLatitude = Math.max(.000001, Math.abs(Math.cos(latitude * Math.PI / 180)));
  const planar = unique.map(p => ({x: (p[0] - origin[0]) * 111320 * cosLatitude, y: (p[1] - origin[1]) * 111320}));
  for (let i = 0; i < planar.length; i++) {
    for (let j = i + 1; j < planar.length; j++) {
      if (j === i + 1 || (i === 0 && j === planar.length - 1)) continue;
      if (segmentsIntersect(planar[i], planar[(i + 1) % planar.length], planar[j], planar[(j + 1) % planar.length])) {
        throw new Error('As linhas se cruzam. Confira a ordem dos pontos no arquivo antes de gerar o perímetro.');
      }
    }
  }
  const signedArea = planar.reduce((sum, p, i) => {
    const next = planar[(i + 1) % planar.length];
    return sum + p.x * next.y - next.x * p.y;
  }, 0);
  if (Math.abs(signedArea) < 1e-7) throw new Error('Os pontos estão alinhados ou formam uma área nula. Não foi possível gerar o polígono.');
  return {ring: [...unique, [...unique[0]]], skippedDuplicates: raw.length - unique.length, uniqueVertices: unique.length};
}

/** Compatibilidade com outros consumidores que necessitam apenas do GeoJSON ring. */
export function polygonRingFromBatch(batch: PointBatch): number[][] {
  return buildPolygonFromBatch(batch).ring;
}
