export class CommandStack {
  #undo = [];
  #redo = [];
  #limit;
  #events;

  constructor({ limit = 100, events = null } = {}) {
    this.#limit = Math.max(1, Number(limit) || 100);
    this.#events = events;
  }

  execute(command) {
    if (!command || typeof command.do !== 'function' || typeof command.undo !== 'function') throw new TypeError('Comando inválido.');
    command.do();
    this.#undo.push(command);
    if (this.#undo.length > this.#limit) this.#undo.shift();
    this.#redo.length = 0;
    this.#notify('execute', command);
    return command;
  }

  pushExecuted(command) {
    if (!command || typeof command.undo !== 'function' || typeof command.do !== 'function') throw new TypeError('Comando inválido.');
    this.#undo.push(command);
    if (this.#undo.length > this.#limit) this.#undo.shift();
    this.#redo.length = 0;
    this.#notify('execute', command);
  }

  undo() {
    const command = this.#undo.pop();
    if (!command) return false;
    command.undo();
    this.#redo.push(command);
    this.#notify('undo', command);
    return true;
  }

  redo() {
    const command = this.#redo.pop();
    if (!command) return false;
    command.do();
    this.#undo.push(command);
    this.#notify('redo', command);
    return true;
  }

  clear() { this.#undo.length = 0; this.#redo.length = 0; this.#notify('clear', null); }
  get canUndo() { return this.#undo.length > 0; }
  get canRedo() { return this.#redo.length > 0; }
  get undoDepth() { return this.#undo.length; }
  get redoDepth() { return this.#redo.length; }

  #notify(action, command) {
    this.#events?.emit?.('history:change', { action, command, canUndo: this.canUndo, canRedo: this.canRedo, undoDepth: this.undoDepth, redoDepth: this.redoDepth });
  }
}
