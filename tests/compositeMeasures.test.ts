import { describe, expect, it } from 'vitest';
import { compositeArea, compositeBoundaryDivisions, compositeDivisionVertexName, compositeParts, compositePerimeter } from '../src/features/croqui/compositeMeasures';
import { distance } from '../src/features/memorial/memorialEngine';
import type { ProjectDivision } from '../src/features/croqui/projectDivisions';

const division = (featureId: string, category: string, rings: ProjectDivision['rings'], areaM2: number): ProjectDivision => ({
  featureId, partIndex: 0, category, name: featureId, rings, areaM2, perimeterM: 0
});

const perimeter = (ring: ProjectDivision['rings'][number]) => ring.reduce(
  (total, point, index) => total + distance(point, ring[(index + 1) % ring.length]), 0
);

describe('medidas do imóvel composto', () => {
  it('conta uma vez o contorno compartilhado e prefere a feição-base ao total das glebas', () => {
    const parent = [[0, 0], [2, 0], [2, 1], [0, 1]] as [number, number][];
    const left = [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][];
    const right = [[1, 0], [2, 0], [2, 1], [1, 1], [1, 0.5]] as [number, number][];
    const parts = [
      division('imovel', 'perímetro geral', [parent], 200),
      division('gleba-a', 'gleba', [left], 100),
      division('gleba-b', 'gleba', [right], 100)
    ];

    expect(compositePerimeter(parts)).toBeCloseTo(perimeter(parent), 2);
    expect(compositePerimeter(parts)).toBeLessThan(parts.reduce((sum, part) => sum + perimeter(part.rings[0]), 0));
    expect(compositeArea(parts)).toBe(200);
    expect(compositeParts(parts).map((part) => part.featureId)).toEqual(['gleba-a', 'gleba-b']);
  });

  it('mantém área e perímetro vinculados à feição-base quando uma gleba ultrapassa seu contorno', () => {
    const base = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]] as [number, number][];
    const outside = [[0.001, 0], [0.002, 0], [0.002, 0.001], [0.001, 0.001]] as [number, number][];
    const parts = [division('base', 'Perímetro Geral', [base], 100), division('gleba-fora', 'gleba', [outside], 100)];
    expect(compositeArea(parts)).toBe(100);
    expect(compositePerimeter(parts)).toBeCloseTo(perimeter(base), 2);
    expect(compositeBoundaryDivisions(parts).map((part) => part.featureId)).toEqual(['base']);
  });

  it('reconhece as categorias-base do mapa com e sem acentos', () => {
    const parent = [[0, 0], [2, 0], [2, 1], [0, 1]] as [number, number][];
    const left = [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][];
    const right = [[1, 0], [2, 0], [2, 1], [1, 1]] as [number, number][];
    const parts = [
      division('perimetro', 'Perímetro', [parent], 200),
      division('imovel', 'Imóvel Completo', [parent], 200),
      division('gleba-a', 'Gleba', [left], 100),
      division('gleba-b', 'Gleba', [right], 100)
    ];
    expect(compositeArea(parts)).toBe(200);
    expect(compositePerimeter(parts)).toBeCloseTo(perimeter(parent), 2);
    expect(compositeBoundaryDivisions(parts).map((part) => part.featureId)).toEqual(['perimetro']);
    expect(compositeParts(parts).map((part) => part.featureId)).toEqual(['gleba-a', 'gleba-b']);
  });

  it('gera nomes estáveis e distintos para vértices de anéis internos', () => {
    expect(compositeDivisionVertexName(0, 1, 0)).toBe('A01-H01-V01');
    expect(compositeDivisionVertexName(1, 2, 3)).toBe('A02-H02-V04');
  });

  it('deduplica feições-base coincidentes sem remover bases disjuntas', () => {
    const first = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]] as [number, number][];
    const sameRotatedAndReversed = [[0.001, 0.001], [0.001, 0], [0, 0], [0, 0.001]] as [number, number][];
    const sameWithCollinearVertex = [[0, 0], [0.0005, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]] as [number, number][];
    const duplicateBase = [
      division('base', 'Perímetro Geral', [first], 100),
      division('base-copia', 'Área total', [sameRotatedAndReversed], 100)
    ];
    expect(compositeArea(duplicateBase)).toBe(100);
    expect(compositePerimeter(duplicateBase)).toBeCloseTo(perimeter(first), 2);
    expect(compositeBoundaryDivisions(duplicateBase)).toHaveLength(1);
    expect(compositeParts(duplicateBase)).toHaveLength(1);

    const separate = [[0.002, 0], [0.003, 0], [0.003, 0.001], [0.002, 0.001]] as [number, number][];
    const disjointBases = [duplicateBase[0], division('base-separada', 'Perímetro Geral', [separate], 100)];
    expect(compositeArea(disjointBases)).toBe(200);
    expect(compositeParts(disjointBases)).toHaveLength(2);

    const differentlySegmentedBases = [
      duplicateBase[0],
      division('base-segmentada', 'Perímetro Geral', [sameWithCollinearVertex], 100)
    ];
    expect(compositeArea(differentlySegmentedBases)).toBe(100);
    expect(compositeBoundaryDivisions(differentlySegmentedBases)).toHaveLength(1);
    expect(compositeParts(differentlySegmentedBases)).toHaveLength(1);

    const slanted = [[-39.6, -13], [-39.599, -12.999], [-39.598, -12.999], [-39.599, -13]] as [number, number][];
    const slantedWithCollinearVertex = [
      [-39.6, -13], [-39.59966666666667, -12.999666666666666],
      [-39.599, -12.999], [-39.598, -12.999], [-39.599, -13]
    ] as [number, number][];
    const slantedBases = [
      division('base-diagonal', 'Perímetro Geral', [slanted], 100),
      division('base-diagonal-segmentada', 'Perímetro Geral', [slantedWithCollinearVertex], 100)
    ];
    expect(compositeArea(slantedBases)).toBe(100);
    expect(compositeBoundaryDivisions(slantedBases)).toHaveLength(1);

    const slightBend = [
      [-39.6, -13], [-39.59966666666667, -12.999666656666666],
      [-39.599, -12.999], [-39.598, -12.999], [-39.599, -13]
    ] as [number, number][];
    expect(compositeArea([
      slantedBases[0], division('base-com-pequena-divisa', 'Perímetro Geral', [slightBend], 100)
    ])).toBe(200);
  });

  it('remove a divisória entre glebas mesmo quando só um lado tem vértice intermediário', () => {
    const left = [[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][];
    const right = [[1, 0], [2, 0], [2, 1], [1, 1], [1, 0.5]] as [number, number][];
    const outside = [[0, 0], [2, 0], [2, 1], [0, 1]] as [number, number][];
    const parts = [division('left', 'gleba', [left], 100), division('right', 'gleba', [right], 100)];
    expect(compositePerimeter(parts)).toBeCloseTo(perimeter(outside), 2);
  });

  it('inclui anéis internos no perímetro da união', () => {
    const outer = [[0, 0], [2, 0], [2, 2], [0, 2]] as [number, number][];
    const hole = [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]] as [number, number][];
    expect(compositePerimeter([division('com-vazio', 'gleba', [outer, hole], 300)])).toBeCloseTo(
      perimeter(outer) + perimeter(hole), 3
    );
  });

  it('preserva o perímetro de um furo estreito com lados longos', () => {
    const outer = [[0, 0], [0.0002, 0], [0.0002, 0.0002], [0, 0.0002]] as [number, number][];
    const hole = [[0.00009955, 0.00005], [0.00010045, 0.00005], [0.00010045, 0.00015], [0.00009955, 0.00015]] as [number, number][];
    expect(compositePerimeter([division('furo-estreito', 'gleba', [outer, hole], 100)])).toBeCloseTo(
      perimeter(outer) + perimeter(hole), 2
    );
  });
});
