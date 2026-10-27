const clone = (value) => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export class TechnicalDocumentEngineAdapter {
  constructor(engine, { getSegments, setSegments, getSettings, setSettings, render } = {}) {
    this.engine = engine;
    this.getSegments = getSegments;
    this.setSegments = setSegments;
    this.getSettings = getSettings;
    this.setSettings = setSettings;
    this.renderLegacy = render;
    this.nodeId = 'technical-document-state';
  }

  capture() {
    return { segments: clone(this.getSegments?.() || []), settings: clone(this.getSettings?.() || {}) };
  }

  mount() {
    const state = this.capture();
    this.engine.addNode({ id: this.nodeId, type: 'technical-document', data: state });
    this.engine.registerRenderer('technical-document', (node) => {
      this.setSegments?.(clone(node.data.segments || []));
      this.setSettings?.(clone(node.data.settings || {}));
      this.renderLegacy?.();
    });
    return this;
  }

  checkpoint(label = 'Alteração') {
    const before = this.engine.scene.snapshot();
    const node = this.engine.getNode(this.nodeId);
    if (node) node.data = this.capture();
    return { label, before };
  }

  commit(token) {
    const node = this.engine.getNode(this.nodeId);
    if (node) node.data = this.capture();
    const after = this.engine.scene.snapshot();
    if (JSON.stringify(token?.before) !== JSON.stringify(after)) this.engine.commitSnapshot(token.before, after, token?.label || 'Alteração');
  }

  syncFromLegacy() {
    const node = this.engine.getNode(this.nodeId);
    if (node) node.data = this.capture();
  }

  applyFromEngine() { this.engine.render(); }
  undo() { if (!this.engine.undo()) return false; this.applyFromEngine(); return true; }
  redo() { if (!this.engine.redo()) return false; this.applyFromEngine(); return true; }
}
