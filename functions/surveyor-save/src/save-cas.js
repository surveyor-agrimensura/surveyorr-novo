function errorWithDetails(status, message, code, cause) {
  return Object.assign(new Error(message), {
    status,
    details: { ...(cause?.details && typeof cause.details === 'object' ? cause.details : {}), code },
    cause
  });
}

export function shouldCleanupStagedFiles(error) {
  return error?.details?.code !== 'SAVE_COMMIT_STATUS_UNKNOWN';
}

export function nextSystemUpdatedAt(currentValue, now = Date.now()) {
  const current = Date.parse(String(currentValue || ''));
  if (!Number.isFinite(current)) {
    throw errorWithDetails(503, 'O Appwrite não retornou a revisão do projeto. Reabra o projeto antes de salvar.', 'PROJECT_REVISION_UNAVAILABLE');
  }
  const next = new Date(Math.max(Number(now) || Date.now(), current + 1));
  if (!Number.isFinite(next.getTime())) {
    throw errorWithDetails(503, 'Não foi possível gerar a próxima revisão do projeto.', 'PROJECT_REVISION_UNAVAILABLE');
  }
  return next.toISOString();
}

function normalizeRows(result) {
  if (Array.isArray(result?.documents)) return result.documents;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function samePatch(row, patch) {
  return Object.entries(patch).every(([key, value]) => JSON.stringify(row?.[key]) === JSON.stringify(value));
}

function editConflict() {
  return errorWithDetails(409, 'Este projeto foi alterado em outra sessão. Recarregue antes de salvar novamente.', 'EDIT_CONFLICT');
}

export async function compareAndSwapProjectRow({ rowId, observedRow, data, mode, updateRows, getRow, queryEqual }) {
  const expectedSystemRevision = String(observedRow?.$updatedAt || '').trim();
  const nextRevision = nextSystemUpdatedAt(expectedSystemRevision);
  const patch = { ...data, $updatedAt: nextRevision };
  const queries = [
    queryEqual('$id', [String(rowId)]),
    queryEqual('$updatedAt', [expectedSystemRevision])
  ];

  try {
    const result = await updateRows(queries, patch, mode);
    const rows = normalizeRows(result);
    const total = Number(result?.total);
    if (total === 0) throw editConflict();
    if (rows.length !== 1 || (Number.isFinite(total) && total !== 1)) {
      throw errorWithDetails(503, 'O Appwrite não confirmou de forma inequívoca a atualização do projeto.', 'SAVE_COMMIT_STATUS_UNKNOWN');
    }
    return rows[0];
  } catch (error) {
    if (error?.details?.code === 'EDIT_CONFLICT') throw error;
    const status = Number(error?.appwriteStatus || error?.status || 0);
    if (status === 409) throw editConflict();
    if (status > 0 && status < 500) throw error;

    const latest = await getRow(rowId, mode).catch(() => null);
    if (String(latest?.$updatedAt || '') === nextRevision && samePatch(latest, patch)) return latest;
    throw errorWithDetails(503, 'Não foi possível confirmar o salvamento. Reabra o projeto antes de tentar novamente.', 'SAVE_COMMIT_STATUS_UNKNOWN', error);
  }
}
