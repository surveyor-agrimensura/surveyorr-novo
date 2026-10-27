/**
 * SURVEYOR Editor Engine — Tool State Machine (FSM)
 *
 * Máquina de Estados Finita para controle estrito de ferramentas no ambiente do navegador.
 * Unificada com a especificação técnica do SURVEYOR Technical Engine.
 */

export class ToolStateMachine {
  #activeTool = null;
  #tools = new Map();
  #listeners = new Set();
  #idleToolId;
  #events;

  constructor({ idleToolId = 'idle', events = null } = {}) {
    this.#idleToolId = idleToolId;
    this.#events = events;
  }

  registerTool(tool) {
    if (!tool || !tool.id) return;
    if (typeof tool.activate !== 'function' || typeof tool.deactivate !== 'function') {
      throw new TypeError('Toda ferramenta deve implementar activate() e deactivate().');
    }
    this.#tools.set(tool.id, tool);
  }

  unregisterTool(toolId) {
    if (this.#activeTool?.id === toolId && this.cancel() === false) return false;
    return this.#tools.delete(toolId);
  }

  getTool(toolId) {
    return this.#tools.get(toolId);
  }

  getActiveTool() {
    return this.#activeTool;
  }

  getActiveToolId() {
    return this.#activeTool ? this.#activeTool.id : this.#idleToolId;
  }

  isToolActive(toolId) {
    if (!toolId || toolId === this.#idleToolId) {
      return this.#activeTool === null;
    }
    return this.#activeTool?.id === toolId;
  }

  /**
   * Ativa uma ferramenta ou desativa (toggle) se ela já estiver ativa.
   * Retorna true se ativada, false se desativada (retornou para idle).
   */
  toggleTool(toolId, context = {}) {
    if (!toolId || toolId === this.#idleToolId) {
      this.cancel();
      return false;
    }

    if (this.#activeTool?.id === toolId) {
      this.cancel();
      return false;
    }

    return this.setTool(toolId, context);
  }

  /**
   * Define e transiciona atômica e seguramente para a ferramenta solicitada.
   */
  setTool(toolId, context = {}) {
    const fromId = this.getActiveToolId();

    if (!toolId || toolId === this.#idleToolId) {
      this.cancel();
      return false;
    }

    if (this.#activeTool?.id === toolId) {
      return true;
    }

    // Não interromper a ferramenta atual se o destino não estiver registrado.
    const nextTool = this.#tools.get(toolId);
    if (!nextTool) return false;

    // 1. Desativação limpa da ferramenta anterior
    if (this.#activeTool) {
      try {
        this.#activeTool.deactivate?.();
      } catch (error) {
        console.warn(`[Surveyor] Erro ao desativar ferramenta "${fromId}":`, error);
        // Sem limpeza confirmada, não ativar outra ferramenta simultaneamente.
        return false;
      }
      this.#activeTool = null;
    }

    // 2. Ativação da nova ferramenta
    try {
      nextTool.activate?.(context);
      this.#activeTool = nextTool;
      this.#notify(fromId, toolId, context);
      return true;
    } catch (error) {
      console.error(`[Surveyor] Falha ao ativar ferramenta "${toolId}":`, error);
      this.#activeTool = null;
      this.#notify(fromId, this.#idleToolId, context);
      return false;
    }
  }

  /**
   * Cancela qualquer ferramenta ativa e volta para o estado idle com segurança.
   */
  cancel() {
    const fromId = this.getActiveToolId();
    if (!this.#activeTool) return true;

    try {
      this.#activeTool.deactivate?.();
    } catch (error) {
      console.warn(`[Surveyor] Erro ao cancelar ferramenta "${fromId}":`, error);
      return false;
    }

    this.#activeTool = null;
    this.#notify(fromId, this.#idleToolId);
    return true;
  }

  onStateChange(handler) {
    this.#listeners.add(handler);
    return () => this.#listeners.delete(handler);
  }

  #notify(from, to, context) {
    if (from === to) return;
    this.#events?.emit?.('tool:change', { from, to, context });
    this.#listeners.forEach((handler) => {
      try {
        handler(from, to, context);
      } catch (error) {
        console.error('[Surveyor] Erro em listener de transição de ferramenta:', error);
      }
    });
  }

  destroy() {
    this.cancel();
    // Na destruição, soltar referências mesmo se deactivate lançar exceção.
    this.#activeTool = null;
    this.#tools.clear();
    this.#listeners.clear();
  }
}
