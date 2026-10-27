import type { LngLat, TechnicalMetrics, TechnicalProject } from './types.js';

const EARTH_RADIUS_M = 6371008.8;
const toRad = (value: number) => value * Math.PI / 180;

export function closeRing(input: LngLat[]): LngLat[] {
  const ring = input.filter((point) => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]));
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

export function largestRing(geometry: TechnicalProject['geometry']): LngLat[] {
  if (geometry.type === 'Polygon') return closeRing((geometry.coordinates?.[0] || []) as unknown as LngLat[]);
  const rings = (geometry.coordinates || []).map((polygon) => closeRing((polygon?.[0] || []) as unknown as LngLat[]));
  return rings.sort((a, b) => Math.abs(sphericalArea(b)) - Math.abs(sphericalArea(a)))[0] || [];
}

export function haversine(a: LngLat, b: LngLat): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = lat2 - lat1;
  const dLng = toRad(b[0] - a[0]);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(q)));
}

export function sphericalArea(ring: LngLat[]): number {
  const closed = closeRing(ring);
  if (closed.length < 4) return 0;
  let sum = 0;
  for (let i = 0; i < closed.length - 1; i += 1) {
    const a = closed[i];
    const b = closed[i + 1];
    sum += toRad(b[0] - a[0]) * (2 + Math.sin(toRad(a[1])) + Math.sin(toRad(b[1])));
  }
  return sum * EARTH_RADIUS_M * EARTH_RADIUS_M / 2;
}

export function metrics(project: TechnicalProject): TechnicalMetrics {
  const ring = largestRing(project.geometry);
  const perimeterM = ring.slice(1).reduce((sum, point, index) => sum + haversine(ring[index], point), 0);
  return {
    areaHa: Math.abs(sphericalArea(ring)) / 10000,
    perimeterM,
    vertexCount: Math.max(0, ring.length - 1)
  };
}

export function hiddenVertexIndexes(project: TechnicalProject, ring: LngLat[]): Set<number> {
  const hidden = new Set(project.hiddenVertexKeys || []);
  const result = new Set<number>();
  ring.slice(0, -1).forEach((coord, index) => {
    const key = `${Number(coord[1]).toFixed(8)},${Number(coord[0]).toFixed(8)}`;
    if (hidden.has(key)) result.add(index);
  });
  return result;
}

export function localMeters(ring: LngLat[]): Array<{ x: number; y: number }> {
  const closed = closeRing(ring);
  if (!closed.length) return [];
  const lon0 = closed.reduce((sum, point) => sum + point[0], 0) / closed.length;
  const lat0 = closed.reduce((sum, point) => sum + point[1], 0) / closed.length;
  const cosLat = Math.cos(toRad(lat0));
  return closed.map(([lon, lat]) => ({
    x: EARTH_RADIUS_M * toRad(lon - lon0) * cosLat,
    y: -EARTH_RADIUS_M * toRad(lat - lat0)
  }));
}
