export async function rejectRefreshReplay({ payload, revokedAt, updateUserPrefs, appwriteId, statusError }) {
  await updateUserPrefs(payload.sub, {
    authSessions: [],
    remoteLogoutAt: revokedAt,
    sessionVersion: appwriteId(),
    refreshReplayDetectedAt: revokedAt
  }).catch(() => null);

  throw statusError(401, 'Refresh token já utilizado ou revogado. Entre novamente.', {
    code: 'REFRESH_TOKEN_REPLAY'
  });
}
