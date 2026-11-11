import type { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { makeProjection, type XY } from '../generations/geometry';
import { openRing, closeRing } from './vertexEditing';
import { reorderVertexAppearance } from './vertexAppearance';

export type MapFeature = Feature<Geometry, GeoJsonProperties>;
export type AdvancedToolKind = 'frontback' | 'profile' | 'cutfill' | 'contours' | 'spot' | 'earth3d' | 'buffer';

export type SegmentSide = 'frente' | 'fundo' | 'direita' | 'esquerda' | 'divisa';

export function reversePolygonRing(feature: MapFeature): MapFeature {
  if (feature.geometry.type !== 'Polygon') return feature;
  const open = openRing(feature.geometry.coordinates[0]);
  if (open.length < 3) return feature;
  const reversed = [open[0], ...open.slice(1).reverse()];
  return {
    ...feature,
    properties: reorderVertexAppearance(feature.properties, index => index === 0 ? 0 : open.length - index, open.length),
    geometry: {
      ...feature.geometry,
      coordinates: [closeRing(reversed)]
    }
  };
}

export function rotatePolygonStartVertex(feature: MapFeature, startIndex: number): MapFeature {
  if (feature.geometry.type !== 'Polygon') return feature;
  const open = openRing(feature.geometry.coordinates[0]);
  const n = open.length;
  if (n < 3) return feature;
  const idx = ((startIndex % n) + n) % n;
  if (idx === 0) return feature;
  const rotated = [...open.slice(idx), ...open.slice(0, idx)];
  return {
    ...feature,
    properties: reorderVertexAppearance(feature.properties, index => (index - idx + n) % n, n),
    geometry: {
      ...feature.geometry,
      coordinates: [closeRing(rotated)]
    }
  };
}

export function buildBufferPolygon(feature: MapFeature, offsetMeters: number): MapFeature | null {
  if (feature.geometry.type !== 'Polygon' || !Number.isFinite(offsetMeters) || Math.abs(offsetMeters) < 0.05) return null;
  const open = openRing(feature.geometry.coordinates[0]);
  if (open.length < 3) return null;
  const pr = makeProjection(open[0][0], open[0][1]);
  const pts = open.map(([lon, lat]) => pr.toXY({ lon, lat }));
  const signedArea = pts.reduce((acc, p, i) => {
    const next = pts[(i + 1) % pts.length];
    return acc + (p.x * next.y - next.x * p.y);
  }, 0) / 2;
  const ccw = signedArea > 0;
  const n = pts.length;
  const buffered: XY[] = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2) || 1;
    // Outward normal
    const nx1 = ccw ? dy1 / len1 : -dy1 / len1;
    const ny1 = ccw ? -dx1 / len1 : dx1 / len1;
    const nx2 = ccw ? dy2 / len2 : -dy2 / len2;
    const ny2 = ccw ? -dx2 / len2 : dx2 / len2;
    let bx = nx1 + nx2;
    let by = ny1 + ny2;
    const blen = Math.hypot(bx, by);
    if (blen < 1e-6) {
      bx = nx1;
      by = ny1;
    } else {
      bx /= blen;
      by /= blen;
    }
    const cosHalf = Math.max(0.35, Math.abs(bx * nx1 + by * ny1));
    const scale = offsetMeters / cosHalf;
    buffered.push({
      x: curr.x + bx * scale,
      y: curr.y + by * scale
    });
  }

  const geoRing = buffered.map(pt => {
    const g = pr.toGeo(pt);
    return [g.lon, g.lat];
  });
  const baseName = String(feature.properties?.name || 'Perímetro');
  const label = offsetMeters > 0 ? `${baseName} — Buffer +${offsetMeters}m` : `${baseName} — Recuo ${offsetMeters}m`;
  return {
    type: 'Feature',
    id: crypto.randomUUID(),
    properties: {
      source: 'surveyor-buffer',
      category: 'Faixa / Buffer',
      name: label,
      strokeColor: offsetMeters > 0 ? '#0ea5e9' : '#f97316',
      fillColor: offsetMeters > 0 ? '#38bdf8' : '#fb923c',
      fillOpacity: 0.2,
      bufferMeters: offsetMeters,
      createdAt: new Date().toISOString()
    },
    geometry: {
      type: 'Polygon',
      coordinates: [closeRing(geoRing)]
    }
  };
}

export function featuresToDxf(features: MapFeature[]): string {
  const valid = features.filter(f => f.properties?.hidden !== true);
  let refLon = -41.5;
  let refLat = -12.9;
  for (const f of valid) {
    if (f.geometry.type === 'Polygon' && f.geometry.coordinates[0]?.[0]) {
      refLon = f.geometry.coordinates[0][0][0];
      refLat = f.geometry.coordinates[0][0][1];
      break;
    }
    if (f.geometry.type === 'LineString' && f.geometry.coordinates[0]) {
      refLon = f.geometry.coordinates[0][0];
      refLat = f.geometry.coordinates[0][1];
      break;
    }
    if (f.geometry.type === 'Point' && f.geometry.coordinates) {
      refLon = f.geometry.coordinates[0];
      refLat = f.geometry.coordinates[1];
      break;
    }
  }
  const pr = makeProjection(refLon, refLat);
  const lines = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];

  valid.forEach((f, idx) => {
    const rawName = String(f.properties?.name || `FEICAO_${idx + 1}`)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_-]/g, '_')
      .toUpperCase() || `FEICAO_${idx + 1}`;

    if (f.geometry.type === 'Polygon') {
      const open = openRing(f.geometry.coordinates[0]);
      if (open.length >= 3) {
        lines.push('0', 'LWPOLYLINE', '8', rawName, '90', String(open.length), '70', '1');
        open.forEach(([lon, lat]) => {
          const p = pr.toXY({ lon, lat });
          lines.push('10', p.x.toFixed(4), '20', p.y.toFixed(4));
        });
        open.forEach(([lon, lat], vIdx) => {
          const p = pr.toXY({ lon, lat });
          lines.push('0', 'TEXT', '8', `${rawName}_VERTICES`, '10', (p.x + 1.2).toFixed(4), '20', (p.y + 1.2).toFixed(4), '40', '2.2', '1', `V-${String(vIdx + 1).padStart(2, '0')}`);
        });
      }
    } else if (f.geometry.type === 'LineString') {
      const pts = f.geometry.coordinates;
      if (pts.length >= 2) {
        const elev = Number(f.properties?.elevationM);
        lines.push('0', 'LWPOLYLINE', '8', rawName, '90', String(pts.length), '70', '0');
        if (Number.isFinite(elev)) lines.push('38', elev.toFixed(3));
        pts.forEach(([lon, lat]) => {
          const p = pr.toXY({ lon, lat });
          lines.push('10', p.x.toFixed(4), '20', p.y.toFixed(4));
        });
      }
    } else if (f.geometry.type === 'Point') {
      const [lon, lat, zRaw] = f.geometry.coordinates;
      const z = Number.isFinite(Number(f.properties?.elevationM)) ? Number(f.properties?.elevationM) : Number.isFinite(Number(zRaw)) ? Number(zRaw) : 0;
      const p = pr.toXY({ lon, lat });
      lines.push('0', 'POINT', '8', rawName, '10', p.x.toFixed(4), '20', p.y.toFixed(4), '30', z.toFixed(3));
      lines.push('0', 'TEXT', '8', `${rawName}_TEXTO`, '10', (p.x + 1).toFixed(4), '20', (p.y + 1).toFixed(4), '40', '2.0', '1', String(f.properties?.name || `P-${idx + 1}`));
    }
  });

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\r\n');
}

export function autoClassifySides(openCoords: number[][]): SegmentSide[] {
  if (openCoords.length < 3) return [];
  const pr = makeProjection(openCoords[0][0], openCoords[0][1]);
  const pts = openCoords.map(([lon, lat]) => pr.toXY({ lon, lat }));
  // Compute segment normals and assign South-most as Frente, North-most as Fundo, East as Direita, West as Esquerda
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const angle = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    if (angle >= 45 && angle < 135) return 'frente';
    if (angle >= 135 && angle < 225) return 'direita';
    if (angle >= 225 && angle < 315) return 'fundo';
    return 'esquerda';
  });
}

export async function queryElevations(points: { lat: number; lon: number }[]): Promise<{ elevations: number[]; source: 'open-meteo' }> {
  if (!points.length) return { elevations: [], source: 'open-meteo' };
  try {
    const results: number[] = [];
    for (let i = 0; i < points.length; i += 50) {
      const batch = points.slice(i, i + 50);
      const qs = new URLSearchParams({
        latitude: batch.map(p => p.lat.toFixed(6)).join(','),
        longitude: batch.map(p => p.lon.toFixed(6)).join(',')
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/elevation?${qs}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { elevation?: number[] };
        if (!Array.isArray(data.elevation) || data.elevation.length !== batch.length || data.elevation.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
          throw new Error('Dados altimétricos incompletos');
        }
        results.push(...data.elevation.map(v => Number(Number(v).toFixed(2))));
      } finally {
        clearTimeout(timer);
      }
    }
    return { elevations: results, source: 'open-meteo' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'serviço indisponível';
    throw new Error(`Não foi possível consultar elevações reais (${reason}). Os resultados estimados não serão usados.`);
  }
}

export function pointInPolygonXY(pt: XY, poly: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
