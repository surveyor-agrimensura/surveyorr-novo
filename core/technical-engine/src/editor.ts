import type { LabelOffsetMap } from './types.js';
import { TechnicalEngine } from './engine.js';

export interface EditorBindings {
  host: HTMLElement;
  engine: TechnicalEngine;
  rerender: () => void;
  onChange?: (offsets: LabelOffsetMap) => void;
}

export function bindVertexLabelEditor({ host, engine, rerender, onChange }: EditorBindings): () => void {
  let drag: { key: string; startX: number; startY: number; baseDx: number; baseDy: number; svg: SVGSVGElement } | null = null;

  const pointInSvg = (svg: SVGSVGElement, event: PointerEvent) => {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM()?.inverse();
    return matrix ? point.matrixTransform(matrix) : null;
  };

  const down = (event: PointerEvent) => {
    const target = (event.target as Element | null)?.closest?.('[data-label-key]') as SVGTextElement | null;
    const svg = target?.ownerSVGElement;
    if (!target || !svg) return;
    const key = target.dataset.labelKey || '';
    const point = pointInSvg(svg, event);
    if (!key || !point) return;
    const current = engine.getOffsets()[key] || { dx: 0, dy: 0 };
    drag = { key, startX: point.x, startY: point.y, baseDx: current.dx, baseDy: current.dy, svg };
    target.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const move = (event: PointerEvent) => {
    if (!drag) return;
    const point = pointInSvg(drag.svg, event);
    if (!point) return;
    engine.updateLabelOffset(drag.key, drag.baseDx + point.x - drag.startX, drag.baseDy + point.y - drag.startY);
    const label = drag.svg.querySelector(`[data-label-key="${CSS.escape(drag.key)}"]`) as SVGTextElement | null;
    if (label) {
      const baseX = Number(label.dataset.baseX || label.getAttribute('x') || 0);
      const baseY = Number(label.dataset.baseY || label.getAttribute('y') || 0);
      if (!label.dataset.baseX) label.dataset.baseX = String(baseX);
      if (!label.dataset.baseY) label.dataset.baseY = String(baseY);
      const offset = engine.getOffsets()[drag.key];
      label.setAttribute('x', String(baseX + offset.dx));
      label.setAttribute('y', String(baseY + offset.dy));
    }
    event.preventDefault();
  };

  const up = () => {
    if (!drag) return;
    drag = null;
    onChange?.(engine.getOffsets());
    rerender();
  };

  host.addEventListener('pointerdown', down);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  return () => {
    host.removeEventListener('pointerdown', down);
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerup', up);
    host.removeEventListener('pointercancel', up);
  };
}
