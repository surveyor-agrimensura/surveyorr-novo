/**
 * SURVEYOR Technical Engine — Tool State Machine (FSM)
 *
 * Máquina de Estados Finita para controle estrito de ciclo de vida de ferramentas.
 * Garante que apenas UMA ferramenta esteja ativa por vez, gerencia transições atômicas
 * e implementa toggle previsível (ativar <-> desativar).
 */

export interface ToolContext {
  engine?: unknown;
  viewport?: HTMLElement | SVGSVGElement | null;
  [key: string]: unknown;
}

export interface Tool {
  readonly id: string;
  readonly title?: string;
  activate(context: ToolContext): void;
  deactivate(): void;
  onPointerDown?(event: PointerEvent): void;
  onPointerMove?(event: PointerEvent): void;
  onPointerUp?(event: PointerEvent): void;
  onKeyDown?(event: KeyboardEvent): boolean | void;
}

export type ToolStateChangeHandler = (from: string, to: string, context?: ToolContext) => void;

export class ToolStateMachine {
  private activeTool: Tool | null = null;
  private tools: Map<string, Tool> = new Map();
  private listeners: Set<ToolStateChangeHandler> = new Set();
  private idleToolId: string;

  constructor(options: { idleToolId?: string } = {}) {
    this.idleToolId = options.idleToolId || 'idle';
  }

  registerTool(tool: Tool): void {
    if (!tool || !tool.id) return;
    if (typeof tool.activate !== 'function' || typeof tool.deactivate !== 'function') {
      throw new TypeError('Toda ferramenta deve implementar activate() e deactivate().');
    }
    this.tools.set(tool.id, tool);
  }

  unregisterTool(toolId: string): boolean {
    if (this.activeTool?.id === toolId && this.cancel() === false) return false;
    return this.tools.delete(toolId);
  }

  getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  getActiveTool(): Tool | null {
    return this.activeTool;
  }

  getActiveToolId(): string {
    return this.activeTool ? this.activeTool.id : this.idleToolId;
  }

  isToolActive(toolId: string): boolean {
    if (!toolId || toolId === this.idleToolId) {
      return this.activeTool === null;
    }
    return this.activeTool?.id === toolId;
  }

  /**
   * Ativa uma ferramenta ou desativa (toggle) se ela já estiver ativa.
   * Retorna true se a ferramenta foi ativada, ou false se foi desativada (retornou para idle).
   */
  toggleTool(toolId: string, context: ToolContext = {}): boolean {
    if (!toolId || toolId === this.idleToolId) {
      this.cancel();
      return false;
    }

    if (this.activeTool?.id === toolId) {
      this.cancel();
      return false;
    }

    return this.setTool(toolId, context);
  }

  /**
   * Força a transição para uma ferramenta específica.
   */
  setTool(toolId: string, context: ToolContext = {}): boolean {
    const fromId = this.getActiveToolId();

    if (!toolId || toolId === this.idleToolId) {
      this.cancel();
      return false;
    }

    if (this.activeTool?.id === toolId) {
      return true;
    }

    // Um ID desconhecido não pode provocar a perda da ferramenta atual.
    const nextTool = this.tools.get(toolId);
    if (!nextTool) return false;

    // 1. Limpa e desativa a ferramenta anterior
    if (this.activeTool) {
      try {
        this.activeTool.deactivate();
      } catch (error) {
        console.warn(`[Surveyor] Erro ao desativar ferramenta "${fromId}":`, error);
        return false;
      }
      this.activeTool = null;
    }

    // 2. Busca e ativa a nova ferramenta
    try {
      nextTool.activate(context);
      this.activeTool = nextTool;
      this.notifyListeners(fromId, toolId, context);
      return true;
    } catch (error) {
      console.error(`[Surveyor] Falha ao ativar ferramenta "${toolId}":`, error);
      this.activeTool = null;
      this.notifyListeners(fromId, this.idleToolId, context);
      return false;
    }
  }

  /**
   * Cancela qualquer ferramenta ativa e retorna imediatamente para o estado idle.
   */
  cancel(): boolean {
    const fromId = this.getActiveToolId();
    if (!this.activeTool) return true;

    try {
      this.activeTool.deactivate();
    } catch (error) {
      console.warn(`[Surveyor] Erro ao cancelar ferramenta "${fromId}":`, error);
      return false;
    }

    this.activeTool = null;
    this.notifyListeners(fromId, this.idleToolId);
    return true;
  }

  onStateChange(handler: ToolStateChangeHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private notifyListeners(from: string, to: string, context?: ToolContext): void {
    if (from === to) return;
    this.listeners.forEach((handler) => {
      try {
        handler(from, to, context);
      } catch (error) {
        console.error('[Surveyor] Erro em listener de transição de ferramenta:', error);
      }
    });
  }

  destroy(): void {
    this.cancel();
    // Evita manter referência ao objeto da ferramenta na destruição.
    this.activeTool = null;
    this.tools.clear();
    this.listeners.clear();
  }
}
