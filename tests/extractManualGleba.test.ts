import { describe, expect, it } from 'vitest';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { extractManualGleba } from '../src/features/map/extractManualGleba';
import { measureMapGeometry } from '../src/features/map/geometryMetrics';

type MapFeature = Feature<Geometry, GeoJsonProperties>;
const parentRing = [
  [-40.01, -13.01],
  [-39.99, -13.01],
  [-39.99, -12.99],
  [-40.01, -12.99],
  [-40.01, -13.01]
] as number[][];

function polygon(id: string, ring: number[][]): MapFeature {
  return { type: 'Feature', id, properties: { name: id }, geometry: { type: 'Polygon', coordinates: [ring] } };
}

describe('recorte automático de gleba manual', () => {
  it('retira a área do imóvel quando o desenho acompanha um trecho da divisa', () => {
    const parent = polygon('parent', parentRing);
    const child = polygon('child', [
      [-40.005, -13.01],
      [-40.003, -13.01],
      [-40.003, -13.005],
      [-40.005, -13.005],
      [-40.005, -13.01]
    ]);

    const result = extractManualGleba(parent, child);
    const oldArea = measureMapGeometry(parent.geometry).areaM2;

    expect(result.remainder.geometry.type).toBe('Polygon');
    expect(result.gleba.geometry.type).toBe('Polygon');
    if (result.remainder.geometry.type !== 'Polygon') throw new Error('O remanescente deveria continuar como polígono.');
    expect(measureMapGeometry(result.remainder.geometry).areaM2).toBeLessThan(oldArea);
    expect(result.remainder.geometry.coordinates).toHaveLength(1);
    expect(result.gleba.properties?.extractedFromParent).toBe(true);
  });

  it('mantém o imóvel e a gleba como áreas separadas quando o desenho fica dentro', () => {
    const parent = polygon('parent', parentRing);
    const child = polygon('child', [
      [-40.005, -13.005],
      [-40.003, -13.005],
      [-40.003, -13.003],
      [-40.005, -13.003],
      [-40.005, -13.005]
    ]);
    const oldArea = measureMapGeometry(parent.geometry).areaM2;

    const result = extractManualGleba(parent, child);

    expect(result.remainder.geometry.type).toBe('Polygon');
    if (result.remainder.geometry.type !== 'Polygon') throw new Error('O remanescente deveria continuar como polígono.');
    expect(result.remainder.geometry.coordinates).toHaveLength(2);
    expect(result.gleba.properties?.extractedFromParent).toBe(true);
    expect(measureMapGeometry(result.remainder.geometry).areaM2 + measureMapGeometry(result.gleba.geometry).areaM2)
      .toBeCloseTo(oldArea, -1);
  });

  it('limita ao imóvel o desenho que ultrapassa sua borda', () => {
    const parent = polygon('parent', parentRing);
    const child = polygon('child', [
      [-40.02, -13.005],
      [-40.005, -13.005],
      [-40.005, -13.003],
      [-40.02, -13.003],
      [-40.02, -13.005]
    ]);

    const result = extractManualGleba(parent, child);

    expect(measureMapGeometry(result.gleba.geometry).areaM2).toBeGreaterThan(0);
    expect(measureMapGeometry(result.gleba.geometry).areaM2).toBeLessThan(measureMapGeometry(child.geometry).areaM2);
    expect(measureMapGeometry(result.remainder.geometry).areaM2).toBeLessThan(measureMapGeometry(parent.geometry).areaM2);
  });

  it('rejeita um desenho fora do imóvel sem modificar as feições de entrada', () => {
    const parent = polygon('parent', parentRing);
    const child = polygon('child', [
      [-40.03, -13.005],
      [-40.025, -13.005],
      [-40.025, -13.003],
      [-40.03, -13.003],
      [-40.03, -13.005]
    ]);
    const before = JSON.stringify(parent);

    expect(() => extractManualGleba(parent, child)).toThrow('não intersecta');
    expect(JSON.stringify(parent)).toBe(before);
  });
});
