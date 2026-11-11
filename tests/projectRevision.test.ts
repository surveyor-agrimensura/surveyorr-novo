import { describe, expect, it } from 'vitest';
// @ts-expect-error Backend JavaScript module is intentionally exercised directly.
import { createProjectModel } from '../functions/surveyor-api/src/projects/model.js';

const projectModel = createProjectModel({
  safeJson: (value: unknown, fallback: unknown = null) => {
    if (typeof value !== 'string') return value ?? fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  },
  headerValue: () => '',
  statusError: (status: number, message: string, details: unknown = null) => Object.assign(new Error(message), { status, details }),
  appwriteId: () => 'generated-id'
});

describe('revisão de concorrência dos projetos', () => {
  it('prioriza a revisão do sistema confirmada pelo Appwrite', () => {
    expect(projectModel.projectRevision({
      updatedAt: '2026-11-04T09:59:59.999Z',
      $updatedAt: '2026-11-04T10:00:00.001Z'
    }, 'fallback')).toBe('2026-11-04T10:00:00.001Z');
  });

  it('mantém compatibilidade com registros legados e fallback explícito', () => {
    expect(projectModel.projectRevision({ updatedAt: '2026-11-04T09:59:59.999Z' }, 'fallback'))
      .toBe('2026-11-04T09:59:59.999Z');
    expect(projectModel.projectRevision({}, 'fallback')).toBe('fallback');
  });

  it('trata $updatedAt do Appwrite como revisão autoritativa', () => {
    const row = { updatedAt: '2026-11-04T09:00:00.000Z', $updatedAt: '2026-11-04T10:00:00.000Z' };
    const request = { headers: {} };

    expect(() => projectModel.assertRevisionMatches(row, request, { expectedUpdatedAt: '2026-11-04T10:00:00.000Z' }, true)).not.toThrow();
    let error: unknown;
    try {
      projectModel.assertRevisionMatches(row, request, { expectedUpdatedAt: '2026-11-04T09:00:00.000Z' }, true);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ status: 409, details: { code: 'EDIT_CONFLICT' } });
  });

  it('continua aceitando updatedAt em registros sem revisão de sistema', () => {
    const row = { updatedAt: '2026-11-04T09:00:00.000Z' };
    const request = { headers: {} };
    expect(() => projectModel.assertRevisionMatches(row, request, { expectedUpdatedAt: row.updatedAt }, true)).not.toThrow();
  });
});
