import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateProjectFeatures } from './geometry-validation.js';
import { assertCryptoReady, encryptJsonText, decryptJsonText, isEncryptedText } from './security/crypto.js';
import { INCRA_OFFICIAL_GROUP, INCRA_OFFICIAL_CATALOG, SICAR_PROPERTY_GROUP, GEOBAHIA_OFFICIAL_CATALOG } from './config/catalogs.js';
import { DEFAULT_PLANS, LEGACY_MONTHLY_PLAN_SLUGS } from './config/plans.js';
import { SURVEYOR_STORE_URL, MB_BYTES, GB_BYTES, commercialPlanRule, commercialStorageEntitlement, commercialUsageRule, commercialDayKey } from './domain/commercial.js';
import { createTokenService } from './auth/tokens.js';
import { parsePermissions, sanitizeCommercialPermissions, createAuthorization } from './domain/permissions.js';
import { createProjectModel } from './projects/model.js';
import { createGoogleDriveService } from './integrations/google-drive.js';
import { createAppwriteClient } from './appwrite/client.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const APP_VERSION = '1.0.0-rc.185.74';

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function getOpenRouterApiKey() {
  return String(
    env('api_key_openrouter', '') ||
    env('API_KEY_OPENROUTER', '') ||
    env('OPENROUTER_API_KEY', '') ||
    env('openrouter_api_key', '') ||
    ''
  ).trim();
}

function appwriteId() {
  return crypto.randomUUID();
}

const tokenService = createTokenService({
  crypto, env, statusError, appwriteId, normalizeEmail, sanitizeCommercialPermissions, parsePermissions
});
const { base64url, fromBase64url, jwtSecret, signJwt, verifyJwt, verifyJwtType, accessTokenTtlSeconds, accessTokenUserSnapshot, issueAccessToken, legacySharePasswordHash, hashSharePassword, verifySharePassword } = tokenService;

const authorization = createAuthorization({ statusError, permissionCandidates });
const { isGlobalAdminAccess, requireAdminAccess, effectivePermissionSet, hasPermission, requirePermission, documentCategoryPermission, canAccessDocumentCategory, requireDocumentCategoryPermission } = authorization;

const projectModel = createProjectModel({ safeJson, headerValue, statusError, appwriteId });
const { sanitizeProjectStatus, sanitizeProjectClientMetadata, sanitizeProjectClientInput, projectData, canonicalUpdatedAt, expectedUpdatedAt, assertRevisionMatches, mapFeature } = projectModel;


const appwrite = createAppwriteClient({
  env,
  statusError,
  appwriteId,
  normalizeEmail,
  invalidateLayerCatalogCache: () => invalidatePublicLayerCatalogCache()
});
const {
  endpoint, projectId, databaseId, apiKey, collectionId, bucketId, jsonHeaders,
  parseAppwriteResponse, appwriteTimeoutMs, fetchWithAbortTimeout, awFetch,
  isPathUnsupported, normalizeListPayload, rowData, queryParam, qs, appwriteQuery, Query,
  errorText, invalidDateAttributeFromError, toStrictIsoUtc, normalizeAppwriteDateFields,
  legacyIntegerDateSchemaEnabled, toEpochMillis, awFetchRowWithDateRetry,
  listRows, listAllRows, getRow, createRow, updateRow, deleteRow,
  createFile, readFileText, deleteFile, createAppwriteUser, awPublicAccountFetch,
  createEmailSession, deletePublicEmailSession, listAppwriteUsersByEmail,
  getAppwriteUserByEmail, getAppwriteUserById
} = appwrite;

















const PUBLIC_SHORT_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PUBLIC_SHORT_LENGTH = 10;

function encodePublicShortDigest(digest) {
  let value = 0n;
  for (let index = 0; index < 7; index += 1) value = (value << 8n) | BigInt(digest[index]);
  value >>= 6n;
  let code = '';
  for (let index = 0; index < PUBLIC_SHORT_LENGTH; index += 1) {
    code = PUBLIC_SHORT_ALPHABET[Number(value & 31n)] + code;
    value >>= 5n;
  }
  return code;
}

function projectShortCode(projectId = '') {
  const normalized = String(projectId || '').trim();
  if (!normalized) return '';
  // O código público é um localizador, não um segredo. Não depende do JWT_SECRET,
  // portanto uma rotação de credenciais não invalida QR Codes impressos.
  return encodePublicShortDigest(crypto.createHash('sha256').update(`surveyor-public-project:v3:${normalized}`).digest());
}

function legacyProjectShortCode(projectId = '') {
  const normalized = String(projectId || '').trim();
  if (!normalized) return '';
  return encodePublicShortDigest(crypto.createHmac('sha256', jwtSecret()).update(`project-short:v2:${normalized}`).digest());
}

function normalizePublicShortCode(value = '') {
  return String(value || '')
    .toUpperCase()
    .replace(/[O]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-HJKMNP-TV-Z]/g, '');
}

function displayPublicShortCode(value = '') {
  const code = normalizePublicShortCode(value);
  return code.length === PUBLIC_SHORT_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

function publicShortPath(projectId = '') {
  const code = projectShortCode(projectId);
  return code ? `/p/?c=${encodeURIComponent(displayPublicShortCode(code))}` : '';
}

const shortProjectLookupCache = new Map();
const SHORT_PROJECT_CACHE_TTL_MS = 5 * 60 * 1000;

function publicShortIndexFileId(code = '') {
  const normalized = normalizePublicShortCode(code);
  return normalized.length === PUBLIC_SHORT_LENGTH ? `public_${normalized}` : '';
}

async function writePublicShortIndex(projectIdValue, code = projectShortCode(projectIdValue)) {
  const normalized = normalizePublicShortCode(code);
  const projectId = String(projectIdValue || '').trim();
  const fileId = publicShortIndexFileId(normalized);
  if (!projectId || !fileId) return false;
  const content = JSON.stringify({ version: 1, code: normalized, projectId, updatedAt: new Date().toISOString() });
  const bucket = bucketId('project_files');
  try {
    await deleteFile(bucket, fileId).catch(() => null);
    await createFile(bucket, `public-short-${normalized}.json`, content, 'application/json', fileId);
    return true;
  } catch (error) {
    console.warn('[public-short] índice direto no Storage indisponível:', error?.message || error);
    return false;
  }
}

async function readPublicShortIndex(code = '') {
  const fileId = publicShortIndexFileId(code);
  if (!fileId) return '';
  try {
    const text = await readFileText(bucketId('project_files'), fileId);
    const parsed = text ? JSON.parse(text) : null;
    return String(parsed?.projectId || '').trim();
  } catch { return ''; }
}

async function findProjectRowByShortCode(code = '') {
  const normalized = normalizePublicShortCode(code);
  if (normalized.length !== PUBLIC_SHORT_LENGTH) return null;
  const cached = shortProjectLookupCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    const row = await getRow('projects', cached.projectId).catch(() => null);
    if (row && String(row.status || '').toLowerCase() !== 'deleted') return row;
    shortProjectLookupCache.delete(normalized);
  }

  const indexedProjectId = await readPublicShortIndex(normalized);
  if (indexedProjectId) {
    const row = await getRow('projects', indexedProjectId).catch(() => null);
    if (row && String(row.status || '').toLowerCase() !== 'deleted') {
      shortProjectLookupCache.set(normalized, { projectId: indexedProjectId, expiresAt: Date.now() + SHORT_PROJECT_CACHE_TTL_MS });
      return row;
    }
  }

  // Migração compatível: códigos HMAC impressos em releases anteriores ainda podem
  // ser resolvidos uma única vez e são imediatamente indexados para acessos futuros.
  const rows = await listAllRows('projects');
  const matches = rows.filter((row) => {
    if (String(row.status || '').toLowerCase() === 'deleted') return false;
    const id = row.$id || row.id;
    return projectShortCode(id) === normalized || legacyProjectShortCode(id) === normalized;
  });
  if (matches.length !== 1) return null;
  const row = matches[0];
  const projectId = row.$id || row.id;
  shortProjectLookupCache.set(normalized, { projectId, expiresAt: Date.now() + SHORT_PROJECT_CACHE_TTL_MS });
  await writePublicShortIndex(projectId, normalized);
  await writePublicShortIndex(projectId, projectShortCode(projectId));
  return row;
}

function normalizeProjectShare(input = {}, auth = {}) {
  const now = new Date().toISOString();
  const id = appwriteId();
  const days = Math.max(1, Math.min(3650, Number(input.expiresInDays || input.days || 3650)));
  const maxAccessCount = Math.max(0, Math.min(1000000, Number(input.maxAccessCount || input.maxAccesses || 0) || 0));
  const password = String(input.password || '').trim();
  const passwordSalt = password ? crypto.randomBytes(12).toString('hex') : '';
  return {
    id,
    createdBy: auth.sub || '',
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : new Date(Date.now() + days * 86400000).toISOString(),
    permissionMode: String(input.permissionMode || input.mode || 'readonly').toLowerCase() === 'edit' ? 'edit' : 'readonly',
    passwordProtected: Boolean(password),
    passwordSalt,
    passwordHash: password ? hashSharePassword(password, passwordSalt) : '',
    passwordAlgorithm: password ? 'scrypt-v1' : '',
    maxAccessCount,
    accessCount: 0,
    lastAccessAt: null,
    revokedAt: null,
    note: String(input.note || '').slice(0, 200)
  };
}

function publicShareView(share = {}, token = '', projectId = '') {
  const tokenUrl = token ? `/public-project/#token=${encodeURIComponent(token)}` : '';
  const shortCode = projectShortCode(projectId);
  const shortUrl = shortCode ? `/p/${shortCode}` : tokenUrl;
  return {
    active: !share.revokedAt,
    id: share.id || '',
    token,
    url: shortUrl,
    publicUrl: shortUrl,
    shortUrl,
    shortCode,
    tokenUrl,
    expiresAt: share.expiresAt || null,
    permissionMode: share.permissionMode || 'readonly',
    passwordProtected: Boolean(share.passwordProtected || share.passwordHash),
    maxAccessCount: Number(share.maxAccessCount || 0) || 0,
    accessCount: Number(share.accessCount || 0) || 0,
    revokedAt: share.revokedAt || null,
    projectId
  };
}

function projectPayloadShares(payload = {}) {
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const shares = Array.isArray(metadata.secureShares) ? metadata.secureShares : [];
  return { metadata, shares };
}

async function assertShareUsable(share = {}, request) {
  if (!share || share.revokedAt) throw statusError(401, 'Link compartilhado revogado.');
  if (share.expiresAt && Date.parse(share.expiresAt) <= Date.now()) throw statusError(401, 'Link compartilhado expirado.');
  const max = Number(share.maxAccessCount || 0) || 0;
  const count = Number(share.accessCount || 0) || 0;
  if (max > 0 && count >= max) throw statusError(401, 'Limite de acessos do link compartilhado atingido.');
  if (share.passwordHash) {
    await assertSharePasswordRateLimit(request, share);
    const supplied = headerValue(request, 'x-share-password') || '';
    if (!supplied) throw statusError(403, 'Senha obrigatória para acessar este link.', { passwordRequired: true });
    if (!verifySharePassword(supplied, share)) {
      await recordSharePasswordRateLimitFailure(request, share);
      await appendSecurityEvent({ type: 'share', action: 'share_password_failed', target: String(share.id || ''), ip: requestIp(request), userAgent: requestUserAgent(request), status: 'failed', message: 'Senha inválida em link compartilhado.' }).catch(() => null);
      throw statusError(403, 'Senha do link compartilhado inválida.', { passwordRequired: true });
    }
    await clearSharePasswordRateLimit(request, share);
  }
}


async function sendPublicProjectShare(response, request, row, projectPayload, share) {
  const { metadata, shares } = projectPayloadShares(projectPayload);
  await assertShareUsable(share, request);
  share.accessCount = Number(share.accessCount || 0) + 1;
  share.lastAccessAt = new Date().toISOString();
  share.updatedAt = share.lastAccessAt;
  await commitProjectPayload(row, { ...projectPayload, metadata: { ...metadata, secureShares: shares }, updatedAt: share.updatedAt }, null, { updatedAt: share.updatedAt })
    .catch((error) => console.warn('[share] não foi possível registrar acesso:', error?.message || error));
  const project = mapProject(row);
  const features = Array.isArray(projectPayload.features) ? projectPayload.features.map((item) => mapFeature(item, project.id, row.userId)) : [];
  const customRows = await listRows('customization', [Query.equal('userId', row.userId), Query.limit(1)]).catch(() => []);
  const customization = await serializeDocumentCustomization(customRows[0] || {});
  return send(response, request, 200, { ok: true, project, features, customization, share: publicShareView(share, '', project.id) }, { 'Cache-Control': 'no-store' });
}

function normalizeEmail(value) {
  return String(value || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
}

function statusError(status, message, details = null) {
  const error = new Error(message || 'Erro interno.');
  error.status = status;
  error.details = details;
  return error;
}

function userPrefs(user = {}) {
  const prefs = user?.prefs && typeof user.prefs === 'object' ? user.prefs : {};
  const surveyor = prefs.surveyor && typeof prefs.surveyor === 'object' ? prefs.surveyor : {};
  return { prefs, surveyor };
}

const RESTRICTED_MEMORIAL_TEMPLATE_IDS = new Set(['agro-mais']);
function normalizeMemorialTemplateAccess(value = []) {
  let list = value;
  if (typeof list === 'string') list = list.split(/[;,\s]+/);
  if (!Array.isArray(list)) list = [];
  return [...new Set(list.map((id) => String(id || '').trim()).filter((id) => RESTRICTED_MEMORIAL_TEMPLATE_IDS.has(id)))];
}
function memorialTemplateAccessForUser(appwriteUser = {}) {
  const { surveyor } = userPrefs(appwriteUser);
  return normalizeMemorialTemplateAccess(surveyor.memorialTemplateAccess || surveyor.allowedMemorialTemplateIds || []);
}

function normalizeBrazilPhone(value = '', { required = false } = {}) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) {
    if (required) throw statusError(400, 'Informe um WhatsApp válido com DDD.');
    return '';
  }
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) throw statusError(400, 'WhatsApp inválido. Informe DDD e número, por exemplo (75) 99999-9999.');
  const ddd = digits.slice(2, 4);
  const local = digits.slice(4);
  if (/^0/.test(ddd) || !/^[1-9]\d$/.test(ddd) || !/^\d{8,9}$/.test(local)) throw statusError(400, 'WhatsApp inválido. Confira o DDD e o número.');
  return `+${digits}`;
}

function formatBrazilPhone(value = '') {
  const phone = normalizeBrazilPhone(value);
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '').slice(2);
  const ddd = digits.slice(0, 2);
  const local = digits.slice(2);
  return local.length === 9
    ? `(${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`
    : `(${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`;
}

function normalizeReminderDays(value, fallback = [7, 1]) {
  let parsed = value;
  if (typeof value === 'string' && value.trim().startsWith('[')) { try { parsed = JSON.parse(value); } catch {} }
  const source = Array.isArray(parsed) ? parsed : (typeof parsed === 'string' ? parsed.split(/[;,\s]+/) : []);
  const days = [...new Set(source.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 30))].sort((a, b) => b - a);
  return days.length ? days : [...fallback];
}

function userContactMeta(profile = {}, appwriteUser = {}) {
  const { surveyor } = userPrefs(appwriteUser);
  const hasSurveyorWhatsapp = Object.prototype.hasOwnProperty.call(surveyor, 'whatsapp') || Object.prototype.hasOwnProperty.call(surveyor, 'phone');
  const rawPhone = hasSurveyorWhatsapp
    ? (surveyor.whatsapp ?? surveyor.phone ?? '')
    : (profile.whatsapp || profile.phone || appwriteUser.phone || surveyor.whatsappNumber || '');
  let whatsapp = '';
  try { whatsapp = normalizeBrazilPhone(rawPhone); } catch { whatsapp = ''; }
  const profileOptIn = profile.whatsappOptIn;
  const prefOptIn = surveyor.whatsappOptIn;
  const whatsappOptIn = profileOptIn !== undefined
    ? isTruthy(profileOptIn)
    : (prefOptIn !== undefined ? isTruthy(prefOptIn) : Boolean(whatsapp));
  const whatsappReminderDays = normalizeReminderDays(profile.whatsappReminderDays || surveyor.whatsappReminderDays || [7, 1]);
  const conectaPlusNotifications = surveyor.conectaPlusNotifications && typeof surveyor.conectaPlusNotifications === 'object'
    ? surveyor.conectaPlusNotifications
    : {};
  return {
    phone: whatsapp,
    whatsapp,
    phoneDisplay: formatBrazilPhone(whatsapp),
    whatsappDisplay: formatBrazilPhone(whatsapp),
    whatsappOptIn,
    whatsappReminderDays,
    conectaPlusNotifications
  };
}

function conectaPlusSecret() {
  return String(env('CONECTA_PLUS_API_KEY', '') || '').trim();
}

function safeSecretEqual(received = '', expected = '') {
  const a = Buffer.from(String(received || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function requireConectaPlusAccess(request) {
  const expected = conectaPlusSecret();
  if (!expected || expected.length < 32) throw statusError(503, 'CONECTA_PLUS_API_KEY ainda não configurada ou muito curta.');
  const received = bearerToken(headerValue(request, 'authorization'))
    || String(headerValue(request, 'x-conecta-plus-key') || headerValue(request, 'x-api-key') || '').trim();
  if (!safeSecretEqual(received, expected)) throw statusError(403, 'Credencial do Conecta+ inválida.');
  return true;
}

function syncContactPhoneToAppwriteAuthEnabled() {
  return String(env('SYNC_CONTACT_PHONE_TO_APPWRITE_AUTH', 'false')).trim().toLowerCase() === 'true';
}

async function updateAppwriteUserPhone(userId, phone = '') {
  const id = String(userId || '').trim();
  if (!id || !phone) return { skipped: true, reason: 'missing_phone' };
  // O telefone informado no painel é dado de contato, não credencial de login.
  // Por padrão ele permanece no perfil e nas preferências do Surveyor. Isso evita
  // colisões de "targets" do Appwrite quando duas contas usam o mesmo contato.
  if (!syncContactPhoneToAppwriteAuthEnabled()) {
    return { skipped: true, reason: 'contact_only' };
  }
  const normalized = normalizeBrazilPhone(phone, { required: true });
  try {
    return await awFetch(`/users/${encodeURIComponent(id)}/phone`, {
      method: 'PATCH',
      body: JSON.stringify({ number: normalized })
    });
  } catch (error) {
    const message = String(error?.message || error?.details?.message || '');
    const duplicateTarget = error?.status === 409 || error?.code === 409 || /target.*same ID.*already exists|target.*already exists|phone.*already exists/i.test(message);
    if (duplicateTarget) return { skipped: true, reason: 'duplicate_target' };
    throw error;
  }
}

function notificationExpiryKey(expiresAt = '') {
  return String(expiresAt || '').replace(/[^0-9]/g, '').slice(0, 14) || 'sem-vencimento';
}

function conectaPlusPendingDays(user = {}, requestedDays = null) {
  if (!user.whatsapp || !user.whatsappOptIn || !user.expiresAt || user.status === 'blocked') return [];
  const daysLeft = loginExpirationDaysLeft(user.expiresAt);
  if (!Number.isInteger(daysLeft) || daysLeft < 0) return [];
  const configured = normalizeReminderDays(requestedDays || user.whatsappReminderDays || [7, 1]);
  const history = user.conectaPlusNotifications && typeof user.conectaPlusNotifications === 'object' ? user.conectaPlusNotifications : {};
  const expiryKey = notificationExpiryKey(user.expiresAt);
  return configured.filter((day) => day === daysLeft && !history?.[expiryKey]?.[String(day)]?.sentAt);
}

async function updateAppwriteUserStatus(userId, active = true) {
  const id = String(userId || '').trim();
  if (!id) return null;
  const result = await awFetch(`/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: Boolean(active) })
  });
  // Regra central: qualquer caminho que desative/bloqueie uma conta também
  // invalida imediatamente tokens e refresh sessions já emitidos.
  if (!active) {
    const blockedAt = new Date().toISOString();
    await updateAppwriteUserSurveyorPrefs(id, {
      remoteLogoutAt: blockedAt,
      sessionVersion: appwriteId(),
      authSessions: []
    }).catch((error) => console.warn('[security] não foi possível revogar sessões após bloqueio:', error?.message || error));
  }
  return result;
}

async function updateAppwriteUserSurveyorPrefs(userId, patch = {}) {
  const id = String(userId || '').trim();
  if (!id) return null;
  const current = await getAppwriteUserById(id).catch(() => null);
  const { prefs, surveyor } = userPrefs(current || {});
  const nextSurveyor = { ...surveyor, ...patch };
  Object.keys(nextSurveyor).forEach((key) => {
    if (nextSurveyor[key] === undefined) delete nextSurveyor[key];
  });
  const nextPrefs = { ...prefs, surveyor: nextSurveyor };
  return awFetch(`/users/${encodeURIComponent(id)}/prefs`, {
    method: 'PATCH',
    body: JSON.stringify({ prefs: nextPrefs })
  });
}

function sanitizeOnboardingState(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const safeDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 64) return '';
    const time = Date.parse(raw);
    return Number.isFinite(time) ? new Date(time).toISOString() : '';
  };
  const tours = {};
  const sourceTours = source.tours && typeof source.tours === 'object' ? source.tours : {};
  Object.entries(sourceTours).slice(0, 40).forEach(([key, value]) => {
    const cleanKey = String(key || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 48);
    if (!cleanKey) return;
    const item = value && typeof value === 'object' ? value : {};
    const version = Math.max(0, Math.min(999, Number.parseInt(item.version, 10) || 0));
    tours[cleanKey] = {
      version,
      completedAt: safeDate(item.completedAt),
      skippedAt: safeDate(item.skippedAt)
    };
  });
  return {
    schemaVersion: Math.max(1, Math.min(20, Number.parseInt(source.schemaVersion, 10) || 1)),
    lastSeenAt: safeDate(source.lastSeenAt),
    lastReviewPromptAt: safeDate(source.lastReviewPromptAt),
    tours
  };
}

const REFRESH_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const REFRESH_SESSION_LIMIT = 12;

function normalizedAuthSessions(appwriteUser = {}) {
  const { surveyor } = userPrefs(appwriteUser || {});
  const now = Date.now();
  const source = Array.isArray(surveyor.authSessions) ? surveyor.authSessions : [];
  return source
    .filter((item) => item && typeof item === 'object' && item.jti && item.familyId)
    .filter((item) => {
      const touched = Date.parse(item.lastRotatedAt || item.createdAt || 0);
      return !Number.isFinite(touched) || touched <= 0 || now - touched <= REFRESH_SESSION_TTL_MS + 24 * 60 * 60 * 1000;
    })
    .slice(-REFRESH_SESSION_LIMIT);
}

async function issueRefreshSession({ userId, email, sessionVersion, appwriteUser = null, familyId = '' }) {
  const currentUser = appwriteUser || await getAppwriteUserById(userId).catch(() => null) || {};
  const sessions = normalizedAuthSessions(currentUser);
  const now = new Date().toISOString();
  const jti = appwriteId();
  const resolvedFamilyId = String(familyId || appwriteId());
  const nextSessions = [...sessions, { jti, familyId: resolvedFamilyId, createdAt: now, lastRotatedAt: now }].slice(-REFRESH_SESSION_LIMIT);
  await updateAppwriteUserSurveyorPrefs(userId, { authSessions: nextSessions });
  return signJwt({ sub: userId, email, type: 'refresh', sv: sessionVersion, jti, fid: resolvedFamilyId }, 14 * 24 * 60 * 60);
}

async function rotateRefreshSession({ payload, appwriteUser = null }) {
  const currentUser = appwriteUser || await getAppwriteUserById(payload.sub).catch(() => null) || {};
  const sessions = normalizedAuthSessions(currentUser);
  const sessionIndex = sessions.findIndex((item) => String(item.jti) === String(payload.jti || ''));
  if (sessionIndex < 0) {
    const revokedAt = new Date().toISOString();
    await updateAppwriteUserSurveyorPrefs(payload.sub, {
      authSessions: [],
      remoteLogoutAt: revokedAt,
      sessionVersion: appwriteId(),
      refreshReplayDetectedAt: revokedAt
    }).catch(() => null);
    throw statusError(401, 'Refresh token já utilizado ou revogado. Entre novamente.', { code: 'REFRESH_TOKEN_REPLAY' });
  }
  const familyId = String(sessions[sessionIndex].familyId || payload.fid || appwriteId());
  const now = new Date().toISOString();
  const nextJti = appwriteId();
  sessions.splice(sessionIndex, 1, { ...sessions[sessionIndex], jti: nextJti, familyId, lastRotatedAt: now });
  await updateAppwriteUserSurveyorPrefs(payload.sub, { authSessions: sessions.slice(-REFRESH_SESSION_LIMIT) });
  return signJwt({ sub: payload.sub, email: payload.email, type: 'refresh', sv: payload.sv, jti: nextJti, fid: familyId }, 14 * 24 * 60 * 60);
}

function profileStatus(profile = {}, appwriteUser = {}) {
  const safeProfile = profile && typeof profile === 'object' ? profile : {};
  const safeAppwriteUser = appwriteUser && typeof appwriteUser === 'object' ? appwriteUser : {};
  const { surveyor } = userPrefs(safeAppwriteUser);
  if (safeAppwriteUser.status === false) return 'blocked';
  return String(safeProfile.status || surveyor.status || 'active').toLowerCase();
}

function profileIsActive(profile = {}, appwriteUser = {}) {
  const safeProfile = profile && typeof profile === 'object' ? profile : {};
  const safeAppwriteUser = appwriteUser && typeof appwriteUser === 'object' ? appwriteUser : {};
  return profileStatus(safeProfile, safeAppwriteUser) === 'active' && safeAppwriteUser.status !== false && safeProfile.isActive !== false;
}

function profileExpiresAt(profile = {}, appwriteUser = {}) {
  const safeProfile = profile && typeof profile === 'object' ? profile : {};
  const safeAppwriteUser = appwriteUser && typeof appwriteUser === 'object' ? appwriteUser : {};
  const { surveyor } = userPrefs(safeAppwriteUser);
  return safeProfile.expiresAt || surveyor.expiresAt || null;
}

async function updateAppwriteUserEmailVerification(userId, emailVerified = true) {
  const id = String(userId || '').trim();
  if (!id) return null;
  const value = Boolean(emailVerified);
  const attempts = [
    { path: `/users/${encodeURIComponent(id)}/verification`, body: { emailVerification: value } },
    { path: `/users/${encodeURIComponent(id)}/verification`, body: { emailVerified: value } },
    { path: `/users/${encodeURIComponent(id)}/prefs`, body: { prefs: { surveyorEmailVerified: value } } }
  ];
  for (const attempt of attempts) {
    try {
      return await awFetch(attempt.path, { method: 'PATCH', body: JSON.stringify(attempt.body) });
    } catch (error) {
      console.warn('[Surveyor Auth] tentativa de atualizar verificação no Appwrite falhou:', attempt.path, error?.message || error);
    }
  }
  return null;
}

function loginEmailVerificationEnabled() {
  // v21.9.276: a verificação de primeiro acesso passa a ficar ativa por padrão.
  // Para desativar temporariamente, defina LOGIN_EMAIL_VERIFICATION_ENABLED=false.
  const raw = String(env('LOGIN_EMAIL_VERIFICATION_ENABLED', 'true')).toLowerCase();
  return !['0', 'false', 'no', 'off', 'disabled'].includes(raw);
}

function hasOwnVerificationField(profile = {}) {
  return Object.prototype.hasOwnProperty.call(profile || {}, 'emailVerified')
    || Object.prototype.hasOwnProperty.call(profile || {}, 'verificationRequired')
    || Object.prototype.hasOwnProperty.call(profile || {}, 'emailVerificationStatus');
}

function isTruthy(value) {
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'yes' || value === 'on';
}

function isEmailVerified(profile = {}, appwriteUser = {}) {
  // Quando a verificação de primeiro acesso está ativa, o Surveyor usa o
  // status próprio do users_profile como autoridade. O Appwrite pode marcar
  // emailVerification=true por fluxo interno, mas isso não deve liberar o
  // usuário sem passar pelo código do Surveyor.
  if (loginEmailVerificationEnabled()) {
    // Com a trava ativa, somente o campo próprio do Surveyor libera.
    // O campo legado `verified` não é usado para não liberar usuário novo por engano.
    if (Object.prototype.hasOwnProperty.call(profile || {}, 'emailVerified')) return isTruthy(profile.emailVerified);
    if (Object.prototype.hasOwnProperty.call(profile || {}, 'verificationRequired')) return !isTruthy(profile.verificationRequired);
    // Se a collection ainda não tiver os novos atributos, usamos o Appwrite apenas como
    // fallback de persistência, desde que a criação do usuário tenha marcado false.
    return appwriteUser.emailVerification === true || appwriteUser.emailVerified === true;
  }
  if (hasOwnVerificationField(profile)) {
    return isTruthy(profile.emailVerified) || isTruthy(profile.verified);
  }
  if (appwriteUser.emailVerification === true || appwriteUser.emailVerified === true) return true;
  return false;
}

function emailVerificationMeta(profile = {}, appwriteUser = {}) {
  const verified = isEmailVerified(profile, appwriteUser);
  return {
    emailVerified: verified,
    emailVerificationStatus: verified ? 'verified' : 'pending',
    emailVerifiedAt: profile.emailVerifiedAt || profile.verifiedAt || null,
    verificationRequired: !verified
  };
}

function maskEmail(email = '') {
  const [name = '', domain = ''] = String(email || '').split('@');
  if (!domain) return email;
  const left = name.length <= 2 ? `${name.slice(0, 1)}***` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${left}@${domain}`;
}

function generateVerificationCode() {
  return String(crypto.randomInt(100000, 999999));
}

function verificationCodeHash({ code, userId, email }) {
  return crypto.createHash('sha256')
    .update(`${String(code || '').trim()}|${String(userId || '').trim()}|${normalizeEmail(email)}|${jwtSecret()}`)
    .digest('hex');
}

const PASSWORD_MIN_LENGTH = Math.max(12, Math.min(64, Number(env('PASSWORD_MIN_LENGTH', '12')) || 12));

function passwordPolicyMessage(label = 'A senha') {
  return `${label} deve possuir pelo menos ${PASSWORD_MIN_LENGTH} caracteres, com letra maiúscula, letra minúscula, número e símbolo.`;
}

function assertStrongPassword(value, label = 'A senha') {
  const password = String(value || '');
  if (password.length < PASSWORD_MIN_LENGTH
      || !/[a-z]/.test(password)
      || !/[A-Z]/.test(password)
      || !/\d/.test(password)
      || !/[^A-Za-z0-9]/.test(password)) {
    throw statusError(400, passwordPolicyMessage(label), { code: 'PASSWORD_POLICY_FAILED', minLength: PASSWORD_MIN_LENGTH });
  }
  return password;
}

function securityRateKey(scope, value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  return crypto.createHmac('sha256', jwtSecret()).update(`${scope}|${normalized}`).digest('hex').slice(0, 40);
}


// Fallback por instância: mantém proteção quando o armazenamento persistente estiver
// temporariamente indisponível sem derrubar o login/API com erro 503.
const LOCAL_SECURITY_RATE_BUCKETS = new Map();
const LOCAL_API_RATE_BUCKETS = new Map();
const LOCAL_RATE_MAX_BUCKETS = 5000;

function compactLocalRateMap(map) {
  if (map.size <= LOCAL_RATE_MAX_BUCKETS) return;
  const ordered = [...map.entries()].sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0));
  map.clear();
  ordered.slice(0, LOCAL_RATE_MAX_BUCKETS).forEach(([key, value]) => map.set(key, value));
}

function localSecurityRateState(scope, identities = [], windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  return identities.map((value) => securityRateKey(scope, value)).filter(Boolean).map((key) => {
    const bucketKey = `${scope}:${key}`;
    const current = LOCAL_SECURITY_RATE_BUCKETS.get(bucketKey) || {};
    const attempts = Array.isArray(current.attempts)
      ? current.attempts.map(Number).filter((ts) => Number.isFinite(ts) && now - ts < windowMs)
      : [];
    return { bucketKey, attempts, now };
  });
}

function localSecurityRateCheck(scope, identities = [], { limit = 5, windowMs = 15 * 60 * 1000 } = {}) {
  let retryAfterSeconds = 0;
  for (const state of localSecurityRateState(scope, identities, windowMs)) {
    if (state.attempts.length >= limit) {
      const oldest = Math.min(...state.attempts);
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.max(1, Math.ceil((oldest + windowMs - state.now) / 1000)));
    }
  }
  if (retryAfterSeconds > 0) {
    throw statusError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', { code: 'RATE_LIMITED', retryAfterSeconds });
  }
  return true;
}

function localSecurityRateRecord(scope, identities = [], { windowMs = 15 * 60 * 1000 } = {}) {
  for (const state of localSecurityRateState(scope, identities, windowMs)) {
    state.attempts.push(state.now);
    LOCAL_SECURITY_RATE_BUCKETS.set(state.bucketKey, { attempts: state.attempts.slice(-50), updatedAt: state.now });
  }
  compactLocalRateMap(LOCAL_SECURITY_RATE_BUCKETS);
}

function localSecurityRateClear(scope, identities = []) {
  identities.map((value) => securityRateKey(scope, value)).filter(Boolean).forEach((key) => LOCAL_SECURITY_RATE_BUCKETS.delete(`${scope}:${key}`));
}

function assertGeneralApiRateLimit(request, path, httpMethod) {
  const ip = requestIp(request);
  if (!ip) return;
  const methodName = String(httpMethod || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodName);
  const isSensitiveAuth = /^\/api\/auth\//.test(String(path || ''));
  const windowMs = 60 * 1000;
  const limit = isSensitiveAuth ? 60 : (isMutation ? 180 : 900);
  const bucketKey = securityRateKey('api-abuse', `${ip}|${isSensitiveAuth ? 'auth' : (isMutation ? 'mutation' : 'read')}`);
  if (!bucketKey) return;
  const now = Date.now();
  const current = LOCAL_API_RATE_BUCKETS.get(bucketKey) || {};
  const attempts = Array.isArray(current.attempts)
    ? current.attempts.map(Number).filter((ts) => Number.isFinite(ts) && now - ts < windowMs)
    : [];
  if (attempts.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((Math.min(...attempts) + windowMs - now) / 1000));
    throw statusError(429, 'Limite temporário de requisições atingido. Aguarde e tente novamente.', { code: 'API_RATE_LIMITED', retryAfterSeconds });
  }
  attempts.push(now);
  LOCAL_API_RATE_BUCKETS.set(bucketKey, { attempts: attempts.slice(-Math.max(limit, 200)), updatedAt: now });
  compactLocalRateMap(LOCAL_API_RATE_BUCKETS);
}

function normalizeRateLimitStore(store = {}) {
  const raw = store.rateLimits && typeof store.rateLimits === 'object' ? store.rateLimits : {};
  return { ...raw };
}

async function persistentRateLimitCheck(scope, identities = [], { limit = 5, windowMs = 15 * 60 * 1000, failOpen = false } = {}) {
  try {
    const { store } = await readSystemSecurityStore();
    const now = Date.now();
    const buckets = normalizeRateLimitStore(store);
    const keys = identities.map((value) => securityRateKey(scope, value)).filter(Boolean);
    let retryAfterSeconds = 0;
    for (const key of keys) {
      const bucket = buckets[`${scope}:${key}`];
      const attempts = Array.isArray(bucket?.attempts)
        ? bucket.attempts.map(Number).filter((ts) => Number.isFinite(ts) && now - ts < windowMs)
        : [];
      if (attempts.length >= limit) {
        const oldest = Math.min(...attempts);
        retryAfterSeconds = Math.max(retryAfterSeconds, Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)));
      }
    }
    if (retryAfterSeconds > 0) {
      throw statusError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', { code: 'RATE_LIMITED', retryAfterSeconds });
    }
    // Também considera falhas mantidas no fallback local (ex.: gravação persistente falhou antes).
    localSecurityRateCheck(scope, identities, { limit, windowMs });
    return true;
  } catch (error) {
    if (Number(error?.status) === 429) throw error;
    console.warn(`[security] falha ao consultar rate limit persistente (${scope}); usando fallback local:`, error?.message || error);
    localSecurityRateCheck(scope, identities, { limit, windowMs });
    return false;
  }
}

async function persistentRateLimitRecord(scope, identities = [], { windowMs = 15 * 60 * 1000, failOpen = false } = {}) {
  // Registra primeiro no fallback local; a persistência amplia a proteção entre instâncias.
  localSecurityRateRecord(scope, identities, { windowMs });
  try {
    const { store } = await readSystemSecurityStore();
    const now = Date.now();
    const buckets = normalizeRateLimitStore(store);
    const keys = identities.map((value) => securityRateKey(scope, value)).filter(Boolean);
    for (const key of keys) {
      const bucketKey = `${scope}:${key}`;
      const current = buckets[bucketKey];
      const attempts = Array.isArray(current?.attempts)
        ? current.attempts.map(Number).filter((ts) => Number.isFinite(ts) && now - ts < windowMs)
        : [];
      attempts.push(now);
      buckets[bucketKey] = { attempts: attempts.slice(-50), updatedAt: new Date(now).toISOString() };
    }
    // Limita o número total de buckets para evitar crescimento sem controle.
    const sortedKeys = Object.keys(buckets).sort((a, b) => Date.parse(buckets[b]?.updatedAt || 0) - Date.parse(buckets[a]?.updatedAt || 0));
    const compact = {};
    sortedKeys.slice(0, 2500).forEach((key) => { compact[key] = buckets[key]; });
    await saveSystemSecurityStore({ ...store, rateLimits: compact });
    return true;
  } catch (error) {
    console.warn(`[security] falha ao registrar rate limit persistente (${scope}); fallback local já registrou a tentativa:`, error?.message || error);
    return false;
  }
}

async function persistentRateLimitClear(scope, identities = []) {
  localSecurityRateClear(scope, identities);
  try {
    const { store } = await readSystemSecurityStore();
    const buckets = normalizeRateLimitStore(store);
    let changed = false;
    identities.map((value) => securityRateKey(scope, value)).filter(Boolean).forEach((key) => {
      const bucketKey = `${scope}:${key}`;
      if (Object.prototype.hasOwnProperty.call(buckets, bucketKey)) {
        delete buckets[bucketKey];
        changed = true;
      }
    });
    if (changed) await saveSystemSecurityStore({ ...store, rateLimits: buckets });
  } catch (error) {
    console.warn(`[security] falha ao limpar rate limit persistente (${scope}):`, error?.message || error);
  }
}

async function sendPasswordResetEmail({ email, name, code }) {
  const emailFunctionUrl = String(env('EMAIL_FUNCTION_URL', '') || '').replace(/\/+$/, '');
  const emailFunctionSecret = env('EMAIL_FUNCTION_SECRET');
  if (!emailFunctionUrl || !emailFunctionSecret) {
    throw statusError(503, 'A Function de e-mail não está configurada para recuperação de senha.');
  }
  const endpoint = `${emailFunctionUrl}${env('EMAIL_FUNCTION_CODE_PATH', '/api/security/send-login-code')}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Surveyor-Internal-Secret': emailFunctionSecret
    },
    body: JSON.stringify({
      to: email,
      email,
      name: name || email,
      code,
      expiresInMinutes: 10,
      purpose: 'password_reset'
    })
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw statusError(502, 'Não foi possível enviar o código de recuperação.', details);
  }
  return true;
}

async function sendLoginVerificationEmail({ email, name, code }) {
  const emailFunctionUrl = String(env('EMAIL_FUNCTION_URL', '') || '').replace(/\/+$/, '');
  const emailFunctionSecret = env('EMAIL_FUNCTION_SECRET');
  if (emailFunctionUrl) {
    if (!emailFunctionSecret) throw statusError(503, 'EMAIL_FUNCTION_SECRET não configurado na surveyor-api.');
    const endpoint = `${emailFunctionUrl}${env('EMAIL_FUNCTION_CODE_PATH', '/api/security/send-login-code')}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Surveyor-Internal-Secret': emailFunctionSecret
      },
      body: JSON.stringify({
        to: email,
        email,
        name: name || email,
        code,
        expiresInMinutes: 10,
        purpose: 'login_verification'
      })
    });
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw statusError(502, 'A Function de e-mail não conseguiu enviar o código de confirmação.', details);
    }
    return true;
  }

  const apiKey = env('BREVO_API_KEY');
  const senderEmail = env('BREVO_SENDER_EMAIL') || env('SUPPORT_SENDER_EMAIL') || env('MAIL_FROM') || 'suporte@surveyorr.com.br';
  const senderName = env('BREVO_SENDER_NAME') || env('SUPPORT_SENDER_NAME') || 'Surveyor';
  if (!apiKey) throw statusError(503, 'Envio de código ainda não configurado. Configure EMAIL_FUNCTION_URL ou BREVO_API_KEY na Function Appwrite.');
  const html = `
    <div style="font-family:Arial,sans-serif;background:#f6f8fb;padding:28px;color:#0f172a">
      <div style="max-width:560px;margin:auto;background:#fff;border-radius:18px;padding:26px;border:1px solid #dbe4f0">
        <h2 style="margin:0 0 10px;color:#0f3b78">Confirme seu acesso ao Surveyor</h2>
        <p>Olá${name ? `, ${String(name).replace(/[<>]/g, '')}` : ''}. Use o código abaixo para confirmar sua conta no primeiro acesso.</p>
        <div style="font-size:34px;letter-spacing:8px;font-weight:800;text-align:center;background:#eef5ff;border-radius:14px;padding:18px;margin:22px 0;color:#0f5bdc">${code}</div>
        <p style="font-size:13px;color:#475569">Este código expira em 10 minutos. Se você não tentou entrar no sistema, ignore este e-mail.</p>
      </div>
    </div>`;
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email, name: name || email }],
      subject: 'Código de confirmação — Surveyor',
      htmlContent: html,
      textContent: `Seu código de confirmação do Surveyor é: ${code}. Ele expira em 10 minutos.`
    })
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw statusError(502, 'Não foi possível enviar o código de confirmação por e-mail.', details);
  }
  return true;
}

async function markUserEmailVerified({ userId, profile, appwriteUser }) {
  const now = new Date().toISOString();
  await updateAppwriteUserEmailVerification(userId, true);
  if (profile?.$id) {
    await updateProfileRow(profile.$id, {
      ...profile,
      emailVerified: true,
      emailVerifiedAt: profile.emailVerifiedAt || now,
      verificationRequired: false,
      updatedAt: now
    }).catch(() => null);
  }
  return { ...profile, emailVerified: true, emailVerifiedAt: profile?.emailVerifiedAt || now, verificationRequired: false };
}

async function ensureSurveyorProfile({ email, name = 'Usuário', role = 'user', plan = 'basic_annual' } = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw statusError(400, 'Informe o email do usuário.');
  const user = await getAppwriteUserByEmail(normalizedEmail);
  if (!user) throw statusError(404, 'Usuário não encontrado no Auth do Appwrite.');
  const userId = String(user.$id || user.id || '').trim();
  if (!userId) throw statusError(500, 'Usuário do Appwrite sem ID válido.');

  const existingByUserId = await findProfileByUserId(userId).catch(() => null);
  if (existingByUserId) return { profile: existingByUserId, user, action: 'exists_by_userId' };

  const existingByEmail = await findProfileByEmail(normalizedEmail).catch(() => null);
  if (existingByEmail?.$id) {
    const updated = await updateRow('users_profile', existingByEmail.$id, {
      userId,
      name: existingByEmail.name || name || user.name || 'Usuário',
      email: normalizedEmail,
      role: existingByEmail.role || role || 'user',
      plan: existingByEmail.plan || plan || 'basic_annual',
      permissions: existingByEmail.permissions || JSON.stringify([]),
      updatedAt: new Date().toISOString()
    });
    return { profile: updated, user, action: 'updated_by_email' };
  }

  const now = new Date().toISOString();
  const profile = await createRow('users_profile', {
    userId,
    name: name || user.name || 'Usuário',
    email: normalizedEmail,
    role: role || 'user',
    plan: plan || 'basic_annual',
    permissions: JSON.stringify([]),
    createdAt: now,
    updatedAt: now
  });
  return { profile, user, action: 'created' };
}


function permissionCandidates(permission) {
  const aliases = {
    mapa: ['map:access', 'map:view'], map: ['map:access', 'map:view'], 'map:view': ['map:access'], 'map:access': ['map:view', 'map:create-basic', 'map:draw-basic', 'map:measure-basic'],
    memorial: ['documents:memorial', 'documents:memorial-basic', 'documents:memorial-full'], 'documents:memorial': ['documents:memorial-basic', 'documents:memorial-full'], 'documents:memorial-basic': ['documents:memorial'], 'documents:memorial-full': ['documents:memorial'],
    ods: ['documents:ods', 'documents:ods-basic', 'documents:ods-full'], 'documents:ods': ['documents:ods-basic', 'documents:ods-full'], 'documents:ods-basic': ['documents:ods'], 'documents:ods-full': ['documents:ods'],
    confrontacao: ['documents:confrontacao', 'documents:confrontacao-basic', 'documents:confrontacao-full'], 'documents:confrontacao': ['documents:confrontacao-basic', 'documents:confrontacao-full'], 'documents:confrontacao-basic': ['documents:confrontacao'], 'documents:confrontacao-full': ['documents:confrontacao'],
    mapas: ['documents:mapas', 'documents:mapas-basic', 'documents:mapas-full'], 'documents:mapas': ['documents:mapas-basic', 'documents:mapas-full'], 'documents:mapas-basic': ['documents:mapas'], 'documents:mapas-full': ['documents:mapas'],
    pranchas: ['documents:pranchas', 'documents:pranchas-basic', 'documents:pranchas-full'], 'documents:pranchas': ['documents:pranchas-basic', 'documents:pranchas-full'], 'documents:pranchas-basic': ['documents:pranchas'], 'documents:pranchas-full': ['documents:pranchas'],
    perimetros: ['documents:perimetros', 'documents:perimetros-full'], 'documents:perimetros': ['documents:perimetros-full'], 'documents:perimetros-full': ['documents:perimetros'],
    planialtimetria: ['documents:planialtimetria', 'documents:planialtimetria-basic', 'planialtimetria:full'], 'documents:planialtimetria': ['documents:planialtimetria-basic', 'planialtimetria:full'], 'documents:planialtimetria-basic': ['documents:planialtimetria'],
    acervos: ['layers:official', 'layers:official-basic'], 'layers:official': ['layers:official-basic'], 'layers:official-basic': ['layers:official'], 'layers:view-basic': ['layers:official', 'layers:official-basic'], 'layers:catalog': ['layers:catalog-full', 'layers:view-full'], 'layers:catalog-full': ['layers:catalog', 'layers:view-full'],
    car: ['car:access', 'car:full'], 'car:access': ['car:full'], 'car:full': ['car:access'],
    ambiental: ['ambiental:access', 'ambiental:basic', 'ambiental:full'], 'ambiental:access': ['ambiental:basic', 'ambiental:full'], 'ambiental:basic': ['ambiental:access'], 'ambiental:full': ['ambiental:access', 'ambiental:basic'],
    loteamentos: ['loteamentos:access', 'loteamentos:basic', 'loteamentos:full'], 'loteamentos:access': ['loteamentos:basic', 'loteamentos:full'], 'loteamentos:basic': ['loteamentos:access'], 'loteamentos:full': ['loteamentos:access', 'loteamentos:basic'],
    cloud: ['cloud:access', 'cloud:view-own', 'cloud:basic', 'cloud:plus', 'cloud:pro'], 'cloud:access': ['cloud:view-own', 'cloud:basic'], 'cloud:view-own': ['cloud:access'], 'cloud:basic': ['cloud:access']
  };
  const key = String(permission || '').trim().toLowerCase();
  if (!key) return [];
  return [...new Set([key, ...(aliases[key] || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)])];
}

function addPermissionAliases(set) {
  let changed = true;
  while (changed) {
    changed = false;
    [...set].forEach((permission) => {
      permissionCandidates(permission).forEach((alias) => {
        if (!set.has(alias)) { set.add(alias); changed = true; }
      });
    });
  }
  return set;
}


function generationTokenValue(permission = '') {
  const value = String(permission || '').trim().toLowerCase();
  if (value === 'generations:unlimited') return { unlimited: true, limit: null };
  const match = value.match(/^generations:limit-(\d+)$/);
  if (match) return { unlimited: false, limit: Number(match[1]) };
  return null;
}

function cleanGenerationPermissions(permissions = []) {
  return parsePermissions(permissions).filter((permission) => !/^generations:(?:limit-\d+|unlimited)$/i.test(String(permission || '')));
}

function setGenerationPermission(permissions = []) {
  return cleanGenerationPermissions(permissions);
}

function generationRuleFromPlan() {
  return { unlimited: true, limit: null };
}

function generationPeriodKey(cycle = 'mensal', date = new Date()) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const text = String(cycle || '').toLowerCase();
  return text.includes('anual') || text.includes('annual') ? `${y}` : `${y}-${m}`;
}

function generationBalanceFromPrefs(surveyor = {}, planLimit = 0, periodKey = '') {
  const samePeriod = String(surveyor.generationPeriodKey || '') === String(periodKey || '');
  const legacyUsed = samePeriod ? Math.max(0, Number(surveyor.generationUsed || 0) || 0) : 0;
  const hasSeparatedPlanUsage = Object.prototype.hasOwnProperty.call(surveyor, 'generationPlanUsed');
  const rawExtra = Math.max(0, Number(surveyor.generationExtraCredits || 0) || 0);

  // Migração compatível: versões anteriores misturavam o uso do plano e os
  // créditos comprados em generationUsed. A separação preserva o saldo que
  // ainda restava ao usuário no período atual.
  if (!hasSeparatedPlanUsage) {
    const legacyExtraConsumed = Math.max(0, legacyUsed - planLimit);
    return {
      planUsed: Math.min(planLimit, legacyUsed),
      extra: Math.max(0, rawExtra - legacyExtraConsumed),
      migratedFromLegacy: legacyUsed > 0
    };
  }

  return {
    planUsed: samePeriod ? Math.min(planLimit, Math.max(0, Number(surveyor.generationPlanUsed || 0) || 0)) : 0,
    extra: rawExtra,
    migratedFromLegacy: false
  };
}

function generationUsageHistory(surveyor = {}) {
  return Array.isArray(surveyor.generationUsageHistory) ? surveyor.generationUsageHistory.slice(-199) : [];
}

function generationStatusForUser(profile = {}, appwriteUser = {}, plan = {}, role = 'user') {
  return {
    unlimited: true,
    hidden: true,
    planLimit: null,
    planUsed: 0,
    planRemaining: null,
    extra: 0,
    extraBalance: 0,
    used: 0,
    remaining: null,
    total: null,
    periodKey: generationPeriodKey(plan.billingCycle || 'anual'),
    billingCycle: plan.billingCycle || 'anual'
  };
}

async function consumeGenerationCredit(auth = {}, feature = 'documento') {
  return { allowed: true, generation: generationStatusForUser({}, {}, { billingCycle: auth?.user?.planLimits?.billingCycle || 'mensal' }, auth?.user?.role || 'user') };
}

function expandPlanPermissions(plan = {}, role = 'user') {
  if (String(role || '').toLowerCase() === 'admin') return ['admin:all'];
  const base = parsePermissions(plan.permissions);
  const set = new Set(base);
  const basic = planBySlug('basic_monthly').permissions || [];
  const plus = planBySlug('plus_monthly').permissions || [];
  const pro = planBySlug('pro_monthly').permissions || [];
  if (set.has('pro:*')) { plus.forEach((permission) => set.add(permission)); pro.forEach((permission) => set.add(permission)); }
  if (set.has('plus:*')) plus.forEach((permission) => set.add(permission));
  if (set.has('basic:*')) basic.forEach((permission) => set.add(permission));
  addPermissionAliases(set);
  return sanitizeCommercialPermissions([...set]);
}

function publicUser(profile = {}, user = {}, planOverride = null, workspace = {}) {
  const plan = planOverride || planBySlug(profile.plan || profile.planSlug || 'basic_annual');
  const isSubuser = Boolean(workspace.isSubuser || workspace.accountType === 'subuser');
  const rawRole = String(profile.role || 'user').toLowerCase();
  const role = isSubuser && rawRole === 'admin' ? 'user' : rawRole;
  const planPermissions = String(role || '').toLowerCase() === 'admin'
    ? ['admin:all']
    : sanitizeCommercialPermissions(plan.permissions);
  const effectivePermissions = String(role || '').toLowerCase() === 'admin'
    ? ['admin:all']
    : expandPlanPermissions({ ...plan, permissions: planPermissions }, role);
  // Equipe compartilhada: o membro usa integralmente a matriz comercial do
  // plano do titular. O papel da equipe não reduz recursos contratados
  // (Personalização, edição avançada, exportação, camadas, documentos etc.).
  // Operações administrativas globais continuam protegidas por requireAdminAccess
  // e nunca entram em sanitizeCommercialPermissions/expandPlanPermissions.
  const userPermissions = String(role || '').toLowerCase() === 'admin' ? ['admin:all'] : effectivePermissions;
  const generation = generationStatusForUser(profile, user, plan, role);
  const subscriptionProfile = workspace.subscriptionProfile || profile;
  const subscriptionUser = workspace.subscriptionUser || user;
  const storageEntitlement = commercialStorageEntitlement(plan, subscriptionUser);
  const usageRule = commercialUsageRule(plan);
  const effectiveExpiresAt = workspace.expiresAt !== undefined
    ? workspace.expiresAt
    : profileExpiresAt(subscriptionProfile, subscriptionUser);
  const ownStatus = profileStatus(profile, user);
  const ownActive = profileIsActive(profile, user);
  return {
    id: profile.userId || user.$id || user.id,
    name: profile.name || user.name || '',
    email: normalizeEmail(profile.email || user.email || ''),
    mustChangePassword: Boolean(userPrefs(user)?.surveyor?.mustChangePassword),
    accountProvisionedByPayment: Boolean(userPrefs(user)?.surveyor?.accountProvisionedByPayment),
    ...userContactMeta(profile, user),
    role,
    planId: plan.id || plan.slug,
    planSlug: plan.slug,
    planName: plan.name,
    plan: plan.slug,
    planPermissions,
    effectivePermissions,
    permissions: JSON.stringify(userPermissions),
    planLimits: {
      projectLimit: null,
      userLimit: plan.userLimit ?? null,
      storageLimitBytes: storageEntitlement.effectiveBytes,
      storageBaseBytes: storageEntitlement.baseBytes,
      storagePurchasedBytes: storageEntitlement.purchasedBytes,
      storageMaxBytes: storageEntitlement.maxBytes,
      storageStoreUrl: storageEntitlement.storeUrl,
      downloadDailyLimit: usageRule.downloadDailyLimit,
      exportDailyLimit: usageRule.exportDailyLimit,
      billingCycle: plan.billingCycle || 'anual',
      priceCents: plan.priceCents || 0,
      generationLimit: generation.planLimit,
      generationUnlimited: generation.unlimited
    },
    generation,
    subscription: subscriptionState({ ...subscriptionProfile, role, expiresAt: effectiveExpiresAt }),
    ...emailVerificationMeta(profile, user),
    status: ownStatus,
    isActive: ownActive,
    expiresAt: effectiveExpiresAt,
    accountType: isSubuser ? 'subuser' : 'primary',
    isSubuser,
    planInherited: isSubuser,
    workspaceOwnerUserId: workspace.ownerUserId || profile.userId || user.$id || user.id || '',
    workspaceOwnerName: workspace.ownerName || profile.name || user.name || '',
    workspaceRole: isSubuser ? (workspace.memberRole || 'collaborator') : 'owner',
    paidExtraSeat: isSubuser ? Boolean(workspace.paidExtraSeat) : false,
    seatPriceCents: isSubuser && workspace.paidExtraSeat ? Number(workspace.seatPriceCents || workspaceExtraSeatPriceCents(plan)) : 0,
    createdAt: profile.createdAt || user.$createdAt || null,
    updatedAt: profile.updatedAt || user.$updatedAt || null
  };
}

function subscriptionExpiryMoment(expiresAt) {
  if (!expiresAt) return null;
  const raw = String(expiresAt).trim();
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /T00:00:00(?:\.000)?Z$/i.test(raw)) date.setUTCHours(23, 59, 59, 999);
  return date;
}

function subscriptionState(user = {}) {
  const role = String(user.role || 'user').toLowerCase();
  const expiry = subscriptionExpiryMoment(user.expiresAt);
  const daysLeft = loginExpirationDaysLeft(user.expiresAt);
  const expired = role !== 'admin' && Boolean(expiry && expiry.getTime() < Date.now());
  return {
    expired,
    daysLeft,
    expiresAt: user.expiresAt || null,
    warning: role !== 'admin' && Number.isInteger(daysLeft) && daysLeft >= 0 && daysLeft <= Number(env('RENEWAL_EARLY_WARNING_DAYS', '7') || 7),
    supportPath: '/suporte/'
  };
}

function ensureUserAccessAllowed(user = {}) {
  const status = String(user.status || 'active').toLowerCase();
  const role = String(user.role || 'user').toLowerCase();
  const subscription = subscriptionState(user);
  if (role !== 'admin' && (status === 'expired' || subscription.expired)) {
    throw statusError(403, 'Login bloqueado por falta de pagamento. Fale com o suporte para renovar seu plano.', {
      code: 'PLAN_EXPIRED', reason: 'payment_required', expiresAt: user.expiresAt || null, supportPath: '/suporte/'
    });
  }
  if (role !== 'admin' && ['blocked', 'bloqueado'].includes(status)) {
    throw statusError(403, 'Conta bloqueada pelo administrador. Fale com o suporte.', { code: 'ACCOUNT_BLOCKED', supportPath: '/suporte/' });
  }
  if (role !== 'admin' && ['pending', 'pendente'].includes(status)) {
    throw statusError(403, 'Conta pendente de liberação pelo administrador.', { code: 'ACCOUNT_PENDING', supportPath: '/suporte/' });
  }
  return user;
}

async function synchronizeExpiredProfile(profile = {}, appwriteUser = {}) {
  const role = String(profile.role || 'user').toLowerCase();
  const expiresAt = profileExpiresAt(profile, appwriteUser);
  if (role === 'admin' || !subscriptionState({ role, expiresAt }).expired) return { profile, appwriteUser, changed: false };
  const now = new Date().toISOString();
  const nextProfile = { ...profile, status: 'expired', isActive: false, updatedAt: now };
  if (profile.$id || profile.id) await updateProfileRow(profile.$id || profile.id, nextProfile).catch(() => null);
  await updateAppwriteUserSurveyorPrefs(profile.userId || appwriteUser.$id || appwriteUser.id, { status: 'expired', expiresAt }).catch(() => null);
  return { profile: nextProfile, appwriteUser, changed: true };
}

async function findProfileByEmail(email) {
  const rows = await listRows('users_profile', [Query.equal('email', normalizeEmail(email)), Query.limit(1)]);
  return rows[0] || null;
}

async function listProfilesFallback(limit = 200) {
  try {
    return await listRows('users_profile', [Query.limit(limit)]);
  } catch {
    return [];
  }
}

async function findProfileByUserId(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return null;
  const rows = await listRows('users_profile', [Query.equal('userId', normalizedUserId), Query.limit(1)]).catch(() => []);
  if (rows[0]) return rows[0];
  const fallbackRows = await listProfilesFallback();
  return fallbackRows.find((row) => String(row.userId || '').trim() === normalizedUserId) || null;
}

async function findProfileForLogin(userId, email) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const byUserId = await findProfileByUserId(normalizedUserId).catch(() => null);
  if (byUserId) return byUserId;
  const byEmail = await findProfileByEmail(normalizedEmail).catch(() => null);
  if (byEmail) {
    if (normalizedUserId && String(byEmail.userId || '').trim() !== normalizedUserId && byEmail.$id) {
      try {
        return await updateRow('users_profile', byEmail.$id, { userId: normalizedUserId, updatedAt: new Date().toISOString() });
      } catch {
        return { ...byEmail, userId: normalizedUserId || byEmail.userId };
      }
    }
    return byEmail;
  }
  const fallbackRows = await listProfilesFallback();
  return fallbackRows.find((row) => normalizeEmail(row.email) === normalizedEmail || String(row.userId || '').trim() === normalizedUserId) || null;
}


const PLUS_EXTRA_SEAT_PRICE_CENTS = 3000;
const PRO_EXTRA_SEAT_PRICE_CENTS = 6000;
// Subusuários usam integralmente a mesma franquia do titular. Não existe limite individual por membro.

function workspacePlanTier(plan = {}) {
  const slug = String(plan.slug || plan.id || '').trim().toLowerCase();
  if (slug.startsWith('pro')) return 'pro';
  if (slug.startsWith('plus')) return 'plus';
  return 'basic';
}

function workspaceExtraSeatPriceCents(plan = {}) {
  const tier = workspacePlanTier(plan);
  if (tier === 'pro') return PRO_EXTRA_SEAT_PRICE_CENTS;
  if (tier === 'plus') return PLUS_EXTRA_SEAT_PRICE_CENTS;
  return 0;
}

function workspacePlanAllowsMembers(plan = {}) {
  return ['plus', 'pro'].includes(workspacePlanTier(plan));
}

function workspaceSchemaMissing(error) {
  const text = errorText(error);
  return Number(error?.appwriteStatus || error?.status) === 404
    || /workspace_members|collection.*not found|table.*not found|could not be found/i.test(text);
}

function normalizeWorkspaceMemberRole(value = 'collaborator') {
  const role = String(value || '').trim().toLowerCase();
  if (['technician', 'tecnico', 'técnico'].includes(role)) return 'technician';
  if (['manager', 'gestor'].includes(role)) return 'manager';
  return 'collaborator';
}

function normalizeWorkspaceMemberStatus(value = 'active') {
  const status = String(value || 'active').trim().toLowerCase();
  if (['blocked', 'bloqueado'].includes(status)) return 'blocked';
  if (['pending', 'pendente'].includes(status)) return 'pending';
  return 'active';
}


function workspaceMembershipFromAppwriteUser(appwriteUser = {}) {
  const userId = String(appwriteUser?.$id || appwriteUser?.id || '').trim();
  if (!userId) return null;
  const { surveyor } = userPrefs(appwriteUser || {});
  const ownerUserId = String(surveyor.workspaceOwnerUserId || '').trim();
  if (!ownerUserId) return null;
  return {
    userId,
    ownerUserId,
    memberRole: normalizeWorkspaceMemberRole(surveyor.workspaceMemberRole || 'collaborator'),
    status: normalizeWorkspaceMemberStatus(surveyor.status || (appwriteUser.status === false ? 'blocked' : 'active')),
    paidExtraSeat: false,
    seatPriceCents: 0,
    createdByAdminId: '',
    createdAt: String(surveyor.workspaceJoinedAt || appwriteUser.$createdAt || ''),
    updatedAt: String(appwriteUser.$updatedAt || surveyor.workspaceJoinedAt || ''),
    _workspaceStorage: 'prefs'
  };
}

async function listWorkspaceMembersFromPrefs(ownerUserId) {
  const ownerId = String(ownerUserId || '').trim();
  if (!ownerId) return [];
  const appwriteUsers = await listAppwriteUsers(500).catch(() => []);
  return (Array.isArray(appwriteUsers) ? appwriteUsers : [])
    .map((user) => workspaceMembershipFromAppwriteUser(user))
    .filter((membership) => membership && String(membership.ownerUserId || '') === ownerId);
}

function workspaceMembershipStorageError(error) {
  if (!error) return false;
  const text = errorText(error);
  const status = Number(error?.appwriteStatus || error?.status || error?.code || 0);
  return workspaceSchemaMissing(error)
    || isUnknownAttributeError(error)
    || /missing required attribute|invalid document structure|workspace_members|attribute|column|schema/i.test(text)
    || [400, 404, 422, 500, 503].includes(status);
}

function workspaceSyntheticMembership(input = {}) {
  const data = workspaceMemberData(input, {});
  return { ...data, _workspaceStorage: 'prefs' };
}

function workspaceMemberData(input = {}, current = {}) {
  const now = new Date().toISOString();
  return {
    userId: String(input.userId || current.userId || '').trim(),
    ownerUserId: String(input.ownerUserId || current.ownerUserId || '').trim(),
    memberRole: normalizeWorkspaceMemberRole(input.memberRole || input.role || current.memberRole || 'collaborator'),
    status: normalizeWorkspaceMemberStatus(input.status || current.status || 'active'),
    paidExtraSeat: input.paidExtraSeat !== undefined ? Boolean(input.paidExtraSeat) : Boolean(current.paidExtraSeat),
    seatPriceCents: input.paidExtraSeat !== undefined
      ? (Boolean(input.paidExtraSeat) ? Math.max(0, Number(input.seatPriceCents || current.seatPriceCents || 0) || 0) : 0)
      : Math.max(0, Number(current.seatPriceCents || 0) || 0),
    createdByAdminId: String(input.createdByAdminId || current.createdByAdminId || '').trim(),
    createdAt: current.createdAt || input.createdAt || now,
    updatedAt: now
  };
}


const WORKSPACE_MEMBER_REQUIRED_FIELDS = new Set(['userId', 'ownerUserId']);
const WORKSPACE_MEMBER_OPTIONAL_FIELDS = new Set([
  'memberRole', 'status', 'paidExtraSeat', 'seatPriceCents', 'createdByAdminId', 'createdAt', 'updatedAt'
]);

function workspaceUnknownAttributeFromError(error) {
  const text = errorText(error);
  const patterns = [
    /Unknown attribute[^A-Za-z0-9_]+([A-Za-z_][A-Za-z0-9_.$-]*)/i,
    /Attribute\s+["']?([A-Za-z_][A-Za-z0-9_.$-]*)["']?\s+(?:not found|does not exist|is not available)/i,
    /(?:attribute|column)\s+[`"']?([A-Za-z_][A-Za-z0-9_.$-]*)[`"']?\s+(?:was not found|not found|is unknown)/i,
    /Invalid document structure.*?["']([A-Za-z_][A-Za-z0-9_.$-]*)["']/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const key = String(match?.[1] || '').trim();
    if (key && (WORKSPACE_MEMBER_REQUIRED_FIELDS.has(key) || WORKSPACE_MEMBER_OPTIONAL_FIELDS.has(key))) return key;
  }
  return '';
}

async function writeWorkspaceMembership(mode, rowId, input = {}, current = {}) {
  let payload = workspaceMemberData(input, current);
  const removed = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const row = mode === 'update'
        ? await updateRow('workspace_members', rowId, payload)
        : await createRow('workspace_members', payload, rowId || appwriteId());
      // Normalize defaults in memory when a legacy Appwrite schema lacks
      // optional attributes. Reads therefore remain stable even before the
      // production collection is upgraded to the newest schema.
      return {
        ...payload,
        ...(row && typeof row === 'object' ? row : {}),
        memberRole: normalizeWorkspaceMemberRole(row?.memberRole || payload.memberRole || 'collaborator'),
        status: normalizeWorkspaceMemberStatus(row?.status || payload.status || 'active'),
        paidExtraSeat: Boolean(row?.paidExtraSeat ?? payload.paidExtraSeat ?? false),
        seatPriceCents: Math.max(0, Number(row?.seatPriceCents ?? payload.seatPriceCents ?? 0) || 0)
      };
    } catch (error) {
      const attribute = workspaceUnknownAttributeFromError(error);
      if (!attribute || WORKSPACE_MEMBER_REQUIRED_FIELDS.has(attribute) || !Object.prototype.hasOwnProperty.call(payload, attribute)) throw error;
      delete payload[attribute];
      removed.push(attribute);
    }
  }
  throw statusError(500, 'Não foi possível adaptar a gravação de workspace_members ao schema atual.', {
    code: 'WORKSPACE_MEMBER_SCHEMA_INCOMPATIBLE', removed
  });
}

async function createWorkspaceMembership(input = {}) {
  return writeWorkspaceMembership('create', '', input, {});
}

async function updateWorkspaceMembership(rowId, input = {}, current = {}) {
  return writeWorkspaceMembership('update', rowId, input, current);
}

async function listAllWorkspaceMemberships() {
  let rows = [];
  try {
    rows = await listAllRows('workspace_members');
  } catch (error) {
    if (!workspaceMembershipStorageError(error) && !workspaceSchemaMissing(error)) throw error;
    console.warn?.('[Surveyor API] workspace_members indisponível na listagem administrativa; mesclando vínculos das prefs do Appwrite.', String(error?.message || error));
  }
  const appwriteUsers = await listAppwriteUsers(500).catch(() => []);
  const prefsRows = (Array.isArray(appwriteUsers) ? appwriteUsers : [])
    .map((user) => workspaceMembershipFromAppwriteUser(user))
    .filter((item) => item && typeof item === 'object');
  const byUserId = new Map();
  for (const item of [...prefsRows, ...(Array.isArray(rows) ? rows : [])]) {
    const memberUserId = String(item?.userId || '').trim();
    if (!memberUserId) continue;
    byUserId.set(memberUserId, item);
  }
  return [...byUserId.values()];
}

async function listWorkspaceMembersByOwner(ownerUserId) {
  const ownerId = String(ownerUserId || '').trim();
  if (!ownerId) return [];
  let rows = [];
  try {
    rows = await listAllRows('workspace_members', [Query.equal('ownerUserId', ownerId)]);
  } catch (error) {
    if (!workspaceMembershipStorageError(error)) throw error;
    console.warn?.('[Surveyor API] workspace_members indisponível; usando prefs como armazenamento de equipe', String(error?.message || error));
  }
  const prefsRows = await listWorkspaceMembersFromPrefs(ownerId).catch(() => []);
  const byUserId = new Map();
  for (const item of [...(Array.isArray(prefsRows) ? prefsRows : []), ...(Array.isArray(rows) ? rows : [])]) {
    if (!item || typeof item !== 'object') continue;
    const memberUserId = String(item.userId || '').trim();
    if (!memberUserId) continue;
    byUserId.set(memberUserId, item);
  }
  return [...byUserId.values()];
}

async function findWorkspaceMembershipByUserId(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;
  try {
    const rows = await listRows('workspace_members', [Query.equal('userId', id), Query.limit(1)]);
    if (rows[0]) return rows[0];
  } catch (error) {
    if (!workspaceMembershipStorageError(error)) throw error;
    console.warn?.('[Surveyor API] consulta workspace_members falhou; tentando prefs do usuário', String(error?.message || error));
  }
  const appwriteUser = await getAppwriteUserById(id).catch(() => null);
  return workspaceMembershipFromAppwriteUser(appwriteUser || {});
}

function assertWorkspaceMembershipActive(membership = {}) {
  const safeMembership = membership && typeof membership === 'object' ? membership : {};
  const status = normalizeWorkspaceMemberStatus(safeMembership.status || 'active');
  if (status === 'blocked') throw statusError(403, 'Este acesso compartilhado foi bloqueado pelo administrador.', { code: 'WORKSPACE_MEMBER_BLOCKED' });
  if (status === 'pending') throw statusError(403, 'Este acesso compartilhado ainda está pendente de liberação.', { code: 'WORKSPACE_MEMBER_PENDING' });
}

async function resolveAuthenticatedIdentity(profile = {}, appwriteUser = {}) {
  const actualUserId = String(profile.userId || appwriteUser.$id || appwriteUser.id || '').trim();
  const membership = await findWorkspaceMembershipByUserId(actualUserId).catch(() => null);

  if (!membership) {
    const applied = await synchronizeExpiredProfile(profile, appwriteUser || {}).catch(() => ({ profile, appwriteUser: appwriteUser || {} }));
    const activeProfile = applied.profile || profile;
    const activeAppwriteUser = applied.appwriteUser || appwriteUser || {};
    const plan = await findPlanBySlugSafe(activeProfile.plan || activeProfile.planSlug || 'basic_annual').catch(() => null);
    const user = ensureUserAccessAllowed(publicUser(activeProfile, activeAppwriteUser, plan, {
      accountType: 'primary',
      ownerUserId: actualUserId,
      ownerName: activeProfile.name || activeAppwriteUser.name || ''
    }));
    return {
      user,
      profile: activeProfile,
      appwriteUser: activeAppwriteUser,
      membership: null,
      ownerProfile: activeProfile,
      ownerAppwriteUser: activeAppwriteUser,
      resourceOwnerUserId: actualUserId,
      workspace: { accountType: 'primary', ownerUserId: actualUserId, memberRole: 'owner', paidExtraSeat: false }
    };
  }

  assertWorkspaceMembershipActive(membership);
  const ownerUserId = String(membership.ownerUserId || '').trim();
  if (!ownerUserId || ownerUserId === actualUserId) throw statusError(403, 'Vínculo de equipe inválido. Fale com o administrador.', { code: 'WORKSPACE_LINK_INVALID' });
  const ownerMembership = await findWorkspaceMembershipByUserId(ownerUserId).catch(() => null);
  if (ownerMembership) throw statusError(403, 'Não é permitido vincular subusuários a outro subusuário.', { code: 'WORKSPACE_NESTING_BLOCKED' });
  const ownerProfile = await findProfileByUserId(ownerUserId).catch(() => null);
  const ownerAppwriteUser = await getAppwriteUserById(ownerUserId).catch(() => null);
  if (!ownerProfile) throw statusError(403, 'A assinatura principal deste acesso não foi encontrada.', { code: 'WORKSPACE_OWNER_NOT_FOUND' });
  const appliedOwner = await synchronizeExpiredProfile(ownerProfile, ownerAppwriteUser || {}).catch(() => ({ profile: ownerProfile, appwriteUser: ownerAppwriteUser || {} }));
  const activeOwnerProfile = appliedOwner.profile || ownerProfile;
  const activeOwnerUser = appliedOwner.appwriteUser || ownerAppwriteUser || {};
  const ownerPlan = await findPlanBySlugSafe(activeOwnerProfile.plan || activeOwnerProfile.planSlug || 'basic_annual').catch(() => null);
  ensureUserAccessAllowed(publicUser(activeOwnerProfile, activeOwnerUser, ownerPlan));
  const user = ensureUserAccessAllowed(publicUser(profile, appwriteUser, ownerPlan, {
    accountType: 'subuser',
    isSubuser: true,
    ownerUserId,
    ownerName: activeOwnerProfile.name || activeOwnerUser.name || '',
    memberRole: membership.memberRole || 'collaborator',
    paidExtraSeat: Boolean(membership.paidExtraSeat),
    seatPriceCents: Number(membership.seatPriceCents || workspaceExtraSeatPriceCents(ownerPlan)),
    subscriptionProfile: activeOwnerProfile,
    subscriptionUser: activeOwnerUser,
    expiresAt: profileExpiresAt(activeOwnerProfile, activeOwnerUser)
  }));
  return {
    user,
    profile,
    appwriteUser,
    membership,
    ownerProfile: activeOwnerProfile,
    ownerAppwriteUser: activeOwnerUser,
    resourceOwnerUserId: ownerUserId,
    workspace: {
      accountType: 'subuser', ownerUserId, memberRole: membership.memberRole || 'collaborator',
      paidExtraSeat: Boolean(membership.paidExtraSeat), seatPriceCents: Number(membership.seatPriceCents || workspaceExtraSeatPriceCents(ownerPlan))
    }
  };
}

function resourceOwnerId(auth = {}) {
  return String(auth.resourceOwnerUserId || auth.workspace?.ownerUserId || auth.sub || '').trim();
}

function workspaceRoleAllowsAction(role = 'collaborator', action = '') {
  normalizeWorkspaceMemberRole(role);
  // Membros ativos da equipe possuem o mesmo conjunto operacional do plano
  // compartilhado. Gestão global da assinatura/equipe continua fora deste
  // fluxo e protegida por rotas administrativas próprias.
  return String(action || '').trim().toLowerCase() !== 'workspace:manage';
}

function assertWorkspaceActionAllowed(auth = {}, action = '') {
  if (!auth?.user?.isSubuser) return;
  const role = auth.workspace?.memberRole || auth.user.workspaceRole || 'collaborator';
  if (workspaceRoleAllowsAction(role, action)) return;
  const labels = {
    'project:delete': 'excluir projetos',
    'project:share': 'criar ou revogar compartilhamentos externos',
    'project:lock': 'travar projetos',
    'project:version-restore': 'restaurar versões',
    'project:duplicate': 'duplicar projetos',
    'project:export': 'exportar projetos',
    'document:delete': 'excluir documentos',
    'customization:company': 'alterar a identidade da assinatura'
  };
  throw statusError(403, `O perfil ${normalizeWorkspaceMemberRole(role)} não pode ${labels[action] || 'executar esta operação'}.`, {
    code: 'WORKSPACE_ROLE_LIMIT', memberRole: normalizeWorkspaceMemberRole(role), action
  });
}

async function ensureUserSessionVersion(userId, appwriteUser = {}) {
  const { surveyor } = userPrefs(appwriteUser || {});
  const current = String(surveyor.sessionVersion || '').trim();
  if (current) return current;
  const sessionVersion = appwriteId();
  await updateAppwriteUserSurveyorPrefs(userId, { sessionVersion }).catch((error) => console.warn('[security] não foi possível registrar a versão da sessão:', error?.message || error));
  return sessionVersion;
}

function assertTokenNotRemotelyRevoked(payload, appwriteUser = {}) {
  const { surveyor } = userPrefs(appwriteUser || {});
  const remoteLogoutAt = surveyor.remoteLogoutAt ? Date.parse(surveyor.remoteLogoutAt) : 0;
  if (remoteLogoutAt && payload.iat && remoteLogoutAt > Number(payload.iat || 0) * 1000) {
    throw statusError(401, 'Sessão encerrada remotamente. Entre novamente.', { code: 'SESSION_REVOKED' });
  }
  const currentSessionVersion = String(surveyor.sessionVersion || '').trim();
  const tokenSessionVersion = String(payload.sv || '').trim();
  if (currentSessionVersion && currentSessionVersion !== tokenSessionVersion) {
    throw statusError(401, 'Esta sessão foi substituída ou revogada. Entre novamente.', { code: 'SESSION_REVOKED' });
  }
}

async function authFromRequest(request) {
  const token = authTokenFromRequest(request);
  const payload = verifyJwtType(token, 'access', 'Token de acesso inválido para esta operação.');
  if (!payload.sub || !payload.email || !payload.user || typeof payload.user !== 'object') {
    throw statusError(401, 'Token de acesso incompleto.');
  }
  // R19: o login/refresh é o ponto de validação completa no Appwrite.
  // Nas operações normais, a autorização usa apenas o snapshot assinado do JWT.
  // Isso elimina consultas repetidas ao Appwrite a cada clique/requisição.
  const user = ensureUserAccessAllowed({ ...payload.user, id: payload.user.id || payload.sub, email: payload.user.email || payload.email });
  // Para operações que modificam dados, o token sozinho pode estar defasado
  // após bloqueio, troca de papel ou encerramento remoto da sessão.
  // A leitura viva impede gravação com permissões já revogadas. Leituras
  // continuam rápidas com JWT para não penalizar navegação do mapa.
  if (['POST','PUT','PATCH','DELETE'].includes(method(request))) {
    const [liveAccount, liveProfile] = await Promise.all([
      getAppwriteUserById(user.id), findProfileByUserId(user.id)
    ]);
    if (!liveAccount || !liveProfile) throw statusError(401,'Conta não encontrada para confirmar a permissão atual.',{code:'ACCOUNT_NOT_VERIFIED'});
    assertTokenNotRemotelyRevoked(payload,liveAccount);
    if (!profileIsActive(liveProfile,liveAccount)) throw statusError(403,'Conta bloqueada ou inativa. Entre em contato com o suporte.',{code:'ACCOUNT_BLOCKED'});
    if (String(liveProfile.role||'user').toLowerCase()!==String(user.role||'user').toLowerCase()) {
      throw statusError(401,'As permissões da conta foram alteradas. Entre novamente.',{code:'SESSION_PERMISSIONS_CHANGED'});
    }
  }
  const workspace = payload.workspace && typeof payload.workspace === 'object'
    ? payload.workspace
    : { accountType: user?.isSubuser ? 'subuser' : 'primary', ownerUserId: payload.resourceOwnerUserId || user.id, memberRole: user?.workspaceRole || (user?.isSubuser ? 'collaborator' : 'owner') };
  return {
    sub: user.id || payload.sub,
    email: user.email || payload.email,
    user,
    resourceOwnerUserId: String(payload.resourceOwnerUserId || workspace.ownerUserId || user.id || payload.sub),
    workspace,
    tokenIssuedAt: payload.iat || null
  };
}

function parsePath(request) {
  const raw = request.path || request.url || '/';
  let path = String(raw || '/');
  try {
    if (/^https?:/i.test(path)) path = new URL(path).pathname;
  } catch {}
  // Appwrite pode entregar o caminho com query embutida em request.path.
  // A rota deve ser comparada sem querystring, senão caminhos públicos
  // como /api/geoservices/wms?target=... ficam sujeitos a comportamentos
  // diferentes entre runtimes/deploys.
  path = path.split('?')[0].split('#')[0] || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/^\/v1\/functions\/[^/]+\/executions\/?/, '/');
  if (!path.startsWith('/api/')) path = `/api${path === '/' ? '/health' : path}`;
  return path.replace(/\/+/g, '/');
}

function method(request) {
  return String(request.method || 'GET').toUpperCase();
}

function headerValue(request, name) {
  const headers = request?.headers || {};
  const normalizedName = String(name || '').toLowerCase();
  if (!normalizedName) return undefined;
  if (typeof headers.get === 'function') {
    const value = headers.get(name) || headers.get(normalizedName);
    if (value != null) return Array.isArray(value) ? value[0] : value;
  }
  if (Array.isArray(headers)) {
    const pair = headers.find(([key]) => String(key || '').toLowerCase() === normalizedName);
    return Array.isArray(pair?.[1]) ? pair[1][0] : pair?.[1];
  }
  const key = Object.keys(headers).find((item) => String(item || '').toLowerCase() === normalizedName);
  const value = key ? headers[key] : undefined;
  return Array.isArray(value) ? value[0] : value;
}

function queryStringSources(request) {
  const sources = [];
  const push = (value) => {
    if (value === undefined || value === null) return;
    if (value instanceof URLSearchParams) {
      const text = value.toString();
      if (text) sources.push(text);
      return;
    }
    if (typeof value === 'object') return;
    let text = String(value || '').trim();
    if (!text) return;
    if (text.startsWith('?')) text = text.slice(1);
    if (text.includes('?')) text = text.slice(text.indexOf('?') + 1);
    if (text) sources.push(text);
  };

  // Appwrite Node runtime pode variar entre query object, URLSearchParams,
  // query string pura, rawQueryString e path/url com query embutida.
  // A v21.9.188 ainda não cobria request.query como string/URLSearchParams;
  // em alguns deploys isso fazia o target sumir mesmo estando na URL.
  for (const key of ['query', 'params', 'queryString', 'rawQueryString', 'rawQuery', 'search']) {
    const value = request?.[key];
    if (typeof value === 'string' || value instanceof URLSearchParams) push(value);
  }

  for (const value of [request?.url, request?.path, request?.originalUrl, request?.href]) {
    if (typeof value === 'string') push(value);
  }

  // Alguns gateways colocam a URL original em cabeçalhos. Isso não substitui
  // req.query, mas evita perder querystring quando o runtime normaliza path/url.
  for (const headerName of ['x-original-uri', 'x-forwarded-uri', 'x-rewrite-url', 'x-appwrite-path']) {
    const value = headerValue(request, headerName);
    if (typeof value === 'string') push(value);
  }

  return sources;
}

function queryValue(request, name) {
  const wanted = String(name || '').toLowerCase();
  for (const query of [request?.query, request?.params]) {
    if (!query) continue;
    if (query instanceof URLSearchParams) {
      const value = query.get(name) || query.get(wanted);
      if (value != null) return value;
      continue;
    }
    if (typeof query === 'object') {
      const key = Object.keys(query).find((item) => String(item || '').toLowerCase() === wanted);
      const value = key ? query[key] : undefined;
      if (value != null) return Array.isArray(value) ? value[0] : value;
    }
  }

  for (const raw of queryStringSources(request)) {
    try {
      const params = new URLSearchParams(raw);
      const value = params.get(name) || params.get(wanted);
      if (value != null) return value;
    } catch {}
  }

  try {
    const rawUrl = request?.url || request?.path || '';
    const url = new URL(String(rawUrl || '/'), 'https://surveyor.local');
    return url.searchParams.get(name) || url.searchParams.get(wanted) || undefined;
  } catch {
    return undefined;
  }
}

function requestCookies(request) {
  const raw = String(headerValue(request, 'cookie') || '');
  const cookies = {};
  raw.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index <= 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) return;
    try { cookies[key] = decodeURIComponent(value); } catch { cookies[key] = value; }
  });
  return cookies;
}

const REFRESH_COOKIE_NAME = '__Secure-surveyor_refresh';
const LOGIN_VERIFY_COOKIE_NAME = '__Secure-surveyor_login_verify';
const FIRST_ACCESS_COOKIE_NAME = '__Secure-surveyor_first_access';
const PASSWORD_RESET_COOKIE_NAME = '__Secure-surveyor_password_reset';
const PASSWORD_RESET_AUTH_COOKIE_NAME = '__Secure-surveyor_password_reset_auth';

function secureAuthCookieHeader(name, token = '', { clear = false, maxAge = 600, path = '/api/auth', domainWide = false } = {}) {
  const ttl = clear ? 0 : Math.max(60, Math.min(24 * 60 * 60, Number(maxAge) || 600));
  const value = clear ? '' : encodeURIComponent(String(token || ''));
  const domain = domainWide ? ' Domain=.surveyorr.com.br;' : '';
  return `${String(name || '').trim()}=${value}; Path=${path};${domain} Max-Age=${ttl}; HttpOnly; Secure; SameSite=Strict`;
}

function refreshCookieHeader(token = '', { clear = false } = {}) {
  return secureAuthCookieHeader(REFRESH_COOKIE_NAME, token, { clear, maxAge: 14 * 24 * 60 * 60, path: '/api/auth', domainWide: true });
}

function refreshTokenFromRequest(request, input = {}) {
  return String(requestCookies(request)[REFRESH_COOKIE_NAME] || input.refreshToken || '').trim();
}

function transientAuthTokenFromRequest(request, input = {}, cookieName, inputKeys = []) {
  const cookieToken = String(requestCookies(request)[cookieName] || '').trim();
  if (cookieToken) return cookieToken;
  for (const key of inputKeys) {
    const value = String(input?.[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function transientAuthDelivery(request, token, { cookieName, cookieFlag, payloadKey, path, maxAge = 600 } = {}) {
  const origin = String(headerValue(request, 'origin') || '').trim();
  if (isOfficialWebOrigin(origin)) {
    return {
      payload: { [cookieFlag]: true },
      headers: { 'Set-Cookie': secureAuthCookieHeader(cookieName, token, { path, maxAge }) }
    };
  }
  return {
    payload: { [payloadKey]: token, [cookieFlag]: false },
    headers: {}
  };
}

function isOfficialWebOrigin(origin = '') {
  try {
    const parsed = new URL(String(origin || ''));
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'surveyorr.com.br' || host.endsWith('.surveyorr.com.br'));
  } catch { return false; }
}

function assertTrustedMutationOrigin(request) {
  const origin = String(headerValue(request, 'origin') || '').trim().replace(/\/+$/, '');
  if (!origin) return;
  if (configuredCorsOrigins().includes(origin) || isOfficialWebOrigin(origin) || isLocalDevelopmentOrigin(origin)) return;
  throw statusError(403, 'Origem não autorizada para esta operação.');
}

function refreshTokenResponse(request, token) {
  const origin = String(headerValue(request, 'origin') || '').trim();
  const cookieMode = isOfficialWebOrigin(origin);
  return {
    payload: cookieMode ? { refreshCookie: true } : { refreshToken: token, refreshCookie: false },
    headers: cookieMode ? { 'Set-Cookie': refreshCookieHeader(token) } : {}
  };
}

function bearerToken(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^Bearer\s+/i, '').trim();
}

function authTokenFromRequest(request) {
  const authorizationToken = bearerToken(headerValue(request, 'authorization'));
  if (authorizationToken) return authorizationToken;
  if (String(env('ALLOW_LEGACY_AUTH_HEADERS', 'false')).toLowerCase() === 'true') {
    return bearerToken(headerValue(request, 'x-surveyor-token'))
      || bearerToken(headerValue(request, 'x-auth-token'));
  }
  return '';
}

function maxJsonBodyBytes() {
  const configured = Number(env('MAX_JSON_BODY_BYTES', String(12 * 1024 * 1024)));
  return Number.isFinite(configured) ? Math.max(64 * 1024, Math.min(20 * 1024 * 1024, configured)) : 12 * 1024 * 1024;
}

async function bodyJson(request) {
  const contentType = String(headerValue(request, 'content-type') || '').toLowerCase();
  const hasDeclaredBody = request?.body != null || request?.bodyText != null || request?.bodyJson != null;
  if (hasDeclaredBody && contentType && !contentType.includes('application/json') && !contentType.includes('+json')) {
    throw statusError(415, 'Esta rota aceita somente conteúdo JSON.');
  }
  const direct = request.bodyJson && typeof request.bodyJson === 'object'
    ? request.bodyJson
    : (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body) ? request.body : null);
  if (direct) {
    const serialized = JSON.stringify(direct);
    if (Buffer.byteLength(serialized, 'utf8') > maxJsonBodyBytes()) throw statusError(413, 'A requisição JSON excede o limite permitido.');
    return direct;
  }
  const raw = request.bodyText || request.body || '';
  if (!raw) return {};
  if (typeof raw !== 'string') throw statusError(400, 'Corpo da requisição inválido.');
  if (Buffer.byteLength(raw, 'utf8') > maxJsonBodyBytes()) throw statusError(413, 'A requisição JSON excede o limite permitido.');
  try { return JSON.parse(raw); } catch { throw statusError(400, 'JSON inválido.'); }
}

function requestBodyBuffer(request) {
  const body = request?.bodyBinary ?? request?.bodyBuffer ?? request?.body;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (typeof body === 'string') return Buffer.from(body, 'binary');
  const text = request?.bodyText;
  if (typeof text === 'string') return Buffer.from(text, 'binary');
  return Buffer.alloc(0);
}

function layerMetadata(row = {}) {
  return safeJson(row.metadata, {});
}

function layerUploadState(row = {}) {
  const metadata = layerMetadata(row);
  const upload = metadata.sourceUpload && typeof metadata.sourceUpload === 'object' ? metadata.sourceUpload : null;
  return { metadata, upload };
}

async function patchLayerMetadata(layerId, current, metadataPatch = {}, directPatch = {}) {
  const metadata = { ...layerMetadata(current), ...metadataPatch };
  const row = await updateRow('layers', layerId, {
    ...directPatch,
    metadata: JSON.stringify(metadata),
    updatedAt: new Date().toISOString()
  });
  return row;
}

function geoservicesFunctionUrl() {
  return String(env('GEOSERVICES_FUNCTION_URL') || env('GEORURAL_GEOSERVICES_URL') || env('APPWRITE_GEOSERVICES_URL') || '').replace(/\/+$/, '');
}

function geoservicesInternalToken() {
  return env('GEOSERVICES_INTERNAL_TOKEN') || env('SURVEYOR_INTERNAL_TOKEN') || '';
}

async function callGeoservicesImport(payload) {
  const base = geoservicesFunctionUrl();
  if (!base) return { ok: false, skipped: true, message: 'GEOSERVICES_FUNCTION_URL não configurada; processamento ficou em fila.' };
  const internalToken = String(geoservicesInternalToken() || '').trim();
  if (internalToken.length < 24) {
    throw statusError(503, 'GEOSERVICES_INTERNAL_TOKEN não configurado com segurança. O processamento interno foi bloqueado.', { code: 'GEOSERVICES_INTERNAL_TOKEN_REQUIRED' });
  }
  const response = await fetch(`${base}/api/geoservices/import/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Surveyor-Internal-Token': internalToken
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { ok: response.ok, error: text }; }
  if (!response.ok) throw statusError(response.status, data?.error || data?.message || 'GeoServices recusou o processamento.', data);
  return data || { ok: true };
}

function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat) || 0));
  const x = Math.floor(((Number(lon) + 180) / 360) * n);
  const rad = clampedLat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)), z };
}

function tileRangeForBbox(bbox, z) {
  const [minLon, minLat, maxLon, maxLat] = bbox.map(Number);
  const nw = lonLatToTile(minLon, maxLat, z);
  const se = lonLatToTile(maxLon, minLat, z);
  return {
    minX: Math.min(nw.x, se.x), maxX: Math.max(nw.x, se.x),
    minY: Math.min(nw.y, se.y), maxY: Math.max(nw.y, se.y), z
  };
}

function bboxIntersects(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 4 || b.length < 4) return true;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function coordinatesBbox(coords, box = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (!Array.isArray(coords)) return box;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      box[0] = Math.min(box[0], lon); box[1] = Math.min(box[1], lat);
      box[2] = Math.max(box[2], lon); box[3] = Math.max(box[3], lat);
    }
    return box;
  }
  for (const item of coords) coordinatesBbox(item, box);
  return box;
}

function featureBbox(feature) {
  const box = coordinatesBbox(feature?.geometry?.coordinates);
  return box.every(Number.isFinite) ? box : null;
}

function sendText(res, request, status, text, contentType = 'text/plain; charset=utf-8', extraHeaders = {}) {
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin(request),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With, Cache-Control, Pragma, X-Share-Password, X-Request-ID, Idempotency-Key, If-Match, X-Expected-Updated-At',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Content-Type, X-Request-ID, Retry-After',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': contentType,
    ...baseSecurityHeaders(request),
    ...extraHeaders
  };
  return res.send(String(text || ''), status, headers);
}

async function sendTiledLayerViewport(response, request, row, layerId, bbox, zoom) {
  const metadata = layerMetadata(row);
  const manifestFileId = metadata.tileManifestFileId || row.dataFileId;
  if (!manifestFileId) throw statusError(404, 'Manifesto de blocos da camada não encontrado.');
  const manifestText = await readFileText(row.dataBucketId || bucketId('project_files'), manifestFileId);
  const manifest = safeJson(manifestText, null);
  if (!manifest || !Array.isArray(manifest.tiles)) throw statusError(500, 'Manifesto de blocos inválido. Reprocesse a camada.');
  const z = Number(manifest.tileZoom || metadata.tileZoom || 12);
  const queryBbox = bbox.map(Number);
  const range = tileRangeForBbox(queryBbox, z);
  const wanted = new Set();
  for (let x = range.minX; x <= range.maxX; x += 1) {
    for (let y = range.minY; y <= range.maxY; y += 1) wanted.add(`${z}/${x}/${y}`);
  }
  const selectedTiles = manifest.tiles.filter((tile) => wanted.has(`${tile.z}/${tile.x}/${tile.y}`) || bboxIntersects(tile.bbox, queryBbox));
  const maxTiles = Number(env('LAYER_VIEWPORT_MAX_TILES', '160')) || 160;
  const maxFeatures = Number(env('LAYER_VIEWPORT_MAX_FEATURES', '12000')) || 12000;
  if (selectedTiles.length > maxTiles) {
    const requiresZoom = Math.min(22, Math.max(Number(zoom || 0) + 1, Number(metadata.minViewportZoom || 10)));
    const lines = [
      JSON.stringify({ type: 'meta', storage: 'tiled-geojson', featureCount: manifest.featureCount || row.featureCount || 0, tileCount: manifest.tiles.length, selectedTiles: selectedTiles.length }),
      JSON.stringify({ type: 'summary', requiresZoom, matched: 0, scanned: 0, message: `Muitos blocos nessa área (${selectedTiles.length}). Aproxime o mapa para carregar com segurança.` })
    ];
    return sendText(response, request, 200, `${lines.join('\n')}\n`, 'application/x-ndjson; charset=utf-8');
  }
  const lines = [JSON.stringify({ type: 'meta', storage: 'tiled-geojson', featureCount: manifest.featureCount || row.featureCount || 0, tileCount: manifest.tiles.length, selectedTiles: selectedTiles.length })];
  let scanned = 0;
  let matched = 0;
  let batch = [];
  const pushBatch = () => {
    if (!batch.length) return;
    lines.push(JSON.stringify({ type: 'batch', features: batch, received: matched, total: manifest.featureCount || row.featureCount || 0 }));
    batch = [];
  };
  for (const tile of selectedTiles) {
    const tileText = await readFileText(tile.bucketId || row.dataBucketId || bucketId('project_files'), tile.fileId);
    const collection = safeJson(tileText, { type: 'FeatureCollection', features: [] });
    for (const feature of collection.features || []) {
      scanned += 1;
      const fb = featureBbox(feature);
      if (fb && !bboxIntersects(fb, queryBbox)) continue;
      batch.push(feature);
      matched += 1;
      if (batch.length >= 250) pushBatch();
      if (matched >= maxFeatures) break;
    }
    if (matched >= maxFeatures) break;
  }
  pushBatch();
  lines.push(JSON.stringify({
    type: 'summary',
    scanned,
    matched,
    total: manifest.featureCount || row.featureCount || 0,
    percent: 100,
    message: matched >= maxFeatures
      ? `${matched.toLocaleString('pt-BR')} elementos exibidos. Aproxime mais para refinar a área.`
      : `${matched.toLocaleString('pt-BR')} elemento(s) visíveis carregados de ${selectedTiles.length.toLocaleString('pt-BR')} bloco(s).`
  }));
  return sendText(response, request, 200, `${lines.join('\n')}\n`, 'application/x-ndjson; charset=utf-8', { 'Cache-Control': 'public, max-age=120' });
}

async function sendTiledLayerFull(response, request, row, layerId) {
  const metadata = layerMetadata(row);
  const manifestFileId = metadata.tileManifestFileId || row.dataFileId;
  const manifest = safeJson(await readFileText(row.dataBucketId || bucketId('project_files'), manifestFileId), null);
  if (!manifest || !Array.isArray(manifest.tiles)) throw statusError(500, 'Manifesto de blocos inválido.');
  const maxTiles = Number(env('LAYER_FULL_MAX_TILES', '80')) || 80;
  if (manifest.tiles.length > maxTiles) {
    return sendText(response, request, 200, [
      JSON.stringify({ type: 'meta', storage: 'tiled-geojson', featureCount: manifest.featureCount || row.featureCount || 0, tileCount: manifest.tiles.length }),
      JSON.stringify({ type: 'summary', requiresZoom: Number(metadata.minViewportZoom || 10), matched: 0, scanned: 0, message: 'Camada grande em blocos. Use o mapa aproximado para carregar somente a área visível.' })
    ].join('\n') + '\n', 'application/x-ndjson; charset=utf-8');
  }
  const lines = [JSON.stringify({ type: 'meta', storage: 'tiled-geojson', featureCount: manifest.featureCount || row.featureCount || 0, tileCount: manifest.tiles.length })];
  let sent = 0;
  for (const tile of manifest.tiles) {
    const collection = safeJson(await readFileText(tile.bucketId || row.dataBucketId || bucketId('project_files'), tile.fileId), { features: [] });
    const features = collection.features || [];
    if (features.length) {
      sent += features.length;
      lines.push(JSON.stringify({ type: 'batch', features, received: sent, total: manifest.featureCount || row.featureCount || 0 }));
    }
  }
  lines.push(JSON.stringify({ type: 'summary', matched: sent, scanned: sent, message: `${sent.toLocaleString('pt-BR')} elemento(s) carregados.` }));
  return sendText(response, request, 200, `${lines.join('\n')}\n`, 'application/x-ndjson; charset=utf-8');
}

function configuredCorsOrigins() {
  const defaults = [
    'https://surveyorr.com.br',
    'https://www.surveyorr.com.br',
    'https://admin.surveyorr.com.br',
    'https://loja.surveyorr.com.br',
    'https://pagamento.surveyorr.com.br'
  ];
  if (String(env('ENABLE_LEGACY_CORS_ORIGINS', 'false')).toLowerCase() === 'true') {
    defaults.push('https://surveyoragrimensura.tech', 'https://www.surveyoragrimensura.tech', 'https://admin.surveyoragrimensura.tech');
  }
  const configured = String(env('CORS_ORIGINS', env('CORS_ORIGIN', '')))
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter((item) => item && item !== '*');
  return [...new Set([...defaults, ...configured])];
}

function isLocalDevelopmentOrigin(origin) {
  try {
    const parsed = new URL(String(origin || ''));
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
    if (!isLoopback) return false;

    // O frontend oficial é testado rotineiramente pelo Live Server na porta 5500.
    // Mantemos esse origin de desenvolvimento explicitamente permitido mesmo em
    // uma Function de produção. Para outras portas, continua sendo necessário
    // ALLOW_LOCAL_DEV_ORIGINS=true.
    if (parsed.port === '5500') return true;
    return String(env('ALLOW_LOCAL_DEV_ORIGINS', 'false')).toLowerCase() === 'true';
  } catch {
    return false;
  }
}

function corsOrigin(request) {
  const allowed = configuredCorsOrigins();
  const origin = String(headerValue(request, 'origin') || '').trim().replace(/\/+$/, '');
  if (!origin) return '';
  if (allowed.includes(origin) || isOfficialWebOrigin(origin) || isLocalDevelopmentOrigin(origin)) return origin;
  return '';
}

const requestIdCache = new WeakMap();
function responseRequestId(request) {
  if (request && typeof request === 'object' && requestIdCache.has(request)) return requestIdCache.get(request);
  const incoming = String(headerValue(request, 'x-request-id') || '').trim();
  const value = /^[a-z0-9._:-]{8,120}$/i.test(incoming) ? incoming : appwriteId();
  if (request && typeof request === 'object') requestIdCache.set(request, value);
  return value;
}

function sensitiveApiNoStoreHeaders(request) {
  const raw = String(request?.path || request?.url || '');
  let path = raw;
  try { if (/^https?:/i.test(raw)) path = new URL(raw).pathname; } catch {}
  if (/^\/api\/(?:auth|admin|workspace|projects|documents|customization|integrations\/google-drive)(?:\/|$)/i.test(path)) {
    return { 'Cache-Control': 'no-store, max-age=0, must-revalidate', 'Pragma': 'no-cache' };
  }
  return {};
}

function baseSecurityHeaders(request) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Request-ID': responseRequestId(request)
  };
}

function send(res, request, status, payload, extraHeaders = {}) {
  const allowedCorsOrigin = corsOrigin(request);
  const headers = {
    ...(allowedCorsOrigin ? { 'Access-Control-Allow-Origin': allowedCorsOrigin } : {}),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With, Cache-Control, Pragma, X-Share-Password, X-Request-ID, Idempotency-Key, If-Match, X-Expected-Updated-At',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Content-Type, X-Request-ID, Retry-After',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    ...baseSecurityHeaders(request),
    ...sensitiveApiNoStoreHeaders(request),
    ...extraHeaders
  };
  if (status === 204) return res.send('', status, headers);
  return res.json(payload, status, headers);
}

function mapProject(row = {}) {
  const metadata = safeJson(row.metadata, {});
  return {
    id: row.$id || row.id,
    ownerUserId: row.userId,
    name: row.name || 'Projeto sem nome',
    propertyName: row.propertyName || '',
    ownerName: row.ownerName || '',
    createdByUserId: metadata.createdByUserId || '',
    createdByName: metadata.createdByName || '',
    lastSavedByUserId: metadata.lastSavedByUserId || metadata.updatedByUserId || '',
    lastSavedByName: metadata.lastSavedByName || metadata.updatedByName || '',
    lastSavedAt: metadata.lastSavedAt || null,
    municipality: row.city || metadata.municipality || '',
    stateCode: row.uf || metadata.stateCode || '',
    status: row.status || 'draft',
    areaHa: Number(row.areaHa || metadata.areaHa || metadata.areaHectares || 0) || 0,
    perimeterM: Number(row.perimeterM || metadata.perimeterM || metadata.perimeterMeters || 0) || 0,
    metadata: {
      ...metadata,
      folderId: row.folderId || metadata.folderId || '',
      folderName: row.folderName || metadata.folderName || '',
      geojsonFileId: row.geojsonFileId || metadata.geojsonFileId || ''
    },
    createdAt: row.createdAt || row.$createdAt || null,
    updatedAt: row.updatedAt || row.$updatedAt || null,
    revision: String(row.updatedAt || row.$updatedAt || '')
  };
}

function mapStoredProject(row = {}, payload = {}) {
  const base = mapProject(row);
  const storedProject = payload?.project && typeof payload.project === 'object' ? payload.project : {};
  const storedMetadata = {
    ...(payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    ...(storedProject?.metadata && typeof storedProject.metadata === 'object' ? storedProject.metadata : {})
  };
  const creatorId = String(storedMetadata.createdByUserId || storedMetadata.migratedFromStandaloneUserId || base.createdByUserId || base.ownerUserId || '').trim();
  const creatorName = String(storedMetadata.createdByName || base.createdByName || '').trim();
  const lastSavedByUserId = String(storedMetadata.lastSavedByUserId || storedMetadata.updatedByUserId || base.lastSavedByUserId || '').trim();
  const lastSavedByName = String(storedMetadata.lastSavedByName || storedMetadata.updatedByName || base.lastSavedByName || '').trim();
  return {
    ...base,
    name: storedProject.name || base.name,
    propertyName: storedProject.propertyName || base.propertyName,
    ownerName: storedProject.ownerName || base.ownerName,
    createdByUserId: creatorId,
    createdByName: creatorName,
    lastSavedByUserId,
    lastSavedByName,
    lastSavedAt: storedMetadata.lastSavedAt || base.lastSavedAt || null,
    municipality: storedProject.municipality || storedProject.city || base.municipality,
    stateCode: storedProject.stateCode || storedProject.uf || base.stateCode,
    registrationNumber: storedProject.registrationNumber || '',
    description: storedProject.description || '',
    centerLatitude: storedProject.centerLatitude ?? null,
    centerLongitude: storedProject.centerLongitude ?? null,
    defaultZoom: storedProject.defaultZoom ?? null,
    areaHa: Number(base.areaHa || storedMetadata.areaHa || storedMetadata.areaHectares || 0) || 0,
    perimeterM: Number(base.perimeterM || storedMetadata.perimeterM || storedMetadata.perimeterMeters || 0) || 0,
    metadata: {
      ...storedMetadata,
      ...base.metadata,
      featureCount: Array.isArray(payload?.features) ? payload.features.length : Number(storedMetadata.featureCount || 0)
    }
  };
}

function safeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}


async function serializeDocumentCustomization(row = {}) {
  const opts = customizationOptions(row || {});
  const nestedDocumentOptions = opts.documentOptions && typeof opts.documentOptions === 'object' ? opts.documentOptions : (opts.options && typeof opts.options === 'object' ? opts.options : {});
  const documentOptions = { ...opts, ...nestedDocumentOptions };
  delete documentOptions.documentIdentity;
  delete documentOptions.documentOptions;
  delete documentOptions.identity;
  const documentIdentity = opts.documentIdentity && typeof opts.documentIdentity === 'object' ? opts.documentIdentity : (opts.identity && typeof opts.identity === 'object' ? opts.identity : {});
  let logoDataUrl = String(opts.logoDataUrl || opts.documentLogoDataUrl || '');
  if (!logoDataUrl && row?.logoFileId) logoDataUrl = await readFileText(bucketId('user_assets'), row.logoFileId).catch(() => '');
  if (!logoDataUrl && row?.LogoDataUrl) logoDataUrl = String(row.LogoDataUrl || '');
  let baseTemplateContent = String(opts.baseTemplateContent || '');
  if (!baseTemplateContent && opts.baseTemplateFileId) baseTemplateContent = await readFileText(bucketId('user_assets'), opts.baseTemplateFileId).catch(() => '');
  let planDocumentSignatureDataUrl = String(opts.planDocumentSignatureDataUrl || '');
  if (!planDocumentSignatureDataUrl && opts.planDocumentSignatureFileId) planDocumentSignatureDataUrl = await readFileText(bucketId('user_assets'), opts.planDocumentSignatureFileId).catch(() => '');
  return {
    companyName: documentIdentity.companyName || row?.companyName || row?.CompanyName || '',
    addressText: documentIdentity.addressText || row?.address || row?.addressText || row?.AddressText || '',
    responsibleTechnician: documentIdentity.responsibleTechnician || row?.responsibleTechnician || row?.ResponsibleTechnician || '',
    professionalRegistry: documentIdentity.professionalRegistry || row?.crea || row?.professionalRegistry || row?.ProfessionalRegistry || '',
    footerText: documentIdentity.footerText || row?.footerText || row?.FooterText || '',
    websiteUrl: safeHttpUrl(documentIdentity.websiteUrl || row?.site || row?.websiteUrl || row?.WebsiteUrl || '') || '',
    phoneNumber: documentIdentity.phoneNumber || row?.phone || '',
    whatsappNumber: documentIdentity.whatsappNumber || '',
    emailAddress: documentIdentity.emailAddress || row?.email || '',
    addressNumber: documentIdentity.addressNumber || '',
    professionalTitle: documentIdentity.professionalTitle || '',
    logoDataUrl,
    baseTemplateName: documentIdentity.baseTemplateName || opts.baseTemplateName || row?.baseTemplateName || row?.BaseTemplateName || '',
    baseTemplateContent,
    planDocumentSignatureDataUrl,
    options: documentOptions || {},
    updatedAt: row?.updatedAt || row?.$updatedAt || row?.UpdatedAt || null
  };
}

async function saveCustomizationRow(current, data) {
  const currentId = current?.$id || current?.id || current?.rowId || '';
  try {
    return currentId ? await updateRow('customization', currentId, data) : await createRow('customization', data);
  } catch (error) {
    const text = `${error?.message || ''} ${JSON.stringify(error?.details || {})}`;
    if (!/Invalid document structure|Unknown attribute|not found in schema|Attribute.*has invalid/i.test(text)) throw error;
    const minimal = {
      userId: data.userId,
      options: data.options,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
    return currentId ? await updateRow('customization', currentId, minimal) : await createRow('customization', minimal);
  }
}

async function saveDocumentCustomizationForUser(userId, input = {}) {
  if (!userId) throw statusError(401, 'Sessão não encontrada.');
  const now = new Date().toISOString();
  const rows = await findCustomizationRowsForUser(userId);
  const current = rows[0] || null;
  const currentOptions = customizationOptions(current || {});
  const identity = normalizeDocumentIdentity(input, currentOptions);
  const stagedAssetFiles = [];
  const previousAssetFiles = [];

  let logoFileId = current?.logoFileId || '';
  let logoDataUrlForOptions = String(currentOptions.logoDataUrl || currentOptions.documentLogoDataUrl || '');
  if (Object.prototype.hasOwnProperty.call(input, 'logoDataUrl')) {
    const previousLogoFileId = String(logoFileId || '');
    logoFileId = '';
    const logoDataUrl = assertCustomizationImageDataUrl(input.logoDataUrl, {
      label: 'O logotipo',
      maxBytes: Math.max(128 * 1024, Number(env('CUSTOMIZATION_LOGO_MAX_BYTES', String(1536 * 1024))) || (1536 * 1024))
    });
    logoDataUrlForOptions = '';
    if (logoDataUrl) {
      try {
        const file = await createFile(bucketId('user_assets'), `logo-${userId}.txt`, logoDataUrl, 'text/plain', appwriteId());
        logoFileId = file.$id || file.id;
        stagedAssetFiles.push(logoFileId);
      } catch (error) {
        // Contingência: se o Storage falhar, ainda preserva o logotipo no JSON de opções.
        logoDataUrlForOptions = logoDataUrl;
      }
    }
    if (previousLogoFileId && previousLogoFileId !== logoFileId) previousAssetFiles.push(previousLogoFileId);
  }

  let baseTemplateFileId = currentOptions.baseTemplateFileId || '';
  let baseTemplateContentForOptions = String(currentOptions.baseTemplateContent || '');
  if (Object.prototype.hasOwnProperty.call(input, 'baseTemplateContent')) {
    const previousBaseTemplateFileId = String(baseTemplateFileId || '');
    baseTemplateFileId = '';
    const baseTemplateContent = assertCustomizationTextSize(input.baseTemplateContent, { label: 'O modelo base', maxChars: Math.max(100000, Number(env('CUSTOMIZATION_TEMPLATE_MAX_CHARS', String(8 * 1024 * 1024))) || (8 * 1024 * 1024)) });
    baseTemplateContentForOptions = '';
    if (baseTemplateContent) {
      try {
        const file = await createFile(bucketId('user_assets'), `modelo-base-${userId}.txt`, baseTemplateContent, 'text/plain', appwriteId());
        baseTemplateFileId = file.$id || file.id;
        stagedAssetFiles.push(baseTemplateFileId);
      } catch {
        baseTemplateContentForOptions = baseTemplateContent;
      }
    }
    if (previousBaseTemplateFileId && previousBaseTemplateFileId !== baseTemplateFileId) previousAssetFiles.push(previousBaseTemplateFileId);
  }

  let planDocumentSignatureFileId = currentOptions.planDocumentSignatureFileId || '';
  let planDocumentSignatureDataUrlForOptions = String(currentOptions.planDocumentSignatureDataUrl || '');
  if (Object.prototype.hasOwnProperty.call(input, 'planDocumentSignatureDataUrl')) {
    const previousSignatureFileId = String(planDocumentSignatureFileId || '');
    planDocumentSignatureFileId = '';
    const signatureDataUrl = assertCustomizationImageDataUrl(input.planDocumentSignatureDataUrl, {
      label: 'A assinatura',
      maxBytes: Math.max(128 * 1024, Number(env('CUSTOMIZATION_SIGNATURE_MAX_BYTES', String(2 * 1024 * 1024))) || (2 * 1024 * 1024))
    });
    planDocumentSignatureDataUrlForOptions = '';
    if (signatureDataUrl) {
      try {
        const file = await createFile(bucketId('user_assets'), `assinatura-administrativa-${userId}.txt`, signatureDataUrl, 'text/plain', appwriteId());
        planDocumentSignatureFileId = file.$id || file.id;
        stagedAssetFiles.push(planDocumentSignatureFileId);
      } catch {
        planDocumentSignatureDataUrlForOptions = signatureDataUrl;
      }
    }
    if (previousSignatureFileId && previousSignatureFileId !== planDocumentSignatureFileId) previousAssetFiles.push(previousSignatureFileId);
  }

  const incomingDocumentOptions = input.options && typeof input.options === 'object' ? input.options : {};
  const previousDocumentOptions = currentOptions.documentOptions && typeof currentOptions.documentOptions === 'object' ? currentOptions.documentOptions : {};
  const mergedDocumentOptions = { ...previousDocumentOptions, ...incomingDocumentOptions };
  const savedMemorialTemplateId = String(mergedDocumentOptions.memorialTemplateId || currentOptions.memorialTemplateId || 'standard');
  mergedDocumentOptions.memorialTemplateId = savedMemorialTemplateId;
  mergedDocumentOptions.memorialTemplateMode = savedMemorialTemplateId === 'standard' ? 'standard' : 'custom';
  mergedDocumentOptions.memorialTemplateUpdatedAt = String(mergedDocumentOptions.memorialTemplateUpdatedAt || new Date().toISOString());
  const options = {
    ...currentOptions,
    memorialTemplateId: savedMemorialTemplateId,
    memorialTemplateMode: mergedDocumentOptions.memorialTemplateMode,
    memorialTemplateUpdatedAt: mergedDocumentOptions.memorialTemplateUpdatedAt,
    documentIdentity: identity,
    documentOptions: mergedDocumentOptions,
    baseTemplateName: identity.baseTemplateName,
    baseTemplateFileId,
    logoDataUrl: logoDataUrlForOptions,
    documentLogoDataUrl: logoDataUrlForOptions,
    baseTemplateContent: baseTemplateContentForOptions,
    planDocumentSignatureFileId,
    planDocumentSignatureDataUrl: planDocumentSignatureDataUrlForOptions,
    documentCustomizationUpdatedAt: now
  };
  const data = {
    userId,
    companyName: identity.companyName,
    logoFileId,
    address: identity.addressText,
    phone: current?.phone || '',
    email: current?.email || '',
    crea: identity.professionalRegistry,
    site: identity.websiteUrl,
    footerText: identity.footerText,
    options: JSON.stringify(options),
    createdAt: current?.createdAt || now,
    updatedAt: now
  };
  let saved;
  try {
    saved = await saveCustomizationRow(current, data);
  } catch (error) {
    for (const fileId of stagedAssetFiles) await deleteFile(bucketId('user_assets'), fileId).catch(() => null);
    throw error;
  }
  const keepId = saved?.$id || saved?.id || current?.$id || current?.id || '';
  const cleanupTask = Promise.allSettled([
    ...[...new Set(previousAssetFiles)].map((fileId) => deleteFile(bucketId('user_assets'), fileId)),
    cleanupDuplicateCustomizationRows(userId, keepId, rows)
  ]).then((results) => {
    results.forEach((result) => {
      if (result.status === 'rejected') console.warn('[customization] limpeza pendente:', result.reason?.message || result.reason);
    });
  });
  // A limpeza não segura o botão de salvar. Damos apenas uma pequena janela para
  // concluir rapidamente quando o Storage já respondeu.
  await Promise.race([cleanupTask, new Promise((resolve) => setTimeout(resolve, 120))]);

  // Resposta rápida: não lê novamente do Storage os arquivos que acabaram de ser
  // enviados. O GET posterior continua capaz de reconstruir logo e assinatura.
  return {
    ...identity,
    logoDataUrl: Object.prototype.hasOwnProperty.call(input, 'logoDataUrl')
      ? String(input.logoDataUrl || '')
      : String(currentOptions.logoDataUrl || currentOptions.documentLogoDataUrl || ''),
    baseTemplateName: identity.baseTemplateName,
    baseTemplateContent: Object.prototype.hasOwnProperty.call(input, 'baseTemplateContent')
      ? String(input.baseTemplateContent || '')
      : String(currentOptions.baseTemplateContent || ''),
    planDocumentSignatureDataUrl: Object.prototype.hasOwnProperty.call(input, 'planDocumentSignatureDataUrl')
      ? String(input.planDocumentSignatureDataUrl || '')
      : String(currentOptions.planDocumentSignatureDataUrl || ''),
    options: mergedDocumentOptions,
    updatedAt: now
  };
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''), 'utf8')).digest('hex');
}

function projectVersionRetention() {
  const value = Number(env('PROJECT_VERSION_RETENTION', '20'));
  return Number.isFinite(value) ? Math.max(3, Math.min(50, Math.trunc(value))) : 20;
}

async function stageProjectVersionSnapshot(row, payload, type = 'autosave', auth = null) {
  const projectIdValue = String(row?.$id || row?.id || '').trim();
  if (!projectIdValue) throw statusError(500, 'Projeto sem identificador para versionamento.');
  const content = encryptJsonText(payload || {}, { aad: 'project-payload' });
  const bytes = Buffer.byteLength(content, 'utf8');
  if (auth) await assertStorageCapacity(auth, bytes, 0, { resourceStorageOwnerUserId: resourceOwnerId(auth) });
  const fileId = appwriteId();
  const bucket = bucketId('project_files');
  await createFile(bucket, `version-${projectIdValue}-${fileId}.json`, content, 'application/json', fileId);
  const verification = await readFileText(bucket, fileId).catch(() => '');
  if (verification !== content) {
    await deleteFile(bucket, fileId).catch(() => null);
    throw statusError(502, 'Não foi possível verificar a cópia de segurança da versão anterior. O salvamento foi cancelado.', { code: 'PROJECT_VERSION_VERIFICATION_FAILED' });
  }
  const metadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const existing = Array.isArray(metadata.versions) ? metadata.versions : [];
  return {
    id: appwriteId(),
    label: `v${existing.length + 1}.0`,
    createdAt: new Date().toISOString(),
    type: String(type || 'autosave').slice(0, 40),
    featureCount: Array.isArray(payload?.features) ? payload.features.length : 0,
    fileId,
    bucketId: bucket,
    checksum: sha256Hex(content),
    sizeBytes: bytes,
    format: 'full-project-snapshot-v1'
  };
}

async function readProjectVersionSnapshot(version = {}) {
  if (version.fileId) {
    const bucket = String(version.bucketId || bucketId('project_files'));
    const content = await readFileText(bucket, version.fileId);
    if (!content) throw statusError(410, 'O arquivo desta versão não está mais disponível.');
    if (version.checksum && sha256Hex(content) !== String(version.checksum)) throw statusError(409, 'A integridade desta versão não pôde ser confirmada.', { code: 'PROJECT_VERSION_CHECKSUM_MISMATCH' });
    const payload = decryptJsonText(content, { aad: 'project-payload' });
    if (!payload || typeof payload !== 'object') throw statusError(409, 'A versão armazenada está corrompida.');
    return payload;
  }
  return {
    project: version.project || {},
    features: Array.isArray(version.features) ? version.features : [],
    metadata: version.metadata || {}
  };
}

async function cleanupProjectVersionFiles(versions = []) {
  for (const version of versions) {
    if (!version?.fileId) continue;
    await deleteFile(version.bucketId || bucketId('project_files'), version.fileId).catch((error) => console.warn('[storage] versão antiga pendente de limpeza:', error?.message || error));
  }
}

async function readProjectPayload(row) {
  const text = await readFileText(bucketId('project_files'), row.geojsonFileId);
  if (!text) return { features: [], metadata: {} };
  try {
    const value = decryptJsonText(text, { aad: 'project-payload' });
    return value && typeof value === 'object' ? value : { features: [], metadata: {} };
  } catch (error) {
    if (error?.code?.startsWith('CRYPTO_')) throw error;
    return { features: [], metadata: {} };
  }
}

function planLimitNumber(auth = {}, key = '') {
  if (String(auth?.user?.role || '').toLowerCase() === 'admin') return null;
  const raw = auth?.user?.planLimits?.[key];
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  // Quotas legadas podem chegar como 0 quando o campo estava vazio/não migrado.
  // Zero não pode bloquear todo o produto: limite real só existe quando é positivo.
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function activeProjectCountForUser(userId) {
  const rows = await listAllRows('projects', [Query.equal('userId', userId)]);
  return rows.filter((row) => String(row.status || '').toLowerCase() !== 'deleted').length;
}

async function assertProjectCapacity(auth = {}, additionalProjects = 1) {
  const limit = planLimitNumber(auth, 'projectLimit');
  if (limit == null) return;
  const used = await activeProjectCountForUser(resourceOwnerId(auth));
  if (used + Math.max(0, Number(additionalProjects) || 0) > limit) {
    throw statusError(403, `Limite de ${limit} projetos ativos atingido para o plano ${auth?.user?.planName || ''}.`, {
      code: 'PROJECT_LIMIT_REACHED', limit, used, remaining: Math.max(0, limit - used)
    });
  }
}

function storedDocumentBytes(row = {}) {
  const metadata = safeJson(row.metadata, {});
  if (row.bucketId === 'google_drive' || row.storageProvider === 'google_drive' || metadata.storageProvider === 'google_drive') return 0;
  return Math.max(0, Number(row.sizeBytes || metadata.sizeBytes || 0) || 0);
}

const projectFileSizeCache = new Map();

async function storedProjectBytes(row = {}) {
  const fileId = String(row.geojsonFileId || '').trim();
  if (!fileId) return Math.max(0, Number(row.sizeBytes || 0) || 0);
  // Em projetos existentes, sizeBytes da linha pode ser da versão anterior.
  // O arquivo do Storage é a fonte da quota para este identificador.
  const cacheKey = `${bucketId('project_files')}:${fileId}`;
  const cached = projectFileSizeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 2 * 60 * 1000) return cached.bytes;
  try {
    const file = await awFetch(`/storage/buckets/${encodeURIComponent(bucketId('project_files'))}/files/${encodeURIComponent(fileId)}`);
    const rawBytes = Number(file?.sizeOriginal ?? file?.size);
    if (!Number.isFinite(rawBytes) || rawBytes < 0) throw new Error('Tamanho do arquivo não foi informado pelo Storage.');
    const bytes=Math.max(0,rawBytes);
    projectFileSizeCache.set(cacheKey, { bytes, at: Date.now() });
    if (projectFileSizeCache.size > 1000) {
      [...projectFileSizeCache.entries()].sort((a,b)=>b[1].at-a[1].at).slice(1000).forEach(([key])=>projectFileSizeCache.delete(key));
    }
    return bytes;
  } catch (error) {
    // Para quotas, ausência temporária do Storage jamais equivale a 0 bytes.
    throw statusError(503, 'Não foi possível confirmar o espaço usado no Storage. Tente novamente.', {code:'STORAGE_USAGE_UNAVAILABLE'});
  }
}

async function logicalStorageUsageBytesForUser(userId) {
  const [projects, documents] = await Promise.all([
    listAllRows('projects', [Query.equal('userId', userId)]),
    listAllRows('documents', [Query.equal('userId', userId)])
  ]);
  const active=projects.filter((row)=>String(row.status||'').toLowerCase()!=='deleted' && row.geojsonFileId);
  // Consultar metadados do Storage (em vez de baixar o conteúdo de cada projeto).
  // Lotes limitados evitam saturar Appwrite quando há centenas de imóveis.
  let projectBytes=0;
  for(let i=0;i<active.length;i+=6){
    const sizes=await Promise.all(active.slice(i,i+6).map((row)=>storedProjectBytes(row)));
    projectBytes+=sizes.reduce((sum,bytes)=>sum+bytes,0);
  }
  const documentBytes = documents.reduce((sum, row) => sum + storedDocumentBytes(row), 0);
  return { projectBytes, documentBytes, totalBytes: projectBytes + documentBytes };
}

function storageOwnerFromMetadata(metadata = {}, fallback = '') {
  return String(metadata.storageOwnerUserId || metadata.createdByUserId || fallback || '').trim();
}

async function logicalStorageUsageBytesForMember(ownerUserId, memberUserId) {
  const ownerId = String(ownerUserId || '').trim();
  const memberId = String(memberUserId || '').trim();
  if (!ownerId || !memberId) return { projectBytes: 0, documentBytes: 0, totalBytes: 0 };
  const [projects, documents] = await Promise.all([
    listAllRows('projects', [Query.equal('userId', ownerId)]),
    listAllRows('documents', [Query.equal('userId', ownerId)])
  ]);
  let projectBytes = 0;
  for (const row of projects) {
    if (String(row.status || '').toLowerCase() === 'deleted' || !row.geojsonFileId) continue;
    const content = await readFileText(bucketId('project_files'), row.geojsonFileId);
    if (!content) throw statusError(503, 'Não foi possível confirmar o armazenamento de um membro.', {code:'STORAGE_USAGE_UNAVAILABLE'});
    let payload;
    try { payload=decryptJsonText(content,{aad:'project-payload'}); }
    catch (_error) { throw statusError(503, 'Não foi possível verificar o proprietário de um arquivo armazenado.', {code:'STORAGE_USAGE_UNAVAILABLE'}); }
    const metadata = payload?.metadata && typeof payload.metadata === 'object'
      ? payload.metadata
      : (payload?.project?.metadata && typeof payload.project.metadata === 'object' ? payload.project.metadata : {});
    if (storageOwnerFromMetadata(metadata, ownerId) === memberId) projectBytes += await storedProjectBytes(row);
  }
  const documentBytes = documents.reduce((sum, row) => {
    const metadata = safeJson(row.metadata, {});
    return storageOwnerFromMetadata(metadata, ownerId) === memberId ? sum + storedDocumentBytes(row) : sum;
  }, 0);
  return { projectBytes, documentBytes, totalBytes: projectBytes + documentBytes };
}

const dailyUsageLocks = new Map();
async function withDailyUsageLock(ownerId, fn) {
  const key = String(ownerId || 'unknown');
  const previous = dailyUsageLocks.get(key) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const tail = previous.then(() => gate);
  dailyUsageLocks.set(key, tail);
  await previous;
  try { return await fn(); }
  finally {
    release();
    // O Map guarda o tail, não a Promise gate. Sem comparar o mesmo objeto,
    // entradas antigas se acumulavam permanentemente.
    if (dailyUsageLocks.get(key) === tail) dailyUsageLocks.delete(key);
  }
}
async function dailyUsageStatus(auth = {}) {
  const ownerId = resourceOwnerId(auth);
  const user = await getAppwriteUserById(ownerId).catch(() => null);
  const { surveyor } = userPrefs(user || {});
  const day = commercialDayKey();
  const raw = surveyor.dailyUsage && typeof surveyor.dailyUsage === 'object' ? surveyor.dailyUsage : {};
  const usage = raw.day === day ? raw : { day, downloads: 0, exports: 0 };
  return {
    day,
    downloads: Number(usage.downloads || 0),
    exports: Number(usage.exports || 0),
    downloadLimit: auth?.user?.planLimits?.downloadDailyLimit ?? null,
    exportLimit: auth?.user?.planLimits?.exportDailyLimit ?? null
  };
}
async function consumeDailyUsage(auth = {}, kind = 'download', amount = 1, metadata = {}) {
  if (String(auth?.user?.role || '').toLowerCase() === 'admin') return dailyUsageStatus(auth);
  const normalizedKind = kind === 'export' ? 'export' : 'download';
  const ownerId = resourceOwnerId(auth);
  return withDailyUsageLock(ownerId, async () => {
    const user = await getAppwriteUserById(ownerId).catch(() => null);
    if (!user) throw statusError(404, 'Conta principal não encontrada para contabilizar a franquia.');
    const { surveyor } = userPrefs(user);
    const day = commercialDayKey();
    const previous = surveyor.dailyUsage && surveyor.dailyUsage.day === day ? surveyor.dailyUsage : { day, downloads: 0, exports: 0 };
    const limit = normalizedKind === 'export' ? auth?.user?.planLimits?.exportDailyLimit : auth?.user?.planLimits?.downloadDailyLimit;
    const current = normalizedKind === 'export' ? Number(previous.exports || 0) : Number(previous.downloads || 0);
    const increment = Math.max(1, Math.min(20, Number(amount) || 1));
    if (limit != null && current + increment > Number(limit)) {
      throw statusError(429, `Limite diário de ${normalizedKind === 'export' ? 'exportações' : 'downloads'} atingido para o seu plano.`, {
        code: normalizedKind === 'export' ? 'EXPORT_DAILY_LIMIT_REACHED' : 'DOWNLOAD_DAILY_LIMIT_REACHED',
        used: current, limit: Number(limit), day, storeUrl: SURVEYOR_STORE_URL
      });
    }
    const next = { day, downloads: Number(previous.downloads || 0), exports: Number(previous.exports || 0), updatedAt: new Date().toISOString() };
    if (normalizedKind === 'export') next.exports += increment; else next.downloads += increment;
    await updateAppwriteUserSurveyorPrefs(ownerId, { dailyUsage: next });
    return { ...next, downloadLimit: auth?.user?.planLimits?.downloadDailyLimit ?? null, exportLimit: auth?.user?.planLimits?.exportDailyLimit ?? null, storeUrl: SURVEYOR_STORE_URL, metadata };
  });
}

async function assertStorageCapacity(auth = {}, incomingBytes = 0, replacedBytes = 0, options = {}) {
  const incoming = Math.max(0, Number(incomingBytes) || 0);
  const replaced = Math.max(0, Number(replacedBytes) || 0);
  const ownerId = resourceOwnerId(auth);
  const limit = planLimitNumber(auth, 'storageLimitBytes');
  if (limit != null) {
    const usage = await logicalStorageUsageBytesForUser(ownerId);
    const projected = Math.max(0, usage.totalBytes - replaced) + incoming;
    if (projected > limit && projected > usage.totalBytes) {
      throw statusError(413, 'Limite de armazenamento compartilhado do plano atingido. Remova arquivos ou contrate armazenamento adicional.', {
        code: 'STORAGE_LIMIT_REACHED', limitBytes: limit, usedBytes: usage.totalBytes,
        incomingBytes: incoming, projectedBytes: projected, remainingBytes: Math.max(0, limit - usage.totalBytes)
      });
    }
  }

  // A franquia de armazenamento é única por equipe e pertence ao titular.
}

async function stageProjectPayload(row, payload, auth = null) {
  const nextContent = encryptJsonText(payload || {}, { aad: 'project-payload' });
  const projectBucket = bucketId('project_files');
  if (auth) {
    const currentContent = row?.geojsonFileId
      ? await readFileText(projectBucket, row.geojsonFileId).catch(() => '')
      : '';
    const nextMetadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
    let currentPayload = {};
    if (currentContent) {
      try {
        currentPayload = decryptJsonText(currentContent, { aad: 'project-payload' }) || {};
      } catch (error) {
        if (error?.code?.startsWith('CRYPTO_')) throw error;
        currentPayload = {};
      }
    }
    const currentMetadata = currentPayload?.metadata && typeof currentPayload.metadata === 'object' ? currentPayload.metadata : {};
    const resourceStorageOwnerUserId = storageOwnerFromMetadata(nextMetadata, storageOwnerFromMetadata(currentMetadata, resourceOwnerId(auth)));
    await assertStorageCapacity(auth, Buffer.byteLength(nextContent, 'utf8'), Buffer.byteLength(String(currentContent || ''), 'utf8'), { resourceStorageOwnerUserId });
  }
  const fileId = appwriteId();
  await createFile(projectBucket, `${row.$id || row.id || fileId}.json`, nextContent, 'application/json', fileId);
  const verification = await readFileText(projectBucket, fileId).catch(() => '');
  if (verification !== nextContent) {
    await deleteFile(projectBucket, fileId).catch(() => null);
    throw statusError(502, 'O novo arquivo do projeto não pôde ser verificado no Storage. O arquivo anterior foi preservado.', { code: 'PROJECT_FILE_VERIFICATION_FAILED' });
  }
  return { fileId, previousFileId: String(row?.geojsonFileId || ''), bucket: projectBucket };
}

async function commitProjectPayload(row, payload, auth = null, patch = {}) {
  const rowId = row?.$id || row?.id;
  if (!rowId) throw statusError(500, 'Projeto sem identificador interno.');
  const staged = await stageProjectPayload(row, payload, auth);
  let saved;
  try {
    saved = await updateRow('projects', rowId, { ...patch, geojsonFileId: staged.fileId });
  } catch (error) {
    await deleteFile(staged.bucket, staged.fileId).catch(() => null);
    throw error;
  }
  if (staged.previousFileId && staged.previousFileId !== staged.fileId) {
    await deleteFile(staged.bucket, staged.previousFileId).catch((error) => console.warn('[storage] arquivo anterior do projeto pendente de limpeza:', error?.message || error));
  }
  return { fileId: staged.fileId, saved };
}

function assertValidProjectFeatures(features = []) {
  const result = validateProjectFeatures(features, {
    maxFeatures: env('PROJECT_MAX_FEATURES', '25000'),
    maxVerticesTotal: env('PROJECT_MAX_VERTICES_TOTAL', '250000'),
    maxVerticesPerRing: env('PROJECT_MAX_VERTICES_PER_RING', '2000'),
    maxVerticesPerLine: env('PROJECT_MAX_VERTICES_PER_LINE', '10000')
  });
  return result.features;
}

const CLOUD_FILE_UPLOAD_LIMIT_BYTES = 1_572_864;
const MAX_DOCUMENT_CONTENT_BYTES = 3_200_000;
const GOOGLE_DRIVE_SYSTEM_USER_ID = '__google_drive_storage__';
const GOOGLE_DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const SECURITY_SYSTEM_USER_ID = '__surveyor_security_admin__';

const googleDriveService = createGoogleDriveService({
  crypto, env, statusError, jwtSecret, fromBase64url, encryptJsonText, decryptJsonText, isEncryptedText,
  listRows, Query, customizationOptions, updateRow, createRow, parseAppwriteResponse, resourceOwnerId, safeJson,
  GOOGLE_DRIVE_SYSTEM_USER_ID, GOOGLE_DRIVE_FOLDER_MIME
});
const { googleDriveEnabled, googleDriveConfig, assertGoogleDriveConfigured, legacyGoogleDriveCryptoKey, encryptSecret, decryptSecret, findGoogleDriveStore, googleDriveStoreOptions, readGoogleDriveConnection, saveGoogleDriveConnection, googleDriveTokenFromCode, googleDriveAccessToken, googleDriveRequest, driveQueryEscape, findDriveFolderByName, ensureDriveFolder, ensureGoogleDriveRoot, driveSafeName, ensureGoogleDriveUploadFolder, deleteGoogleDriveFile, googleDriveFileForAuth, createGoogleDriveResumableSession } = googleDriveService;

async function findSystemSecurityStore() {
  const rows = await listRows('customization', [Query.equal('userId', SECURITY_SYSTEM_USER_ID), Query.limit(1)]).catch(() => []);
  return rows[0] || null;
}

function systemSecurityOptions(row = {}) {
  const options = customizationOptions(row || {});
  return options.securityAdvanced && typeof options.securityAdvanced === 'object' ? options.securityAdvanced : {};
}

async function readSystemSecurityStore() {
  const row = await findSystemSecurityStore();
  const store = systemSecurityOptions(row || {});
  return {
    row,
    store: {
      auditLogs: Array.isArray(store.auditLogs) ? store.auditLogs : [],
      loginAttempts: Array.isArray(store.loginAttempts) ? store.loginAttempts : [],
      backups: Array.isArray(store.backups) ? store.backups : [],
      settings: store.settings && typeof store.settings === 'object' ? store.settings : {},
      rateLimits: store.rateLimits && typeof store.rateLimits === 'object' ? store.rateLimits : {},
      loginLocks: store.loginLocks && typeof store.loginLocks === 'object' ? store.loginLocks : {},
      updatedAt: store.updatedAt || null
    }
  };
}

async function saveSystemSecurityStore(store = {}) {
  const row = await findSystemSecurityStore().catch(() => null);
  const now = new Date().toISOString();
  const currentOptions = customizationOptions(row || {});
  const next = {
    ...currentOptions,
    securityAdvanced: {
      auditLogs: Array.isArray(store.auditLogs) ? store.auditLogs.slice(-500) : [],
      loginAttempts: Array.isArray(store.loginAttempts) ? store.loginAttempts.slice(-500) : [],
      backups: Array.isArray(store.backups) ? store.backups.slice(-100) : [],
      settings: store.settings && typeof store.settings === 'object' ? store.settings : {},
      rateLimits: store.rateLimits && typeof store.rateLimits === 'object' ? store.rateLimits : {},
      loginLocks: compactLoginLocks(store.loginLocks),
      updatedAt: now
    }
  };
  return saveCustomizationRow(row, {
    userId: SECURITY_SYSTEM_USER_ID,
    options: JSON.stringify(next),
    createdAt: row?.createdAt || now,
    updatedAt: now
  });
}

function requestIp(request) {
  const candidates = [
    headerValue(request, 'cf-connecting-ip'),
    headerValue(request, 'x-real-ip'),
    headerValue(request, 'x-forwarded-for')?.split(',')[0]?.trim()
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (/^[0-9a-f:.]{2,80}$/i.test(value)) return value.slice(0, 80);
  }
  return '';
}

function requestUserAgent(request) {
  return String(headerValue(request, 'user-agent') || '').slice(0, 240);
}

let securityEventsCollectionAvailable = null;

const AUDIT_REDACT_KEY = /password|passwd|token|secret|authorization|cookie|api[_-]?key|otp|verification.?code|reset.?code/i;

function redactAuditMetadata(value, depth = 0) {
  if (depth > 5) return '[depth-limit]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 1200);
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => redactAuditMetadata(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 80)) {
      const safeKey = String(key || '').slice(0, 120);
      out[safeKey] = AUDIT_REDACT_KEY.test(safeKey) ? '[redacted]' : redactAuditMetadata(item, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 1200);
}

function boundedAuditMetadata(value) {
  const clean = redactAuditMetadata(value || {});
  const serialized = JSON.stringify(clean);
  if (Buffer.byteLength(serialized, 'utf8') <= 6000) return clean;
  return {
    truncated: true,
    digest: crypto.createHash('sha256').update(serialized, 'utf8').digest('base64url'),
    keys: clean && typeof clean === 'object' && !Array.isArray(clean) ? Object.keys(clean).slice(0, 60) : []
  };
}

function auditIntegrityPayload(item = {}) {
  return JSON.stringify({
    id: String(item.id || ''), type: String(item.type || ''), action: String(item.action || ''),
    actorUserId: String(item.actorUserId || ''), actorEmail: String(item.actorEmail || ''),
    targetUserId: String(item.targetUserId || ''), target: String(item.target || ''),
    ip: String(item.ip || ''), userAgent: String(item.userAgent || ''), status: String(item.status || ''),
    message: String(item.message || ''), createdAt: String(item.createdAt || ''), metadata: item.metadata || {}
  });
}

function signAuditEventIntegrity(item = {}) {
  return crypto.createHmac('sha256', jwtSecret()).update(`surveyor:audit:v1|${auditIntegrityPayload(item)}`, 'utf8').digest('base64url');
}

function auditIntegrityStatus(item = {}) {
  const stored = String(item.integrity || '').trim();
  if (!stored) return 'legacy';
  try {
    const expected = signAuditEventIntegrity({ ...item, integrity: undefined, integrityStatus: undefined });
    const a = Buffer.from(stored, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? 'verified' : 'invalid';
  } catch {
    return 'invalid';
  }
}

function securityEventsSchemaMissing(error) {
  const status = Number(error?.appwriteStatus || error?.status || 0);
  const text = errorText(error);
  return status === 404 || /security_events|collection.*not found|table.*not found|attribute.*not found|column.*not found|unknown attribute/i.test(text);
}

async function persistSecurityEventRow(item = {}, metadata = {}) {
  if (securityEventsCollectionAvailable === false) return false;
  try {
    await createRow('security_events', {
      eventType: String(item.type || 'audit').slice(0, 60),
      action: String(item.action || 'event').slice(0, 120),
      actorUserId: String(item.actorUserId || '').slice(0, 160),
      actorEmail: normalizeEmail(item.actorEmail || ''),
      targetUserId: String(item.targetUserId || '').slice(0, 160),
      target: String(item.target || '').slice(0, 240),
      ip: String(item.ip || '').slice(0, 80),
      userAgent: String(item.userAgent || '').slice(0, 240),
      eventStatus: String(item.status || 'ok').slice(0, 60),
      message: String(item.message || '').slice(0, 500),
      metadataJson: JSON.stringify({ ...(metadata || {}), __auditIntegrity: item.integrity || '' }).slice(0, 8000),
      createdAt: item.createdAt || new Date().toISOString()
    }, item.id || appwriteId());
    securityEventsCollectionAvailable = true;
    return true;
  } catch (error) {
    if (securityEventsSchemaMissing(error)) {
      securityEventsCollectionAvailable = false;
      return false;
    }
    console.warn('[audit] collection security_events temporariamente indisponível:', error?.message || error);
    return false;
  }
}

function mapSecurityEventRow(row = {}) {
  const storedMetadata = safeJson(row.metadataJson || '{}', {});
  const integrity = String(storedMetadata.__auditIntegrity || row.integrity || '').trim();
  const metadata = { ...storedMetadata };
  delete metadata.__auditIntegrity;
  const mapped = {
    id: row.$id || row.id,
    type: row.eventType || row.type || 'audit',
    action: row.action || 'event',
    actorUserId: row.actorUserId || '',
    actorEmail: row.actorEmail || '',
    targetUserId: row.targetUserId || '',
    target: row.target || '',
    ip: row.ip || '',
    userAgent: row.userAgent || '',
    status: row.eventStatus || row.status || 'ok',
    message: row.message || '',
    metadata,
    createdAt: row.createdAt || row.$createdAt || '',
    integrity
  };
  mapped.integrityStatus = auditIntegrityStatus(mapped);
  return mapped;
}

async function listRecentSecurityEvents(limit = 200, predicate = null) {
  const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 200));
  if (securityEventsCollectionAvailable !== false) {
    try {
      const rows = [];
      let offset = 0;
      while (rows.length < safeLimit) {
        const pageSize = Math.min(500, safeLimit - rows.length);
        const batch = await listRows('security_events', [Query.orderDesc('createdAt'), Query.limit(pageSize), Query.offset(offset)]);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += batch.length;
      }
      securityEventsCollectionAvailable = true;
      const mapped = rows.map(mapSecurityEventRow);
      return (predicate ? mapped.filter(predicate) : mapped).slice(0, safeLimit);
    } catch (error) {
      if (securityEventsSchemaMissing(error)) securityEventsCollectionAvailable = false;
      else console.warn('[audit] falha ao ler security_events:', error?.message || error);
    }
  }
  const { store } = await readSystemSecurityStore();
  const rows = (store.auditLogs || []).slice().reverse().map((item) => ({ ...item, integrityStatus: auditIntegrityStatus(item) }));
  return (predicate ? rows.filter(predicate) : rows).slice(0, safeLimit);
}

async function appendSecurityEvent(event = {}) {
  try {
    const { store } = await readSystemSecurityStore();
    const now = new Date().toISOString();
    const item = {
      id: appwriteId(),
      type: String(event.type || 'audit'),
      action: String(event.action || 'event').slice(0, 120),
      actorUserId: String(event.actorUserId || event.userId || '').slice(0, 160),
      actorEmail: normalizeEmail(event.actorEmail || event.email || ''),
      targetUserId: String(event.targetUserId || '').slice(0, 160),
      target: String(event.target || '').slice(0, 240),
      ip: String(event.ip || '').slice(0, 80),
      userAgent: String(event.userAgent || '').slice(0, 240),
      status: String(event.status || 'ok').slice(0, 60),
      message: String(event.message || '').slice(0, 500),
      metadata: boundedAuditMetadata(event.metadata || {}),
      createdAt: now
    };
    item.integrity = signAuditEventIntegrity(item);
    item.integrityStatus = 'verified';
    const persisted = await persistSecurityEventRow(item, item.metadata);
    const next = { ...store };
    next.auditLogs = [...(store.auditLogs || []), item].slice(-500);
    if (item.type === 'login' || /login|auth/i.test(item.action)) next.loginAttempts = [...(store.loginAttempts || []), item].slice(-500);
    // O armazenamento legado continua como fallback de compatibilidade e para o rate-limit.
    // Quando a collection append-only estiver ativa, cada evento também fica isolado em sua própria row.
    await saveSystemSecurityStore(next);
    return { persisted, item };
  } catch (error) {
    console.warn('[audit] falha ao registrar evento:', error?.message || error);
  }
}

function loginRateWindowMs() {
  const minutes = Number(env('LOGIN_RATE_WINDOW_MINUTES', '60'));
  return Math.max(5, Math.min(120, Number.isFinite(minutes) ? minutes : 15)) * 60 * 1000;
}

async function assertLoginRateLimit(request, email = '') {
  const ip = requestIp(request);
  const normalizedEmail = normalizeEmail(email);
  const { store } = await readSystemSecurityStore().catch((error) => {
    console.warn('[security] não foi possível abrir armazenamento do rate limit:', error?.message || error);
    return { store: null };
  });
  const maxAttempts = LOGIN_ACCOUNT_LOCK_ATTEMPTS;
  const failOpen = true; // compatibilidade: o limiter persistente sempre possui fallback local e nunca derruba o login.
  await persistentRateLimitCheck('login', [normalizedEmail ? `email:${normalizedEmail}` : ''], {
    limit: maxAttempts,
    windowMs: loginRateWindowMs(),
    failOpen
  });
  await persistentRateLimitCheck('login-ip', [ip ? `ip:${ip}` : ''], {
    limit: Math.max(12, maxAttempts * 4),
    windowMs: loginRateWindowMs(),
    failOpen
  });
}

async function recordLoginRateLimitFailure(request, email = '') {
  const ip = requestIp(request);
  const normalizedEmail = normalizeEmail(email);
  await Promise.all([
    persistentRateLimitRecord('login', [normalizedEmail ? `email:${normalizedEmail}` : ''], { windowMs: loginRateWindowMs() }),
    persistentRateLimitRecord('login-ip', [ip ? `ip:${ip}` : ''], { windowMs: loginRateWindowMs() })
  ]);
}

async function clearLoginRateLimit(request, email = '') {
  const ip = requestIp(request);
  const normalizedEmail = normalizeEmail(email);
  await persistentRateLimitClear('login', [normalizedEmail ? `email:${normalizedEmail}` : '']);
  // O IP possui um limite separado e mais amplo para conter automação sem prender uma conta específica.
  await persistentRateLimitClear('login-ip', [ip ? `ip:${ip}` : '']);
}

const LOGIN_ACCOUNT_LOCK_MS = 5 * 60 * 60 * 1000;
const LOGIN_ACCOUNT_FAILURE_WINDOW_MS = 5 * 60 * 60 * 1000;
const LOGIN_ACCOUNT_LOCK_ATTEMPTS = 3;
const LOCAL_LOGIN_LOCKS = new Map();

function loginAccountLockKey(email = '') {
  const normalized = normalizeEmail(email);
  return normalized ? securityRateKey('login-account-lock', normalized) : '';
}

function compactLoginLocks(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const now = Date.now();
  const entries = Object.entries(raw).filter(([, row]) => {
    const updatedAt = Date.parse(String(row?.updatedAt || '')) || 0;
    const lockedUntil = Date.parse(String(row?.lockedUntil || '')) || 0;
    return lockedUntil > now || !updatedAt || now - updatedAt < 24 * 60 * 60 * 1000;
  }).sort((a, b) => (Date.parse(String(b[1]?.updatedAt || '')) || 0) - (Date.parse(String(a[1]?.updatedAt || '')) || 0));
  return Object.fromEntries(entries.slice(0, 2000));
}

function loginLockStateFromStore(store = {}, email = '') {
  const key = loginAccountLockKey(email);
  const row = key && store?.loginLocks && typeof store.loginLocks === 'object' ? store.loginLocks[key] : null;
  const now = Date.now();
  const failures = Array.isArray(row?.failures)
    ? row.failures.map(Number).filter((ts) => Number.isFinite(ts) && now - ts < LOGIN_ACCOUNT_FAILURE_WINDOW_MS)
    : [];
  const lockedUntilMs = Date.parse(String(row?.lockedUntil || '')) || 0;
  const locked = lockedUntilMs > now;
  const failedAttempts = failures.length;
  return {
    locked,
    lockedUntil: locked ? new Date(lockedUntilMs).toISOString() : null,
    retryAfterSeconds: locked ? Math.max(1, Math.ceil((lockedUntilMs - now) / 1000)) : 0,
    failedAttempts,
    remainingAttempts: locked ? 0 : Math.max(0, LOGIN_ACCOUNT_LOCK_ATTEMPTS - failedAttempts)
  };
}

function localLoginLockStore() {
  return { loginLocks: Object.fromEntries(LOCAL_LOGIN_LOCKS.entries()) };
}

async function assertLoginAccountUnlocked(email = '') {
  let state;
  try {
    const { store } = await readSystemSecurityStore();
    const persistentState = loginLockStateFromStore(store, email);
    const localState = loginLockStateFromStore(localLoginLockStore(), email);
    state = persistentState.locked || persistentState.failedAttempts >= localState.failedAttempts ? persistentState : localState;
    const key = loginAccountLockKey(email);
    if (key && store?.loginLocks?.[key]) LOCAL_LOGIN_LOCKS.set(key, store.loginLocks[key]);
  } catch (error) {
    console.warn('[security] armazenamento persistente do bloqueio de login indisponível; usando fallback local:', error?.message || error);
    state = loginLockStateFromStore(localLoginLockStore(), email);
  }
  if (state.locked) {
    throw statusError(429, 'Suas tentativas se esgotaram. Por segurança, o login foi bloqueado por 5 horas. Tente novamente depois desse período ou solicite o desbloqueio ao administrador.', {
      code: 'ACCOUNT_TEMPORARILY_LOCKED', ...state, remainingAttempts: 0
    });
  }
  return state;
}

async function recordLoginAccountFailure(email = '') {
  const normalized = normalizeEmail(email);
  if (!normalized) return { locked: false, failedAttempts: 0, remainingAttempts: LOGIN_ACCOUNT_LOCK_ATTEMPTS, lockedUntil: null, retryAfterSeconds: 0 };
  const key = loginAccountLockKey(normalized);
  const now = Date.now();
  let store = {};
  try {
    ({ store } = await readSystemSecurityStore());
  } catch (error) {
    console.warn('[security] falha ao abrir bloqueios persistentes; atualizando fallback local:', error?.message || error);
    store = localLoginLockStore();
  }
  const loginLocks = store.loginLocks && typeof store.loginLocks === 'object' ? { ...store.loginLocks } : {};
  const previous = loginLocks[key] && typeof loginLocks[key] === 'object' ? loginLocks[key] : (LOCAL_LOGIN_LOCKS.get(key) || {});
  const failures = Array.isArray(previous.failures)
    ? previous.failures.map(Number).filter((ts) => Number.isFinite(ts) && now - ts < LOGIN_ACCOUNT_FAILURE_WINDOW_MS)
    : [];
  failures.push(now);
  const lockedUntil = failures.length >= LOGIN_ACCOUNT_LOCK_ATTEMPTS
    ? new Date(now + LOGIN_ACCOUNT_LOCK_MS).toISOString()
    : (Date.parse(String(previous.lockedUntil || '')) > now ? previous.lockedUntil : null);
  const row = {
    emailHash: key,
    failures: failures.slice(-LOGIN_ACCOUNT_LOCK_ATTEMPTS),
    lockedUntil,
    updatedAt: new Date(now).toISOString()
  };
  loginLocks[key] = row;
  LOCAL_LOGIN_LOCKS.set(key, row);
  try {
    await saveSystemSecurityStore({ ...store, loginLocks });
  } catch (error) {
    console.warn('[security] bloqueio de login ficou no fallback local nesta instância:', error?.message || error);
  }
  return loginLockStateFromStore({ ...store, loginLocks }, normalized);
}

async function clearLoginAccountLock(email = '') {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const key = loginAccountLockKey(normalized);
  const localExisted = Boolean(key && LOCAL_LOGIN_LOCKS.has(key));
  if (key) LOCAL_LOGIN_LOCKS.delete(key);
  let existed = localExisted;
  try {
    const { store } = await readSystemSecurityStore();
    const loginLocks = store.loginLocks && typeof store.loginLocks === 'object' ? { ...store.loginLocks } : {};
    existed = existed || Boolean(key && Object.prototype.hasOwnProperty.call(loginLocks, key));
    if (key) delete loginLocks[key];
    await saveSystemSecurityStore({ ...store, loginLocks });
  } catch (error) {
    console.warn('[security] desbloqueio persistente pendente; fallback local já foi limpo:', error?.message || error);
  }
  await persistentRateLimitClear('login', [`email:${normalized}`]);
  return existed;
}

function isInvalidLoginCredentialError(error) {
  const status = Number(error?.appwriteStatus || error?.status || 0);
  const text = errorText(error).toLowerCase();
  if (/blocked|disabled|suspended/.test(text)) return false;
  return status === 401 || /user_invalid_credentials|invalid credentials|invalid email or password|invalid password|credenciais? inv[aá]lid/.test(text);
}

async function assertSharePasswordRateLimit(request, share = {}) {
  const windowMs = Math.max(5, Math.min(120, Number(env('SHARE_RATE_WINDOW_MINUTES', '15')) || 15)) * 60 * 1000;
  const maxAttempts = Math.max(3, Math.min(30, Number(env('SHARE_BLOCK_AFTER_ATTEMPTS', '8')) || 8));
  const failOpen = String(env('SHARE_RATE_LIMIT_FAIL_OPEN', 'false')).toLowerCase() === 'true';
  const ip = requestIp(request);
  const target = String(share.id || '');
  await persistentRateLimitCheck('share-password', [ip ? `ip:${ip}` : '', target ? `share:${target}` : ''], {
    limit: maxAttempts,
    windowMs,
    failOpen
  });
}

async function recordSharePasswordRateLimitFailure(request, share = {}) {
  const windowMs = Math.max(5, Math.min(120, Number(env('SHARE_RATE_WINDOW_MINUTES', '15')) || 15)) * 60 * 1000;
  const ip = requestIp(request);
  const target = String(share.id || '');
  await persistentRateLimitRecord('share-password', [ip ? `ip:${ip}` : '', target ? `share:${target}` : ''], { windowMs });
}

async function clearSharePasswordRateLimit(request, share = {}) {
  const ip = requestIp(request);
  const target = String(share.id || '');
  await persistentRateLimitClear('share-password', [ip ? `ip:${ip}` : '', target ? `share:${target}` : '']);
}

async function storageUsageSummary() {
  const documents = await listRows('documents', [Query.limit(500)]).catch(() => []);
  const projects = await listRows('projects', [Query.limit(500)]).catch(() => []);
  const layers = await listRows('layers', [Query.limit(500)]).catch(() => []);
  const docBytes = documents.reduce((sum, row) => sum + (Number(row.sizeBytes || safeJson(row.metadata, {})?.sizeBytes || 0) || 0), 0);
  const layerBytes = layers.reduce((sum, row) => sum + (Number(row.dataSizeBytes || row.sourceSizeBytes || 0) || 0), 0);
  const projectBytes = projects.reduce((sum, row) => sum + (Number(row.sizeBytes || 0) || 0), 0);
  return { documents: documents.length, projects: projects.length, layers: layers.length, docBytes, layerBytes, projectBytes, totalBytes: docBytes + layerBytes + projectBytes };
}

function licenseSummary(users = [], plans = []) {
  const byPlan = {};
  for (const user of users) {
    const plan = String(user.plan || user.planId || 'basic');
    byPlan[plan] = (byPlan[plan] || 0) + 1;
  }
  return { totalUsers: users.length, byPlan, plans: plans.map((plan) => ({ id: plan.id, slug: plan.slug, name: plan.name, userLimit: plan.userLimit ?? null, storageLimitBytes: plan.storageLimitBytes ?? null, active: plan.active !== false })) };
}

async function buildAdminDashboard(request, auth) {
  const [users, plans, projects, documents, layers, security, storage] = await Promise.all([
    listAdminUsers().catch(() => []),
    listPlansSafe({ includeInactive: true }).catch(() => []),
    listRows('projects', [Query.limit(500)]).catch(() => []),
    listRows('documents', [Query.limit(500)]).catch(() => []),
    listRows('layers', [Query.limit(500)]).catch(() => []),
    readSystemSecurityStore().catch(() => ({ store: { auditLogs: [], loginAttempts: [], backups: [], settings: {} } })),
    storageUsageSummary().catch(() => ({ totalBytes: 0, docBytes: 0, layerBytes: 0, projectBytes: 0, documents: 0, projects: 0, layers: 0 }))
  ]);
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    health: {
      apiVersion: APP_VERSION,
      database: databaseId(),
      function: 'surveyor-api',
      status: 'operacional',
      googleDrive: { enabled: googleDriveEnabled(), configured: Boolean(env('GOOGLE_DRIVE_CLIENT_ID') && env('GOOGLE_DRIVE_CLIENT_SECRET')) },
      cpu: 'não disponível no runtime Appwrite',
      memory: 'não disponível no runtime Appwrite'
    },
    stats: {
      users: users.length,
      activeUsers: users.filter((u) => String(u.status || 'active') === 'active').length,
      blockedUsers: users.filter((u) => String(u.status || '') === 'blocked').length,
      projects: projects.length,
      documents: documents.length,
      layers: layers.length,
      publicLayers: layers.filter((l) => l.isPublic !== false && l.status !== 'archived').length,
      loginAttempts: security.store.loginAttempts.length,
      auditLogs: security.store.auditLogs.length,
      backups: security.store.backups.length
    },
    storage,
    licenses: licenseSummary(users, plans),
    recent: {
      users: users.slice(0, 10),
      projects: projects.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,10).map(mapProject),
      documents: documents.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,10).map((doc)=>({ id: doc.$id||doc.id, name: doc.name||doc.fileName||'Documento', userId: doc.userId||'', updatedAt: doc.updatedAt||doc.$updatedAt||null })),
      auditLogs: security.store.auditLogs.slice(-20).reverse()
    },
    security: {
      twoFactorPolicy: security.store.settings.twoFactorPolicy || 'email-code-first-login',
      devicePolicy: security.store.settings.devicePolicy || 'audit-only',
      encryptionMode: security.store.settings.encryptionMode || 'provider-rest-encryption',
      blockAfterAttempts: LOGIN_ACCOUNT_LOCK_ATTEMPTS,
      loginLockHours: 5,
      authorizedDevices: security.store.settings.authorizedDevices || []
    },
    request: { ip: requestIp(request), userAgent: requestUserAgent(request), admin: auth.user?.email || '' }
  };
}


function adminAiContext(dashboard = {}, users = [], events = [], groups = [], layers = [], notices = []) {
  const now = Date.now();
  const includePii = String(env('ADMIN_AI_INCLUDE_PII', 'false')).toLowerCase() === 'true';
  const safeUsers = users.slice(0, 300).map((user, index) => {
    const expiry = user.expiresAt || null;
    const expiryMs = expiry ? Date.parse(expiry) : NaN;
    const daysToExpiry = Number.isFinite(expiryMs) ? Math.ceil((expiryMs - now) / 86400000) : null;
    const contactPhone = normalizeBrazilPhone(user.whatsapp || user.phone || user.phoneDisplay || '');
    const normalizedEmail = normalizeEmail(user.email || '');
    const missingFields = [];
    if (!String(user.name || '').trim()) missingFields.push('nome');
    if (!normalizedEmail) missingFields.push('e-mail');
    if (!contactPhone) missingFields.push('telefone');
    if (!expiry) missingFields.push('vencimento');
    if (String(user.integrityStatus || 'ok') !== 'complete') missingFields.push('integridade cadastral');
    const domain = normalizedEmail.includes('@') ? normalizedEmail.split('@').pop() : '';
    return {
      userRef: `U${String(index + 1).padStart(3, '0')}`,
      ...(includePii ? {
        name: String(user.name || 'Usuário').slice(0, 100),
        email: normalizedEmail,
        phone: contactPhone ? formatBrazilPhone(contactPhone) : null
      } : {
        emailDomain: domain || null,
        hasPhone: Boolean(contactPhone)
      }),
      phoneMissing: !contactPhone,
      plan: String(user.planName || user.plan || user.planSlug || 'Sem plano').slice(0, 100),
      status: String(user.status || 'active').slice(0, 30),
      expiresAt: expiry,
      daysToExpiry,
      integrityStatus: String(user.integrityStatus || 'ok').slice(0, 50),
      emailVerified: user.emailVerified !== false,
      missingFields
    };
  });
  const safeGroups = groups.slice(0, 200).map((group) => ({ id: group.id, name: String(group.name || '').slice(0, 120), status: String(group.status || 'active'), sortOrder: Number(group.sortOrder || 0) }));
  const safeLayers = layers.slice(0, 500).map((layer) => ({ id: layer.id, name: String(layer.name || '').slice(0, 150), groupId: layer.groupId || '', groupName: String(layer.groupName || '').slice(0, 120), status: layer.status, isPublic: layer.isPublic === true, featureCount: Number(layer.featureCount || 0), sourceName: String(layer.sourceName || '').slice(0, 100) }));
  const safeNotices = notices.slice(0, 80).map((notice) => ({ id: notice.id, title: String(notice.title || '').slice(0, 180), status: notice.active === false ? 'inactive' : 'active', type: String(notice.type || notice.level || 'info').slice(0, 40), startsAt: notice.startsAt || null, endsAt: notice.endsAt || null }));
  return {
    generatedAt: new Date().toISOString(),
    privacyMode: includePii ? 'explicit-pii-enabled' : 'anonymized-default',
    stats: dashboard.stats || {},
    storage: dashboard.storage || {},
    licenses: dashboard.licenses || {},
    users: safeUsers,
    layerGroups: safeGroups,
    layers: safeLayers,
    notices: safeNotices,
    recentSecurityEvents: events.slice(0, 80).map((event) => ({
      createdAt: event.createdAt,
      action: event.action,
      status: event.status,
      ...(includePii ? { actorEmail: event.actorEmail, ip: event.ip, message: event.message } : {})
    }))
  };
}

function normalizeAdminAiHistory(history = []) {
  return (Array.isArray(history) ? history : []).slice(-10).map((item) => ({
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    content: String(item?.content || '').trim().slice(0, item?.role === 'assistant' ? 5000 : 1800)
  })).filter((item) => item.content);
}

function normalizeAdminAiImage(image = null) {
  if (!image || typeof image !== 'object') return null;
  const dataUrl = String(image.dataUrl || '').trim();
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw statusError(400, 'A imagem anexada deve ser PNG, JPEG ou WEBP.');
  const buffer = Buffer.from(match[2], 'base64');
  const maxBytes = Math.max(256 * 1024, Math.min(5 * 1024 * 1024, Number(env('ADMIN_AI_MAX_IMAGE_BYTES', String(3 * 1024 * 1024))) || 3 * 1024 * 1024));
  if (!buffer.length || buffer.length > maxBytes) throw statusError(413, `A imagem anexada excede o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  return { name: String(image.name || 'imagem').slice(0, 120), mimeType: `image/${match[1].toLowerCase()}`, dataUrl };
}

function openRouterTextContent(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content.map((part) => {
    if (typeof part === 'string') return part;
    if (part?.type === 'text') return String(part.text || '');
    return String(part?.text || part?.content || '');
  }).filter(Boolean).join('\n').trim();
}

function openRouterAdminError(status, data = {}, imageAttached = false) {
  const raw = String(data?.error?.message || data?.message || data?.error || `OpenRouter recusou a solicitação (${status}).`).trim();
  if (imageAttached && /image|vision|modality|modalities|no endpoints|unsupported|model/i.test(raw)) {
    return 'O modelo visual configurado não aceitou a imagem. Defina OPENROUTER_VISION_MODEL=openrouter/free ou outro modelo com entrada de imagem.';
  }
  if (status === 402 || /credit|balance|saldo|payment/i.test(raw)) {
    return 'O OpenRouter recusou a solicitação por saldo ou limite da conta. O ditado por voz do Surveyor não usa o OpenRouter; essa cobrança se refere somente à consulta de IA.';
  }
  return raw;
}

async function askOpenRouterAdmin(question, context, options = {}) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw statusError(503, 'A IA administrativa ainda não foi configurada. Adicione api_key_openrouter ou OPENROUTER_API_KEY na Function surveyor-api.');
  const image = normalizeAdminAiImage(options.image || null);
  const textModel = String(env('OPENROUTER_MODEL', 'openrouter/free') || 'openrouter/free').trim();
  const configuredVisionModel = String(env('OPENROUTER_VISION_MODEL', 'openrouter/free') || 'openrouter/free').trim();
  const initialModel = image ? configuredVisionModel : textModel;
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  const systemContent = `Você é o assistente administrativo privado do Surveyor. Responda em português do Brasil e use somente os dados administrativos JSON fornecidos e, quando houver, a imagem anexada. Não invente usuários, datas, valores ou ocorrências. Não identifique pessoas pela imagem e não infira atributos sensíveis. Nunca exponha segredos, tokens ou dados além do necessário.

FORMATO OBRIGATÓRIO DA RESPOSTA:
- Comece diretamente pela informação útil, sem repetir a pergunta.
- Organize com seções Markdown curtas: "## Resumo", "## Achados", "## Ações recomendadas" e "## Alertas" somente quando forem relevantes.
- Use listas para explicações e tabelas somente quando precisar comparar registros.
- Toda tabela deve estar em Markdown GFM válido: uma linha de cabeçalho, uma linha separadora com hífens e cada registro em sua própria linha.
- Use no máximo 7 colunas e títulos curtos. Nunca coloque uma tabela inteira em uma única linha ou dentro de um parágrafo.
- Traduza valores técnicos: active=Ativo, inactive=Inativo, complete=Completo, true=Sim, false=Não e null=Não informado.
- Para campos ausentes, escreva "Não informado". Não mostre a palavra null.
- Evite repetir dados e limite a resposta ao que foi perguntado. Não repita o JSON bruto.

DADOS ADMINISTRATIVOS ATUAIS:
${JSON.stringify(context)}`;
  const history = normalizeAdminAiHistory(options.history || []);
  const userText = String(question || '').trim();
  const userContent = image
    ? [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: image.dataUrl } }]
    : userText;
  const baseRequest = {
    temperature: 0.15,
    max_tokens: 1600,
    messages: [
      { role: 'system', content: systemContent },
      ...history,
      { role: 'user', content: userContent }
    ]
  };

  const callModel = async (model) => {
    const response = await fetchWithAbortTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://surveyorr.com.br',
        'X-OpenRouter-Title': 'Surveyor Administração'
      },
      body: JSON.stringify({ ...baseRequest, model })
    }, Math.max(12000, Math.min(70000, Number(env('OPENROUTER_TIMEOUT_MS', '50000')) || 50000)));
    const data = await response.json().catch(() => ({}));
    return { response, data, model };
  };

  let attempt = await callModel(initialModel);
  const retryWithFreeVision = image && initialModel !== 'openrouter/free' && !attempt.response.ok && [400, 404, 422].includes(attempt.response.status);
  if (retryWithFreeVision) attempt = await callModel('openrouter/free');
  if (!attempt.response.ok) {
    throw statusError(attempt.response.status >= 500 ? 502 : attempt.response.status, openRouterAdminError(attempt.response.status, attempt.data, Boolean(image)));
  }
  const answer = openRouterTextContent(attempt.data?.choices?.[0]?.message?.content);
  if (!answer) throw statusError(502, 'A IA não retornou uma resposta utilizável.');
  return { answer: answer.slice(0, 16000), model: String(attempt.data.model || attempt.model), usage: attempt.data.usage || null, imageProcessed: Boolean(image) };
}

async function createDocumentRowSafe(data) {
  const rich = {
    ...data,
    tags: Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags,
    metadata: data.metadata && typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : data.metadata,
    updatedAt: data.updatedAt || new Date().toISOString()
  };
  try { return await createRow('documents', rich); }
  catch (error) {
    if (!isUnknownAttributeError(error)) throw error;
    const minimal = {
      userId: rich.userId,
      projectId: rich.projectId || '',
      type: rich.type || rich.category || 'outros',
      format: rich.format || rich.mimeType || 'application/octet-stream',
      name: rich.name || rich.title || rich.fileName || 'Arquivo',
      fileId: rich.fileId || rich.externalFileId || '',
      bucketId: rich.bucketId || '',
      createdAt: rich.createdAt || new Date().toISOString()
    };
    return createRow('documents', minimal);
  }
}

async function updateDocumentRowSafe(documentId, data) {
  try { return await updateRow('documents', documentId, data); }
  catch (error) {
    if (!isUnknownAttributeError(error)) throw error;
    const minimal = {
      type: data.type || data.category || 'outros',
      format: data.format || data.mimeType || 'application/octet-stream',
      name: data.name || data.title || data.fileName || 'Arquivo',
      fileId: data.fileId || data.externalFileId || '',
      bucketId: data.bucketId || ''
    };
    return updateRow('documents', documentId, minimal);
  }
}



const INCra_ACERVO_WMS_BASE_URL = 'https://acervofundiario.incra.gov.br/i3geo/ogc.php';

function incraOfficialLayerPayload(item = {}) {
  const color = item.color || '#2563eb';
  return {
    id: item.id,
    groupId: INCRA_OFFICIAL_GROUP.id,
    groupName: INCRA_OFFICIAL_GROUP.name,
    name: item.name,
    slug: item.id,
    description: item.description || `${INCRA_OFFICIAL_GROUP.name} • camada WMS oficial: ${item.layer}`,
    geometryType: 'polygon',
    sourceName: 'INCRA / Acervo Fundiário',
    sourceUrl: `${INCra_ACERVO_WMS_BASE_URL}?tema=${encodeURIComponent(item.layer)}`,
    serviceType: 'wms',
    serviceUrl: `${INCra_ACERVO_WMS_BASE_URL}?tema=${encodeURIComponent(item.layer)}`,
    minZoom: 0,
    maxZoom: 22,
    isPublic: true,
    status: 'ready',
    dataAvailable: false,
    dataFileId: '',
    dataBucketId: bucketId('project_files'),
    dataSizeBytes: 0,
    featureCount: 0,
    style: {
      color,
      fillColor: item.fillColor || color,
      opacity: item.opacity ?? 0.58,
      fillOpacity: Math.max(0.18, Math.min(0.7, Number(item.opacity ?? 0.58) * 0.45)),
      weight: 2
    },
    metadata: {
      layerName: item.layer,
      layers: item.layer,
      remoteMode: true,
      virtualOfficialLayer: true,
      registrySystem: item.registrySystem,
      sourceSystem: item.registrySystem === 'sigef' ? 'SIGEF' : 'SNCI',
      officialCatalogGroup: INCRA_OFFICIAL_GROUP.name,
      officialWmsTitle: item.name,
      coverageCountry: 'BR',
      coverageType: 'state',
      coverageStates: ['BA'],
      stateCode: 'BA',
      stateName: 'Bahia',
      directWms: true,
      useOfficialFallback: false,
      forceStoredData: false,
      format: 'image/png',
      transparent: true,
      wmsVersion: '1.1.1',
      queryable: true,
      configuredAt: '2026-07-02T00:00:00.000Z',
      autoSeed: 'incra-acervo-fundiario-v21.9.218-virtual'
    },
    allowedPlans: ['*'],
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z'
  };
}

function incraOfficialVirtualLayers() {
  return INCRA_OFFICIAL_CATALOG.map(incraOfficialLayerPayload);
}

const SICAR_WMS_BASE_URL = 'https://geoserver.car.gov.br/geoserver/sicar/wms';
const SICAR_WFS_BASE_URL = 'https://geoserver.car.gov.br/geoserver/sicar/ows';
const SICAR_STATE_CATALOG = Object.freeze({
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo',
  GO:'Goiás', MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará', PB:'Paraíba',
  PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul',
  RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins'
});
function sicarPropertyLayerName(stateCode = 'BA') {
  const code = String(stateCode || 'BA').trim().toUpperCase();
  const safeCode = Object.prototype.hasOwnProperty.call(SICAR_STATE_CATALOG, code) ? code : 'BA';
  return `sicar:sicar_imoveis_${safeCode.toLowerCase()}`;
}
function sicarPropertyLayerPayload(stateCode = 'BA') {
  const code = String(stateCode || 'BA').trim().toUpperCase();
  const stateName = SICAR_STATE_CATALOG[code] || SICAR_STATE_CATALOG.BA;
  const layerName = sicarPropertyLayerName(code);
  return {
    id: `sicar-limites-propriedade-${code.toLowerCase()}`,
    groupId: SICAR_PROPERTY_GROUP.id,
    groupName: SICAR_PROPERTY_GROUP.name,
    name: 'Imóvel Rural - Limites de Propriedade',
    slug: `sicar-limites-propriedade-${code.toLowerCase()}`,
    description: `Limites oficiais de imóveis rurais do CAR/SICAR — ${stateName}/${code}.`,
    geometryType: 'polygon',
    sourceName: 'CAR / SICAR',
    sourceUrl: SICAR_WMS_BASE_URL,
    serviceType: 'wms',
    serviceUrl: SICAR_WMS_BASE_URL,
    minZoom: 0,
    maxZoom: 22,
    isPublic: true,
    status: 'ready',
    dataAvailable: false,
    dataFileId: '',
    dataBucketId: bucketId('project_files'),
    dataSizeBytes: 0,
    featureCount: 0,
    style: { color:'#FFD400', fillColor:'#FFD400', opacity:0.62, fillOpacity:0.18, weight:2.2 },
    metadata: {
      layerName,
      layers: layerName,
      remoteMode: true,
      virtualOfficialLayer: true,
      sourceSystem: 'SICAR',
      officialCatalogGroup: SICAR_PROPERTY_GROUP.name,
      officialWmsTitle: `Imóveis rurais CAR/SICAR — ${stateName}`,
      coverageCountry: 'BR',
      coverageType: 'state',
      coverageStates: [code],
      stateCode: code,
      stateName,
      directWms: true,
      useOfficialFallback: false,
      forceStoredData: false,
      format: 'image/png',
      transparent: true,
      wmsVersion: '1.1.1',
      queryable: true,
      preferWfs: false,
      wfsServiceUrl: SICAR_WFS_BASE_URL,
      autoSeed: 'sicar-car-national-r21'
    },
    allowedPlans: ['*'],
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z'
  };
}
function sicarPropertyVirtualLayers() {
  return Object.keys(SICAR_STATE_CATALOG).map(sicarPropertyLayerPayload);
}
function isLegacyGeobahiaPropertyBoundaryLayer(layer = {}) {
  const technical = normalizeCatalogLayerKey(layer?.metadata?.layerName || layer?.metadata?.layers || '');
  const source = String(layer?.sourceName || layer?.source || '').toLowerCase();
  const name = String(layer?.name || '').toLowerCase();
  return technical.includes('cefir imovel rural limite') || ((source.includes('geobahia') || source.includes('inema')) && /limites? de propriedade/.test(name));
}

const GEOBAHIA_WMS_BASE_URL = 'https://geoserver.inema.ba.gov.br/geoserver/ows';
const GEOBAHIA_DEFAULT_TRANSPARENCY = 0.55;



const OBSOLETE_PAYMENT_TEST_PLAN_SLUGS = new Set(['test_payment', 'surveyor-teste-pagamento', 'surveyortestepagamento', 'teste-pagamento', 'uber-teste-pagamento', 'uberteste-pagamento']);

function isObsoletePaymentTestPlan(row = {}) {
  const slug = String(row.slug || row.id || row.$id || '').trim().toLowerCase();
  const name = String(row.name || '').trim().toLowerCase();
  const billing = String(row.billingCycle || row.billing || '').trim().toLowerCase();
  const priceCents = Number(row.priceCents ?? (row.price != null ? Math.round(Number(row.price || 0) * 100) : 0)) || 0;
  return OBSOLETE_PAYMENT_TEST_PLAN_SLUGS.has(slug)
    || slug.includes('test_payment')
    || (priceCents === 10 && (billing.includes('teste') || name.includes('teste pagamento') || name.includes('uber')));
}


function mapPlan(row = {}) {
  const permissions = parsePermissions(row.permissions);
  const slug = String(row.slug || row.id || row.$id || 'basic').trim().toLowerCase();
  const officialRule = commercialPlanRule(slug);
  const priceCents = Number(row.priceCents ?? (row.price != null ? Math.round(Number(row.price || 0) * 100) : 0)) || 0;
  return {
    id: row.$id || row.id || slug,
    slug,
    name: row.name || slug.toUpperCase(),
    description: row.description || '',
    priceCents,
    billingCycle: row.billingCycle || row.billing || 'anual',
    projectLimit: officialRule ? null : (row.projectLimit == null || row.projectLimit === '' || Number(row.projectLimit) <= 0 ? null : Number(row.projectLimit)),
    userLimit: row.userLimit == null || row.userLimit === '' ? null : Number(row.userLimit),
    storageLimitBytes: officialRule ? officialRule.storageBaseBytes : (row.storageLimitBytes == null || row.storageLimitBytes === '' ? null : Number(row.storageLimitBytes)),
    storageMaxBytes: officialRule?.storageMaxBytes ?? null,
    downloadDailyLimit: officialRule?.downloadDailyLimit ?? null,
    exportDailyLimit: officialRule?.exportDailyLimit ?? null,
    storageStoreUrl: SURVEYOR_STORE_URL,
    permissions,
    generationLimit: null,
    generationUnlimited: true,
    isActive: row.isActive !== false && row.active !== false,
    active: row.isActive !== false && row.active !== false,
    createdAt: row.createdAt || row.$createdAt || null,
    updatedAt: row.updatedAt || row.$updatedAt || null
  };
}

function planData(input = {}, current = {}) {
  const now = new Date().toISOString();
  const slug = String(input.slug || current.slug || input.id || current.id || 'custom').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'custom';
  const priceCents = Number(input.priceCents ?? current.priceCents ?? (input.price != null ? Math.round(Number(input.price || 0) * 100) : 0)) || 0;
  const permissions = sanitizeCommercialPermissions(cleanGenerationPermissions(parsePermissions(input.permissions ?? current.permissions)));
  const officialRule = commercialPlanRule(slug);
  return {
    name: String(input.name || current.name || slug.toUpperCase()).slice(0, 160),
    slug: slug.slice(0, 80),
    description: String(input.description ?? current.description ?? '').slice(0, 1000),
    priceCents,
    billingCycle: String(input.billingCycle || input.billing || current.billingCycle || current.billing || 'anual').slice(0, 40),
    projectLimit: officialRule ? null : (input.projectLimit == null || input.projectLimit === '' || Number(input.projectLimit) <= 0 ? null : Number(input.projectLimit)),
    userLimit: input.userLimit == null || input.userLimit === '' ? null : Number(input.userLimit),
    storageLimitBytes: officialRule ? officialRule.storageBaseBytes : (input.storageLimitBytes == null || input.storageLimitBytes === '' ? null : Number(input.storageLimitBytes)),
    permissions: JSON.stringify(permissions),
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : input.active !== undefined ? Boolean(input.active) : current.isActive !== false && current.active !== false,
    createdAt: current.createdAt || now,
    updatedAt: now
  };
}

function planBySlug(slug = 'basic_annual') {
  const normalizedRaw = String(slug || 'basic_annual').trim().toLowerCase();
  const aliases = { basic: 'basic_annual', plus: 'plus_annual', pro: 'pro_annual', 'pro-max': 'pro_annual', promax: 'pro_annual', test_payment: 'basic_annual' };
  const normalized = aliases[normalizedRaw] || normalizedRaw;
  return DEFAULT_PLANS.find((plan) => plan.slug === normalized || plan.id === normalized) || DEFAULT_PLANS.find((plan) => plan.slug === 'basic_annual');
}


function canonicalPlanSlug(value = '') {
  const normalized = String(value || 'basic_annual').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'basic_annual';
  const aliases = { basic: 'basic_annual', plus: 'plus_annual', pro: 'pro_annual', 'pro-max': 'pro_annual', promax: 'pro_annual', test_payment: 'basic_annual' };
  return aliases[normalized] || normalized;
}

function planCanonicalKey(row = {}) {
  const rawSlug = row.slug || row.id || row.$id || row.name || '';
  const slug = canonicalPlanSlug(rawSlug);
  if (DEFAULT_PLANS.some((plan) => plan.slug === slug)) return slug;
  const nameKey = String(row.name || '').trim().toLowerCase();
  const byName = DEFAULT_PLANS.find((plan) => String(plan.name || '').trim().toLowerCase() === nameKey);
  return byName?.slug || slug;
}

async function findPlanRowsBySlug(slug = '') {
  const canonical = canonicalPlanSlug(slug);
  const rows = await listRows('plans', [Query.limit(500)]);
  return rows.filter((row) => planCanonicalKey(row) === canonical);
}

function newestPlanRow(rows = []) {
  return [...rows].sort((a, b) => {
    const aId = String(a.$id || a.id || '');
    const bId = String(b.$id || b.id || '');
    const aExact = aId === String(a.slug || '') ? 1 : 0;
    const bExact = bId === String(b.slug || '') ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    const at = Date.parse(a.updatedAt || a.$updatedAt || a.createdAt || a.$createdAt || 0) || 0;
    const bt = Date.parse(b.updatedAt || b.$updatedAt || b.createdAt || b.$createdAt || 0) || 0;
    return bt - at;
  })[0] || null;
}

async function upsertPlanBySlug(input = {}) {
  const data = planData(input);
  const slug = canonicalPlanSlug(data.slug || input.slug || input.id);
  data.slug = slug;
  const matches = await findPlanRowsBySlug(slug).catch(() => []);
  const current = newestPlanRow(matches);
  if (current?.$id || current?.id) {
    const row = await updateRow('plans', current.$id || current.id, planData({ ...input, slug }, current));
    return { plan: mapPlan(row), action: matches.length > 1 ? 'updated-existing-duplicate-kept' : 'updated-existing' };
  }
  const row = await createRow('plans', data, slug);
  return { plan: mapPlan(row), action: 'created' };
}

async function deletePlanByIdOrSlug(planId = '') {
  const id = decodeURIComponent(String(planId || '')).trim();
  if (!id) throw statusError(400, 'Plano inválido.');
  let current = await getRow('plans', id).catch(() => null);
  if (!current) {
    const matches = await findPlanRowsBySlug(id).catch(() => []);
    current = newestPlanRow(matches);
  }
  if (!current?.$id && !current?.id) throw statusError(404, 'Plano não encontrado.');
  const mapped = mapPlan(current);
  await deleteRow('plans', current.$id || current.id);
  return { deleted: true, plan: mapped };
}

async function dedupePlansServer({ syncOfficial = true } = {}) {
  const rows = await listRows('plans', [Query.limit(500)]).catch(() => []);
  let created = 0;
  let updated = 0;
  let deleted = 0;
  const deletedIds = [];
  const kept = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    if (!isObsoletePaymentTestPlan(row)) continue;
    const id = row.$id || row.id;
    if (!id) continue;
    await deleteRow('plans', id).catch(() => null);
    deleted += 1;
    deletedIds.push(id);
  }

  async function removeDuplicatesForKey(key, desired = null) {
    const freshRows = await listRows('plans', [Query.limit(500)]).catch(() => []);
    const matches = freshRows.filter((row) => planCanonicalKey(row) === key);
    let keeper = newestPlanRow(matches);
    if (!keeper && desired) {
      const row = await createRow('plans', planData({ ...desired, slug: key }), key);
      created += 1;
      keeper = row;
    }
    if (!keeper) return;
    if (desired) {
      keeper = await updateRow('plans', keeper.$id || keeper.id, planData({ ...desired, slug: key, updatedAt: now }, keeper));
      updated += 1;
    }
    kept.push({ id: keeper.$id || keeper.id, slug: key, name: keeper.name || desired?.name || key });
    for (const row of matches) {
      const id = row.$id || row.id;
      if (!id || id === (keeper.$id || keeper.id)) continue;
      await deleteRow('plans', id);
      deleted += 1;
      deletedIds.push(id);
    }
  }

  if (syncOfficial) {
    for (const preset of DEFAULT_PLANS) await removeDuplicatesForKey(preset.slug, preset);
  }

  const afterOfficial = await listRows('plans', [Query.limit(500)]).catch(() => []);
  const groups = new Map();
  for (const row of afterOfficial) {
    if (isObsoletePaymentTestPlan(row)) {
      const id = row.$id || row.id;
      if (id) {
        await deleteRow('plans', id).catch(() => null);
        deleted += 1;
        deletedIds.push(id);
      }
      continue;
    }
    const key = planCanonicalKey(row);
    if (DEFAULT_PLANS.some((plan) => plan.slug === key)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const [key, group] of groups.entries()) {
    if (group.length <= 1) continue;
    const keeper = newestPlanRow(group);
    kept.push({ id: keeper.$id || keeper.id, slug: key, name: keeper.name || key });
    for (const row of group) {
      const id = row.$id || row.id;
      if (!id || id === (keeper.$id || keeper.id)) continue;
      await deleteRow('plans', id);
      deleted += 1;
      deletedIds.push(id);
    }
  }

  let usersUpdated = 0;
  if (syncOfficial) {
    const profiles = await listProfilesFallback(500).catch(() => []);
    for (const profile of profiles) {
      if (String(profile.role || 'user').toLowerCase() === 'admin') continue;
      const plan = await findPlanBySlugSafe(profile.plan || profile.planSlug || 'basic_annual').catch(() => null);
      if (!plan || !profile.$id) continue;
      const expectedPermissions = JSON.stringify(cleanGenerationPermissions(plan.permissions || []));
      const currentPermissions = JSON.stringify(cleanGenerationPermissions(parsePermissions(profile.permissions)));
      if (currentPermissions === expectedPermissions) continue;
      await updateProfileRow(profile.$id, { permissions: expectedPermissions, updatedAt: now }).catch(() => null);
      usersUpdated += 1;
    }
  }

  const finalPlans = await listPlansSafe({ includeInactive: true }).catch(() => []);
  return { created, updated, deleted, deletedIds, kept, usersUpdated, total: finalPlans.length, plans: finalPlans };
}

const PLAN_CACHE_TTL_MS = 60_000;
let planRuntimeCache = { expiresAt: 0, plans: null, promise: null };

function clearPlanRuntimeCache() {
  planRuntimeCache = { expiresAt: 0, plans: null, promise: null };
}

async function cachedPlansSafe() {
  if (Array.isArray(planRuntimeCache.plans) && Date.now() < planRuntimeCache.expiresAt) return planRuntimeCache.plans;
  if (planRuntimeCache.promise) return planRuntimeCache.promise;
  planRuntimeCache.promise = listPlansSafe({ includeInactive: true })
    .then((plans) => {
      planRuntimeCache = { expiresAt: Date.now() + PLAN_CACHE_TTL_MS, plans, promise: null };
      return plans;
    })
    .catch((error) => {
      planRuntimeCache = { expiresAt: 0, plans: null, promise: null };
      throw error;
    });
  return planRuntimeCache.promise;
}

async function listPlansSafe({ includeInactive = false } = {}) {
  const legacyCommercialSlugs = new Set(['basic', 'plus', 'pro', 'pro-max', 'promax']);
  const official = new Map(DEFAULT_PLANS.map((plan) => [plan.slug, mapPlan(plan)]));
  for (const slug of LEGACY_MONTHLY_PLAN_SLUGS) {
    const legacy = official.get(slug);
    if (legacy) official.set(slug, { ...legacy, active: false, isActive: false });
  }
  try {
    const rows = await listRows('plans', [Query.limit(500)]);
    const mapped = rows.map(mapPlan);
    if (mapped.length) {
      for (const plan of mapped) {
        const slug = String(plan.slug || plan.id || '').toLowerCase();
        if (legacyCommercialSlugs.has(slug) || isObsoletePaymentTestPlan(plan)) continue;
        if (official.has(slug)) {
          const canonical = official.get(slug);
          const commercial = commercialPlanRule(slug);
          official.set(slug, {
            ...canonical,
            ...plan,
            id: plan.id || slug,
            slug,
            // R25.1: regras oficiais são autoridade do backend. O banco pode
            // personalizar apresentação/preço, mas não reabrir permissões ou
            // limites comerciais antigos por acidente.
            permissions: canonical.permissions,
            projectLimit: null,
            userLimit: canonical.userLimit,
            storageLimitBytes: commercial?.storageBaseBytes ?? canonical.storageLimitBytes,
            storageMaxBytes: commercial?.storageMaxBytes ?? canonical.storageMaxBytes,
            downloadDailyLimit: commercial?.downloadDailyLimit ?? canonical.downloadDailyLimit,
            exportDailyLimit: commercial?.exportDailyLimit ?? canonical.exportDailyLimit
          });
        } else official.set(slug, plan);
        if (LEGACY_MONTHLY_PLAN_SLUGS.has(slug)) {
          const legacy = official.get(slug);
          if (legacy) official.set(slug, { ...legacy, active: false, isActive: false });
        }
      }
      return [...official.values()]
        .filter((plan) => includeInactive || plan.isActive !== false)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    }
  } catch (error) {
    if (!(isUnknownAttributeError(error) || [400, 404].includes(Number(error.status)))) throw error;
  }
  return [...official.values()].filter((plan) => includeInactive || plan.isActive !== false);
}

async function findPlanBySlugSafe(slug = 'basic') {
  const normalized = String(slug || 'basic').trim().toLowerCase();
  const plans = await cachedPlansSafe().catch(() => DEFAULT_PLANS.map(mapPlan));
  return plans.find((plan) => plan.slug === normalized || String(plan.id).toLowerCase() === normalized) || mapPlan(planBySlug(normalized));
}

function permissionsForRoleAndPlan(role, planSlug) {
  if (String(role || '').toLowerCase() === 'admin') return JSON.stringify({ admin: true, all: true });
  const plan = planBySlug(planSlug);
  return JSON.stringify(sanitizeCommercialPermissions(plan.permissions || []));
}

async function listAppwriteUsers(limit = 200) {
  const byQuery = await awFetch(`/users${qs([Query.limit(limit)])}`).catch(() => null);
  if (Array.isArray(byQuery?.users)) return byQuery.users;
  const byParam = await awFetch(`/users?limit=${encodeURIComponent(String(limit))}`).catch(() => null);
  return Array.isArray(byParam?.users) ? byParam.users : [];
}

function isUnknownAttributeError(error) {
  const text = `${error?.message || ''} ${JSON.stringify(error?.details || {})}`;
  return /unknown attribute|invalid document structure|attribute .*not|not.*attribute|schema/i.test(text);
}

function basicProfileData(data) {
  const clean = { ...data };
  delete clean.status;
  delete clean.expiresAt;
  delete clean.isActive;
  delete clean.emailVerified;
  delete clean.emailVerifiedAt;
  delete clean.verificationRequired;
  delete clean.phone;
  delete clean.whatsapp;
  delete clean.whatsappOptIn;
  delete clean.whatsappReminderDays;
  return clean;
}

async function createProfileRow(data) {
  try { return await createRow('users_profile', data); }
  catch (error) {
    if (!isUnknownAttributeError(error)) throw error;
    return createRow('users_profile', basicProfileData(data));
  }
}

async function updateProfileRow(rowId, data) {
  try { return await updateRow('users_profile', rowId, data); }
  catch (error) {
    if (!isUnknownAttributeError(error)) throw error;
    return updateRow('users_profile', rowId, basicProfileData(data));
  }
}

function adminUserFromProfile(profile = {}, appwriteUser = {}, context = {}) {
  profile = profile && typeof profile === 'object' ? profile : {};
  appwriteUser = appwriteUser && typeof appwriteUser === 'object' ? appwriteUser : {};
  context = context && typeof context === 'object' ? context : {};
  const planProfile = (context.planProfile && typeof context.planProfile === 'object') ? context.planProfile : profile;
  const plan = planBySlug(planProfile.plan || planProfile.planSlug || 'basic');
  const generation = generationStatusForUser(profile, appwriteUser, plan, profile.role || 'user');
  const isSubuser = Boolean(context.membership);
  const expiresAt = context.expiresAt !== undefined ? context.expiresAt : profileExpiresAt(profile, appwriteUser);
  const planAppwriteUser = (context.planAppwriteUser && typeof context.planAppwriteUser === 'object') ? context.planAppwriteUser : appwriteUser;
  const ownStatus = profileStatus(profile, appwriteUser);
  const ownerStatus = isSubuser ? profileStatus(planProfile, planAppwriteUser) : ownStatus;
  const subscriptionExpired = isSubuser && subscriptionState({ role: 'user', expiresAt }).expired;
  const effectiveStatus = isSubuser
    ? (['blocked', 'bloqueado', 'pending', 'pendente'].includes(ownStatus)
      ? ownStatus
      : (['blocked', 'bloqueado'].includes(ownerStatus) ? 'blocked' : ((ownerStatus === 'expired' || subscriptionExpired) ? 'expired' : ownStatus)))
    : ownStatus;
  const effectiveActive = profileIsActive(profile, appwriteUser)
    && (!isSubuser || (profileIsActive(planProfile, planAppwriteUser) && !subscriptionExpired));
  const appwriteUserId = String(appwriteUser.$id || appwriteUser.id || '').trim();
  const profileUserId = String(profile.userId || '').trim();
  const profileId = profile.$id || profile.id || null;
  const profileMissing = context.profileMissing === true || !profileId;
  const authMissing = context.authMissing === true || !appwriteUserId;
  const idMismatch = context.idMismatch === true || Boolean(appwriteUserId && profileUserId && appwriteUserId !== profileUserId);
  const integrityStatus = profileMissing
    ? 'auth_only'
    : authMissing
      ? 'profile_only'
      : idMismatch
        ? 'id_mismatch'
        : 'complete';
  return {
    id: appwriteUserId || profileUserId || profileId,
    profileId,
    name: profile.name || appwriteUser.name || '',
    email: normalizeEmail(profile.email || appwriteUser.email || ''),
    ...userContactMeta(profile, appwriteUser),
    role: isSubuser && profile.role === 'admin' ? 'user' : (profile.role || 'user'),
    planId: plan.id,
    planSlug: plan.slug,
    planName: plan.name,
    permissions: parsePermissions(profile.permissions),
    allowedMemorialTemplateIds: memorialTemplateAccessForUser(appwriteUser),
    ...emailVerificationMeta(profile, appwriteUser),
    status: effectiveStatus,
    isActive: effectiveActive,
    expiresAt,
    subscriptionStatus: ownerStatus,
    subscriptionExpired,
    statusInherited: isSubuser,
    generation,
    accountType: isSubuser ? 'subuser' : 'primary',
    isSubuser,
    planInherited: isSubuser,
    integrityStatus,
    profileIncomplete: integrityStatus !== 'complete',
    canDeleteSafely: !isSubuser && ['auth_only', 'profile_only'].includes(integrityStatus),
    workspaceOwnerUserId: isSubuser ? String(context.membership.ownerUserId || '') : String(appwriteUserId || profileUserId || ''),
    workspaceOwnerName: context.ownerName || (isSubuser ? '' : (profile.name || appwriteUser.name || '')),
    workspaceName: isSubuser ? String(context.workspaceName || '').trim() : String(context.workspaceName || '').trim(),
    subscriptionSource: isSubuser ? 'workspace-owner' : 'own-account',
    workspaceRole: isSubuser ? (context.membership.memberRole || 'collaborator') : 'owner',
    paidExtraSeat: isSubuser ? Boolean(context.membership.paidExtraSeat) : false,
    seatPriceCents: isSubuser && context.membership.paidExtraSeat ? Number(context.membership.seatPriceCents || workspaceExtraSeatPriceCents(plan)) : 0,
    planLimits: {
      projectLimit: plan.projectLimit ?? null,
      userLimit: plan.userLimit ?? null,
      storageLimitBytes: plan.storageLimitBytes ?? null,
      billingCycle: plan.billingCycle || 'anual'
    },
    createdAt: profile.createdAt || appwriteUser.$createdAt || null,
    updatedAt: profile.updatedAt || appwriteUser.$updatedAt || null
  };
}

async function listAdminUsers() {
  const [profiles, appwriteUsers, memberships] = await Promise.all([
    listProfilesFallback(500),
    listAppwriteUsers(500),
    listAllWorkspaceMemberships()
  ]);
  const byId = new Map(appwriteUsers.map((user) => [String(user.$id || user.id || ''), user]));
  const byEmail = new Map(appwriteUsers.map((user) => [normalizeEmail(user.email), user]));
  const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId || ''), profile]));
  const membershipByUserId = new Map(memberships.map((membership) => [String(membership.userId || ''), membership]));
  const membersByOwner = new Map();
  memberships.forEach((membership) => {
    const ownerId = String(membership.ownerUserId || '');
    if (!ownerId) return;
    const list = membersByOwner.get(ownerId) || [];
    list.push(membership);
    membersByOwner.set(ownerId, list);
  });

  const result = profiles.map((profile) => {
    const userId = String(profile.userId || '');
    const membership = membershipByUserId.get(userId) || null;
    const ownerProfile = membership ? profileByUserId.get(String(membership.ownerUserId || '')) || null : null;
    const ownerAppwriteUser = ownerProfile ? byId.get(String(ownerProfile.userId || '')) || byEmail.get(normalizeEmail(ownerProfile.email)) || {} : {};
    const ownerWorkspaceName = ownerProfile ? (String(userPrefs(ownerAppwriteUser)?.surveyor?.workspaceName || '').trim() || `${ownerProfile.name || ownerAppwriteUser.name || 'Equipe'} — Equipe`) : '';
    const appwriteUser = byId.get(userId) || byEmail.get(normalizeEmail(profile.email)) || {};
    const appwriteUserId = String(appwriteUser.$id || appwriteUser.id || '').trim();
    return adminUserFromProfile(profile, appwriteUser, {
      membership,
      planProfile: ownerProfile || profile,
      planAppwriteUser: ownerProfile ? ownerAppwriteUser : appwriteUser,
      ownerName: ownerProfile?.name || ownerAppwriteUser?.name || '',
      workspaceName: ownerWorkspaceName,
      expiresAt: ownerProfile ? profileExpiresAt(ownerProfile, ownerAppwriteUser) : profileExpiresAt(profile, appwriteUser),
      authMissing: !appwriteUserId,
      idMismatch: Boolean(appwriteUserId && userId && appwriteUserId !== userId)
    });
  });
  const seen = new Set(result.map((user) => String(user.id || user.email)));
  for (const appwriteUser of appwriteUsers) {
    const key = String(appwriteUser.$id || appwriteUser.id || appwriteUser.email || '');
    if (!key || seen.has(key)) continue;
    const membership = membershipByUserId.get(String(appwriteUser.$id || appwriteUser.id || '')) || null;
    const ownerProfile = membership ? profileByUserId.get(String(membership.ownerUserId || '')) || null : null;
    const ownerAppwriteForMembership = ownerProfile ? (byId.get(String(ownerProfile.userId || '')) || byEmail.get(normalizeEmail(ownerProfile.email)) || {}) : {};
    const ownerWorkspaceName = ownerProfile ? (String(userPrefs(ownerAppwriteForMembership)?.surveyor?.workspaceName || '').trim() || `${ownerProfile.name || ownerAppwriteForMembership.name || 'Equipe'} — Equipe`) : '';
    result.push(adminUserFromProfile({ userId: appwriteUser.$id || appwriteUser.id, email: appwriteUser.email, name: appwriteUser.name, role: 'user', plan: ownerProfile?.plan || 'basic' }, appwriteUser, {
      membership,
      planProfile: ownerProfile || { plan: 'basic' },
      planAppwriteUser: ownerProfile ? ownerAppwriteForMembership : appwriteUser,
      ownerName: ownerProfile?.name || '',
      workspaceName: ownerWorkspaceName,
      expiresAt: ownerProfile ? profileExpiresAt(ownerProfile, ownerAppwriteForMembership) : null,
      profileMissing: true
    }));
  }

  result.forEach((user) => {
    if (user.isSubuser) return;
    const members = membersByOwner.get(String(user.id || '')) || [];
    const includedSeats = user.planLimits?.userLimit == null ? null : Math.max(1, Number(user.planLimits.userLimit) || 1);
    const paidExtraSeats = members.filter((member) => Boolean(member.paidExtraSeat)).length;
    const extraSeatPriceCents = workspaceExtraSeatPriceCents(planBySlug(user.planSlug || user.plan || 'basic_annual'));
    user.teamSummary = {
      memberCount: members.length,
      totalSeats: members.length + 1,
      includedSeats,
      includedRemaining: includedSeats == null ? null : Math.max(0, includedSeats - (members.length + 1)),
      paidExtraSeats,
      extraSeatPriceCents,
      additionalMonthlyCents: paidExtraSeats * extraSeatPriceCents
    };
  });

  return result.sort((a, b) => {
    if (a.isSubuser !== b.isSubuser) return a.isSubuser ? 1 : -1;
    return String(a.name || a.email).localeCompare(String(b.name || b.email), 'pt-BR');
  });
}

async function createOrUpdateAdminProfile(input, appwriteUser, existing = null) {
  const now = new Date().toISOString();
  if (!existing) {
    existing = await findProfileForLogin(appwriteUser.$id || appwriteUser.id, input.email || appwriteUser.email).catch(() => null);
  }
  const role = input.role || existing?.role || 'user';
  const plan = await findPlanBySlugSafe(input.planSlug || input.plan || existing?.plan || 'basic');
  const data = {
    userId: String(appwriteUser.$id || appwriteUser.id || existing?.userId || '').trim(),
    name: input.name || existing?.name || appwriteUser.name || 'Usuário',
    email: normalizeEmail(input.email || existing?.email || appwriteUser.email),
    role,
    plan: plan.slug,
    permissions: role === 'admin' ? JSON.stringify({ admin: true, all: true }) : JSON.stringify(plan.permissions || parsePermissions(existing?.permissions) || []),
    status: input.status || existing?.status || 'active',
    isActive: (input.status || existing?.status || 'active') === 'active',
    emailVerified: input.emailVerified !== undefined ? Boolean(input.emailVerified) : (existing?.emailVerified === true || existing?.emailVerified === 'true'),
    emailVerifiedAt: input.emailVerified === true ? (existing?.emailVerifiedAt || now) : (input.emailVerified === false ? null : existing?.emailVerifiedAt || null),
    verificationRequired: input.emailVerified !== undefined ? !Boolean(input.emailVerified) : !(existing?.emailVerified === true || existing?.emailVerified === 'true'),
    phone: input.phone || input.whatsapp || existing?.phone || existing?.whatsapp || '',
    whatsapp: input.whatsapp || input.phone || existing?.whatsapp || existing?.phone || '',
    whatsappOptIn: input.whatsappOptIn !== undefined ? Boolean(input.whatsappOptIn) : (existing?.whatsappOptIn !== false),
    whatsappReminderDays: JSON.stringify(normalizeReminderDays(input.whatsappReminderDays || existing?.whatsappReminderDays || [7, 1])),
    expiresAt: Object.prototype.hasOwnProperty.call(input, 'expiresAt') ? (input.expiresAt || null) : (existing?.expiresAt || null),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing?.$id) return updateProfileRow(existing.$id, data);
  try {
    return await createProfileRow(data);
  } catch (error) {
    const message = String(error?.message || error?.details?.message || '');
    const duplicate = error?.status === 409 || error?.code === 409 || /same ID already exists|target.*already exists|document.*already exists|row.*already exists/i.test(message);
    if (!duplicate) throw error;
    const recovered = await findProfileForLogin(data.userId, data.email).catch(() => null);
    if (!recovered?.$id) throw error;
    return updateProfileRow(recovered.$id, data);
  }
}


async function ensureWorkspaceCollectionAvailable() {
  try {
    await listRows('workspace_members', [Query.limit(1)]);
    return true;
  } catch (error) {
    if (workspaceSchemaMissing(error)) {
      throw statusError(503, 'Crie a collection workspace_members no Appwrite antes de usar equipes compartilhadas.', {
        code: 'WORKSPACE_SCHEMA_REQUIRED', collection: collectionId('workspace_members')
      });
    }
    throw error;
  }
}

async function workspaceOwnerAdminBundle(ownerUserId) {
  const ownerId = String(ownerUserId || '').trim();
  if (!ownerId) throw statusError(400, 'Titular da assinatura não informado.');
  const ownerMembership = await findWorkspaceMembershipByUserId(ownerId).catch(() => null);
  if (ownerMembership) throw statusError(409, 'Um subusuário não pode possuir outra equipe vinculada.', { code: 'WORKSPACE_NESTING_BLOCKED' });
  const ownerProfile = await findProfileByUserId(ownerId).catch(() => null);
  if (!ownerProfile) throw statusError(404, 'Usuário titular não encontrado.');
  const ownerAppwriteUser = await getAppwriteUserById(ownerId).catch(() => null) || {};
  const plan = await findPlanBySlugSafe(ownerProfile.plan || ownerProfile.planSlug || 'basic_annual');
  return { ownerId, ownerProfile, ownerAppwriteUser, plan };
}

async function workspaceSeatState(ownerUserId, plan = null) {
  const members = await listWorkspaceMembersByOwner(ownerUserId);
  const activeMembers = members.filter((membership) => membership && typeof membership === 'object' && String(membership.status || '').toLowerCase() !== 'deleted');
  const includedSeats = plan?.userLimit == null ? null : Math.max(1, Number(plan.userLimit) || 1);
  const totalSeats = activeMembers.length + 1;
  return {
    members: activeMembers,
    includedSeats,
    totalSeats,
    memberCount: activeMembers.length,
    paidExtraSeats: 0,
    extraSeatPriceCents: 0,
    includedRemaining: includedSeats == null ? null : Math.max(0, includedSeats - totalSeats),
    additionalMonthlyCents: 0
  };
}

async function rebalanceWorkspaceSeatLicenses(ownerUserId, plan = null) {
  const ownerId = String(ownerUserId || '').trim();
  if (!ownerId) return { updated: 0 };
  const effectivePlan = plan || (await workspaceOwnerAdminBundle(ownerId)).plan;
  const members = (await listWorkspaceMembersByOwner(ownerId))
    .filter((membership) => membership && typeof membership === 'object' && String(membership.status || '').toLowerCase() !== 'deleted');
  const includedTotal = Math.max(1, Number(effectivePlan?.userLimit || 1));
  let updated = 0;
  for (const membership of members) {
    if (!membership.paidExtraSeat && Number(membership.seatPriceCents || 0) === 0) continue;
    const rowId = membership.$id || membership.id;
    if (!rowId) continue;
    await updateWorkspaceMembership(rowId, { ...membership, paidExtraSeat: false, seatPriceCents: 0 }, membership);
    await updateAppwriteUserSurveyorPrefs(membership.userId, {
      workspaceOwnerUserId: ownerId,
      workspaceMemberRole: membership.memberRole || 'collaborator',
      paidExtraSeat: false,
      seatPriceCents: 0
    }).catch(() => null);
    updated += 1;
  }
  return { updated, includedTotal, extraSeatPriceCents: 0 };
}

async function workspaceAdminSummary(ownerUserId) {
  // O resumo é leitura: mesmo se a collection de membros ainda não estiver pronta,
  // plano/projetos/armazenamento do titular devem continuar renderizando no Admin.
  const bundle = await workspaceOwnerAdminBundle(ownerUserId);
  const { surveyor: ownerSurveyorPrefs } = userPrefs(bundle.ownerAppwriteUser || {});
  const workspaceName = String(ownerSurveyorPrefs.workspaceName || '').trim()
    || `${bundle.ownerProfile.name || bundle.ownerAppwriteUser.name || 'Equipe'} — Equipe`;

  // Carrega apenas o que pertence à equipe aberta. A versão anterior chamava
  // a listagem administrativa global, então um cadastro inconsistente de QUALQUER outro usuário
  // podia derrubar este modal inteiro. Aqui o resumo fica isolado por titular.
  const [seat, projectRows, documentRows] = await Promise.all([
    workspaceSeatState(bundle.ownerId, bundle.plan),
    listAllRows('projects', [Query.equal('userId', bundle.ownerId)]).catch(() => []),
    listAllRows('documents', [Query.equal('userId', bundle.ownerId)]).catch(() => [])
  ]);
  const activeProjects = (Array.isArray(projectRows) ? projectRows : [])
    .filter((row) => row && typeof row === 'object' && String(row.status || '').toLowerCase() !== 'deleted');
  const safeDocuments = (Array.isArray(documentRows) ? documentRows : [])
    .filter((row) => row && typeof row === 'object');
  const projectCount = activeProjects.length;
  // Projetos antigos nem sempre possuem `sizeBytes` na row. Em vez de baixar cada
  // payload, consultamos apenas os metadados do arquivo atual no Appwrite Storage.
  // O cache curto evita repetir essas consultas enquanto o Admin permanece aberto.
  const projectSizes = await Promise.all(activeProjects.map((row) => storedProjectBytes(row)));
  const projectBytes = projectSizes.reduce((sum, bytes) => sum + Math.max(0, Number(bytes) || 0), 0);
  const documentBytes = safeDocuments.reduce((sum, row) => sum + storedDocumentBytes(row), 0);
  const usage = { projectBytes, documentBytes, totalBytes: projectBytes + documentBytes, estimated: false };

  const memberRows = Array.isArray(seat?.members) ? seat.members.filter((row) => row && typeof row === 'object') : [];
  const enrichedMembers = (await Promise.all(memberRows.map(async (membership) => {
    const memberUserId = String(membership.userId || '').trim();
    if (!memberUserId) return null;
    const [profileResult, appwriteResult] = await Promise.allSettled([
      findProfileByUserId(memberUserId),
      getAppwriteUserById(memberUserId)
    ]);
    const appwriteUser = appwriteResult.status === 'fulfilled' && appwriteResult.value
      ? appwriteResult.value
      : {};
    const profile = profileResult.status === 'fulfilled' && profileResult.value
      ? profileResult.value
      : {
          userId: memberUserId,
          name: appwriteUser.name || 'Membro da equipe',
          email: appwriteUser.email || '',
          role: profileRoleFromWorkspaceRole(membership.memberRole || 'collaborator'),
          plan: bundle.ownerProfile.plan || bundle.ownerProfile.planSlug || bundle.plan?.slug || 'basic_annual',
          status: membership.status || 'active'
        };
    const member = adminUserFromProfile(profile, appwriteUser, {
      membership,
      planProfile: bundle.ownerProfile,
      ownerName: bundle.ownerProfile.name || bundle.ownerAppwriteUser.name || '',
      workspaceName,
      expiresAt: profileExpiresAt(bundle.ownerProfile, bundle.ownerAppwriteUser || {})
    });
    member.status = normalizeWorkspaceMemberStatus(membership.status || member.status || 'active');
    member.isActive = member.status === 'active' && appwriteUser.status !== false;
    member.personalStorage = { projectBytes: 0, documentBytes: 0, totalBytes: 0, limitBytes: null, shared: true };
    return member;
  }))).filter(Boolean);

  const ownerAdminUser = adminUserFromProfile(bundle.ownerProfile, bundle.ownerAppwriteUser || {});
  const ownerStorage = commercialStorageEntitlement(bundle.plan || {}, bundle.ownerAppwriteUser || {});
  return {
    name: workspaceName,
    owner: ownerAdminUser,
    plan: mapPlan(bundle.plan || {}),
    members: enrichedMembers,
    seats: {
      included: seat?.includedSeats ?? null,
      total: Number(seat?.totalSeats || 1),
      members: Number(seat?.memberCount || enrichedMembers.length || 0),
      remainingIncluded: seat?.includedRemaining ?? null,
      paidExtra: 0,
      extraSeatPriceCents: 0,
      additionalMonthlyCents: 0
    },
    projects: { used: projectCount, limit: null },
    storage: {
      usedBytes: usage.totalBytes,
      projectBytes: usage.projectBytes,
      documentBytes: usage.documentBytes,
      limitBytes: ownerStorage.effectiveBytes,
      baseBytes: ownerStorage.baseBytes,
      purchasedBytes: ownerStorage.purchasedBytes,
      maxBytes: ownerStorage.maxBytes,
      storeUrl: ownerStorage.storeUrl,
      subuserLimitBytes: null,
      sharedByAllMembers: true,
      estimated: Boolean(usage.estimated)
    }
  };
}

async function safeWorkspaceAdminSummary(ownerUserId) {
  try {
    return await workspaceAdminSummary(ownerUserId);
  } catch (error) {
    // A operação de inclusão/edição já pode ter sido concluída com sucesso.
    // Falha ao reconstruir o resumo não deve converter a gravação em HTTP 500.
    console.warn?.('[Surveyor API] resumo de equipe indisponível após gravação', String(error?.message || error));
    return null;
  }
}

function profileRoleFromWorkspaceRole(memberRole = 'collaborator') {
  const role = normalizeWorkspaceMemberRole(memberRole);
  if (role === 'technician') return 'technician';
  if (role === 'manager') return 'manager';
  return 'user';
}

function prepareOnboardingWorkspaceMembers(value, plan = {}, ownerEmail = '') {
  const source = Array.isArray(value) ? value : [];
  if (!source.length) return [];
  if (!workspacePlanAllowsMembers(plan)) {
    throw statusError(400, 'O plano Básico é individual. Remova os subusuários ou selecione Plus/Pro.', {
      code: 'WORKSPACE_PLAN_NOT_ALLOWED', planSlug: plan.slug || ''
    });
  }
  if (source.length > 12) throw statusError(400, 'Cadastre no máximo 12 subusuários por operação.');
  const includedSeats = plan.userLimit == null ? 1 : Math.max(1, Number(plan.userLimit) || 1);
  if (source.length + 1 > includedSeats) {
    throw statusError(409, `Este plano permite até ${includedSeats} usuário(s) na mesma equipe, contando o titular.`, { code: 'WORKSPACE_USER_LIMIT_REACHED', includedSeats });
  }
  const seenEmails = new Set([normalizeEmail(ownerEmail)]);
  return source.map((item, index) => {
    const name = String(item?.name || '').trim().slice(0, 180);
    const email = normalizeEmail(item?.email);
    if (!name || name.length < 3) throw statusError(400, `Informe o nome completo do subusuário ${index + 1}.`);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw statusError(400, `Informe um e-mail válido para o subusuário ${index + 1}.`);
    if (seenEmails.has(email)) throw statusError(409, `O e-mail ${email} está repetido no cadastro.`, { code: 'DUPLICATE_WORKSPACE_EMAIL' });
    seenEmails.add(email);
    return {
      name,
      email,
      whatsapp: String(item?.whatsapp || item?.phone || '').trim(),
      memberRole: normalizeWorkspaceMemberRole(item?.memberRole || item?.role || 'collaborator'),
      status: normalizeWorkspaceMemberStatus(item?.status || 'active'),
      sendWelcomeEmail: item?.sendWelcomeEmail !== false,
      paidExtraSeat: false,
      seatPriceCents: 0
    };
  });
}


async function migrateUserResourcesToWorkspace(ownerUserId, memberUserId, options = {}) {
  const ownerId = String(ownerUserId || '').trim();
  const memberId = String(memberUserId || '').trim();
  if (!ownerId || !memberId || ownerId === memberId) return { projects: 0, documents: 0, failed: 0, failures: [] };
  const now = new Date().toISOString();
  const memberUser = await getAppwriteUserById(memberId).catch(() => null);
  const memberCreatorName = String(options.memberName || memberUser?.name || '').trim().slice(0, 240);
  const [projects, documents] = await Promise.all([
    listAllRows('projects', [Query.equal('userId', memberId)]).catch(() => []),
    listAllRows('documents', [Query.equal('userId', memberId)]).catch(() => [])
  ]);
  const failures = [];
  let movedProjects = 0;
  let movedDocuments = 0;

  for (const row of projects) {
    const rowId = String(row.$id || row.id || '').trim();
    if (!rowId) continue;
    try {
      const payload = await readProjectPayload(row);
      const currentMetadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      const projectMetadata = payload?.project?.metadata && typeof payload.project.metadata === 'object' ? payload.project.metadata : {};
      const migratedMetadata = {
        ...projectMetadata,
        ...currentMetadata,
        createdByUserId: String(currentMetadata.createdByUserId || projectMetadata.createdByUserId || memberId),
        createdByName: String(currentMetadata.createdByName || projectMetadata.createdByName || memberCreatorName || '').slice(0, 240),
        storageOwnerUserId: ownerId,
        workspaceOwnerUserId: ownerId,
        migratedFromStandaloneUserId: String(currentMetadata.migratedFromStandaloneUserId || memberId),
        migratedToWorkspaceAt: currentMetadata.migratedToWorkspaceAt || now,
        migrationLastConfirmedAt: now
      };
      const nextPayload = {
        ...payload,
        project: { ...(payload?.project || {}), metadata: migratedMetadata },
        metadata: migratedMetadata,
        updatedAt: now
      };
      await commitProjectPayload(row, nextPayload, null, { userId: ownerId, updatedAt: now });
      movedProjects += 1;
    } catch (error) {
      failures.push({ type: 'project', id: rowId, message: String(error?.message || error).slice(0, 300) });
    }
  }

  for (const row of documents) {
    const rowId = String(row.$id || row.id || '').trim();
    if (!rowId) continue;
    try {
      const metadata = safeJson(row.metadata, {});
      const nextMetadata = {
        ...metadata,
        createdByUserId: String(metadata.createdByUserId || memberId),
        storageOwnerUserId: ownerId,
        workspaceOwnerUserId: ownerId,
        migratedFromStandaloneUserId: String(metadata.migratedFromStandaloneUserId || memberId),
        migratedToWorkspaceAt: metadata.migratedToWorkspaceAt || now,
        migrationLastConfirmedAt: now
      };
      const richPatch = { userId: ownerId, metadata: JSON.stringify(nextMetadata), updatedAt: now };
      try {
        await updateRow('documents', rowId, richPatch);
      } catch (error) {
        if (!isUnknownAttributeError(error)) throw error;
        try {
          await updateRow('documents', rowId, { userId: ownerId, metadata: JSON.stringify(nextMetadata) });
        } catch (inner) {
          if (!isUnknownAttributeError(inner)) throw inner;
          await updateRow('documents', rowId, { userId: ownerId });
        }
      }
      movedDocuments += 1;
    } catch (error) {
      failures.push({ type: 'document', id: rowId, message: String(error?.message || error).slice(0, 300) });
    }
  }

  return {
    projects: movedProjects,
    documents: movedDocuments,
    failed: failures.length,
    failures: failures.slice(0, 20),
    complete: failures.length === 0,
    ownerUserId: ownerId,
    memberUserId: memberId
  };
}

async function attachExistingUserToWorkspace({ ownerUserId, userId, input = {}, adminAuth = {}, request = null }) {
  await ensureWorkspaceCollectionAvailable().catch(() => false);
  const bundle = await workspaceOwnerAdminBundle(ownerUserId);
  if (!workspacePlanAllowsMembers(bundle.plan)) {
    throw statusError(403, 'O plano do titular não permite equipe.', { code: 'WORKSPACE_PLAN_NOT_ALLOWED', planSlug: bundle.plan.slug });
  }

  const targetId = String(userId || '').trim();
  if (!targetId) throw statusError(400, 'Selecione um usuário existente.');
  if (targetId === bundle.ownerId) throw statusError(409, 'O titular já faz parte da própria equipe.', { code: 'WORKSPACE_OWNER_AS_MEMBER' });

  const targetAppwriteUser = await getAppwriteUserById(targetId).catch(() => null);
  const targetProfile = await findProfileByUserId(targetId).catch(() => null);
  if (!targetAppwriteUser || !targetProfile) throw statusError(404, 'Usuário existente não encontrado.');
  if (String(targetProfile.role || '').toLowerCase() === 'admin') throw statusError(409, 'Conta administrativa não pode ser vinculada como membro de equipe.', { code: 'WORKSPACE_ADMIN_MEMBER_BLOCKED' });

  const ownedMembers = await listWorkspaceMembersByOwner(targetId).catch(() => []);
  if (ownedMembers.length) throw statusError(409, 'Este usuário já é titular de outra equipe. Desvincule os membros antes de movê-lo.', { code: 'WORKSPACE_OWNER_HAS_MEMBERS' });

  const memberRole = normalizeWorkspaceMemberRole(input.memberRole || input.role || 'collaborator');
  const status = normalizeWorkspaceMemberStatus(input.status || 'active');
  const existingMembership = await findWorkspaceMembershipByUserId(targetId).catch(() => null);
  if (existingMembership && String(existingMembership.ownerUserId || '') !== bundle.ownerId) {
    throw statusError(409, 'Este usuário já pertence a outra equipe.', { code: 'WORKSPACE_ALREADY_LINKED' });
  }

  if (!existingMembership) {
    const seatBefore = await workspaceSeatState(bundle.ownerId, bundle.plan);
    const nextSeatNumber = seatBefore.totalSeats + 1;
    if (seatBefore.includedSeats != null && nextSeatNumber > seatBefore.includedSeats) {
      throw statusError(409, `Esta equipe já atingiu o limite de ${seatBefore.includedSeats} usuário(s) previsto no plano.`, {
        code: 'WORKSPACE_USER_LIMIT_REACHED', includedSeats: seatBefore.includedSeats, totalSeats: seatBefore.totalSeats, nextSeatNumber
      });
    }
  }

  const { surveyor: previousPrefs } = userPrefs(targetAppwriteUser);
  const previousPlanSlug = String(previousPrefs.workspacePreviousPlanSlug || targetProfile.plan || targetProfile.planSlug || 'basic_annual');
  const previousExpiresAt = previousPrefs.workspacePreviousExpiresAt !== undefined
    ? previousPrefs.workspacePreviousExpiresAt
    : (targetProfile.expiresAt || null);
  const previousRole = String(previousPrefs.workspacePreviousRole || targetProfile.role || 'user');
  const previousStatus = String(previousPrefs.workspacePreviousStatus || targetProfile.status || 'active');

  let membership = existingMembership;
  const membershipInput = {
    userId: targetId,
    ownerUserId: bundle.ownerId,
    memberRole,
    status,
    paidExtraSeat: false,
    seatPriceCents: 0,
    createdByAdminId: adminAuth.sub || ''
  };
  try {
    if (!membership || membership._workspaceStorage === 'prefs' || !(membership.$id || membership.id)) {
      membership = await createWorkspaceMembership(membershipInput);
    } else {
      membership = await updateWorkspaceMembership(membership.$id || membership.id, {
        ...membership, ...membershipInput
      }, membership);
    }
  } catch (membershipError) {
    if (!workspaceMembershipStorageError(membershipError)) throw membershipError;
    console.warn?.('[Surveyor API] vínculo salvo via prefs por incompatibilidade de workspace_members', String(membershipError?.message || membershipError));
    membership = workspaceSyntheticMembership(membershipInput);
  }

  await updateAppwriteUserStatus(targetId, status === 'active');
  await updateAppwriteUserSurveyorPrefs(targetId, {
    status,
    workspaceOwnerUserId: bundle.ownerId,
    workspaceMemberRole: memberRole,
    paidExtraSeat: false,
    seatPriceCents: 0,
    workspaceJoinedFromExisting: true,
    workspaceJoinedAt: previousPrefs.workspaceJoinedAt || new Date().toISOString(),
    workspacePreviousPlanSlug: previousPlanSlug,
    workspacePreviousExpiresAt: previousExpiresAt,
    workspacePreviousRole: previousRole,
    workspacePreviousStatus: previousStatus
  });

  const updatedProfile = await createOrUpdateAdminProfile({
    ...targetProfile,
    name: targetProfile.name || targetAppwriteUser.name,
    email: targetProfile.email || targetAppwriteUser.email,
    role: profileRoleFromWorkspaceRole(memberRole),
    planSlug: bundle.plan.slug,
    status,
    expiresAt: null
  }, targetAppwriteUser, targetProfile);

  const migration = await migrateUserResourcesToWorkspace(bundle.ownerId, targetId, { adminUserId: adminAuth.sub || '' });
  await rebalanceWorkspaceSeatLicenses(bundle.ownerId, bundle.plan);

  await appendSecurityEvent({
    type: 'workspace', action: 'workspace_existing_user_attached', actorUserId: adminAuth.sub, actorEmail: adminAuth.user?.email,
    targetUserId: targetId, targetEmail: targetProfile.email || targetAppwriteUser.email,
    ip: request ? requestIp(request) : '', userAgent: request ? requestUserAgent(request) : '', status: migration.complete ? 'ok' : 'warning',
    message: `Usuário existente adicionado à equipe ${bundle.ownerProfile.name || bundle.ownerId}.`,
    metadata: { ownerUserId: bundle.ownerId, memberRole, migration }
  }).catch(() => null);

  const refreshed = await getAppwriteUserById(targetId).catch(() => targetAppwriteUser);
  const user = adminUserFromProfile(updatedProfile, refreshed, {
    membership,
    planProfile: bundle.ownerProfile,
    ownerName: bundle.ownerProfile.name || bundle.ownerAppwriteUser.name || '',
    expiresAt: profileExpiresAt(bundle.ownerProfile, bundle.ownerAppwriteUser)
  });
  return {
    user,
    migration,
    migrationWarning: migration.complete ? '' : 'Alguns itens não puderam ser transferidos. O vínculo foi mantido e a migração pode ser repetida com segurança.',
    team: await safeWorkspaceAdminSummary(bundle.ownerId)
  };
}

async function createWorkspaceMember({ ownerUserId, input = {}, adminAuth = {}, request = null }) {
  await ensureWorkspaceCollectionAvailable().catch(() => false);
  if (String(input.existingUserId || '').trim()) {
    return attachExistingUserToWorkspace({ ownerUserId, userId: input.existingUserId, input, adminAuth, request });
  }
  const bundle = await workspaceOwnerAdminBundle(ownerUserId);
  if (!workspacePlanAllowsMembers(bundle.plan)) {
    throw statusError(403, 'O plano Básico é individual e não permite subusuários. Altere o titular para Plus ou Pro antes de criar a equipe.', {
      code: 'WORKSPACE_PLAN_NOT_ALLOWED', planSlug: bundle.plan.slug
    });
  }
  const email = normalizeEmail(input.email);
  const name = String(input.name || '').trim().slice(0, 180);
  const memberRole = normalizeWorkspaceMemberRole(input.memberRole || input.role || 'collaborator');
  const status = normalizeWorkspaceMemberStatus(input.status || 'active');
  if (!name) throw statusError(400, 'Informe o nome do subusuário.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw statusError(400, 'Informe um e-mail válido para o subusuário.');
  const existingUser = await getAppwriteUserByEmail(email).catch(() => null);
  if (existingUser) throw statusError(409, 'Este e-mail já pertence a um usuário. Use “Usuário existente” para adicioná-lo à equipe.', { code: 'EMAIL_ALREADY_EXISTS', canAttachExistingUser: true });

  const seatBefore = await workspaceSeatState(bundle.ownerId, bundle.plan);
  const nextSeatNumber = seatBefore.totalSeats + 1;
  if (seatBefore.includedSeats != null && nextSeatNumber > seatBefore.includedSeats) {
    throw statusError(409, `Esta equipe já atingiu o limite de ${seatBefore.includedSeats} usuário(s) previsto no plano do titular.`, {
      code: 'WORKSPACE_USER_LIMIT_REACHED', includedSeats: seatBefore.includedSeats, totalSeats: seatBefore.totalSeats, nextSeatNumber
    });
  }
  const paidExtraSeat = false;

  let appwriteUser = null;
  let profile = null;
  let membership = null;
  try {
    const bootstrapPassword = `${crypto.randomBytes(24).toString('base64url')}aA1!`;
    appwriteUser = await createAppwriteUser({ email, password: bootstrapPassword, name });
    const userId = String(appwriteUser.$id || appwriteUser.id || '').trim();
    const normalizedWhatsapp = normalizeBrazilPhone(input.whatsapp || input.phone || '');
    if (normalizedWhatsapp) await updateAppwriteUserPhone(userId, normalizedWhatsapp);
    await updateAppwriteUserEmailVerification(userId, input.emailVerified === true);
    await updateAppwriteUserStatus(userId, status === 'active');
    await updateAppwriteUserSurveyorPrefs(userId, {
      status,
      mustChangePassword: true,
      firstAccessInviteIssuedAt: new Date().toISOString(),
      workspaceOwnerUserId: bundle.ownerId,
      workspaceMemberRole: memberRole,
      paidExtraSeat,
      seatPriceCents: 0,
      phone: normalizedWhatsapp,
      whatsapp: normalizedWhatsapp,
      whatsappOptIn: input.whatsappOptIn !== false,
      whatsappReminderDays: normalizeReminderDays(input.whatsappReminderDays || [7, 1]),
      workspaceJoinedFromExisting: false,
      workspaceJoinedAt: new Date().toISOString(),
      workspacePreviousPlanSlug: 'basic_annual',
      workspacePreviousExpiresAt: null,
      workspacePreviousRole: 'user',
      workspacePreviousStatus: 'active'
    }).catch(() => null);
    profile = await createOrUpdateAdminProfile({
      name, email,
      role: profileRoleFromWorkspaceRole(memberRole),
      planSlug: bundle.plan.slug,
      status,
      emailVerified: input.emailVerified === true,
      whatsapp: normalizedWhatsapp,
      whatsappOptIn: input.whatsappOptIn !== false,
      whatsappReminderDays: input.whatsappReminderDays || [7, 1],
      expiresAt: null
    }, appwriteUser, null);
    const membershipInput = {
      userId, ownerUserId: bundle.ownerId, memberRole, status, paidExtraSeat,
      seatPriceCents: 0,
      createdByAdminId: adminAuth.sub || ''
    };
    try {
      membership = await createWorkspaceMembership(membershipInput);
    } catch (membershipError) {
      if (!workspaceMembershipStorageError(membershipError)) throw membershipError;
      console.warn?.('[Surveyor API] novo membro vinculado via prefs por incompatibilidade de workspace_members', String(membershipError?.message || membershipError));
      membership = workspaceSyntheticMembership(membershipInput);
    }
    await rebalanceWorkspaceSeatLicenses(bundle.ownerId, bundle.plan);

    const firstAccessInvitation = buildFirstAccessInvitation({ userId, email });
    let welcomeEmail = { sent: false, skipped: true };
    if (input.sendWelcomeEmail !== false) {
      try {
        welcomeEmail = await dispatchWorkspaceWelcomeEmail({
          to: email, name, ownerName: bundle.ownerProfile.name || bundle.ownerAppwriteUser.name || 'Titular',
          planName: bundle.plan.name, memberRole, paidExtraSeat: false, firstAccessUrl: firstAccessInvitation.url
        });
      } catch (error) {
        welcomeEmail = { sent: false, skipped: false, error: String(error?.message || 'Falha no envio do e-mail.').slice(0, 500) };
      }
    }
    await appendSecurityEvent({
      type: 'workspace', action: 'workspace_member_created', actorUserId: adminAuth.sub, actorEmail: adminAuth.user?.email,
      targetUserId: userId, targetEmail: email, ip: request ? requestIp(request) : '', userAgent: request ? requestUserAgent(request) : '', status: 'ok',
      message: `Subusuário vinculado a ${bundle.ownerProfile.email || bundle.ownerId}.`,
      metadata: { ownerUserId: bundle.ownerId, memberRole, paidExtraSeat: false, seatPriceCents: 0 }
    }).catch(() => null);
    const refreshedAppwriteUser = await getAppwriteUserById(userId).catch(() => appwriteUser);
    const user = adminUserFromProfile(profile, refreshedAppwriteUser, {
      membership, planProfile: bundle.ownerProfile, ownerName: bundle.ownerProfile.name || bundle.ownerAppwriteUser.name || '',
      expiresAt: profileExpiresAt(bundle.ownerProfile, bundle.ownerAppwriteUser)
    });
    return { user, welcomeEmail, firstAccessRequired: true, team: await safeWorkspaceAdminSummary(bundle.ownerId) };
  } catch (error) {
    if (!membership) {
      if (profile?.$id || profile?.id) await deleteRow('users_profile', profile.$id || profile.id).catch(() => null);
      if (appwriteUser?.$id || appwriteUser?.id) await deleteAppwriteUser(appwriteUser.$id || appwriteUser.id).catch(() => null);
    }
    if (workspaceSchemaMissing(error)) throw statusError(503, 'A collection workspace_members não está pronta no Appwrite.', { code: 'WORKSPACE_SCHEMA_REQUIRED' });
    throw error;
  }
}

async function updateWorkspaceMember({ userId, input = {}, adminAuth = {}, request = null }) {
  await ensureWorkspaceCollectionAvailable().catch(() => false);
  const membership = await findWorkspaceMembershipByUserId(userId);
  if (!membership) throw statusError(404, 'Subusuário não encontrado.');
  const bundle = await workspaceOwnerAdminBundle(membership.ownerUserId);
  const profile = await findProfileByUserId(userId).catch(() => null);
  if (!profile) throw statusError(404, 'Perfil do subusuário não encontrado.');
  const appwriteUser = await getAppwriteUserById(userId).catch(() => ({ $id: userId, email: profile.email, name: profile.name }));
  const memberRole = normalizeWorkspaceMemberRole(input.memberRole || input.role || membership.memberRole || 'collaborator');
  const status = normalizeWorkspaceMemberStatus(input.status || membership.status || profile.status || 'active');
  const paidExtraSeat = false;

  if (input.name) await updateAppwriteUserName(userId, input.name);
  if (Object.prototype.hasOwnProperty.call(input, 'emailVerified')) await updateAppwriteUserEmailVerification(userId, input.emailVerified === true);
  if (input.password) {
    assertStrongPassword(input.password, 'A nova senha');
    await updateAppwriteUserPassword(userId, input.password);
    const passwordChangedAt = new Date().toISOString();
    await updateAppwriteUserSurveyorPrefs(userId, { remoteLogoutAt: passwordChangedAt, sessionVersion: appwriteId(), passwordResetByAdminAt: passwordChangedAt }).catch(() => null);
  }
  const contactChanged = Object.prototype.hasOwnProperty.call(input, 'whatsapp') || Object.prototype.hasOwnProperty.call(input, 'phone');
  const normalizedWhatsapp = contactChanged ? normalizeBrazilPhone(input.whatsapp || input.phone || '') : userContactMeta(profile, appwriteUser).whatsapp;
  if (contactChanged && normalizedWhatsapp) await updateAppwriteUserPhone(userId, normalizedWhatsapp);
  await updateAppwriteUserStatus(userId, status === 'active');
  await updateAppwriteUserSurveyorPrefs(userId, {
    status, workspaceOwnerUserId: bundle.ownerId, workspaceMemberRole: memberRole, paidExtraSeat,
    seatPriceCents: 0,
    phone: normalizedWhatsapp, whatsapp: normalizedWhatsapp
  }).catch(() => null);
  const updatedProfile = await createOrUpdateAdminProfile({
    ...profile, ...input, email: profile.email,
    role: profileRoleFromWorkspaceRole(memberRole), planSlug: bundle.plan.slug, status,
    emailVerified: Object.prototype.hasOwnProperty.call(input, 'emailVerified') ? input.emailVerified === true : profile.emailVerified,
    whatsapp: normalizedWhatsapp, expiresAt: null
  }, appwriteUser, profile);
  const membershipInput = {
    ...membership, userId, ownerUserId: bundle.ownerId, memberRole, status, paidExtraSeat,
    seatPriceCents: 0,
    createdByAdminId: membership.createdByAdminId || adminAuth.sub || ''
  };
  let updatedMembership = workspaceSyntheticMembership(membershipInput);
  if (membership.$id || membership.id) {
    try {
      updatedMembership = await updateWorkspaceMembership(membership.$id || membership.id, membershipInput, membership);
    } catch (membershipError) {
      if (!workspaceMembershipStorageError(membershipError)) throw membershipError;
      console.warn?.('[Surveyor API] atualização de membro mantida via prefs', String(membershipError?.message || membershipError));
    }
  }
  await rebalanceWorkspaceSeatLicenses(bundle.ownerId, bundle.plan);
  await appendSecurityEvent({
    type: 'workspace', action: 'workspace_member_updated', actorUserId: adminAuth.sub, actorEmail: adminAuth.user?.email,
    targetUserId: userId, targetEmail: profile.email, ip: request ? requestIp(request) : '', userAgent: request ? requestUserAgent(request) : '', status: 'ok',
    message: 'Subusuário atualizado.', metadata: { ownerUserId: bundle.ownerId, memberRole, paidExtraSeat: false }
  }).catch(() => null);
  const refreshed = await getAppwriteUserById(userId).catch(() => appwriteUser);
  return {
    user: adminUserFromProfile(updatedProfile, refreshed, {
      membership: updatedMembership, planProfile: bundle.ownerProfile,
      ownerName: bundle.ownerProfile.name || bundle.ownerAppwriteUser.name || '',
      expiresAt: profileExpiresAt(bundle.ownerProfile, bundle.ownerAppwriteUser)
    }),
    team: await safeWorkspaceAdminSummary(bundle.ownerId)
  };
}

async function deleteWorkspaceMember({ userId, adminAuth = {}, request = null }) {
  await ensureWorkspaceCollectionAvailable().catch(() => false);
  const membership = await findWorkspaceMembershipByUserId(userId);
  if (!membership) throw statusError(404, 'Membro não encontrado.');
  const ownerUserId = String(membership.ownerUserId || '').trim();
  const profile = await findProfileByUserId(userId).catch(() => null);
  const appwriteUser = await getAppwriteUserById(userId).catch(() => null);
  if (!profile || !appwriteUser) throw statusError(404, 'Conta do membro não encontrada.');
  const { surveyor } = userPrefs(appwriteUser);
  const restorePlanSlug = String(surveyor.workspacePreviousPlanSlug || 'basic_annual');
  const restoreExpiresAt = surveyor.workspacePreviousExpiresAt || null;
  const restoreRole = String(surveyor.workspacePreviousRole || 'user');
  const restoreStatus = normalizeWorkspaceMemberStatus(surveyor.workspacePreviousStatus || 'active');

  // Os projetos/documentos já pertencem ao espaço compartilhado do titular e
  // permanecem ali. Remover o membro nunca apaga o login nem os arquivos da equipe.
  await createOrUpdateAdminProfile({
    ...profile,
    role: restoreRole,
    planSlug: restorePlanSlug,
    status: restoreStatus,
    expiresAt: restoreExpiresAt
  }, appwriteUser, profile);
  await updateAppwriteUserSurveyorPrefs(userId, {
    status: restoreStatus,
    workspaceOwnerUserId: undefined,
    workspaceMemberRole: undefined,
    paidExtraSeat: undefined,
    seatPriceCents: undefined,
    workspaceJoinedFromExisting: undefined,
    workspaceJoinedAt: undefined,
    workspacePreviousPlanSlug: undefined,
    workspacePreviousExpiresAt: undefined,
    workspacePreviousRole: undefined,
    workspacePreviousStatus: undefined,
    remoteLogoutAt: new Date().toISOString(),
    sessionVersion: appwriteId(),
    authSessions: []
  });
  await updateAppwriteUserStatus(userId, restoreStatus === 'active').catch(() => null);
  if (membership.$id || membership.id) await deleteRow('workspace_members', membership.$id || membership.id).catch((membershipError) => {
    if (!workspaceMembershipStorageError(membershipError)) throw membershipError;
  });
  const ownerBundle = await workspaceOwnerAdminBundle(ownerUserId).catch(() => null);
  if (ownerBundle?.plan) await rebalanceWorkspaceSeatLicenses(ownerUserId, ownerBundle.plan);
  await appendSecurityEvent({
    type: 'workspace', action: 'workspace_member_unlinked', actorUserId: adminAuth.sub, actorEmail: adminAuth.user?.email,
    targetUserId: userId, targetEmail: profile?.email || '', ip: request ? requestIp(request) : '', userAgent: request ? requestUserAgent(request) : '', status: 'ok',
    message: 'Membro desvinculado. Login preservado; projetos compartilhados permaneceram com a equipe.', metadata: { ownerUserId, restoredPlanSlug: restorePlanSlug }
  }).catch(() => null);
  return { ownerUserId, userPreserved: true, sharedResourcesPreserved: true, team: await safeWorkspaceAdminSummary(ownerUserId) };
}


async function rowsForAnyUserId(collection, userIds = []) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).map((value) => String(value || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  const collected = [];
  const seen = new Set();
  for (const id of ids) {
    const rows = await listAllRows(collection, [Query.equal('userId', id)]).catch(() => []);
    for (const row of rows) {
      const key = String(row.$id || row.id || `${collection}:${id}:${collected.length}`);
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(row);
    }
  }
  return collected;
}

async function deleteUserCustomizations(userIds = []) {
  const rows = await rowsForAnyUserId('customization', userIds);
  const fileFields = ['logoFileId', 'baseTemplateFileId', 'planDocumentSignatureFileId'];
  for (const row of rows) {
    for (const field of fileFields) {
      const fileId = String(row?.[field] || '').trim();
      if (fileId) await deleteFile(bucketId('user_assets'), fileId).catch(() => null);
    }
    const rowId = row.$id || row.id;
    if (rowId) await deleteRow('customization', rowId).catch(() => null);
  }
  return rows.length;
}

async function userDeletionImpact(userIds = [], ownerUserId = '') {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).map((value) => String(value || '').trim()).filter(Boolean))];
  const ownerId = String(ownerUserId || ids[0] || '').trim();
  const [projects, documents, teamMembers] = await Promise.all([
    rowsForAnyUserId('projects', ids),
    rowsForAnyUserId('documents', ids),
    ownerId ? listWorkspaceMembersByOwner(ownerId).catch(() => []) : Promise.resolve([])
  ]);
  return {
    projects: projects.length,
    documents: documents.length,
    teamMembers: teamMembers.length,
    hasProtectedData: Boolean(projects.length || documents.length || teamMembers.length)
  };
}

async function deleteAppwriteUser(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;
  return awFetch(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((error) => {
    if (Number(error?.appwriteStatus || error?.status) === 404) return null;
    throw error;
  });
}

async function updateAppwriteUserName(userId, name) {
  if (!userId || !name) return null;
  return awFetch(`/users/${encodeURIComponent(userId)}/name`, { method: 'PATCH', body: JSON.stringify({ name }) }).catch(() => null);
}

async function updateAppwriteUserPassword(userId, password) {
  if (!userId || !password) return null;
  return awFetch(`/users/${encodeURIComponent(userId)}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }).catch(() => null);
}

async function updateAppwriteUserPasswordStrict(userId, password) {
  const id = String(userId || '').trim();
  const nextPassword = String(password || '');
  if (!id || !nextPassword) throw statusError(400, 'Usuário ou senha não informado.');
  return awFetch(`/users/${encodeURIComponent(id)}/password`, { method: 'PATCH', body: JSON.stringify({ password: nextPassword }) });
}

async function updateAppwriteUserEmail(userId, email) {
  const id = String(userId || '').trim();
  const normalizedEmail = normalizeEmail(email);
  if (!id || !normalizedEmail) return null;
  return awFetch(`/users/${encodeURIComponent(id)}/email`, {
    method: 'PATCH',
    body: JSON.stringify({ email: normalizedEmail })
  });
}

async function serializeDocumentRow(row = {}) {
  const bucket = row.bucketId || bucketId('generated_documents');
  const metadata = safeJson(row.metadata, {});
  const tags = safeJson(row.tags, []);
  const isGoogleDrive = bucket === 'google_drive' || row.storageProvider === 'google_drive' || metadata.storageProvider === 'google_drive';
  const content = isGoogleDrive ? '' : (row.fileId ? await readFileText(bucket, row.fileId) : '');
  const title = row.name || row.title || row.fileName || metadata.fileName || 'Documento';
  return {
    id: row.$id || row.id,
    ownerUserId: row.userId,
    title,
    category: row.type || row.category || metadata.category || 'outros',
    fileName: row.fileName || metadata.fileName || title || 'documento.txt',
    mimeType: row.format || row.mimeType || metadata.mimeType || 'text/plain',
    content,
    sizeBytes: Number(row.sizeBytes || metadata.sizeBytes || (isGoogleDrive ? 0 : Buffer.byteLength(content || '', 'utf8'))) || 0,
    tags: Array.isArray(tags) ? tags : [],
    status: row.status || metadata.status || 'saved',
    folder: row.folderName || row.folderId || metadata.folderName || metadata.folderId || '',
    folderName: row.folderName || metadata.folderName || '',
    folderId: row.folderId || metadata.folderId || '',
    storageProvider: isGoogleDrive ? 'google_drive' : 'appwrite',
    externalFileId: isGoogleDrive ? (row.fileId || metadata.externalFileId || '') : '',
    downloadUrl: isGoogleDrive ? `/api/documents/${encodeURIComponent(row.$id || row.id)}/download` : '',
    createdAt: row.createdAt || row.$createdAt || metadata.createdAt || null,
    updatedAt: row.updatedAt || row.$updatedAt || row.createdAt || metadata.updatedAt || null
  };
}

const DOCUMENT_DESTRUCTIVE_STATUSES = new Set(['deleted', 'delete', 'trash', 'trashed', 'removed', 'removido', 'excluido', 'excluído']);
const DOCUMENT_SERVER_METADATA_KEYS = new Set([
  'storageprovider', 'externalfileid', 'storageowneruserid', 'workspaceowneruserid',
  'createdbyuserid', 'createdbyname', 'updatedbyuserid', 'updatedbyname',
  'createdat', 'updatedat'
]);
const DOCUMENT_SERVER_TOP_LEVEL_KEYS = new Set([
  'id', 'userid', 'owneruserid', 'bucketid', 'storageprovider',
  'externalfileid', 'createdat', 'updatedat'
]);

function sanitizeDocumentStatus(value, fallback = 'saved') {
  const raw = String(value ?? '').trim();
  if (!raw) return String(fallback || 'saved').slice(0, 40);
  if (DOCUMENT_DESTRUCTIVE_STATUSES.has(raw.toLowerCase())) return String(fallback || 'saved').slice(0, 40);
  return raw.slice(0, 40);
}

function assertDocumentMutationStatusAllowed(input = {}) {
  const status = String(input?.status || '').trim().toLowerCase();
  if (DOCUMENT_DESTRUCTIVE_STATUSES.has(status)) {
    throw statusError(403, 'Use a operação de exclusão do documento em vez de alterar o status manualmente.', { code: 'DOCUMENT_DELETE_ROUTE_REQUIRED' });
  }
}

function sanitizeDocumentClientMetadata(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clean = {};
  for (const [key, entry] of Object.entries(source)) {
    if (DOCUMENT_SERVER_METADATA_KEYS.has(String(key || '').toLowerCase())) continue;
    clean[key] = entry;
  }
  return clean;
}

function sanitizeDocumentClientInput(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  assertDocumentMutationStatusAllowed(source);
  const clean = {};
  for (const [key, entry] of Object.entries(source)) {
    if (DOCUMENT_SERVER_TOP_LEVEL_KEYS.has(String(key || '').toLowerCase())) continue;
    clean[key] = entry;
  }
  clean.metadata = sanitizeDocumentClientMetadata(source.metadata);
  return clean;
}

async function assertOptionalProjectBelongsToAuth(projectIdValue, auth = {}) {
  const id = String(projectIdValue || '').trim();
  if (!id) return null;
  const row = await getRow('projects', id).catch(() => null);
  if (!row || String(row.userId || '') !== resourceOwnerId(auth) || String(row.status || '').toLowerCase() === 'deleted') {
    throw statusError(404, 'Projeto relacionado não encontrado.', { code: 'RELATED_PROJECT_NOT_FOUND' });
  }
  return row;
}

function documentData(input, userId, fileId, bucket, current = {}) {
  const title = input.title || input.name || input.fileName || current.name || current.title || 'Documento';
  const now = new Date().toISOString();
  const tags = Array.isArray(input.tags) ? input.tags : (Array.isArray(current.tags) ? current.tags : safeJson(current.tags, []));
  const status = sanitizeDocumentStatus(input.status, current.status || 'saved');
  const metadata = {
    ...(safeJson(current.metadata, {}) || {}),
    ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
    fileName: String(input.fileName || current.fileName || title || 'documento.txt').slice(0, 240),
    folderName: String(input.folderName || input.folder || current.folderName || '').slice(0, 120),
    folderId: String(input.folderId || input.folder_id || input.folder || current.folderId || '').slice(0, 160),
    sizeBytes: Number(input.sizeBytes ?? input.originalSizeBytes ?? current.sizeBytes ?? 0) || 0,
    status
  };
  const effectiveBucket = bucket || current.bucketId || bucketId('generated_documents');
  if (effectiveBucket === 'google_drive') {
    metadata.storageProvider = 'google_drive';
    metadata.externalFileId = String(fileId || current.fileId || metadata.externalFileId || '');
  } else {
    delete metadata.storageProvider;
    delete metadata.externalFileId;
  }
  return {
    userId,
    projectId: input.projectId ?? current.projectId ?? '',
    type: input.category || input.type || current.type || 'outros',
    format: input.mimeType || input.format || current.format || 'text/plain',
    name: String(title).slice(0, 240),
    fileId: fileId || current.fileId || '',
    bucketId: effectiveBucket,
    fileName: metadata.fileName,
    tags: JSON.stringify(tags || []),
    folderName: metadata.folderName,
    folderId: metadata.folderId,
    sizeBytes: metadata.sizeBytes,
    status: metadata.status,
    metadata: JSON.stringify(metadata),
    createdAt: current.createdAt || now,
    updatedAt: now
  };
}

function layerGroupData(input = {}, current = {}) {
  const now = new Date().toISOString();
  const name = String(input.name || current.name || 'Grupo de camadas').slice(0, 160);
  const slug = String(input.slug || current.slug || name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || appwriteId()).slice(0, 180);
  return {
    name,
    slug,
    description: String(input.description || current.description || '').slice(0, 700),
    sortOrder: Number(input.sortOrder ?? current.sortOrder ?? 0) || 0,
    status: String(input.status || current.status || 'active').slice(0, 40),
    createdAt: current.createdAt || now,
    updatedAt: now
  };
}

function mapLayerGroup(row = {}) {
  return {
    id: row.$id || row.id,
    name: row.name || 'Grupo de camadas',
    slug: row.slug || '',
    description: row.description || '',
    sortOrder: Number(row.sortOrder || 0),
    status: row.status || 'active',
    createdAt: row.createdAt || row.$createdAt || null,
    updatedAt: row.updatedAt || row.$updatedAt || null
  };
}

function layerData(input = {}, current = {}) {
  const now = new Date().toISOString();
  const style = input.style ?? safeJson(current.style, {});
  const metadata = input.metadata ?? safeJson(current.metadata, {});
  const allowedPlans = input.allowedPlans ?? safeJson(current.allowedPlans, ['*']);
  return {
    groupId: String(input.groupId ?? current.groupId ?? '').slice(0, 120),
    groupName: String(input.groupName ?? current.groupName ?? '').slice(0, 180),
    name: String(input.name || current.name || 'Camada sem nome').slice(0, 240),
    slug: String(input.slug || current.slug || '').slice(0, 240),
    description: String(input.description ?? current.description ?? '').slice(0, 1000),
    geometryType: String(input.geometryType || current.geometryType || 'Polygon').slice(0, 80),
    sourceName: String(input.sourceName ?? current.sourceName ?? 'Surveyor').slice(0, 200),
    sourceUrl: String(input.sourceUrl ?? current.sourceUrl ?? '').slice(0, 2000),
    serviceType: String(input.serviceType || current.serviceType || 'geojson').slice(0, 80),
    serviceUrl: String(input.serviceUrl ?? current.serviceUrl ?? '').slice(0, 2000),
    minZoom: Number(input.minZoom ?? current.minZoom ?? 0) || 0,
    maxZoom: Number(input.maxZoom ?? current.maxZoom ?? 22) || 22,
    isPublic: Boolean(input.isPublic ?? current.isPublic ?? false),
    status: String(input.status || current.status || (input.serviceUrl ? 'ready' : 'draft')).slice(0, 40),
    dataAvailable: Boolean(input.dataAvailable ?? current.dataAvailable ?? false),
    dataFileId: String(input.dataFileId ?? current.dataFileId ?? '').slice(0, 120),
    dataBucketId: String(input.dataBucketId ?? current.dataBucketId ?? bucketId('project_files')).slice(0, 120),
    dataSizeBytes: Number(input.dataSizeBytes ?? current.dataSizeBytes ?? 0) || 0,
    featureCount: Number(input.featureCount ?? current.featureCount ?? 0) || 0,
    style: JSON.stringify(style || {}),
    metadata: JSON.stringify(metadata || {}),
    allowedPlans: JSON.stringify(Array.isArray(allowedPlans) ? allowedPlans : ['*']),
    createdAt: current.createdAt || now,
    updatedAt: now
  };
}

function isDefaultEnabledLayerDefinition(layer = {}) {
  const metadata = layer?.metadata && typeof layer.metadata === 'object' ? layer.metadata : safeJson(layer?.metadata, {});
  const name = String(layer?.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const slug = String(layer?.slug || '').trim().toLowerCase();
  const technical = String(metadata?.layerName || metadata?.layers || '').trim().toLowerCase();
  const isMunicipalSei = name === 'divisao politico administrativa - sei'
    || slug === 'geobahia-divisao-politico-administrativa-sei'
    || technical === 'vetor_bases_gerais:municip_sei_2019'
    || technical.endsWith(':municip_sei_2019')
    || technical === 'municip_sei_2019';
  // Decisão atual do produto: a camada SEI continua disponível, mas nunca
  // inicia automaticamente. O usuário precisa ativá-la em Camadas.
  if (isMunicipalSei) return false;
  return layer?.defaultEnabled === true || metadata?.defaultEnabled === true;
}

function mergeDefaultLayerPreferences(preferences = [], catalogLayers = []) {
  const next = (Array.isArray(preferences) ? preferences : []).map((item) => ({ ...item }));
  const known = new Set(next.map((item) => String(item?.layerId || '').toLowerCase()).filter(Boolean));
  for (const layer of (Array.isArray(catalogLayers) ? catalogLayers : [])) {
    const id = String(layer?.id || '');
    if (!id || layer?.status !== 'ready' || !isDefaultEnabledLayerDefinition(layer) || known.has(id.toLowerCase())) continue;
    next.push({
      layerId: id,
      enabled: true,
      opacity: Math.max(0.1, Math.min(1, Number(layer?.style?.opacity ?? layer?.style?.fillOpacity ?? 0.92))),
      sortOrder: next.length
    });
    known.add(id.toLowerCase());
  }
  return next;
}

function mapLayer(row = {}, groupsById = new Map()) {
  const group = groupsById.get(String(row.groupId || ''));
  const metadata = safeJson(row.metadata, {});
  const style = safeJson(row.style, {});
  const allowedPlans = safeJson(row.allowedPlans, ['*']);
  return {
    id: row.$id || row.id,
    groupId: row.groupId || '',
    groupName: row.groupName || group?.name || '',
    name: row.name || 'Camada sem nome',
    slug: row.slug || '',
    description: row.description || '',
    geometryType: row.geometryType || 'Polygon',
    sourceName: row.sourceName || 'Surveyor',
    sourceUrl: row.sourceUrl || '',
    serviceType: row.serviceType || 'geojson',
    serviceUrl: row.serviceUrl || '',
    minZoom: Number(row.minZoom || 0),
    maxZoom: Number(row.maxZoom || 22),
    isPublic: row.isPublic === true,
    status: row.status || 'draft',
    defaultEnabled: isDefaultEnabledLayerDefinition({ ...row, metadata, style }),
    dataAvailable: row.dataAvailable === true || Boolean(row.dataFileId),
    dataFileId: row.dataFileId || '',
    dataBucketId: row.dataBucketId || bucketId('project_files'),
    dataSizeBytes: Number(row.dataSizeBytes || 0),
    featureCount: Number(row.featureCount || 0),
    style,
    metadata,
    allowedPlans: Array.isArray(allowedPlans) ? allowedPlans : ['*'],
    createdAt: row.createdAt || row.$createdAt || null,
    updatedAt: row.updatedAt || row.$updatedAt || null
  };
}

async function listLayerGroupsSafe() {
  try {
    const rows = await listRows('layer_groups', [Query.limit(500)]);
    return rows.map(mapLayerGroup).sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.name).localeCompare(String(b.name), 'pt-BR'));
  } catch (error) {
    if (isUnknownAttributeError(error) || [404, 400].includes(Number(error.status))) return [];
    throw error;
  }
}

async function listLayersSafe({ publicOnly = false, groups: providedGroups = null } = {}) {
  const groups = Array.isArray(providedGroups) ? providedGroups : await listLayerGroupsSafe();
  const groupsById = new Map(groups.map((group) => [String(group.id), group]));
  try {
    const rows = await listRows('layers', [Query.limit(500)]);
    return rows.map((row) => mapLayer(row, groupsById)).filter((layer) => layer.status !== 'archived' && (!publicOnly || (layer.isPublic && layer.status === 'ready')));
  } catch (error) {
    if (isUnknownAttributeError(error) || [404, 400].includes(Number(error.status))) return [];
    throw error;
  }
}

function userAllowedForLayer(layer = {}, auth = {}) {
  if (!layer?.id || layer.status !== 'ready' || layer.isPublic !== true) return false;
  const allowed = Array.isArray(layer.allowedPlans) ? layer.allowedPlans : ['*'];
  if (!allowed.length || allowed.includes('*')) return true;
  const plan = String(auth?.user?.plan || auth?.plan || '').toLowerCase();
  const role = String(auth?.user?.role || auth?.role || '').toLowerCase();
  if (role === 'admin') return true;
  return allowed.map((item) => String(item).toLowerCase()).includes(plan);
}


function officialVirtualLayerGroups() {
  const groups = [SICAR_PROPERTY_GROUP, INCRA_OFFICIAL_GROUP].filter(Boolean).map((group, index) => ({
    id: String(group.id || `system-official-${index}`),
    name: String(group.name || 'Camadas oficiais do sistema'),
    slug: String(group.slug || group.id || `system-official-${index}`),
    description: String(group.description || 'Grupo oficial gerenciado pelo Surveyor.'),
    sortOrder: Number(group.sortOrder ?? (-200 + index)),
    status: 'active',
    systemManaged: true,
    readOnly: true,
    createdAt: null,
    updatedAt: null
  }));
  return [...new Map(groups.map((group) => [group.id, group])).values()];
}

async function listAdminLayerGroupsSafe() {
  const stored = await listLayerGroupsSafe();
  return [...new Map([...officialVirtualLayerGroups(), ...stored].map((group) => [String(group.id), group])).values()]
    .sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

async function listAdminLayersSafe() {
  const stored = await listLayersSafe();
  const virtual = [...sicarPropertyVirtualLayers(), ...incraOfficialVirtualLayers()].map((layer) => ({
    ...layer,
    systemManaged: true,
    readOnly: true,
    metadata: { ...(layer.metadata || {}), virtualOfficialLayer: true, managedBySystem: true }
  }));
  const byId = new Map();
  for (const layer of [...virtual, ...stored]) byId.set(String(layer.id || layer.slug || ''), layer);
  return [...byId.values()].filter((layer) => layer?.id || layer?.slug);
}

const PUBLIC_LAYER_CATALOG_CACHE_TTL_MS = 30 * 60 * 1000;
let publicLayerCatalogBaseCache = { at: 0, groups: null, storedLayers: null };

function invalidatePublicLayerCatalogCache() {
  publicLayerCatalogBaseCache = { at: 0, groups: null, storedLayers: null };
}

async function publicLayerCatalog(auth = {}) {
  // O catálogo público é o mesmo para usuários do mesmo plano e muda raramente.
  // Cache em memória evita reler centenas de linhas a cada usuário enquanto a Function estiver quente.
  let groups = publicLayerCatalogBaseCache.groups;
  let storedLayers = publicLayerCatalogBaseCache.storedLayers;
  if (!Array.isArray(groups) || !Array.isArray(storedLayers) || Date.now() - Number(publicLayerCatalogBaseCache.at || 0) > PUBLIC_LAYER_CATALOG_CACHE_TTL_MS) {
    groups = await listLayerGroupsSafe();
    storedLayers = await listLayersSafe({ publicOnly: true, groups });
    publicLayerCatalogBaseCache = { at: Date.now(), groups, storedLayers };
  }
  const layers = [...storedLayers.filter((layer) => !isLegacyGeobahiaPropertyBoundaryLayer(layer)), ...sicarPropertyVirtualLayers(), ...incraOfficialVirtualLayers()];
  const activeGroups = groups.filter((group) => String(group.status || 'active') === 'active');
  const allGroupsById = new Map(groups.map((group) => [String(group.id), group]));
  const groupsById = new Map(activeGroups.map((group) => [String(group.id), { ...group, layers: [] }]));
  if (!groupsById.has(SICAR_PROPERTY_GROUP.id)) groupsById.set(SICAR_PROPERTY_GROUP.id, { ...SICAR_PROPERTY_GROUP, layers: [] });
  if (!groupsById.has(INCRA_OFFICIAL_GROUP.id)) groupsById.set(INCRA_OFFICIAL_GROUP.id, { ...INCRA_OFFICIAL_GROUP, layers: [] });
  const missingGroups = new Map();

  for (const layer of layers.filter((item) => userAllowedForLayer(item, auth))) {
    const groupId = String(layer.groupId || '');
    const knownGroup = groupId ? allGroupsById.get(groupId) : null;
    if (knownGroup && String(knownGroup.status || 'active') !== 'active') continue;
    let group = groupsById.get(groupId);
    if (!group) {
      const name = layer.groupName || 'Camadas publicadas';
      const slug = stableSlug(name);
      if (!missingGroups.has(slug)) missingGroups.set(slug, { id: groupId || slug, name, slug, description: '', sortOrder: 9999, status: 'active', layers: [] });
      group = missingGroups.get(slug);
    }
    group.layers.push(layer);
  }

  const withLayers = [...groupsById.values(), ...missingGroups.values()]
    .map((group) => ({ ...group, layers: group.layers.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR')) }))
    .filter((group) => group.layers.length)
    .sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || String(a.name).localeCompare(String(b.name), 'pt-BR'));

  const publicLayers = withLayers.flatMap((group) => group.layers.map((layer) => ({ ...layer, groupId: group.id, groupName: group.name })));
  const versionSource = JSON.stringify({ groups: groups.map((group) => [group.id, group.status, group.updatedAt]), layers: publicLayers.map((layer) => [layer.id, layer.updatedAt, layer.isPublic, layer.status]) });
  const catalogVersion = crypto.createHash('sha256').update(versionSource).digest('hex').slice(0, 16);
  return { catalogVersion, generatedAt: new Date().toISOString(), groups: withLayers, layers: publicLayers };
}

function customizationTimestamp(row = {}) {
  const value = row.updatedAt || row.$updatedAt || row.UpdatedAt || row.createdAt || row.$createdAt || '';
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function findCustomizationRowsForUser(userId) {
  if (!userId) return [];
  const rows = await listRows('customization', [Query.equal('userId', userId), Query.limit(100)]);
  return [...rows].sort((a, b) => customizationTimestamp(b) - customizationTimestamp(a));
}

async function findCustomizationForUser(userId) {
  const rows = await findCustomizationRowsForUser(userId);
  return rows[0] || null;
}

async function cleanupDuplicateCustomizationRows(userId, keepId, knownRows = null) {
  if (!userId || !keepId) return;
  const rows = Array.isArray(knownRows) ? knownRows : await findCustomizationRowsForUser(userId);
  const duplicates = rows.filter((row) => {
    const rowId = row?.$id || row?.id || '';
    return rowId && rowId !== keepId && String(row?.userId || '') === String(userId);
  });
  for (const row of duplicates) {
    await deleteRow('customization', row.$id || row.id).catch(() => {});
  }
}

function customizationOptions(row = {}) {
  const raw = row?.options ?? row?.OptionsJson ?? row?.metadata ?? '{}';
  const parsed = safeJson(raw, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function hasUsefulCustomization(value = {}) {
  const options = value?.options && typeof value.options === 'object' ? value.options : {};
  return Boolean(
    String(value?.companyName || value?.addressText || value?.responsibleTechnician || value?.professionalRegistry || value?.footerText || value?.websiteUrl || value?.logoDataUrl || '').trim()
    || Object.keys(options).length
  );
}

function safeHttpUrl(value, { allowEmpty = true } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return allowEmpty ? '' : null;
  if (raw.length > 500) return null;
  try {
    const parsed = new URL(raw);
    const localHttpAllowed = parsed.protocol === 'http:'
      && String(env('ALLOW_LOCAL_DEV_ORIGINS', 'false')).toLowerCase() === 'true'
      && ['localhost', '127.0.0.1', '::1'].includes(String(parsed.hostname || '').toLowerCase());
    if (parsed.protocol !== 'https:' && !localHttpAllowed) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function assertCustomizationImageDataUrl(value, { label = 'A imagem', maxBytes = 2 * 1024 * 1024 } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/is);
  if (!match) throw statusError(400, `${label} deve ser PNG, JPEG ou WEBP em formato válido.`, { code: 'CUSTOMIZATION_IMAGE_INVALID' });
  const base64 = match[2].replace(/\s+/g, '');
  if (!base64 || !/^[a-z0-9+/]*={0,2}$/i.test(base64) || base64.length % 4 !== 0) {
    throw statusError(400, `${label} contém dados Base64 inválidos.`, { code: 'CUSTOMIZATION_IMAGE_INVALID' });
  }
  const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
  const estimatedBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  if (estimatedBytes > maxBytes) {
    throw statusError(413, `${label} excede o limite permitido.`, { code: 'CUSTOMIZATION_IMAGE_TOO_LARGE', maxBytes });
  }
  return raw;
}

function assertCustomizationTextSize(value, { label = 'O conteúdo', maxChars = 8 * 1024 * 1024 } = {}) {
  const raw = String(value || '');
  if (raw.length > maxChars) throw statusError(413, `${label} excede o limite permitido.`, { code: 'CUSTOMIZATION_CONTENT_TOO_LARGE', maxChars });
  return raw;
}

function normalizeDocumentIdentity(input = {}, currentOptions = {}) {
  const previous = currentOptions.documentIdentity && typeof currentOptions.documentIdentity === 'object' ? currentOptions.documentIdentity : {};
  const websiteWasProvided = Object.prototype.hasOwnProperty.call(input || {}, 'websiteUrl') || Object.prototype.hasOwnProperty.call(input || {}, 'site');
  const websiteCandidate = input.websiteUrl ?? input.site ?? previous.websiteUrl ?? '';
  const websiteUrl = safeHttpUrl(websiteCandidate);
  if (websiteWasProvided && String(websiteCandidate || '').trim() && !websiteUrl) {
    throw statusError(400, 'O site da empresa deve usar uma URL HTTP(S) válida, por exemplo https://empresa.com.br.', { code: 'CUSTOMIZATION_WEBSITE_URL_INVALID', field: 'websiteUrl' });
  }
  return {
    companyName: String(input.companyName ?? input.company ?? previous.companyName ?? '').slice(0, 220),
    addressText: String(input.addressText ?? input.address ?? previous.addressText ?? '').slice(0, 700),
    responsibleTechnician: String(input.responsibleTechnician ?? previous.responsibleTechnician ?? '').slice(0, 220),
    professionalRegistry: String(input.professionalRegistry ?? input.crea ?? previous.professionalRegistry ?? '').slice(0, 120),
    websiteUrl: websiteUrl || '',
    footerText: String(input.footerText ?? previous.footerText ?? '').slice(0, 1000),
    phoneNumber: String(input.phoneNumber ?? previous.phoneNumber ?? '').slice(0, 80),
    whatsappNumber: String(input.whatsappNumber ?? previous.whatsappNumber ?? '').slice(0, 80),
    emailAddress: String(input.emailAddress ?? previous.emailAddress ?? '').slice(0, 220),
    addressNumber: String(input.addressNumber ?? previous.addressNumber ?? '').slice(0, 40),
    professionalTitle: String(input.professionalTitle ?? previous.professionalTitle ?? '').slice(0, 120),
    baseTemplateName: String(input.baseTemplateName ?? previous.baseTemplateName ?? currentOptions.baseTemplateName ?? '').slice(0, 260)
  };
}

function normalizeLayerCatalogState(value = 'BA') {
  const code = String(value || 'BA').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(SICAR_STATE_CATALOG, code) ? code : 'BA';
}

async function getLayerPreferencesForUser(userId, auth = {}) {
  if (!userId) return [];
  const row = await findCustomizationForUser(userId).catch(() => null);
  const options = customizationOptions(row || {});
  const saved = Array.isArray(options.layerPreferences) ? options.layerPreferences : [];
  const catalog = await publicLayerCatalog(auth).catch(() => ({ layers: [] }));
  return mergeDefaultLayerPreferences(saved, catalog.layers || []);
}

async function getLayerCatalogStateForUser(userId) {
  if (!userId) return { state: 'BA', configured: false };
  const row = await findCustomizationForUser(userId).catch(() => null);
  const options = customizationOptions(row || {});
  return { state: normalizeLayerCatalogState(options.layerCatalogState || 'BA'), configured: Object.prototype.hasOwnProperty.call(options, 'layerCatalogState') };
}

async function saveLayerPreferencesForUser(userId, preferences = [], auth = {}, catalogState = '') {
  if (!userId) throw statusError(401, 'Sessão não encontrada.');
  const catalog = await publicLayerCatalog(auth);
  const allowedIds = new Set(catalog.layers.map((layer) => String(layer.id).toLowerCase()));
  const clean = (Array.isArray(preferences) ? preferences : [])
    .filter((pref) => allowedIds.has(String(pref.layerId || '').toLowerCase()))
    .map((pref, index) => {
      const color = /^#[0-9a-f]{6}$/i.test(String(pref.color || '').trim()) ? String(pref.color).toUpperCase() : undefined;
      const weight = Number.isFinite(Number(pref.weight)) ? Math.max(0.6, Math.min(6, Number(pref.weight))) : undefined;
      const styleMode = pref.styleMode === 'official' || pref.styleMode === 'custom' ? pref.styleMode : undefined;
      const propertyStyleRevision = Number.isInteger(Number(pref.propertyStyleRevision)) ? Math.max(0, Number(pref.propertyStyleRevision)) : undefined;
      const userStyled = pref.userStyled === true;
      return {
        layerId: String(pref.layerId),
        enabled: Boolean(pref.enabled),
        opacity: Math.max(0.1, Math.min(1, Number(pref.opacity ?? 0.55))),
        ...(color ? { color } : {}),
        ...(weight !== undefined ? { weight } : {}),
        ...(styleMode ? { styleMode } : {}),
        ...(propertyStyleRevision !== undefined ? { propertyStyleRevision } : {}),
        ...(userStyled ? { userStyled: true } : {}),
        sortOrder: Number.isFinite(Number(pref.sortOrder)) ? Number(pref.sortOrder) : index
      };
    });

  const now = new Date().toISOString();
  const current = await findCustomizationForUser(userId).catch(() => null);
  const currentOptions = customizationOptions(current || {});
  const options = { ...currentOptions, layerPreferences: clean, layerCatalogState: normalizeLayerCatalogState(catalogState || currentOptions.layerCatalogState || 'BA'), layerPreferencesUpdatedAt: now };
  const data = {
    userId,
    companyName: current?.companyName || '',
    logoFileId: current?.logoFileId || '',
    address: current?.address || '',
    // Preferências de camadas não alteram identidade/contato do usuário.
    // Preserve os valores já salvos na personalização sem depender de variáveis
    // externas inexistentes neste escopo.
    phone: current?.phone || '',
    email: current?.email || '',
    crea: current?.crea || '',
    site: current?.site || '',
    footerText: current?.footerText || '',
    options: JSON.stringify(options),
    createdAt: current?.createdAt || now,
    updatedAt: now
  };
  const saved = current?.$id ? await updateRow('customization', current.$id, data) : await createRow('customization', data);
  return { preferences: clean, customization: saved };
}


const SYSTEM_NOTICES_USER_ID = '__system_notices__';
const SYSTEM_NOTICES_CACHE_TTL_MS = 30 * 1000;
let systemNoticesCache = { at: 0, notices: null };


function noticeDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeNotice(input = {}, current = {}) {
  const now = new Date().toISOString();
  const id = String(input.id || input.$id || current.id || current.$id || appwriteId()).trim();
  const audience = ['all', 'users', 'admins', 'plan', 'user'].includes(String(input.audience || current.audience || 'all'))
    ? String(input.audience || current.audience || 'all')
    : 'all';
  const deliveryMode = ['notification', 'popup', 'banner', 'release', 'login-expiration'].includes(String(input.deliveryMode || input.delivery || current.deliveryMode || current.delivery || 'notification'))
    ? String(input.deliveryMode || input.delivery || current.deliveryMode || current.delivery || 'notification')
    : 'notification';
  const type = ['info', 'warning', 'danger', 'maintenance', 'success'].includes(String(input.type || current.type || 'info'))
    ? String(input.type || current.type || 'info')
    : 'info';
  return {
    id,
    title: String(input.title ?? current.title ?? '').trim().slice(0, 160),
    message: String(input.message ?? current.message ?? '').trim().slice(0, 4000),
    type,
    deliveryMode: input.blocksApp === true || current.blocksApp === true ? 'banner' : deliveryMode,
    audience,
    targetPlanSlug: audience === 'plan' ? String(input.targetPlanSlug ?? current.targetPlanSlug ?? '').trim().toLowerCase() : null,
    targetUserId: audience === 'user' ? String(input.targetUserId ?? current.targetUserId ?? '').trim() : null,
    requiresAck: Boolean(input.requiresAck ?? current.requiresAck ?? false),
    blocksApp: Boolean(input.blocksApp ?? current.blocksApp ?? false),
    isActive: input.isActive === undefined && current.isActive === undefined ? true : Boolean(input.isActive ?? current.isActive),
    startsAt: noticeDateValue(input.startsAt ?? current.startsAt),
    endsAt: noticeDateValue(input.endsAt ?? current.endsAt),
    createdBy: String(input.createdBy ?? current.createdBy ?? '').trim() || null,
    createdAt: noticeDateValue(input.createdAt ?? current.createdAt) || now,
    updatedAt: now,
    deletedAt: noticeDateValue(input.deletedAt ?? current.deletedAt),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : (current.metadata && typeof current.metadata === 'object' ? current.metadata : {})
  };
}

function cleanNoticeList(list = []) {
  const byId = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const notice = normalizeNotice(raw);
    if (!notice.title || !notice.message) continue;
    byId.set(String(notice.id), notice);
  }
  return [...byId.values()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function findSystemNoticeStore() {
  const rows = await listRows('customization', [Query.equal('userId', SYSTEM_NOTICES_USER_ID), Query.limit(1)]).catch(() => []);
  return rows[0] || null;
}

async function readSystemNotices({ includeDeleted = false } = {}) {
  let notices = systemNoticesCache.notices;
  if (!Array.isArray(notices) || Date.now() - Number(systemNoticesCache.at || 0) > SYSTEM_NOTICES_CACHE_TTL_MS) {
    const row = await findSystemNoticeStore();
    const options = customizationOptions(row || {});
    notices = cleanNoticeList(options.systemNotices || []);
    systemNoticesCache = { at: Date.now(), notices };
  }
  return includeDeleted ? notices : notices.filter((notice) => !notice.deletedAt);
}

async function writeSystemNotices(notices = []) {
  const now = new Date().toISOString();
  const current = await findSystemNoticeStore().catch(() => null);
  const options = { ...customizationOptions(current || {}), systemNotices: cleanNoticeList(notices), systemNoticesUpdatedAt: now };
  const data = {
    userId: SYSTEM_NOTICES_USER_ID,
    companyName: current?.companyName || 'Surveyor System Notices',
    logoFileId: current?.logoFileId || '',
    address: current?.address || '',
    phone: current?.phone || '',
    email: current?.email || '',
    crea: current?.crea || '',
    site: current?.site || '',
    footerText: current?.footerText || '',
    options: JSON.stringify(options),
    createdAt: current?.createdAt || now,
    updatedAt: now
  };
  await (current?.$id ? updateRow('customization', current.$id, data) : createRow('customization', data));
  systemNoticesCache = { at: Date.now(), notices: cleanNoticeList(options.systemNotices || []) };
  return options.systemNotices;
}

function noticeAppliesToAuth(notice = {}, auth = {}) {
  if (!notice || notice.deletedAt || notice.isActive === false) return false;
  const now = Date.now();
  const start = notice.startsAt ? new Date(notice.startsAt).getTime() : NaN;
  const end = notice.endsAt ? new Date(notice.endsAt).getTime() : NaN;
  if (Number.isFinite(start) && start > now) return false;
  if (Number.isFinite(end) && end <= now) return false;

  const user = auth?.user || {};
  const role = String(user.role || '').toLowerCase();
  const userId = String(auth.sub || user.id || '').trim();
  const audience = String(notice.audience || 'all').toLowerCase();

  // A central de notificações do usuário deve respeitar o destinatário até
  // para administradores. A visualização administrativa de todos os avisos
  // usa /api/admin/notices e não deve vazar para o sino da conta admin.
  if (audience === 'all') return true;
  if (audience === 'users') return role !== 'admin';
  if (audience === 'admins') return role === 'admin';
  if (audience === 'user') return Boolean(userId) && String(notice.targetUserId || '').trim() === userId;
  if (audience === 'plan') {
    if (role === 'admin') return false;
    return String(notice.targetPlanSlug || '').toLowerCase() === String(user.planSlug || user.plan || '').toLowerCase();
  }
  return false;
}

function startOfDayUtc(date = new Date()) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function loginExpirationDaysLeft(expiresAt) {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  if (!Number.isFinite(expiry.getTime())) return null;
  const todayUtc = startOfDayUtc(new Date());
  const expiryDayUtc = startOfDayUtc(expiry);
  return Math.ceil((expiryDayUtc - todayUtc) / 86400000);
}




function paymentRenewalProductId(planSlug = '') {
  const slug = canonicalPlanSlug(planSlug || 'basic_annual');
  return ({ basic_annual: 'basico-anual', plus_annual: 'plus-anual', pro_annual: 'pro-anual' })[slug] || 'basico-anual';
}

function renewalAccountSnapshot(profile = {}, appwriteUser = {}) {
  const planSlug = canonicalPlanSlug(profile.plan || profile.planSlug || userPrefs(appwriteUser)?.surveyor?.planSlug || 'basic_annual');
  return {
    userId: String(profile.userId || appwriteUser.$id || appwriteUser.id || '').trim(),
    name: String(profile.name || appwriteUser.name || profile.email || appwriteUser.email || '').trim(),
    email: normalizeEmail(profile.email || appwriteUser.email || ''),
    phone: String(profile.whatsapp || profile.phone || userPrefs(appwriteUser)?.surveyor?.whatsapp || userPrefs(appwriteUser)?.surveyor?.phone || '').trim(),
    planSlug,
    productId: paymentRenewalProductId(planSlug),
    expiresAt: profileExpiresAt(profile, appwriteUser) || null,
    status: String(profile.status || userPrefs(appwriteUser)?.surveyor?.status || 'active').toLowerCase()
  };
}

function createPaymentRenewalHandoff(account = {}) {
  if (!account?.userId || !account?.email) throw statusError(400, 'Não foi possível preparar a renovação desta conta.');
  return signJwt({
    type: 'payment-renewal-handoff',
    sub: account.userId,
    email: account.email,
    planSlug: account.planSlug,
    productId: account.productId,
    expiresAt: account.expiresAt || null
  }, 15 * 60);
}

function paymentRenewalCheckoutUrl(token, productId) {
  const base = String(env('PAYMENT_PORTAL_URL', 'https://pagamento.surveyorr.com.br')).replace(/\/+$/, '');
  return `${base}/?produto=${encodeURIComponent(productId || 'basico-anual')}&fluxo=renovacao&handoff=${encodeURIComponent(token)}`;
}

async function freshRenewalAccountFromToken(token) {
  const payload = verifyJwtType(String(token || '').trim(), 'payment-renewal-handoff', 'Link de renovação inválido ou expirado.');
  const userId = String(payload.sub || '').trim();
  const email = normalizeEmail(payload.email || '');
  let profile = userId ? await findProfileByUserId(userId).catch(() => null) : null;
  if (!profile && email) profile = await findProfileForLogin('', email).catch(() => null);
  if (!profile) throw statusError(404, 'Conta Surveyor não encontrada para renovação.');
  const appwriteUser = await getAppwriteUserById(profile.userId || userId).catch(() => null);
  if (!appwriteUser) throw statusError(404, 'Conta Surveyor não encontrada no serviço de autenticação.');
  const account = renewalAccountSnapshot(profile, appwriteUser);
  if (String(profile.role || '').toLowerCase() === 'admin') throw statusError(409, 'Conta administrativa não pode ser renovada por este fluxo.');
  return account;
}

function loginExpirationNoticeForAuth(auth = {}) {
  const user = auth?.user || {};
  const role = String(user.role || '').toLowerCase();
  if (!user || role === 'admin' || !user.expiresAt) return [];
  const warningDays = Math.max(1, Number(env('RENEWAL_EARLY_WARNING_DAYS', '7')) || 7);
  const daysLeft = loginExpirationDaysLeft(user.expiresAt);
  if (!Number.isInteger(daysLeft) || daysLeft < 1 || daysLeft > warningDays) return [];
  const expiry = subscriptionExpiryMoment(user.expiresAt);
  if (!expiry) return [];
  const trigger = new Date(startOfDayUtc(expiry) - warningDays * 86400000);
  const fmt = (value) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(value);
  const name = String(user.name || user.email || 'usuário').trim();
  const title = daysLeft === 1 ? 'Seu plano vence amanhã' : `Seu plano vence em ${daysLeft} dias`;
  const message = `Olá, ${name}. Seu plano vence em ${fmt(expiry)}. Renove agora para manter o acesso sem interrupção.`;
  const createdAt = trigger.toISOString();
  const expiryKey = String(user.expiresAt || '').replace(/[^0-9]/g, '').slice(0, 14) || 'sem-data';
  return [normalizeNotice({
    id: `auto-plan-expiration-${user.id || auth.sub}-${expiryKey}`,
    title, message, type: daysLeft <= 2 ? 'danger' : 'warning', deliveryMode: 'notification',
    audience: 'user', targetUserId: String(user.id || auth.sub || ''), startsAt: createdAt,
    endsAt: user.expiresAt, isActive: true, requiresAck: false, blocksApp: false,
    createdBy: 'system:auto-plan-expiration', createdAt,
    metadata: {
      kind: 'subscription_expiration_auto', automatic: true, daysLeft, expiresAt: user.expiresAt,
      renewal: true, actionLabel: 'Renovar plano', productId: paymentRenewalProductId(user.planSlug || user.plan || '')
    }
  })];
}

function systemNoticesForAuth(staticNotices = [], auth = {}) {
  const visibleStatic = staticNotices.filter((notice) => noticeAppliesToAuth(notice, auth));
  return cleanNoticeList([...loginExpirationNoticeForAuth(auth), ...visibleStatic]);
}

async function enforceServerMaintenanceLock(auth = {}, path = '') {
  if (String(auth?.user?.role || '').toLowerCase() === 'admin') return;
  const allowedDuringMaintenance = new Set([
    '/api/notices', '/api/system/notices', '/api/notifications', '/api/auth/presence'
  ]);
  if (allowedDuringMaintenance.has(String(path || ''))) return;
  const notices = await readSystemNotices().catch(() => []);
  const blocker = notices.find((notice) => notice?.blocksApp === true && noticeAppliesToAuth(notice, auth));
  if (!blocker) return;
  throw statusError(503, blocker.message || 'O Surveyor está temporariamente em manutenção.', {
    code: 'SYSTEM_MAINTENANCE',
    title: blocker.title || 'Sistema em manutenção',
    maintenanceId: blocker.id || '',
    startsAt: blocker.startsAt || null,
    endsAt: blocker.endsAt || null
  });
}

async function createSystemNoticeFromAdmin(input = {}, auth = {}) {
  const notice = normalizeNotice({ ...input, createdBy: auth?.sub || auth?.user?.id || null });
  if (!notice.title) throw statusError(400, 'Informe o título do aviso.');
  if (!notice.message) throw statusError(400, 'Informe a mensagem do aviso.');
  if (notice.audience === 'plan' && !notice.targetPlanSlug) throw statusError(400, 'Selecione o plano de destino.');
  if (notice.audience === 'user' && !notice.targetUserId) throw statusError(400, 'Selecione o usuário de destino.');
  const notices = await readSystemNotices({ includeDeleted: true });
  await writeSystemNotices([notice, ...notices.filter((item) => String(item.id) !== String(notice.id))]);
  return notice;
}

async function updateSystemNoticeFromAdmin(noticeId, input = {}) {
  const id = String(noticeId || '').trim();
  if (!id) throw statusError(400, 'Aviso inválido.');
  const notices = await readSystemNotices({ includeDeleted: true });
  const current = notices.find((notice) => String(notice.id) === id);
  if (!current) throw statusError(404, 'Aviso não encontrado.');
  const notice = normalizeNotice({ ...input, id }, current);
  if (!notice.title) throw statusError(400, 'Informe o título do aviso.');
  if (!notice.message) throw statusError(400, 'Informe a mensagem do aviso.');
  if (notice.audience === 'plan' && !notice.targetPlanSlug) throw statusError(400, 'Selecione o plano de destino.');
  if (notice.audience === 'user' && !notice.targetUserId) throw statusError(400, 'Selecione o usuário de destino.');
  await writeSystemNotices([notice, ...notices.filter((item) => String(item.id) !== id)]);
  return notice;
}

async function archiveSystemNoticeFromAdmin(noticeId) {
  const id = String(noticeId || '').trim();
  const notices = await readSystemNotices({ includeDeleted: true });
  const current = notices.find((notice) => String(notice.id) === id);
  if (!current) throw statusError(404, 'Aviso não encontrado.');
  const archived = normalizeNotice({ id, deletedAt: new Date().toISOString(), isActive: false }, current);
  await writeSystemNotices([archived, ...notices.filter((item) => String(item.id) !== id)]);
  return archived;
}

async function deleteSystemNoticeFromAdmin(noticeId) {
  const id = String(noticeId || '').trim();
  const notices = await readSystemNotices({ includeDeleted: true });
  const current = notices.find((notice) => String(notice.id) === id);
  if (!current) throw statusError(404, 'Aviso não encontrado.');
  await writeSystemNotices(notices.filter((item) => String(item.id) !== id));
  return { id, deleted: true };
}

function stableSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || appwriteId();
}

function normalizeCatalogLayerKey(value) {
  return String(value || '').trim().toLowerCase();
}

function catalogLayerShortName(value) {
  return normalizeCatalogLayerKey(String(value || '').split(':').pop());
}

function geobahiaLegacyLayerNames(item = {}) {
  const fullName = String(item.layer || '').trim();
  const shortName = fullName.split(':').pop();
  const legacyPrefixes = [
    'Vetor_Recortes_Tematicos',
    'Vetor_Bases_Gerais',
    'Vetor_Recursos_Hidricos',
    'Vetor_Recursos_Naturais',
    'Vetor_Recursos_Ambientais',
    'Vetor_Biodiversidade',
    'Raster',
    'Raster_ORTOFOTO'
  ];
  const names = new Set([fullName, shortName, ...legacyPrefixes.map((prefix) => `${prefix}:${shortName}`)]);
  if (shortName === 'cefir_imovel_rural_limite_inema') {
    names.add('cefir_imovel_rural_propriedade_inema');
    names.add('Vetor_Recortes_Tematicos:cefir_imovel_rural_propriedade_inema');
  }
  const knownAliases = {
    uc_estadual: ['Vetor_Recursos_Ambientais:uc_inema_2025', 'uc_inema_2025', 'Vetor_Recursos_Ambientais:uc_inema_2024', 'uc_inema_2024', 'Vetor_Recursos_Ambientais:uc_inema_2023', 'uc_inema_2023', 'Vetor_Recursos_Ambientais:uc_inema_2021', 'uc_inema_2021'],
    uc_inema_2025: ['Vetor_Recursos_Ambientais:uc_inema_2024', 'uc_inema_2024', 'Vetor_Recursos_Ambientais:uc_inema_2023', 'uc_inema_2023', 'Vetor_Recursos_Ambientais:uc_inema_2021', 'uc_inema_2021', 'Vetor_Recortes_Tematicos:uc_estadual', 'uc_estadual'],
    uc_inema_2021: ['Vetor_Recursos_Ambientais:uc_inema_2025', 'uc_inema_2025', 'Vetor_Recursos_Ambientais:uc_inema_2024', 'uc_inema_2024', 'Vetor_Recursos_Ambientais:uc_inema_2023', 'uc_inema_2023', 'Vetor_Recortes_Tematicos:uc_estadual', 'uc_estadual'],
    faixa_servidao_ferrovias: ['Vetor_Recortes_Tematicos:faixa_dominio_ferrovia', 'faixa_dominio_ferrovia', 'Vetor_Recortes_Tematicos:faixa_dominio_ferrovias', 'faixa_dominio_ferrovias', 'Vetor_Recortes_Tematicos:faixa_dominio_ferroviario', 'faixa_dominio_ferroviario', 'Vetor_Recortes_Tematicos:faixa_servidao_ferrovia', 'faixa_servidao_ferrovia', 'Vetor_Recortes_Tematicos:faixa_servidao_ferroviaria', 'faixa_servidao_ferroviaria', 'Vetor_Recortes_Tematicos:trecho_ferroviario', 'trecho_ferroviario'],
    solos: ['Vetor_Recursos_Ambientais:solos']
  };
  for (const alias of (knownAliases[shortName] || [])) names.add(alias);
  return [...names].filter(Boolean);
}

function geobahiaLayerSlug(item) {
  return `geobahia-${stableSlug(item.name || item.layer)}`.slice(0, 240);
}

function geobahiaSymbolizer(item) {
  if (item.geometry === 'point') return 'point';
  if (item.geometry === 'line') return 'line';
  if (item.geometry === 'mixed') return 'mixed';
  if (item.geometry === 'raster') return 'mixed';
  return 'polygon';
}

function geobahiaGeometryType(item) {
  if (item.geometry === 'point') return 'point';
  if (item.geometry === 'line') return 'line';
  if (item.geometry === 'mixed') return 'mixed';
  if (item.geometry === 'raster') return 'raster';
  return 'polygon';
}

function geobahiaLayerPayload(item, group) {
  const color = String(item.color || '#3974D8').trim() || '#3974D8';
  return {
    groupId: group.id,
    groupName: group.name,
    name: item.name,
    slug: geobahiaLayerSlug(item),
    description: `${item.group} • GeoBahia / INEMA • camada WMS oficial: ${item.layer}`,
    geometryType: geobahiaGeometryType(item),
    sourceName: 'GeoBahia / INEMA',
    sourceUrl: GEOBAHIA_WMS_BASE_URL,
    serviceType: 'wms',
    serviceUrl: GEOBAHIA_WMS_BASE_URL,
    minZoom: Number(item.minZoom ?? 0) || 0,
    maxZoom: 22,
    isPublic: true,
    status: 'ready',
    dataAvailable: false,
    allowedPlans: ['*'],
    style: {
      color,
      fillColor: color,
      opacity: item.opacity ?? GEOBAHIA_DEFAULT_TRANSPARENCY,
      fillOpacity: item.fillOpacity ?? GEOBAHIA_DEFAULT_TRANSPARENCY,
      weight: item.geometry === 'line' ? 3 : 2
    },
    metadata: {
      layerName: item.layer,
      layers: item.layer,
      defaultEnabled: false,
      forceWmsOnly: String(item.layer || '').split(':').pop() === 'municip_sei_2019',
      legacyLayerNames: geobahiaLegacyLayerNames(item),
      remoteMode: true,
      autoSeed: 'geobahia-inema-v21.11.5-wms-first-20260829',
      officialCatalogGroup: item.group,
      officialWmsTitle: item.name,
      coverageCountry: 'BR',
      coverageType: 'state',
      coverageStates: ['BA'],
      stateCode: 'BA',
      stateName: 'Bahia',
      catalogScale: item.scale || '',
      catalogReferences: Array.isArray(item.catalogReferences) ? item.catalogReferences : [],
      sourceProvided: item.sourceProvided || 'GeoBahia / INEMA',
      preferWfs: item.preferWfs === true,
      wfsVersion: item.wfsVersion || '',
      forceWmsColor: false,
      wmsSymbolizer: geobahiaSymbolizer(item),
      styles: '',
      officialWmsStyle: '',
      directWms: true,
      useOfficialFallback: false,
      forceStoredData: false,
      format: 'image/png',
      transparent: true,
      wmsVersion: '1.1.1',
      configuredAt: new Date().toISOString()
    }
  };
}

function findExistingGeobahiaLayer(layersList, item) {
  const layerName = normalizeCatalogLayerKey(item.layer);
  const shortLayerName = catalogLayerShortName(item.layer);
  const legacyNames = new Set(geobahiaLegacyLayerNames(item).map(normalizeCatalogLayerKey));
  const desiredSlug = normalizeCatalogLayerKey(geobahiaLayerSlug(item));
  const titleKey = stableSlug(item.name);
  return layersList.find((layer) => {
    const stored = normalizeCatalogLayerKey(layer?.metadata?.layerName || layer?.metadata?.layers || '');
    const storedShort = catalogLayerShortName(stored);
    return stored === layerName || storedShort === shortLayerName || legacyNames.has(stored);
  })
    || layersList.find((layer) => normalizeCatalogLayerKey(layer?.slug) === desiredSlug)
    || layersList.find((layer) => stableSlug(layer?.metadata?.officialWmsTitle || layer?.name) === titleKey)
    || null;
}

async function ensureGeobahiaGroupsServer() {
  let groups = await listLayerGroupsSafe();
  const bySlug = new Map(groups.map((group) => [stableSlug(group.slug || group.name), group]));
  const byName = new Map(groups.map((group) => [String(group.name || '').trim().toLowerCase(), group]));
  const resolved = new Map();
  const groupNames = [...new Set(GEOBAHIA_OFFICIAL_CATALOG.map((item) => item.group))];
  let created = 0;
  let updated = 0;

  for (const [index, name] of groupNames.entries()) {
    const slug = stableSlug(String(name).replace(/^\d+\.\s*/, ''));
    let group = bySlug.get(slug) || byName.get(String(name).trim().toLowerCase());
    const desired = {
      name,
      slug,
      description: 'Grupo automático do catálogo GeoBahia / INEMA WMS.',
      sortOrder: 1000 + index,
      status: 'active'
    };

    if (!group?.id) {
      const row = await createRow('layer_groups', layerGroupData(desired));
      group = mapLayerGroup(row);
      groups.push(group);
      bySlug.set(slug, group);
      byName.set(String(name).trim().toLowerCase(), group);
      created += 1;
    } else if (group.status !== 'active' || group.slug !== slug || Number(group.sortOrder || 0) !== desired.sortOrder) {
      const row = await updateRow('layer_groups', group.id, layerGroupData({ ...group, ...desired }, group));
      group = mapLayerGroup(row);
      groups = groups.map((item) => item.id === group.id ? group : item);
      bySlug.set(slug, group);
      byName.set(String(name).trim().toLowerCase(), group);
      updated += 1;
    }
    resolved.set(name, group);
  }

  return { resolved, created, updated, total: groupNames.length };
}

async function seedGeobahiaOfficialLayers() {
  const groupSeed = await ensureGeobahiaGroupsServer();
  const groupMap = groupSeed.resolved;
  let layersList = await listLayersSafe();
  let created = 0;
  let updated = 0;
  let restored = 0;
  let skipped = 0;
  const startedAt = new Date().toISOString();

  for (const item of GEOBAHIA_OFFICIAL_CATALOG) {
    const group = groupMap.get(item.group);
    if (!group?.id) { skipped += 1; continue; }
    const payload = geobahiaLayerPayload(item, group);
    payload.metadata.catalogSeededAt = startedAt;
    payload.metadata.resolvedBy = 'catalogo-interno-v21.9.185-wms-oficial';

    const existing = findExistingGeobahiaLayer(layersList, item);
    if (existing?.id) {
      const wasArchived = String(existing.status || '').toLowerCase() === 'archived' || existing.isPublic === false;
      const row = await updateRow('layers', existing.id, layerData({
        ...payload,
        isPublic: true,
        status: 'ready',
        metadata: { ...(existing.metadata || {}), ...payload.metadata, updatedBySeedAt: new Date().toISOString() }
      }, existing));
      const mapped = mapLayer(row);
      layersList = layersList.map((layer) => layer.id === existing.id ? mapped : layer);
      updated += 1;
      if (wasArchived) restored += 1;
    } else {
      const row = await createRow('layers', layerData({ ...payload, isPublic: true, status: 'ready' }));
      layersList.push(mapLayer(row));
      created += 1;
    }
  }

  return {
    created,
    updated,
    restored,
    skipped,
    total: GEOBAHIA_OFFICIAL_CATALOG.length,
    groupsCreated: groupSeed.created,
    groupsUpdated: groupSeed.updated,
    groupsTotal: groupSeed.total,
    serviceUrl: GEOBAHIA_WMS_BASE_URL,
    source: 'GeoBahia / INEMA',
    action: 'geobahia-seed-upsert'
  };
}

function remoteLayerDetection(input = {}) {
  const serviceUrl = String(input.serviceUrl || input.sourceUrl || '').trim();
  const lower = serviceUrl.toLowerCase();
  let serviceType = String(input.serviceType || input.type || '').toLowerCase();
  if (!serviceType) {
    if (lower.includes('service=wms') || lower.includes('/wms')) serviceType = 'wms';
    else if (lower.includes('/featureserver') || lower.includes('/mapserver')) serviceType = 'arcgis';
    else serviceType = 'geojson';
  }
  return { serviceType, serviceUrl, ok: Boolean(serviceUrl), message: serviceUrl ? 'URL reconhecida para cadastro no Appwrite.' : 'Informe uma URL para testar.' };
}

function isInemaProxyTarget(url) {
  try {
    const parsed = new URL(String(url || ''));
    return parsed.hostname === 'geoserver.inema.ba.gov.br'
      || parsed.hostname === 'inema.ba.gov.br'
      || parsed.hostname.endsWith('.inema.ba.gov.br');
  } catch {
    return /(?:^|\.)inema\.ba\.gov\.br(?:[/:?#]|$)/i.test(String(url || ''));
  }
}

const DEFAULT_WMS_PROXY_ALLOWED_HOSTS = new Set([
  'geoserver.inema.ba.gov.br',
  'geoserver.car.gov.br',
  'geoservicos.ibge.gov.br',
  'geoservicos.inde.gov.br',
  'www.geoservicos.inde.gov.br',
  'geoinfo.dados.embrapa.br',
  'geo.infrasa.gov.br',
  'sig.valec.gov.br',
  'acervofundiario.incra.gov.br'
]);

const WMS_PROXY_TIMEOUT_MS = 45_000;
const WMS_PROXY_MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const WMS_PROXY_MAX_REDIRECTS = 4;

function allowedWmsProxyHosts() {
  const configured = String(env('WMS_PROXY_ALLOWED_HOSTS', ''))
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_WMS_PROXY_ALLOWED_HOSTS, ...configured]);
}

function isInemaHostname(hostname) {
  const value = String(hostname || '').trim().toLowerCase();
  return value === 'inema.ba.gov.br' || value.endsWith('.inema.ba.gov.br');
}

function assertAllowedProxyUrl(url) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw statusError(400, 'O upstream WMS deve usar HTTP ou HTTPS.');
  }
  const hostname = String(url.hostname || '').toLowerCase();
  if (!allowedWmsProxyHosts().has(hostname)) {
    throw statusError(403, `Domínio WMS não autorizado no proxy: ${hostname}`);
  }
}

function geoserviceProxyTarget(request) {
  return queryValue(request, 'target')
    || queryValue(request, 'targetUrl')
    || queryValue(request, 'url')
    || queryValue(request, 'serviceUrl')
    || queryValue(request, 'baseUrl');
}


function decodeBase64UrlText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function geoserviceEncodedUpstreamFromPath(request) {
  const path = parsePath(request);
  const match = path.match(/^\/(?:api\/(?:geoservices\/)?)?(?:wms|wfs|wms-info|info)-url\/([^/?#]+)$/i);
  if (!match) return null;
  let decoded = '';
  try {
    decoded = decodeBase64UrlText(decodeURIComponent(match[1]));
  } catch {
    throw statusError(400, 'Payload do proxy geográfico inválido.');
  }
  if (!/^https?:\/\//i.test(decoded)) {
    throw statusError(400, 'Payload do proxy geográfico sem URL HTTP(S).');
  }
  const targetUrl = new URL(decoded);
  targetUrl.username = '';
  targetUrl.password = '';
  targetUrl.hash = '';
  assertAllowedProxyUrl(targetUrl);
  return targetUrl;
}

function geoserviceDefaultTargetForRequest(request) {
  const path = parsePath(request);
  const hasLayer = Boolean(
    queryValue(request, 'LAYERS')
    || queryValue(request, 'layers')
    || queryValue(request, 'TYPENAME')
    || queryValue(request, 'typeName')
    || queryValue(request, 'typenames')
  );
  const service = String(queryValue(request, 'SERVICE') || queryValue(request, 'service') || '').toUpperCase();
  const operation = String(queryValue(request, 'REQUEST') || queryValue(request, 'request') || '').toUpperCase();
  const looksLikeGeoRequest = hasLayer
    || ['GETMAP', 'GETFEATURE', 'GETFEATUREINFO', 'GETCAPABILITIES', 'GETLEGENDGRAPHIC'].includes(operation)
    || ['WMS', 'WFS'].includes(service);

  if ((path.startsWith('/api/geoservices/') || /^\/(?:api\/(?:geoservices\/)?)?(?:wms|wfs|wms-info|info)(?:$|-url\/|\/)/i.test(path)) && looksLikeGeoRequest) {
    // Contingência segura: se algum runtime/proxy perder o parâmetro target,
    // o catálogo oficial GeoBahia/INEMA ainda consegue funcionar sem abrir
    // proxy genérico para outros domínios. O domínio continua preso à allowlist.
    return 'https://geoserver.inema.ba.gov.br/geoserver/ows';
  }
  return '';
}

function normalizeProxyBaseTarget(rawTarget) {
  if (!rawTarget || !/^https?:\/\//i.test(String(rawTarget))) {
    throw statusError(400, 'Informe target/url/serviceUrl HTTP(S) para o proxy geográfico.');
  }
  const targetUrl = new URL(String(rawTarget));
  assertAllowedProxyUrl(targetUrl);

  targetUrl.username = '';
  targetUrl.password = '';
  targetUrl.hash = '';

  if (isInemaHostname(targetUrl.hostname)) {
    // /geoserver/ows atende WMS e WFS no GeoServer. Não forçamos /wms aqui,
    // porque o fallback WFS por URL também passa por esta normalização.
    if (/^\/(?:wms|ows|geoserver\/wms|geoserver\/ows)\/?$/i.test(targetUrl.pathname)) {
      targetUrl.pathname = '/geoserver/ows';
    }
  }

  const dynamicParams = new Set([
    'bbox', 'width', 'height', 'request', 'service', 'layers', 'layer',
    'styles', 'format', 'transparent', 'srs', 'crs', 'version', 'tiled',
    'exceptions', 'dpi', 'map_resolution', 'format_options', 'bgcolor',
    'query_layers', 'info_format', 'feature_count', 'x', 'y', 'i', 'j'
  ]);
  for (const key of [...targetUrl.searchParams.keys()]) {
    if (dynamicParams.has(String(key).toLowerCase())) targetUrl.searchParams.delete(key);
  }
  return targetUrl;
}

function requestQueryEntries(request) {
  const entries = [];
  const seen = new Set();
  const addEntry = (key, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => addEntry(key, item));
      return;
    }
    const k = String(key || '');
    const v = String(value);
    const fingerprint = `${k.toLowerCase()}=${v}`;
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    entries.push([k, v]);
  };

  for (const query of [request?.query, request?.params]) {
    if (!query) continue;
    if (query instanceof URLSearchParams) {
      for (const [key, value] of query.entries()) addEntry(key, value);
    } else if (typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) addEntry(key, value);
    }
  }

  for (const raw of queryStringSources(request)) {
    try {
      const params = new URLSearchParams(raw);
      for (const [key, value] of params.entries()) addEntry(key, value);
    } catch {}
  }

  for (const source of [request?.url, request?.path, request?.originalUrl, request?.href]) {
    try {
      const url = new URL(String(source || '/'), 'https://surveyor.local');
      for (const [key, value] of url.searchParams.entries()) addEntry(key, value);
    } catch {}
  }

  return entries;
}

function buildGeoserviceUpstreamUrl(request, rawTarget) {
  const targetUrl = normalizeProxyBaseTarget(rawTarget);
  const reserved = new Set([
    'target', 'targeturl', 'url', 'serviceurl', 'baseurl',
    'accesstoken', 'token', 'apibaseurl', 'api'
  ]);

  for (const [key, value] of requestQueryEntries(request)) {
    const normalizedKey = String(key || '').toLowerCase();
    if (reserved.has(normalizedKey)) continue;
    if (!/^[a-z0-9_.:-]{1,80}$/i.test(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    targetUrl.searchParams.set(key.toUpperCase(), String(value));
  }

  const operation = String(targetUrl.searchParams.get('REQUEST') || '').toUpperCase();
  if (!targetUrl.searchParams.has('SERVICE')) {
    targetUrl.searchParams.set('SERVICE', operation === 'GETFEATURE' ? 'WFS' : 'WMS');
  }
  if (!targetUrl.searchParams.has('VERSION')) {
    targetUrl.searchParams.set('VERSION', operation === 'GETFEATURE' ? '1.0.0' : '1.1.1');
  }
  if (String(targetUrl.searchParams.get('SERVICE') || '').toUpperCase() === 'WMS' && !targetUrl.searchParams.has('STYLES')) {
    targetUrl.searchParams.set('STYLES', '');
  }
  assertAllowedProxyUrl(targetUrl);
  return targetUrl;
}

function geoserviceUpstreamCandidates(targetUrl) {
  const candidates = [];
  const add = (value) => {
    const text = value instanceof URL ? value.toString() : String(value || '');
    if (text && !candidates.some((url) => url.toString() === text)) candidates.push(new URL(text));
  };

  if (isInemaHostname(targetUrl.hostname)) {
    const query = targetUrl.search || '';
    // Commercial readiness: o proxy legado da API não faz downgrade para HTTP
    // nem ignora certificado TLS. Fontes com TLS problemático devem passar pelo
    // GeoServices dedicado/Cloudflare, que possui política explícita e isolada.
    add(`https://geoserver.inema.ba.gov.br/geoserver/ows${query}`);
    add(`https://geoserver.inema.ba.gov.br/geoserver/wms${query}`);
    return candidates;
  }

  add(targetUrl);

  if (targetUrl.protocol === 'http:') {
    const httpsFallback = new URL(targetUrl.toString());
    httpsFallback.protocol = 'https:';
    candidates.unshift(httpsFallback);
  }

  return candidates;
}

async function requestBinaryViaNode(url, { redirectsLeft = WMS_PROXY_MAX_REDIRECTS, expectImage = false } = {}) {
  assertAllowedProxyUrl(url);
  const transport = url.protocol === 'https:' ? await import('node:https') : await import('node:http');

  return new Promise((resolve, reject) => {
    const req = transport.request(url, {
      method: 'GET',
      headers: {
        Accept: 'image/png,image/jpeg,image/*,application/json,text/plain,application/xml,*/*;q=0.2',
        'Accept-Encoding': 'identity',
        'User-Agent': `Surveyor-Appwrite-WMS-Proxy/${APP_VERSION}`,
        Connection: 'close'
      },
      ...(isInemaHostname(url.hostname) ? { family: 4 } : {}),
      ...(url.protocol === 'https:' ? {
        rejectUnauthorized: true,
        servername: url.hostname
      } : {})
    }, (upstream) => {
      const statusCode = Number(upstream.statusCode || 0);
      const location = upstream.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        upstream.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('O WMS excedeu o limite de redirecionamentos.'));
          return;
        }
        let redirectUrl;
        try {
          redirectUrl = new URL(location, url);
          assertAllowedProxyUrl(redirectUrl);
        } catch (error) {
          reject(error);
          return;
        }
        requestBinaryViaNode(redirectUrl, { redirectsLeft: redirectsLeft - 1, expectImage }).then(resolve, reject);
        return;
      }

      const chunks = [];
      let totalBytes = 0;
      upstream.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > WMS_PROXY_MAX_RESPONSE_BYTES) {
          upstream.destroy(new Error('A resposta WMS excedeu o limite de 20 MB.'));
          return;
        }
        chunks.push(chunk);
      });
      upstream.once('error', reject);
      upstream.once('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = String(upstream.headers['content-type'] || 'application/octet-stream');
        const normalizedType = contentType.split(';')[0].trim().toLowerCase();
        const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

        if (statusCode < 200 || statusCode >= 300) {
          const detail = buffer.toString('utf8', 0, Math.min(buffer.length, 700)).replace(/\s+/g, ' ').trim();
          reject(new Error(`WMS respondeu HTTP ${statusCode}${detail ? `: ${detail}` : ''}`));
          return;
        }
        if (!buffer.length) {
          reject(new Error('O WMS retornou uma resposta vazia.'));
          return;
        }

        const isImage = normalizedType.startsWith('image/') || isPng || isJpeg;
        if (expectImage && !isImage) {
          const detail = buffer.toString('utf8', 0, Math.min(buffer.length, 900)).replace(/\s+/g, ' ').trim();
          reject(new Error(detail || `O WMS respondeu com Content-Type ${contentType}, sem imagem.`));
          return;
        }

        const finalContentType = normalizedType.startsWith('image/')
          ? contentType
          : (isPng ? 'image/png' : (isJpeg ? 'image/jpeg' : contentType));

        resolve({
          upstream: { status: statusCode, headers: upstream.headers },
          contentType: finalContentType,
          buffer,
          targetUrl: url.toString(),
          isImage
        });
      });
    });

    req.setTimeout(WMS_PROXY_TIMEOUT_MS, () => {
      req.destroy(new Error(`O WMS excedeu o tempo limite de ${Math.round(WMS_PROXY_TIMEOUT_MS / 1000)} segundos.`));
    });
    req.once('error', reject);
    req.end();
  });
}

async function fetchFirstAvailableGeoservice(candidates, { expectImage = false } = {}) {
  const errors = [];
  for (const candidate of candidates) {
    try {
      return await requestBinaryViaNode(candidate, { expectImage });
    } catch (error) {
      errors.push(`${candidate.protocol}//${candidate.host}${candidate.pathname}: ${error?.message || String(error)}`);
    }
  }
  throw statusError(502, `O proxy geográfico não conseguiu receber uma imagem válida do serviço externo. ${errors.slice(0, 3).join(' | ')}`.trim());
}

function binaryResponse(response, buffer, status, headers) {
  if (typeof response.binary === 'function') {
    return response.binary(buffer, status, headers);
  }
  if (typeof response.send === 'function') {
    return response.send(buffer, status, headers);
  }
  throw statusError(500, 'Runtime Appwrite sem suporte a resposta binária.');
}

async function proxyGeoService(request, response) {
  const encodedTargetUrl = geoserviceEncodedUpstreamFromPath(request);
  const target = geoserviceProxyTarget(request) || geoserviceDefaultTargetForRequest(request);
  const targetUrl = encodedTargetUrl || buildGeoserviceUpstreamUrl(request, target);
  const requestedOperation = String(targetUrl.searchParams.get('REQUEST') || queryValue(request, 'request') || '').toUpperCase();
  const path = parsePath(request);
  const requestedService = String(targetUrl.searchParams.get('SERVICE') || queryValue(request, 'service') || '').toUpperCase();
  const expectImage = requestedService === 'WMS'
    && requestedOperation !== 'GETFEATUREINFO'
    && requestedOperation !== 'GETCAPABILITIES'
    && requestedOperation !== 'GETLEGENDGRAPHIC'
    && !path.includes('wms-info');
  const result = await fetchFirstAvailableGeoservice(geoserviceUpstreamCandidates(targetUrl), { expectImage });

  const headers = {
    'Access-Control-Allow-Origin': corsOrigin(request),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Type, Content-Length, X-Surveyor-Upstream-Url',
    'Content-Type': result.contentType,
    'Content-Length': String(result.buffer.length),
    'Cache-Control': result.isImage ? 'public, max-age=900, stale-while-revalidate=86400' : 'no-store',
    'X-Surveyor-Upstream-Url': result.targetUrl
  };

  // WFS/GetCapabilities/GetFeatureInfo são consumidos por fetch() no navegador.
  // Em alguns runtimes do Appwrite, respostas textuais por res.binary() não
  // preservam CORS corretamente. Para JSON/XML/texto usamos res.send().
  if (!result.isImage) {
    const text = result.buffer.toString('utf8');
    if (typeof response.send === 'function') return response.send(text, result.upstream.status, headers);
  }

  return binaryResponse(response, result.buffer, result.upstream.status, headers);
}


function normalizePlanDocumentAttachment(input = {}) {
  const to = normalizeEmail(input.to || input.email);
  const name = String(input.name || '').trim().slice(0, 180);
  const planName = String(input.planName || '').trim().slice(0, 180);
  const documentType = String(input.documentType || 'receipt') === 'receipt' ? 'receipt' : 'term';
  const filename = String(input.filename || '').trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 240);
  const contentBase64 = String(input.contentBase64 || '').replace(/^data:application\/pdf;base64,/, '').trim();
  const maxBytes = Number(env('PLAN_DOCUMENT_MAX_ATTACHMENT_BYTES', String(8 * 1024 * 1024))) || 8 * 1024 * 1024;
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw statusError(400, 'E-mail de destino inválido.');
  if (!name) throw statusError(400, 'Nome do cliente não informado.');
  if (!planName) throw statusError(400, 'Plano não informado.');
  if (!filename.toLowerCase().endsWith('.pdf')) throw statusError(400, 'Nome do arquivo PDF inválido.');
  if (!contentBase64) throw statusError(400, 'Conteúdo do PDF não informado.');
  let pdfBuffer;
  try { pdfBuffer = Buffer.from(contentBase64, 'base64'); } catch { throw statusError(400, 'PDF em Base64 inválido.'); }
  if (!pdfBuffer.length || pdfBuffer.slice(0, 4).toString() !== '%PDF') throw statusError(400, 'O anexo não é um PDF válido.');
  if (pdfBuffer.length > maxBytes) throw statusError(413, `O PDF excede o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  return {
    to, name, planName, documentType, filename, contentBase64, pdfBuffer,
    startDate: String(input.startDate || '').slice(0, 40),
    endDate: String(input.endDate || '').slice(0, 40),
    accessEmail: normalizeEmail(input.accessEmail || to),
    amountCents: Number(input.amountCents || 0),
    documentCode: String(input.documentCode || '').slice(0, 100),
    welcomeEmail: input.welcomeEmail === true,
    firstAccessUrl: String(input.firstAccessUrl || '').trim().slice(0, 2500),
    loginUrl: String(input.loginUrl || env('SURVEYOR_LOGIN_URL', 'https://surveyorr.com.br/login/')).slice(0, 500)
  };
}

async function dispatchPlanDocumentEmail(input = {}) {
  const data = normalizePlanDocumentAttachment(input);
  const emailFunctionUrl = String(env('EMAIL_FUNCTION_URL', '') || '').replace(/\/+$/, '');
  const emailFunctionSecret = env('EMAIL_FUNCTION_SECRET');
  if (!emailFunctionUrl || !emailFunctionSecret) throw statusError(503, 'Function de e-mail não configurada para documentos dos planos.');
  const endpoint = `${emailFunctionUrl}${env('EMAIL_FUNCTION_PLAN_DOCUMENT_PATH', '/api/admin/send-plan-document')}`;
  const emailResponse = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Surveyor-Internal-Secret': emailFunctionSecret },
    body: JSON.stringify({
      to: data.to, name: data.name, planName: data.planName, documentType: data.documentType,
      filename: data.filename, contentBase64: data.contentBase64, startDate: data.startDate,
      endDate: data.endDate, accessEmail: data.accessEmail, amountCents: data.amountCents,
      documentCode: data.documentCode, welcomeEmail: data.welcomeEmail,
      firstAccessUrl: data.firstAccessUrl, loginUrl: data.loginUrl
    })
  }, Number(env('EMAIL_UPSTREAM_TIMEOUT_MS', '12000')) || 12000);
  const emailData = await emailResponse.json().catch(() => ({}));
  if (!emailResponse.ok) throw statusError(emailResponse.status >= 500 ? 502 : emailResponse.status, emailData?.error || emailData?.message || `Function de e-mail recusou o envio (${emailResponse.status}).`, emailData);
  return { sent: true, to: data.to, filename: data.filename, bytes: data.pdfBuffer.length, provider: emailData?.provider || null, id: emailData?.id || null, documentType: data.documentType, planName: data.planName };
}



async function dispatchFirstAccessEmail(input = {}) {
  const to = normalizeEmail(input.to || input.email);
  const name = String(input.name || '').trim().slice(0, 180) || 'cliente';
  const planName = String(input.planName || 'Plano Surveyor').trim().slice(0, 180);
  const firstAccessUrl = String(input.firstAccessUrl || '').trim().slice(0, 2400);
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw statusError(400, 'E-mail de primeiro acesso inválido.');
  if (!/^https:\/\//i.test(firstAccessUrl) || !firstAccessUrl.includes('/primeiro-acesso/')) throw statusError(400, 'Link de primeiro acesso inválido.');
  const emailFunctionUrl = String(env('EMAIL_FUNCTION_URL', '') || '').replace(/\/+$/, '');
  const emailFunctionSecret = env('EMAIL_FUNCTION_SECRET');
  if (!emailFunctionUrl || !emailFunctionSecret) throw statusError(503, 'Function de e-mail não configurada para primeiro acesso.');
  const endpoint = `${emailFunctionUrl}${env('EMAIL_FUNCTION_FIRST_ACCESS_PATH', '/api/security/send-first-access')}`;
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Surveyor-Internal-Secret': emailFunctionSecret },
    body: JSON.stringify({ to, name, planName, firstAccessUrl })
  }, Number(env('EMAIL_UPSTREAM_TIMEOUT_MS', '12000')) || 12000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw statusError(response.status >= 500 ? 502 : response.status, data?.error || data?.message || 'Não foi possível enviar o link de primeiro acesso.', data);
  return { sent: true, to, provider: data?.provider || null, id: data?.id || null };
}

function buildFirstAccessInvitation({ userId, email, ttlSeconds = 30 * 60 } = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!userId || !normalizedEmail) return { token: '', url: '' };
  const token = signJwt({ type: 'first-access-password', sub: String(userId), email: normalizedEmail }, ttlSeconds);
  const loginBase = String(env('SURVEYOR_LOGIN_URL', 'https://surveyorr.com.br/login/')).trim() || 'https://surveyorr.com.br/login/';
  let url;
  try { url = new URL('/primeiro-acesso/', loginBase); } catch { url = new URL('https://surveyorr.com.br/primeiro-acesso/'); }
  const fragment = new URLSearchParams({ token, email: normalizedEmail });
  url.hash = fragment.toString();
  return { token, url: url.toString() };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, Number(timeoutMs || 3500)));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw statusError(504, 'A Function de e-mail demorou além do limite e a notificação foi ignorada.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function dispatchAccountEmailChangedEmail(input = {}) {
  const to = normalizeEmail(input.to || input.email);
  const name = String(input.name || '').trim().slice(0, 180) || 'cliente';
  const oldEmail = normalizeEmail(input.oldEmail);
  const newEmail = normalizeEmail(input.newEmail);
  const audience = String(input.audience || 'new').toLowerCase() === 'old' ? 'old' : 'new';
  if (!to || !oldEmail || !newEmail) throw statusError(400, 'Dados incompletos para notificação da alteração de e-mail.');
  const emailFunctionUrl = String(env('EMAIL_FUNCTION_URL', '') || '').replace(/\/+$/, '');
  const emailFunctionSecret = env('EMAIL_FUNCTION_SECRET');
  if (!emailFunctionUrl || !emailFunctionSecret) throw statusError(503, 'Function de e-mail não configurada para alteração de login.');
  const endpoint = `${emailFunctionUrl}${env('EMAIL_FUNCTION_ACCOUNT_EMAIL_CHANGED_PATH', '/api/admin/send-account-email-changed')}`;
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Surveyor-Internal-Secret': emailFunctionSecret },
    body: JSON.stringify({
      to, name, oldEmail, newEmail, audience,
      loginUrl: String(input.loginUrl || env('SURVEYOR_LOGIN_URL', 'https://surveyorr.com.br/login/')).slice(0, 500)
    })
  }, 3500);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw statusError(response.status >= 500 ? 502 : response.status, data?.error || data?.message || 'A Function de e-mail recusou a notificação.', data);
  return { sent: true, requested: true, to, provider: data?.provider || null, id: data?.id || null };
}

async function dispatchWorkspaceWelcomeEmail(input = {}) {
  const to = normalizeEmail(input.to || input.email);
  const name = String(input.name || '').trim().slice(0, 180);
  const ownerName = String(input.ownerName || '').trim().slice(0, 180);
  const planName = String(input.planName || 'Plano Surveyor').trim().slice(0, 180);
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw statusError(400, 'E-mail do subusuário inválido.');
  if (!name || !ownerName) throw statusError(400, 'Nome do subusuário e do titular são obrigatórios.');
  const emailFunctionUrl = String(env('EMAIL_FUNCTION_URL', '') || '').replace(/\/+$/, '');
  const emailFunctionSecret = env('EMAIL_FUNCTION_SECRET');
  if (!emailFunctionUrl || !emailFunctionSecret) throw statusError(503, 'Function de e-mail não configurada para boas-vindas de subusuários.');
  const endpoint = `${emailFunctionUrl}${env('EMAIL_FUNCTION_SUBUSER_PATH', '/api/admin/send-subuser-welcome')}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Surveyor-Internal-Secret': emailFunctionSecret },
    body: JSON.stringify({
      to, name, ownerName, planName,
      accessEmail: to,
      memberRole: normalizeWorkspaceMemberRole(input.memberRole || 'collaborator'),
      paidExtraSeat: Boolean(input.paidExtraSeat),
      firstAccessUrl: String(input.firstAccessUrl || '').slice(0, 2500),
      loginUrl: String(input.loginUrl || env('SURVEYOR_LOGIN_URL', 'https://surveyorr.com.br/login/')).slice(0, 500)
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw statusError(response.status >= 500 ? 502 : response.status, data?.error || data?.message || `Function de e-mail recusou o envio (${response.status}).`, data);
  return { sent: true, to, provider: data?.provider || null, id: data?.id || null };
}


function maskPhone(phone = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 4 ? '*'.repeat(digits.length) : `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

function maskPersonName(name = '') {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  if (!first) return '';
  return `${first.slice(0, 1)}${'*'.repeat(Math.max(3, Math.min(8, first.length - 1)))}`;
}

function publicCommerceOrder(row = {}, { includePrivateCustomer = false } = {}) {
  const email = normalizeEmail(row.customerEmail || '');
  return {
    id: row.$id || row.id,
    status: row.status || 'draft',
    customer: includePrivateCustomer
      ? { name: row.customerName || '', email, whatsapp: row.customerWhatsapp || '' }
      : { name: maskPersonName(row.customerName || ''), email: maskEmail(email), whatsapp: maskPhone(row.customerWhatsapp || '') },
    planSlug: row.planSlug || 'basic_annual', planName: row.planName || '', billingCycle: row.billingCycle || 'mensal',
    amountCents: Number(row.amountCents || 0), currency: row.currency || 'BRL', expiresAt: row.expiresAt || null,
    createdAt: row.createdAt || row.$createdAt || null, paidAt: row.paidAt || null
  };
}

async function commercePlan(slug) {
  const plan = await findPlanBySlugSafe(slug || 'basic_annual');
  if (!plan || plan.active === false) throw statusError(404, 'Plano indisponível.');
  return plan;
}

function commerceInternalSecret(request) {
  const expected = String(env('PAYMENT_INTERNAL_SECRET', '') || '').trim();
  if (!expected || expected.length < 32) {
    throw statusError(503, 'Integração de pagamento ainda não configurada.', { code: 'PAYMENT_SECRET_NOT_CONFIGURED' });
  }
  const received = String(headerValue(request, 'x-surveyor-payment-secret') || '').trim()
    || bearerToken(headerValue(request, 'authorization'));
  if (!safeSecretEqual(received, expected)) {
    throw statusError(403, 'Integração de pagamento não autorizada.', { code: 'PAYMENT_SECRET_INVALID' });
  }
  return true;
}

function normalizePaymentPlanKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function paymentPlanSlug(value = '') {
  const normalized = normalizePaymentPlanKey(value);
  const aliases = {
    'basico': 'basic_annual',
    'basico-mensal': 'basic_monthly',
    'basico_mensal': 'basic_monthly',
    'surveyor-basico-mensal': 'basic_monthly',
    'basic-monthly': 'basic_monthly',
    'basic_monthly': 'basic_monthly',
    'plus': 'plus_annual',
    'plus-mensal': 'plus_monthly',
    'plus_mensal': 'plus_monthly',
    'surveyor-plus-mensal': 'plus_monthly',
    'plus-monthly': 'plus_monthly',
    'plus_monthly': 'plus_monthly',
    'pro': 'pro_annual',
    'pro-mensal': 'pro_monthly',
    'pro_mensal': 'pro_monthly',
    'surveyor-pro-mensal': 'pro_monthly',
    'pro-monthly': 'pro_monthly',
    'pro_monthly': 'pro_monthly',
    'basico-anual': 'basic_annual',
    'basico_anual': 'basic_annual',
    'surveyor-basico-anual': 'basic_annual',
    'basic-annual': 'basic_annual',
    'basic_annual': 'basic_annual',
    'plus-anual': 'plus_annual',
    'plus_anual': 'plus_annual',
    'surveyor-plus-anual': 'plus_annual',
    'plus-annual': 'plus_annual',
    'plus_annual': 'plus_annual',
    'pro-anual': 'pro_annual',
    'pro_anual': 'pro_annual',
    'surveyor-pro-anual': 'pro_annual',
    'pro-annual': 'pro_annual',
    'pro_annual': 'pro_annual'
  };
  return aliases[normalized] || normalized;
}

async function commercePlanForPayment(value) {
  const slug = paymentPlanSlug(value);
  if (LEGACY_MONTHLY_PLAN_SLUGS.has(slug)) {
    throw statusError(409, 'O Surveyor comercializa somente planos anuais. Selecione a modalidade anual correspondente.', {
      code: 'PAYMENT_MONTHLY_PLAN_DISABLED',
      field: 'plan'
    });
  }
  const allowed = new Set(DEFAULT_PLANS.filter((plan) => plan.billingCycle === 'anual' && plan.active !== false).map((plan) => plan.slug));
  if (!slug || !allowed.has(slug)) {
    throw statusError(400, 'Plano informado pelo Pagamentos não é reconhecido.', {
      code: 'PAYMENT_PLAN_INVALID',
      field: 'plan'
    });
  }
  const plan = await commercePlan(slug);
  if (!plan || plan.active === false) throw statusError(409, 'O plano contratado está indisponível.', { code: 'PAYMENT_PLAN_INACTIVE' });
  return plan;
}

function processedPaymentIds(user = {}) {
  const value = userPrefs(user)?.surveyor?.processedPaymentIds;
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    } catch {}
    return value.split(/[;,\s]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function paymentProvisionMarker(user = {}) {
  const marker = userPrefs(user)?.surveyor?.paymentProvisioning;
  return marker && typeof marker === 'object' ? marker : null;
}

function paymentMarkerMatches(marker, paymentId) {
  return Boolean(marker && String(marker.paymentId || '') === String(paymentId || ''));
}

function addBillingPeriod(baseDate, billingCycle = 'mensal') {
  const base = new Date(baseDate);
  if (!Number.isFinite(base.getTime())) throw statusError(500, 'Data-base da assinatura inválida.', { code: 'PAYMENT_SUBSCRIPTION_DATE_INVALID' });
  const result = new Date(base.getTime());
  if (String(billingCycle || '').toLowerCase().includes('anual')) result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

function maskPaymentEmail(email = '') {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return 'sem-email';
  return `${local.slice(0, 2)}***@${domain}`;
}

function logPaymentProvision(stage, context = {}, level = 'info') {
  const payload = {
    stage,
    paymentId: String(context.paymentId || '').slice(0, 80),
    orderId: String(context.orderId || '').slice(0, 80),
    email: maskPaymentEmail(context.email || ''),
    userId: String(context.userId || '').slice(0, 80),
    planSlug: String(context.planSlug || '').slice(0, 80),
    accountExisted: context.accountExisted === true,
    retry: context.retry === true,
    message: String(context.message || '').replace(/\s+/g, ' ').slice(0, 400)
  };
  const line = `[payment-provision] ${JSON.stringify(payload)}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function paymentProvisionPublicCode(error, stage = '') {
  const explicit = String(error?.details?.code || '').trim();
  if (explicit) return explicit.toLowerCase();
  if (stage === 'auth_lookup') return 'appwrite_user_lookup_failed';
  if (stage === 'auth_create') return 'appwrite_user_creation_failed';
  if (stage === 'auth_prepare') return 'appwrite_user_prepare_failed';
  if (stage === 'profile') return 'surveyor_profile_update_failed';
  if (stage === 'finalize') return 'payment_provision_finalize_failed';
  if (stage === 'plan') return 'payment_plan_resolution_failed';
  return 'payment_provision_failed';
}

function paymentProvisionPublicMessage(error, stage = '') {
  const status = Number(error?.status || 500);
  let message = String(error?.message || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!message) message = 'Não foi possível concluir o provisionamento.';
  if (message.length > 500) message = message.slice(0, 500);
  if (status >= 500 && !/^appwrite|^não foi possível|^integração|^tempo limite/i.test(message)) {
    const byStage = {
      auth_lookup: 'Não foi possível consultar a conta no Appwrite Auth.',
      auth_create: 'Não foi possível criar a conta no Appwrite Auth.',
      auth_prepare: 'Não foi possível preparar os dados de autenticação da conta.',
      profile: 'Não foi possível concluir o perfil interno do Surveyor.',
      finalize: 'A conta foi localizada, mas a contratação não pôde ser finalizada.',
      plan: 'Não foi possível validar o plano contratado.'
    };
    message = byStage[stage] || 'Não foi possível concluir o provisionamento da conta.';
  }
  return message;
}

async function provisionPaidAccount(order, request, hooks = {}) {
  const onStage = typeof hooks.onStage === 'function' ? hooks.onStage : () => {};
  const setStage = (stage, extra = {}) => {
    onStage(stage, extra);
    logPaymentProvision(stage, {
      paymentId: order.paymentId,
      orderId: order.orderId,
      email: order.customerEmail || order.email,
      planSlug: order.planSlug,
      ...extra
    });
  };

  const email = normalizeEmail(order.customerEmail || order.email);
  if (!email) throw statusError(400, 'Pedido sem e-mail válido.', { code: 'PAYMENT_EMAIL_INVALID', field: 'email' });
  const paymentId = String(order.paymentId || order.gatewayPaymentId || '').trim().slice(0, 180);
  if (!paymentId) throw statusError(400, 'Identificador do pagamento não informado.', { code: 'PAYMENT_ID_REQUIRED', field: 'paymentId' });

  setStage('auth_lookup');
  let appwriteUser = await getAppwriteUserByEmail(email);
  let accountExisted = Boolean(appwriteUser);
  let createdNow = false;
  const userIdExisting = appwriteUser?.$id || appwriteUser?.id || '';
  let existingProfile = userIdExisting ? await findProfileForLogin(userIdExisting, email).catch(() => null) : null;

  if (String(existingProfile?.role || '').toLowerCase() === 'admin' && String(env('ALLOW_PAYMENT_PROVISION_ADMIN', 'false')).toLowerCase() !== 'true') {
    throw statusError(409, 'Este e-mail pertence a uma conta administrativa e não pode ser alterado pelo provisionamento automático.', {
      code: 'PAYMENT_ADMIN_ACCOUNT_PROTECTED', field: 'email'
    });
  }

  setStage('plan', { accountExisted });
  const plan = order.resolvedPlan || await commercePlanForPayment(order.planSlug || order.planId || order.plan);
  const completedIdsBefore = appwriteUser ? processedPaymentIds(appwriteUser) : [];
  let marker = appwriteUser ? paymentProvisionMarker(appwriteUser) : null;
  const sameMarker = paymentMarkerMatches(marker, paymentId);
  const markerCompleted = sameMarker && marker?.state === 'completed';

  // Uma resposta idempotente só é considerada concluída quando Auth + perfil interno existem.
  if ((completedIdsBefore.includes(paymentId) || markerCompleted) && appwriteUser && existingProfile) {
    setStage('already_completed', { userId: userIdExisting, accountExisted: true, retry: true, planSlug: marker?.planSlug || plan.slug });
    return {
      userId: userIdExisting,
      email,
      name: existingProfile?.name || appwriteUser.name || email,
      planSlug: marker?.planSlug || existingProfile?.plan || existingProfile?.planSlug || plan.slug,
      expiresAt: marker?.expiresAt || profileExpiresAt(existingProfile || {}, appwriteUser),
      accountExisted: true,
      alreadyProcessed: true,
      mustChangePassword: Boolean(userPrefs(appwriteUser)?.surveyor?.mustChangePassword),
      paidAmountCents: Number(marker?.paidAmountCents ?? order.paidAmountCents ?? order.amountCents ?? 0),
      emailNotification: { sent: false, skipped: true, reason: 'already_processed' }
    };
  }

  if (!appwriteUser) {
    setStage('auth_create');
    const bootstrapPassword = `${crypto.randomBytes(24).toString('base64url')}aA1!`;
    try {
      appwriteUser = await createAppwriteUser({ email, password: bootstrapPassword, name: order.customerName || order.name || email });
      createdNow = true;
      accountExisted = false;
      await updateAppwriteUserSurveyorPrefs(appwriteUser.$id || appwriteUser.id, {
        mustChangePassword: true,
        firstAccessInviteIssuedAt: new Date().toISOString()
      });
    } catch (error) {
      const duplicate = Number(error?.status || error?.appwriteStatus) === 409 || /already exists|already registered|user.*exist/i.test(String(error?.message || ''));
      if (!duplicate) throw error;
      // Tentativa anterior pode ter criado o Auth e falhado depois. Recupere a mesma conta.
      appwriteUser = await getAppwriteUserByEmail(email);
      if (!appwriteUser) throw error;
      accountExisted = true;
      setStage('auth_recovered_duplicate', { userId: appwriteUser.$id || appwriteUser.id, accountExisted: true, retry: true });
    }
  }

  const userId = appwriteUser.$id || appwriteUser.id;
  existingProfile = existingProfile || await findProfileForLogin(userId, email).catch(() => null);
  if (String(existingProfile?.role || '').toLowerCase() === 'admin' && String(env('ALLOW_PAYMENT_PROVISION_ADMIN', 'false')).toLowerCase() !== 'true') {
    if (createdNow) await deleteAppwriteUser(userId).catch(() => null);
    throw statusError(409, 'Este e-mail pertence a uma conta administrativa e não pode ser alterado pelo provisionamento automático.', {
      code: 'PAYMENT_ADMIN_ACCOUNT_PROTECTED', field: 'email'
    });
  }

  const now = new Date();
  marker = paymentProvisionMarker(appwriteUser);
  const reuseMarker = paymentMarkerMatches(marker, paymentId) && marker?.startedAt && marker?.expiresAt;
  const currentExpiryMs = existingProfile?.expiresAt ? Date.parse(existingProfile.expiresAt) : NaN;
  const coverageStart = reuseMarker
    ? new Date(marker.startedAt)
    : (Number.isFinite(currentExpiryMs) && currentExpiryMs > now.getTime() ? new Date(currentExpiryMs) : now);
  const expiresAt = reuseMarker ? String(marker.expiresAt) : addBillingPeriod(coverageStart, plan.billingCycle || order.billingCycle).toISOString();
  const startedAt = reuseMarker ? String(marker.startedAt) : coverageStart.toISOString();
  const phone = normalizeBrazilPhone(order.customerWhatsapp || order.phone || order.whatsapp || '', { required: false });
  const paidAmountCents = Math.max(0, Number(order.paidAmountCents ?? order.finalAmountCents ?? order.amountCents ?? 0) || 0);
  const listPriceCents = Math.max(0, Number(plan.priceCents || 0) || 0);
  const mustChangePassword = createdNow || Boolean(userPrefs(appwriteUser)?.surveyor?.mustChangePassword);
  const firstAccessInvitation = mustChangePassword ? buildFirstAccessInvitation({ userId, email }) : { token: '', url: '' };

  setStage('auth_prepare', { userId, accountExisted, retry: reuseMarker, planSlug: plan.slug });
  const pendingMarker = {
    state: 'pending', paymentId, orderId: String(order.orderId || paymentId).slice(0, 180),
    planSlug: plan.slug, billingCycle: plan.billingCycle || order.billingCycle || 'anual',
    startedAt, expiresAt, listPriceCents, paidAmountCents,
    paymentMethod: String(order.paymentMethod || 'pending_gateway').slice(0, 80),
    couponCode: String(order.couponCode || '').slice(0, 100),
    updatedAt: now.toISOString()
  };

  try {
    await updateAppwriteUserSurveyorPrefs(userId, { paymentProvisioning: pendingMarker });
  } catch (error) {
    if (createdNow) await deleteAppwriteUser(userId).catch(() => null);
    throw error;
  }

  setStage('profile', { userId, accountExisted, retry: reuseMarker, planSlug: plan.slug });
  await updateAppwriteUserName(userId, order.customerName || order.name || appwriteUser.name || email);
  const profileRole = String(existingProfile?.role || '').toLowerCase() === 'admin' ? 'admin' : 'user';
  const profile = await createOrUpdateAdminProfile({
    name: order.customerName || order.name || email,
    email,
    role: profileRole,
    planSlug: plan.slug,
    status: 'active',
    expiresAt,
    phone,
    whatsapp: phone,
    emailVerified: existingProfile ? undefined : false
  }, appwriteUser, existingProfile);

  setStage('finalize', { userId, accountExisted, planSlug: plan.slug });
  const refreshedUser = await getAppwriteUserById(userId).catch(() => appwriteUser);
  const paymentHistory = [...new Set([...processedPaymentIds(refreshedUser || appwriteUser), paymentId])].slice(-50);
  const completedMarker = { ...pendingMarker, state: 'completed', completedAt: new Date().toISOString() };
  await updateAppwriteUserSurveyorPrefs(userId, {
    status: 'active',
    mustChangePassword,
    accountProvisionedByPayment: true,
    provisionedOrderId: order.orderId || paymentId,
    lastProvisionedPaymentId: paymentId,
    processedPaymentIds: paymentHistory,
    subscriptionStartedAt: startedAt,
    expiresAt,
    whatsapp: phone,
    phone,
    paymentProvisioning: completedMarker,
    contract: {
      planSlug: plan.slug,
      startedAt,
      expiresAt,
      listPriceCents,
      paidAmountCents,
      amountCents: paidAmountCents,
      paymentMethod: order.paymentMethod || 'pending_gateway',
      paymentId,
      couponCode: String(order.couponCode || '').slice(0, 100),
      updatedAt: new Date().toISOString()
    }
  });

  await appendSecurityEvent({
    type: 'billing',
    action: accountExisted ? 'paid_account_updated' : 'paid_account_provisioned',
    targetUserId: userId,
    targetEmail: email,
    ip: requestIp(request),
    userAgent: requestUserAgent(request),
    status: 'ok',
    message: `${accountExisted ? 'Assinatura atualizada' : 'Conta criada automaticamente'} pelo pagamento ${paymentId}.`,
    metadata: { paymentId, orderId: order.orderId || paymentId, planSlug: plan.slug, startedAt, expiresAt, listPriceCents, paidAmountCents, accountExisted }
  }).catch(() => null);

  let emailNotification = { sent: false, skipped: true, reason: 'not_requested' };
  const onboarding = order.onboardingDocument && typeof order.onboardingDocument === 'object' ? order.onboardingDocument : null;
  if (onboarding?.sendEmail === true && onboarding?.contentBase64) {
    setStage('email', { userId, accountExisted, planSlug: plan.slug });
    try {
      emailNotification = await dispatchPlanDocumentEmail({
        ...onboarding,
        to: email,
        name: order.customerName || order.name || appwriteUser.name || email,
        planName: onboarding.planName || plan.name,
        accessEmail: email,
        amountCents: paidAmountCents,
        welcomeEmail: Boolean(firstAccessInvitation.url),
        firstAccessUrl: firstAccessInvitation.url
      });
    } catch (error) {
      emailNotification = { sent: false, skipped: false, error: String(error?.message || 'Falha no envio de e-mail.').slice(0, 500) };
      logPaymentProvision('email_failed', { paymentId, orderId: order.orderId, email, userId, planSlug: plan.slug, message: emailNotification.error }, 'warn');
    }
  } else if (firstAccessInvitation.url) {
    setStage('first_access_email', { userId, accountExisted, planSlug: plan.slug });
    try {
      emailNotification = await dispatchFirstAccessEmail({
        to: email,
        name: order.customerName || order.name || appwriteUser.name || email,
        planName: plan.name,
        firstAccessUrl: firstAccessInvitation.url
      });
    } catch (error) {
      emailNotification = { sent: false, skipped: false, error: String(error?.message || 'Falha no envio do primeiro acesso.').slice(0, 500) };
      logPaymentProvision('first_access_email_failed', { paymentId, orderId: order.orderId, email, userId, planSlug: plan.slug, message: emailNotification.error }, 'warn');
    }
  }

  setStage('completed', { userId, accountExisted, planSlug: plan.slug });
  return {
    userId,
    email,
    name: profile?.name || order.customerName || order.name || email,
    planSlug: plan.slug,
    startedAt,
    expiresAt,
    accountExisted,
    alreadyProcessed: false,
    mustChangePassword,
    paidAmountCents,
    listPriceCents,
    emailNotification
  };
}


async function route(request, response) {
  const path = parsePath(request);
  const httpMethod = method(request);

  if (httpMethod === 'OPTIONS') return send(response, request, 204, null);

  if (path === '/api/live') {
    return send(response, request, 200, { ok: true, service: 'Surveyor API Appwrite Function', status: 'live', version: APP_VERSION });
  }

  if (path === '/api/ready') {
    try {
      await listRows('users_profile', [Query.limit(1)]);
      return send(response, request, 200, { ok: true, service: 'Surveyor API Appwrite Function', status: 'ready', database: 'appwrite', databaseReachable: true, version: APP_VERSION });
    } catch (readyError) {
      return send(response, request, 503, { ok: false, service: 'Surveyor API Appwrite Function', status: 'not_ready', database: 'appwrite', databaseReachable: false, version: APP_VERSION, error: 'Dependência principal indisponível.' }, { 'Retry-After': '30' });
    }
  }

  if (path === '/api/health') {
    // Endpoint público mínimo: não expõe quais integrações/chaves estão configuradas.
    return send(response, request, 200, {
      ok: true,
      service: 'Surveyor API Appwrite Function',
      status: 'ready',
      version: APP_VERSION,
      readinessEndpoint: '/api/ready'
    }, { 'Cache-Control': 'no-store' });
  }

  if (path === '/api/favicon.ico') {
    return send(response, request, 204, null);
  }

  // Defesa contra rajadas/abuso da API sem depender de ENV, collection ou serviço novo.
  assertGeneralApiRateLimit(request, path, httpMethod);

  if (path === '/api/setup/bootstrap-admin' && httpMethod === 'POST') {
    if (String(env('ENABLE_BOOTSTRAP_ROUTES', 'false')).toLowerCase() !== 'true') throw statusError(404, 'Rota não encontrada na Surveyor Appwrite Function.');
    const secret = headerValue(request, 'x-bootstrap-secret') || headerValue(request, 'X-Bootstrap-Secret');
    if (!env('BOOTSTRAP_SECRET') || !safeSecretEqual(secret, env('BOOTSTRAP_SECRET'))) throw statusError(403, 'Bootstrap secret inválido.');
    const input = await bodyJson(request);
    const email = normalizeEmail(input.email);
    if (!email) throw statusError(400, 'Informe um e-mail válido.');
    const existing = await findProfileByEmail(email).catch(() => null);
    if (existing) return send(response, request, 200, { ok: true, user: publicUser(existing), alreadyExists: true });
    const user = await createAppwriteUser({ email, password: input.password, name: input.name || 'Administrador' });
    const now = new Date().toISOString();
    const profile = await createRow('users_profile', {
      userId: user.$id || user.id,
      name: input.name || user.name || 'Administrador',
      email,
      role: 'admin',
      plan: 'pro_annual',
      permissions: JSON.stringify({ admin: true, all: true }),
      createdAt: now,
      updatedAt: now
    });
    return send(response, request, 201, { ok: true, user: publicUser(profile, user) });
  }

  if (path === '/api/setup/repair-profile' && httpMethod === 'POST') {
    if (String(env('ENABLE_BOOTSTRAP_ROUTES', 'false')).toLowerCase() !== 'true') throw statusError(404, 'Rota não encontrada na Surveyor Appwrite Function.');
    const secret = headerValue(request, 'x-bootstrap-secret') || headerValue(request, 'X-Bootstrap-Secret');
    if (!env('BOOTSTRAP_SECRET') || !safeSecretEqual(secret, env('BOOTSTRAP_SECRET'))) throw statusError(403, 'Bootstrap secret inválido.');
    const input = await bodyJson(request);
    const repaired = await ensureSurveyorProfile({
      email: input.email,
      name: input.name || 'Kaua',
      role: input.role || 'user',
      plan: input.plan || 'basic_annual'
    });
    return send(response, request, 200, { ok: true, action: repaired.action, user: publicUser(repaired.profile, repaired.user) });
  }

  if (path === '/api/debug/users-profile' && httpMethod === 'GET') {
    if (String(env('ENABLE_DEBUG_ROUTES', 'false')).toLowerCase() !== 'true') throw statusError(404, 'Rota não encontrada na Surveyor Appwrite Function.');
    const secret = headerValue(request, 'x-bootstrap-secret') || headerValue(request, 'X-Bootstrap-Secret');
    if (!env('BOOTSTRAP_SECRET') || !safeSecretEqual(secret, env('BOOTSTRAP_SECRET'))) throw statusError(403, 'Bootstrap secret inválido.');
    const profiles = await listProfilesFallback(50);
    return send(response, request, 200, {
      ok: true,
      collection: collectionId('users_profile'),
      count: profiles.length,
      profiles: profiles.map((row) => ({
        id: row.$id,
        userId: row.userId || null,
        email: row.email || null,
        role: row.role || null,
        keys: Object.keys(row || {}).filter((key) => !String(key).startsWith('$')).sort()
      }))
    });
  }


  if (path === '/api/auth/password-reset/request' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request);
    const email = normalizeEmail(input.email);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw statusError(400, 'Informe um e-mail válido.');
    await persistentRateLimitCheck('password-reset-request', [requestIp(request) ? `ip:${requestIp(request)}` : '', `email:${email}`], { limit: 5, windowMs: 15 * 60 * 1000, failOpen: false });
    await persistentRateLimitRecord('password-reset-request', [requestIp(request) ? `ip:${requestIp(request)}` : '', `email:${email}`], { windowMs: 15 * 60 * 1000, failOpen: false });
    const appwriteUser = await getAppwriteUserByEmail(email).catch(() => null);
    const profile = appwriteUser
      ? await findProfileForLogin(appwriteUser.$id || appwriteUser.id, email).catch(() => null)
      : await findProfileByEmail(email).catch(() => null);
    if (!appwriteUser || !profile) {
      await appendSecurityEvent({ type: 'login', action: 'password_reset_unknown_email', email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'failed', message: 'Recuperação solicitada para e-mail sem conta.' }).catch(() => null);
      const fakeUserId = base64url(crypto.createHmac('sha256', jwtSecret()).update(`unknown:${email}`).digest()).slice(0, 36);
      const fakeCode = generateVerificationCode();
      const resetToken = signJwt({ type: 'password-reset', sub: fakeUserId, email, codeHash: verificationCodeHash({ code: fakeCode, userId: fakeUserId, email }), decoy: true }, 10 * 60);
      const resetDelivery = transientAuthDelivery(request, resetToken, {
        cookieName: PASSWORD_RESET_COOKIE_NAME, cookieFlag: 'resetCookie', payloadKey: 'resetToken', path: '/api/auth/password-reset', maxAge: 600
      });
      return send(response, request, 200, { ok: true, ...resetDelivery.payload, maskedEmail: maskEmail(email), expiresIn: 600, message: `Se existir uma conta para ${maskEmail(email)}, um código será enviado.` }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', ...resetDelivery.headers });
    }
    const userId = appwriteUser.$id || appwriteUser.id;
    const code = generateVerificationCode();
    const resetToken = signJwt({
      type: 'password-reset',
      sub: userId,
      email,
      codeHash: verificationCodeHash({ code, userId, email })
    }, 10 * 60);
    await sendPasswordResetEmail({ email, name: profile.name || appwriteUser.name || email, code });
    await appendSecurityEvent({ type: 'login', action: 'password_reset_code_sent', actorUserId: userId, actorEmail: email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', message: 'Código de recuperação de senha enviado.' }).catch(() => null);
    const resetDelivery = transientAuthDelivery(request, resetToken, {
      cookieName: PASSWORD_RESET_COOKIE_NAME, cookieFlag: 'resetCookie', payloadKey: 'resetToken', path: '/api/auth/password-reset', maxAge: 600
    });
    return send(response, request, 200, { ok: true, ...resetDelivery.payload, maskedEmail: maskEmail(email), expiresIn: 600, message: `Enviamos um código para ${maskEmail(email)}.` }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', ...resetDelivery.headers });
  }

  if (path === '/api/auth/password-reset/verify' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request);
    const email = normalizeEmail(input.email);
    const code = String(input.code || '').replace(/\D/g, '').slice(0, 6);
    const resetToken = transientAuthTokenFromRequest(request, input, PASSWORD_RESET_COOKIE_NAME, ['resetToken', 'token']);
    if (!email || code.length !== 6 || !resetToken) throw statusError(400, 'Informe o código de 6 dígitos.');
    await persistentRateLimitCheck('password-reset-verify', [requestIp(request) ? `ip:${requestIp(request)}` : '', email ? `email:${email}` : ''], { limit: 8, windowMs: 15 * 60 * 1000, failOpen: false });
    await persistentRateLimitRecord('password-reset-verify', [requestIp(request) ? `ip:${requestIp(request)}` : '', email ? `email:${email}` : ''], { windowMs: 15 * 60 * 1000 });
    let payload;
    try {
      payload = verifyJwt(resetToken);
    } catch (error) {
      throw statusError(401, /expirada/i.test(String(error?.message || '')) ? 'O código expirou. Solicite um novo código.' : 'Código inválido ou expirado.', { code: 'RESET_CODE_EXPIRED' });
    }
    if (payload.type !== 'password-reset' || normalizeEmail(payload.email) !== email) {
      throw statusError(401, 'Código inválido ou expirado.', { code: 'RESET_CODE_INVALID' });
    }
    if (payload.codeHash !== verificationCodeHash({ code, userId: payload.sub, email })) {
      await appendSecurityEvent({ type: 'login', action: 'password_reset_code_invalid', actorUserId: payload.sub, actorEmail: email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'failed', message: 'Código incorreto informado na recuperação de senha.' }).catch(() => null);
      throw statusError(401, 'Código incorreto.', { code: 'RESET_CODE_INCORRECT' });
    }
    const resetAuthorization = signJwt({
      type: 'password-reset-authorized',
      sub: payload.sub,
      email,
      challengeJti: payload.jti
    }, 10 * 60);
    await appendSecurityEvent({ type: 'login', action: 'password_reset_code_verified', actorUserId: payload.sub, actorEmail: email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', message: 'Código de recuperação confirmado.' }).catch(() => null);
    const resetAuthDelivery = transientAuthDelivery(request, resetAuthorization, {
      cookieName: PASSWORD_RESET_AUTH_COOKIE_NAME, cookieFlag: 'resetAuthorizationCookie', payloadKey: 'resetAuthorization', path: '/api/auth/password-reset', maxAge: 600
    });
    return send(response, request, 200, { ok: true, ...resetAuthDelivery.payload, expiresIn: 600, message: 'Código confirmado. Agora crie uma nova senha.' }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', ...resetAuthDelivery.headers });
  }

  if (path === '/api/auth/password-reset/confirm' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request);
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const resetAuthorization = transientAuthTokenFromRequest(request, input, PASSWORD_RESET_AUTH_COOKIE_NAME, ['resetAuthorization', 'authorizationToken']);
    if (!email || !resetAuthorization) throw statusError(400, 'Confirme primeiro o código recebido por e-mail.');
    assertStrongPassword(password, 'A nova senha');
    await persistentRateLimitCheck('password-reset-confirm', [requestIp(request) ? `ip:${requestIp(request)}` : '', email ? `email:${email}` : ''], { limit: 6, windowMs: 15 * 60 * 1000, failOpen: false });
    await persistentRateLimitRecord('password-reset-confirm', [requestIp(request) ? `ip:${requestIp(request)}` : '', email ? `email:${email}` : ''], { windowMs: 15 * 60 * 1000 });
    let payload;
    try {
      payload = verifyJwtType(resetAuthorization, 'password-reset-authorized', 'A confirmação do código expirou. Solicite um novo código.');
    } catch (error) {
      throw statusError(401, /expir/i.test(String(error?.message || '')) ? 'A confirmação do código expirou. Solicite um novo código.' : (error?.message || 'Confirmação inválida.'), { code: 'RESET_AUTHORIZATION_INVALID' });
    }
    if (normalizeEmail(payload.email) !== email) throw statusError(401, 'Confirmação inválida.', { code: 'RESET_AUTHORIZATION_INVALID' });
    const appwriteUser = await getAppwriteUserById(payload.sub).catch(() => null);
    const profile = await findProfileForLogin(payload.sub, email).catch(() => null);
    if (!appwriteUser || !profile) throw statusError(404, 'Conta não encontrada.');
    const previousResetJti = String(userPrefs(appwriteUser)?.surveyor?.lastPasswordResetAuthorizationJti || '');
    if (previousResetJti && previousResetJti === payload.jti) throw statusError(409, 'Este código já foi utilizado. Solicite um novo código.', { code: 'RESET_AUTHORIZATION_USED' });
    await updateAppwriteUserPassword(payload.sub, password);
    const passwordResetCompletedAt = new Date().toISOString();
    await updateAppwriteUserSurveyorPrefs(payload.sub, {
      lastPasswordResetAuthorizationJti: payload.jti,
      passwordResetCompletedAt,
      remoteLogoutAt: passwordResetCompletedAt,
      sessionVersion: appwriteId()
    }).catch(() => null);
    await appendSecurityEvent({ type: 'login', action: 'password_reset_completed', actorUserId: payload.sub, actorEmail: email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', message: 'Senha redefinida pelo usuário após confirmação do código.' }).catch(() => null);
    const resetCookieClear = isOfficialWebOrigin(String(headerValue(request, 'origin') || ''))
      ? { 'Set-Cookie': secureAuthCookieHeader(PASSWORD_RESET_AUTH_COOKIE_NAME, '', { clear: true, path: '/api/auth/password-reset' }) }
      : {};
    return send(response, request, 200, { ok: true, message: 'Senha alterada com sucesso. Entre usando a nova senha.' }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', ...resetCookieClear });
  }

  if (path === '/api/auth/first-access/password' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request);
    const firstAccessToken = transientAuthTokenFromRequest(request, input, FIRST_ACCESS_COOKIE_NAME, ['firstAccessToken', 'token']);
    const password = String(input.password || '');
    const confirmation = String(input.passwordConfirmation || input.confirmPassword || input.confirmation || '');
    if (!firstAccessToken) throw statusError(400, 'A autorização do primeiro acesso não foi encontrada. Solicite um novo link de primeiro acesso.');
    assertStrongPassword(password, 'A nova senha');
    if (confirmation && password !== confirmation) throw statusError(400, 'As senhas informadas não são iguais.');

    let payload;
    try {
      payload = verifyJwtType(firstAccessToken, 'first-access-password', 'A autorização do primeiro acesso expirou. Solicite um novo link de primeiro acesso.');
    } catch (error) {
      throw statusError(401, error?.message || 'Autorização de primeiro acesso inválida.');
    }

    const appwriteUser = await getAppwriteUserById(payload.sub).catch(() => null);
    const profile = await findProfileForLogin(payload.sub, payload.email).catch(() => null);
    if (!appwriteUser || !profile) throw statusError(404, 'Conta não encontrada.');
    if (!Boolean(userPrefs(appwriteUser)?.surveyor?.mustChangePassword)) {
      throw statusError(409, 'A senha inicial desta conta já foi alterada. Entre normalmente.');
    }

    await updateAppwriteUserPassword(payload.sub, password);
    const firstAccessCompletedAt = new Date().toISOString();
    await updateAppwriteUserSurveyorPrefs(payload.sub, {
      mustChangePassword: false,
      firstAccessCompletedAt,
      firstAccessAuthorizationJti: payload.jti,
      remoteLogoutAt: firstAccessCompletedAt,
      sessionVersion: appwriteId()
    });
    await markUserEmailVerified({ userId: payload.sub, profile, appwriteUser }).catch(() => null);
    await appendSecurityEvent({
      type: 'login',
      action: 'payment_account_first_access_completed',
      actorUserId: payload.sub,
      actorEmail: payload.email,
      ip: requestIp(request),
      userAgent: requestUserAgent(request),
      status: 'ok',
      message: 'Senha definitiva criada pelo próprio usuário no primeiro acesso da conta contratada.'
    }).catch(() => null);
    const firstAccessCookieClear = isOfficialWebOrigin(String(headerValue(request, 'origin') || ''))
      ? { 'Set-Cookie': secureAuthCookieHeader(FIRST_ACCESS_COOKIE_NAME, '', { clear: true, path: '/api/auth/first-access' }) }
      : {};
    return send(response, request, 200, {
      ok: true,
      email: normalizeEmail(payload.email),
      message: 'Senha criada com sucesso. Agora entre novamente usando sua nova senha.'
    }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', ...firstAccessCookieClear });
  }

  if (path === '/api/auth/login' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request);
    const email = normalizeEmail(input.email);
    await assertLoginAccountUnlocked(email);
    await assertLoginRateLimit(request, email);
    let session;
    try {
      session = await createEmailSession({ email, password: input.password });
    } catch (error) {
      if (/blocked|disabled|suspended/i.test(errorText(error))) {
        await appendSecurityEvent({ type: 'login', action: 'login_blocked_account', email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'failed', message: 'Tentativa de login em conta bloqueada.' }).catch(() => null);
        throw statusError(403, 'Este usuário está bloqueado. Procure o administrador.', { code: 'ACCOUNT_BLOCKED' });
      }
      if (isInvalidLoginCredentialError(error)) {
        const [lockState] = await Promise.all([
          recordLoginAccountFailure(email).catch(() => null),
          recordLoginRateLimitFailure(request, email).catch(() => null)
        ]);
        const failedAttempts = Math.max(1, Number(lockState?.failedAttempts || 1));
        const remainingAttempts = Math.max(0, Number(lockState?.remainingAttempts ?? (LOGIN_ACCOUNT_LOCK_ATTEMPTS - failedAttempts)));
        await appendSecurityEvent({
          type: 'login', action: lockState?.locked ? 'login_locked' : 'login_failed', email,
          ip: requestIp(request), userAgent: requestUserAgent(request), status: 'failed',
          message: lockState?.locked ? 'Conta bloqueada por 5 horas após 3 tentativas de senha incorreta.' : `Credenciais inválidas. Restam ${remainingAttempts} tentativa(s).`,
          metadata: { failedAttempts, remainingAttempts, lockedUntil: lockState?.lockedUntil || null }
        }).catch(() => null);
        if (lockState?.locked) {
          throw statusError(429, 'Suas tentativas se esgotaram. Por segurança, o login foi bloqueado por 5 horas. Tente novamente depois desse período ou solicite o desbloqueio ao administrador.', {
            code: 'ACCOUNT_TEMPORARILY_LOCKED', ...lockState, failedAttempts, remainingAttempts: 0
          });
        }
        const attemptWord = remainingAttempts === 1 ? 'tentativa restante' : 'tentativas restantes';
        throw statusError(401, `Senha incorreta. Você só tem ${remainingAttempts} ${attemptWord}.`, {
          code: 'INVALID_CREDENTIALS', failedAttempts, remainingAttempts
        });
      } else {
        await appendSecurityEvent({ type: 'login', action: 'login_upstream_error', email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'error', message: 'Falha de infraestrutura durante autenticação; tentativa não contabilizada para bloqueio.' }).catch(() => null);
      }
      throw error;
    }
    const userId = session.userId || session.user?.$id;
    const [resolvedAppwriteUser, resolvedProfile] = await Promise.all([
      getAppwriteUserById(userId).catch(() => null),
      findProfileForLogin(userId, email).catch(() => null)
    ]);
    const appwriteUser = resolvedAppwriteUser || session.user || { $id: userId, email };
    let profile = resolvedProfile;
    if (!profile && String(env('AUTO_REPAIR_PROFILE_ON_LOGIN', '')).toLowerCase() === 'true') {
      const repaired = await ensureSurveyorProfile({ email, name: email, role: 'user', plan: 'basic_annual' }).catch(() => null);
      profile = repaired?.profile || null;
    }
    if (!profile) throw statusError(403, 'Usuário sem perfil no Surveyor. Rode /api/setup/repair-profile com o BOOTSTRAP_SECRET para recriar o perfil.');
    const identity = await resolveAuthenticatedIdentity(profile, { ...appwriteUser, $id: userId, email, name: profile.name || appwriteUser.name });
    profile = identity.profile || profile;
    const user = identity.user;
    // R26: a senha temporária criada pelo Admin é uma credencial válida de login.
    // Não interrompa a sessão com uma tela obrigatória de primeiro acesso.
    // O sinalizador mustChangePassword permanece no usuário e o frontend exibe
    // uma faixa fixa de segurança até que ele escolha uma senha própria.
    if (loginEmailVerificationEnabled() && !user.emailVerified) {
      const code = generateVerificationCode();
      const verificationToken = signJwt({
        type: 'login-email-verification',
        sub: user.id,
        email: user.email,
        codeHash: verificationCodeHash({ code, userId: user.id, email: user.email })
      }, 10 * 60);
      await sendLoginVerificationEmail({ email: user.email, name: user.name, code });
      const verificationDelivery = transientAuthDelivery(request, verificationToken, {
        cookieName: LOGIN_VERIFY_COOKIE_NAME, cookieFlag: 'verificationCookie', payloadKey: 'verificationToken', path: '/api/auth/verify-login-code', maxAge: 600
      });
      return send(response, request, 202, {
        ok: false,
        requiresEmailVerification: true,
        ...verificationDelivery.payload,
        maskedEmail: maskEmail(user.email),
        message: `Enviamos um código de confirmação para ${maskEmail(user.email)}.`
      }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', ...verificationDelivery.headers });
    }
    const sessionVersion = await ensureUserSessionVersion(user.id, appwriteUser || {});
    const accessSession = issueAccessToken(identity, user, sessionVersion);
    const accessToken = accessSession.token;
    const refreshToken = await issueRefreshSession({ userId: user.id, email: user.email, sessionVersion, appwriteUser });
    const refreshDelivery = refreshTokenResponse(request, refreshToken);
    await clearLoginRateLimit(request, user.email);
    await clearLoginAccountLock(user.email).catch(() => null);
    const loginAt = new Date().toISOString();
    await updateAppwriteUserSurveyorPrefs(user.id, { presenceLastSeenAt: loginAt, lastLoginAt: loginAt }).catch(() => null);
    await appendSecurityEvent({ type: 'login', action: 'login_success', actorUserId: user.id, actorEmail: user.email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok' });
    return send(response, request, 200, { ok: true, user, accessToken, token: accessToken, ...refreshDelivery.payload, tokenType: 'Bearer', expiresIn: accessSession.expiresIn }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', ...refreshDelivery.headers });
  }

  if (path === '/api/auth/verify-login-code' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request);
    const email = normalizeEmail(input.email);
    const code = String(input.code || '').replace(/\D/g, '').slice(0, 6);
    const token = transientAuthTokenFromRequest(request, input, LOGIN_VERIFY_COOKIE_NAME, ['verificationToken', 'token']);
    if (!email || code.length !== 6 || !token) throw statusError(400, 'Informe o código recebido por e-mail.');
    const payload = verifyJwt(token);
    if (payload.type !== 'login-email-verification' || normalizeEmail(payload.email) !== email) throw statusError(401, 'Código inválido ou expirado.');
    if (payload.codeHash !== verificationCodeHash({ code, userId: payload.sub, email })) throw statusError(401, 'Código inválido ou expirado.');
    const profile = await findProfileForLogin(payload.sub, email).catch(() => null);
    if (!profile) throw statusError(403, 'Usuário sem perfil no Surveyor.');
    const appwriteUser = await getAppwriteUserById(payload.sub).catch(() => null) || { $id: payload.sub, email };
    const previousVerificationJti = String(userPrefs(appwriteUser)?.surveyor?.lastLoginVerificationJti || '');
    if (previousVerificationJti && previousVerificationJti === String(payload.jti || '')) {
      throw statusError(409, 'Este código de confirmação já foi utilizado. Entre novamente para receber um novo código.', { code: 'LOGIN_VERIFICATION_ALREADY_USED' });
    }
    let verifiedProfile = await markUserEmailVerified({ userId: payload.sub, profile, appwriteUser });
    await updateAppwriteUserSurveyorPrefs(payload.sub, { lastLoginVerificationJti: String(payload.jti || ''), loginVerificationCompletedAt: new Date().toISOString() }).catch(() => null);
    const identity = await resolveAuthenticatedIdentity(verifiedProfile, { ...appwriteUser, emailVerification: true });
    verifiedProfile = identity.profile || verifiedProfile;
    const user = identity.user;
    const sessionVersion = await ensureUserSessionVersion(user.id, appwriteUser || {});
    const accessSession = issueAccessToken(identity, user, sessionVersion);
    const accessToken = accessSession.token;
    const refreshToken = await issueRefreshSession({ userId: user.id, email: user.email, sessionVersion, appwriteUser });
    const refreshDelivery = refreshTokenResponse(request, refreshToken);
    const loginAt = new Date().toISOString();
    await updateAppwriteUserSurveyorPrefs(user.id, { presenceLastSeenAt: loginAt, lastLoginAt: loginAt }).catch(() => null);
    await appendSecurityEvent({ type: 'login', action: 'login_success', actorUserId: user.id, actorEmail: user.email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok' });
    return send(response, request, 200, { ok: true, user, accessToken, token: accessToken, ...refreshDelivery.payload, tokenType: 'Bearer', expiresIn: accessSession.expiresIn }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', ...refreshDelivery.headers });
  }

  if (path === '/api/auth/refresh' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request).catch(() => ({}));
    const suppliedRefreshToken = refreshTokenFromRequest(request, input);
    const payload = verifyJwtType(suppliedRefreshToken, 'refresh', 'Refresh token inválido.');
    if (!payload.sub || !payload.email) throw statusError(401, 'Refresh token incompleto.');
    const profile = await findProfileForLogin(payload.sub, payload.email).catch(() => null);
    if (!profile) throw statusError(401, 'Sessão inválida.');
    const appwriteUser = await getAppwriteUserById(payload.sub).catch(() => null);
    assertTokenNotRemotelyRevoked(payload, appwriteUser || {});
    const identity = await resolveAuthenticatedIdentity(profile, appwriteUser || {});
    const user = identity.user;
    const sessionVersion = await ensureUserSessionVersion(user.id, appwriteUser || {});
    const accessSession = issueAccessToken(identity, user, sessionVersion);
    const accessToken = accessSession.token;
    const rotatedRefreshToken = await rotateRefreshSession({ payload, appwriteUser });
    const refreshDelivery = refreshTokenResponse(request, rotatedRefreshToken);
    await appendSecurityEvent({ type: 'login', action: 'refresh_rotated', actorUserId: user.id, actorEmail: user.email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok' }).catch(() => null);
    return send(response, request, 200, { ok: true, user, accessToken, token: accessToken, ...refreshDelivery.payload, tokenType: 'Bearer', expiresIn: accessSession.expiresIn }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', ...refreshDelivery.headers });
  }

  if (path === '/api/auth/logout' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request).catch(() => ({}));
    let logoutUserId = '';
    let logoutEmail = '';
    const accessToken = authTokenFromRequest(request);
    if (accessToken) {
      try {
        const accessPayload = verifyJwtType(accessToken, 'access', 'Token de acesso inválido.');
        logoutUserId = accessPayload.sub || '';
        logoutEmail = accessPayload.email || '';
      } catch (_) {}
    }
    const logoutRefreshToken = refreshTokenFromRequest(request, input);
    if ((!logoutUserId || !logoutEmail) && logoutRefreshToken) {
      try {
        const refreshPayload = verifyJwtType(logoutRefreshToken, 'refresh', 'Refresh token inválido.');
        logoutUserId = logoutUserId || refreshPayload.sub || '';
        logoutEmail = logoutEmail || refreshPayload.email || '';
      } catch (_) {}
    }
    if (logoutUserId) {
      const logoutAt = new Date().toISOString();
      await updateAppwriteUserSurveyorPrefs(logoutUserId, {
        remoteLogoutAt: logoutAt,
        lastLogoutAt: logoutAt,
        presenceLastSeenAt: null,
        authSessions: [],
        sessionVersion: appwriteId()
      }).catch((error) => console.warn('[security] não foi possível revogar a sessão no logout:', error?.message || error));
    }
    await appendSecurityEvent({
      type: 'login',
      action: 'logout',
      actorUserId: logoutUserId,
      actorEmail: logoutEmail,
      ip: requestIp(request),
      userAgent: requestUserAgent(request),
      status: 'ok',
      message: 'Usuário saiu do sistema.'
    });
    return send(response, request, 204, null, { 'Set-Cookie': refreshCookieHeader('', { clear: true }), 'Cache-Control': 'no-store' });
  }

  if (path === '/api/integrations/google-drive/callback' && httpMethod === 'GET') {
    const code = String(queryValue(request, 'code') || '').trim();
    const errorCode = String(queryValue(request, 'error') || '').trim();
    const state = String(queryValue(request, 'state') || '').trim();
    if (errorCode) return sendText(response, request, 400, `<html><body style="font-family:Arial;padding:28px"><h2>Google Drive não conectado</h2><p>${errorCode}</p><p>Você pode fechar esta janela e tentar novamente.</p></body></html>`, 'text/html; charset=utf-8');
    if (!code || !state) throw statusError(400, 'Callback do Google Drive sem código ou state.');
    const payload = verifyJwt(state);
    if (payload.type !== 'google-drive-connect') throw statusError(401, 'State inválido para conexão Google Drive.');
    const token = await googleDriveTokenFromCode(code);
    if (!token.refresh_token) throw statusError(400, 'O Google não retornou refresh_token. Remova a autorização antiga do app no Google e conecte novamente marcando consentimento.');
    const accessToken = token.access_token;
    const root = await ensureDriveFolder({ name: googleDriveConfig().rootFolderName, accessToken });
    await saveGoogleDriveConnection({
      connected: true,
      connectedBy: String(payload.sub || ''),
      connectedEmail: String(payload.email || ''),
      scope: String(token.scope || googleDriveConfig().scope),
      rootFolderId: root.id,
      rootFolderName: googleDriveConfig().rootFolderName,
      refreshTokenEncrypted: encryptSecret(token.refresh_token),
      connectedAt: new Date().toISOString()
    });
    return sendText(response, request, 200, `<html><body style="font-family:Arial;padding:28px;color:#0f172a"><h2>Google Drive conectado ao Surveyor</h2><p>A pasta <strong>${googleDriveConfig().rootFolderName}</strong> foi preparada com sucesso.</p><p>Você pode fechar esta janela e voltar para a Minha Nuvem.</p><script>setTimeout(()=>{try{window.close()}catch(e){}},2500)</script></body></html>`, 'text/html; charset=utf-8');
  }

  // Upload público assinado para ZIP pequeno. Evita preflight CORS com Authorization
  // em navegadores/GitHub Pages: a chamada autenticada apenas prepara um token
  // temporário; o arquivo vai em POST text/plain sem cabeçalhos customizados.
  const publicLayerSourceUploadMatch = path.match(/^\/api\/public\/layer-source-upload\/([^/]+)$/);
  if (publicLayerSourceUploadMatch && httpMethod === 'POST') {
    const token = decodeURIComponent(publicLayerSourceUploadMatch[1]);
    let payload;
    try { payload = verifyJwt(token); } catch { throw statusError(401, 'Token público de upload inválido ou expirado.'); }
    if (payload.type !== 'layer-source-upload' || !payload.layerId || !payload.uploadId) throw statusError(401, 'Token público de upload inválido.');
    const layerId = String(payload.layerId);
    const current = await getRow('layers', layerId).catch(() => null);
    if (!current) throw statusError(404, 'Camada não encontrada para o upload.');
    const { upload } = layerUploadState(current);
    if (!upload || upload.id !== payload.uploadId || upload.publicUpload !== true) throw statusError(409, 'Upload público não está ativo para esta camada.');
    if (!['awaiting_public_upload', 'prepared'].includes(String(upload.status || ''))) throw statusError(409, 'Upload público já foi usado, cancelado ou expirou.');

    const rawText = String(request.bodyText || request.body || '');
    const input = rawText.trim().startsWith('{') ? safeJson(rawText, {}) : { contentBase64: rawText };
    const totalBytes = Number(input.totalBytes || payload.totalBytes || upload.totalBytes || 0);
    const originalFileName = String(input.originalFileName || payload.originalFileName || upload.originalFileName || 'camada.zip').slice(0, 240);
    const contentBase64 = String(input.contentBase64 || input.base64 || rawText || '').replace(/^data:.*?;base64,/, '').trim();
    if (!totalBytes) throw statusError(400, 'Tamanho do ZIP não informado.');
    if (!contentBase64) throw statusError(400, 'Conteúdo do ZIP não informado.');
    if (totalBytes > Number(env('LAYER_SOURCE_UPLOAD_DIRECT_MAX_BYTES', String(16 * 1024 * 1024)))) throw statusError(413, 'Use envio em blocos para ZIP acima do limite direto.');
    let buffer;
    try { buffer = Buffer.from(contentBase64, 'base64'); } catch { throw statusError(400, 'Base64 do ZIP inválido.'); }
    if (!buffer.length) throw statusError(400, 'ZIP vazio recebido pela API.');
    if (Math.abs(buffer.length - totalBytes) > 8) throw statusError(400, `Tamanho recebido (${buffer.length}) diferente do informado (${totalBytes}).`);

    const now = new Date().toISOString();
    const sourceFile = await createFile(bucketId('project_files'), `layer-source-${layerId}-${payload.uploadId}.zip`, buffer, 'application/zip');
    const sourceFileId = sourceFile.$id || sourceFile.id;
    const queued = {
      ...upload,
      status: 'queued',
      progress: 34,
      message: 'ZIP recebido por upload público assinado. Enviando para a GeoServices processar...',
      originalFileName,
      totalBytes,
      chunkCount: 1,
      direct: true,
      publicUpload: true,
      sourceFileId,
      sourceBucketId: bucketId('project_files'),
      uploadedAt: now,
      queuedAt: now,
      updatedAt: now
    };
    delete queued.publicUploadToken;
    const row = await patchLayerMetadata(layerId, current, { sourceUpload: queued }, { status: 'processing' });
    // Não processa dentro da mesma requisição pública de upload.
    // Antes o navegador ficava em 0% porque a rota aguardava Storage + GeoServices
    // e podia estourar timeout/CORS do Appwrite. Agora o upload responde rápido;
    // a tela inicia o processamento pela rota autenticada /source-upload/process.
    return send(response, request, 200, { ok: true, upload: queued, layer: mapLayer(row), next: 'process' });
  }

  const publicProjectMatch = path.match(/^\/api\/public\/projects\/([^/]+)$/);
  if (publicProjectMatch && httpMethod === 'GET') {
    const token = decodeURIComponent(publicProjectMatch[1]);
    let payload;
    try { payload = verifyJwt(token); } catch { throw statusError(401, 'Link público inválido ou expirado.'); }
    if (payload.type !== 'project-share' || !payload.projectId || !payload.ownerUserId) throw statusError(401, 'Link público inválido.');
    const row = await getRow('projects', payload.projectId).catch(() => null);
    if (!row || row.status === 'deleted' || String(row.userId || '') !== String(payload.ownerUserId || '')) throw statusError(404, 'Projeto público não encontrado.');
    const projectPayload = await readProjectPayload(row);
    const { shares } = projectPayloadShares(projectPayload);
    if (!payload.shareId) throw statusError(401, 'Link público inválido. Identificador de compartilhamento ausente.');
    const share = shares.find((item) => String(item.id || '') === String(payload.shareId));
    if (!share) throw statusError(403, 'Este compartilhamento foi revogado ou não existe mais.', { code: 'SHARE_NOT_FOUND_OR_REVOKED' });
    return sendPublicProjectShare(response, request, row, projectPayload, share);
  }

  const publicShortMatch = path.match(/^\/api\/public\/short\/([^/]+)$/);
  if (publicShortMatch && httpMethod === 'GET') {
    const code = normalizePublicShortCode(decodeURIComponent(publicShortMatch[1] || ''));
    if (code.length !== PUBLIC_SHORT_LENGTH) throw statusError(400, 'Código público curto inválido.');
    const row = await findProjectRowByShortCode(code);
    if (!row) throw statusError(404, 'Link público curto não encontrado.');
    const projectPayload = await readProjectPayload(row);
    const { metadata, shares } = projectPayloadShares(projectPayload);
    const active = shares
      .filter((item) => !item.revokedAt && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
    if (active) return sendPublicProjectShare(response, request, row, projectPayload, active);

    // Link curto documental: fonte pública mínima, ativada explicitamente pelo proprietário.
    // Não depende de secureShares e, por isso, não volta para uma URL-snapshot gigante
    // quando o mecanismo avançado de compartilhamento estiver indisponível.
    if (!metadata.publicShortEnabled) {
      throw statusError(403, 'Este link público curto não está ativo.', { code: 'PUBLIC_SHORT_INACTIVE' });
    }
    const syntheticShare = {
      id: `public-short:${row.$id || row.id}`,
      createdAt: metadata.publicShortCreatedAt || row.createdAt || new Date().toISOString(),
      updatedAt: metadata.publicShortUpdatedAt || metadata.publicShortCreatedAt || row.updatedAt || new Date().toISOString(),
      expiresAt: null,
      permissionMode: 'readonly',
      passwordProtected: false,
      passwordSalt: '',
      passwordHash: '',
      maxAccessCount: 0,
      accessCount: 0,
      lastAccessAt: null,
      revokedAt: null
    };
    return sendPublicProjectShare(response, request, row, projectPayload, syntheticShare);
  }

  // WMS/WFS são carregados pelo navegador como imagem/fetch de mapa.
  // Tiles Leaflet não conseguem enviar Authorization em cada requisição,
  // então o proxy geográfico precisa ser público, mas controlado por allowlist
  // de domínios oficiais em assertAllowedProxyUrl().
  if (path.startsWith('/api/geoservices/')
    || /^\/(?:api\/(?:geoservices\/)?)?(?:wms|wfs|wms-info|info)(?:$|-url\/|\/)/i.test(path)) {
    return proxyGeoService(request, response);
  }


  if (path.startsWith('/api/integrations/conecta-plus')) {
    requireConectaPlusAccess(request);

    if (path === '/api/integrations/conecta-plus/health' && httpMethod === 'GET') {
      return send(response, request, 200, { ok: true, integration: 'Conecta+', version: APP_VERSION, capabilities: ['users:list', 'users:create', 'users:update', 'plans:list', 'plans:upsert', 'users:expiring', 'notifications:mark-sent', 'support:create'], reminderDays: [7, 1] });
    }

    if (path === '/api/integrations/conecta-plus/users' && httpMethod === 'GET') {
      const query = String(queryValue(request, 'query') || '').trim().toLowerCase();
      const users = (await listAdminUsers())
        .filter((user) => !query || `${user.name} ${user.email} ${user.whatsapp || user.phone || ''}`.toLowerCase().includes(query))
        .slice(0, 200)
        .map((user) => ({ id: user.id, name: user.name, email: user.email, whatsapp: user.whatsapp, whatsappDisplay: user.whatsappDisplay, whatsappOptIn: user.whatsappOptIn, whatsappReminderDays: user.whatsappReminderDays, role: user.role, planSlug: user.planSlug, planName: user.planName, expiresAt: user.expiresAt, status: user.status }));
      return send(response, request, 200, { ok: true, users, total: users.length });
    }

    if (path === '/api/integrations/conecta-plus/users/expiring' && httpMethod === 'GET') {
      const requestedDays = normalizeReminderDays(queryValue(request, 'days') || [7, 1]);
      const listedUsers = await listAdminUsers();
      const candidates = listedUsers.filter((user) => requestedDays.includes(loginExpirationDaysLeft(user.expiresAt)) && Boolean(user.whatsapp || user.phone));
      const detailedUsers = await Promise.all(candidates.map(async (user) => {
        const profile = await findProfileForLogin(user.id, user.email).catch(() => null) || await findProfileByUserId(user.id).catch(() => null) || user;
        const fullAppwriteUser = await getAppwriteUserById(user.id).catch(() => null) || user;
        return adminUserFromProfile(profile, fullAppwriteUser);
      }));
      const due = detailedUsers.map((user) => ({ ...user, pendingReminderDays: conectaPlusPendingDays(user, requestedDays), daysLeft: loginExpirationDaysLeft(user.expiresAt) }))
        .filter((user) => user.pendingReminderDays.length > 0)
        .map((user) => ({ id: user.id, name: user.name, email: user.email, whatsapp: user.whatsapp, whatsappDisplay: user.whatsappDisplay, planSlug: user.planSlug, planName: user.planName, expiresAt: user.expiresAt, daysLeft: user.daysLeft, pendingReminderDays: user.pendingReminderDays }));
      return send(response, request, 200, { ok: true, checkedAt: new Date().toISOString(), reminderDays: requestedDays, users: due, total: due.length });
    }

    if (path === '/api/integrations/conecta-plus/users' && httpMethod === 'POST') {
      const input = await bodyJson(request);
      const email = normalizeEmail(input.email);
      if (!email || !input.password) throw statusError(400, 'Informe e-mail e senha.');
      assertStrongPassword(input.password, 'A senha');
      const normalizedWhatsapp = normalizeBrazilPhone(input.whatsapp || input.phone || '', { required: Boolean(input.whatsappOptIn !== false) });
      let appwriteUser = await getAppwriteUserByEmail(email).catch(() => null);
      if (!appwriteUser) appwriteUser = await createAppwriteUser({ email, password: bootstrapPassword, name: input.name || email });
      else if (input.password) await updateAppwriteUserPassword(appwriteUser.$id || appwriteUser.id, input.password);
      const userId = appwriteUser.$id || appwriteUser.id;
      await updateAppwriteUserName(userId, input.name || appwriteUser.name || email);
      if (normalizedWhatsapp) await updateAppwriteUserPhone(userId, normalizedWhatsapp);
      const existing = await findProfileForLogin(userId, email).catch(() => null);
      const requestedEmailVerified = input.emailVerified !== undefined ? Boolean(input.emailVerified) : (existing ? isEmailVerified(existing, appwriteUser) : false);
      await updateAppwriteUserEmailVerification(userId, requestedEmailVerified);
      await updateAppwriteUserStatus(userId, String(input.status || existing?.status || 'active').toLowerCase() === 'active');
      const prefsPatch = { status: String(input.status || existing?.status || 'active').toLowerCase(), expiresAt: input.expiresAt || null, phone: normalizedWhatsapp, whatsapp: normalizedWhatsapp, whatsappOptIn: input.whatsappOptIn !== false, whatsappReminderDays: normalizeReminderDays(input.whatsappReminderDays || [7, 1]) };
      await updateAppwriteUserSurveyorPrefs(userId, prefsPatch);
      const profile = await createOrUpdateAdminProfile({ ...input, email, emailVerified: requestedEmailVerified, phone: normalizedWhatsapp, whatsapp: normalizedWhatsapp, whatsappOptIn: input.whatsappOptIn !== false, whatsappReminderDays: prefsPatch.whatsappReminderDays }, appwriteUser, existing);
      const refreshed = await getAppwriteUserById(userId).catch(() => appwriteUser);
      await appendSecurityEvent({ type: 'integration', action: existing ? 'conecta_plus_user_updated' : 'conecta_plus_user_created', actorEmail: 'Conecta+', targetUserId: userId, targetEmail: email, status: 'ok', message: 'Usuário processado pela integração Conecta+.' }).catch(() => null);
      return send(response, request, existing ? 200 : 201, { ok: true, user: adminUserFromProfile(profile, refreshed), action: existing ? 'updated' : 'created' });
    }

    const conectaUserMatch = path.match(/^\/api\/integrations\/conecta-plus\/users\/([^/]+)$/);
    if (conectaUserMatch && httpMethod === 'PATCH') {
      const userId = decodeURIComponent(conectaUserMatch[1]);
      const input = await bodyJson(request);
      const existing = await findProfileForLogin(userId, '').catch(() => null) || await findProfileByUserId(userId).catch(() => null);
      if (!existing) throw statusError(404, 'Usuário não encontrado.');
      const appwriteUser = await getAppwriteUserById(userId).catch(() => ({ $id: userId, email: existing.email, name: existing.name }));
      if (input.name) await updateAppwriteUserName(userId, input.name);
      if (input.password) await updateAppwriteUserPassword(userId, input.password);
      if (input.emailVerified !== undefined) await updateAppwriteUserEmailVerification(userId, Boolean(input.emailVerified));
      if (input.status !== undefined) await updateAppwriteUserStatus(userId, String(input.status || 'active').toLowerCase() === 'active');
      const normalizedWhatsapp = Object.prototype.hasOwnProperty.call(input, 'whatsapp') || Object.prototype.hasOwnProperty.call(input, 'phone')
        ? normalizeBrazilPhone(input.whatsapp || input.phone || '')
        : userContactMeta(existing, appwriteUser).whatsapp;
      if (normalizedWhatsapp) await updateAppwriteUserPhone(userId, normalizedWhatsapp);
      const prefsPatch = { status: String(input.status || existing.status || 'active').toLowerCase(), expiresAt: Object.prototype.hasOwnProperty.call(input, 'expiresAt') ? (input.expiresAt || null) : profileExpiresAt(existing, appwriteUser), phone: normalizedWhatsapp, whatsapp: normalizedWhatsapp, whatsappOptIn: input.whatsappOptIn !== undefined ? Boolean(input.whatsappOptIn) : userContactMeta(existing, appwriteUser).whatsappOptIn, whatsappReminderDays: normalizeReminderDays(input.whatsappReminderDays || userContactMeta(existing, appwriteUser).whatsappReminderDays || [7, 1]) };
      await updateAppwriteUserSurveyorPrefs(userId, prefsPatch);
      const profile = await createOrUpdateAdminProfile({ ...existing, ...input, email: existing.email, phone: normalizedWhatsapp, whatsapp: normalizedWhatsapp, whatsappOptIn: prefsPatch.whatsappOptIn, whatsappReminderDays: prefsPatch.whatsappReminderDays }, appwriteUser, existing);
      const refreshed = await getAppwriteUserById(userId).catch(() => appwriteUser);
      await appendSecurityEvent({ type: 'integration', action: 'conecta_plus_user_updated', actorEmail: 'Conecta+', targetUserId: userId, targetEmail: existing.email, status: 'ok', message: 'Usuário atualizado pela integração Conecta+.' }).catch(() => null);
      return send(response, request, 200, { ok: true, user: adminUserFromProfile(profile, refreshed) });
    }

    if (path === '/api/integrations/conecta-plus/plans' && httpMethod === 'GET') {
      const includeInactive = queryValue(request, 'all') === '1' || queryValue(request, 'all') === 'true';
      const plans = await listPlansSafe({ includeInactive });
      return send(response, request, 200, { ok: true, plans, total: plans.length });
    }

    if (path === '/api/integrations/conecta-plus/plans' && httpMethod === 'POST') {
      const input = await bodyJson(request);
      const result = await upsertPlanBySlug(input);
      await appendSecurityEvent({ type: 'integration', action: 'conecta_plus_plan_upserted', actorEmail: 'Conecta+', status: 'ok', message: `Plano ${result.plan?.slug || input.slug || ''} processado pelo Conecta+.` }).catch(() => null);
      return send(response, request, result.action === 'created' ? 201 : 200, { ok: true, ...result });
    }

    const conectaPlanMatch = path.match(/^\/api\/integrations\/conecta-plus\/plans\/([^/]+)$/);
    if (conectaPlanMatch && httpMethod === 'PATCH') {
      const planId = decodeURIComponent(conectaPlanMatch[1]);
      const input = await bodyJson(request);
      const current = await getRow('plans', planId).catch(() => null);
      if (current?.$id || current?.id) {
        const row = await updateRow('plans', current.$id || current.id, planData(input, current));
        return send(response, request, 200, { ok: true, plan: mapPlan(row) });
      }
      const base = mapPlan(planBySlug(planId));
      const result = await upsertPlanBySlug({ ...base, ...input, slug: input.slug || base.slug || planId });
      return send(response, request, result.action === 'created' ? 201 : 200, { ok: true, ...result });
    }

    if (path === '/api/integrations/conecta-plus/support' && httpMethod === 'POST') {
      const input = await bodyJson(request);
      let user = null;
      if (input.userId) {
        const profile = await findProfileForLogin(String(input.userId), '').catch(() => null) || await findProfileByUserId(String(input.userId)).catch(() => null);
        if (profile) {
          const appwriteUser = await getAppwriteUserById(profile.userId || input.userId).catch(() => ({}));
          user = adminUserFromProfile(profile, appwriteUser || {});
        }
      }
      const name = String(input.name || user?.name || 'Usuário do Surveyor').trim().slice(0, 180);
      const email = normalizeEmail(input.email || user?.email || '');
      const details = String(input.details || input.message || '').trim().slice(0, 12000);
      const type = String(input.type || 'ajuda').trim().slice(0, 80);
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw statusError(400, 'E-mail do solicitante inválido.');
      if (details.length < 10) throw statusError(400, 'Descreva a solicitação com mais detalhes.');
      const supportBaseUrl = String(env('SUPPORT_FUNCTION_URL') || env('EMAIL_FUNCTION_URL') || '').replace(/\/+$/, '');
      if (!supportBaseUrl) throw statusError(503, 'Function de suporte não configurada. Defina SUPPORT_FUNCTION_URL ou EMAIL_FUNCTION_URL.');
      const endpoint = `${supportBaseUrl}${env('SUPPORT_REQUEST_PATH', '/api/support/request')}`;
      const supportResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          type,
          details,
          phone: user?.whatsapp || input.whatsapp || input.phone || '',
          source: 'conecta-plus',
          userId: user?.id || input.userId || '',
          plan: user?.planName || user?.planSlug || input.plan || ''
        })
      });
      const payload = await supportResponse.json().catch(async () => ({ message: await supportResponse.text().catch(() => '') }));
      if (!supportResponse.ok) throw statusError(502, payload?.error || payload?.message || 'A Function de suporte recusou a solicitação.');
      await appendSecurityEvent({ type: 'integration', action: 'conecta_plus_support_created', actorEmail: 'Conecta+', targetUserId: user?.id || input.userId || '', targetEmail: email, status: 'ok', message: 'Solicitação de suporte encaminhada pelo Conecta+.' }).catch(() => null);
      return send(response, request, 201, { ok: true, support: payload });
    }

    if (path === '/api/integrations/conecta-plus/notifications/mark-sent' && httpMethod === 'POST') {
      const input = await bodyJson(request);
      const userId = String(input.userId || '').trim();
      const daysBefore = Number(input.daysBefore);
      if (!userId || !Number.isInteger(daysBefore) || daysBefore < 1 || daysBefore > 30) throw statusError(400, 'Informe userId e daysBefore válidos.');
      const existing = await findProfileForLogin(userId, '').catch(() => null) || await findProfileByUserId(userId).catch(() => null);
      if (!existing) throw statusError(404, 'Usuário não encontrado.');
      const appwriteUser = await getAppwriteUserById(userId).catch(() => ({ $id: userId, email: existing.email, name: existing.name }));
      const contact = userContactMeta(existing, appwriteUser);
      const expiryKey = notificationExpiryKey(profileExpiresAt(existing, appwriteUser));
      const history = { ...(contact.conectaPlusNotifications || {}) };
      history[expiryKey] = { ...(history[expiryKey] || {}), [String(daysBefore)]: { sentAt: input.sentAt || new Date().toISOString(), channel: String(input.channel || 'whatsapp'), providerMessageId: String(input.providerMessageId || input.messageId || '').slice(0, 240), status: String(input.status || 'sent').slice(0, 40) } };
      await updateAppwriteUserSurveyorPrefs(userId, { conectaPlusNotifications: history });
      return send(response, request, 200, { ok: true, userId, expiryKey, daysBefore, notification: history[expiryKey][String(daysBefore)] });
    }

    throw statusError(404, 'Rota do Conecta+ não encontrada.');
  }


  function commercialPaymentMethod(raw) {
    const method = String(raw || 'gateway').trim().slice(0, 60) || 'gateway';
    const sandbox = /^(?:sandbox|test|mock)$/i.test(method);
    if (sandbox && String(env('PAYMENT_ALLOW_SANDBOX', 'false')).toLowerCase() !== 'true') {
      throw statusError(403, 'Método de pagamento de teste desativado no ambiente comercial.', { code: 'PAYMENT_SANDBOX_DISABLED' });
    }
    return method;
  }


  if (path === '/api/store/plans' && httpMethod === 'GET') {
    const plans = (await listPlansSafe({ includeInactive: false }))
      .filter((plan) => String(plan.billingCycle || '').toLowerCase() === 'anual' && !LEGACY_MONTHLY_PLAN_SLUGS.has(String(plan.slug || '').toLowerCase()))
      .map((plan) => ({ id: plan.id || plan.slug, slug: plan.slug, name: plan.name, description: plan.description || '', billingCycle: 'anual', priceCents: Number(plan.priceCents || 0), projectLimit: plan.projectLimit ?? null, userLimit: plan.userLimit ?? null, storageLimitBytes: plan.storageLimitBytes ?? null, features: plan.features || plan.permissions || [] }));
    return send(response, request, 200, { ok: true, plans });
  }

  if (path === '/api/store/orders' && httpMethod === 'POST') {
    const input = await bodyJson(request);
    const email = normalizeEmail(input.email || input.customerEmail);
    const name = String(input.name || input.customerName || '').trim().slice(0, 180);
    if (!email || !name) throw statusError(400, 'Informe nome e e-mail.');
    const plan = await commercePlan(input.planSlug || input.plan);
    const now = new Date();
    const row = await createRow('commerce_orders', {
      customerName: name, customerEmail: email, customerWhatsapp: String(input.whatsapp || '').slice(0, 40),
      planSlug: plan.slug, planName: plan.name, billingCycle: plan.billingCycle || 'anual', amountCents: Number(plan.priceCents || 0), currency: 'BRL',
      status: 'awaiting_payment', source: String(input.source || 'loja').slice(0, 40),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString()
    });
    return send(response, request, 201, { ok: true, order: publicCommerceOrder(row), checkoutUrl: `${env('PAYMENT_PORTAL_URL', 'https://pagamento.surveyorr.com.br')}/?pedido=${encodeURIComponent(row.$id || row.id)}` });
  }

  const publicOrderMatch = path.match(/^\/api\/store\/orders\/([^/]+)$/);
  if (publicOrderMatch && httpMethod === 'GET') {
    const row = await getRow('commerce_orders', decodeURIComponent(publicOrderMatch[1]));
    if (!row) throw statusError(404, 'Pedido não encontrado.');
    return send(response, request, 200, { ok: true, order: publicCommerceOrder(row) });
  }

  const paymentConfirmMatch = path.match(/^\/api\/billing\/orders\/([^/]+)\/confirm$/);
  if (paymentConfirmMatch && httpMethod === 'POST') {
    commerceInternalSecret(request);
    const id = decodeURIComponent(paymentConfirmMatch[1]);
    const order = await getRow('commerce_orders', id);
    if (!order) throw statusError(404, 'Pedido não encontrado.');
    if (order.status === 'paid' && order.provisionedUserId) return send(response, request, 200, { ok: true, alreadyProcessed: true, order: publicCommerceOrder(order), userId: order.provisionedUserId });
    const input = await bodyJson(request).catch(() => ({}));
    const paymentMethod = commercialPaymentMethod(input.paymentMethod || 'gateway');
    const paymentId = String(input.gatewayPaymentId || order.gatewayPaymentId || `order_${id}`).slice(0, 180);
    const provisioned = await provisionPaidAccount({ ...order, paymentId, paymentMethod }, request);
    const paidAt = new Date().toISOString();
    const updated = await updateRow('commerce_orders', id, { status: 'paid', paidAt, paymentMethod, gatewayPaymentId: String(input.gatewayPaymentId || '').slice(0, 180), provisionedUserId: provisioned.userId, updatedAt: paidAt });
    return send(response, request, 200, { ok: true, order: publicCommerceOrder(updated), account: { email: provisioned.email, planSlug: provisioned.planSlug, expiresAt: provisioned.expiresAt, mustChangePassword: provisioned.mustChangePassword === true } });
  }


  if (path === '/api/integrations/payments/storage' && httpMethod === 'POST') {
    commerceInternalSecret(request);
    const input = await bodyJson(request);
    const paymentId = String(input.paymentId || input.gatewayPaymentId || headerValue(request, 'idempotency-key') || '').trim().slice(0, 180);
    const productId = String(input.productId || '').trim().toLowerCase();
    const requestedUserId = String(input.userId || '').trim();
    const email = normalizeEmail(input.email || input.customerEmail || '');
    if (!paymentId || (!requestedUserId && !email)) throw statusError(400, 'Informe paymentId e a conta Surveyor.', { code: 'STORAGE_PAYMENT_PAYLOAD_INCOMPLETE' });

    const allowedProducts = {
      'storage-500mb': 500 * MB_BYTES,
      'storage-1gb': 1 * GB_BYTES,
      'storage-2gb': 2 * GB_BYTES,
      'storage-5gb': 5 * GB_BYTES,
      'storage-10gb': 10 * GB_BYTES
    };
    const targetBytes = allowedProducts[productId];
    if (!targetBytes) throw statusError(400, 'Pacote de armazenamento inválido.', { code: 'STORAGE_PRODUCT_INVALID' });

    let profile = requestedUserId ? await findProfileByUserId(requestedUserId).catch(() => null) : null;
    if (!profile && email) profile = await findProfileForLogin('', email).catch(() => null);
    if (!profile) throw statusError(404, 'Conta Surveyor não encontrada.', { code: 'STORAGE_ACCOUNT_NOT_FOUND' });
    const actualUserId = String(profile.userId || requestedUserId || '').trim();
    const appwriteUser = await getAppwriteUserById(actualUserId).catch(() => null);
    if (!appwriteUser) throw statusError(404, 'Usuário Surveyor não encontrado no Appwrite.', { code: 'STORAGE_APPWRITE_USER_NOT_FOUND' });

    const identity = await resolveAuthenticatedIdentity(profile, appwriteUser);
    const ownerUserId = String(identity.resourceOwnerUserId || identity.ownerProfile?.userId || actualUserId).trim();
    const ownerProfile = identity.ownerProfile || profile;
    const ownerAppwriteUser = identity.ownerAppwriteUser || appwriteUser;
    const planSlug = canonicalPlanSlug(ownerProfile.plan || ownerProfile.planSlug || identity.user?.planSlug || 'basic_annual');
    const rule = commercialPlanRule(planSlug);
    if (!rule) throw statusError(409, 'O plano atual não aceita expansão automática de armazenamento.', { code: 'STORAGE_PLAN_UNSUPPORTED' });
    if (targetBytes > rule.storageMaxBytes) throw statusError(409, 'Este pacote ultrapassa o limite máximo permitido pelo plano atual.', {
      code: 'STORAGE_PLAN_MAX_EXCEEDED', planSlug, maxBytes: rule.storageMaxBytes, requestedBytes: targetBytes
    });

    const { surveyor } = userPrefs(ownerAppwriteUser);
    const processed = Array.isArray(surveyor.storagePurchasePaymentIds) ? surveyor.storagePurchasePaymentIds.map(String) : [];
    if (processed.includes(paymentId)) {
      const entitlement = commercialStorageEntitlement(planBySlug(planSlug), ownerAppwriteUser);
      return send(response, request, 200, { ok: true, alreadyProcessed: true, account: { userId: ownerUserId, email: ownerProfile.email || ownerAppwriteUser.email, planSlug }, storage: entitlement, benefitLabel: `Armazenamento total de ${targetBytes >= GB_BYTES ? `${targetBytes / GB_BYTES} GB` : `${Math.round(targetBytes / MB_BYTES)} MB`}` });
    }

    const current = commercialStorageEntitlement(planBySlug(planSlug), ownerAppwriteUser);
    if (targetBytes <= Number(current.effectiveBytes || rule.storageBaseBytes || 0)) {
      throw statusError(409, 'A conta já possui essa capacidade de armazenamento ou uma capacidade maior. Selecione uma opção superior.', {
        code: 'STORAGE_NO_UPGRADE', planSlug, currentBytes: current.effectiveBytes, requestedBytes: targetBytes
      });
    }
    const effectiveTarget = targetBytes;
    await updateAppwriteUserSurveyorPrefs(ownerUserId, {
      storageEntitlementBytes: effectiveTarget,
      storagePurchasedBytes: Math.max(0, effectiveTarget - rule.storageBaseBytes),
      storagePurchasePaymentIds: [...processed, paymentId].slice(-30),
      storageLastPurchaseAt: new Date().toISOString(),
      storageLastProductId: productId
    });
    const updatedOwner = await getAppwriteUserById(ownerUserId).catch(() => ownerAppwriteUser);
    const entitlement = commercialStorageEntitlement(planBySlug(planSlug), updatedOwner || ownerAppwriteUser);
    await appendSecurityEvent({
      type: 'billing', action: 'storage_entitlement_purchased', actorUserId: ownerUserId, actorEmail: ownerProfile.email || ownerAppwriteUser.email,
      status: 'ok', message: `Armazenamento atualizado via pagamento para ${Math.round(entitlement.effectiveBytes / MB_BYTES)} MB.`,
      metadata: { paymentId, productId, targetBytes: entitlement.effectiveBytes, planSlug }
    }).catch(() => null);
    return send(response, request, 201, {
      ok: true, alreadyProcessed: false,
      account: { userId: ownerUserId, email: ownerProfile.email || ownerAppwriteUser.email, planSlug },
      storage: entitlement,
      benefitLabel: `Armazenamento total de ${entitlement.effectiveBytes >= GB_BYTES ? `${entitlement.effectiveBytes / GB_BYTES} GB` : `${Math.round(entitlement.effectiveBytes / MB_BYTES)} MB`}`
    }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' });
  }

  if (path === '/api/integrations/payments/provision' && httpMethod === 'POST') {
    const requestId = responseRequestId(request);
    let stage = 'validation';
    let paymentIdForLog = '';
    let emailForLog = '';
    let orderIdForLog = '';
    try {
      commerceInternalSecret(request);
      const input = await bodyJson(request);
      const paymentId = String(input.paymentId || input.gatewayPaymentId || headerValue(request, 'idempotency-key') || '').trim().slice(0, 180);
      const orderId = String(input.orderId || input.order?.id || '').trim().slice(0, 180) || paymentId;
      const email = normalizeEmail(input.email || input.customerEmail || input.customer?.email);
      const name = String(input.name || input.customerName || input.customer?.name || '').trim().slice(0, 180);
      const rawPhone = input.phone || input.whatsapp || input.customerWhatsapp || input.customer?.phone || input.customer?.whatsapp || '';
      const phone = normalizeBrazilPhone(rawPhone, { required: false });
      paymentIdForLog = paymentId;
      emailForLog = email;
      orderIdForLog = orderId;
      if (!paymentId || !email || !name) throw statusError(400, 'Informe paymentId, nome e e-mail para provisionar a conta.', { code: 'PAYMENT_PAYLOAD_INCOMPLETE' });

      stage = 'plan';
      const plan = await commercePlanForPayment(input.planId || input.planSlug || input.plan || input.planName);
      const paidAmountCents = Math.max(0, Number(input.paidAmountCents ?? input.finalAmountCents ?? input.amountCents ?? input.amount ?? 0) || 0);
      const strictPrice = String(env('PAYMENT_REQUIRE_FULL_PRICE', 'true')).toLowerCase() === 'true';
      if (strictPrice && paidAmountCents !== Number(plan.priceCents || 0)) {
        const explicitlyFree = paidAmountCents === 0 && (
          Number(input.couponPercent || input.discountPercent || 0) >= 100
          || Number(input.discountCents || 0) >= Number(plan.priceCents || 0)
          || input.freeCheckout === true
          || Boolean(String(input.couponCode || input.coupon || '').trim())
        );
        if (!explicitlyFree) throw statusError(409, 'O valor confirmado não corresponde ao plano informado.', {
          code: 'PAYMENT_AMOUNT_MISMATCH',
          expectedAmountCents: Number(plan.priceCents || 0),
          receivedAmountCents: paidAmountCents
        });
      }

      const provisioned = await provisionPaidAccount({
        paymentId,
        orderId,
        customerName: name,
        customerEmail: email,
        customerWhatsapp: phone,
        planSlug: plan.slug,
        billingCycle: plan.billingCycle,
        resolvedPlan: plan,
        amountCents: paidAmountCents,
        paidAmountCents,
        finalAmountCents: paidAmountCents,
        couponCode: String(input.couponCode || input.coupon || '').slice(0, 100),
        paymentMethod: commercialPaymentMethod(input.paymentMethod || input.method || 'gateway'),
        onboardingDocument: input.onboardingDocument && typeof input.onboardingDocument === 'object' ? input.onboardingDocument : null
      }, request, {
        onStage(nextStage) { stage = nextStage; }
      });

      return send(response, request, provisioned.alreadyProcessed ? 200 : 201, {
        ok: true,
        alreadyProcessed: provisioned.alreadyProcessed,
        paymentId,
        orderId,
        account: {
          userId: provisioned.userId,
          name: provisioned.name || name,
          email: provisioned.email,
          planSlug: provisioned.planSlug,
          startedAt: provisioned.startedAt || null,
          expiresAt: provisioned.expiresAt,
          accountExisted: provisioned.accountExisted,
          mustChangePassword: provisioned.mustChangePassword === true
        },
        billing: {
          listPriceCents: Number(provisioned.listPriceCents ?? plan.priceCents ?? 0),
          paidAmountCents: Number(provisioned.paidAmountCents ?? paidAmountCents ?? 0),
          couponCode: String(input.couponCode || input.coupon || '').slice(0, 100) || null
        },
        emailNotification: provisioned.emailNotification || { sent: false, skipped: true },
        loginUrl: env('SURVEYOR_LOGIN_URL', 'https://surveyorr.com.br/login/'),
        firstAccessRequired: provisioned.mustChangePassword === true,
        requestId
      }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'X-Request-ID': requestId });
    } catch (cause) {
      const rawStatus = Number(cause?.status || 500);
      const status = Number.isFinite(rawStatus) ? Math.max(400, Math.min(599, rawStatus)) : 500;
      const code = paymentProvisionPublicCode(cause, stage);
      const message = paymentProvisionPublicMessage(cause, stage);
      logPaymentProvision(stage, {
        paymentId: paymentIdForLog,
        orderId: orderIdForLog,
        email: emailForLog,
        message: `${code}: ${message}`
      }, 'error');
      return send(response, request, status, {
        ok: false,
        error: code,
        message,
        stage,
        requestId,
        retryable: status >= 500 || status === 409
      }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'X-Request-ID': requestId });
    }
  }



  if (path === '/api/integrations/payments/account-lookup' && httpMethod === 'POST') {
    commerceInternalSecret(request);
    const input = await bodyJson(request).catch(() => ({}));
    const email = normalizeEmail(input.email || '');
    if (!email) throw statusError(400, 'Informe um e-mail válido.');
    const appwriteUser = await getAppwriteUserByEmail(email);
    if (!appwriteUser) return send(response, request, 200, { ok: true, exists: false });
    const profile = await findProfileForLogin(appwriteUser.$id || appwriteUser.id || '', email).catch(() => null);
    if (String(profile?.role || '').toLowerCase() === 'admin') return send(response, request, 200, { ok: true, exists: true, protected: true, role: 'admin' });
    const account = renewalAccountSnapshot(profile || { userId: appwriteUser.$id || appwriteUser.id, email }, appwriteUser);
    return send(response, request, 200, { ok: true, exists: true, account: { userId: account.userId, email: account.email, planSlug: account.planSlug, expiresAt: account.expiresAt } }, { 'Cache-Control': 'no-store' });
  }

  if (path === '/api/billing/renewal-login' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request).catch(() => ({}));
    const email = normalizeEmail(input.email || '');
    const password = String(input.password || '');
    if (!email || !password) throw statusError(400, 'Informe e-mail e senha.');
    const appwriteUser = await getAppwriteUserByEmail(email);
    if (!appwriteUser) throw statusError(401, 'E-mail ou senha incorretos.');
    const profile = await findProfileForLogin(appwriteUser.$id || appwriteUser.id || '', email).catch(() => null);
    if (String(profile?.role || '').toLowerCase() === 'admin') throw statusError(409, 'Conta administrativa não pode ser renovada por este fluxo.');
    let session;
    try {
      session = await createEmailSession({ email, password });
    } catch (error) {
      if (isInvalidLoginCredentialError(error)) throw statusError(401, 'E-mail ou senha incorretos.');
      throw error;
    }
    await deletePublicEmailSession(session?.secret || session?.$secret || '').catch(() => false);
    const account = renewalAccountSnapshot(profile || { userId: appwriteUser.$id || appwriteUser.id, email }, appwriteUser);
    const renewalToken = createPaymentRenewalHandoff(account);
    return send(response, request, 200, {
      ok: true,
      renewalToken,
      account,
      checkoutUrl: paymentRenewalCheckoutUrl(renewalToken, account.productId)
    }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' });
  }

  if (path === '/api/billing/renewal-handoff/verify' && httpMethod === 'POST') {
    assertTrustedMutationOrigin(request);
    const input = await bodyJson(request).catch(() => ({}));
    const account = await freshRenewalAccountFromToken(input.token || input.renewalToken || '');
    return send(response, request, 200, { ok: true, account }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' });
  }

  const auth = await authFromRequest(request);
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod)) assertTrustedMutationOrigin(request);

  if (path === '/api/billing/renewal-handoff' && httpMethod === 'POST') {
    const profile = await findProfileByUserId(auth.sub).catch(() => null) || await findProfileForLogin(auth.sub, auth.user?.email || '').catch(() => null);
    const appwriteUser = await getAppwriteUserById(auth.sub).catch(() => null);
    if (!profile || !appwriteUser) throw statusError(404, 'Conta Surveyor não encontrada para renovação.');
    if (String(profile.role || '').toLowerCase() === 'admin') throw statusError(409, 'Conta administrativa não pode ser renovada por este fluxo.');
    const account = renewalAccountSnapshot(profile, appwriteUser);
    const renewalToken = createPaymentRenewalHandoff(account);
    return send(response, request, 200, {
      ok: true,
      renewalToken,
      account,
      checkoutUrl: paymentRenewalCheckoutUrl(renewalToken, account.productId)
    }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' });
  }

  await enforceServerMaintenanceLock(auth, path);

  if (path === '/api/auth/change-password' && httpMethod === 'POST') {
    const input = await bodyJson(request).catch(() => ({}));
    const currentPassword = String(input.currentPassword || '');
    const password = String(input.password || input.newPassword || '');
    const confirmation = String(input.passwordConfirmation || input.confirmPassword || input.confirmation || '');
    if (!currentPassword) throw statusError(400, 'Informe a senha atual.');
    assertStrongPassword(password, 'A nova senha');
    if (confirmation && password !== confirmation) throw statusError(400, 'As senhas informadas não são iguais.');
    if (currentPassword === password) throw statusError(400, 'A nova senha deve ser diferente da senha atual.');

    try {
      await createEmailSession({ email: auth.user.email, password: currentPassword });
    } catch (error) {
      if (isInvalidLoginCredentialError(error)) throw statusError(401, 'A senha atual está incorreta.', { code: 'CURRENT_PASSWORD_INVALID' });
      throw error;
    }

    await updateAppwriteUserPasswordStrict(auth.sub, password);
    const changedAt = new Date().toISOString();
    await updateAppwriteUserSurveyorPrefs(auth.sub, {
      mustChangePassword: false,
      passwordChangedAt: changedAt,
      firstAccessCompletedAt: changedAt
    });
    await appendSecurityEvent({
      type: 'security', action: 'password_changed', actorUserId: auth.sub, actorEmail: auth.user.email,
      ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok',
      message: 'Senha alterada pelo próprio usuário na área autenticada.'
    }).catch(() => null);
    return send(response, request, 200, {
      ok: true,
      user: { ...auth.user, mustChangePassword: false },
      message: 'Senha alterada com sucesso.'
    }, { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' });
  }

  if (path === '/api/auth/presence' && httpMethod === 'POST') {
    const now = new Date().toISOString();
    const appUser = await getAppwriteUserById(auth.sub).catch(() => null);
    const previousSeenAt = userPrefs(appUser || {})?.surveyor?.presenceLastSeenAt || null;
    const previousSeenMs = Date.parse(String(previousSeenAt || '')) || 0;
    await updateAppwriteUserSurveyorPrefs(auth.sub, { presenceLastSeenAt: now }).catch((error) => console.warn('[presence]', error?.message || error));
    if (!previousSeenMs || Date.now() - previousSeenMs >= 30 * 60 * 1000) {
      await appendSecurityEvent({
        type: 'login', action: 'session_resumed', actorUserId: auth.sub, actorEmail: auth.user?.email,
        ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok',
        message: 'Sessão retomada após período de inatividade.'
      }).catch(() => null);
    }
    return send(response, request, 200, { ok: true, lastSeenAt: now });
  }

  if (path === '/api/workspace/activity' && httpMethod === 'GET') {
    const ownerId = resourceOwnerId(auth);
    const memberships = await listWorkspaceMembersByOwner(ownerId).catch(() => []);
    const memberIds = new Set([ownerId, ...memberships.map((item) => String(item.userId || '').trim()).filter(Boolean)]);
    const profiles = await Promise.all([...memberIds].map(async (id) => {
      const profile = await findProfileByUserId(id).catch(() => null);
      const appUser = await getAppwriteUserById(id).catch(() => null);
      return [id, profile?.name || appUser?.name || profile?.email || appUser?.email || 'Usuário'];
    }));
    const names = new Map(profiles);
    const events = await listRecentSecurityEvents(300, (item) => memberIds.has(String(item.actorUserId || '')) && /^(project_created|project_opened|project_bundle_saved|project_updated|document_created|document_updated|login_success|logout)$/i.test(String(item.action || ''))).catch(() => []);
    const limit = Math.max(1, Math.min(100, Number(queryValue(request, 'limit') || 30) || 30));
    return send(response, request, 200, { ok: true, activity: events.slice(0, limit).map((item) => ({
      id: item.id, action: item.action, actorUserId: item.actorUserId, actorName: names.get(String(item.actorUserId || '')) || 'Usuário',
      target: item.target || '', createdAt: item.createdAt || null, status: item.status || 'ok',
      metadata: item.metadata && typeof item.metadata === 'object' ? { projectName: item.metadata.projectName || '', documentName: item.metadata.documentName || '', projectId: item.metadata.projectId || item.target || '' } : {}
    })) });
  }


  if (path === '/api/generations/me' && httpMethod === 'GET') {
    return send(response, request, 200, { ok: true, generation: auth.user.generation || null });
  }

  if (path === '/api/generations/consume' && httpMethod === 'POST') {
    const input = await bodyJson(request).catch(() => ({}));
    const result = await consumeGenerationCredit(auth, input.feature || input.label || 'geracao');
    return send(response, request, 200, { ok: true, ...result });
  }

  if (path === '/api/admin/plan-documents/send-email' && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const input = await bodyJson(request).catch(() => ({}));
    const to = normalizeEmail(input.to || input.email);
    const name = String(input.name || '').trim().slice(0, 180);
    const planName = String(input.planName || '').trim().slice(0, 180);
    const documentType = String(input.documentType || 'term') === 'receipt' ? 'receipt' : 'term';
    const filename = String(input.filename || '').trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 240);
    const contentBase64 = String(input.contentBase64 || '').replace(/^data:application\/pdf;base64,/, '').trim();
    const maxBytes = Number(env('PLAN_DOCUMENT_MAX_ATTACHMENT_BYTES', String(8 * 1024 * 1024))) || 8 * 1024 * 1024;
    if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw statusError(400, 'E-mail de destino inválido.');
    if (!name) throw statusError(400, 'Nome do cliente não informado.');
    if (!planName) throw statusError(400, 'Plano não informado.');
    if (!filename.toLowerCase().endsWith('.pdf')) throw statusError(400, 'Nome do arquivo PDF inválido.');
    if (!contentBase64) throw statusError(400, 'Conteúdo do PDF não informado.');
    let pdfBuffer;
    try { pdfBuffer = Buffer.from(contentBase64, 'base64'); } catch { throw statusError(400, 'PDF em Base64 inválido.'); }
    if (!pdfBuffer.length || pdfBuffer.slice(0, 4).toString() !== '%PDF') throw statusError(400, 'O anexo não é um PDF válido.');
    if (pdfBuffer.length > maxBytes) throw statusError(413, `O PDF excede o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);

    const emailFunctionUrl = String(env('EMAIL_FUNCTION_URL', '') || '').replace(/\/+$/, '');
    const emailFunctionSecret = env('EMAIL_FUNCTION_SECRET');
    if (!emailFunctionUrl || !emailFunctionSecret) throw statusError(503, 'Function de e-mail não configurada para documentos dos planos.');
    const endpoint = `${emailFunctionUrl}${env('EMAIL_FUNCTION_PLAN_DOCUMENT_PATH', '/api/admin/send-plan-document')}`;
    const emailResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Surveyor-Internal-Secret': emailFunctionSecret },
      body: JSON.stringify({
        to, name, planName, documentType, filename, contentBase64,
        startDate: String(input.startDate || '').slice(0, 40),
        endDate: String(input.endDate || '').slice(0, 40),
        accessEmail: normalizeEmail(input.accessEmail || to),
        amountCents: Number(input.amountCents || 0),
        documentCode: String(input.documentCode || '').slice(0, 100)
      })
    });
    const emailData = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) throw statusError(emailResponse.status >= 500 ? 502 : emailResponse.status, emailData?.error || emailData?.message || `Function de e-mail recusou o envio (${emailResponse.status}).`, emailData);
    await appendSecurityEvent({
      type: 'document', action: 'plan_document_email_sent', actorUserId: auth.sub, actorEmail: auth.user?.email,
      targetEmail: to, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok',
      message: `${documentType === 'receipt' ? 'Comprovante' : 'Termo'} do ${planName} enviado para ${to}.`,
      metadata: { filename, documentType, planName, bytes: pdfBuffer.length, provider: emailData?.provider || null, providerId: emailData?.id || null }
    }).catch(() => null);
    return send(response, request, 200, { ok: true, sent: true, to, filename, provider: emailData?.provider || null, id: emailData?.id || null });
  }

  if (path === '/api/admin/dashboard' && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const dashboard = await buildAdminDashboard(request, auth);
    return send(response, request, 200, { ok: true, dashboard });
  }

  if (path === '/api/admin/ai/ask' && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const input = await bodyJson(request);
    const question = String(input.question || '').trim().slice(0, 1800);
    if (question.length < 3) throw statusError(400, 'Escreva uma pergunta administrativa válida.');
    const [dashboard, users, events, groups, layers, notices] = await Promise.all([
      buildAdminDashboard(request, auth),
      listAdminUsers().catch(() => []),
      listRecentSecurityEvents(120).catch(() => []),
      listLayerGroupsSafe().catch(() => []),
      listLayersSafe().catch(() => []),
      readSystemNotices().catch(() => [])
    ]);
    const result = await askOpenRouterAdmin(question, adminAiContext(dashboard, users, events, groups, layers, notices), { image: input.image || null, history: input.history || [] });
    await appendSecurityEvent({ type: 'ai', action: 'admin_ai_question', actorUserId: auth.sub, actorEmail: auth.user?.email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', message: 'Consulta administrativa processada pela IA.', metadata: { model: result.model, imageAttached: result.imageProcessed } }).catch(() => null);
    return send(response, request, 200, { ok: true, configured: true, ...result });
  }


  if (path === '/api/admin/system/diagnostics' && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const runCheck = async (name, fn) => {
      const startedAt = Date.now();
      try {
        await fn();
        return { name, ok: true, latencyMs: Date.now() - startedAt };
      } catch (error) {
        return { name, ok: false, latencyMs: Date.now() - startedAt, error: publicErrorMessage(error), code: String(error?.code || '') };
      }
    };
    const checks = await Promise.all([
      runCheck('database', () => listRows('users_profile', [Query.limit(1)])),
      runCheck('auth', () => getAppwriteUserById(auth.sub)),
      runCheck('storage-projects', () => awFetch(`/storage/buckets/${encodeURIComponent(bucketId('project_files'))}`)),
      runCheck('storage-documents', () => awFetch(`/storage/buckets/${encodeURIComponent(bucketId('generated_documents'))}`))
    ]);
    const ready = checks.every((item) => item.ok);
    return send(response, request, ready ? 200 : 503, {
      ok: ready,
      service: 'Surveyor API Appwrite Function',
      version: APP_VERSION,
      checkedAt: new Date().toISOString(),
      checks,
      configuration: {
        emailFunctionConfigured: Boolean(env('EMAIL_FUNCTION_URL') && env('EMAIL_FUNCTION_SECRET')),
        googleDriveConfigured: Boolean(env('GOOGLE_DRIVE_CLIENT_ID') && env('GOOGLE_DRIVE_CLIENT_SECRET') && env('GOOGLE_DRIVE_REDIRECT_URI')),
        securityEventsCollection: securityEventsCollectionAvailable === true ? 'active' : securityEventsCollectionAvailable === false ? 'fallback' : 'unknown',
        legacyCorsEnabled: String(env('ENABLE_LEGACY_CORS_ORIGINS', 'false')).toLowerCase() === 'true'
      }
    }, ready ? {} : { 'Retry-After': '30' });
  }

  if (path === '/api/admin/audit-logs' && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const logs = await listRecentSecurityEvents(Number(queryValue(request, 'limit') || 200) || 200);
    const integrity = {
      verified: logs.filter((item) => item.integrityStatus === 'verified').length,
      legacy: logs.filter((item) => item.integrityStatus === 'legacy').length,
      invalid: logs.filter((item) => item.integrityStatus === 'invalid').length
    };
    return send(response, request, 200, { ok: true, logs, integrity });
  }

  if (path === '/api/admin/login-attempts' && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const attempts = await listRecentSecurityEvents(Number(queryValue(request, 'limit') || 200) || 200, (item) => item.type === 'login' || /login|auth/i.test(item.action || ''));
    const integrity = {
      verified: attempts.filter((item) => item.integrityStatus === 'verified').length,
      legacy: attempts.filter((item) => item.integrityStatus === 'legacy').length,
      invalid: attempts.filter((item) => item.integrityStatus === 'invalid').length
    };
    return send(response, request, 200, { ok: true, attempts, integrity });
  }

  if (path === '/api/admin/sessions' && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const users = await listAdminUsers().catch(() => []);
    const { store: adminSecurityStore } = await readSystemSecurityStore().catch(() => ({ store: {} }));
    const recentEvents = await listRecentSecurityEvents(2000).catch(() => []);
    const eventTime = (event) => Date.parse(String(event?.createdAt || '')) || 0;
    const sameUser = (event, user) => {
      const sameId = event?.actorUserId && String(event.actorUserId) === String(user.id);
      const sameEmail = event?.actorEmail && normalizeEmail(event.actorEmail) === normalizeEmail(user.email);
      const remoteTarget = String(event?.action || '').toLowerCase() === 'remote_logout'
        && event?.targetUserId && String(event.targetUserId) === String(user.id);
      return Boolean(sameId || sameEmail || remoteTarget);
    };
    const rows = [];
    for (const user of users.slice(0, 100)) {
      const appUser = await getAppwriteUserById(user.id).catch(() => null);
      const { surveyor } = userPrefs(appUser || {});
      const userEvents = recentEvents.filter((event) => sameUser(event, user)).sort((a, b) => eventTime(b) - eventTime(a));
      // R24.1: login, atividade e saída são conceitos independentes.
      // O login vem SOMENTE de login_success (ou do marcador persistido no login),
      // nunca de refresh, heartbeat, accessedAt ou session_resumed.
      const explicitLogin = userEvents.find((event) => String(event.action || '').toLowerCase() === 'login_success') || null;
      const prefsLoginAt = surveyor.lastLoginAt || null;
      const activeRefreshSessions = normalizedAuthSessions(appUser || {});
      // createdAt da família de refresh é gravado quando a sessão nasce e não muda
      // durante rotação. É um fallback seguro para sessões antigas sem login_success.
      const lastSessionCreatedAt = activeRefreshSessions
        .map((item) => item.createdAt || null).filter(Boolean)
        .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0))[0] || null;
      const lastLoginAt = [explicitLogin?.createdAt, prefsLoginAt, lastSessionCreatedAt]
        .filter(Boolean)
        .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0))[0] || null;

      const logoutEvent = userEvents.find((event) => ['logout', 'remote_logout'].includes(String(event.action || '').toLowerCase())) || null;
      const prefsLogoutAt = surveyor.lastLogoutAt || surveyor.remoteLogoutAt || null;
      const rawLastLogoutAt = [logoutEvent?.createdAt, prefsLogoutAt]
        .filter(Boolean)
        .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0))[0] || null;

      const lastSessionRotatedAt = activeRefreshSessions
        .map((item) => item.lastRotatedAt || item.createdAt || null).filter(Boolean)
        .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0))[0] || null;

      const loggedProject = userEvents
        .filter((event) => /^project_(?:created|opened|bundle_saved|updated)$/i.test(String(event.action || '')))
        .sort((a, b) => eventTime(b) - eventTime(a))[0] || null;
      const prefsProjectAt = surveyor.lastProjectAt || null;
      const loggedProjectAt = loggedProject?.createdAt || null;
      const usePrefsProject = (Date.parse(String(prefsProjectAt || '')) || 0) > (Date.parse(String(loggedProjectAt || '')) || 0);
      const lastProjectAt = usePrefsProject ? prefsProjectAt : loggedProjectAt;
      const lastProjectName = usePrefsProject
        ? (surveyor.lastProjectName || null)
        : (loggedProject?.metadata?.projectName || loggedProject?.target || null);
      const lastProjectAction = usePrefsProject ? 'project_bundle_saved' : (loggedProject?.action || null);

      // A linha do tempo é a fonte única da "atividade real". Auth/refresh/presença
      // não são tratados como trabalho do usuário.
      const timelineEvents = userEvents.filter((event) => !['refresh_rotated', 'session_resumed', 'presence'].includes(String(event.action || '').toLowerCase()));
      const recentActivity = timelineEvents.slice(0, 40).map((event) => ({
        id: event.id, action: event.action, createdAt: event.createdAt, message: event.message || '',
        target: event.target || '', metadata: event.metadata || {}
      }));
      if (prefsProjectAt && surveyor.lastProjectName && !recentActivity.some((item) =>
        String(item.action || '').toLowerCase() === 'project_bundle_saved'
        && String(item.metadata?.projectId || item.target || '') === String(surveyor.lastProjectId || '')
        && Math.abs((Date.parse(String(item.createdAt || '')) || 0) - (Date.parse(String(prefsProjectAt || '')) || 0)) < 2000
      )) {
        recentActivity.push({
          id: `project-prefs-${user.id}-${Date.parse(String(prefsProjectAt)) || 0}`,
          action: 'project_bundle_saved', createdAt: prefsProjectAt, message: '', target: surveyor.lastProjectId || '',
          metadata: { projectId: surveyor.lastProjectId || '', projectName: surveyor.lastProjectName || '' }
        });
      }
      recentActivity.sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0));

      const realActivity = recentActivity.find((item) => !['login_success', 'logout', 'remote_logout'].includes(String(item.action || '').toLowerCase())) || null;
      const lastActivityAt = realActivity?.createdAt || null;

      const presenceLastSeenAt = surveyor.presenceLastSeenAt || null;
      const seenMs = Date.parse(String(presenceLastSeenAt || '')) || 0;
      const logoutMs = Date.parse(String(rawLastLogoutAt || '')) || 0;
      const loginMs = Date.parse(String(lastLoginAt || '')) || 0;
      const remoteLogoutMs = Date.parse(String(surveyor.remoteLogoutAt || '')) || 0;
      const normalizedStatus = String(user?.status || '').trim().toLowerCase();
      const accountActive = user?.isActive === true || ['active', 'ativo'].includes(normalizedStatus);
      const isOnline = accountActive && seenMs > 0 && Date.now() - seenMs <= 6 * 60 * 1000
        && seenMs >= Math.max(logoutMs, remoteLogoutMs);
      const loginLock = loginLockStateFromStore(adminSecurityStore, user.email);

      // Uma saída anterior ao último login pertence à sessão anterior e não deve
      // ser exibida como "última saída" da sessão atual.
      const coherentLogoutAt = logoutMs && (!loginMs || logoutMs >= loginMs) ? rawLastLogoutAt : null;

      rows.push({
        userId: user.id, name: user.name, email: user.email, status: user.status,
        lastLoginAt, lastSeenAt: lastActivityAt, presenceLastSeenAt, isOnline,
        lastLogoutAt: coherentLogoutAt,
        lastProjectAt: lastProjectAt, lastProjectAction: lastProjectAction, lastProjectName: lastProjectName,
        remoteLogoutAt: surveyor.remoteLogoutAt || null,
        activeRefreshSessionCount: activeRefreshSessions.length,
        lastSessionCreatedAt, lastSessionRotatedAt, loginLock, recentActivity: recentActivity.slice(0, 20)
      });
    }
    return send(response, request, 200, { ok: true, sessions: rows, source: securityEventsCollectionAvailable === true ? 'security_events+user_prefs' : 'fallback+user_prefs' });
  }

  const remoteLogoutMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/logout-remote$/);
  if (remoteLogoutMatch && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const targetUserId = decodeURIComponent(remoteLogoutMatch[1]);
    const now = new Date().toISOString();
    await updateAppwriteUserSurveyorPrefs(targetUserId, { remoteLogoutAt: now, lastLogoutAt: now, sessionVersion: appwriteId(), authSessions: [], presenceLastSeenAt: null });
    await appendSecurityEvent({ type: 'security', action: 'remote_logout', actorUserId: auth.sub, actorEmail: auth.user?.email, targetUserId, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', message: 'Sessões do usuário invalidadas por política do Surveyor.' });
    return send(response, request, 200, { ok: true, remoteLogoutAt: now });
  }

  const unlockLoginMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/unlock-login$/);
  if (unlockLoginMatch && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const targetUserId = decodeURIComponent(unlockLoginMatch[1]);
    const appUser = await getAppwriteUserById(targetUserId).catch(() => null);
    const profile = await findProfileByUserId(targetUserId).catch(() => null);
    const email = normalizeEmail(appUser?.email || profile?.email || '');
    if (!email) throw statusError(404, 'Não foi possível localizar o e-mail da conta.');
    await clearLoginAccountLock(email);
    await appendSecurityEvent({ type: 'security', action: 'login_lock_removed', actorUserId: auth.sub, actorEmail: auth.user?.email, targetUserId, target: email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', message: 'Bloqueio temporário de login removido pelo administrador.' }).catch(() => null);
    return send(response, request, 200, { ok: true, userId: targetUserId, email, unlocked: true });
  }

  if (path === '/api/admin/security/settings' && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const { store } = await readSystemSecurityStore();
    return send(response, request, 200, { ok: true, settings: { ...(store.settings || {}), blockAfterAttempts: LOGIN_ACCOUNT_LOCK_ATTEMPTS, loginLockHours: 5 } });
  }

  if (path === '/api/admin/security/settings' && ['POST','PUT','PATCH'].includes(httpMethod)) {
    requireAdminAccess(auth);
    const input = await bodyJson(request).catch(() => ({}));
    const { store } = await readSystemSecurityStore();
    const settings = {
      ...(store.settings || {}),
      twoFactorPolicy: String(input.twoFactorPolicy || store.settings?.twoFactorPolicy || 'email-code-first-login'),
      devicePolicy: String(input.devicePolicy || store.settings?.devicePolicy || 'audit-only'),
      blockAfterAttempts: LOGIN_ACCOUNT_LOCK_ATTEMPTS,
      loginLockHours: 5,
      encryptionMode: String(input.encryptionMode || store.settings?.encryptionMode || 'provider-rest-encryption')
    };
    await saveSystemSecurityStore({ ...store, settings });
    await appendSecurityEvent({ type: 'security', action: 'security_settings_updated', actorUserId: auth.sub, actorEmail: auth.user?.email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok' });
    return send(response, request, 200, { ok: true, settings });
  }

  if (path === '/api/admin/backups' && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const { store } = await readSystemSecurityStore();
    return send(response, request, 200, { ok: true, backups: (store.backups || []).slice().reverse() });
  }

  if (path === '/api/admin/backups' && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const dashboard = await buildAdminDashboard(request, auth);
    const { store } = await readSystemSecurityStore();
    const backup = { id: appwriteId(), status: 'inventory-only', type: 'metadata_inventory', createdAt: new Date().toISOString(), createdBy: auth.sub, summary: dashboard.stats, sizeBytes: Buffer.byteLength(JSON.stringify(dashboard)), warning: 'Inventário técnico. Não é cópia de segurança restaurável.' };
    await saveSystemSecurityStore({ ...store, backups: [...(store.backups || []), backup].slice(-100) });
    await appendSecurityEvent({ type: 'backup', action: 'metadata_inventory_created', actorUserId: auth.sub, actorEmail: auth.user?.email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', message: 'Inventário técnico de metadados registrado; não substitui backup restaurável.' });
    return send(response, request, 201, { ok: true, backup });
  }

  if (path === '/api/integrations/google-drive/status' && httpMethod === 'GET') {
    const cfg = googleDriveConfig();
    const connection = await readGoogleDriveConnection().catch(() => ({ connected: false, store: {} }));
    return send(response, request, 200, {
      ok: true,
      enabled: cfg.enabled,
      configured: Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri),
      connected: Boolean(connection.connected),
      rootFolderName: connection.store?.rootFolderName || cfg.rootFolderName,
      rootFolderId: connection.store?.rootFolderId || '',
      connectedAt: connection.store?.connectedAt || null,
      connectedEmail: connection.store?.connectedEmail || ''
    });
  }

  if (path === '/api/integrations/google-drive/connect' && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const cfg = assertGoogleDriveConfigured();
    const state = signJwt({ type: 'google-drive-connect', sub: auth.sub, email: auth.email }, 15 * 60);
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: cfg.scope,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state
    });
    return send(response, request, 200, { ok: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  }

  if (path === '/api/integrations/google-drive/test' && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const accessToken = await googleDriveAccessToken();
    const root = await ensureGoogleDriveRoot(accessToken);
    const about = await googleDriveRequest('/about?fields=user(displayName,emailAddress),storageQuota(limit,usage,usageInDrive)', { method: 'GET', accessToken });
    return send(response, request, 200, { ok: true, connected: true, rootFolderId: root.id, rootFolderName: root.name, driveUser: about.user || {}, storageQuota: about.storageQuota || {} });
  }

  if (path === '/api/documents/google-drive/session' && httpMethod === 'POST') {
    requirePermission(auth, 'cloud:access');
    assertWorkspaceActionAllowed(auth, 'document:create');
    const input = sanitizeDocumentClientInput(await bodyJson(request));
    requireDocumentCategoryPermission(auth, input);
    await assertOptionalProjectBelongsToAuth(input.projectId, auth);
    const session = await createGoogleDriveResumableSession({ auth, input });
    return send(response, request, 200, { ok: true, session });
  }

  if (path === '/api/documents/google-drive/complete' && httpMethod === 'POST') {
    requirePermission(auth, 'cloud:access');
    assertWorkspaceActionAllowed(auth, 'document:create');
    const input = sanitizeDocumentClientInput(await bodyJson(request));
    requireDocumentCategoryPermission(auth, input);
    await assertOptionalProjectBelongsToAuth(input.projectId, auth);
    const driveFileHint = input.driveFile && typeof input.driveFile === 'object' ? input.driveFile : {};
    const fileId = String(input.fileId || driveFileHint.id || '').trim();
    if (!fileId) throw statusError(400, 'ID do arquivo no Google Drive não informado.');
    const driveFile = await googleDriveFileForAuth(fileId, auth, { requireSurveyorTag: true });
    const now = new Date().toISOString();
    const fileName = driveSafeName(driveFile.name || input.fileName || 'arquivo.bin', 'arquivo.bin');
    const mimeType = String(driveFile.mimeType || input.mimeType || 'application/octet-stream').slice(0, 180);
    const folderName = String(input.folderName || input.folder || '').slice(0, 120);
    const category = String(input.category || input.type || 'outros').slice(0, 80);
    const tags = Array.isArray(input.tags) ? input.tags.map((tag) => String(tag || '').slice(0, 80)).filter(Boolean) : [];
    if (folderName && !tags.some((tag) => /^Pasta:/i.test(tag))) tags.push(`Pasta: ${folderName}`);
    const metadata = {
      storageProvider: 'google_drive',
      externalFileId: fileId,
      fileName,
      mimeType,
      category,
      folderName,
      folderId: String(input.folderId || '').slice(0, 160),
      sizeBytes: Number(driveFile.size || input.sizeBytes || 0) || 0,
      webViewLink: String(driveFile.webViewLink || ''),
      createdAt: now,
      updatedAt: now
    };
    const row = await createDocumentRowSafe({
      userId: resourceOwnerId(auth),
      projectId: String(input.projectId || ''),
      type: category,
      format: mimeType,
      name: String(input.title || fileName).slice(0, 240),
      fileName,
      fileId,
      bucketId: 'google_drive',
      tags,
      folderName,
      folderId: metadata.folderId,
      sizeBytes: metadata.sizeBytes,
      status: 'saved',
      metadata,
      createdAt: now,
      updatedAt: now
    });
    return send(response, request, 201, { ok: true, document: await serializeDocumentRow(row) });
  }

  const documentDownloadMatch = path.match(/^\/api\/documents\/([^/]+)\/download$/);
  if (documentDownloadMatch && httpMethod === 'GET') {
    requirePermission(auth, 'documents:download', 'Seu plano não permite baixar documentos.');
    const documentId = decodeURIComponent(documentDownloadMatch[1]);
    const current = await getRow('documents', documentId);
    if (!current || current.userId !== resourceOwnerId(auth) || String(current.status || '').toLowerCase() === 'deleted') throw statusError(404, 'Documento não encontrado.');
    requireDocumentCategoryPermission(auth, current);
    await consumeDailyUsage(auth, 'download', 1, { documentId, type: current.type || current.category || 'document' });
    const metadata = safeJson(current.metadata, {});
    const isGoogleDrive = current.bucketId === 'google_drive' || metadata.storageProvider === 'google_drive';
    const fileName = current.fileName || metadata.fileName || current.name || 'arquivo';
    const mimeType = current.format || metadata.mimeType || 'application/octet-stream';
    if (!isGoogleDrive) {
      const content = await readFileText(current.bucketId || bucketId('generated_documents'), current.fileId);
      return sendText(response, request, 200, content, mimeType || 'application/octet-stream', { 'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"` });
    }
    await googleDriveFileForAuth(current.fileId, auth, { requireSurveyorTag: false });
    const accessToken = await googleDriveAccessToken();
    const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(current.fileId)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!driveResponse.ok) throw statusError(driveResponse.status >= 500 ? 502 : driveResponse.status, 'Não foi possível baixar o arquivo do Google Drive.');
    const arrayBuffer = await driveResponse.arrayBuffer();
    return response.send(Buffer.from(arrayBuffer), 200, {
      'Access-Control-Allow-Origin': corsOrigin(request),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With, Cache-Control, Pragma',
    'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
    });
  }

  if (path === '/api/usage/status' && httpMethod === 'GET') {
    return send(response, request, 200, { ok: true, usage: await dailyUsageStatus(auth), storeUrl: SURVEYOR_STORE_URL });
  }

  if (path === '/api/storage/status' && httpMethod === 'GET') {
    const ownerId = resourceOwnerId(auth);
    const usage = await logicalStorageUsageBytesForUser(ownerId);
    const storagePlanValue = (key) => {
      const raw = auth?.user?.planLimits?.[key];
      if (raw == null || raw === '') return null;
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : null;
    };
    // Exibição da franquia não usa o bypass administrativo de planLimitNumber().
    // Assim um administrador em Plano Pro ainda enxerga 1 GB / expansão até 10 GB.
    const limitBytes = storagePlanValue('storageLimitBytes');
    const baseBytes = storagePlanValue('storageBaseBytes');
    const purchasedBytes = storagePlanValue('storagePurchasedBytes');
    const maxBytes = storagePlanValue('storageMaxBytes');
    return send(response, request, 200, {
      ok: true,
      storage: {
        usedBytes: Math.max(0, Number(usage.totalBytes || 0)),
        projectBytes: Math.max(0, Number(usage.projectBytes || 0)),
        documentBytes: Math.max(0, Number(usage.documentBytes || 0)),
        limitBytes,
        baseBytes,
        purchasedBytes,
        maxBytes,
        remainingBytes: limitBytes == null ? null : Math.max(0, Number(limitBytes) - Number(usage.totalBytes || 0)),
        shared: true,
        estimated: Boolean(usage.estimated),
        storeUrl: SURVEYOR_STORE_URL
      }
    }, { 'Cache-Control': 'no-store, max-age=0' });
  }

  if (path === '/api/usage/consume' && httpMethod === 'POST') {
    const input = await bodyJson(request).catch(() => ({}));
    const kind = String(input.kind || 'download').toLowerCase() === 'export' ? 'export' : 'download';
    const usage = await consumeDailyUsage(auth, kind, 1, { source: String(input.source || '').slice(0, 120), fileName: String(input.fileName || '').slice(0, 240) });
    return send(response, request, 200, { ok: true, usage, storeUrl: SURVEYOR_STORE_URL });
  }

  if (path === '/api/auth/me' && httpMethod === 'GET') {
    if (loginEmailVerificationEnabled() && auth.user && !auth.user.emailVerified) {
      throw statusError(403, 'Conta ainda não verificada. Entre novamente e confirme o código enviado por e-mail.');
    }
    return send(response, request, 200, { ok: true, user: auth.user });
  }

  if (path === '/api/plans' && httpMethod === 'GET') {
    const includeInactiveRequested = queryValue(request, 'all') === '1' || queryValue(request, 'all') === 'true';
    const includeInactive = includeInactiveRequested && isGlobalAdminAccess(auth);
    return send(response, request, 200, { ok: true, plans: await listPlansSafe({ includeInactive }) });
  }

  if (path === '/api/plans' && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const input = await bodyJson(request);
    const result = await upsertPlanBySlug(input);
    clearPlanRuntimeCache();
    return send(response, request, result.action === 'created' ? 201 : 200, { ok: true, ...result });
  }

  if ((path === '/api/admin/plans/dedupe' || path === '/api/admin/plans/sync-official') && ['POST', 'GET'].includes(httpMethod)) {
    requireAdminAccess(auth);
    const result = await dedupePlansServer({ syncOfficial: true });
    clearPlanRuntimeCache();
    return send(response, request, 200, { ok: true, ...result });
  }

  const planMatch = path.match(/^\/api\/plans\/([^/]+)$/);
  if (planMatch && httpMethod === 'DELETE') {
    requireAdminAccess(auth);
    const result = await deletePlanByIdOrSlug(planMatch[1]);
    clearPlanRuntimeCache();
    return send(response, request, 200, { ok: true, ...result });
  }

  if (planMatch && httpMethod === 'PATCH') {
    requireAdminAccess(auth);
    const planId = decodeURIComponent(planMatch[1]);
    const input = await bodyJson(request);
    const current = await getRow('plans', planId).catch(() => null);
    if (current?.$id || current?.id) {
      const row = await updateRow('plans', current.$id || current.id, planData(input, current));
      clearPlanRuntimeCache();
      return send(response, request, 200, { ok: true, plan: mapPlan(row) });
    }
    // Compatibilidade: quando a coleção ainda está vazia ou o ID do documento
    // não é igual ao slug comercial, atualizamos pelo slug em vez de criar duplicado.
    const base = mapPlan(planBySlug(planId));
    const result = await upsertPlanBySlug({ ...base, ...input, slug: input.slug || base.slug || planId });
    clearPlanRuntimeCache();
    return send(response, request, result.action === 'created' ? 201 : 200, { ok: true, ...result });
  }

  const adminWorkspaceMembersMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/subusers$/) || path.match(/^\/api\/admin\/users\/([^/]+)\/team\/members$/);
  if (adminWorkspaceMembersMatch && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const ownerUserId = decodeURIComponent(adminWorkspaceMembersMatch[1]);
    return send(response, request, 200, { ok: true, team: await workspaceAdminSummary(ownerUserId) });
  }

  const adminWorkspaceSettingsMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/team$/);
  if (adminWorkspaceSettingsMatch && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const ownerUserId = decodeURIComponent(adminWorkspaceSettingsMatch[1]);
    return send(response, request, 200, { ok: true, team: await workspaceAdminSummary(ownerUserId) });
  }

  if (adminWorkspaceSettingsMatch && ['PATCH','PUT'].includes(httpMethod)) {
    requireAdminAccess(auth);
    const ownerUserId = decodeURIComponent(adminWorkspaceSettingsMatch[1]);
    const input = await bodyJson(request).catch(() => ({}));
    const name = String(input.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (name && name.length < 3) throw statusError(400, 'O nome da equipe deve ter pelo menos 3 caracteres.');
    await workspaceOwnerAdminBundle(ownerUserId);
    await updateAppwriteUserSurveyorPrefs(ownerUserId, { workspaceName: name || null });
    await appendSecurityEvent({ type: 'workspace', action: 'workspace_name_updated', actorUserId: auth.sub, actorEmail: auth.user?.email, targetUserId: ownerUserId, target: ownerUserId, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', message: name ? `Equipe renomeada para ${name}.` : 'Nome personalizado da equipe removido.' }).catch(() => null);
    return send(response, request, 200, { ok: true, team: await workspaceAdminSummary(ownerUserId) });
  }

  if (adminWorkspaceMembersMatch && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const ownerUserId = decodeURIComponent(adminWorkspaceMembersMatch[1]);
    const result = await createWorkspaceMember({ ownerUserId, input: await bodyJson(request), adminAuth: auth, request });
    return send(response, request, 201, { ok: true, ...result });
  }

  const adminSubuserMatch = path.match(/^\/api\/admin\/subusers\/([^/]+)$/) || path.match(/^\/api\/admin\/team-members\/([^/]+)$/);
  if (adminSubuserMatch && httpMethod === 'PATCH') {
    requireAdminAccess(auth);
    const userId = decodeURIComponent(adminSubuserMatch[1]);
    const result = await updateWorkspaceMember({ userId, input: await bodyJson(request), adminAuth: auth, request });
    return send(response, request, 200, { ok: true, ...result });
  }

  if (adminSubuserMatch && httpMethod === 'DELETE') {
    requireAdminAccess(auth);
    const userId = decodeURIComponent(adminSubuserMatch[1]);
    const result = await deleteWorkspaceMember({ userId, adminAuth: auth, request });
    return send(response, request, 200, { ok: true, ...result });
  }

  if (path === '/api/admin/users' && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const users = await listAdminUsers();
    return send(response, request, 200, { ok: true, users });
  }

  if (path === '/api/admin/users' && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const input = await bodyJson(request);
    const email = normalizeEmail(input.email);
    if (!email) throw statusError(400, 'Informe um e-mail válido.');
    const selectedPlan = await findPlanBySlugSafe(input.planSlug || input.plan || 'basic_annual');
    const requestedWorkspaceMembers = prepareOnboardingWorkspaceMembers(input.workspaceMembers, selectedPlan, email);
    if (requestedWorkspaceMembers.length) await ensureWorkspaceCollectionAvailable();
    const creationRequestId = String(input.creationRequestId || '').trim().slice(0, 120);
    if (!creationRequestId) throw statusError(400, 'Identificador da criação não informado. Atualize o painel e tente novamente.');
    const bootstrapPassword = String(input.password || '');
    assertStrongPassword(bootstrapPassword, 'A senha temporária');
    let appwriteUser = await getAppwriteUserByEmail(email).catch(() => null);
    let recoveredExistingProfile = null;
    let appwriteUserCreatedNow = false;
    if (!appwriteUser) {
      try {
        appwriteUser = await createAppwriteUser({ email, password: bootstrapPassword, name: input.name || email });
        appwriteUserCreatedNow = true;
      } catch (error) {
        const message = String(error?.message || error?.details?.message || '');
        const duplicate = error?.status === 409 || error?.code === 409 || /same ID already exists|target.*already exists|user.*already exists|email.*already exists/i.test(message);
        if (!duplicate) throw error;
        appwriteUser = await getAppwriteUserByEmail(email).catch(() => null);
        if (!appwriteUser) throw statusError(409, 'Já existe uma conta com este e-mail, mas ela não pôde ser recuperada automaticamente. Atualize a lista de usuários.', { code: 'USER_ALREADY_EXISTS_REFRESH_REQUIRED' });
      }
    }
    if (!appwriteUserCreatedNow) {
      const currentUserId = appwriteUser.$id || appwriteUser.id;
      recoveredExistingProfile = await findProfileForLogin(currentUserId, email).catch(() => null)
        || await findProfileByUserId(currentUserId).catch(() => null);
      const storedRequestId = String(userPrefs(appwriteUser)?.surveyor?.adminCreationRequestId || '').trim();
      const sameRequestRetry = storedRequestId && storedRequestId === creationRequestId;
      const incompleteAccount = !recoveredExistingProfile;
      if (!sameRequestRetry && !incompleteAccount) {
        throw statusError(409, 'Já existe uma conta completa com este e-mail. Use Renovar / editar em vez de criar outra conta.', { code: 'USER_ALREADY_EXISTS' });
      }
      await updateAppwriteUserPasswordStrict(currentUserId, bootstrapPassword);
      const passwordChangedAt = new Date().toISOString();
      await updateAppwriteUserSurveyorPrefs(currentUserId, { remoteLogoutAt: passwordChangedAt, sessionVersion: appwriteId(), firstAccessInviteIssuedAt: passwordChangedAt }).catch(() => null);
    }
    const targetUserId = appwriteUser.$id || appwriteUser.id;
    let existing = recoveredExistingProfile;
    let requestedEmailVerified = false;
    let normalizedWhatsapp = '';
    let profile = null;
    try {
      await updateAppwriteUserName(targetUserId, input.name || appwriteUser.name || email);
      existing = existing || await findProfileForLogin(targetUserId, email).catch(() => null);
      requestedEmailVerified = input.emailVerified !== undefined
        ? Boolean(input.emailVerified)
        : (existing ? isEmailVerified(existing, {}) : false);
      await updateAppwriteUserEmailVerification(targetUserId, requestedEmailVerified);
      if (input.status !== undefined) await updateAppwriteUserStatus(targetUserId, String(input.status || 'active').toLowerCase() === 'active');
      normalizedWhatsapp = normalizeBrazilPhone(input.whatsapp || input.phone || existing?.whatsapp || existing?.phone || appwriteUser.phone || '');
      if (input.whatsappOptIn === true && !normalizedWhatsapp) throw statusError(400, 'Informe o WhatsApp ou desative a autorização de contato.');
      if (normalizedWhatsapp) await updateAppwriteUserPhone(targetUserId, normalizedWhatsapp);
      await updateAppwriteUserSurveyorPrefs(targetUserId, {
        status: String(input.status || existing?.status || 'active').toLowerCase(),
        mustChangePassword: true,
        firstAccessInviteIssuedAt: new Date().toISOString(),
        accountCreatedByAdmin: true,
        adminCreationRequestId: creationRequestId,
        expiresAt: input.expiresAt || null,
        subscriptionStartedAt: input.subscriptionStartedAt || null,
        contract: {
          planSlug: String(input.planSlug || input.plan || existing?.plan || 'basic'),
          startedAt: input.subscriptionStartedAt || null,
          expiresAt: input.expiresAt || null,
          amountCents: Number(input.paymentAmountCents || 0),
          paymentMethod: String(input.paymentMethod || '').slice(0, 80),
          clientDocument: String(input.clientDocument || '').slice(0, 40),
          updatedAt: new Date().toISOString()
        },
        phone: normalizedWhatsapp,
        whatsapp: normalizedWhatsapp,
        whatsappOptIn: input.whatsappOptIn !== undefined ? Boolean(input.whatsappOptIn) : Boolean(normalizedWhatsapp),
        whatsappReminderDays: normalizeReminderDays(input.whatsappReminderDays || [7, 1]),
        ...(appwriteUserCreatedNow || !recoveredExistingProfile ? {
          onboarding: sanitizeOnboardingState({ schemaVersion: 1, lastSeenAt: '', lastReviewPromptAt: '', tours: {} })
        } : {})
      }).catch(() => null);
      profile = await createOrUpdateAdminProfile({ ...input, emailVerified: requestedEmailVerified }, appwriteUser, existing);
    } catch (error) {
      if (appwriteUserCreatedNow) {
        const profileAfterFailure = await findProfileByUserId(targetUserId).catch(() => null);
        if (!profileAfterFailure) await deleteAppwriteUser(targetUserId).catch(() => null);
      }
      throw error;
    }
    const refreshedUser = await getAppwriteUserById(targetUserId).catch(() => null) || appwriteUser;
    let onboardingEmail = { sent: false, skipped: true };
    if (input.onboardingDocument?.sendEmail === true) {
      const plan = selectedPlan;
      try {
        onboardingEmail = await dispatchPlanDocumentEmail({
          ...input.onboardingDocument,
          to: email,
          name: input.name || appwriteUser.name || email,
          planName: input.onboardingDocument.planName || plan.name,
          accessEmail: email,
          welcomeEmail: true,
          firstAccessUrl: ''
        });
        await appendSecurityEvent({
          type: 'document', action: 'user_onboarding_email_sent', actorUserId: auth.sub, actorEmail: auth.user?.email,
          targetUserId, targetEmail: email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok',
          message: `Usuário criado e comprovante enviado para ${email}.`,
          metadata: { planSlug: plan.slug, filename: onboardingEmail.filename, bytes: onboardingEmail.bytes, provider: onboardingEmail.provider, providerId: onboardingEmail.id }
        }).catch(() => null);
      } catch (error) {
        onboardingEmail = { sent: false, skipped: false, error: String(error?.message || 'Falha no envio do e-mail de boas-vindas.').slice(0, 500) };
        await appendSecurityEvent({
          type: 'document', action: 'user_onboarding_email_failed', actorUserId: auth.sub, actorEmail: auth.user?.email,
          targetUserId, targetEmail: email, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'failed',
          message: onboardingEmail.error,
          metadata: { planSlug: plan.slug, rolledBack: Boolean(appwriteUserCreatedNow || !recoveredExistingProfile) }
        }).catch(() => null);
        if (appwriteUserCreatedNow || !recoveredExistingProfile) {
          if (profile?.$id || profile?.id) await deleteRow('users_profile', profile.$id || profile.id).catch(() => null);
          if (appwriteUserCreatedNow) await deleteAppwriteUser(targetUserId).catch(() => null);
        }
        throw statusError(502, 'A conta não foi concluída porque o comprovante de contratação não pôde ser enviado. Verifique a Function de suporte e tente novamente.', {
          code: 'ONBOARDING_EMAIL_REQUIRED', email, providerError: onboardingEmail.error
        });
      }
    }
    const workspaceSetup = { requested: requestedWorkspaceMembers.length, created: [], failed: [], additionalMonthlyCents: 0 };
    for (const member of requestedWorkspaceMembers) {
      try {
        const created = await createWorkspaceMember({
          ownerUserId: targetUserId,
          input: { ...member, paidExtraSeat: member.paidExtraSeat },
          adminAuth: auth,
          request
        });
        workspaceSetup.created.push({
          id: created.user?.id || '',
          name: created.user?.name || member.name,
          email: created.user?.email || member.email,
          paidExtraSeat: Boolean(created.user?.paidExtraSeat),
          seatPriceCents: Number(created.user?.seatPriceCents || member.seatPriceCents || 0),
          welcomeEmail: created.welcomeEmail || { sent: false, skipped: true }
        });
      } catch (error) {
        workspaceSetup.failed.push({
          name: member.name,
          email: member.email,
          error: String(error?.message || 'Falha ao criar subusuário.').slice(0, 500),
          code: error?.code || error?.details?.code || ''
        });
      }
    }
    workspaceSetup.additionalMonthlyCents = workspaceSetup.created.reduce((sum, member) => sum + (member.paidExtraSeat ? Number(member.seatPriceCents || 0) : 0), 0);
    return send(response, request, existing ? 200 : 201, {
      ok: true,
      user: adminUserFromProfile(profile, refreshedUser),
      onboardingEmail,
      firstAccessRequired: false,
      passwordChangeRecommended: true,
      workspaceSetup
    });
  }

  const adminUserEmailMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/email$/);
  if (adminUserEmailMatch && ['POST', 'PATCH'].includes(httpMethod)) {
    requireAdminAccess(auth);
    const userId = decodeURIComponent(adminUserEmailMatch[1]);
    if (String(userId) === String(auth.sub || '')) throw statusError(409, 'Altere o e-mail da conta administrativa por um procedimento de segurança separado.', { code: 'ADMIN_SELF_EMAIL_CHANGE_BLOCKED' });
    const input = await bodyJson(request);
    const newEmail = normalizeEmail(input.email || input.newEmail);
    if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) throw statusError(400, 'Informe um novo e-mail válido.');

    const appwriteUser = await getAppwriteUserById(userId).catch(() => null);
    const existing = await findProfileForLogin(userId, appwriteUser?.email || '').catch(() => null)
      || await findProfileByUserId(userId).catch(() => null);
    if (!appwriteUser || !existing) throw statusError(404, 'A conta completa do usuário não foi encontrada. Corrija o cadastro antes de alterar o e-mail.');

    const oldEmail = normalizeEmail(appwriteUser.email || existing.email);
    if (newEmail === oldEmail) throw statusError(409, 'O novo e-mail é igual ao e-mail atual.');
    const duplicate = await getAppwriteUserByEmail(newEmail).catch(() => null);
    if (duplicate && String(duplicate.$id || duplicate.id) !== String(userId)) {
      throw statusError(409, 'Este e-mail já pertence a outra conta do Surveyor.', { code: 'EMAIL_ALREADY_IN_USE' });
    }

    const previousVerified = isEmailVerified(existing, appwriteUser);
    const requestedVerified = input.emailVerified !== false;
    let authEmailUpdated = false;
    try {
      await updateAppwriteUserEmail(userId, newEmail);
      authEmailUpdated = true;
      await updateAppwriteUserEmailVerification(userId, requestedVerified);
      const updatedAuthUser = { ...appwriteUser, email: newEmail, emailVerification: requestedVerified };
      await createOrUpdateAdminProfile({
        ...existing,
        userId,
        email: newEmail,
        emailVerified: requestedVerified,
        verificationRequired: !requestedVerified
      }, updatedAuthUser, existing);
      const emailChangedAt = new Date().toISOString();
      await updateAppwriteUserSurveyorPrefs(userId, {
        emailChangedAt,
        emailChangedFrom: oldEmail,
        emailChangedByAdminId: auth.sub || '',
        remoteLogoutAt: emailChangedAt,
        sessionVersion: appwriteId()
      }).catch(() => null);
    } catch (error) {
      if (authEmailUpdated) {
        await updateAppwriteUserEmail(userId, oldEmail).catch(() => null);
        await updateAppwriteUserEmailVerification(userId, previousVerified).catch(() => null);
        await createOrUpdateAdminProfile({ ...existing, userId, email: oldEmail, emailVerified: previousVerified }, { ...appwriteUser, email: oldEmail }, existing).catch(() => null);
      }
      throw statusError(error?.status || 500, 'Não foi possível concluir a alteração de e-mail. Nenhum dado do cliente foi removido.', { code: 'EMAIL_CHANGE_ROLLED_BACK', cause: String(error?.message || '') });
    }

    const notifications = {
      newEmail: { requested: input.notifyNewEmail !== false, sent: false },
      oldEmail: { requested: input.notifyOldEmail !== false, sent: false }
    };
    const notificationJobs = [];
    if (notifications.newEmail.requested) {
      notificationJobs.push((async () => {
        try { notifications.newEmail = await dispatchAccountEmailChangedEmail({ to: newEmail, name: existing.name || appwriteUser.name || newEmail, oldEmail, newEmail, audience: 'new' }); }
        catch (error) { notifications.newEmail.error = String(error?.message || 'Falha ao notificar o novo e-mail.').slice(0, 300); }
      })());
    }
    if (notifications.oldEmail.requested) {
      notificationJobs.push((async () => {
        try { notifications.oldEmail = await dispatchAccountEmailChangedEmail({ to: oldEmail, name: existing.name || appwriteUser.name || oldEmail, oldEmail, newEmail, audience: 'old' }); }
        catch (error) { notifications.oldEmail.error = String(error?.message || 'Falha ao notificar o e-mail anterior.').slice(0, 300); }
      })());
    }
    if (notificationJobs.length) await Promise.all(notificationJobs);

    const refreshedAuthUser = await getAppwriteUserById(userId).catch(() => ({ ...appwriteUser, email: newEmail, emailVerification: requestedVerified }));
    const refreshedProfile = await findProfileForLogin(userId, newEmail).catch(() => null) || { ...existing, email: newEmail, emailVerified: requestedVerified };
    await appendSecurityEvent({
      type: 'user', action: 'user_login_email_changed', actorUserId: auth.sub, actorEmail: auth.user?.email,
      targetUserId: userId, targetEmail: newEmail, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok',
      message: `E-mail de acesso alterado de ${oldEmail} para ${newEmail}, mantendo o mesmo usuário e todos os dados.`,
      metadata: { oldEmail, newEmail, emailVerified: requestedVerified, notifications: { newEmail: Boolean(notifications.newEmail.sent), oldEmail: Boolean(notifications.oldEmail.sent) } }
    }).catch(() => null);

    return send(response, request, 200, {
      ok: true,
      preservedUserId: userId,
      oldEmail,
      newEmail,
      emailVerified: requestedVerified,
      notifications,
      user: adminUserFromProfile(refreshedProfile, refreshedAuthUser)
    });
  }

  const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (adminUserMatch && httpMethod === 'PATCH') {
    requireAdminAccess(auth);
    const userId = decodeURIComponent(adminUserMatch[1]);
    const input = await bodyJson(request);
    const workspaceMembership = await findWorkspaceMembershipByUserId(userId).catch(() => null);
    if (workspaceMembership) throw statusError(409, 'Use o gerenciador de equipe para editar este subusuário.', { code: 'SUBUSER_MANAGED_BY_WORKSPACE' });

    const appwriteUser = await getAppwriteUserById(userId).catch(() => null);
    let existing = await findProfileForLogin(userId, appwriteUser?.email || '').catch(() => null)
      || await findProfileByUserId(userId).catch(() => null);

    if (!existing && !appwriteUser) throw statusError(404, 'Usuário não encontrado.');
    if (!appwriteUser) {
      throw statusError(409, 'O perfil existe, mas a conta de autenticação não foi encontrada. Exclua este registro incompleto e crie o usuário novamente.', {
        code: 'USER_AUTH_ACCOUNT_MISSING', canDeleteSafely: true
      });
    }

    const baseProfile = existing || {
      userId,
      email: normalizeEmail(appwriteUser.email),
      name: appwriteUser.name || appwriteUser.email || 'Usuário',
      role: 'user',
      plan: 'basic',
      status: appwriteUser.status === false ? 'blocked' : 'active',
      isActive: appwriteUser.status !== false,
      emailVerified: Boolean(appwriteUser.emailVerification),
      expiresAt: null
    };
    const requestedPlan = Object.prototype.hasOwnProperty.call(input, 'planSlug') || Object.prototype.hasOwnProperty.call(input, 'plan')
      ? await findPlanBySlugSafe(input.planSlug || input.plan)
      : null;
    if (requestedPlan && !workspacePlanAllowsMembers(requestedPlan)) {
      const linkedMembers = await listWorkspaceMembersByOwner(userId);
      if (linkedMembers.length) throw statusError(409, 'Remova todos os subusuários antes de alterar o titular para o plano Básico.', {
        code: 'WORKSPACE_DOWNGRADE_REQUIRES_MEMBER_REMOVAL', memberCount: linkedMembers.length
      });
    }
    if (input.name) await updateAppwriteUserName(userId, input.name);
    if (input.password) assertStrongPassword(input.password, 'A nova senha');
    if (input.emailVerified !== undefined) await updateAppwriteUserEmailVerification(userId, Boolean(input.emailVerified));
    if (input.status !== undefined) {
      const requestedStatus = String(input.status || 'active').toLowerCase();
      const requestedActive = requestedStatus === 'active';
      await updateAppwriteUserStatus(userId, requestedActive);
      if (!requestedActive) {
        await appendSecurityEvent({
          type: 'admin',
          action: 'user_blocked_sessions_revoked',
          actorUserId: auth.sub,
          actorEmail: auth.user?.email,
          targetUserId: userId,
          targetEmail: baseProfile.email || appwriteUser.email,
          ip: requestIp(request),
          userAgent: requestUserAgent(request),
          status: 'ok',
          message: 'Usuário bloqueado e sessões revogadas imediatamente.',
          metadata: { requestedStatus }
        }).catch(() => null);
      }
    }
    const contactChanged = Object.prototype.hasOwnProperty.call(input, 'whatsapp') || Object.prototype.hasOwnProperty.call(input, 'phone') || Object.prototype.hasOwnProperty.call(input, 'whatsappOptIn') || Object.prototype.hasOwnProperty.call(input, 'whatsappReminderDays');
    const currentContact = userContactMeta(baseProfile, appwriteUser);
    const normalizedWhatsapp = contactChanged ? normalizeBrazilPhone(input.whatsapp || input.phone || '') : currentContact.whatsapp;
    if (contactChanged && normalizedWhatsapp) await updateAppwriteUserPhone(userId, normalizedWhatsapp);
    if (input.status !== undefined || Object.prototype.hasOwnProperty.call(input, 'expiresAt') || contactChanged) {
      await updateAppwriteUserSurveyorPrefs(userId, {
        status: String(input.status || baseProfile.status || 'active').toLowerCase(),
        expiresAt: Object.prototype.hasOwnProperty.call(input, 'expiresAt') ? (input.expiresAt || null) : profileExpiresAt(baseProfile, appwriteUser),
        phone: normalizedWhatsapp,
        whatsapp: normalizedWhatsapp,
        whatsappOptIn: input.whatsappOptIn !== undefined ? Boolean(input.whatsappOptIn) : currentContact.whatsappOptIn,
        whatsappReminderDays: normalizeReminderDays(input.whatsappReminderDays || currentContact.whatsappReminderDays || [7, 1])
      }).catch(() => null);
    }

    if (Object.prototype.hasOwnProperty.call(input, 'allowedMemorialTemplateIds')) {
      const allowedMemorialTemplateIds = normalizeMemorialTemplateAccess(input.allowedMemorialTemplateIds);
      await updateAppwriteUserSurveyorPrefs(userId, { memorialTemplateAccess: allowedMemorialTemplateIds });
      appwriteUser.prefs = {
        ...(appwriteUser.prefs || {}),
        surveyor: { ...(appwriteUser.prefs?.surveyor || {}), memorialTemplateAccess: allowedMemorialTemplateIds }
      };
    }

    const profileFields = ['name', 'role', 'planSlug', 'plan', 'expiresAt', 'whatsapp', 'phone', 'password', 'allowedMemorialTemplateIds'];
    const shouldCompleteProfile = Boolean(existing) || profileFields.some((field) => Object.prototype.hasOwnProperty.call(input, field));
    const refreshedAppwriteUser = await getAppwriteUserById(userId).catch(() => null)
      || { ...appwriteUser, emailVerification: input.emailVerified !== undefined ? Boolean(input.emailVerified) : appwriteUser.emailVerification };

    if (!shouldCompleteProfile) {
      return send(response, request, 200, {
        ok: true,
        repaired: false,
        user: adminUserFromProfile(baseProfile, refreshedAppwriteUser, { profileMissing: true })
      });
    }

    const profile = await createOrUpdateAdminProfile({
      ...baseProfile,
      ...input,
      userId,
      email: normalizeEmail(baseProfile.email || appwriteUser.email)
    }, appwriteUser, existing);
    existing = profile;
    if (requestedPlan && workspacePlanAllowsMembers(requestedPlan)) await rebalanceWorkspaceSeatLicenses(userId, requestedPlan);

    let passwordUpdated = false;
    if (input.password) {
      try {
        await updateAppwriteUserPasswordStrict(userId, input.password);
        const passwordResetByAdminAt = new Date().toISOString();
        await updateAppwriteUserSurveyorPrefs(userId, {
          mustChangePassword: true,
          temporaryPasswordIssuedAt: passwordResetByAdminAt,
          passwordResetByAdminAt,
          remoteLogoutAt: passwordResetByAdminAt,
          sessionVersion: appwriteId()
        }).catch(() => null);
        passwordUpdated = true;
      } catch (error) {
        throw statusError(502, 'Os dados do usuário foram salvos, mas a senha não pôde ser alterada. Tente novamente usando somente o campo de senha.', {
          code: 'PASSWORD_UPDATE_FAILED_AFTER_PROFILE', cause: publicErrorMessage(error, 'Falha ao atualizar senha')
        });
      }
    }

    return send(response, request, 200, {
      ok: true,
      repaired: !Boolean(baseProfile.$id || baseProfile.id),
      passwordUpdated,
      user: adminUserFromProfile(profile, refreshedAppwriteUser)
    });
  }

  if (adminUserMatch && httpMethod === 'DELETE') {
    requireAdminAccess(auth);
    const userId = decodeURIComponent(adminUserMatch[1]);
    if (String(userId) === String(auth.sub || '')) {
      throw statusError(409, 'A conta administrativa em uso não pode ser excluída.', { code: 'ADMIN_SELF_DELETE_BLOCKED' });
    }

    const workspaceMembership = await findWorkspaceMembershipByUserId(userId).catch(() => null);
    if (workspaceMembership) {
      throw statusError(409, 'Este acesso pertence a uma equipe. Remova-o pelo gerenciador de equipe.', {
        code: 'SUBUSER_MANAGED_BY_WORKSPACE'
      });
    }

    const appwriteUser = await getAppwriteUserById(userId).catch(() => null);
    const profile = await findProfileForLogin(userId, appwriteUser?.email || '').catch(() => null)
      || await findProfileByUserId(userId).catch(() => null)
      || await getRow('users_profile', userId).catch(() => null);
    if (!appwriteUser && !profile) throw statusError(404, 'Usuário não encontrado.');

    const candidateUserIds = [
      userId,
      appwriteUser?.$id || appwriteUser?.id,
      profile?.userId
    ].map((value) => String(value || '').trim()).filter(Boolean);
    const ownerUserId = String(appwriteUser?.$id || appwriteUser?.id || profile?.userId || userId).trim();
    const impact = await userDeletionImpact(candidateUserIds, ownerUserId);

    if (impact.hasProtectedData) {
      const parts = [];
      if (impact.projects) parts.push(`${impact.projects} projeto(s)`);
      if (impact.documents) parts.push(`${impact.documents} documento(s)`);
      if (impact.teamMembers) parts.push(`${impact.teamMembers} membro(s) de equipe`);
      throw statusError(409, `Este usuário possui ${parts.join(', ')}. Para preservar os dados e o histórico, use o botão Bloquear.`, {
        code: 'USER_DELETE_HAS_PROTECTED_DATA',
        canBlock: true,
        impact
      });
    }

    const targetEmail = normalizeEmail(profile?.email || appwriteUser?.email || '');
    const deletedCustomizations = await deleteUserCustomizations(candidateUserIds);

    if (profile?.$id || profile?.id) await deleteRow('users_profile', profile.$id || profile.id);
    if (appwriteUser) await deleteAppwriteUser(appwriteUser.$id || appwriteUser.id || userId);

    const wasComplete = Boolean(appwriteUser && profile);
    const deletionMode = wasComplete ? 'complete_without_data' : 'incomplete';
    await appendSecurityEvent({
      type: 'user',
      action: wasComplete ? 'user_deleted_without_data' : 'incomplete_user_deleted',
      actorUserId: auth.sub,
      actorEmail: auth.user?.email,
      targetUserId: ownerUserId,
      targetEmail,
      ip: requestIp(request),
      userAgent: requestUserAgent(request),
      status: 'ok',
      message: wasComplete
        ? 'Usuário sem projetos, documentos ou equipe removido definitivamente.'
        : 'Cadastro incompleto removido com segurança.',
      metadata: {
        removedAuthAccount: Boolean(appwriteUser),
        removedProfile: Boolean(profile),
        deletedCustomizations,
        impact
      }
    }).catch(() => null);

    return send(response, request, 200, {
      ok: true,
      deleted: true,
      deletionMode,
      userId: ownerUserId,
      email: targetEmail,
      deletedCustomizations
    });
  }

  const adminUserVerificationMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/verification$/);
  if (adminUserVerificationMatch && httpMethod === 'PATCH') {
    requireAdminAccess(auth);
    const userId = decodeURIComponent(adminUserVerificationMatch[1]);
    const input = await bodyJson(request);
    const emailVerified = input.emailVerified !== false && input.verified !== false;
    const appwriteUser = await getAppwriteUserById(userId).catch(() => null);
    const existing = await findProfileForLogin(userId, appwriteUser?.email || '').catch(() => null)
      || await findProfileByUserId(userId).catch(() => null);
    if (!appwriteUser && !existing) throw statusError(404, 'Usuário não encontrado.');
    if (!appwriteUser) {
      throw statusError(409, 'A conta de autenticação deste perfil não existe. Exclua o registro incompleto e crie o usuário novamente.', {
        code: 'USER_AUTH_ACCOUNT_MISSING', canDeleteSafely: true
      });
    }
    await updateAppwriteUserEmailVerification(userId, emailVerified);
    const refreshedAppwriteUser = { ...appwriteUser, emailVerification: emailVerified };
    if (!existing) {
      const baseProfile = {
        userId,
        email: normalizeEmail(appwriteUser.email),
        name: appwriteUser.name || appwriteUser.email || 'Usuário',
        role: 'user',
        plan: 'basic',
        status: appwriteUser.status === false ? 'blocked' : 'active',
        emailVerified
      };
      return send(response, request, 200, {
        ok: true,
        user: adminUserFromProfile(baseProfile, refreshedAppwriteUser, { profileMissing: true })
      });
    }
    const profile = await createOrUpdateAdminProfile({ ...existing, email: existing.email, emailVerified }, appwriteUser, existing);
    return send(response, request, 200, { ok: true, user: adminUserFromProfile(profile, refreshedAppwriteUser) });
  }

  const geobahiaSeedPaths = new Set([
    '/api/admin/layers/seed/geobahia-official',
    '/api/admin/layers/seed/geobahia',
    '/api/admin/layers/corrigir-geobahia',
    '/api/admin/layers/fix-geobahia'
  ]);
  if (geobahiaSeedPaths.has(path) && ['POST', 'GET'].includes(httpMethod)) {
    requireAdminAccess(auth);
    const result = await seedGeobahiaOfficialLayers();
    return send(response, request, 200, { ok: true, ...result });
  }

  if (path === '/api/admin/layers/test-url' && httpMethod === 'POST') {
    requireAdminAccess(auth);
    return send(response, request, 200, { ok: true, detection: remoteLayerDetection(await bodyJson(request)) });
  }

  if ((path === '/api/admin/layers' || path === '/api/admin/layers/') && httpMethod === 'GET') {
    requireAdminAccess(auth);
    return send(response, request, 200, { ok: true, layers: await listAdminLayersSafe() });
  }

  if ((path === '/api/admin/layers' || path === '/api/admin/layers/') && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const input = await bodyJson(request);
    const row = await createRow('layers', layerData(input));
    return send(response, request, 201, { ok: true, layer: mapLayer(row) });
  }

  const adminLayerMatch = path.match(/^\/api\/admin\/layers\/([^/]+)(?:\/(data|publish|remote-import|spatial-index|source-upload|large-data)(?:\/.*)?)?$/);
  if (adminLayerMatch) {
    requireAdminAccess(auth);
    const layerId = decodeURIComponent(adminLayerMatch[1]);
    const action = adminLayerMatch[2] || '';
    const current = await getRow('layers', layerId).catch(() => null);
    if (!current) throw statusError(404, 'Camada não encontrada.');

    if (!action && httpMethod === 'PATCH') {
      const row = await updateRow('layers', layerId, layerData(await bodyJson(request), current));
      return send(response, request, 200, { ok: true, layer: mapLayer(row) });
    }
    if (!action && httpMethod === 'DELETE') {
      const row = await updateRow('layers', layerId, { status: 'archived', updatedAt: new Date().toISOString() });
      return send(response, request, 200, { ok: true, layer: mapLayer(row) });
    }
    if (action === 'publish' && httpMethod === 'PATCH') {
      const input = await bodyJson(request);
      const published = Boolean(input.published);
      const row = await updateRow('layers', layerId, { isPublic: published, status: published ? 'ready' : 'draft', updatedAt: new Date().toISOString() });
      return send(response, request, 200, { ok: true, layer: mapLayer(row) });
    }
    if (action === 'data' && httpMethod === 'PUT') {
      const input = await bodyJson(request);
      const geojson = input.geojson || { type: 'FeatureCollection', features: [] };
      const content = JSON.stringify(geojson);
      const oldBucket = current.dataBucketId || bucketId('project_files');
      const targetBucket = bucketId('project_files');
      const file = await createFile(targetBucket, `${layerId}.geojson`, content, 'application/geo+json');
      const newFileId = file.$id || file.id;
      const verification = await readFileText(targetBucket, newFileId).catch(() => '');
      if (verification !== content) {
        await deleteFile(targetBucket, newFileId).catch(() => null);
        throw statusError(502, 'A nova versão da camada não pôde ser verificada. A versão anterior foi preservada.', { code: 'LAYER_FILE_VERIFICATION_FAILED' });
      }
      const featureCount = Array.isArray(geojson.features) ? geojson.features.length : 0;
      let row;
      try {
        row = await updateRow('layers', layerId, { dataFileId: newFileId, dataBucketId: targetBucket, dataAvailable: true, dataSizeBytes: Buffer.byteLength(content), featureCount, status: 'ready', updatedAt: new Date().toISOString() });
      } catch (error) {
        await deleteFile(targetBucket, newFileId).catch(() => null);
        throw error;
      }
      if (current.dataFileId && current.dataFileId !== newFileId) {
        await deleteFile(oldBucket, current.dataFileId).catch((error) => console.warn('[storage] arquivo anterior da camada pendente de limpeza:', error?.message || error));
      }
      return send(response, request, 200, { ok: true, layer: mapLayer(row) });
    }
    if (action === 'source-upload') {
      const subPath = path.split(`/api/admin/layers/${encodeURIComponent(layerId)}/source-upload`)[1] || '';
      const { metadata, upload } = layerUploadState(current);
      const now = new Date().toISOString();

      if (httpMethod === 'POST' && subPath === '/process') {
        const active = upload || {};
        const sourceFileId = active.sourceFileId || metadata.sourceFileId || current.sourceFileId;
        const sourceBucketId = active.sourceBucketId || bucketId('project_files');
        const originalFileName = String(active.originalFileName || 'camada.zip');
        const totalBytes = Number(active.totalBytes || 0);
        if (!sourceFileId) throw statusError(409, 'Nenhum ZIP recebido para processar. Envie o arquivo novamente.');
        if (['ready'].includes(String(active.status || ''))) return send(response, request, 200, { ok: true, alreadyReady: true, upload: active, layer: mapLayer(current) });
        const processing = {
          ...active,
          status: 'processing',
          progress: Math.max(40, Number(active.progress || 0)),
          message: 'Processando ZIP na GeoServices...',
          processingStartedAt: now,
          updatedAt: now
        };
        await patchLayerMetadata(layerId, current, { sourceUpload: processing }, { status: 'processing' });
        try {
          const result = await callGeoservicesImport({
            layerId,
            bucketId: sourceBucketId,
            databaseId: databaseId(),
            collectionId: collectionId('layers'),
            sourceFileId,
            originalFileName,
            originalBytes: totalBytes,
            requestedAt: now
          });
          const refreshed = await getRow('layers', layerId).catch(() => current);
          return send(response, request, 200, { ok: true, upload: layerUploadState(refreshed).upload || processing, geoservices: result, layer: mapLayer(refreshed) });
        } catch (err) {
          const failed = { ...processing, status: 'error', progress: Number(processing.progress || 40), message: 'Falha ao iniciar/processar na GeoServices.', error: err.message || String(err), updatedAt: new Date().toISOString() };
          const row = await patchLayerMetadata(layerId, current, { sourceUpload: failed }, { status: 'error' });
          throw statusError(err.status || 502, failed.error, { geoservices: err.details || null, layer: mapLayer(row) });
        }
      }

      if (httpMethod === 'POST' && subPath === '/prepare-public') {
        const input = await bodyJson(request);
        const totalBytes = Number(input.totalBytes || 0);
        const originalFileName = String(input.originalFileName || 'camada.zip').slice(0, 240);
        if (!totalBytes) throw statusError(400, 'Tamanho do ZIP não informado.');
        if (totalBytes > Number(env('LAYER_SOURCE_UPLOAD_DIRECT_MAX_BYTES', String(16 * 1024 * 1024)))) throw statusError(413, 'Use envio em blocos para ZIP acima do limite direto.');
        if (totalBytes > Number(env('LAYER_SOURCE_UPLOAD_MAX_BYTES', String(64 * 1024 * 1024)))) throw statusError(413, 'ZIP maior que o limite configurado.');
        const uploadId = appwriteId();
        const publicUploadToken = signJwt({
          type: 'layer-source-upload',
          layerId,
          uploadId,
          totalBytes,
          originalFileName
        }, Number(env('LAYER_SOURCE_UPLOAD_PUBLIC_TOKEN_TTL', '1800')) || 1800);
        const nowPrepare = new Date().toISOString();
        const prepared = {
          id: uploadId,
          status: 'awaiting_public_upload',
          progress: 1,
          message: 'Upload público assinado preparado. Envie o ZIP pequeno agora.',
          originalFileName,
          totalBytes,
          chunkCount: 1,
          direct: true,
          publicUpload: true,
          publicUploadToken,
          preparedAt: nowPrepare,
          updatedAt: nowPrepare
        };
        await patchLayerMetadata(layerId, current, { sourceUpload: prepared }, { status: 'processing' });
        return send(response, request, 200, {
          ok: true,
          upload: { ...prepared, publicUploadToken: undefined },
          uploadUrl: `/api/public/layer-source-upload/${encodeURIComponent(publicUploadToken)}`,
          expiresIn: Number(env('LAYER_SOURCE_UPLOAD_PUBLIC_TOKEN_TTL', '1800')) || 1800
        });
      }

      if (httpMethod === 'POST' && subPath === '/direct') {
        const input = await bodyJson(request);
        const totalBytes = Number(input.totalBytes || 0);
        const originalFileName = String(input.originalFileName || 'camada.zip').slice(0, 240);
        const contentBase64 = String(input.contentBase64 || input.base64 || '').replace(/^data:.*?;base64,/, '');
        if (!totalBytes) throw statusError(400, 'Tamanho do ZIP não informado.');
        if (!contentBase64) throw statusError(400, 'Conteúdo do ZIP não informado.');
        if (totalBytes > Number(env('LAYER_SOURCE_UPLOAD_DIRECT_MAX_BYTES', String(16 * 1024 * 1024)))) throw statusError(413, 'Use envio em blocos para ZIP acima do limite direto.');
        if (totalBytes > Number(env('LAYER_SOURCE_UPLOAD_MAX_BYTES', String(64 * 1024 * 1024)))) throw statusError(413, 'ZIP maior que o limite configurado.');
        let buffer;
        try {
          buffer = Buffer.from(contentBase64, 'base64');
        } catch {
          throw statusError(400, 'Base64 do ZIP inválido.');
        }
        if (!buffer.length) throw statusError(400, 'ZIP vazio recebido pela API.');
        if (Math.abs(buffer.length - totalBytes) > 8) throw statusError(400, `Tamanho recebido (${buffer.length}) diferente do informado (${totalBytes}).`);
        const uploadId = appwriteId();
        const sourceFile = await createFile(bucketId('project_files'), `layer-source-${layerId}-${uploadId}.zip`, buffer, 'application/zip');
        const sourceFileId = sourceFile.$id || sourceFile.id;
        const queued = {
          id: uploadId,
          status: 'queued',
          progress: 34,
          message: 'ZIP recebido em envio direto. Enviando para a GeoServices processar...',
          originalFileName,
          totalBytes,
          chunkCount: 1,
          direct: true,
          sourceFileId,
          sourceBucketId: bucketId('project_files'),
          startedAt: now,
          queuedAt: now,
          updatedAt: now
        };
        await patchLayerMetadata(layerId, current, { sourceUpload: queued }, { status: 'processing' });
        try {
          const result = await callGeoservicesImport({
            layerId,
            bucketId: bucketId('project_files'),
            databaseId: databaseId(),
            collectionId: collectionId('layers'),
            sourceFileId,
            originalFileName,
            originalBytes: totalBytes,
            requestedAt: now
          });
          const refreshed = await getRow('layers', layerId).catch(() => current);
          return send(response, request, 200, { ok: true, upload: layerUploadState(refreshed).upload || queued, geoservices: result, layer: mapLayer(refreshed) });
        } catch (err) {
          const failed = { ...queued, status: 'error', progress: 34, message: 'Falha ao iniciar/processar na GeoServices.', error: err.message || String(err), updatedAt: new Date().toISOString() };
          const row = await patchLayerMetadata(layerId, current, { sourceUpload: failed }, { status: 'error' });
          throw statusError(err.status || 502, failed.error, { geoservices: err.details || null, layer: mapLayer(row) });
        }
      }

      if (httpMethod === 'POST' && subPath === '/start') {
        const input = await bodyJson(request);
        const totalBytes = Number(input.totalBytes || 0);
        const chunkCount = Math.max(1, Number(input.chunkCount || 1));
        if (!totalBytes) throw statusError(400, 'Tamanho do ZIP não informado.');
        if (totalBytes > Number(env('LAYER_SOURCE_UPLOAD_MAX_BYTES', String(64 * 1024 * 1024)))) throw statusError(413, 'ZIP maior que o limite configurado.');
        const nextUpload = {
          id: appwriteId(),
          status: 'uploading',
          progress: 1,
          message: 'Recebendo ZIP em blocos...',
          originalFileName: String(input.originalFileName || 'camada.zip').slice(0, 240),
          totalBytes,
          chunkCount,
          chunks: [],
          startedAt: now,
          updatedAt: now
        };
        const row = await patchLayerMetadata(layerId, current, { sourceUpload: nextUpload }, { status: 'processing' });
        return send(response, request, 200, { ok: true, upload: nextUpload, layer: mapLayer(row) });
      }

      const chunkMatch = subPath.match(/^\/chunks\/(\d+)$/);
      if (httpMethod === 'PUT' && chunkMatch) {
        if (!upload || upload.status !== 'uploading') throw statusError(409, 'Upload não iniciado ou já finalizado.');
        const index = Number(chunkMatch[1]);
        if (!Number.isInteger(index) || index < 0 || index >= Number(upload.chunkCount || 0)) throw statusError(400, 'Índice de bloco inválido.');
        const buffer = requestBodyBuffer(request);
        if (!buffer.length) throw statusError(400, 'Bloco vazio recebido pela API.');
        const oldChunk = upload.chunks?.[index];
        if (oldChunk?.fileId) await deleteFile(bucketId('project_files'), oldChunk.fileId).catch(() => {});
        const file = await createFile(bucketId('project_files'), `layer-source-${layerId}-${upload.id}-${index}.part`, buffer, 'application/octet-stream');
        const chunks = Array.from({ length: Number(upload.chunkCount || 0) }, (_, i) => upload.chunks?.[i] || null);
        chunks[index] = { index, fileId: file.$id || file.id, bucketId: bucketId('project_files'), size: buffer.length, uploadedAt: now };
        const uploadedCount = chunks.filter(Boolean).length;
        const nextUpload = {
          ...upload,
          status: 'uploading',
          progress: Math.max(2, Math.min(30, Math.round((uploadedCount / Math.max(1, Number(upload.chunkCount || 1))) * 30))),
          message: `Recebidos ${uploadedCount} de ${upload.chunkCount} blocos do ZIP...`,
          chunks,
          updatedAt: now
        };
        const row = await patchLayerMetadata(layerId, current, { sourceUpload: nextUpload }, { status: 'processing' });
        return send(response, request, 200, { ok: true, upload: nextUpload, layer: mapLayer(row) });
      }

      if (httpMethod === 'POST' && subPath === '/complete') {
        if (!upload || !['uploading', 'queued', 'processing'].includes(upload.status)) throw statusError(409, 'Upload não encontrado para conclusão.');
        const chunks = Array.isArray(upload.chunks) ? upload.chunks : [];
        const missing = [];
        for (let i = 0; i < Number(upload.chunkCount || 0); i += 1) if (!chunks[i]?.fileId) missing.push(i);
        if (missing.length) throw statusError(400, `Ainda faltam blocos do ZIP: ${missing.slice(0, 8).join(', ')}.`);
        const queued = { ...upload, status: 'queued', progress: 34, message: 'ZIP completo. Enviando para a GeoServices processar...', queuedAt: now, updatedAt: now };
        await patchLayerMetadata(layerId, current, { sourceUpload: queued }, { status: 'processing' });
        try {
          const result = await callGeoservicesImport({
            layerId,
            bucketId: bucketId('project_files'),
            databaseId: databaseId(),
            collectionId: collectionId('layers'),
            chunkFileIds: chunks.map((chunk) => chunk.fileId),
            chunks,
            originalFileName: upload.originalFileName,
            originalBytes: Number(upload.totalBytes || 0),
            requestedAt: now
          });
          const refreshed = await getRow('layers', layerId).catch(() => current);
          return send(response, request, 200, { ok: true, upload: layerUploadState(refreshed).upload || queued, geoservices: result, layer: mapLayer(refreshed) });
        } catch (err) {
          const failed = { ...queued, status: 'error', progress: 34, message: 'Falha ao iniciar/processar na GeoServices.', error: err.message || String(err), updatedAt: new Date().toISOString() };
          const row = await patchLayerMetadata(layerId, current, { sourceUpload: failed }, { status: 'error' });
          throw statusError(err.status || 502, failed.error, { geoservices: err.details || null, layer: mapLayer(row) });
        }
      }

      if (httpMethod === 'GET' && subPath === '/status') {
        return send(response, request, 200, { ok: true, upload: upload || { status: current.status || 'draft', progress: current.dataAvailable ? 100 : 0, message: current.dataAvailable ? 'Camada pronta.' : 'Nenhum upload ativo.' }, layer: mapLayer(current) });
      }

      if (httpMethod === 'DELETE' && (subPath === '' || subPath === '/')) {
        if (upload?.chunks) {
          for (const chunk of upload.chunks) if (chunk?.fileId) await deleteFile(chunk.bucketId || bucketId('project_files'), chunk.fileId).catch(() => {});
        }
        const cancelled = { ...(upload || {}), status: 'cancelled', progress: 0, message: 'Importação cancelada.', updatedAt: now };
        const row = await patchLayerMetadata(layerId, current, { sourceUpload: cancelled }, { status: 'draft' });
        return send(response, request, 200, { ok: true, upload: cancelled, layer: mapLayer(row) });
      }
    }

    if (['remote-import', 'spatial-index', 'large-data'].includes(action)) {
      return send(response, request, 200, { ok: true, import: { status: 'ready', progress: 100, message: 'Operação registrada em modo Appwrite leve.' }, upload: { status: 'ready', progress: 100 }, layer: mapLayer(current) });
    }
  }

  const adminLayerGroupPublishMatch = path.match(/^\/api\/admin\/layer-groups\/([^/]+)\/publish$/);
  if (adminLayerGroupPublishMatch && httpMethod === 'PATCH') {
    requireAdminAccess(auth);
    const groupId = decodeURIComponent(adminLayerGroupPublishMatch[1]);
    const input = await bodyJson(request);
    const published = Boolean(input.published);
    const currentGroup = await getRow('layer_groups', groupId).catch(() => null);
    if (!currentGroup) throw statusError(404, 'Grupo de camadas não encontrado.');
    const groupRow = await updateRow('layer_groups', groupId, { status: published ? 'active' : 'unpublished', updatedAt: new Date().toISOString() });
    const rows = await listRows('layers', [Query.equal('groupId', groupId), Query.limit(500)]).catch(() => []);
    let updatedLayers = 0;
    for (const layer of rows) {
      if (String(layer.status || '') === 'archived') continue;
      const canPublish = Boolean(layer.dataAvailable || layer.dataFileId || layer.serviceUrl);
      await updateRow('layers', layer.$id || layer.id, {
        isPublic: published ? canPublish : false,
        status: published ? (canPublish ? 'ready' : 'draft') : 'draft',
        updatedAt: new Date().toISOString()
      });
      updatedLayers += 1;
    }
    await appendSecurityEvent({ type: 'layer', action: published ? 'layer_group_published' : 'layer_group_unpublished', actorUserId: auth.sub, actorEmail: auth.user?.email, target: groupId, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', message: `${published ? 'Publicou' : 'Despublicou'} o grupo ${currentGroup.name || groupId} e ${updatedLayers} camada(s).` });
    return send(response, request, 200, { ok: true, published, updatedLayers, group: mapLayerGroup(groupRow) });
  }

  if ((path === '/api/admin/layer-groups' || path === '/api/admin/layer-groups/') && httpMethod === 'GET') {
    requireAdminAccess(auth);
    return send(response, request, 200, { ok: true, groups: await listAdminLayerGroupsSafe() });
  }

  if ((path === '/api/admin/layer-groups' || path === '/api/admin/layer-groups/') && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const row = await createRow('layer_groups', layerGroupData(await bodyJson(request)));
    return send(response, request, 201, { ok: true, group: mapLayerGroup(row) });
  }






  if ((path === '/api/admin/notices' || path === '/api/admin/system-notices' || path === '/api/system/admin/notices') && httpMethod === 'GET') {
    requireAdminAccess(auth);
    const notices = await readSystemNotices();
    return send(response, request, 200, { ok: true, notices });
  }

  if ((path === '/api/admin/notices' || path === '/api/admin/system-notices' || path === '/api/system/admin/notices') && httpMethod === 'POST') {
    requireAdminAccess(auth);
    const notice = await createSystemNoticeFromAdmin(await bodyJson(request), auth);
    return send(response, request, 201, { ok: true, notice });
  }

  const adminNoticeHardDeleteMatch = path.match(/^\/api\/(?:admin\/(?:notices|system-notices)|system\/admin\/notices)\/([^/]+)\/(?:hard-delete|delete|permanent)$/);
  if (adminNoticeHardDeleteMatch && httpMethod === 'DELETE') {
    requireAdminAccess(auth);
    await deleteSystemNoticeFromAdmin(decodeURIComponent(adminNoticeHardDeleteMatch[1]));
    return send(response, request, 204, null);
  }

  const adminNoticeMatch = path.match(/^\/api\/(?:admin\/(?:notices|system-notices)|system\/admin\/notices)\/([^/]+)$/);
  if (adminNoticeMatch && httpMethod === 'PATCH') {
    requireAdminAccess(auth);
    const notice = await updateSystemNoticeFromAdmin(decodeURIComponent(adminNoticeMatch[1]), await bodyJson(request));
    return send(response, request, 200, { ok: true, notice });
  }

  if (adminNoticeMatch && httpMethod === 'DELETE') {
    requireAdminAccess(auth);
    const hardDelete = ['1', 'true', 'yes', 'permanent'].includes(String(url.searchParams.get('hard') || url.searchParams.get('permanent') || '').toLowerCase());
    if (hardDelete) await deleteSystemNoticeFromAdmin(decodeURIComponent(adminNoticeMatch[1]));
    else await archiveSystemNoticeFromAdmin(decodeURIComponent(adminNoticeMatch[1]));
    return send(response, request, 204, null);
  }

  if (path === '/api/projects' && httpMethod === 'GET') {
    requirePermission(auth, 'projects:view-own');
    const ownerUserId = resourceOwnerId(auth);
    const rows = await listAllRows('projects', [Query.equal('userId', ownerUserId)]);
    const projects = [];
    for (const row of rows.filter((item) => item.status !== 'deleted')) {
      let payload = {};
      try { payload = await readProjectPayload(row); } catch (error) { console.warn('[projects] resumo sem payload completo:', row.$id || row.id, error?.message || error); }
      const mapped = mapStoredProject(row, payload);
      projects.push({
        ...mapped,
        featureCount: Array.isArray(payload?.features) ? payload.features.length : Number(mapped.metadata?.featureCount || 0)
      });
    }

    // Projetos da equipe compartilham o mesmo owner, mas preservam quem realmente os criou.
    // Em projetos legados/migrados, o nome pode não existir no metadata. Resolve o nome
    // pelo userId do criador sem expor outros dados da conta.
    const authorIds = [...new Set(projects.map((project) => String(
      project.createdByUserId
      || project.metadata?.createdByUserId
      || project.metadata?.migratedFromStandaloneUserId
      || project.ownerUserId
      || ''
    ).trim()).filter(Boolean))];
    const authorNames = new Map();
    await Promise.all(authorIds.map(async (userId) => {
      const appwriteUser = await getAppwriteUserById(userId).catch(() => null);
      if (!appwriteUser) return;
      const name = String(appwriteUser.name || '').trim();
      if (name) authorNames.set(userId, name);
    }));

    for (const project of projects) {
      const creatorId = String(
        project.createdByUserId
        || project.metadata?.createdByUserId
        || project.metadata?.migratedFromStandaloneUserId
        || project.ownerUserId
        || ''
      ).trim();
      const creatorName = String(project.createdByName || project.metadata?.createdByName || authorNames.get(creatorId) || '').trim();
      project.createdByUserId = creatorId;
      project.createdByName = creatorName || (creatorId === String(auth.sub || '') ? String(auth.user?.name || '').trim() : '');
      project.metadata = {
        ...(project.metadata || {}),
        createdByUserId: creatorId,
        ...(project.createdByName ? { createdByName: project.createdByName } : {})
      };
    }

    projects.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return send(response, request, 200, { ok: true, projects });
  }

  if (path === '/api/projects' && httpMethod === 'POST') {
    requirePermission(auth, 'projects:create');
    assertWorkspaceActionAllowed(auth, 'project:create');
    const body = await bodyJson(request);
    const rawInput = body.project && typeof body.project === 'object' ? body.project : body;
    const input = sanitizeProjectClientInput(rawInput, 'draft');
    const featuresInput = Array.isArray(body.features) ? body.features : [];
    const now = new Date().toISOString();
    const rowId = appwriteId();
    const projectMetadata = {
      ...(input.metadata || {}),
      createdByUserId: auth.sub,
      createdByName: auth.user?.name || '',
      storageOwnerUserId: resourceOwnerId(auth),
      workspaceOwnerUserId: resourceOwnerId(auth),
      clientRequestId: String(headerValue(request, 'idempotency-key') || input.clientRequestId || '').slice(0, 120)
    };
    const features = featuresInput.map((feature, index) => ({
      ...feature,
      id: feature.id || appwriteId(),
      sortOrder: feature.sortOrder ?? index,
      createdAt: feature.createdAt || now,
      updatedAt: now
    }));
    assertValidProjectFeatures(features);
    const payload = { project: { ...input, metadata: projectMetadata }, metadata: projectMetadata, features, createdAt: now, updatedAt: now };
    const content = encryptJsonText(payload, { aad: 'project-payload' });
    await assertProjectCapacity(auth, 1);
    await assertStorageCapacity(auth, Buffer.byteLength(content, 'utf8'), 0, { resourceStorageOwnerUserId: resourceOwnerId(auth) });
    const file = await createFile(bucketId('project_files'), `${rowId}.json`, content, 'application/json');
    const fileId = file.$id || file.id;
    const verification = await readFileText(bucketId('project_files'), fileId).catch(() => '');
    if (verification !== content) {
      await deleteFile(bucketId('project_files'), fileId).catch(() => null);
      throw statusError(502, 'O projeto recém-criado não pôde ser verificado no Storage.', { code: 'PROJECT_CREATE_VERIFICATION_FAILED' });
    }
    let row;
    try {
      row = await createRow('projects', projectData({ ...input, metadata: projectMetadata }, resourceOwnerId(auth), now, fileId), rowId);
    } catch (error) {
      await deleteFile(bucketId('project_files'), fileId).catch(() => null);
      throw error;
    }
    await appendSecurityEvent({ type: 'project', action: 'project_created', actorUserId: auth.sub, actorEmail: auth.user?.email, target: rowId, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', metadata: { projectId: rowId, projectName: input.propertyName || input.name || 'Projeto', workspaceOwnerUserId: resourceOwnerId(auth) } }).catch(() => null);
    return send(response, request, 201, { ok: true, project: mapStoredProject(row, payload), features: features.map((feature) => mapFeature(feature, rowId, resourceOwnerId(auth))) });
  }


  if (path === '/api/projects/trash' && httpMethod === 'GET') {
    requirePermission(auth, 'projects:trash', 'Seu plano não permite acessar a lixeira de projetos.');
    const ownerUserId = resourceOwnerId(auth);
    const rows = await listAllRows('projects', [Query.equal('userId', ownerUserId)]);
    const deletedRows = rows.filter((item) => String(item.status || '').toLowerCase() === 'deleted');
    const projects = [];
    for (const row of deletedRows) {
      let payload = {};
      try { payload = await readProjectPayload(row); } catch {}
      projects.push(mapStoredProject(row, payload));
    }
    projects.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return send(response, request, 200, { ok: true, projects });
  }

  const restoreProjectMatch = path.match(/^\/api\/projects\/([^/]+)\/restore$/);
  if (restoreProjectMatch && httpMethod === 'POST') {
    requirePermission(auth, 'projects:trash', 'Seu plano não permite restaurar projetos da lixeira.');
    assertWorkspaceActionAllowed(auth, 'project:edit');
    const projectIdValue = decodeURIComponent(restoreProjectMatch[1]);
    const row = await getRow('projects', projectIdValue);
    if (!row || row.userId !== resourceOwnerId(auth) || String(row.status || '').toLowerCase() !== 'deleted') {
      throw statusError(404, 'Projeto não encontrado na lixeira.');
    }
    const now = new Date().toISOString();
    const restored = await updateRow('projects', projectIdValue, { status: 'draft', updatedAt: now });
    let payload = {};
    try { payload = await readProjectPayload(restored); } catch {}
    await appendSecurityEvent({ type: 'project', action: 'project_restored', actorUserId: auth.sub, actorEmail: auth.user?.email, target: projectIdValue, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', metadata: { projectId: projectIdValue, workspaceOwnerUserId: resourceOwnerId(auth) } }).catch(() => null);
    return send(response, request, 200, { ok: true, project: mapStoredProject(restored, payload) });
  }

  const projectMatch = path.match(/^\/api\/projects\/([^/]+)(?:\/(bundle|features|share|versions|duplicate|lock|export))?$/);
  if (projectMatch) {
    const projectIdValue = decodeURIComponent(projectMatch[1]);
    const subRoute = projectMatch[2] || '';
    const row = await getRow('projects', projectIdValue);
    if (!row || row.userId !== resourceOwnerId(auth) || row.status === 'deleted') throw statusError(404, 'Projeto não encontrado.');

    if (!subRoute && httpMethod === 'GET') {
      requirePermission(auth, 'projects:view-own');
      const payload = await readProjectPayload(row);
      const project = mapStoredProject(row, payload);
      const features = Array.isArray(payload.features) ? payload.features.map((item) => mapFeature(item, project.id, resourceOwnerId(auth))) : [];
      await appendSecurityEvent({ type: 'project', action: 'project_opened', actorUserId: auth.sub, actorEmail: auth.user?.email, target: projectIdValue, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', metadata: { projectId: projectIdValue, projectName: project.propertyName || project.name || 'Projeto', workspaceOwnerUserId: resourceOwnerId(auth) } }).catch(() => null);
      return send(response, request, 200, { ok: true, project, features });
    }

    if (subRoute === 'bundle' && ['PUT', 'PATCH'].includes(httpMethod)) {
      requirePermission(auth, 'projects:edit-own');
      assertWorkspaceActionAllowed(auth, 'project:edit');
      const input = await bodyJson(request);
      assertRevisionMatches(row, request, { ...(input.project || {}), ...input }, true);
      const currentPayload = await readProjectPayload(row);
      const currentMetadata = currentPayload.metadata && typeof currentPayload.metadata === 'object' ? currentPayload.metadata : {};
      if (currentMetadata.projectLocked) throw statusError(423, 'Projeto travado. Destrave antes de alterar.', { code: 'PROJECT_LOCKED' });
      const now = new Date().toISOString();
      const rawIncomingProject = input.project && typeof input.project === 'object' ? input.project : {};
      const incomingProject = sanitizeProjectClientInput(rawIncomingProject, row.status || 'draft');
      const incomingFeatures = Array.isArray(input.features) ? input.features : (Array.isArray(currentPayload.features) ? currentPayload.features : []);
      const version = await stageProjectVersionSnapshot(row, currentPayload, 'bundle', auth);
      const existingVersions = Array.isArray(currentMetadata.versions) ? currentMetadata.versions : [];
      const retention = projectVersionRetention();
      const combinedVersions = [...existingVersions, version];
      const expiredVersions = combinedVersions.slice(0, Math.max(0, combinedVersions.length - retention));
      const keptVersions = combinedVersions.slice(-retention);
      const mergedMetadata = {
        ...currentMetadata,
        ...(currentPayload.project?.metadata || {}),
        ...(incomingProject.metadata || {}),
        versions: keptVersions,
        lastSavedByUserId: auth.sub,
        lastSavedByName: auth.user?.name || '',
        lastSavedAt: now
      };
      const mergedProject = { ...(currentPayload.project || {}), ...incomingProject, metadata: mergedMetadata };
      const features = incomingFeatures.map((feature, index) => ({
        ...feature,
        id: feature.id || appwriteId(),
        sortOrder: feature.sortOrder ?? index,
        createdAt: feature.createdAt || now,
        updatedAt: now
      }));
      assertValidProjectFeatures(features);
      const update = projectData(mergedProject, resourceOwnerId(auth), now, '', row);
      delete update.createdAt;
      delete update.geojsonFileId;
      update.updatedAt = now;
      let saved;
      try {
        ({ saved } = await commitProjectPayload(row, { ...currentPayload, project: mergedProject, metadata: mergedMetadata, features, updatedAt: now }, auth, update));
      } catch (error) {
        await deleteFile(version.bucketId, version.fileId).catch(() => null);
        throw error;
      }
      await cleanupProjectVersionFiles(expiredVersions);
      await appendSecurityEvent({ type: 'project', action: 'project_bundle_saved', actorUserId: auth.sub, actorEmail: auth.user?.email, target: projectIdValue, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', metadata: { featureCount: features.length, revision: saved.updatedAt || saved.$updatedAt || now, projectId: projectIdValue, projectName: mergedProject.propertyName || mergedProject.name || row.propertyName || row.name || 'Projeto', workspaceOwnerUserId: resourceOwnerId(auth) } }).catch(() => null);
      const savedPayload = { ...currentPayload, project: mergedProject, metadata: mergedMetadata, features, updatedAt: now };
      return send(response, request, 200, { ok: true, project: mapStoredProject(saved, savedPayload), features: features.map((feature) => mapFeature(feature, projectIdValue, resourceOwnerId(auth))) });
    }

    if (!subRoute && httpMethod === 'PATCH') {
      requirePermission(auth, 'projects:edit-own');
      assertWorkspaceActionAllowed(auth, 'project:edit');
      const rawInput = await bodyJson(request);
      assertRevisionMatches(row, request, rawInput, true);
      const input = sanitizeProjectClientInput(rawInput, row.status || 'draft');
      const payload = await readProjectPayload(row);
      const now = new Date().toISOString();
      const existingMetadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      if (existingMetadata.projectLocked) throw statusError(423, 'Projeto travado. Destrave antes de alterar.', { code: 'PROJECT_LOCKED' });
      const version = await stageProjectVersionSnapshot(row, payload, 'project', auth);
      const existingVersions = Array.isArray(existingMetadata.versions) ? existingMetadata.versions : [];
      const retention = projectVersionRetention();
      const combinedVersions = [...existingVersions, version];
      const expiredVersions = combinedVersions.slice(0, Math.max(0, combinedVersions.length - retention));
      const keptVersions = combinedVersions.slice(-retention);
      const mergedMetadata = {
        ...existingMetadata,
        ...(payload.project?.metadata || {}),
        ...(input.metadata || {}),
        versions: keptVersions,
        lastSavedByUserId: auth.sub,
        lastSavedByName: auth.user?.name || '',
        lastSavedAt: now
      };
      const merged = { ...(payload.project || {}), ...input, metadata: mergedMetadata };
      const update = projectData(merged, resourceOwnerId(auth), now, '', row);
      delete update.createdAt;
      delete update.geojsonFileId;
      update.updatedAt = now;
      let saved;
      try {
        ({ saved } = await commitProjectPayload(row, { ...payload, project: merged, metadata: mergedMetadata, updatedAt: now }, auth, update));
      } catch (error) {
        await deleteFile(version.bucketId, version.fileId).catch(() => null);
        throw error;
      }
      await cleanupProjectVersionFiles(expiredVersions);
      await appendSecurityEvent({ type: 'project', action: 'project_updated', actorUserId: auth.sub, actorEmail: auth.user?.email, target: projectIdValue, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok', metadata: { projectId: projectIdValue, projectName: merged.propertyName || merged.name || row.propertyName || row.name || 'Projeto', workspaceOwnerUserId: resourceOwnerId(auth) } }).catch(() => null);
      return send(response, request, 200, { ok: true, project: mapStoredProject(saved, { ...payload, project: merged, metadata: mergedMetadata, updatedAt: now }) });
    }

    if (!subRoute && httpMethod === 'DELETE') {
      requirePermission(auth, 'projects:trash', 'Seu plano não permite enviar projetos para a lixeira.');
      assertWorkspaceActionAllowed(auth, 'project:delete');
      await updateRow('projects', projectIdValue, { status: 'deleted', updatedAt: new Date().toISOString() });
      return send(response, request, 204, null);
    }

    if (subRoute === 'features' && httpMethod === 'PUT') {
      requirePermission(auth, 'projects:edit-own');
      assertWorkspaceActionAllowed(auth, 'project:edit');
      const input = await bodyJson(request);
      assertRevisionMatches(row, request, input, true);
      const featuresInput = Array.isArray(input.features) ? input.features : [];
      const payload = await readProjectPayload(row);
      const now = new Date().toISOString();
      const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      if (metadata.projectLocked) throw statusError(423, 'Projeto travado. Destrave antes de editar as feições.', { code: 'PROJECT_LOCKED' });
      const version = await stageProjectVersionSnapshot(row, payload, 'features', auth);
      const existingVersions = Array.isArray(metadata.versions) ? metadata.versions : [];
      const retention = projectVersionRetention();
      const combinedVersions = [...existingVersions, version];
      const expiredVersions = combinedVersions.slice(0, Math.max(0, combinedVersions.length - retention));
      const keptVersions = combinedVersions.slice(-retention);
      const features = featuresInput.map((feature, index) => ({ ...feature, id: feature.id || appwriteId(), sortOrder: feature.sortOrder ?? index, updatedAt: now, createdAt: feature.createdAt || now }));
      assertValidProjectFeatures(features);
      try {
        await commitProjectPayload(row, { ...payload, metadata: { ...metadata, versions: keptVersions, lastSavedByUserId: auth.sub, lastSavedAt: now }, features, updatedAt: now }, auth, { updatedAt: now });
      } catch (error) {
        await deleteFile(version.bucketId, version.fileId).catch(() => null);
        throw error;
      }
      await cleanupProjectVersionFiles(expiredVersions);
      return send(response, request, 200, { ok: true, count: features.length, revision: now, features: features.map((feature) => mapFeature(feature, projectIdValue, resourceOwnerId(auth))) });
    }

    if (subRoute === 'features' && httpMethod === 'POST') {
      requirePermission(auth, 'projects:edit-own');
      assertWorkspaceActionAllowed(auth, 'project:edit');
      const input = await bodyJson(request);
      assertRevisionMatches(row, request, input);
      const payload = await readProjectPayload(row);
      const now = new Date().toISOString();
      const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      if (metadata.projectLocked) throw statusError(423, 'Projeto travado. Destrave antes de editar as feições.', { code: 'PROJECT_LOCKED' });
      const version = await stageProjectVersionSnapshot(row, payload, 'feature-add', auth);
      const existingVersions = Array.isArray(metadata.versions) ? metadata.versions : [];
      const retention = projectVersionRetention();
      const combinedVersions = [...existingVersions, version];
      const expiredVersions = combinedVersions.slice(0, Math.max(0, combinedVersions.length - retention));
      const keptVersions = combinedVersions.slice(-retention);
      const feature = { ...input, id: appwriteId(), createdAt: now, updatedAt: now };
      const features = [...(Array.isArray(payload.features) ? payload.features : []), feature];
      assertValidProjectFeatures(features);
      try {
        await commitProjectPayload(row, { ...payload, metadata: { ...metadata, versions: keptVersions, lastSavedByUserId: auth.sub, lastSavedAt: now }, features, updatedAt: now }, auth, { updatedAt: now });
      } catch (error) {
        await deleteFile(version.bucketId, version.fileId).catch(() => null);
        throw error;
      }
      await cleanupProjectVersionFiles(expiredVersions);
      return send(response, request, 201, { ok: true, revision: now, feature: mapFeature(feature, projectIdValue, resourceOwnerId(auth)) });
    }

    if (subRoute === 'public-short') {
      requirePermission(auth, 'projects:edit-own');
      assertWorkspaceActionAllowed(auth, 'project:edit');
      const payload = await readProjectPayload(row);
      const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      const now = new Date().toISOString();

      if (httpMethod === 'DELETE') {
        const nextMetadata = { ...metadata, publicShortEnabled: false, publicShortUpdatedAt: now };
        await commitProjectPayload(row, { ...payload, metadata: nextMetadata, updatedAt: now }, auth, { updatedAt: now });
        return send(response, request, 204, null);
      }

      if (httpMethod === 'POST' || httpMethod === 'GET') {
        if (!metadata.publicShortEnabled && httpMethod === 'POST') {
          const nextMetadata = {
            ...metadata,
            publicShortEnabled: true,
            publicShortCreatedAt: metadata.publicShortCreatedAt || now,
            publicShortUpdatedAt: now
          };
          await commitProjectPayload(row, { ...payload, metadata: nextMetadata, updatedAt: now }, auth, { updatedAt: now });
        }
        const enabled = Boolean(metadata.publicShortEnabled || httpMethod === 'POST');
        const shortCode = projectShortCode(projectIdValue);
        const shortUrl = shortCode ? publicShortPath(projectIdValue) : '';
        if (enabled && shortCode) {
          await writePublicShortIndex(projectIdValue, shortCode);
          await writePublicShortIndex(projectIdValue, legacyProjectShortCode(projectIdValue));
        }
        return send(response, request, 200, {
          ok: true,
          publicShort: { active: enabled, shortCode, shortUrl, url: shortUrl, publicUrl: shortUrl }
        });
      }
    }

    if (subRoute === 'share') {
      const payload = await readProjectPayload(row);
      const { metadata, shares } = projectPayloadShares(payload);
      const now = new Date().toISOString();
      if (httpMethod === 'DELETE') {
        requirePermission(auth, 'sharing:revoke', 'Seu plano não permite revogar compartilhamentos avançados.');
        assertWorkspaceActionAllowed(auth, 'project:share');
        const targetId = String(url.searchParams.get('shareId') || '').trim();
        const nextShares = shares.map((item) => (!targetId || String(item.id || '') === targetId) ? { ...item, revokedAt: now, updatedAt: now } : item);
        await commitProjectPayload(row, { ...payload, metadata: { ...metadata, secureShares: nextShares }, updatedAt: now }, auth, { updatedAt: now });
        return send(response, request, 204, null);
      }
      if (httpMethod === 'GET') {
        requirePermission(auth, 'sharing:readonly', 'Seu plano não possui compartilhamento de projetos.');
        assertWorkspaceActionAllowed(auth, 'project:share');
        const active = shares.filter((item) => !item.revokedAt).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
        if (!active) return send(response, request, 200, { ok: true, share: { active: false } });
        const token = signJwt({ type: 'project-share', projectId: projectIdValue, ownerUserId: resourceOwnerId(auth), shareId: active.id }, Math.max(60, Math.floor((Date.parse(active.expiresAt || '') - Date.now()) / 1000) || 3650 * 86400));
        return send(response, request, 200, { ok: true, share: publicShareView(active, token, projectIdValue) });
      }
      if (httpMethod === 'POST') {
        requirePermission(auth, 'sharing:readonly', 'Seu plano não possui compartilhamento de projetos.');
        assertWorkspaceActionAllowed(auth, 'project:share');
      }
      const input = httpMethod === 'POST' ? await bodyJson(request).catch(() => ({})) : {};
      if (httpMethod === 'POST' && String(input.password || '').trim()) requirePermission(auth, 'sharing:password', 'Seu plano não permite proteger compartilhamentos com senha.');
      if (httpMethod === 'POST' && Number(input.maxAccessCount || input.accessLimit || 0) > 0) requirePermission(auth, 'sharing:access-limit', 'Seu plano não permite limitar a quantidade de acessos do compartilhamento.');
      const share = normalizeProjectShare(input, auth);
      const token = signJwt({ type: 'project-share', projectId: projectIdValue, ownerUserId: resourceOwnerId(auth), shareId: share.id }, Math.max(60, Math.floor((Date.parse(share.expiresAt) - Date.now()) / 1000)));
      const nextShares = [...shares.filter((item) => !item.revokedAt).slice(-9), share];
      await commitProjectPayload(row, { ...payload, metadata: { ...metadata, secureShares: nextShares }, updatedAt: now }, auth, { updatedAt: now });
      return send(response, request, 200, { ok: true, share: publicShareView(share, token, projectIdValue) });
    }

    if (subRoute === 'versions' && httpMethod === 'GET') {
      requirePermission(auth, 'projects:version-full', 'Seu plano não possui histórico completo de versões.');
      const payload = await readProjectPayload(row);
      const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      return send(response, request, 200, { ok: true, versions: Array.isArray(metadata.versions) ? metadata.versions.map(({ features, project, ...rest }) => rest).reverse() : [] });
    }

    if (subRoute === 'versions' && httpMethod === 'POST') {
      requirePermission(auth, 'projects:version-full', 'Seu plano não possui restauração de versões.');
      assertWorkspaceActionAllowed(auth, 'project:version-restore');
      const input = await bodyJson(request);
      assertRevisionMatches(row, request, input);
      const versionId = String(input.versionId || '').trim();
      const payload = await readProjectPayload(row);
      const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      const versions = Array.isArray(metadata.versions) ? metadata.versions : [];
      const version = versions.find((item) => String(item.id || '') === versionId);
      if (!version) throw statusError(404, 'Versão não encontrada.');
      const target = await readProjectVersionSnapshot(version);
      const now = new Date().toISOString();
      const beforeRestore = await stageProjectVersionSnapshot(row, payload, 'before-restore', auth);
      const retention = projectVersionRetention();
      const combinedVersions = [...versions, beforeRestore];
      const expiredVersions = combinedVersions.slice(0, Math.max(0, combinedVersions.length - retention));
      const keptVersions = combinedVersions.slice(-retention);
      const targetMetadata = target.metadata && typeof target.metadata === 'object' ? target.metadata : {};
      const restoredMetadata = {
        ...targetMetadata,
        versions: keptVersions,
        secureShares: Array.isArray(metadata.secureShares) ? metadata.secureShares : [],
        projectLocked: Boolean(metadata.projectLocked),
        lockedByUserId: metadata.lockedByUserId || '',
        lockedAt: metadata.lockedAt || '',
        storageOwnerUserId: metadata.storageOwnerUserId || auth.sub,
        workspaceOwnerUserId: metadata.workspaceOwnerUserId || resourceOwnerId(auth),
        restoredFromVersionId: versionId,
        restoredAt: now,
        restoredByUserId: auth.sub
      };
      const restoredProject = { ...(target.project || payload.project || {}), metadata: restoredMetadata };
      const restored = { ...target, project: restoredProject, metadata: restoredMetadata, features: Array.isArray(target.features) ? target.features : [], updatedAt: now };
      let saved;
      try {
        ({ saved } = await commitProjectPayload(row, restored, auth, { updatedAt: now }));
      } catch (error) {
        await deleteFile(beforeRestore.bucketId, beforeRestore.fileId).catch(() => null);
        throw error;
      }
      await cleanupProjectVersionFiles(expiredVersions);
      return send(response, request, 200, { ok: true, restoredAt: now, project: mapStoredProject(saved, restored), features: restored.features.map((feature) => mapFeature(feature, projectIdValue, resourceOwnerId(auth))) });
    }

    if (subRoute === 'duplicate' && httpMethod === 'POST') {
      requirePermission(auth, 'projects:create');
      assertWorkspaceActionAllowed(auth, 'project:duplicate');
      const payload = await readProjectPayload(row);
      const now = new Date().toISOString();
      const newId = appwriteId();
      const baseProject = payload.project || mapProject(row);
      const name = String((baseProject.name || row.name || 'Projeto') + ' — cópia').slice(0, 240);
      const duplicatedMetadata = {
        ...(payload.metadata || {}),
        versions: [],
        secureShares: [],
        projectLocked: false,
        lockedByUserId: '',
        lockedAt: '',
        duplicatedFrom: projectIdValue,
        duplicatedAt: now,
        duplicatedByUserId: auth.sub,
        createdByUserId: auth.sub,
        createdByName: auth.user?.name || '',
        storageOwnerUserId: resourceOwnerId(auth),
        workspaceOwnerUserId: resourceOwnerId(auth)
      };
      const nextProject = { ...baseProject, id: newId, name, propertyName: baseProject.propertyName || row.propertyName || name, metadata: duplicatedMetadata };
      const newPayload = { ...payload, project: nextProject, metadata: duplicatedMetadata, createdAt: now, updatedAt: now };
      const content = encryptJsonText(newPayload, { aad: 'project-payload' });
      await assertProjectCapacity(auth, 1);
      await assertStorageCapacity(auth, Buffer.byteLength(content, 'utf8'), 0, { resourceStorageOwnerUserId: resourceOwnerId(auth) });
      const file = await createFile(bucketId('project_files'), `${newId}.json`, content, 'application/json', newId);
      const duplicatedFileId = file.$id || file.id;
      let newRow;
      try {
        newRow = await createRow('projects', projectData(nextProject, resourceOwnerId(auth), now, duplicatedFileId), newId);
      } catch (error) {
        await deleteFile(bucketId('project_files'), duplicatedFileId).catch(() => null);
        throw error;
      }
      return send(response, request, 201, { ok: true, project: mapProject(newRow) });
    }

    if (subRoute === 'lock' && httpMethod === 'POST') {
      requirePermission(auth, 'projects:lock', 'Seu plano não permite travar projetos.');
      assertWorkspaceActionAllowed(auth, 'project:lock');
      const input = await bodyJson(request).catch(() => ({}));
      const payload = await readProjectPayload(row);
      const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      const now = new Date().toISOString();
      const nextMetadata = { ...metadata, projectLocked: Boolean(input.locked), projectLockedAt: Boolean(input.locked) ? now : null };
      await commitProjectPayload(row, { ...payload, metadata: nextMetadata, project: { ...(payload.project || {}), metadata: nextMetadata }, updatedAt: now }, auth, { updatedAt: now });
      return send(response, request, 200, { ok: true, locked: nextMetadata.projectLocked });
    }

    if (subRoute === 'export' && httpMethod === 'GET') {
      requirePermission(auth, 'projects:export');
      assertWorkspaceActionAllowed(auth, 'project:export');
      await consumeDailyUsage(auth, 'export', 1, { projectId: projectIdValue, type: 'project-export' });
      const payload = await readProjectPayload(row);
      return send(response, request, 200, { ok: true, export: { project: mapStoredProject(row, payload), payload, exportedAt: new Date().toISOString() } });
    }
  }

  if (path === '/api/documents' && httpMethod === 'GET') {
    requirePermission(auth, 'cloud:view-own');
    const rows = await listAllRows('documents', [Query.equal('userId', resourceOwnerId(auth))]);
    const category = queryValue(request, 'category') ? String(queryValue(request, 'category')).slice(0, 80) : '';
    const activeRows = rows.filter((row) => String(row.status || '').toLowerCase() !== 'deleted' && canAccessDocumentCategory(auth, row));
    const filtered = category ? activeRows.filter((row) => String(row.type || row.category || '') === category) : activeRows;
    const documents = [];
    for (const row of filtered) documents.push(await serializeDocumentRow(row));
    documents.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return send(response, request, 200, { ok: true, documents });
  }

  if (path === '/api/documents' && httpMethod === 'POST') {
    requirePermission(auth, 'cloud:access');
    assertWorkspaceActionAllowed(auth, 'document:create');
    const input = sanitizeDocumentClientInput(await bodyJson(request));
    requireDocumentCategoryPermission(auth, input);
    await assertOptionalProjectBelongsToAuth(input.projectId, auth);
    const content = String(input.content ?? '');
    if (Number(input.originalSizeBytes || 0) > CLOUD_FILE_UPLOAD_LIMIT_BYTES) throw statusError(413, 'Arquivo maior que 1,5 MB. A Minha Nuvem aceita somente arquivos de até 1,5 MB por envio.');
    if (Buffer.byteLength(content, 'utf8') > MAX_DOCUMENT_CONTENT_BYTES) throw statusError(413, 'Documento maior que 3,2 MB.');
    const bucket = bucketId('generated_documents');
    const title = input.title || input.name || input.fileName || 'Documento';
    const generationResult = input.generationAlreadyConsumed ? { generation: auth.user.generation || null } : await consumeGenerationCredit(auth, input.generationFeature || input.type || input.category || title || 'documento');
    const contentBytes = Buffer.byteLength(content, 'utf8');
    await assertStorageCapacity(auth, contentBytes);
    const file = await createFile(bucket, input.fileName || `${appwriteId()}.txt`, content, input.mimeType || input.format || 'text/plain');
    const createdFileId = file.$id || file.id;
    let row;
    try {
      row = await createDocumentRowSafe(documentData({ ...input, title, sizeBytes: contentBytes, metadata: { ...(input.metadata || {}), createdByUserId: auth.sub, createdByName: auth.user?.name || '', storageOwnerUserId: resourceOwnerId(auth), workspaceOwnerUserId: resourceOwnerId(auth) } }, resourceOwnerId(auth), createdFileId, bucket));
    } catch (error) {
      await deleteFile(bucket, createdFileId).catch(() => null);
      throw error;
    }
    await appendSecurityEvent({
      type: 'document', action: 'document_created', actorUserId: auth.sub, actorEmail: auth.user?.email,
      target: row?.$id || row?.id || createdFileId, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok',
      message: `Documento criado: ${String(title || 'Documento').slice(0, 180)}.`,
      metadata: { documentId: row?.$id || row?.id || '', documentName: String(title || 'Documento').slice(0, 180), workspaceOwnerUserId: resourceOwnerId(auth) }
    }).catch(() => null);
    return send(response, request, 201, { ok: true, document: await serializeDocumentRow(row), generation: generationResult.generation });
  }

  const documentMatch = path.match(/^\/api\/documents\/([^/]+)$/);
  if (documentMatch && (httpMethod === 'PATCH' || httpMethod === 'PUT')) {
    requirePermission(auth, 'cloud:access');
    assertWorkspaceActionAllowed(auth, 'document:edit');
    const documentId = decodeURIComponent(documentMatch[1]);
    const input = sanitizeDocumentClientInput(await bodyJson(request));
    requireDocumentCategoryPermission(auth, input);
    await assertOptionalProjectBelongsToAuth(input.projectId, auth);
    const current = await getRow('documents', documentId);
    if (!current || current.userId !== resourceOwnerId(auth) || String(current.status || '').toLowerCase() === 'deleted') throw statusError(404, 'Documento não encontrado.');
    requireDocumentCategoryPermission(auth, current);
    assertRevisionMatches(current, request, input);
    let fileId = current.fileId;
    let stagedFileId = '';
    const previousFileId = String(current.fileId || '');
    const bucket = current.bucketId || bucketId('generated_documents');
    if ((bucket === 'google_drive' || safeJson(current.metadata, {})?.storageProvider === 'google_drive') && input.content !== undefined) {
      throw statusError(400, 'Arquivo do Google Drive não pode ser editado como texto. Baixe e envie uma nova versão pela Minha Nuvem.');
    }
    if (input.content !== undefined) {
      const content = String(input.content ?? '');
      const contentBytes = Buffer.byteLength(content, 'utf8');
      if (contentBytes > MAX_DOCUMENT_CONTENT_BYTES) throw statusError(413, 'Documento maior que 3,2 MB.');
      const currentMetadata = safeJson(current.metadata, {});
      await assertStorageCapacity(auth, contentBytes, storedDocumentBytes(current), {
        resourceStorageOwnerUserId: storageOwnerFromMetadata(currentMetadata, resourceOwnerId(auth))
      });
      const file = await createFile(bucket, input.fileName || current.name || `${appwriteId()}.txt`, content, input.mimeType || current.format || 'text/plain');
      stagedFileId = file.$id || file.id;
      const verification = await readFileText(bucket, stagedFileId).catch(() => '');
      if (verification !== content) {
        await deleteFile(bucket, stagedFileId).catch(() => null);
        throw statusError(502, 'A nova versão do documento não pôde ser verificada. A versão anterior foi preservada.', { code: 'DOCUMENT_FILE_VERIFICATION_FAILED' });
      }
      fileId = stagedFileId;
      input.sizeBytes = contentBytes;
    }
    let row;
    try {
      row = await updateDocumentRowSafe(documentId, documentData({ ...input, metadata: { ...(input.metadata || {}), updatedByUserId: auth.sub, updatedByName: auth.user?.name || '', workspaceOwnerUserId: resourceOwnerId(auth) } }, resourceOwnerId(auth), fileId, bucket, current));
    } catch (error) {
      if (stagedFileId) await deleteFile(bucket, stagedFileId).catch(() => null);
      throw error;
    }
    if (stagedFileId && previousFileId && previousFileId !== stagedFileId) {
      await deleteFile(bucket, previousFileId).catch((error) => console.warn('[storage] arquivo anterior do documento pendente de limpeza:', error?.message || error));
    }
    await appendSecurityEvent({
      type: 'document', action: 'document_updated', actorUserId: auth.sub, actorEmail: auth.user?.email,
      target: documentId, ip: requestIp(request), userAgent: requestUserAgent(request), status: 'ok',
      message: `Documento atualizado: ${String(input.title || input.name || current.title || current.name || 'Documento').slice(0, 180)}.`,
      metadata: { documentId, documentName: String(input.title || input.name || current.title || current.name || 'Documento').slice(0, 180), workspaceOwnerUserId: resourceOwnerId(auth) }
    }).catch(() => null);
    return send(response, request, 200, { ok: true, document: await serializeDocumentRow(row) });
  }

  if (documentMatch && httpMethod === 'DELETE') {
    requirePermission(auth, 'cloud:access');
    assertWorkspaceActionAllowed(auth, 'document:delete');
    const documentId = decodeURIComponent(documentMatch[1]);
    const current = await getRow('documents', documentId);
    if (!current || current.userId !== resourceOwnerId(auth) || String(current.status || '').toLowerCase() === 'deleted') throw statusError(404, 'Documento não encontrado.');
    const now = new Date().toISOString();
    // Primeiro retiramos o documento da visão do usuário. Se a limpeza externa falhar,
    // preservamos uma referência recuperável para reconciliação em vez de criar perda silenciosa.
    await updateRow('documents', documentId, { status: 'deleted', updatedAt: now });
    let cleanupError = null;
    try {
      if ((current.bucketId || '') === 'google_drive' || safeJson(current.metadata, {})?.storageProvider === 'google_drive') await deleteGoogleDriveFile(current.fileId);
      else await deleteFile(current.bucketId || bucketId('generated_documents'), current.fileId);
    } catch (error) {
      cleanupError = error;
      console.warn('[storage] documento excluído logicamente, mas arquivo aguarda reconciliação:', error?.message || error);
    }
    await appendSecurityEvent({
      type: 'document', action: cleanupError ? 'document_deleted_cleanup_pending' : 'document_deleted',
      actorUserId: auth.sub, actorEmail: auth.user?.email, target: documentId,
      ip: requestIp(request), userAgent: requestUserAgent(request), status: cleanupError ? 'pending' : 'ok',
      message: cleanupError ? 'A exclusão lógica foi concluída e o arquivo externo aguarda limpeza.' : '',
      metadata: { fileId: current.fileId || '', bucketId: current.bucketId || '', cleanupPending: Boolean(cleanupError) }
    }).catch(() => null);
    return send(response, request, 204, null);
  }

  const memorialTemplateMatch = path.match(/^\/api\/memorial-templates\/([^/]+)$/);
  if (memorialTemplateMatch && httpMethod === 'GET') {
    const templateId = decodeURIComponent(memorialTemplateMatch[1]);
    if (templateId !== 'agro-mais') throw statusError(404, 'Modelo de memorial não encontrado.');
    const templateOwnerUserId = resourceOwnerId(auth);
    const appwriteUser = await getAppwriteUserById(templateOwnerUserId).catch(() => null) || {};
    const allowed = memorialTemplateAccessForUser(appwriteUser);
    if (!allowed.includes(templateId)) throw statusError(403, 'Este modelo de memorial não está liberado para sua conta.', { code: 'MEMORIAL_TEMPLATE_NOT_ALLOWED' });
    const templateUrl = new URL('../assets/memorial-templates/05_AgroMais.docx', import.meta.url);
    const file = await readFile(templateUrl);
    return send(response, request, 200, {
      ok: true,
      id: templateId,
      filename: '05_AgroMais.docx',
      contentBase64: file.toString('base64')
    });
  }

  const isCustomizationRoute = path === '/api/customization' || path === '/api/customization/document';
  if (isCustomizationRoute && httpMethod === 'GET') {
    requirePermission(auth, 'company:settings', 'Seu plano não possui acesso à Personalização.');
    const customizationOwnerUserId = resourceOwnerId(auth);
    const current = await findCustomizationForUser(customizationOwnerUserId);
    const customization = await serializeDocumentCustomization(current || {});
    const appwriteUser = await getAppwriteUserById(customizationOwnerUserId).catch(() => null) || {};
    const allowedMemorialTemplateIds = memorialTemplateAccessForUser(appwriteUser);
    customization.options = {
      ...(customization.options && typeof customization.options === 'object' ? customization.options : {}),
      allowedMemorialTemplateIds
    };
    customization.allowedMemorialTemplateIds = allowedMemorialTemplateIds;
    return send(response, request, 200, { ok: true, customization });
  }

  if (isCustomizationRoute && (httpMethod === 'PUT' || httpMethod === 'POST' || httpMethod === 'PATCH')) {
    requirePermission(auth, 'company:settings', 'Seu plano não possui acesso à Personalização.');
    assertWorkspaceActionAllowed(auth, 'customization:company');
    const input = await bodyJson(request);
    const customizationOwnerUserId = resourceOwnerId(auth);
    const customization = await saveDocumentCustomizationForUser(customizationOwnerUserId, input);
    return send(response, request, 200, { ok: true, customization });
  }

  if (path === '/api/system/notices' || path === '/api/notices' || path === '/api/notifications') {
    const notices = systemNoticesForAuth(await readSystemNotices(), auth);
    return send(response, request, 200, { ok: true, notices });
  }

  if ((path === '/api/layers' || path === '/api/layers/' || path === '/api/layers/catalog') && httpMethod === 'GET') {
    requirePermission(auth, 'layers:official');
    const catalog = await publicLayerCatalog(auth);
    return send(response, request, 200, { ok: true, ...catalog }, { 'Cache-Control': 'no-store, max-age=0, must-revalidate', 'Pragma': 'no-cache' });
  }

  if (path === '/api/layers/preferences' && httpMethod === 'GET') {
    requirePermission(auth, 'layers:official');
    // Não releia o catálogo inteiro aqui. O frontend já carrega /api/layers/catalog
    // e aplica defaults/sanitização localmente. Esta rota precisa de apenas 1 linha.
    const row = await findCustomizationForUser(auth.sub).catch(() => null);
    const options = customizationOptions(row || {});
    const preferences = Array.isArray(options.layerPreferences) ? options.layerPreferences : [];
    const catalogState = normalizeLayerCatalogState(options.layerCatalogState || 'BA');
    const catalogStateConfigured = Object.prototype.hasOwnProperty.call(options, 'layerCatalogState');
    return send(response, request, 200, { ok: true, preferences, catalogState, catalogStateConfigured });
  }

  if (path === '/api/layers/preferences' && ['PUT', 'POST', 'PATCH'].includes(httpMethod)) {
    requirePermission(auth, 'layers:official');
    const input = await bodyJson(request);
    const saved = await saveLayerPreferencesForUser(auth.sub, input.preferences || [], auth, input.catalogState || '');
    return send(response, request, 200, { ok: true, preferences: saved.preferences, catalogState: normalizeLayerCatalogState(input.catalogState || saved.customization?.layerCatalogState || 'BA') });
  }

  if (path === '/api/onboarding' && httpMethod === 'GET') {
    const appwriteUser = await getAppwriteUserById(auth.sub).catch(() => null);
    const { surveyor } = userPrefs(appwriteUser || {});
    return send(response, request, 200, { ok: true, state: sanitizeOnboardingState(surveyor.onboarding || {}) }, { 'Cache-Control': 'no-store, max-age=0' });
  }

  if (path === '/api/onboarding' && ['PUT', 'POST', 'PATCH'].includes(httpMethod)) {
    const input = await bodyJson(request);
    const state = sanitizeOnboardingState(input.state || input.onboarding || input || {});
    await updateAppwriteUserSurveyorPrefs(auth.sub, { onboarding: state });
    return send(response, request, 200, { ok: true, state });
  }

  const publicLayerDataMatch = path.match(/^\/api\/layers\/([^/]+)\/data(?:\/(full|stream|viewport|chunks|remote-data)(?:\/([^/?#]+))?)?$/);
  if (publicLayerDataMatch) {
    requirePermission(auth, 'layers:official', 'Seu plano não possui acesso às camadas oficiais.');
    const layerId = decodeURIComponent(publicLayerDataMatch[1]);
    const mode = publicLayerDataMatch[2] || '';
    const row = await getRow('layers', layerId).catch(() => null);
    if (!row || row.status === 'archived') throw statusError(404, 'Camada não encontrada.');
    const publicLayer = mapLayer(row);
    if (!userAllowedForLayer(publicLayer, auth)) throw statusError(404, 'Camada não encontrada.');
    const metadata = layerMetadata(row);
    const tiled = metadata.storageMode === 'tiled-geojson' || Boolean(metadata.tileManifestFileId);

    if (tiled && mode === 'viewport') {
      const bboxRaw = String(queryValue(request, 'bbox') || '');
      const bbox = bboxRaw.split(',').map(Number);
      if (bbox.length !== 4 || !bbox.every(Number.isFinite)) throw statusError(400, 'bbox inválido para consulta da camada em blocos.');
      return sendTiledLayerViewport(response, request, row, layerId, bbox, Number(queryValue(request, 'zoom') || 0));
    }

    if (tiled && (mode === 'full' || mode === 'stream')) {
      return sendTiledLayerFull(response, request, row, layerId);
    }

    if (tiled) {
      const manifestText = await readFileText(row.dataBucketId || bucketId('project_files'), metadata.tileManifestFileId || row.dataFileId);
      const manifest = safeJson(manifestText, {});
      return send(response, request, 200, {
        ok: true,
        storage: 'tiled-geojson',
        layer: mapLayer(row),
        manifest: {
          storageMode: 'tiled-geojson',
          tileZoom: manifest.tileZoom || metadata.tileZoom || 12,
          tileCount: Array.isArray(manifest.tiles) ? manifest.tiles.length : 0,
          featureCount: manifest.featureCount || row.featureCount || 0,
          bounds: manifest.bounds || metadata.bounds || null
        }
      });
    }

    if (row.dataFileId) {
      const text = await readFileText(row.dataBucketId || bucketId('project_files'), row.dataFileId);
      const geojson = safeJson(text, { type: 'FeatureCollection', features: [] });
      return send(response, request, 200, { ok: true, geojson, layer: mapLayer(row) });
    }
    return send(response, request, 200, { ok: true, geojson: { type: 'FeatureCollection', features: [] }, layer: mapLayer(row) });
  }

  throw statusError(404, 'Rota não encontrada na Surveyor Appwrite Function.');
}

export default async function main({ req, res, log, error }) {
  try {
    if (!projectId()) throw statusError(500, 'APPWRITE_PROJECT_ID não configurado.');
    if (!apiKey()) throw statusError(500, 'APPWRITE_API_KEY não configurado.');
    assertCryptoReady();
    return await route(req, res);
  } catch (cause) {
    const requestId = appwriteId();
    error?.(`[${requestId}] ${cause?.stack || cause?.message || String(cause)}`);
    const rawStatus = Number(cause?.status || 500);
    const status = Number.isFinite(rawStatus) ? rawStatus : 500;
    const publicError = status >= 500 ? 'Não foi possível concluir a operação. Tente novamente em alguns instantes.' : (cause?.message || 'Requisição inválida.');
    const safeDetails = status < 500 && cause?.details && typeof cause.details === 'object'
      ? Object.fromEntries(Object.entries(cause.details).filter(([key]) => ['code', 'retryAfterSeconds', 'passwordRequired', 'field', 'lockedUntil', 'failedAttempts', 'remainingAttempts'].includes(key)))
      : undefined;
    return send(res, req || {}, status, {
      ok: false,
      error: publicError,
      requestId,
      details: safeDetails
    }, status === 429 ? { 'Retry-After': String(safeDetails?.retryAfterSeconds || 60), 'X-Request-ID': requestId } : { 'X-Request-ID': requestId });
  }
}
