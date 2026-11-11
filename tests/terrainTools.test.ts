import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryElevations } from '../src/features/map/terrainTools';

afterEach(() => vi.unstubAllGlobals());

describe('consulta de elevações do mapa', () => {
  it('usa somente cotas numéricas retornadas pela fonte real', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elevation: [123.456] })
    }));

    await expect(queryElevations([{ lat: -13, lon: -39 }])).resolves.toEqual({
      elevations: [123.46],
      source: 'open-meteo'
    });
  });

  it('interrompe a ferramenta quando a fonte falha em vez de fabricar cotas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(queryElevations([{ lat: -13, lon: -39 }])).rejects.toThrow(
      'Os resultados estimados não serão usados.'
    );
  });

  it('rejeita resposta incompleta ou não numérica', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elevation: [null] })
    }));

    await expect(queryElevations([{ lat: -13, lon: -39 }])).rejects.toThrow(
      'Dados altimétricos incompletos'
    );
  });
});
