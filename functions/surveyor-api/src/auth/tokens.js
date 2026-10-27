export function createTokenService(deps = {}) {
  const { crypto, env, statusError, appwriteId, normalizeEmail, sanitizeCommercialPermissions, parsePermissions } = deps;
  if (!crypto || typeof env !== 'function' || typeof statusError !== 'function' || typeof appwriteId !== 'function') {
    throw new Error('Dependências do serviço de token não foram fornecidas.');
  }
  const JWT_ISSUER = 'surveyor-appwrite-function';

  function base64url(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  function fromBase64url(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
    return Buffer.from(normalized + pad, 'base64');
  }

  function jwtSecret() {
    const secret = env('JWT_SECRET');
    if (!secret || secret.length < 32) throw statusError(500, 'JWT_SECRET não configurado na Function.');
    return secret;
  }

  function signJwt(payload, expiresInSeconds = 900) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(60, Number(expiresInSeconds) || 900);
    const body = {
      ...payload,
      jti: payload?.jti || appwriteId(),
      iat: now,
      exp: now + ttl,
      iss: JWT_ISSUER
    };
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const content = base64url(JSON.stringify(body));
    const signature = crypto.createHmac('sha256', jwtSecret()).update(`${header}.${content}`).digest();
    return `${header}.${content}.${base64url(signature)}`;
  }

  function verifyJwt(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) throw statusError(401, 'Sessão inválida.');
    const [headerPart, contentPart, signaturePart] = parts;
    let header;
    let payload;
    try {
      header = JSON.parse(fromBase64url(headerPart).toString('utf8'));
      payload = JSON.parse(fromBase64url(contentPart).toString('utf8'));
    } catch {
      throw statusError(401, 'Sessão inválida.');
    }
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT') throw statusError(401, 'Sessão inválida.');
    const expectedBuffer = crypto.createHmac('sha256', jwtSecret()).update(`${headerPart}.${contentPart}`).digest();
    const actualBuffer = fromBase64url(signaturePart);
    if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) throw statusError(401, 'Sessão inválida.');
    const now = Math.floor(Date.now() / 1000);
    if (payload?.iss !== JWT_ISSUER) throw statusError(401, 'Emissor da sessão inválido.');
    if (!Number.isInteger(payload?.iat) || payload.iat > now + 60) throw statusError(401, 'Data da sessão inválida.');
    if (!Number.isInteger(payload?.exp) || payload.exp <= now) throw statusError(401, 'Sessão expirada.');
    return payload;
  }

  function verifyJwtType(token, expectedType, message = 'Token inválido para esta operação.') {
    const payload = verifyJwt(token);
    if (payload.type !== expectedType) throw statusError(401, message);
    return payload;
  }

  function accessTokenTtlSeconds(user = {}) {
    const maxTtl = 15 * 60;
    const expiresAt = Date.parse(String(user?.expiresAt || user?.subscriptionExpiresAt || ''));
    if (!Number.isFinite(expiresAt)) return maxTtl;
    const seconds = Math.floor((expiresAt - Date.now()) / 1000);
    if (seconds <= 0) throw statusError(403, 'Sua assinatura expirou. Renove o plano para continuar.', { code: 'PLAN_EXPIRED' });
    return Math.max(60, Math.min(maxTtl, seconds));
  }

  function accessTokenUserSnapshot(user = {}) {
    // R26.3.73 — o JWT não deve transportar o perfil inteiro do cliente.
    // A resposta de login continua entregando `user` completo ao frontend, mas o
    // token leva apenas os dados necessários para autenticação/autorização das
    // Functions durante sua curta validade.
    const effectivePermissions = Array.isArray(user?.effectivePermissions)
      ? sanitizeCommercialPermissions(user.effectivePermissions)
      : sanitizeCommercialPermissions(parsePermissions(user?.permissions));
    const limits = user?.planLimits && typeof user.planLimits === 'object' ? user.planLimits : {};
    const planLimits = {};
    [
      'projectLimit', 'userLimit', 'storageLimitBytes', 'storageBaseBytes',
      'storagePurchasedBytes', 'storageMaxBytes', 'downloadDailyLimit',
      'exportDailyLimit', 'billingCycle', 'generationLimit', 'generationUnlimited'
    ].forEach((key) => {
      if (limits[key] !== undefined) planLimits[key] = limits[key];
    });
    return {
      id: String(user?.id || ''),
      email: normalizeEmail(user?.email || ''),
      role: String(user?.role || 'user').toLowerCase(),
      plan: String(user?.planSlug || user?.plan || 'basic_annual'),
      planSlug: String(user?.planSlug || user?.plan || 'basic_annual'),
      planName: String(user?.planName || ''),
      effectivePermissions,
      planLimits,
      status: String(user?.status || 'active').toLowerCase(),
      isActive: user?.isActive !== false,
      expiresAt: user?.expiresAt || null,
      isSubuser: Boolean(user?.isSubuser),
      workspaceOwnerUserId: String(user?.workspaceOwnerUserId || user?.id || ''),
      workspaceRole: String(user?.workspaceRole || (user?.isSubuser ? 'collaborator' : 'owner'))
    };
  }

  function issueAccessToken(identity = {}, user = {}, sessionVersion = '') {
    const workspace = identity?.workspace && typeof identity.workspace === 'object' ? identity.workspace : {};
    const ttl = accessTokenTtlSeconds(user);
    const tokenUser = accessTokenUserSnapshot(user);
    const token = signJwt({
      type: 'access',
      sub: tokenUser.id,
      email: tokenUser.email,
      role: tokenUser.role,
      user: tokenUser,
      sv: sessionVersion,
      resourceOwnerUserId: String(identity?.resourceOwnerUserId || workspace.ownerUserId || tokenUser.workspaceOwnerUserId || tokenUser.id || ''),
      workspace: {
        accountType: String(workspace.accountType || (tokenUser.isSubuser ? 'subuser' : 'primary')),
        ownerUserId: String(workspace.ownerUserId || identity?.resourceOwnerUserId || tokenUser.workspaceOwnerUserId || tokenUser.id || ''),
        memberRole: String(workspace.memberRole || tokenUser.workspaceRole || (tokenUser.isSubuser ? 'collaborator' : 'owner'))
      }
    }, ttl);
    return { token, expiresIn: ttl };
  }

  function legacySharePasswordHash(value, salt = '') {
    const raw = String(value || '');
    if (!raw) return '';
    const normalizedSalt = String(salt || jwtSecret().slice(0, 16));
    return crypto.createHash('sha256').update(`${normalizedSalt}:${raw}`).digest('hex');
  }

  function hashSharePassword(value, salt = '') {
    const raw = String(value || '');
    if (!raw) return '';
    const normalizedSalt = String(salt || crypto.randomBytes(16).toString('hex'));
    return crypto.scryptSync(raw, normalizedSalt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
  }

  function verifySharePassword(value, share = {}) {
    const supplied = String(value || '');
    const stored = String(share.passwordHash || '');
    if (!supplied || !stored) return false;
    const algorithm = String(share.passwordAlgorithm || '').toLowerCase();
    const candidate = algorithm === 'scrypt-v1'
      ? hashSharePassword(supplied, share.passwordSalt || '')
      : legacySharePasswordHash(supplied, share.passwordSalt || '');
    const expectedBuffer = Buffer.from(stored, 'hex');
    const candidateBuffer = Buffer.from(candidate, 'hex');
    return expectedBuffer.length === candidateBuffer.length && crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
  }

  return Object.freeze({
    base64url, fromBase64url, jwtSecret, signJwt, verifyJwt, verifyJwtType, accessTokenTtlSeconds, accessTokenUserSnapshot, issueAccessToken, legacySharePasswordHash, hashSharePassword, verifySharePassword
  });
}
