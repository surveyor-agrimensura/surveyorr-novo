const OFFICIAL_WEB_ORIGINS = new Set([
  'https://surveyorr.com.br',
  'https://www.surveyorr.com.br'
]);

function serializedOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== raw) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export function isOfficialWebOrigin(origin = '') {
  return OFFICIAL_WEB_ORIGINS.has(serializedOrigin(origin));
}

export function corsOriginForRequest(origin = '', { configuredOrigins = [], isLocalDevelopmentOrigin = () => false } = {}) {
  const normalized = serializedOrigin(origin);
  if (!normalized) return '';
  if (isOfficialWebOrigin(normalized)) return normalized;
  const configured = new Set(configuredOrigins.map(serializedOrigin).filter(Boolean));
  if (configured.has(normalized) || isLocalDevelopmentOrigin(normalized)) return normalized;
  return '';
}

export function corsHeadersForOrigin(origin = '', policy = {}) {
  const allowedOrigin = corsOriginForRequest(origin, policy);
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With, Cache-Control, Pragma, X-Share-Password, X-Request-ID, Idempotency-Key, If-Match, X-Expected-Updated-At',
    ...(allowedOrigin ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
    'Access-Control-Expose-Headers': 'Content-Type, X-Request-ID, Retry-After',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}

export function hostRefreshCookieHeader(token = '', { clear = false } = {}) {
  const ttl = clear ? 0 : 14 * 24 * 60 * 60;
  const value = clear ? '' : encodeURIComponent(String(token || ''));
  return `__Host-surveyor_refresh=${value}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Strict`;
}

export function legacyRefreshCookieClearHeader() {
  return '__Secure-surveyor_refresh=; Path=/api/auth; Domain=.surveyorr.com.br; Max-Age=0; HttpOnly; Secure; SameSite=Strict';
}

export function refreshTokenDelivery(origin, token) {
  if (isOfficialWebOrigin(origin)) {
    return {
      payload: { refreshCookie: true },
      headers: { 'Set-Cookie': hostRefreshCookieHeader(token) }
    };
  }
  return {
    payload: { refreshToken: token, refreshCookie: false },
    headers: {}
  };
}

/** Existing official-site sessions may still carry the former Domain cookie.
 * Accept it only as a migration fallback, then refreshTokenDelivery rotates it
 * into the host-only cookie. Official origins never accept a refresh token from JSON.
 */
export function refreshCredentialFromRequest(origin, cookies = {}, bodyToken = '') {
  if (isOfficialWebOrigin(origin)) {
    return String(cookies['__Host-surveyor_refresh'] || cookies['__Secure-surveyor_refresh'] || '').trim();
  }
  return String(bodyToken || '').trim();
}
