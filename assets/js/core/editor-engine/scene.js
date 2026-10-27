const clone = (value) => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export class SceneNode {
  constructor({ id, type = 'object', locked = false, visible = true, data = {} } = {}) {
    if (!id) throw new Error('SceneNode requer id.');
    this.id = String(id);
    this.type = String(type || 'object');
    this.locked = Boolean(locked);
    this.visible = visible !== false;
    this.data = clone(data || {});
  }

  snapshot() {
    return { id: this.id, type: this.type, locked: this.locked, visible: this.visible, data: clone(this.data) };
  }
}

export class Scene {
  #nodes = new Map();
  #selection = new Set();

  add(nodeLike) {
    const node = nodeLike instanceof SceneNode ? nodeLike : new SceneNode(nodeLike);
    this.#nodes.set(node.id, node);
    return node;
  }

  upsert(nodeLike) { return this.add(nodeLike); }
  get(id) { return this.#nodes.get(String(id)) || null; }
  has(id) { return this.#nodes.has(String(id)); }
  remove(id) { this.#selection.delete(String(id)); return this.#nodes.delete(String(id)); }
  values() { return [...this.#nodes.values()]; }

  select(ids) {
    this.#selection.clear();
    const input = Array.isArray(ids) ? ids : [ids];
    input.filter(Boolean).map(String).forEach((id) => { if (this.#nodes.has(id)) this.#selection.add(id); });
    return this.selection();
  }

  selection() { return [...this.#selection].map((id) => this.#nodes.get(id)).filter(Boolean); }
  clearSelection() { this.#selection.clear(); }

  snapshot() {
    return { nodes: this.values().map((node) => node.snapshot()), selection: [...this.#selection] };
  }

  restore(snapshot = {}) {
    this.#nodes.clear();
    (snapshot.nodes || []).forEach((node) => this.add(node));
    this.select(snapshot.selection || []);
  }
}
