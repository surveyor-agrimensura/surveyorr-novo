import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Backend JavaScript module is exercised directly in the regression test.
import { compareAndSwapProjectRow, nextSystemUpdatedAt, shouldCleanupStagedFiles } from '../functions/surveyor-save/src/save-cas.js';

const initialRow = {
  $id: 'p1',
  $updatedAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T09:59:59.000Z',
  geojsonFileId: 'old-file'
};

function editConflict() {
  return Object.assign(new Error('revision conflict'), { status: 409, details: { code: 'EDIT_CONFLICT' } });
}

function queryEqual(attribute: string, values: string[]) {
  return JSON.stringify({ method: 'equal', attribute, values });
}

describe('salvamento CAS condicional de projeto', () => {
  it('gera uma revisão de sistema estritamente posterior à observada', () => {
    expect(nextSystemUpdatedAt('2026-11-04T10:00:00.000Z', Date.parse('2026-11-04T10:00:00.000Z')))
      .toBe('2026-11-04T10:00:00.001Z');
  });

  it('envia filtros por id e revisão do Appwrite e recebe a linha atualizada', async () => {
    const calls: unknown[][] = [];
    const result = await compareAndSwapProjectRow({
      rowId: 'p1', observedRow: initialRow, data: { geojsonFileId: 'next-file' }, mode: 'documents', queryEqual,
      updateRows: async (queries: string[], data: Record<string, unknown>, mode: string) => {
        calls.push([queries, data, mode]);
        return { total: 1, documents: [{ ...initialRow, ...data }] };
      },
      getRow: async () => initialRow
    });

    expect(result).toMatchObject({ $id: 'p1', geojsonFileId: 'next-file' });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toEqual([
      queryEqual('$id', ['p1']),
      queryEqual('$updatedAt', [initialRow.$updatedAt])
    ]);
    expect(Date.parse(String((calls[0][1] as Record<string, unknown>).$updatedAt)))
      .toBeGreaterThan(Date.parse(initialRow.$updatedAt));
    expect(calls[0][2]).toBe('documents');
  });

  it('permite somente um dos dois salvamentos concorrentes com a mesma revisão', async () => {
    let currentRow = { ...initialRow };
    const updateRows = vi.fn(async (queries: string[], data: Record<string, unknown>) => {
      const expected = JSON.parse(queries[1]).values[0] as string;
      if (currentRow.$updatedAt !== expected) return { total: 0, documents: [] };
      currentRow = { ...currentRow, ...data };
      return { total: 1, documents: [currentRow] };
    });
    const commit = (geojsonFileId: string) => compareAndSwapProjectRow({
      rowId: 'p1', observedRow: initialRow, data: { geojsonFileId }, mode: 'documents', queryEqual,
      updateRows, getRow: async () => currentRow
    });

    const outcomes = await Promise.allSettled([commit('file-a'), commit('file-b')]);
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect((outcomes.find((item) => item.status === 'rejected') as PromiseRejectedResult).reason)
      .toMatchObject({ status: 409, details: { code: 'EDIT_CONFLICT' } });
    expect(updateRows).toHaveBeenCalledTimes(2);
    expect(['file-a', 'file-b']).toContain(currentRow.geojsonFileId);
  });

  it('reconcilia uma resposta 5xx quando o Appwrite já aplicou exatamente a atualização', async () => {
    let currentRow = { ...initialRow };
    const updateRows = vi.fn(async (_queries: string[], data: Record<string, unknown>) => {
      currentRow = { ...currentRow, ...data };
      throw Object.assign(new Error('gateway timeout after write'), { status: 502 });
    });
    const saved = await compareAndSwapProjectRow({
      rowId: 'p1', observedRow: initialRow, data: { geojsonFileId: 'committed-file' }, mode: 'tables', queryEqual,
      updateRows, getRow: async () => currentRow
    });

    expect(saved).toMatchObject({ geojsonFileId: 'committed-file' });
    expect(shouldCleanupStagedFiles({ details: { code: 'SAVE_COMMIT_STATUS_UNKNOWN' } })).toBe(false);
  });

  it('preserva arquivos staged quando a confirmação do resultado permanece inconclusiva', async () => {
    const failure = await compareAndSwapProjectRow({
      rowId: 'p1', observedRow: initialRow, data: { geojsonFileId: 'uncertain-file' }, mode: 'documents', queryEqual,
      updateRows: async () => { throw Object.assign(new Error('upstream unavailable'), { status: 502 }); },
      getRow: async () => ({ ...initialRow, $updatedAt: '2026-11-04T10:00:00.002Z', geojsonFileId: 'other-file' })
    }).catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 503, details: { code: 'SAVE_COMMIT_STATUS_UNKNOWN' } });
    expect(shouldCleanupStagedFiles(failure)).toBe(false);
    expect(shouldCleanupStagedFiles(editConflict())).toBe(true);
  });

  it('falha fechado quando a revisão de sistema não está disponível', async () => {
    await expect(compareAndSwapProjectRow({
      rowId: 'p1', observedRow: { $id: 'p1' }, data: {}, mode: 'documents', queryEqual,
      updateRows: vi.fn(), getRow: vi.fn()
    })).rejects.toMatchObject({ status: 503, details: { code: 'PROJECT_REVISION_UNAVAILABLE' } });
  });
});
