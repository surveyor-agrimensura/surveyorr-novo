import { renderTechnicalSheet } from './renderer.js';
import type { EngineOptions, EngineScene, LabelOffsetMap, TechnicalProject } from './types.js';
import { ToolStateMachine } from './tool-state-machine.js';

export const DEFAULT_PAGE = Object.freeze({ widthMm: 297, heightMm: 185.625, marginMm: 0, sidebarMm: 0 });

export function createDefaultOptions(): EngineOptions {
  return {
    title: 'PLANTA DO IMÓVEL GEORREFERENCIADO — V2',
    scaleText: '1:3.500',
    sheetNumber: 'ÚNICA',
    vertexScale: 1,
    polygonFill: true,
    showVertices: true,
    showScale: true,
    showNorth: true,
    textScale: 1,
    lineScale: 1,
    mapScale: 1,
    mapOffsetX: 0,
    mapOffsetY: 0,
    guides: [],
    guideLabelScale: 1,
    page: { ...DEFAULT_PAGE }
  };
}

export class TechnicalEngine {
  private offsets: LabelOffsetMap = {};
  public readonly tools: ToolStateMachine = new ToolStateMachine();

  setOffsets(offsets: LabelOffsetMap): void {
    this.offsets = { ...offsets };
  }

  getOffsets(): LabelOffsetMap {
    return { ...this.offsets };
  }

  render(project: TechnicalProject, options: EngineOptions): EngineScene {
    return renderTechnicalSheet(project, options, this.offsets);
  }

  updateLabelOffset(key: string, dx: number, dy: number): void {
    if (!key) return;
    this.offsets[key] = { dx: Number(dx) || 0, dy: Number(dy) || 0 };
  }

  resetOffsets(): void {
    this.offsets = {};
  }
}
