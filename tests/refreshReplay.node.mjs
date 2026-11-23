import assert from 'node:assert/strict';
import test from 'node:test';
import { rejectRefreshReplay } from '../functions/surveyor-api/src/auth/refresh-replay.js';

function statusError(status, message, details) {
  return Object.assign(new Error(message), { status, details });
}

test('refresh reutilizado revoga a família da conta do payload e termina em 401', async () => {
  const calls = [];
  const revokedAt = '2026-11-22T12:00:00.000Z';
  const error = await rejectRefreshReplay({
    payload: { sub: 'user-from-refresh-payload', jti: 'already-rotated' },
    revokedAt,
    updateUserPrefs: async (...args) => { calls.push(args); },
    appwriteId: () => 'new-session-version',
    statusError
  }).catch((failure) => failure);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'user-from-refresh-payload');
  assert.deepEqual(calls[0][1], {
    authSessions: [],
    remoteLogoutAt: revokedAt,
    sessionVersion: 'new-session-version',
    refreshReplayDetectedAt: revokedAt
  });
  assert.equal(error.status, 401);
  assert.equal(error.details.code, 'REFRESH_TOKEN_REPLAY');
});

test('falha ao persistir revogação não mascara o 401 de replay', async () => {
  const error = await rejectRefreshReplay({
    payload: { sub: 'user-2' },
    revokedAt: '2026-11-22T12:00:00.000Z',
    updateUserPrefs: async () => { throw new Error('storage unavailable'); },
    appwriteId: () => 'new-session-version',
    statusError
  }).catch((failure) => failure);

  assert.equal(error.status, 401);
  assert.equal(error.details.code, 'REFRESH_TOKEN_REPLAY');
});
