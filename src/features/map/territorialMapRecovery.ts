const ROTATION_RECOVERY_KEY = 'surveyor-territorial-map-rotation-recovery';

type SessionStoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function recoverFromStaleLeafletRotation(
  error: unknown,
  storage: SessionStoragePort,
  reload: () => void,
): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (!/reading ['\"]_rotate['\"]/.test(message)) return false;
  try {
    if (storage.getItem(ROTATION_RECOVERY_KEY)) return false;
    storage.setItem(ROTATION_RECOVERY_KEY, '1');
    reload();
    return true;
  } catch {
    return false;
  }
}

export function clearStaleLeafletRotationRecovery(storage: SessionStoragePort): void {
  try { storage.removeItem(ROTATION_RECOVERY_KEY); } catch { /* Storage may be restricted. */ }
}
