import type { PageSpec } from './types.js';

export interface PlotPoint { x: number; y: number; }
export interface PlotRect { x: number; y: number; width: number; height: number; }

export function plotRect(page: PageSpec): PlotRect {
  const gap = 4;
  return {
    x: page.marginMm,
    y: page.marginMm,
    width: page.widthMm - page.marginMm * 2 - page.sidebarMm - gap,
    height: page.heightMm - page.marginMm * 2
  };
}

export function panelRect(page: PageSpec): PlotRect {
  const plot = plotRect(page);
  return {
    x: plot.x + plot.width + 4,
    y: page.marginMm,
    width: page.sidebarMm,
    height: page.heightMm - page.marginMm * 2
  };
}

export function fitPoints(points: PlotPoint[], box: PlotRect, paddingMm = 10): PlotPoint[] {
  if (!points.length) return [];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const innerW = Math.max(1, box.width - paddingMm * 2);
  const innerH = Math.max(1, box.height - paddingMm * 2);
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const usedW = spanX * scale;
  const usedH = spanY * scale;
  const offsetX = box.x + (box.width - usedW) / 2;
  const offsetY = box.y + (box.height - usedH) / 2;
  return points.map((point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (point.y - minY) * scale
  }));
}

export function niceScaleLength(maxMeters: number): number {
  if (!Number.isFinite(maxMeters) || maxMeters <= 0) return 10;
  const target = maxMeters / 4;
  const power = 10 ** Math.floor(Math.log10(target));
  const normalized = target / power;
  const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return step * power;
}
