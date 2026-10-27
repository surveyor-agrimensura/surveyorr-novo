const EPSILON = 1e-9;

export class GeometryKernel {
  distance(a, b) {
    const dx = Number(b?.x) - Number(a?.x); const dy = Number(b?.y) - Number(a?.y);
    return Number.isFinite(dx) && Number.isFinite(dy) ? Math.hypot(dx, dy) : 0;
  }

  polygonArea(points = []) {
    if (points.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i], b = points[(i + 1) % points.length];
      sum += Number(a.x) * Number(b.y) - Number(b.x) * Number(a.y);
    }
    return Math.abs(sum) / 2;
  }

  polygonPerimeter(points = []) {
    if (points.length < 2) return 0;
    return points.reduce((sum, point, index) => sum + this.distance(point, points[(index + 1) % points.length]), 0);
  }

  closestPointOnSegment(point, a, b) {
    const ax = Number(a.x), ay = Number(a.y), bx = Number(b.x), by = Number(b.y);
    const px = Number(point.x), py = Number(point.y);
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy;
    if (len2 < EPSILON) return { x: ax, y: ay, t: 0, distance: Math.hypot(px - ax, py - ay) };
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
    const x = ax + t * vx, y = ay + t * vy;
    return { x, y, t, distance: Math.hypot(px - x, py - y) };
  }

  angle(a, b) { return Math.atan2(Number(b.y) - Number(a.y), Number(b.x) - Number(a.x)) * 180 / Math.PI; }
  clampPoint(point, bounds) {
    return { x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, Number(point.x))), y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, Number(point.y))) };
  }
}
