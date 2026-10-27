const clone = (value) => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export class SceneSnapshotCommand {
  constructor({ scene, before, after, label = 'Alteração' } = {}) {
    if (!scene) throw new Error('SceneSnapshotCommand requer scene.');
    this.scene = scene;
    this.before = clone(before);
    this.after = clone(after);
    this.label = label;
  }
  do() { this.scene.restore(this.after); }
  undo() { this.scene.restore(this.before); }
}

export class UpdateNodeCommand {
  constructor({ scene, id, patch, label = 'Atualizar objeto' } = {}) {
    this.scene = scene; this.id = String(id || ''); this.patch = clone(patch || {}); this.label = label;
    const node = scene?.get?.(this.id);
    if (!node) throw new Error(`Objeto não encontrado: ${this.id}`);
    this.before = node.snapshot();
  }
  do() {
    const node = this.scene.get(this.id);
    if (!node) return;
    if (Object.prototype.hasOwnProperty.call(this.patch, 'locked')) node.locked = Boolean(this.patch.locked);
    if (Object.prototype.hasOwnProperty.call(this.patch, 'visible')) node.visible = this.patch.visible !== false;
    if (this.patch.data) node.data = { ...node.data, ...clone(this.patch.data) };
  }
  undo() { this.scene.upsert(this.before); }
}

export class FunctionalCommand {
  constructor({ do: run, undo, label = 'Alteração' } = {}) {
    if (typeof run !== 'function' || typeof undo !== 'function') throw new TypeError('FunctionalCommand requer do e undo.');
    this.run = run; this.rollback = undo; this.label = label;
  }
  do() { this.run(); }
  undo() { this.rollback(); }
}
