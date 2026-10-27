import crypto from 'node:crypto';
import { validateProjectFeatures } from './geometry-validation.js';
import { assertCryptoReady, encryptJsonText, decryptJsonText } from './security/crypto.js';

const APP_VERSION = '1.0.0-rc.185.74';
const SERVICE_NAME = 'Surveyor Save Function';
// Subusuários compartilham integralmente a franquia do titular; sem limite individual.

function env(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function statusError(status, message, details = null) {
  const error = new Error(message || 'Erro interno.');
  error.status = Number(status || 500);
  error.details = details;
  return error;
}

function endpoint() {
  const value = (env('APPWRITE_ENDPOINT') || env('APPWRITE_FUNCTION_API_ENDPOINT') || 'https://nyc.cloud.appwrite.io/v1').replace(/\/+$/, '');
  const localAllowed = env('ALLOW_INSECURE_APPWRITE_LOCAL', 'false').toLowerCase() === 'true' && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value);
  if (!/^https:\/\//i.test(value) && !localAllowed) throw statusError(500, 'APPWRITE_ENDPOINT deve usar HTTPS.');
  return value;
}

function projectId() {
  return env('APPWRITE_PROJECT_ID') || env('APPWRITE_FUNCTION_PROJECT_ID');
}

function databaseId() {
  return env('APPWRITE_DATABASE_ID', 'surveyor_db');
}

function apiKey() {
  const explicit = env('SURVEYOR_SAVE_APPWRITE_API_KEY');
  if (explicit) return explicit;
  if (env('ALLOW_DYNAMIC_APPWRITE_KEY', 'false').toLowerCase() === 'true') {
    return env('APPWRITE_FUNCTION_API_KEY');
  }
  return '';
}


function collectionId(name) {
  const values = {
    projects: env('APPWRITE_COLLECTION_PROJECTS', 'projects'),
    documents: env('APPWRITE_COLLECTION_DOCUMENTS', 'documents')
  };
  return values[name] || name;
}

function bucketId(name) {
  if (name === 'project_files') return env('APPWRITE_BUCKET_PROJECT_FILES', 'project_files');
  return name;
}

function appwriteId() {
  return crypto.randomUUID();
}

function safeJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

function headerValue(request, name) {
  const key = String(name || '').toLowerCase();
  const headers = request?.headers || {};
  if (typeof headers.get === 'function') return headers.get(name) || headers.get(key) || '';
  const direct = headers[name] ?? headers[key];
  if (direct != null) return Array.isArray(direct) ? direct[0] : direct;
  const found = Object.entries(headers).find(([header]) => String(header).toLowerCase() === key);
  return found ? (Array.isArray(found[1]) ? found[1][0] : found[1]) : '';
}

function parsePath(request) {
  const raw = String(request?.path || request?.url || '/');
  try {
    if (/^https?:/i.test(raw)) return new URL(raw).pathname || '/';
  } catch {}
  const path = raw.split('?')[0].split('#')[0] || '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function method(request) {
  return String(request?.method || 'GET').toUpperCase();
}


const SAVE_RATE_BUCKETS = new Map();

function trustedRequestIp(request) {
  const candidates = [
    headerValue(request, 'cf-connecting-ip'),
    headerValue(request, 'x-real-ip'),
    String(headerValue(request, 'x-forwarded-for') || '').split(',')[0].trim()
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (/^[0-9a-f:.]{2,80}$/i.test(value)) return value.slice(0, 80);
  }
  return '';
}

function assertSaveRateLimit(request) {
  const ip = trustedRequestIp(request);
  if (!ip) return;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 120;
  const key = crypto.createHash('sha256').update(`save-rate|${ip}`).digest('hex').slice(0, 40);
  const current = SAVE_RATE_BUCKETS.get(key) || {};
  const attempts = Array.isArray(current.attempts)
    ? current.attempts.map(Number).filter((ts) => Number.isFinite(ts) && now - ts < windowMs)
    : [];
  if (attempts.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((Math.min(...attempts) + windowMs - now) / 1000));
    throw statusError(429, 'Muitas solicitações de salvamento. Aguarde alguns instantes e tente novamente.', { code: 'SAVE_RATE_LIMITED', retryAfterSeconds });
  }
  attempts.push(now);
  SAVE_RATE_BUCKETS.set(key, { attempts: attempts.slice(-limit), updatedAt: now });
  if (SAVE_RATE_BUCKETS.size > 3000) {
    const ordered = [...SAVE_RATE_BUCKETS.entries()].sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0));
    SAVE_RATE_BUCKETS.clear();
    ordered.slice(0, 3000).forEach(([bucketKey, value]) => SAVE_RATE_BUCKETS.set(bucketKey, value));
  }
}

function configuredCorsOrigins() {
  const defaults = [
    'https://surveyorr.com.br',
    'https://www.surveyorr.com.br'
  ];
  if (env('ENABLE_LEGACY_CORS_ORIGINS', 'false').toLowerCase() === 'true') {
    defaults.push('https://surveyoragrimensura.tech', 'https://www.surveyoragrimensura.tech');
  }
  const configured = env('CORS_ORIGINS')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter((item) => item && item !== '*');
  return [...new Set([...defaults, ...configured])];
}

function isLocalOrigin(origin) {
  if (env('ALLOW_LOCAL_DEV_ORIGINS', 'false').toLowerCase() !== 'true') return false;
  try {
    const parsed = new URL(origin);
    return ['http:', 'https:'].includes(parsed.protocol)
      && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function requestOrigin(request) {
  return String(headerValue(request, 'origin') || '').trim().replace(/\/+$/, '');
}

function allowedOrigin(request) {
  const origin = requestOrigin(request);
  if (!origin) return '';
  if (configuredCorsOrigins().includes(origin) || isLocalOrigin(origin)) return origin;
  return '';
}

function assertTrustedOrigin(request) {
  const origin = requestOrigin(request);
  if (!origin) return; // server-to-server / direct invocation
  if (!allowedOrigin(request)) throw statusError(403, 'Origem não autorizada para salvar projetos.', { code: 'SAVE_ORIGIN_DENIED' });
}

function requestId(request) {
  const incoming = String(headerValue(request, 'x-request-id') || '').trim();
  return /^[a-z0-9._:-]{8,120}$/i.test(incoming) ? incoming : appwriteId();
}

function baseHeaders(request) {
  const origin = allowedOrigin(request);
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Access-Control-Expose-Headers': 'Content-Type, X-Request-ID, Retry-After',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Request-ID': requestId(request)
  };
}

function send(res, request, status, payload, extraHeaders = {}) {
  const headers = { ...baseHeaders(request), ...extraHeaders };
  if (status === 204) return res.send('', status, headers);
  return res.json(payload, status, headers);
}

function maxBodyBytes() {
  const raw = Number(env('MAX_SAVE_BODY_BYTES', String(12 * 1024 * 1024)));
  if (!Number.isFinite(raw)) return 12 * 1024 * 1024;
  return Math.max(64 * 1024, Math.min(20 * 1024 * 1024, Math.trunc(raw)));
}

async function rawBodyText(request) {
  if (typeof request?.bodyText === 'string') return request.bodyText;
  if (typeof request?.body === 'string') return request.body;
  if (Buffer.isBuffer(request?.body)) return request.body.toString('utf8');
  if (request?.body && typeof request.body === 'object') return JSON.stringify(request.body);
  return '';
}

async function parseSaveEnvelope(request) {
  const contentType = String(headerValue(request, 'content-type') || '').toLowerCase();
  if (contentType && !contentType.includes('text/plain') && !contentType.includes('application/json') && !contentType.includes('+json')) {
    throw statusError(415, 'Formato de salvamento não suportado.', { code: 'SAVE_CONTENT_TYPE_INVALID' });
  }
  const text = await rawBodyText(request);
  if (!text) throw statusError(400, 'Corpo do salvamento vazio.', { code: 'SAVE_BODY_EMPTY' });
  if (Buffer.byteLength(text, 'utf8') > maxBodyBytes()) {
    throw statusError(413, 'Projeto maior que o limite permitido para um único salvamento.', { code: 'SAVE_BODY_TOO_LARGE' });
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw statusError(400, 'JSON de salvamento inválido.', { code: 'SAVE_BODY_INVALID' }); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw statusError(400, 'Payload de salvamento inválido.');
  const transport = parsed.__surveyorSaveTransport;
  if (!transport || typeof transport !== 'object' || Number(transport.version) !== 1) {
    throw statusError(400, 'Envelope de transporte do Surveyor ausente ou inválido.', { code: 'SAVE_TRANSPORT_INVALID' });
  }
  const accessToken = String(transport.accessToken || '').trim();
  // R26.3.73 — tokens de acesso são aceitos até 32 KiB durante a transição para
  // o formato compacto. Token ausente e token excessivo têm códigos distintos
  // para não mascarar diagnóstico como "sessão ausente".
  const maxAccessTokenChars = 32 * 1024;
  if (!accessToken) throw statusError(401, 'Sessão ausente. Entre novamente.', { code: 'SAVE_AUTH_TOKEN_MISSING' });
  if (accessToken.length > maxAccessTokenChars) throw statusError(401, 'Token de sessão excedeu o limite permitido. Entre novamente.', { code: 'SAVE_AUTH_TOKEN_TOO_LARGE', maxChars: maxAccessTokenChars });
  const idempotencyKey = String(transport.idempotencyKey || '').trim().slice(0, 120);
  const expectedRevision = String(transport.expectedRevision || '').trim().slice(0, 200);
  const clientRequestId = String(transport.requestId || '').trim().slice(0, 120);
  const payload = { ...parsed };
  delete payload.__surveyorSaveTransport;
  return { accessToken, idempotencyKey, expectedRevision, clientRequestId, payload };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const external = options.signal;
  let onAbort;
  if (external) {
    if (external.aborted) controller.abort();
    else {
      onAbort = () => controller.abort();
      external.addEventListener('abort', onAbort, { once: true });
    }
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted) throw statusError(504, 'Dependência demorou mais que o limite seguro.', { code: 'UPSTREAM_TIMEOUT' });
    throw cause;
  } finally {
    clearTimeout(timer);
    if (external && onAbort) external.removeEventListener('abort', onAbort);
  }
}

function boundedEnvNumber(name, fallback, min, max) {
  const parsed = Number(env(name, String(fallback)));
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, value));
}

function base64urlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + pad, 'base64');
}

function jwtSecret() {
  const secret = env('JWT_SECRET');
  if (!secret || secret.length < 32) throw statusError(500, 'JWT_SECRET não configurado na Save Function.');
  return secret;
}

function validateAccessToken(accessToken) {
  const parts = String(accessToken || '').split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) throw statusError(401, 'Sessão inválida ou expirada.', { code: 'SAVE_SESSION_REJECTED' });
  const [headerPart, payloadPart, signaturePart] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(base64urlDecode(headerPart).toString('utf8'));
    payload = JSON.parse(base64urlDecode(payloadPart).toString('utf8'));
  } catch {
    throw statusError(401, 'Sessão inválida ou expirada.', { code: 'SAVE_SESSION_REJECTED' });
  }
  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') throw statusError(401, 'Sessão inválida ou expirada.', { code: 'SAVE_SESSION_REJECTED' });
  const expected = crypto.createHmac('sha256', jwtSecret()).update(`${headerPart}.${payloadPart}`).digest();
  const actual = base64urlDecode(signaturePart);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw statusError(401, 'Sessão inválida ou expirada.', { code: 'SAVE_SESSION_REJECTED' });
  const now = Math.floor(Date.now() / 1000);
  if (payload?.iss !== 'surveyor-appwrite-function' || payload?.type !== 'access' || !Number.isInteger(payload?.exp) || payload.exp <= now) {
    throw statusError(401, 'Sessão inválida ou expirada.', { code: 'SAVE_SESSION_REJECTED' });
  }
  const user = payload?.user;
  if (!user || typeof user !== 'object' || !String(user.id || payload.sub || '').trim()) throw statusError(401, 'Sessão incompleta.', { code: 'SAVE_SESSION_REJECTED' });
  const status = String(user.status || '').toLowerCase();
  if (['blocked', 'pending', 'expired'].includes(status) || user.isActive === false) throw statusError(403, 'Acesso bloqueado para esta conta.', { code: 'SAVE_SESSION_REJECTED' });
  const expiresAt = Date.parse(String(user.expiresAt || user.subscriptionExpiresAt || ''));
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now() && String(user.role || '').toLowerCase() !== 'admin') {
    throw statusError(403, 'A assinatura desta conta expirou.', { code: 'PLAN_EXPIRED' });
  }
  const verified={...user,id:user.id||payload.sub,email:user.email||payload.email};
  // Estes dados permanecem apenas no servidor; não são adicionados ao projeto.
  Object.defineProperties(verified,{
    __tokenSessionVersion:{value:String(payload.sv||''),enumerable:false},
    __tokenIssuedAt:{value:Number(payload.iat||0),enumerable:false}
  });
  return verified;
}

async function assertLiveSaveAccess(user) {
  const account=await awFetch(`/users/${encodeURIComponent(actorUserId(user))}`);
  if (!account) throw statusError(401,'A conta não pôde ser confirmada.',{code:'ACCOUNT_NOT_VERIFIED'});
  const surveyor=account.prefs?.surveyor && typeof account.prefs.surveyor==='object' ? account.prefs.surveyor : {};
  const accountStatus=String(surveyor.status||'active').toLowerCase();
  if (account.status===false || ['blocked','bloqueado','pending','pendente','expired'].includes(accountStatus)) {
    throw statusError(403,'A conta foi desativada ou está pendente de liberação.',{code:'ACCOUNT_BLOCKED'});
  }
  const sessionVersion=String(surveyor.sessionVersion||'');
  if (sessionVersion && sessionVersion!==user.__tokenSessionVersion) {
    throw statusError(401,'Sessão revogada. Entre novamente.',{code:'SESSION_REVOKED'});
  }
  const remoteLogoutAt=Date.parse(String(surveyor.remoteLogoutAt||''))||0;
  if (remoteLogoutAt && remoteLogoutAt>Number(user.__tokenIssuedAt||0)*1000) {
    throw statusError(401,'Sessão encerrada remotamente. Entre novamente.',{code:'SESSION_REVOKED'});
  }
}

function normalizeWorkspaceRole(value) {
  const role = String(value || 'collaborator').trim().toLowerCase();
  if (['manager', 'gestor'].includes(role)) return 'manager';
  if (['technician', 'tecnico', 'técnico'].includes(role)) return 'technician';
  return 'collaborator';
}

function assertWorkspaceAction(user, action) {
  if (!user?.isSubuser) return;
  const role = normalizeWorkspaceRole(user.workspaceRole);
  const allowed = role === 'manager'
    ? new Set(['project:create', 'project:edit'])
    : role === 'technician'
      ? new Set(['project:create', 'project:edit'])
      : new Set(['project:create', 'project:edit']);
  if (!allowed.has(action)) throw statusError(403, 'Seu perfil de equipe não permite esta operação.', { code: 'WORKSPACE_ROLE_LIMIT' });
}

function resourceOwnerId(user) {
  if (user?.isSubuser) return String(user.workspaceOwnerUserId || '').trim();
  return String(user?.id || '').trim();
}

function actorUserId(user) {
  return String(user?.id || '').trim();
}

function userPermissionSet(user = {}) {
  if (String(user?.role || '').toLowerCase() === 'admin' && user?.isSubuser !== true) return new Set(['admin:all']);
  const source = Array.isArray(user?.effectivePermissions)
    ? user.effectivePermissions
    : (() => { try { return Array.isArray(user?.permissions) ? user.permissions : JSON.parse(String(user?.permissions || '[]')); } catch { return []; } })();
  return new Set((Array.isArray(source) ? source : []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean));
}

function requireUserPermission(user = {}, permission = '') {
  if (String(user?.role || '').toLowerCase() === 'admin' && user?.isSubuser !== true) return true;
  const required = String(permission || '').trim().toLowerCase();
  if (!required) return true;
  if (userPermissionSet(user).has(required)) return true;
  throw statusError(403, 'Seu plano ou perfil não possui permissão para esta operação.', { code: 'PLAN_PERMISSION_REQUIRED', field: required });
}

function appwriteHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Appwrite-Project': projectId(),
    'X-Appwrite-Key': apiKey(),
    ...extra
  };
}

async function parseAppwriteResponse(response) {
  const type = String(response.headers.get('content-type') || '');
  if (type.includes('application/json')) return response.json().catch(() => null);
  return response.text().catch(() => '');
}

function appwriteErrorStatus(status) {
  return status >= 500 ? 502 : status;
}

async function awFetch(path, options = {}) {
  const response = await fetchWithTimeout(`${endpoint()}${path}`, {
    ...options,
    headers: { ...appwriteHeaders(), ...(options.headers || {}) }
  }, Number(env('APPWRITE_UPSTREAM_TIMEOUT_MS', '15000')) || 15000);
  const payload = await parseAppwriteResponse(response);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' ? payload.message : '';
    throw statusError(appwriteErrorStatus(response.status), String(message || 'Falha no Appwrite.').slice(0, 300), { code: payload?.type || 'APPWRITE_ERROR' });
  }
  return payload;
}

async function updateUserActivityPrefs(userId, patch = {}) {
  const id = String(userId || '').trim();
  if (!id) return null;
  const current = await awFetch(`/users/${encodeURIComponent(id)}`).catch(() => null);
  const prefs = current?.prefs && typeof current.prefs === 'object' ? current.prefs : {};
  const surveyor = prefs.surveyor && typeof prefs.surveyor === 'object' ? prefs.surveyor : {};
  const nextSurveyor = { ...surveyor, ...patch };
  Object.keys(nextSurveyor).forEach((key) => { if (nextSurveyor[key] === undefined) delete nextSurveyor[key]; });
  return awFetch(`/users/${encodeURIComponent(id)}/prefs`, {
    method: 'PATCH',
    body: JSON.stringify({ prefs: { ...prefs, surveyor: nextSurveyor } })
  }).catch(() => null);
}

function isPathUnsupported(error) {
  const status = Number(error?.status || 0);
  const text = `${error?.message || ''} ${JSON.stringify(error?.details || {})}`.toLowerCase();
  return status === 404 || status === 405 || /route.*not found|unknown route|not found/.test(text);
}

function appwriteQuery(methodName, attribute, values) {
  const payload = { method: methodName };
  if (attribute) payload.attribute = attribute;
  if (values !== undefined) payload.values = Array.isArray(values) ? values : [values];
  return JSON.stringify(payload);
}

const Query = {
  equal(attribute, values) { return appwriteQuery('equal', attribute, Array.isArray(values) ? values : [values]); },
  limit(value) { return appwriteQuery('limit', '', [Math.max(1, Number(value) || 25)]); },
  offset(value) { return appwriteQuery('offset', '', [Math.max(0, Number(value) || 0)]); }
};

function qs(queries = []) {
  if (!queries.length) return '';
  return `?${queries.map((query) => `queries[]=${encodeURIComponent(query)}`).join('&')}`;
}

function normalizeListPayload(payload) {
  if (Array.isArray(payload?.documents)) return payload.documents;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function rowData(row = {}) {
  if (!row || typeof row !== 'object') return row;
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return { ...data, ...row, $id: row.$id || row.id || row.rowId, id: row.id || row.$id || row.rowId };
}

function invalidDateAttribute(error) {
  const text = `${error?.message || ''} ${JSON.stringify(error?.details || {})}`;
  const match = text.match(/Attribute\s+\\?"(createdAt|updatedAt)\\?"/i);
  return match ? match[1] : '';
}

async function rowWriteWithDateRetry(path, methodName, basePayload, data) {
  let current = { ...data };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await awFetch(path, { method: methodName, body: JSON.stringify({ ...basePayload, data: current }) });
    } catch (error) {
      const field = invalidDateAttribute(error);
      if (!field || !Object.prototype.hasOwnProperty.call(current, field)) throw error;
      const text = `${error?.message || ''} ${JSON.stringify(error?.details || {})}`;
      if (/signed 64-bit integer/i.test(text)) current[field] = Date.parse(current[field]) || Date.now();
      else if (/valid date between/i.test(text)) current[field] = new Date(Date.parse(current[field]) || Date.now()).toISOString();
      else throw error;
    }
  }
  throw statusError(500, 'Não foi possível adaptar o schema de data do Appwrite.');
}

async function listRows(name, queries = []) {
  const id = collectionId(name);
  const query = qs(queries);
  const legacy = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents${query}`;
  try { return normalizeListPayload(await awFetch(legacy)).map(rowData); } catch (error) { if (!isPathUnsupported(error)) throw error; }
  const table = `/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows${query}`;
  return normalizeListPayload(await awFetch(table)).map(rowData);
}

async function listAllRows(name, baseQueries = [], pageSize = 250) {
  const result = [];
  let offset = 0;
  const limit = Math.max(1, Math.min(500, Number(pageSize) || 250));
  while (true) {
    const batch = await listRows(name, [...baseQueries, Query.limit(limit), Query.offset(offset)]);
    result.push(...batch);
    if (batch.length < limit) break;
    offset += batch.length;
    if (result.length > 100000) throw statusError(503, 'Consulta interna excedeu o limite de segurança.');
  }
  return result;
}

async function getRow(name, idValue) {
  const id = collectionId(name);
  const legacy = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents/${encodeURIComponent(idValue)}`;
  try { return rowData(await awFetch(legacy)); } catch (error) { if (!isPathUnsupported(error)) throw error; }
  return rowData(await awFetch(`/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows/${encodeURIComponent(idValue)}`));
}

async function createRow(name, data, rowId = appwriteId()) {
  const id = collectionId(name);
  const legacy = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents`;
  try { return rowData(await rowWriteWithDateRetry(legacy, 'POST', { documentId: rowId }, data)); } catch (error) { if (!isPathUnsupported(error)) throw error; }
  return rowData(await rowWriteWithDateRetry(`/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows`, 'POST', { rowId }, data));
}

async function updateRow(name, rowId, data) {
  const id = collectionId(name);
  const legacy = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents/${encodeURIComponent(rowId)}`;
  try { return rowData(await rowWriteWithDateRetry(legacy, 'PATCH', {}, data)); } catch (error) { if (!isPathUnsupported(error)) throw error; }
  return rowData(await rowWriteWithDateRetry(`/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows/${encodeURIComponent(rowId)}`, 'PATCH', {}, data));
}

async function createFile(bucket, fileName, content, mimeType = 'application/json', fileId = appwriteId()) {
  const form = new FormData();
  form.append('fileId', fileId);
  form.append('file', new Blob([content ?? ''], { type: mimeType }), fileName || `${fileId}.json`);
  const response = await fetchWithTimeout(`${endpoint()}/storage/buckets/${encodeURIComponent(bucket)}/files`, {
    method: 'POST',
    headers: { 'X-Appwrite-Project': projectId(), 'X-Appwrite-Key': apiKey() },
    body: form
  }, Number(env('APPWRITE_UPSTREAM_TIMEOUT_MS', '15000')) || 15000);
  const payload = await parseAppwriteResponse(response);
  if (!response.ok) throw statusError(appwriteErrorStatus(response.status), String(payload?.message || 'Erro ao gravar arquivo no Storage.').slice(0, 300), { code: payload?.type || 'APPWRITE_STORAGE_ERROR' });
  return payload;
}

async function readFileText(bucket, fileId) {
  if (!fileId) return '';
  const response = await fetchWithTimeout(`${endpoint()}/storage/buckets/${encodeURIComponent(bucket)}/files/${encodeURIComponent(fileId)}/view`, {
    headers: { 'X-Appwrite-Project': projectId(), 'X-Appwrite-Key': apiKey() }
  }, Number(env('APPWRITE_UPSTREAM_TIMEOUT_MS', '15000')) || 15000);
  if (!response.ok) return '';
  return response.text();
}

async function deleteFile(bucket, fileId) {
  if (!bucket || !fileId) return;
  const response = await fetchWithTimeout(`${endpoint()}/storage/buckets/${encodeURIComponent(bucket)}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { 'X-Appwrite-Project': projectId(), 'X-Appwrite-Key': apiKey() }
  }, Number(env('APPWRITE_UPSTREAM_TIMEOUT_MS', '15000')) || 15000);
  if (!response.ok && response.status !== 404) throw statusError(appwriteErrorStatus(response.status), 'Erro ao remover arquivo antigo do projeto.');
}

function mapProject(row = {}, payload = {}) {
  const storedProject = payload?.project && typeof payload.project === 'object' ? payload.project : {};
  const storedMetadata = {
    ...(payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    ...(storedProject?.metadata && typeof storedProject.metadata === 'object' ? storedProject.metadata : {})
  };
  return {
    id: row.$id || row.id,
    ownerUserId: row.userId,
    name: storedProject.name || row.name || 'Projeto sem nome',
    propertyName: storedProject.propertyName || row.propertyName || '',
    ownerName: storedProject.ownerName || row.ownerName || '',
    createdByUserId: String(storedMetadata.createdByUserId || storedMetadata.migratedFromStandaloneUserId || row.userId || '').trim(),
    createdByName: String(storedMetadata.createdByName || '').trim(),
    lastSavedByUserId: String(storedMetadata.lastSavedByUserId || storedMetadata.updatedByUserId || '').trim(),
    lastSavedByName: String(storedMetadata.lastSavedByName || storedMetadata.updatedByName || '').trim(),
    lastSavedAt: storedMetadata.lastSavedAt || null,
    municipality: storedProject.municipality || storedProject.city || row.city || '',
    stateCode: storedProject.stateCode || storedProject.uf || row.uf || '',
    status: row.status || storedProject.status || 'draft',
    registrationNumber: storedProject.registrationNumber || '',
    description: storedProject.description || '',
    centerLatitude: storedProject.centerLatitude ?? null,
    centerLongitude: storedProject.centerLongitude ?? null,
    defaultZoom: storedProject.defaultZoom ?? null,
    areaHa: Number(row.areaHa || storedMetadata.areaHa || storedMetadata.areaHectares || 0) || 0,
    perimeterM: Number(row.perimeterM || storedMetadata.perimeterM || storedMetadata.perimeterMeters || 0) || 0,
    metadata: {
      ...storedMetadata,
      folderId: row.folderId || storedMetadata.folderId || '',
      folderName: row.folderName || storedMetadata.folderName || '',
      geojsonFileId: row.geojsonFileId || storedMetadata.geojsonFileId || '',
      featureCount: Array.isArray(payload?.features) ? payload.features.length : Number(storedMetadata.featureCount || 0)
    },
    createdAt: row.createdAt || row.$createdAt || null,
    updatedAt: row.updatedAt || row.$updatedAt || null,
    revision: String(row.updatedAt || row.$updatedAt || '')
  };
}

function mapFeature(feature = {}, projectIdValue, userId) {
  return {
    id: feature.id || appwriteId(),
    projectId: projectIdValue,
    ownerUserId: userId,
    name: feature.name || 'Elemento',
    category: feature.category || 'outros',
    geometryType: feature.geometryType || feature.geoJson?.type || 'Polygon',
    geoJson: feature.geoJson || {},
    areaHectares: feature.areaHectares ?? null,
    perimeterMeters: feature.perimeterMeters ?? null,
    vertexCount: Number(feature.vertexCount || 0) || 0,
    style: feature.style && typeof feature.style === 'object' ? feature.style : {},
    properties: feature.properties && typeof feature.properties === 'object' ? feature.properties : {},
    sortOrder: Number(feature.sortOrder || 0) || 0,
    isVisible: feature.isVisible !== false,
    createdAt: feature.createdAt || null,
    updatedAt: feature.updatedAt || null
  };
}

const PROJECT_DESTRUCTIVE_STATUSES = new Set(['deleted', 'delete', 'trash', 'trashed', 'removed', 'removido', 'excluido', 'excluído']);
const PROJECT_SERVER_METADATA_KEYS = new Set([
  'createdbyuserid', 'createdbyname', 'migratedfromstandaloneuserid',
  'storageowneruserid', 'workspaceowneruserid',
  'lastsavedbyuserid', 'lastsavedbyname', 'lastsavedat',
  'updatedbyuserid', 'updatedbyname',
  'versions', 'secureshares',
  'projectlocked', 'projectlockedat', 'lockedbyuserid', 'lockedat',
  'restoredfromversionid', 'restoredat', 'restoredbyuserid',
  'duplicatedfrom', 'duplicatedat', 'duplicatedbyuserid',
  'clientrequestid'
]);
const PROJECT_SERVER_TOP_LEVEL_KEYS = new Set([
  'id', 'userid', 'owneruserid', 'workspaceowneruserid', 'storageowneruserid',
  'createdbyuserid', 'createdbyname', 'lastsavedbyuserid', 'lastsavedbyname',
  'geojsonfileid', 'fileid', 'revision', 'expectedrevision', 'expectedupdatedat'
]);

function sanitizeStatus(value, fallback = 'draft') {
  const raw = String(value ?? '').trim();
  if (!raw) return String(fallback || 'draft').slice(0, 40);
  if (PROJECT_DESTRUCTIVE_STATUSES.has(raw.toLowerCase())) return String(fallback || 'draft').slice(0, 40);
  return raw.slice(0, 40);
}

function sanitizeProjectClientMetadata(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clean = {};
  for (const [key, entry] of Object.entries(source)) {
    if (PROJECT_SERVER_METADATA_KEYS.has(String(key || '').toLowerCase())) continue;
    clean[key] = entry;
  }
  return clean;
}

function sanitizeProjectClientInput(value = {}, fallbackStatus = 'draft') {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clean = {};
  for (const [key, entry] of Object.entries(source)) {
    if (PROJECT_SERVER_TOP_LEVEL_KEYS.has(String(key || '').toLowerCase())) continue;
    clean[key] = entry;
  }
  clean.metadata = sanitizeProjectClientMetadata(source.metadata);
  clean.status = sanitizeStatus(source.status, fallbackStatus);
  delete clean.force;
  return clean;
}

function projectData(input, userId, now, fileId = '', current = null) {
  const metadata = input?.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  return {
    userId,
    name: String(input?.name || input?.projectName || current?.name || 'Projeto sem nome').slice(0, 240),
    propertyName: String(input?.propertyName || current?.propertyName || '').slice(0, 240),
    ownerName: String(input?.ownerName || current?.ownerName || '').slice(0, 240),
    city: String(input?.municipality || input?.city || metadata.municipality || metadata.city || current?.city || '').slice(0, 120),
    uf: String(input?.stateCode || input?.uf || metadata.stateCode || metadata.uf || current?.uf || '').slice(0, 2).toUpperCase(),
    areaHa: Number(metadata.areaHa || metadata.areaHectares || current?.areaHa || 0) || 0,
    perimeterM: Number(metadata.perimeterM || metadata.perimeterMeters || current?.perimeterM || 0) || 0,
    folderId: String(metadata.folderId || current?.folderId || '').slice(0, 120),
    folderName: String(metadata.folderName || metadata.folder || current?.folderName || '').slice(0, 240),
    geojsonFileId: fileId || String(current?.geojsonFileId || ''),
    previewImageId: String(metadata.previewImageId || current?.previewImageId || '').slice(0, 120),
    status: sanitizeStatus(input?.status, sanitizeStatus(current?.status, 'draft')),
    createdAt: current?.createdAt || current?.$createdAt || now,
    updatedAt: now
  };
}

function canonicalDate(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : String(value);
}

function assertRevisionMatches(row, expected) {
  const wanted = canonicalDate(expected);
  if (!wanted) throw statusError(428, 'A revisão do projeto é obrigatória. Reabra o projeto antes de salvar.', { code: 'PROJECT_REVISION_REQUIRED', field: 'updatedAt' });
  const current = canonicalDate(row?.updatedAt || row?.$updatedAt || '');
  if (current && current !== wanted) {
    throw statusError(409, 'Este projeto foi alterado em outra sessão. Recarregue antes de salvar novamente.', { code: 'EDIT_CONFLICT', field: 'updatedAt' });
  }
}

function projectVersionRetention() {
  const raw = Number(env('PROJECT_VERSION_RETENTION', '20'));
  return Number.isFinite(raw) ? Math.max(3, Math.min(50, Math.trunc(raw))) : 20;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(Buffer.from(String(value || ''), 'utf8')).digest('hex');
}

async function readProjectPayload(row) {
  const text = await readFileText(bucketId('project_files'), row?.geojsonFileId);
  if (!text) return { project: {}, metadata: {}, features: [] };
  const value = decryptJsonText(text, { aad: 'project-payload' });
  if (!value || typeof value !== 'object') throw statusError(409, 'Arquivo atual do projeto está corrompido.', { code: 'PROJECT_PAYLOAD_INVALID' });
  return value;
}

function planLimit(user, key) {
  if (String(user?.role || '').toLowerCase() === 'admin') return null;
  const raw = user?.planLimits?.[key];
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  // Compatibilidade com planos legados: 0/vazio representa quota não configurada,
  // e nunca deve impedir a criação do primeiro projeto.
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function activeProjectCount(ownerId) {
  const rows = await listAllRows('projects', [Query.equal('userId', ownerId)]);
  return rows.filter((row) => String(row.status || '').toLowerCase() !== 'deleted').length;
}

async function assertProjectCapacity(user, ownerId) {
  // R25: todos os planos comerciais possuem projetos ilimitados; o limite real é o armazenamento compartilhado.
  return;
}

async function storageUsageForOwner(ownerId) {
  const [projects, documents] = await Promise.all([
    listAllRows('projects', [Query.equal('userId', ownerId)]),
    listAllRows('documents', [Query.equal('userId', ownerId)])
  ]);
  let projectBytes = 0;
  const active=projects.filter((row)=>String(row.status||'').toLowerCase()!=='deleted' && row.geojsonFileId);
  // Conservador: erro de leitura bloqueia decisão de quota, não vira 0 bytes.
  // Lotes de seis leituras reduzem a latência sem saturar o Storage.
  for(let i=0;i<active.length;i+=6){
    const texts=await Promise.all(active.slice(i,i+6).map(async(row)=>{
      const content=await readFileText(bucketId('project_files'),row.geojsonFileId);
      if (!content) throw statusError(503,'Não foi possível confirmar o uso do Storage.',{code:'STORAGE_USAGE_UNAVAILABLE'});
      return Buffer.byteLength(content,'utf8');
    }));
    projectBytes+=texts.reduce((sum,bytes)=>sum+bytes,0);
  }
  const documentBytes = documents.reduce((sum, row) => {
    const metadata = safeJson(row.metadata, {});
    if (row.bucketId === 'google_drive' || row.storageProvider === 'google_drive' || metadata.storageProvider === 'google_drive') return sum;
    return sum + Math.max(0, Number(row.sizeBytes || metadata.sizeBytes || 0) || 0);
  }, 0);
  return projectBytes + documentBytes;
}

function payloadStorageOwner(payload, fallback) {
  const metadata = payload?.metadata && typeof payload.metadata === 'object'
    ? payload.metadata
    : (payload?.project?.metadata && typeof payload.project.metadata === 'object' ? payload.project.metadata : {});
  return String(metadata.storageOwnerUserId || metadata.createdByUserId || fallback || '').trim();
}

async function subuserProjectBytes(ownerId, actorId) {
  const rows = await listAllRows('projects', [Query.equal('userId', ownerId)]);
  let bytes = 0;
  for (const row of rows) {
    if (String(row.status || '').toLowerCase() === 'deleted' || !row.geojsonFileId) continue;
    const content = await readFileText(bucketId('project_files'), row.geojsonFileId);
    if (!content) throw statusError(503,'Não foi possível confirmar o armazenamento do membro.',{code:'STORAGE_USAGE_UNAVAILABLE'});
    let payload = {};
    try {
      payload = decryptJsonText(content, { aad: 'project-payload' }) || {};
    } catch {
      // Falha conservadora: nunca subcontar armazenamento porque um payload não pôde ser aberto.
      bytes += Buffer.byteLength(content || '', 'utf8');
      continue;
    }
    if (payloadStorageOwner(payload, ownerId) === actorId) bytes += Buffer.byteLength(content || '', 'utf8');
  }
  return bytes;
}

async function assertStorageCapacity(user, ownerId, actorId, incomingBytes, replacedBytes = 0) {
  const limit = planLimit(user, 'storageLimitBytes');
  if (limit != null) {
    const used = await storageUsageForOwner(ownerId);
    const projected = Math.max(0, used - Math.max(0, replacedBytes)) + Math.max(0, incomingBytes);
    if (projected > limit && projected > used) throw statusError(413, 'Limite de armazenamento do plano atingido.', { code: 'STORAGE_LIMIT_REACHED' });
  }
  // Somente a franquia compartilhada do titular é aplicada aos membros da equipe.
}

function normalizeFeatures(features, now) {
  if (!Array.isArray(features)) return [];
  const normalized = features.map((feature, index) => ({
    ...(feature && typeof feature === 'object' ? feature : {}),
    id: String(feature?.id || appwriteId()).slice(0, 120),
    name: String(feature?.name || `Elemento ${index + 1}`).slice(0, 240),
    category: String(feature?.category || 'outros').slice(0, 80),
    geometryType: String(feature?.geometryType || feature?.geoJson?.type || 'Polygon').slice(0, 40),
    geoJson: feature?.geoJson && typeof feature.geoJson === 'object' ? feature.geoJson : {},
    style: feature?.style && typeof feature.style === 'object' ? feature.style : {},
    properties: feature?.properties && typeof feature.properties === 'object' ? feature.properties : {},
    sortOrder: Number(feature?.sortOrder ?? index) || 0,
    createdAt: feature?.createdAt || now,
    updatedAt: now
  }));
  validateProjectFeatures(normalized, {
    maxFeatures: env('MAX_PROJECT_FEATURES', '25000'),
    maxVerticesTotal: env('MAX_PROJECT_VERTICES_TOTAL', '250000'),
    maxVerticesPerRing: env('MAX_PROJECT_VERTICES_PER_RING', '2000'),
    maxVerticesPerLine: env('MAX_PROJECT_VERTICES_PER_LINE', '10000')
  });
  return normalized;
}

function deterministicProjectId(ownerId, idempotencyKey) {
  if (!idempotencyKey) return appwriteId();
  return crypto.createHash('sha256').update(`${ownerId}:${idempotencyKey}`).digest('hex').slice(0, 36);
}

async function createVerifiedFile(fileName, content, fileId = appwriteId()) {
  const bucket = bucketId('project_files');
  await createFile(bucket, fileName, content, 'application/json', fileId);
  const verification = await readFileText(bucket, fileId).catch(() => '');
  if (verification !== content) {
    await deleteFile(bucket, fileId).catch(() => null);
    throw statusError(502, 'O arquivo salvo não pôde ser verificado. A operação foi cancelada.', { code: 'PROJECT_FILE_VERIFICATION_FAILED' });
  }
  return fileId;
}

async function stageVersion(row, currentPayload, actorId) {
  const content = encryptJsonText(currentPayload || {}, { aad: 'project-payload' });
  const fileId = appwriteId();
  const projectIdValue = String(row.$id || row.id || 'project');
  await createVerifiedFile(`version-${projectIdValue}-${fileId}.json`, content, fileId);
  return {
    id: appwriteId(),
    createdAt: new Date().toISOString(),
    type: 'bundle',
    featureCount: Array.isArray(currentPayload?.features) ? currentPayload.features.length : 0,
    fileId,
    bucketId: bucketId('project_files'),
    checksum: sha256Hex(content),
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    createdByUserId: actorId
  };
}

async function cleanupVersionFiles(versions) {
  for (const version of versions || []) {
    if (!version?.fileId) continue;
    await deleteFile(version.bucketId || bucketId('project_files'), version.fileId).catch(() => null);
  }
}

async function createProject(user, transport) {
  requireUserPermission(user, 'projects:create');
  assertWorkspaceAction(user, 'project:create');
  const ownerId = resourceOwnerId(user);
  const actorId = actorUserId(user);
  if (!ownerId || !actorId) throw statusError(401, 'Identidade incompleta para salvar projeto.');
  const body = transport.payload || {};
  const rawInput = body.project && typeof body.project === 'object' ? body.project : body;
  const input = sanitizeProjectClientInput(rawInput, 'draft');
  const now = new Date().toISOString();
  const features = normalizeFeatures(body.features, now);
  const rowId = deterministicProjectId(ownerId, transport.idempotencyKey);

  if (transport.idempotencyKey) {
    const existing = await getRow('projects', rowId).catch(() => null);
    if (existing) {
      if (String(existing.userId || '') !== ownerId) throw statusError(409, 'Conflito de identificador de salvamento.');
      const current = await readProjectPayload(existing);
      return { status: 200, project: mapProject(existing, current), features: (current.features || []).map((f) => mapFeature(f, rowId, ownerId)) };
    }
  }

  await assertProjectCapacity(user, ownerId);
  const metadata = {
    ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
    createdByUserId: actorId,
    createdByName: String(user.name || '').slice(0, 240),
    storageOwnerUserId: actorId,
    workspaceOwnerUserId: ownerId,
    clientRequestId: transport.idempotencyKey || transport.clientRequestId || ''
  };
  const payload = { project: { ...input, metadata }, metadata, features, createdAt: now, updatedAt: now };
  const content = encryptJsonText(payload, { aad: 'project-payload' });
  await assertStorageCapacity(user, ownerId, actorId, Buffer.byteLength(content, 'utf8'), 0);
  const fileId = await createVerifiedFile(`${rowId}.json`, content);
  let row;
  try {
    row = await createRow('projects', projectData({ ...input, metadata }, ownerId, now, fileId), rowId);
  } catch (error) {
    await deleteFile(bucketId('project_files'), fileId).catch(() => null);
    throw error;
  }
  await updateUserActivityPrefs(actorId, {
    lastActivityAt: now,
    presenceLastSeenAt: now,
    lastProjectId: rowId,
    lastProjectName: String(input.propertyName || input.name || 'Projeto').slice(0, 240),
    lastProjectAt: now
  });
  return { status: 201, project: mapProject(row, payload), features: features.map((f) => mapFeature(f, rowId, ownerId)) };
}

async function updateProject(user, projectIdValue, transport) {
  requireUserPermission(user, 'projects:edit-own');
  assertWorkspaceAction(user, 'project:edit');
  const ownerId = resourceOwnerId(user);
  const actorId = actorUserId(user);
  if (!ownerId || !actorId) throw statusError(401, 'Identidade incompleta para salvar projeto.');
  const row = await getRow('projects', projectIdValue).catch(() => null);
  if (!row || String(row.userId || '') !== ownerId || String(row.status || '').toLowerCase() === 'deleted') {
    throw statusError(404, 'Projeto não encontrado.');
  }
  const body = transport.payload || {};
  const rawInput = body.project && typeof body.project === 'object' ? body.project : {};
  assertRevisionMatches(row, transport.expectedRevision || rawInput.expectedUpdatedAt || rawInput.expectedRevision || rawInput.revision || rawInput.updatedAt || '');
  const input = sanitizeProjectClientInput(rawInput, row.status || 'draft');

  const currentPayload = await readProjectPayload(row);
  const currentMetadata = currentPayload.metadata && typeof currentPayload.metadata === 'object'
    ? currentPayload.metadata
    : (currentPayload.project?.metadata && typeof currentPayload.project.metadata === 'object' ? currentPayload.project.metadata : {});
  if (currentMetadata.projectLocked) throw statusError(423, 'Projeto travado. Destrave antes de alterar.', { code: 'PROJECT_LOCKED' });

  const now = new Date().toISOString();
  const features = normalizeFeatures(Array.isArray(body.features) ? body.features : currentPayload.features, now);
  const version = await stageVersion(row, currentPayload, actorId);
  const oldVersions = Array.isArray(currentMetadata.versions) ? currentMetadata.versions : [];
  const combined = [...oldVersions, version];
  const retention = projectVersionRetention();
  const expired = combined.slice(0, Math.max(0, combined.length - retention));
  const kept = combined.slice(-retention);
  const metadata = {
    ...currentMetadata,
    ...(currentPayload.project?.metadata && typeof currentPayload.project.metadata === 'object' ? currentPayload.project.metadata : {}),
    ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
    createdByUserId: currentMetadata.createdByUserId || actorId,
    storageOwnerUserId: currentMetadata.storageOwnerUserId || actorId,
    workspaceOwnerUserId: ownerId,
    versions: kept,
    lastSavedByUserId: actorId,
    lastSavedByName: String(user.name || '').slice(0, 240),
    lastSavedAt: now,
    clientRequestId: transport.idempotencyKey || transport.clientRequestId || ''
  };
  const mergedProject = { ...(currentPayload.project || {}), ...input, metadata };
  const nextPayload = { ...currentPayload, project: mergedProject, metadata, features, updatedAt: now };
  const nextContent = encryptJsonText(nextPayload, { aad: 'project-payload' });
  const previousStoredContent = row.geojsonFileId
    ? await readFileText(bucketId('project_files'), row.geojsonFileId).catch(() => '')
    : '';
  await assertStorageCapacity(user, ownerId, actorId, Buffer.byteLength(nextContent, 'utf8'), Buffer.byteLength(previousStoredContent, 'utf8'));

  let nextFileId = '';
  try {
    nextFileId = await createVerifiedFile(`${projectIdValue}-${appwriteId()}.json`, nextContent);
    const patch = projectData(mergedProject, ownerId, now, nextFileId, row);
    delete patch.createdAt;
    const saved = await updateRow('projects', projectIdValue, patch);
    if (row.geojsonFileId && row.geojsonFileId !== nextFileId) await deleteFile(bucketId('project_files'), row.geojsonFileId).catch(() => null);
    await cleanupVersionFiles(expired);
    await updateUserActivityPrefs(actorId, {
      lastActivityAt: now,
      presenceLastSeenAt: now,
      lastProjectId: projectIdValue,
      lastProjectName: String(mergedProject.propertyName || mergedProject.name || row.propertyName || row.name || 'Projeto').slice(0, 240),
      lastProjectAt: now
    });
    return { status: 200, project: mapProject(saved, nextPayload), features: features.map((f) => mapFeature(f, projectIdValue, ownerId)) };
  } catch (error) {
    if (nextFileId) await deleteFile(bucketId('project_files'), nextFileId).catch(() => null);
    await deleteFile(bucketId('project_files'), version.fileId).catch(() => null);
    throw error;
  }
}

async function readyCheck() {
  await listRows('projects', [Query.limit(1)]);
  return true;
}

async function route(request, response, log) {
  const path = parsePath(request);
  const httpMethod = method(request);

  if (httpMethod === 'OPTIONS') {
    assertTrustedOrigin(request);
    return send(response, request, 204, null);
  }

  if (path === '/' || path === '/api/live') {
    return send(response, request, 200, { ok: true, service: SERVICE_NAME, status: 'live', version: APP_VERSION });
  }

  if (path === '/api/ready') {
    try {
      await readyCheck();
      return send(response, request, 200, { ok: true, service: SERVICE_NAME, status: 'ready', databaseReachable: true, version: APP_VERSION });
    } catch {
      return send(response, request, 503, { ok: false, service: SERVICE_NAME, status: 'not_ready', databaseReachable: false, version: APP_VERSION }, { 'Retry-After': '30' });
    }
  }

  const create = path === '/api/projects' && httpMethod === 'POST';
  const bundle = path.match(/^\/api\/projects\/([^/]+)\/bundle$/);
  const update = Boolean(bundle) && httpMethod === 'POST';
  if (!create && !update) throw statusError(404, 'Rota não encontrada na Surveyor Save Function.');

  assertTrustedOrigin(request);
  assertSaveRateLimit(request);
  const transport = await parseSaveEnvelope(request);
  const user = validateAccessToken(transport.accessToken);
  await assertLiveSaveAccess(user);
  const result = create
    ? await createProject(user, transport)
    : await updateProject(user, decodeURIComponent(bundle[1]), transport);

  log?.(`[save] action=${create ? 'create' : 'update'} actor=${actorUserId(user)} owner=${resourceOwnerId(user)} project=${result.project?.id || ''}`);
  return send(response, request, result.status, { ok: true, project: result.project, features: result.features });
}

export default async function main({ req, res, log, error }) {
  try {
    if (!projectId()) throw statusError(500, 'APPWRITE_PROJECT_ID não configurado.');
    if (!apiKey()) throw statusError(500, 'SURVEYOR_SAVE_APPWRITE_API_KEY não configurado.');
    assertCryptoReady();
    return await route(req, res, log);
  } catch (cause) {
    const rid = appwriteId();
    const status = Number(cause?.status || 500);
    error?.(`[${rid}] ${cause?.stack || cause?.message || String(cause)}`);
    const publicMessage = status >= 500
      ? 'Não foi possível concluir o salvamento. Tente novamente em alguns instantes.'
      : String(cause?.message || 'Requisição inválida.');
    const safeDetails = cause?.details && typeof cause.details === 'object'
      ? Object.fromEntries(Object.entries(cause.details).filter(([key]) => ['code', 'field'].includes(key)))
      : undefined;
    return send(res, req || {}, Number.isFinite(status) ? status : 500, {
      ok: false,
      error: publicMessage,
      requestId: rid,
      details: safeDetails
    }, { 'X-Request-ID': rid });
  }
}
