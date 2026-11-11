import { describe, expect, it } from 'vitest';
import { measureMapGeometry } from '../src/features/map/geometryMetrics';
import { getPolygons } from '../src/features/memorial/memorialEngine';

const exterior = [
  [-39.6359253, -12.9746166],
  [-39.6033096, -12.9746166],
  [-39.6033096, -13.0030524],
  [-39.6359253, -13.0030524],
  [-39.6359253, -12.9746166]
] as [number, number][];

const hole = [
  [-39.627, -12.982],
  [-39.622, -12.982],
  [-39.622, -12.987],
  [-39.627, -12.987],
  [-39.627, -12.982]
] as [number, number][];

function memorialPolygon(rings: [number, number][][]) {
  return getPolygons([{
    id: 'synthetic-parcel',
    properties: {},
    geoJson: { type: 'Polygon', coordinates: rings }
  }])[0];
}

describe('métricas geográficas consistentes entre Mapa e documentos', () => {
  it('usa a mesma área e o mesmo perímetro do Croqui, Prancha e Memorial', () => {
    const expected = memorialPolygon([exterior]);
    const actual = measureMapGeometry({ type: 'Polygon', coordinates: [exterior] });

    expect(actual.vertexCount).toBe(4);
    expect(actual.areaM2).toBeCloseTo(expected.areaM2, 3);
    expect(actual.perimeterMeters).toBeCloseTo(expected.perimeterM, 3);
  });

  it('mantém área descontada e perímetro dos anéis internos', () => {
    const expected = memorialPolygon([exterior, hole]);
    const actual = measureMapGeometry({ type: 'Polygon', coordinates: [exterior, hole] });

    expect(actual.vertexCount).toBe(8);
    expect(actual.areaM2).toBeCloseTo(expected.areaM2, 3);
    expect(actual.perimeterMeters).toBeCloseTo(expected.perimeterM, 3);
  });
});
