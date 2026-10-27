export class SnapEngine {
  constructor({ geometry, tolerance = 8 } = {}) { this.geometry = geometry; this.tolerance = Math.max(0, Number(tolerance) || 8); }

  snap(point, { vertices = [], segments = [], grid = null } = {}) {
    let best = { kind: 'free', point: { x: Number(point.x), y: Number(point.y) }, distance: Infinity, target: null };
    for (const vertex of vertices) {
      const distance = this.geometry.distance(point, vertex);
      if (distance <= this.tolerance && distance < best.distance) best = { kind: 'vertex', point: { x: Number(vertex.x), y: Number(vertex.y) }, distance, target: vertex };
    }
    for (const segment of segments) {
      const hit = this.geometry.closestPointOnSegment(point, segment.a, segment.b);
      if (hit.distance <= this.tolerance && hit.distance < best.distance) best = { kind: 'edge', point: { x: hit.x, y: hit.y }, distance: hit.distance, target: segment };
    }
    if (grid && Number(grid.step) > 0 && best.kind === 'free') {
      const x = Math.round((Number(point.x) - (grid.originX || 0)) / grid.step) * grid.step + (grid.originX || 0);
      const y = Math.round((Number(point.y) - (grid.originY || 0)) / grid.step) * grid.step + (grid.originY || 0);
      const distance = this.geometry.distance(point, { x, y });
      if (distance <= this.tolerance) best = { kind: 'grid', point: { x, y }, distance, target: null };
    }
    return best;
  }
}
