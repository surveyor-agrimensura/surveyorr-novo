import { createHmac } from 'node:crypto';

export function passwordResetRequestMessage(maskedEmail) {
  return `Se existir uma conta para ${String(maskedEmail || '')}, um código será enviado.`;
}

export async function attemptPasswordResetDelivery(deliver, onFailure = async () => {}) {
  try {
    await deliver();
    return true;
  } catch {
    try { await onFailure(); } catch {}
    return false;
  }
}

export function passwordResetSubject(email, secret) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return createHmac('sha256', String(secret || ''))
    .update(`password-reset:${normalizedEmail}`)
    .digest('base64url')
    .slice(0, 36);
}

export function transientAuthBodyPayload(token, { cookieFlag, payloadKey, origin, allowBodyTokenWithoutOrigin = true } = {}) {
  if (!String(origin || '').trim() && !allowBodyTokenWithoutOrigin) return { [cookieFlag]: false };
  return { [payloadKey]: token, [cookieFlag]: false };
}
