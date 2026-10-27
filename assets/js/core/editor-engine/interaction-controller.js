export class InteractionController {
  #bindings = new Set();
  #engine;
  constructor(engine) { this.#engine = engine; }

  bindDrag({ root, selector, idFromElement, pointFromEvent, readPosition, writePosition, constrain = (p) => p, label = 'Mover objeto' } = {}) {
    if (!root) return () => {};
    let drag = null;
    const down = (event) => {
      const element = event.target?.closest?.(selector);
      if (!element || !root.contains(element)) return;
      const id = idFromElement(element, event);
      const node = this.#engine.scene.get(id);
      if (!node || node.locked) return;
      const point = pointFromEvent(event);
      const start = readPosition(node, element);
      if (!point || !start) return;
      event.preventDefault(); event.stopImmediatePropagation?.();
      drag = { id, element, pointerId: event.pointerId, point, start, before: this.#engine.scene.snapshot() };
      element.classList?.add?.('is-dragging');
      // A captura fica no viewport estável. Capturar o próprio elemento que está
      // sendo transformado pode disparar pointercancel em alguns navegadores e
      // interromper o arraste no primeiro movimento.
      try { root.setPointerCapture?.(event.pointerId); } catch (_error) { try { element.setPointerCapture?.(event.pointerId); } catch (_ignored) {} }
      this.#engine.events.emit('interaction:dragstart', { id, point, start, element });
    };
    const move = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const point = pointFromEvent(event); if (!point) return;
      event.preventDefault(); event.stopImmediatePropagation?.();
      const next = constrain({ x: drag.start.x + point.x - drag.point.x, y: drag.start.y + point.y - drag.point.y }, drag);
      const node = this.#engine.scene.get(drag.id); if (!node) return;
      writePosition(node, next, drag.element);
      // Durante o drag renderiza somente o nó ativo. Além de ser mais barato,
      // isso impede que renderizadores de objetos não relacionados reescrevam o
      // SVG enquanto o ponteiro ainda está capturado.
      this.#engine.renderNode?.(drag.id);
      this.#engine.events.emit('interaction:drag', { id: drag.id, position: next });
    };
    const up = (event) => {
      if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
      const before = drag.before; const after = this.#engine.scene.snapshot(); const id = drag.id; const element=drag.element;
      element?.classList?.remove?.('is-dragging');
      drag = null;
      if (JSON.stringify(before) !== JSON.stringify(after)) this.#engine.commitSnapshot(before, after, label);
      this.#engine.events.emit('interaction:dragend', { id, element });
    };
    root.addEventListener('pointerdown', down, true);
    root.addEventListener('pointermove', move, true);
    root.addEventListener('pointerup', up, true);
    root.addEventListener('pointercancel', up, true);
    const dispose = () => { root.removeEventListener('pointerdown', down, true); root.removeEventListener('pointermove', move, true); root.removeEventListener('pointerup', up, true); root.removeEventListener('pointercancel', up, true); };
    this.#bindings.add(dispose);
    return () => { dispose(); this.#bindings.delete(dispose); };
  }

  dispose() { [...this.#bindings].forEach((dispose) => dispose()); this.#bindings.clear(); }
}
