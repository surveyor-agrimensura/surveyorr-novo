/** Métricas esféricas aproximadas para exibição consistente entre os módulos.
 * Não substituem cálculo elipsoidal em CRS apropriado para levantamento certificado. */
export type LonLat = readonly [longitude: number, latitude: number];

export const SPHERICAL_EARTH_MEAN_RADIUS_M = 6_371_008.8;
const RAD = Math.PI / 180;

export function sphericalDistanceM(a: LonLat, b: LonLat): number {
  const latA = a[1] * RAD;
  const latB = b[1] * RAD;
  const deltaLat = (b[1] - a[1]) * RAD;
  const deltaLon = (b[0] - a[0]) * RAD;
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return 2 * SPHERICAL_EARTH_MEAN_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}

export function sphericalRingAreaM2(vertices: readonly LonLat[]): number {
  if (vertices.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += (b[0] - a[0]) * RAD * (2 + Math.sin(a[1] * RAD) + Math.sin(b[1] * RAD));
  }
  return Math.abs(sum) * SPHERICAL_EARTH_MEAN_RADIUS_M ** 2 / 2;
}
