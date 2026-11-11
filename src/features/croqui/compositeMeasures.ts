import { exteriorBoundaryRuns } from '../../lib/cartographicAutomation';
import type { ProjectDivision } from './projectDivisions';

export function isCompositeBaseCategory(category: unknown): boolean {
  const normalized = String(category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return /^(?:perimetro(?: geral)?|imovel completo|area total)$/.test(normalized);
}

export function isCompositeBaseDivision(division: ProjectDivision): boolean {
  return isCompositeBaseCategory(division.category);
}

function samePoint(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function openRing(ring: ProjectDivision['rings'][number]): ProjectDivision['rings'][number] {
  return ring.length > 1 && samePoint(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring;
}

function comparisonRing(ring: ProjectDivision['rings'][number]): ProjectDivision['rings'][number] {
  const points = [...openRing(ring)];
  let changed = true;
  while (changed && points.length > 3) {
    changed = false;
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[(index + points.length - 1) % points.length];
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const firstX = current[0] - previous[0];
      const firstY = current[1] - previous[1];
      const secondX = next[0] - current[0];
      const secondY = next[1] - current[1];
      const cross = firstX * secondY - firstY * secondX;
      const coordinateScale = Math.max(
        1,
        Math.abs(previous[0]), Math.abs(previous[1]),
        Math.abs(current[0]), Math.abs(current[1]),
        Math.abs(next[0]), Math.abs(next[1])
      );
      const tolerance = Number.EPSILON * 32 * coordinateScale * (
        Math.abs(firstX) + Math.abs(firstY) + Math.abs(secondX) + Math.abs(secondY)
      );
      const between = (current[0] - previous[0]) * (current[0] - next[0])
        + (current[1] - previous[1]) * (current[1] - next[1]);

      if (Math.abs(cross) <= tolerance && between <= tolerance) {
        points.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return points;
}

function sameRing(first: ProjectDivision['rings'][number], second: ProjectDivision['rings'][number]): boolean {
  const a = comparisonRing(first), b = comparisonRing(second);
  if (a.length !== b.length) return false;
  if (!a.length) return true;
  for (let start = 0; start < b.length; start += 1) {
    if (!samePoint(a[0], b[start])) continue;
    let forward = true, reverse = true;
    for (let offset = 1; offset < a.length && (forward || reverse); offset += 1) {
      if (!samePoint(a[offset], b[(start + offset) % b.length])) forward = false;
      if (!samePoint(a[offset], b[(start - offset + b.length) % b.length])) reverse = false;
    }
    if (forward || reverse) return true;
  }
  return false;
}

function sameDivisionGeometry(first: ProjectDivision, second: ProjectDivision): boolean {
  const a = first.rings || [], b = second.rings || [];
  if (!a.length || !b.length || !sameRing(a[0], b[0]) || a.length !== b.length) return false;
  const holes = b.slice(1), matched = new Set<number>();
  for (const hole of a.slice(1)) {
    const index = holes.findIndex((candidate, candidateIndex) => !matched.has(candidateIndex) && sameRing(hole, candidate));
    if (index < 0) return false;
    matched.add(index);
  }
  return true;
}

function uniqueCoincidentDivisions(divisions: readonly ProjectDivision[]): ProjectDivision[] {
  const unique: ProjectDivision[] = [];
  for (const division of divisions) {
    if (!unique.some((candidate) => sameDivisionGeometry(candidate, division))) unique.push(division);
  }
  return unique;
}

export function compositeParts(divisions: readonly ProjectDivision[]): ProjectDivision[] {
  const parts = divisions.filter((division) => !isCompositeBaseDivision(division));
  if (parts.length) return parts;
  const base = divisions.filter(isCompositeBaseDivision);
  return base.length ? uniqueCoincidentDivisions(base) : [...divisions];
}

export function compositeBoundaryDivisions(divisions: readonly ProjectDivision[]): ProjectDivision[] {
  const base = divisions.filter(isCompositeBaseDivision);
  const selected = base.length ? uniqueCoincidentDivisions(base) : [...divisions];
  return selected.filter((division) => (division.rings[0]?.length || 0) >= 3);
}

export function compositeDivisionVertexName(divisionIndex: number, ringIndex: number, vertexIndex: number): string {
  const vertex = String(vertexIndex + 1).padStart(2, '0');
  if (ringIndex === 0) return `V-${vertex}`;
  const area = String(divisionIndex + 1).padStart(2, '0');
  return `A${area}-H${String(ringIndex).padStart(2, '0')}-V${vertex}`;
}

export function compositeArea(divisions: readonly ProjectDivision[]): number {
  const base = divisions.filter(isCompositeBaseDivision);
  const measured = base.length ? uniqueCoincidentDivisions(base) : divisions;
  return measured.reduce((total, division) => total + Math.max(0, division.areaM2), 0);
}

export function compositePerimeter(divisions: readonly ProjectDivision[]): number {
  const boundaries = compositeBoundaryDivisions(divisions)
    .map((division) => ({
      id: `${division.featureId}:${division.partIndex}`,
      points: division.rings[0]!,
      holes: division.rings.slice(1)
    }));
  return exteriorBoundaryRuns(boundaries, { mergeCollinear: true })
    .reduce((total, boundary) => total + boundary.distanceM, 0);
}
