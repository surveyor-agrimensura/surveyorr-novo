export class EventBus {
  #listeners = new Map();

  on(type, listener) {
    if (typeof listener !== 'function') throw new TypeError('listener deve ser uma função.');
    const set = this.#listeners.get(type) || new Set();
    set.add(listener);
    this.#listeners.set(type, set);
    return () => this.off(type, listener);
  }

  once(type, listener) {
    const off = this.on(type, (payload) => { off(); listener(payload); });
    return off;
  }

  off(type, listener) {
    const set = this.#listeners.get(type);
    if (!set) return;
    set.delete(listener);
    if (!set.size) this.#listeners.delete(type);
  }

  emit(type, payload) {
    const set = this.#listeners.get(type);
    if (!set) return;
    [...set].forEach((listener) => listener(payload));
  }

  clear() { this.#listeners.clear(); }
}
