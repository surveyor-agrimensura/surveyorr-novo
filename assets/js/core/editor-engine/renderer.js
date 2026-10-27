export class RendererRegistry {
  #renderers = new Map();
  register(type, renderer) {
    if (typeof renderer !== 'function') throw new TypeError('renderer deve ser função.');
    this.#renderers.set(String(type), renderer);
    return () => this.#renderers.delete(String(type));
  }
  renderNode(node, context) {
    if (!node) return;
    const renderer = this.#renderers.get(node.type) || this.#renderers.get('*');
    if (renderer) renderer(node, context);
  }
  render(scene, context) {
    scene.values().forEach((node) => this.renderNode(node, context));
  }
}
