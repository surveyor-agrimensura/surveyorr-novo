import { describe, expect, it } from 'vitest';
import { toggleSelectedLayer } from '../src/features/map/layerCatalogSelection';

describe('seleção de camadas oficiais', () => {
  it('mantém as camadas já escolhidas ao adicionar outra', () => {
    expect(toggleSelectedLayer(['rios'], 'unidades-conservacao'))
      .toEqual(['rios', 'unidades-conservacao']);
  });

  it('remove somente a camada desmarcada', () => {
    expect(toggleSelectedLayer(['rios', 'unidades-conservacao', 'terras-indigenas'], 'unidades-conservacao'))
      .toEqual(['rios', 'terras-indigenas']);
  });

  it('não altera a lista anterior', () => {
    const previous = ['rios'];
    toggleSelectedLayer(previous, 'unidades-conservacao');
    expect(previous).toEqual(['rios']);
  });
});
