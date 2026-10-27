import { EventBus } from './event-bus.js';
import { Scene } from './scene.js';
import { CommandStack } from './command-stack.js';
import { SceneSnapshotCommand, UpdateNodeCommand } from './commands.js';
import { GeometryKernel } from './geometry-kernel.js';
import { SnapEngine } from './snap-engine.js';
import { RendererRegistry } from './renderer.js';
import { InteractionController } from './interaction-controller.js';
import { GeometryWorkerClient } from './worker-client.js';
import { ToolStateMachine } from './tool-state-machine.js';

export class SurveyorEditorEngine {
  constructor({ historyLimit = 100, snapTolerance = 8, renderContext = null } = {}) {
    this.events = new EventBus();
    this.scene = new Scene();
    this.geometry = new GeometryKernel();
    this.snap = new SnapEngine({ geometry: this.geometry, tolerance: snapTolerance });
    this.renderers = new RendererRegistry();
    this.history = new CommandStack({ limit: historyLimit, events: this.events });
    this.interactions = new InteractionController(this);
    this.worker = new GeometryWorkerClient();
    this.tools = new ToolStateMachine({ events: this.events });
    this.renderContext = renderContext;
    this.destroyed = false;
  }

  registerRenderer(type, renderer) { return this.renderers.register(type, renderer); }
  render(context = this.renderContext) { if (!this.destroyed) this.renderers.render(this.scene, context); }
  renderNode(id, context = this.renderContext) {
    if (this.destroyed) return;
    const node = typeof id === 'string' ? this.scene.get(id) : id;
    if (node) this.renderers.renderNode(node, context);
  }
  addNode(node) { const added = this.scene.add(node); this.events.emit('scene:change', { action: 'add', node: added }); return added; }
  removeNode(id) { const removed = this.scene.remove(id); if (removed) this.events.emit('scene:change', { action: 'remove', id: String(id) }); return removed; }
  getNode(id) { return this.scene.get(id); }
  select(ids) { const selected = this.scene.select(ids); this.events.emit('selection:change', selected); return selected; }
  lock(id, locked = true) { return this.history.execute(new UpdateNodeCommand({ scene: this.scene, id, patch: { locked }, label: locked ? 'Bloquear objeto' : 'Desbloquear objeto' })); }
  updateNode(id, patch, label = 'Atualizar objeto') { return this.history.execute(new UpdateNodeCommand({ scene: this.scene, id, patch, label })); }
  commitSnapshot(before, after, label = 'Alteração') { this.history.pushExecuted(new SceneSnapshotCommand({ scene: this.scene, before, after, label })); }
  undo() { const changed = this.history.undo(); if (changed) { this.render(); this.events.emit('scene:change', { action: 'undo' }); } return changed; }
  redo() { const changed = this.history.redo(); if (changed) { this.render(); this.events.emit('scene:change', { action: 'redo' }); } return changed; }
  setTool(toolId, context) { return this.tools.setTool(toolId, context); }
  toggleTool(toolId, context) { return this.tools.toggleTool(toolId, context); }
  getActiveTool() { return this.tools.getActiveTool(); }
  getActiveToolId() { return this.tools.getActiveToolId(); }
  cancelTool() { return this.tools.cancel(); }
  destroy() { this.tools.destroy(); this.interactions.dispose(); this.worker.destroy(); this.events.clear(); this.history.clear(); this.destroyed = true; }
}
