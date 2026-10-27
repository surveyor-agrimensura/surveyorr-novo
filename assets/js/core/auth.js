(() => {
  'use strict';

  const CONFIG = window.GEORURAL_CONFIG || {
    mode: 'api',
    apiBaseUrl: 'https://api.surveyorr.com.br',
    authEndpoint: '/api/auth',
    layersEndpoint: '/api/layers',
    adminEndpoint: '/api/admin'
  };

  const KEYS = {
    session: 'georural-auth-session-v3',
    plans: 'georural-api-plans-v3',
    users: 'georural-api-users-v2',
    layers: 'georural-layer-catalog-v3',
    layerPrefs: 'georural-user-layer-prefs-v3',
    layerCatalogState: 'surveyor-layer-catalog-state-v1',
    layerCatalogStateConfigured: 'surveyor-layer-catalog-state-configured-v1',
    apiCache: 'georural-api-cache-v21-9-317',
    customizationMirror: 'georural-document-customization-mirror-v1',
    lastActivity: 'georural-auth-last-activity-v1'
  };

  const LEGACY_KEYS = [
    'georural-auth-session-v1',
    'georural-auth-session-v2',
    'georural-auth-state-v1',
    'georural-demo-session'
  ];

  const nowIso = () => new Date().toISOString();
  const uid = (prefix = 'id') => crypto.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const isOfficialSurveyorWeb = () => {
    const host = String(location.hostname || '').toLowerCase();
    return location.protocol === 'https:' && (host === 'surveyorr.com.br' || host.endsWith('.surveyorr.com.br'));
  };
  const storageFor = () => sessionStorage;
  // R26.3.70 — sessão intencionalmente efêmera. O token de acesso pertence à
  // aba atual e não é mais espelhado em localStorage. Além do sessionStorage,
  // mantemos uma cópia somente em memória para impedir que uma limpeza acidental
  // de storage durante o uso derrube o salvamento do projeto no mesmo documento.
  let activeSessionRecord = null;
  try { localStorage.removeItem(KEYS.session); } catch {}
  const parseStoredRecord = (raw) => {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value === 'object' ? value : null;
    } catch { return null; }
  };
  const read = (key, fallback) => {
    try {
      if (key === KEYS.session) {
        if (activeSessionRecord && typeof activeSessionRecord === 'object') return activeSessionRecord;
        const value = parseStoredRecord(sessionStorage.getItem(key));
        if (value) activeSessionRecord = value;
        return value || fallback;
      }
      const raw = storageFor(key).getItem(key);
      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    const raw = JSON.stringify(value);
    storageFor(key).setItem(key, raw);
    if (key === KEYS.session) {
      activeSessionRecord = value && typeof value === 'object' ? value : null;
      // Nunca persista novamente a autenticação no navegador após fechar/recarregar.
      try { localStorage.removeItem(key); } catch {}
    }
  };
  const clear = (key) => {
    if (key === KEYS.session) activeSessionRecord = null;
    try { sessionStorage.removeItem(key); } catch {}
    try { localStorage.removeItem(key); } catch {}
  };

  const SESSION_REVOCATION_CODES = new Set([
    'ACCOUNT_BLOCKED', 'ACCOUNT_PENDING', 'PLAN_EXPIRED',
    'WORKSPACE_MEMBER_BLOCKED', 'WORKSPACE_MEMBER_PENDING',
    'WORKSPACE_OWNER_NOT_FOUND', 'WORKSPACE_LINK_INVALID', 'SESSION_REVOKED'
  ]);
  const SESSION_WATCH_VISIBLE_MS = 60_000;
  const SESSION_WATCH_HIDDEN_MS = 5 * 60_000;
  const SESSION_IDLE_TIMEOUT_MS = 20 * 60_000;
  const ACTIVITY_WRITE_THROTTLE_MS = 15_000;
  let lastActivityWriteAt = 0;
  let sessionWatchTimer = null;
  let sessionWatchInFlight = false;
  let lastPresenceSentAt = 0;
  const PRESENCE_HEARTBEAT_MS = 5 * 60_000;

  function sessionRevocationReason(error = {}) {
    const code = String(error?.code || error?.details?.code || '').trim().toUpperCase();
    if (SESSION_REVOCATION_CODES.has(code)) return code;
    const text = String(error?.message || '').toLowerCase();
    if (/conta bloqueada|usu[aá]rio est[aá] bloqueado|acesso compartilhado foi bloqueado/.test(text)) return 'ACCOUNT_BLOCKED';
    if (/falta de pagamento|plano.*expir|assinatura.*expir/.test(text)) return 'PLAN_EXPIRED';
    if (/sess[aã]o.*revog|sess[aã]o.*encerrad|sess[aã]o.*substitu/.test(text)) return 'SESSION_REVOKED';
    return '';
  }

  function recordSessionActivity(force = false) {
    if (!getSession()?.accessToken) return;
    const now = Date.now();
    let previous = 0;
    try { previous = Number(sessionStorage.getItem(KEYS.lastActivity) || 0); } catch {}
    // Depois de atingir o limite de inatividade, uma interação tardia não deve
    // reviver silenciosamente a sessão. A próxima navegação/reload exigirá login.
    if (!force && Number.isFinite(previous) && previous > 0 && now - previous > SESSION_IDLE_TIMEOUT_MS) return;
    if (!force && now - lastActivityWriteAt < ACTIVITY_WRITE_THROTTLE_MS) return;
    lastActivityWriteAt = now;
    try { sessionStorage.setItem(KEYS.lastActivity, String(now)); } catch {}
  }

  function clearSessionActivity() {
    lastActivityWriteAt = 0;
    try { sessionStorage.removeItem(KEYS.lastActivity); } catch {}
  }

  function sessionIdleExpired() {
    if (!getSession()?.accessToken) return false;
    let last = 0;
    try { last = Number(sessionStorage.getItem(KEYS.lastActivity) || 0); } catch {}
    if (!Number.isFinite(last) || last <= 0) {
      recordSessionActivity(true);
      return false;
    }
    return Date.now() - last > SESSION_IDLE_TIMEOUT_MS;
  }

  function revokeLocalSession(reason = 'SESSION_REVOKED', message = '') {
    clear(KEYS.session);
    clearSessionActivity();
    invalidateApiCache();
    const detail = {
      reason: String(reason || 'SESSION_REVOKED').toUpperCase(),
      message: String(message || 'Sua sessão foi encerrada. Entre novamente.'),
      at: nowIso()
    };
    try { window.dispatchEvent(new CustomEvent('georural:session-revoked', { detail })); } catch {}
    return detail;
  }

  // A autenticação não é sincronizada entre abas: cada aba exige sua própria sessão.


  const CACHE_TTL = {
    sessionMe: 60_000,
    // Recursos quase estáticos ficam em cache por mais tempo para reduzir leituras do Appwrite.
    plans: 6 * 60 * 60_000,
    // Catálogo oficial pode ter dezenas/centenas de registros. Atualização manual continua imediata.
    layers: 7 * 24 * 60 * 60_000,
    layerPrefs: 24 * 60 * 60_000,
    adminFast: 2 * 60_000,
    projects: 5 * 60_000,
    documents: 5 * 60_000,
    customization: 20 * 60_000,
    // Avisos não precisam consultar o banco a cada minuto.
    notices: 60_000
  };


  // REV11: evita requisições GET duplicadas no mesmo carregamento.
  const inFlightGetRequests = new Map();
  const LAYER_CATALOG_EVENT_KEY = 'surveyor-layer-catalog-event-v1';
  let layerCatalogChannel = null;
  const layerCatalogListeners = new Set();
  try { if ('BroadcastChannel' in window) layerCatalogChannel = new BroadcastChannel('surveyor-layer-catalog'); } catch {}

  function emitLayerCatalogChanged(reason = 'catalog-update') {
    const detail = { reason, at: Date.now(), nonce: uid('layers') };
    try { layerCatalogChannel?.postMessage(detail); } catch {}
    try { localStorage.setItem(LAYER_CATALOG_EVENT_KEY, JSON.stringify(detail)); } catch {}
    layerCatalogListeners.forEach((listener) => { try { listener(detail); } catch {} });
    return detail;
  }

  function onLayerCatalogChanged(listener) {
    if (typeof listener !== 'function') return () => {};
    layerCatalogListeners.add(listener);
    return () => layerCatalogListeners.delete(listener);
  }

  layerCatalogChannel?.addEventListener?.('message', (event) => layerCatalogListeners.forEach((listener) => { try { listener(event.data || {}); } catch {} }));
  window.addEventListener('storage', (event) => {
    if (event.key !== LAYER_CATALOG_EVENT_KEY || !event.newValue) return;
    let detail = {}; try { detail = JSON.parse(event.newValue); } catch {}
    layerCatalogListeners.forEach((listener) => { try { listener(detail); } catch {} });
  });

  let healthState = { at: 0, value: null, promise: null };
  let sessionWarmupPromise = null;

  function safeSessionJson(key, fallback) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }

  function safeSessionWrite(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn('[cache] não foi possível persistir cache leve:', error); }
  }

  const PERSISTENT_API_CACHE_KEY = 'georural-api-persistent-cache-v1';
  function safeLocalJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }
  function safeLocalWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn('[cache] não foi possível persistir cache local:', error); }
  }
  function currentCacheUserKey() {
    const session = getSession();
    const user = session?.user || {};
    const id = String(user.id || user.sub || user.email || 'anon').toLowerCase();
    const plan = String(user.planSlug || user.plan || '').toLowerCase();
    const role = String(user.role || '').toLowerCase();
    return `${id}::${plan}::${role}`;
  }

  function normalizeCachePath(path) {
    const raw = String(path || '');
    try {
      const url = new URL(raw, 'https://cache.local');
      url.searchParams.delete('ts');
      url.searchParams.delete('_');
      return `${url.pathname}${url.search}`;
    } catch {
      return raw.replace(/([?&])(ts|_)=\d+/g, '').replace(/[?&]$/, '');
    }
  }

  function apiCacheKey(path) {
    return `${currentCacheUserKey()}::${normalizeCachePath(path)}`;
  }

  function persistentCacheEligible(path) {
    const normalized = normalizeCachePath(path);
    return normalized === '/api/layers/catalog'
      || normalized === '/api/layers/preferences'
      || normalized === '/api/plans'
      || normalized === '/api/notices'
      || normalized === '/api/system/notices'
      || normalized === '/api/notifications';
  }

  function readApiCache(path, ttlMs) {
    if (!ttlMs || ttlMs <= 0) return null;
    const key = apiCacheKey(path);
    const sessionStore = safeSessionJson(KEYS.apiCache, {});
    let entry = sessionStore[key];
    if (!entry && persistentCacheEligible(path)) entry = safeLocalJson(PERSISTENT_API_CACHE_KEY, {})[key];
    if (!entry || Date.now() - Number(entry.at || 0) > ttlMs) return null;
    return entry.value ?? null;
  }

  function writeApiCache(path, value) {
    const key = apiCacheKey(path);
    const entry = { at: Date.now(), value };
    const store = safeSessionJson(KEYS.apiCache, {});
    store[key] = entry;
    const keys = Object.keys(store);
    if (keys.length > 80) {
      keys.sort((a, b) => Number(store[a]?.at || 0) - Number(store[b]?.at || 0));
      keys.slice(0, keys.length - 80).forEach((cacheKey) => delete store[cacheKey]);
    }
    safeSessionWrite(KEYS.apiCache, store);

    if (persistentCacheEligible(path)) {
      const persistent = safeLocalJson(PERSISTENT_API_CACHE_KEY, {});
      persistent[key] = entry;
      const persistentKeys = Object.keys(persistent);
      if (persistentKeys.length > 24) {
        persistentKeys.sort((a, b) => Number(persistent[a]?.at || 0) - Number(persistent[b]?.at || 0));
        persistentKeys.slice(0, persistentKeys.length - 24).forEach((cacheKey) => delete persistent[cacheKey]);
      }
      safeLocalWrite(PERSISTENT_API_CACHE_KEY, persistent);
    }
  }

  function invalidateApiCache(pattern = '') {
    const stores = [
      { value: safeSessionJson(KEYS.apiCache, {}), save: (value) => safeSessionWrite(KEYS.apiCache, value) },
      { value: safeLocalJson(PERSISTENT_API_CACHE_KEY, {}), save: (value) => safeLocalWrite(PERSISTENT_API_CACHE_KEY, value) }
    ];
    if (!pattern) {
      stores.forEach((store) => store.save({}));
      return;
    }
    const rx = pattern instanceof RegExp ? pattern : new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    stores.forEach((store) => {
      Object.keys(store.value).forEach((key) => { if (rx.test(key)) delete store.value[key]; });
      store.save(store.value);
    });
  }



  function customizationMirrorKey() {
    const session = getSession();
    const user = session?.user || {};
    // A identidade documental pertence ao workspace. Membros da mesma equipe
    // compartilham a personalização do titular também no espelho local descartável.
    const ownerId = String(user.ownerUserId || user.workspaceOwnerUserId || user.id || user.sub || user.email || 'anon').toLowerCase();
    const plan = String(user.planSlug || user.plan || '').toLowerCase();
    return `${KEYS.customizationMirror}::${ownerId}::${plan}`;
  }

  function readCustomizationMirror() {
    try { return JSON.parse(localStorage.getItem(customizationMirrorKey()) || sessionStorage.getItem(customizationMirrorKey()) || 'null') || {}; }
    catch { return {}; }
  }

  function writeCustomizationMirror(value = {}) {
    const incoming = value && typeof value === 'object' ? value : {};
    const previous = readCustomizationMirror();
    const clean = { ...previous, ...incoming };
    if (previous?.options || incoming?.options) clean.options = { ...(previous?.options || {}), ...(incoming?.options || {}) };
    // Campos binários opcionais não podem desaparecer em um salvamento parcial.
    // Quando o campo vem explicitamente (inclusive vazio), respeitamos a ação;
    // quando ele é omitido, preservamos a cópia anterior.
    ['logoDataUrl','planDocumentSignatureDataUrl','baseTemplateContent'].forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(incoming, field) && Object.prototype.hasOwnProperty.call(previous, field)) clean[field] = previous[field];
    });
    try { localStorage.setItem(customizationMirrorKey(), JSON.stringify(clean)); } catch {}
    try { sessionStorage.setItem(customizationMirrorKey(), JSON.stringify(clean)); } catch {}
  }

  function hasUsefulCustomization(value = {}) {
    const options = value?.options && typeof value.options === 'object' ? value.options : {};
    const hasDocumentOptions = Boolean(
      String(options.memorialTemplateId || options.memorialTemplateMode || options.selectedTarget || '').trim()
      || Object.keys(options).length
    );
    return Boolean(
      String(value.companyName || value.addressText || value.responsibleTechnician || value.professionalRegistry || value.footerText || value.websiteUrl || value.logoDataUrl || value.planDocumentSignatureDataUrl || '').trim()
      || hasDocumentOptions
    );
  }

  function mergeCustomization(remote = {}, mirror = {}) {
    const merged = { ...(mirror || {}), ...(remote || {}) };
    if (!hasUsefulCustomization(remote) && hasUsefulCustomization(mirror)) return { ...mirror, ...(remote || {}), options: mirror.options || remote.options || {} };
    if (remote?.options || mirror?.options) merged.options = { ...(mirror.options || {}), ...(remote.options || {}) };
    if (!String(merged.planDocumentSignatureDataUrl || '').trim() && String(mirror?.planDocumentSignatureDataUrl || '').trim()) {
      merged.planDocumentSignatureDataUrl = mirror.planDocumentSignatureDataUrl;
    }
    if (!String(merged.logoDataUrl || '').trim() && String(mirror?.logoDataUrl || '').trim()) merged.logoDataUrl = mirror.logoDataUrl;
    return merged;
  }

  async function cachedApiFetch(path, ttlMs, options = {}, allowRefresh = true) {
    const method = String(options.method || 'GET').toUpperCase();
    const forceRefresh = Boolean(options.forceRefresh || options.noCache || options.__forceRefresh);
    const cleanOptions = { ...options };
    delete cleanOptions.forceRefresh;
    delete cleanOptions.noCache;
    delete cleanOptions.__forceRefresh;

    if (method === 'GET' && !forceRefresh) {
      const cached = readApiCache(path, ttlMs);
      if (cached != null) return cached;
    }

    if (method !== 'GET') return apiFetch(path, cleanOptions, allowRefresh);

    const requestKey = `${apiCacheKey(path)}::${forceRefresh ? 'refresh' : 'normal'}`;
    if (inFlightGetRequests.has(requestKey)) return inFlightGetRequests.get(requestKey);

    const request = apiFetch(path, { ...cleanOptions, cache: cleanOptions.cache || 'default' }, allowRefresh)
      .then((data) => {
        if (ttlMs > 0) writeApiCache(path, data);
        return data;
      })
      .finally(() => inFlightGetRequests.delete(requestKey));

    inFlightGetRequests.set(requestKey, request);
    return request;
  }

  async function cachedApiFetchFallbackMany(paths = [], ttlMs, options = {}, allowRefresh = true) {
    const list = Array.isArray(paths) ? paths.filter(Boolean) : [paths].filter(Boolean);
    let lastError = null;
    for (const path of list) {
      try {
        return await cachedApiFetch(path, ttlMs, options, allowRefresh);
      } catch (error) {
        const isMissingRoute = error?.status === 404 || /rota n[aã]o encontrada|not found/i.test(error?.message || '');
        lastError = error;
        // Não masque erros reais (403/409/500/503 etc.) tentando uma rota legada.
        // Isso era a causa de falhas de equipe aparecerem como “rota não encontrada”.
        if (!isMissingRoute) throw error;
      }
    }
    throw lastError || new Error('Nenhuma rota de API respondeu.');
  }

  function removeLegacyDemoSessions() {
    LEGACY_KEYS.forEach(clear);
    const current = read(KEYS.session, null);
    if (current?.user?.email?.endsWith('@georural.local') || (current?.user && !current?.accessToken)) clear(KEYS.session);
  }

  function getSession() {
    const session = normalizeSessionRecord(read(KEYS.session, null));
    if (!session?.accessToken || session?.user?.email?.endsWith('@georural.local')) return null;
    const persisted = read(KEYS.session, null);
    if (persisted && (persisted.accessToken !== session.accessToken || JSON.stringify(persisted.user || null) !== JSON.stringify(session.user || null))) {
      try { write(KEYS.session, session); } catch {}
    }
    return session;
  }

  function currentUser() {
    return getSession()?.user || null;
  }

  function currentPlan() {
    const user = currentUser();
    if (!user) return null;
    const userPlanKeys = [user.planId, user.planSlug, user.plan, user.billingPlan].map((item) => String(item || '').toLowerCase()).filter(Boolean);
    const aliases = { basic: 'basic_annual', plus: 'plus_annual', pro: 'pro_annual', 'pro-max': 'pro_annual', promax: 'pro_annual' };
    const normalizedKeys = new Set(userPlanKeys.flatMap((key) => [key, aliases[key]].filter(Boolean)));
    return read(KEYS.plans, []).find((plan) => normalizedKeys.has(String(plan.id || '').toLowerCase()) || normalizedKeys.has(String(plan.slug || '').toLowerCase())) || null;
  }

  function isExpired(user) {
    if (!user?.expiresAt) return false;
    const raw = String(user.expiresAt).trim();
    const end = new Date(raw);
    if (!Number.isFinite(end.getTime())) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /T00:00:00(?:\.000)?Z$/i.test(raw)) end.setUTCHours(23, 59, 59, 999);
    return end.getTime() < Date.now();
  }

  function renewalDaysLeft(user = currentUser()) {
    if (!user?.expiresAt) return null;
    const end = new Date(user.expiresAt);
    if (!Number.isFinite(end.getTime())) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const expiry = new Date(end); expiry.setHours(0,0,0,0);
    return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  }


  function normalizeSessionUser(user) {
    if (!user || typeof user !== 'object') return user;
    const normalized = { ...user };
    const status = String(normalized.status || '').toLowerCase();
    if (!status && normalized.isActive === true) normalized.status = 'active';
    if (String(normalized.status || '').toLowerCase() === 'ativo') normalized.status = 'active';
    ['permissions', 'planPermissions', 'effectivePermissions', 'features', 'scopes'].forEach((key) => {
      if (typeof normalized[key] === 'string') {
        const raw = normalized[key].trim();
        try {
          const parsed = raw ? JSON.parse(raw) : null;
          if (Array.isArray(parsed)) normalized[key] = parsed;
          else if (parsed && typeof parsed === 'object') normalized[key] = Object.entries(parsed).filter(([, enabled]) => enabled !== false).map(([permission]) => permission === 'all' ? 'admin:all' : permission);
          else normalized[key] = raw ? [raw] : [];
        } catch {
          normalized[key] = raw ? raw.split(/[;,\s]+/).filter(Boolean) : [];
        }
      }
      if (!Array.isArray(normalized[key])) normalized[key] = [];
      normalized[key] = [...new Set(normalized[key].map((item) => String(item || '').trim()).filter(Boolean))];
    });
    normalized.planSlug = String(normalized.planSlug || normalized.planId || normalized.plan || '').trim().toLowerCase();
    if (normalized.role === 'admin' && !normalized.permissions.includes('admin:all')) normalized.permissions.push('admin:all');
    return normalized;
  }

  function normalizeSessionRecord(session) {
    if (!session || typeof session !== 'object') return null;
    const normalized = { ...session };
    // Compatibilidade entre versões da Function Appwrite: algumas builds retornavam
    // token, outras accessToken. O frontend deve aceitar as duas sem derrubar sessão.
    if (!normalized.accessToken && normalized.token) normalized.accessToken = normalized.token;
    if (!normalized.refreshToken && normalized.refresh_token) normalized.refreshToken = normalized.refresh_token;
    if (!normalized.refreshToken) delete normalized.refreshToken;
    if (normalized.user) normalized.user = normalizeSessionUser(normalized.user);
    return normalized;
  }

  function isActiveUser(user) {
    const status = String(user?.status || '').toLowerCase();
    return status === 'active' || status === 'ativo' || user?.isActive === true;
  }

  function normalizeEmail(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase();
  }

  function apiUrl(path) {
    const base = String(CONFIG.apiBaseUrl || '').replace(/\/$/, '');
    const suffix = String(path || '').startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  function saveApiUrl(path) {
    const base = String(CONFIG.saveApiBaseUrl || CONFIG.apiBaseUrl || '').replace(/\/$/, '');
    const suffix = String(path || '').startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
  }


  function attachSessionAuthHeaders(headers, session) {
    if (!session?.accessToken) return headers;
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${session.accessToken}`);
    return headers;
  }

  async function parseResponse(response) {
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); }
    catch { return { ok: response.ok, error: text }; }
  }

  function retryDelayFromResponse(response, fallbackMs = 1800) {
    const header = response?.headers?.get?.('Retry-After');
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(15000, seconds * 1000);
    return fallbackMs;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const API_REQUEST_TIMEOUT_MS = 20_000;

  function clientRequestId() {
    try { return crypto.randomUUID(); } catch { return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  }

  function clientIdempotencyKey(prefix = 'mutation') {
    return `${prefix}-${clientRequestId()}`.slice(0, 120);
  }

  function timeoutController(externalSignal, timeoutMs = API_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const abort = () => controller.abort(externalSignal?.reason || new DOMException('Operação cancelada.', 'AbortError'));
    if (externalSignal?.aborted) abort();
    else externalSignal?.addEventListener?.('abort', abort, { once: true });
    const timeout = setTimeout(() => controller.abort(new DOMException('Tempo limite excedido.', 'TimeoutError')), Math.max(3000, Number(timeoutMs) || API_REQUEST_TIMEOUT_MS));
    return { signal: controller.signal, cleanup: () => { clearTimeout(timeout); externalSignal?.removeEventListener?.('abort', abort); } };
  }

  function friendlyApiErrorMessage(status, data, fallback) {
    const raw = data?.error || data?.message || fallback || `Falha na requisição (${status}).`;
    const code = String(data?.code || data?.details?.code || '').toUpperCase();
    if (status === 429 && code === 'ACCOUNT_TEMPORARILY_LOCKED') return raw;
    if (status === 429 || /too many requests|rate limit/i.test(String(raw))) {
      return 'Muitas requisições em pouco tempo. O sistema segurou a sincronização para proteger o banco. Aguarde alguns segundos e tente novamente.';
    }
    return raw;
  }

  async function checkHealth(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    if (!forceRefresh && healthState.value && Date.now() - healthState.at < 30_000) return healthState.value;
    if (healthState.promise) return healthState.promise;

    healthState.promise = (async () => {
      let lastError = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(apiUrl('/api/health'), {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });
        const data = await parseResponse(response);
        if (response.ok && data?.ok) {
          return {
            ok: true,
            database: data?.database || data?.databaseStatus || '',
            version: data?.version || '',
            message: null
          };
        }
        lastError = data?.error || data?.message || `API respondeu com status ${response.status}.`;
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
      const localFile = typeof location !== 'undefined' && location.protocol === 'file:';
      return {
        ok: false,
        code: localFile ? 'LOCAL_FILE_PROTOCOL' : 'API_UNREACHABLE',
        message: localFile
          ? 'A versão local precisa ser aberta por um servidor local, e não diretamente pelo arquivo HTML.'
          : 'A API do Surveyor está temporariamente indisponível.',
        cause: lastError || null
      };
    })();

    try {
      const value = await healthState.promise;
      healthState = { at: Date.now(), value, promise: null };
      return value;
    } catch (error) {
      healthState = { at: Date.now(), value: null, promise: null };
      throw error;
    }
  }

  let refreshPromise = null;

  async function refreshSession() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const session = getSession();
      if (!session?.accessToken) return false;
      const timeout = timeoutController(null, 15_000);
      let response;
      try {
        response = await fetch(apiUrl(`${CONFIG.authEndpoint}/refresh`), {
          method: 'POST',
          credentials: 'include',
          signal: timeout.signal,
          headers: { 'Content-Type': 'application/json', 'X-Request-ID': clientRequestId() },
          body: JSON.stringify(session.refreshToken ? { refreshToken: session.refreshToken } : {})
        });
      } catch (cause) {
        const error = new Error(cause?.name === 'TimeoutError'
          ? 'A renovação da sessão ultrapassou o tempo limite.'
          : 'Não foi possível renovar a sessão porque a API está temporariamente indisponível.');
        error.cause = cause;
        error.status = 0;
        throw error;
      } finally {
        timeout.cleanup();
      }
      const data = await parseResponse(response);
      if (!response.ok || !data?.accessToken) {
        if ([400, 401, 403].includes(response.status)) {
          clear(KEYS.session);
          return false;
        }
        const error = new Error(data?.error || data?.message || `Falha temporária ao renovar a sessão (${response.status}).`);
        error.status = response.status;
        error.requestId = response.headers.get('X-Request-ID') || data?.requestId || null;
        throw error;
      }
      const nextSession = {
        ...session,
        user: normalizeSessionUser(data.user || session.user),
        accessToken: data.accessToken,
        token: data.accessToken,
        geoservicesToken: String(data.geoservicesToken || session.geoservicesToken || ''),
        tokenType: data.tokenType || 'Bearer',
        expiresIn: data.expiresIn,
        updatedAt: nowIso()
      };
      if (data.refreshCookie === true && isOfficialSurveyorWeb()) delete nextSession.refreshToken;
      else if (data.refreshToken || session.refreshToken) nextSession.refreshToken = data.refreshToken || session.refreshToken;
      else delete nextSession.refreshToken;
      write(KEYS.session, nextSession);
      return true;
    })();
    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function apiFetch(path, options = {}, allowRefresh = true) {
    const retryCount = Number(options.__retryCount || 0);
    const fetchOptions = { ...options };
    delete fetchOptions.__retryCount;
    const timeoutMs = Number(fetchOptions.timeoutMs || API_REQUEST_TIMEOUT_MS);
    delete fetchOptions.timeoutMs;
    const session = getSession();
    const method = String(fetchOptions.method || 'GET').toUpperCase();
    const headers = new Headers(fetchOptions.headers || {});
    if (fetchOptions.body != null && !(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    if (!headers.has('X-Request-ID')) headers.set('X-Request-ID', clientRequestId());
    if (fetchOptions.idempotencyKey && !headers.has('Idempotency-Key')) headers.set('Idempotency-Key', String(fetchOptions.idempotencyKey).slice(0, 120));
    delete fetchOptions.idempotencyKey;
    attachSessionAuthHeaders(headers, session);

    const timeout = timeoutController(fetchOptions.signal, timeoutMs);
    let response;
    try {
      response = await fetch(apiUrl(path), {
        ...fetchOptions,
        headers,
        signal: timeout.signal,
        credentials: 'include',
        cache: fetchOptions.cache || 'no-store'
      });
    } catch (cause) {
      const timedOut = cause?.name === 'TimeoutError' || timeout.signal.aborted;
      const error = new Error(timedOut
        ? 'A operação demorou mais do que o limite seguro. Nenhum reenvio automático foi feito.'
        : 'Não foi possível acessar a API do Surveyor. Aguarde alguns segundos e tente novamente.');
      error.cause = cause;
      error.status = 0;
      throw error;
    } finally {
      timeout.cleanup();
    }

    const safeToRetry = ['GET', 'HEAD', 'OPTIONS'].includes(method) || headers.has('Idempotency-Key');
    if (response.status === 429 && safeToRetry && retryCount < 2 && !fetchOptions.signal?.aborted) {
      await sleep(retryDelayFromResponse(response, 1500 * (retryCount + 1)));
      return apiFetch(path, { ...fetchOptions, headers, __retryCount: retryCount + 1 }, allowRefresh);
    }

    if (response.status === 401 && allowRefresh && session?.accessToken) {
      const refreshed = await refreshSession();
      if (refreshed) return apiFetch(path, fetchOptions, false);
      if (!getSession()?.accessToken) revokeLocalSession('SESSION_REVOKED', 'Sua sessão foi encerrada. Entre novamente.');
    }

    const data = await parseResponse(response);
    const permissionDeniedForMember = response.status === 403
      && allowRefresh
      && session?.accessToken
      && session?.user?.isSubuser === true
      && String(data?.code || data?.details?.code || '').toUpperCase() === 'PLAN_PERMISSION_REQUIRED';
    if (permissionDeniedForMember) {
      const refreshed = await refreshSession();
      if (refreshed) return apiFetch(path, fetchOptions, false);
    }
    if (!response.ok) {
      let message = friendlyApiErrorMessage(response.status, data, `Falha na requisição (${response.status}).`);
      if (data?.details && typeof data.details === 'object') {
        const first = Object.entries(data.details).find(([, messages]) => Array.isArray(messages) && messages.length);
        if (first && !String(message).includes(first[1][0])) message = `${message} ${first[0]}: ${first[1][0]}`;
      }
      const error = new Error(message);
      error.status = response.status;
      error.details = data?.details;
      error.code = data?.code || data?.details?.code || null;
      error.requestId = response.headers.get('X-Request-ID') || data?.requestId || null;
      const revokedReason = sessionRevocationReason(error);
      if (revokedReason) revokeLocalSession(revokedReason, error.message);
      throw error;
    }
    return data;
  }


  async function recoverSessionForSave() {
    const current = getSession();
    if (current?.accessToken) return current;
    // O cookie HttpOnly de refresh é mantido pela API e não concede acesso ao
    // frontend. Ele é usado somente aqui para reconstruir um accessToken quando
    // a sessão da aba foi perdida durante o uso — nunca para pular a tela de login
    // após um reload, pois o preflight bloqueia o carregamento antes deste código.
    if (!isOfficialSurveyorWeb()) return null;
    const timeout = timeoutController(null, 12_000);
    try {
      const response = await fetch(apiUrl(`${CONFIG.authEndpoint}/refresh`), {
        method: 'POST',
        credentials: 'include',
        signal: timeout.signal,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': clientRequestId() },
        body: JSON.stringify({})
      });
      const data = await parseResponse(response);
      if (!response.ok || !data?.accessToken || !data?.user) return null;
      const timestamp = nowIso();
      const recovered = {
        user: normalizeSessionUser(data.user),
        accessToken: String(data.accessToken || ''),
        token: String(data.accessToken || ''),
        geoservicesToken: String(data.geoservicesToken || ''),
        ...(data.refreshCookie !== true && data.refreshToken ? { refreshToken: String(data.refreshToken) } : {}),
        tokenType: data.tokenType || 'Bearer',
        expiresIn: data.expiresIn,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      write(KEYS.session, recovered);
      return getSession();
    } catch (error) {
      console.warn('[Surveyor save] não foi possível reconstruir a sessão da aba:', error?.message || error);
      return null;
    } finally {
      timeout.cleanup();
    }
  }

  async function saveApiFetch(path, options = {}, allowRefresh = true) {
    const retryCount = Number(options.__retryCount || 0);
    const timeoutMs = Number(options.timeoutMs || 45_000);
    let session = getSession();

    if (!session?.accessToken) session = await recoverSessionForSave();
    if (!session?.accessToken) {
      const error = new Error('Sua sessão de salvamento não pôde ser validada. Entre novamente.');
      error.status = 401;
      error.code = 'SAVE_AUTH_TOKEN_MISSING';
      throw error;
    }

    const sourceHeaders = new Headers(options.headers || {});
    const idempotencyKey = String(
      options.idempotencyKey
      || sourceHeaders.get('Idempotency-Key')
      || clientIdempotencyKey(`save-${String(path || '').slice(0, 80)}`)
    ).slice(0, 120);
    const expectedRevision = String(
      sourceHeaders.get('If-Match')
      || sourceHeaders.get('X-Expected-Updated-At')
      || ''
    ).replace(/^W\//, '').replace(/^"|"$/g, '').slice(0, 200);
    const requestId = clientRequestId();

    let payload = {};
    if (options.body != null) {
      if (typeof options.body === 'string') {
        try { payload = JSON.parse(options.body); }
        catch {
          const error = new Error('O projeto não pôde ser preparado para envio.');
          error.status = 400;
          error.code = 'SAVE_BODY_INVALID';
          throw error;
        }
      } else if (typeof options.body === 'object' && !(options.body instanceof FormData)) {
        payload = options.body;
      }
    }

    const wireBody = JSON.stringify({
      ...(payload && typeof payload === 'object' ? payload : {}),
      __surveyorSaveTransport: {
        version: 1,
        accessToken: String(session.accessToken || ''),
        idempotencyKey,
        expectedRevision,
        requestId
      }
    });

    // Transporte deliberadamente "simple request" CORS:
    // POST + text/plain + nenhum header customizado. Isso evita o OPTIONS
    // preflight que alguns domínios gerados do Appwrite bloqueiam antes da
    // execução da Function. A autenticação continua HTTPS e vai no corpo.
    const timeout = timeoutController(options.signal, timeoutMs);
    let response;
    try {
      response = await fetch(saveApiUrl(path), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          'Accept': 'application/json'
        },
        body: wireBody,
        signal: timeout.signal,
        credentials: 'omit',
        cache: 'no-store'
      });
    } catch (cause) {
      const timedOut = cause?.name === 'TimeoutError' || timeout.signal.aborted;
      console.error('[Surveyor Save] falha de transporte antes de resposta HTTP', {
        endpoint: saveApiUrl(path),
        origin: window.location.origin,
        causeName: cause?.name || '',
        causeMessage: cause?.message || ''
      });
      const error = new Error(timedOut
        ? 'A Function de salvamento demorou mais do que o limite seguro.'
        : 'Não foi possível acessar a Function de salvamento do Surveyor.');
      error.cause = cause;
      error.status = 0;
      error.code = 'SAVE_API_TRANSPORT_ERROR';
      throw error;
    } finally {
      timeout.cleanup();
    }

    if (response.status === 429 && idempotencyKey && retryCount < 2 && !options.signal?.aborted) {
      await sleep(retryDelayFromResponse(response, 1500 * (retryCount + 1)));
      return saveApiFetch(path, { ...options, __retryCount: retryCount + 1 }, allowRefresh);
    }

    if (response.status === 401 && allowRefresh && session?.accessToken && await refreshSession()) {
      return saveApiFetch(path, options, false);
    }

    const data = await parseResponse(response);
    if (!response.ok) {
      let message = friendlyApiErrorMessage(response.status, data, `Falha ao salvar na nuvem (${response.status}).`);
      if (data?.details && typeof data.details === 'object') {
        const first = Object.entries(data.details).find(([, messages]) => Array.isArray(messages) && messages.length);
        if (first && !String(message).includes(first[1][0])) message = `${message} ${first[0]}: ${first[1][0]}`;
      }
      const error = new Error(message);
      error.status = response.status;
      error.details = data?.details;
      error.code = data?.code || data?.details?.code || null;
      error.requestId = response.headers.get('X-Request-ID') || data?.requestId || null;
      throw error;
    }
    return data;
  }

  async function apiFetchFallback(primaryPath, fallbackPath, options = {}, allowRefresh = true) {
    try {
      return await apiFetch(primaryPath, options, allowRefresh);
    } catch (error) {
      const isMissingRoute = error?.status === 404 || /rota n[aã]o encontrada|not found/i.test(error?.message || '');
      if (!isMissingRoute || !fallbackPath) throw error;
      return apiFetch(fallbackPath, options, allowRefresh);
    }
  }


  async function apiFetchFallbackMany(paths = [], options = {}, allowRefresh = true) {
    const list = Array.isArray(paths) ? paths.filter(Boolean) : [paths].filter(Boolean);
    let lastError = null;
    for (const path of list) {
      try {
        return await apiFetch(path, options, allowRefresh);
      } catch (error) {
        const isMissingRoute = error?.status === 404 || /rota n[aã]o encontrada|not found/i.test(error?.message || '');
        lastError = error;
        if (!isMissingRoute) throw error;
      }
    }
    throw lastError || new Error('Nenhuma rota de avisos respondeu.');
  }


  async function apiBinaryFetch(path, options = {}, allowRefresh = true) {
    const retryCount = Number(options.__retryCount || 0);
    const fetchOptions = { ...options };
    delete fetchOptions.__retryCount;
    const session = getSession();
    const headers = new Headers(fetchOptions.headers || {});
    attachSessionAuthHeaders(headers, session);
    let response;
    try {
      response = await fetch(apiUrl(path), { ...fetchOptions, headers, cache: fetchOptions.cache || 'no-store' });
    } catch (cause) {
      const error = new Error('Não foi possível acessar a API do Surveyor durante a transferência da camada.');
      error.cause = cause;
      error.status = 0;
      throw error;
    }
    if (response.status === 429 && retryCount < 2 && !fetchOptions.signal?.aborted) {
      await sleep(retryDelayFromResponse(response, 1500 * (retryCount + 1)));
      return apiBinaryFetch(path, { ...fetchOptions, __retryCount: retryCount + 1 }, allowRefresh);
    }
    if (response.status === 401 && allowRefresh && session?.refreshToken && await refreshSession()) {
      return apiBinaryFetch(path, fetchOptions, false);
    }
    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      const error = new Error(friendlyApiErrorMessage(response.status, data, raw || `Falha na transferência (${response.status}).`));
      error.status = response.status;
      throw error;
    }
    return response.arrayBuffer();
  }

  const SOURCE_ZIP_MAX_BYTES = 1 * 1024 * 1024 * 1024;
  const SOURCE_ZIP_CHUNK_BYTES = 16 * 1024 * 1024;
  const SOURCE_ZIP_DIRECT_BYTES = 8 * 1024 * 1024;

  const wait = (ms, signal) => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Operação cancelada.', 'AbortError'));
    }, { once: true });
  });

  const blobToBase64 = (blob, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Operação cancelada.', 'AbortError'));
    const reader = new FileReader();
    const abort = () => {
      try { reader.abort(); } catch {}
      reject(new DOMException('Operação cancelada.', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o ZIP.'));
    reader.onload = () => {
      signal?.removeEventListener?.('abort', abort);
      const text = String(reader.result || '');
      resolve(text.includes(',') ? text.split(',').pop() : text);
    };
    reader.readAsDataURL(blob);
  });

  async function uploadLayerSourceZip(layerId, file, onProgress = () => {}, options = {}) {
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.zip')) {
      throw new Error('Selecione um único arquivo ZIP de Shapefile.');
    }
    if (!file.size) throw new Error('O ZIP selecionado está vazio.');
    if (file.size > SOURCE_ZIP_MAX_BYTES) throw new Error('O ZIP ultrapassa o limite máximo de 1 GB.');

    const signal = options.signal;

    if (file.size <= SOURCE_ZIP_DIRECT_BYTES) {
      onProgress({ stage: 'starting', percent: 1, message: 'Preparando upload público assinado para ZIP pequeno...' });
      const prepared = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/source-upload/prepare-public`, {
        method: 'POST',
        signal,
        body: JSON.stringify({
          originalFileName: file.name,
          totalBytes: file.size
        })
      });
      const uploadUrl = prepared?.uploadUrl;
      if (!uploadUrl) throw new Error('A API não retornou a URL temporária de upload.');

      const contentBase64 = await blobToBase64(file, signal);
      onProgress({ stage: 'uploading', percent: 18, message: 'Enviando ZIP pequeno por canal assinado sem preflight...' });
      let publicResponse;
      try {
        publicResponse = await fetch(apiUrl(uploadUrl), {
          method: 'POST',
          signal,
          cache: 'no-store',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({
            originalFileName: file.name,
            totalBytes: file.size,
            contentBase64
          })
        });
      } catch (cause) {
        const error = new Error(`Não foi possível enviar o ZIP pela URL temporária (${apiUrl(uploadUrl)}).`);
        error.cause = cause;
        error.status = 0;
        throw error;
      }
      const publicText = await publicResponse.text().catch(() => '');
      let publicData = null;
      try { publicData = publicText ? JSON.parse(publicText) : null; } catch {}
      if (!publicResponse.ok) {
        throw new Error(publicData?.error || publicData?.message || publicText || `Falha no upload temporário (${publicResponse.status}).`);
      }
      onProgress({ stage: 'queued', percent: 45, message: 'ZIP recebido. Iniciando processamento na GeoServices...' });
      try {
        await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/source-upload/process`, {
          method: 'POST',
          signal,
          body: JSON.stringify({ uploadId: publicData?.upload?.id || prepared?.upload?.id || null })
        });
      } catch (processError) {
        // A rota de processamento também atualiza o status da camada em caso de erro.
        // Se a chamada demorar/cair, o polling abaixo mostra o estado real salvo no banco.
        console.warn('[GeoRural] processamento SHP/ZIP não retornou imediatamente:', processError);
      }
      const startedAt = Date.now();
      const timeoutMs = Number(options.timeoutMs || 8 * 60 * 60 * 1000);
      while (Date.now() - startedAt < timeoutMs) {
        if (signal?.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
        const data = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/source-upload/status`, { signal });
        const upload = data?.upload || {};
        onProgress({
          stage: upload.status || 'processing',
          percent: Number(upload.progress || 0),
          message: upload.message || 'Processando ZIP na API...'
        });
        if (upload.status === 'ready') return upload;
        if (upload.status === 'error') throw new Error(upload.error || upload.message || 'A API não conseguiu processar o ZIP.');
        if (upload.status === 'cancelled') throw new Error('Upload ou processamento cancelado.');
        await wait(2500, signal);
      }
      throw new Error('O processamento ultrapassou o tempo máximo de acompanhamento. Ele pode continuar na API; atualize o painel mais tarde.');
    }

    const chunkCount = Math.ceil(file.size / SOURCE_ZIP_CHUNK_BYTES);
    onProgress({ stage: 'starting', percent: 1, message: `Preparando ${chunkCount} blocos para envio...` });

    await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/source-upload/start`, {
      method: 'POST',
      signal,
      body: JSON.stringify({
        originalFileName: file.name,
        totalBytes: file.size,
        chunkCount
      })
    });

    const uploadStartedAt = performance.now();
    for (let index = 0; index < chunkCount; index += 1) {
      if (signal?.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
      const start = index * SOURCE_ZIP_CHUNK_BYTES;
      const end = Math.min(file.size, start + SOURCE_ZIP_CHUNK_BYTES);
      const buffer = await file.slice(start, end).arrayBuffer();
      let attempt = 0;
      while (true) {
        try {
          await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/source-upload/chunks/${index}`, {
            method: 'PUT',
            signal,
            headers: { 'Content-Type': 'application/octet-stream' },
            body: buffer
          });
          break;
        } catch (error) {
          attempt += 1;
          if (signal?.aborted || attempt >= 4 || ![0, 429, 500, 502, 503, 504].includes(Number(error.status || 0))) throw error;
          onProgress({ stage: 'uploading', percent: Math.max(2, Math.round((index / chunkCount) * 30)), message: `Tentando novamente o bloco ${index + 1}...` });
          await wait(1000 * attempt, signal);
        }
      }
      const percent = Math.max(2, Math.min(30, Math.round(((index + 1) / chunkCount) * 30)));
      const sentBytes = end;
      const elapsedSeconds = Math.max(0.1, (performance.now() - uploadStartedAt) / 1000);
      const bytesPerSecond = sentBytes / elapsedSeconds;
      const remainingSeconds = bytesPerSecond > 0 ? (file.size - sentBytes) / bytesPerSecond : 0;
      const speedText = `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
      const etaText = remainingSeconds >= 60 ? `${Math.ceil(remainingSeconds / 60)} min` : `${Math.ceil(remainingSeconds)} s`;
      onProgress({ stage: 'uploading', percent, message: `Enviando ZIP: bloco ${index + 1} de ${chunkCount} · ${speedText} · restante ${etaText}` });
    }

    await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/source-upload/complete`, {
      method: 'POST',
      signal,
      body: JSON.stringify({})
    });

    onProgress({ stage: 'queued', percent: 32, message: 'ZIP enviado. A API iniciou o processamento...' });
    const startedAt = Date.now();
    const timeoutMs = Number(options.timeoutMs || 8 * 60 * 60 * 1000);
    while (Date.now() - startedAt < timeoutMs) {
      if (signal?.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
      const data = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/source-upload/status`, { signal });
      const upload = data?.upload || {};
      onProgress({
        stage: upload.status || 'processing',
        percent: Number(upload.progress || 0),
        message: upload.message || 'Processando ZIP na API...'
      });
      if (upload.status === 'ready') return upload;
      if (upload.status === 'error') throw new Error(upload.error || upload.message || 'A API não conseguiu processar o ZIP.');
      if (upload.status === 'cancelled') throw new Error('Upload ou processamento cancelado.');
      await wait(2500, signal);
    }
    throw new Error('O processamento ultrapassou o tempo máximo de acompanhamento. Ele pode continuar na API; atualize o painel mais tarde.');
  }

  async function getLayerSourceUploadStatus(layerId) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/source-upload/status`);
    return data?.upload || null;
  }

  async function cancelLayerSourceUpload(layerId) {
    return apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/source-upload`, { method: 'DELETE' });
  }

  async function uploadLargeLayerGeoJson(layerId, source, metadata = {}, onProgress = () => {}) {
    if (!window.CompressionStream) throw new Error('Seu navegador não oferece compactação em fluxo. Atualize o Chrome, Edge ou Brave.');
    let sourceBlob;
    if (source instanceof Blob) sourceBlob = source;
    else if (typeof source === 'string') sourceBlob = new Blob([source], { type: 'application/geo+json' });
    else {
      try {
        sourceBlob = window.GeoRuralLayerImport?.collectionToBlob
          ? window.GeoRuralLayerImport.collectionToBlob(source)
          : new Blob([JSON.stringify(source)], { type: 'application/geo+json' });
      } catch (error) {
        if (error instanceof RangeError || /string length/i.test(error?.message || '')) {
          throw new Error('A camada ficou grande demais para ser serializada de uma só vez. Reimporte o ZIP usando a versão atualizada do sistema.');
        }
        throw error;
      }
    }
    const uncompressedBytes = sourceBlob.size;
    onProgress({ stage: 'compressing', percent: 2, message: 'Compactando a camada em fluxo...' });
    const gzipStream = sourceBlob.stream().pipeThrough(new CompressionStream('gzip'));
    const gzipBlob = await new Response(gzipStream).blob();
    const chunkSize = 4 * 1024 * 1024;
    const chunkCount = Math.max(1, Math.ceil(gzipBlob.size / chunkSize));
    const featureCount = Number.isFinite(Number(metadata.featureCount)) ? Number(metadata.featureCount) : 0;

    await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/large-data/start`, {
      method: 'POST',
      body: JSON.stringify({
        originalFileName: metadata.originalFileName || metadata.fileNames?.[0] || 'camada.zip',
        originalZipBytes: Number(metadata.originalBytes || 0),
        compressedBytes: gzipBlob.size,
        uncompressedBytes,
        chunkCount,
        featureCount
      })
    });

    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(gzipBlob.size, start + chunkSize);
      const buffer = await gzipBlob.slice(start, end).arrayBuffer();
      await apiBinaryFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/large-data/chunks/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer
      });
      const percent = Math.round(((index + 1) / chunkCount) * 92) + 5;
      onProgress({ stage: 'uploading', percent: Math.min(97, percent), message: `Enviando bloco ${index + 1} de ${chunkCount}...` });
    }

    const result = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/large-data/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes: metadata.notes || null })
    });
    onProgress({ stage: 'complete', percent: 100, message: 'Camada enviada com sucesso.' });
    return result.layer;
  }

  async function layerResponseFetch(path, options = {}, allowRefresh = true) {
    const retryCount = Number(options.__retryCount || 0);
    const fetchOptions = { ...options };
    delete fetchOptions.__retryCount;
    const session = getSession();
    const headers = new Headers(fetchOptions.headers || {});
    attachSessionAuthHeaders(headers, session);

    let response;
    try {
      response = await fetch(apiUrl(path), {
        ...fetchOptions,
        headers,
        cache: fetchOptions.cache || 'no-store'
      });
    } catch (cause) {
      const error = new Error('A conexão com a camada armazenada no GeoRural foi interrompida.');
      error.cause = cause;
      error.status = 0;
      throw error;
    }

    if (response.status === 429 && retryCount < 2 && !fetchOptions.signal?.aborted) {
      await sleep(retryDelayFromResponse(response, 1500 * (retryCount + 1)));
      return layerResponseFetch(path, { ...fetchOptions, __retryCount: retryCount + 1 }, allowRefresh);
    }
    if (response.status === 401 && allowRefresh && session?.refreshToken && await refreshSession()) {
      return layerResponseFetch(path, fetchOptions, false);
    }
    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      const error = new Error(friendlyApiErrorMessage(response.status, data, raw || `Falha ao transferir a camada (${response.status}).`));
      error.status = response.status;
      throw error;
    }
    return response;
  }

  async function layerStreamFetch(path, options = {}, allowRefresh = true) {
    const response = await layerResponseFetch(path, options, allowRefresh);
    try {
      return await response.json();
    } catch (cause) {
      const error = new Error('A API respondeu, mas os dados geográficos chegaram incompletos ou inválidos.');
      error.cause = cause;
      error.status = 502;
      throw error;
    }
  }

  async function chunkWithRetry(layerId, index, signal, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await apiBinaryFetch(`/api/layers/${encodeURIComponent(layerId)}/data/chunks/${index}`, { signal, cache: 'default' });
      } catch (error) {
        lastError = error;
        if (signal?.aborted) throw error;
        if (attempt < attempts) await wait(350 * (2 ** (attempt - 1)), signal);
      }
    }
    throw lastError;
  }

  async function loadLayerGeoJson(layerId, endpoint = null, options = {}) {
    const signal = options.signal;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    const data = await apiFetch(endpoint || `/api/layers/${encodeURIComponent(layerId)}/data`, { signal });
    if (data?.geojson) {
      onProgress({ stage: 'complete', percent: 100, message: 'Camada recebida.' });
      return data.geojson;
    }
    if (data?.storage !== 'chunks' || !Number.isInteger(data.chunkCount) || data.chunkCount < 1) {
      throw new Error('A camada não possui dados geográficos disponíveis.');
    }

    const uncompressedBytes = Number(data.uncompressedBytes || 0);
    const featureCount = Number(data.featureCount || 0);
    const safeMemoryLimit = Number(options.safeMemoryLimitBytes || 180 * 1024 * 1024);
    if (!options.allowLargeMemory && (uncompressedBytes > safeMemoryLimit || featureCount > 220000)) {
      throw new Error('Esta camada é grande demais para ser aberta inteira no navegador. Use o modo WMS/tiles para evitar travamentos e a tela STATUS_BREAKPOINT.');
    }

    const version = encodeURIComponent(String(data.cacheVersion || data.compressedBytes || '1'));
    const streamEndpoint = data.streamEndpoint || `/api/layers/${encodeURIComponent(layerId)}/data/stream`;
    onProgress({ stage: 'downloading', percent: 8, message: 'Baixando camada pelo modo rápido...' });

    try {
      const collection = await layerStreamFetch(`${streamEndpoint}?v=${version}`, { signal, cache: 'default' });
      onProgress({ stage: 'complete', percent: 100, message: 'Camada pronta.' });
      return collection;
    } catch (streamError) {
      if (signal?.aborted) throw streamError;
      console.warn('[camadas] Streaming rápido indisponível; usando blocos com repetição automática.', streamError);
      onProgress({ stage: 'fallback', percent: 10, message: 'Modo rápido indisponível. Recuperando blocos...' });
    }

    if (!window.DecompressionStream) throw new Error('Seu navegador não consegue descompactar esta camada grande. Atualize o navegador.');

    const buffers = new Array(data.chunkCount);
    let nextIndex = 0;
    let completed = 0;
    const concurrency = Math.max(1, Math.min(5, Number(options.concurrency || 4), data.chunkCount));

    async function worker() {
      while (true) {
        if (signal?.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
        const index = nextIndex;
        nextIndex += 1;
        if (index >= data.chunkCount) return;
        buffers[index] = await chunkWithRetry(layerId, index, signal);
        completed += 1;
        const percent = 10 + Math.round((completed / data.chunkCount) * 72);
        onProgress({
          stage: 'downloading',
          percent: Math.min(82, percent),
          message: `Recebendo bloco ${completed} de ${data.chunkCount}...`
        });
        if (completed % 4 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    onProgress({ stage: 'decompressing', percent: 86, message: 'Descompactando camada...' });
    const compressedBlob = new Blob(buffers, { type: 'application/gzip' });
    buffers.fill(null);
    const stream = compressedBlob.stream().pipeThrough(new DecompressionStream(data.encoding || 'gzip'));
    const text = await new Response(stream).text();
    onProgress({ stage: 'parsing', percent: 94, message: 'Preparando geometrias...' });
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      const collection = JSON.parse(text);
      onProgress({ stage: 'complete', percent: 100, message: 'Camada pronta.' });
      return collection;
    } catch (cause) {
      const error = new Error('Os blocos foram recebidos, mas o GeoJSON está corrompido. Reprocesse a camada no painel administrativo.');
      error.cause = cause;
      throw error;
    }
  }


  async function streamLayerFull(layerId, options = {}) {
    const signal = options.signal;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    const onBatch = typeof options.onBatch === 'function' ? options.onBatch : async () => {};
    const path = `/api/layers/${encodeURIComponent(layerId)}/data/full`;
    const response = await layerResponseFetch(path, {
      signal,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    });
    if (!response.body) throw new Error('O navegador não conseguiu abrir o fluxo completo da camada.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let meta = null;
    let summary = null;
    let receivedFeatures = 0;

    const processLine = async (line) => {
      if (!line.trim()) return;
      let item;
      try {
        item = JSON.parse(line);
      } catch (cause) {
        const error = new Error('A API enviou um lote geográfico inválido.');
        error.cause = cause;
        throw error;
      }

      if (item.type === 'meta') {
        meta = item;
        onProgress({
          stage: 'querying',
          percent: 3,
          message: `Preparando ${Number(item.sourceFeatureCount || 0).toLocaleString('pt-BR')} elementos armazenados...`,
          total: Number(item.sourceFeatureCount || 0)
        });
        return;
      }
      if (item.type === 'batch') {
        const features = Array.isArray(item.features) ? item.features : [];
        if (features.length) {
          await onBatch(features, {
            received: Number(item.received || receivedFeatures + features.length),
            total: Number(item.total || meta?.sourceFeatureCount || 0)
          });
          receivedFeatures += features.length;
        }
        return;
      }
      if (item.type === 'feature') {
        await onBatch([item.feature], {
          received: receivedFeatures + 1,
          total: Number(meta?.sourceFeatureCount || 0)
        });
        receivedFeatures += 1;
        return;
      }
      if (item.type === 'progress') {
        const sent = Number(item.sent || item.scanned || receivedFeatures);
        const total = Number(item.total || meta?.sourceFeatureCount || 0);
        const rawPercent = Number.isFinite(Number(item.percent))
          ? Number(item.percent)
          : total > 0 ? (sent / total) * 100 : 0;
        const percent = 5 + Math.round(Math.max(0, Math.min(100, rawPercent)) * 0.83);
        onProgress({
          stage: 'streaming',
          percent: Math.min(88, percent),
          message: `Recebendo e desenhando ${sent.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} elementos...`,
          sent,
          total
        });
        return;
      }
      if (item.type === 'summary') {
        summary = item;
        onProgress({
          stage: 'complete',
          percent: 100,
          message: item.message || `${receivedFeatures.toLocaleString('pt-BR')} elementos carregados completamente.`
        });
        return;
      }
      if (item.type === 'error') throw new Error(item.error || 'Falha ao carregar a camada completa.');
    };

    try {
      while (true) {
        if (signal?.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, newlineIndex);
          pending = pending.slice(newlineIndex + 1);
          await processLine(line);
        }
      }
      pending += decoder.decode();
      if (pending.trim()) await processLine(pending);
    } finally {
      reader.releaseLock();
    }

    if (!summary) throw new Error('A transferência completa terminou sem confirmação da API.');
    return { meta, summary, receivedFeatures };
  }


  async function streamLayerViewport(layerId, options = {}) {
    const signal = options.signal;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    const onBatch = typeof options.onBatch === 'function' ? options.onBatch : async () => {};
    const bbox = Array.isArray(options.bbox) ? options.bbox.map(Number) : null;
    if (!bbox || bbox.length !== 4 || !bbox.every(Number.isFinite)) {
      throw new Error('A área visível do mapa não foi informada corretamente.');
    }
    const zoom = Math.max(0, Math.min(24, Number(options.zoom || 14)));
    const path = `/api/layers/${encodeURIComponent(layerId)}/data/viewport?bbox=${bbox.map(encodeURIComponent).join(',')}&zoom=${encodeURIComponent(zoom)}`;
    const response = await layerResponseFetch(path, {
      signal,
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', 'Pragma': 'no-cache' }
    });
    if (!response.body) throw new Error('O navegador não conseguiu abrir o fluxo da camada.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const batchSize = Math.max(50, Math.min(1000, Number(options.batchSize || 300)));
    let pending = '';
    let batch = [];
    let meta = null;
    let summary = null;
    let receivedFeatures = 0;

    const flushBatch = async () => {
      if (!batch.length) return;
      const current = batch;
      batch = [];
      await onBatch(current);
    };

    const processLine = async (line) => {
      if (!line.trim()) return;
      let item;
      try {
        item = JSON.parse(line);
      } catch (cause) {
        const error = new Error('A API enviou um bloco geográfico inválido.');
        error.cause = cause;
        throw error;
      }

      if (item.type === 'meta') {
        meta = item;
        onProgress({
          stage: 'querying',
          percent: 5,
          message: 'Consultando no banco do GeoRural somente a área visível...'
        });
        return;
      }
      if (item.type === 'batch') {
        const features = Array.isArray(item.features) ? item.features : [];
        if (features.length) {
          await onBatch(features);
          receivedFeatures += features.length;
        }
        return;
      }
      if (item.type === 'feature') {
        batch.push(item.feature);
        receivedFeatures += 1;
        if (batch.length >= batchSize) await flushBatch();
        return;
      }
      if (item.type === 'progress') {
        await flushBatch();
        const percent = Number.isFinite(Number(item.percent))
          ? 8 + Math.round(Math.max(0, Math.min(100, Number(item.percent))) * 0.84)
          : Math.min(88, 8 + Math.round(Number(item.scanned || 0) / 1000));
        onProgress({
          stage: 'streaming',
          percent,
          message: `Analisando ${Number(item.scanned || 0).toLocaleString('pt-BR')} registros; ${Number(item.matched || receivedFeatures).toLocaleString('pt-BR')} visíveis...`,
          scanned: Number(item.scanned || 0),
          matched: Number(item.matched || receivedFeatures),
          total: Number(item.total || 0)
        });
        return;
      }
      if (item.type === 'summary') {
        await flushBatch();
        summary = item;
        if (item.requiresZoom) {
          onProgress({
            stage: 'zoom-required',
            percent: 100,
            message: item.message || `Aproxime o mapa até o zoom ${item.requiresZoom}.`
          });
        } else {
          onProgress({
            stage: 'complete',
            percent: 100,
            message: item.message || `${receivedFeatures.toLocaleString('pt-BR')} elemento(s) visíveis carregados.`
          });
        }
        return;
      }
      if (item.type === 'error') throw new Error(item.error || 'Falha ao consultar a camada armazenada.');
    };

    try {
      while (true) {
        if (signal?.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, newlineIndex);
          pending = pending.slice(newlineIndex + 1);
          await processLine(line);
        }
      }
      pending += decoder.decode();
      if (pending.trim()) await processLine(pending);
      await flushBatch();
    } finally {
      reader.releaseLock();
    }

    if (!summary) throw new Error('A consulta da camada terminou sem confirmação da API.');
    return { meta, summary, receivedFeatures };
  }


  async function loadPlans(options = {}) {
    const user = currentUser();
    const endpoint = user?.role === 'admin' ? '/api/plans?all=1' : '/api/plans';
    const data = await cachedApiFetch(endpoint, CACHE_TTL.plans, options, false);
    const plans = (data?.plans || []).map((plan) => ({
      ...plan,
      price: Number(plan.priceCents || 0) / 100,
      billing: plan.billingCycle || 'anual',
      active: plan.isActive !== false
    }));
    write(KEYS.plans, plans);
    return plans;
  }

  function isDefaultEnabledCatalogLayer(layer = {}) {
    const name = String(layer?.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const slug = String(layer?.slug || '').trim().toLowerCase();
    const metadata = layer?.metadata && typeof layer.metadata === 'object' ? layer.metadata : {};
    const technical = String(metadata.layerName || metadata.layers || '').trim().toLowerCase();
    const isMunicipalSei = name === 'divisao politico administrativa - sei'
      || slug === 'geobahia-divisao-politico-administrativa-sei'
      || technical === 'vetor_bases_gerais:municip_sei_2019'
      || technical.endsWith(':municip_sei_2019')
      || technical === 'municip_sei_2019';
    if (isMunicipalSei) return false;
    return layer?.defaultEnabled === true || metadata.defaultEnabled === true;
  }

  function withDefaultLayerPreferences(preferences = [], catalog = []) {
    const next = (Array.isArray(preferences) ? preferences : []).map((item) => ({ ...item }));
    const known = new Set(next.map((item) => String(item?.layerId || '').toLowerCase()).filter(Boolean));
    (Array.isArray(catalog) ? catalog : []).filter((layer) => layer?.id && layer.status === 'ready' && isDefaultEnabledCatalogLayer(layer)).forEach((layer) => {
      const id = String(layer.id);
      if (known.has(id.toLowerCase())) return; // Ausente = padrão ligado; false salvo = usuário desligou explicitamente.
      next.push({
        layerId: id,
        enabled: true,
        opacity: Math.max(0.1, Math.min(1, Number(layer?.style?.opacity ?? layer?.style?.fillOpacity ?? 0.92))),
        sortOrder: next.length
      });
      known.add(id.toLowerCase());
    });
    return next;
  }

  function sanitizeLayerPreferencesForCurrentCatalog(preferences = null) {
    const user = currentUser();
    if (!user) return preferences || [];
    const catalog = read(KEYS.layers, []);
    const allowed = new Set((catalog || [])
      .filter((layer) => layer?.id && layer.status === 'ready')
      .map((layer) => String(layer.id).toLowerCase()));
    const all = read(KEYS.layerPrefs, {});
    const original = Array.isArray(preferences) ? preferences : (Array.isArray(all[user.id]) ? all[user.id] : []);
    const cleaned = original.filter((pref) => allowed.has(String(pref.layerId || '').toLowerCase()));
    const withDefaults = withDefaultLayerPreferences(cleaned, catalog);
    all[user.id] = withDefaults;
    write(KEYS.layerPrefs, all);
    return withDefaults;
  }

  function normalizePublicLayerCatalog(data = {}) {
    const groups = Array.isArray(data?.groups) ? data.groups : [];
    const groupedLayers = groups.flatMap((group) => (Array.isArray(group.layers) ? group.layers : []).map((layer) => ({
      ...layer,
      group: group.name || layer.groupName || 'Camadas publicadas',
      groupId: group.id || layer.groupId || '',
      source: layer.sourceName || layer.source || 'GeoRural',
      color: layer.style?.color || layer.style?.fillColor || layer.color || '#3974d8',
      locked: true,
      defaultEnabled: layer.defaultEnabled === true || isDefaultEnabledCatalogLayer(layer)
    })));
    if (groupedLayers.length) return groupedLayers;

    const groupsById = new Map(groups.map((group) => [String(group.id || ''), group]));
    return (Array.isArray(data?.layers) ? data.layers : []).map((layer) => {
      const group = groupsById.get(String(layer.groupId || ''));
      return {
        ...layer,
        group: group?.name || layer.groupName || 'Camadas publicadas',
        groupId: group?.id || layer.groupId || '',
        source: layer.sourceName || layer.source || 'GeoRural',
        color: layer.style?.color || layer.style?.fillColor || layer.color || '#3974d8',
        locked: true,
        defaultEnabled: layer.defaultEnabled === true || isDefaultEnabledCatalogLayer(layer)
      };
    });
  }

  async function loadLayers(options = {}) {
    const data = await cachedApiFetch(`${CONFIG.layersEndpoint}/catalog`, CACHE_TTL.layers, options, false);
    const layers = normalizePublicLayerCatalog(data).filter((layer) => layer?.id && layer.status === 'ready');
    write(KEYS.layers, layers);
    sanitizeLayerPreferencesForCurrentCatalog();
    return layers;
  }

  function normalizeCatalogState(value = 'BA') {
    const allowed = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
    const code = String(value || 'BA').trim().toUpperCase();
    return allowed.has(code) ? code : 'BA';
  }

  function setCachedLayerCatalogState(userId, value) {
    if (!userId) return;
    const all = read(KEYS.layerCatalogState, {});
    all[userId] = normalizeCatalogState(value);
    write(KEYS.layerCatalogState, all);
  }

  function getLayerCatalogState() {
    const user = currentUser();
    if (!user) return 'BA';
    const all = read(KEYS.layerCatalogState, {});
    return normalizeCatalogState(all[user.id] || 'BA');
  }

  function isLayerCatalogStateConfigured() {
    const user = currentUser();
    if (!user) return false;
    const all = read(KEYS.layerCatalogStateConfigured, {});
    return all[user.id] === true;
  }

  async function loadLayerPreferences(options = {}) {
    const user = currentUser();
    if (!user) return [];
    const data = await cachedApiFetch(`${CONFIG.layersEndpoint}/preferences`, CACHE_TTL.layerPrefs, options, false);
    const all = read(KEYS.layerPrefs, {});
    all[user.id] = sanitizeLayerPreferencesForCurrentCatalog(data?.preferences || []);
    write(KEYS.layerPrefs, all);
    setCachedLayerCatalogState(user.id, data?.catalogState || getLayerCatalogState());
    const configured = read(KEYS.layerCatalogStateConfigured, {});
    configured[user.id] = data?.catalogStateConfigured === true;
    write(KEYS.layerCatalogStateConfigured, configured);
    return all[user.id];
  }

  async function saveLayerPreferences(preferences, options = {}) {
    const user = currentUser();
    if (!user) throw new Error('Sessão não encontrada.');
    const cleaned = (preferences || []).filter((item) => String(item.layerId || '').trim()).map((item, index) => {
      const color = /^#[0-9a-f]{6}$/i.test(String(item.color || '').trim()) ? String(item.color).toUpperCase() : undefined;
      const weight = Number.isFinite(Number(item.weight)) ? Math.max(0.6, Math.min(6, Number(item.weight))) : undefined;
      const styleMode = item.styleMode === 'official' || item.styleMode === 'custom' ? item.styleMode : undefined;
      const propertyStyleRevision = Number.isInteger(Number(item.propertyStyleRevision)) ? Math.max(0, Number(item.propertyStyleRevision)) : undefined;
      const userStyled = item.userStyled === true;
      return {
        layerId: String(item.layerId),
        enabled: Boolean(item.enabled),
        opacity: Math.max(0.1, Math.min(1, Number(item.opacity ?? 0.55))),
        ...(color ? { color } : {}),
        ...(weight !== undefined ? { weight } : {}),
        ...(styleMode ? { styleMode } : {}),
        ...(propertyStyleRevision !== undefined ? { propertyStyleRevision } : {}),
        ...(userStyled ? { userStyled: true } : {}),
        sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index
      };
    });
    const catalog = read(KEYS.layers, []);
    const allowed = new Set((catalog || []).filter((layer) => layer?.id && layer.status === 'ready').map((layer) => String(layer.id).toLowerCase()));
    const valid = cleaned.filter((item) => allowed.has(String(item.layerId || '').toLowerCase()));
    const catalogState = normalizeCatalogState(options.catalogState || getLayerCatalogState());
    const data = await apiFetch(`${CONFIG.layersEndpoint}/preferences`, {
      method: 'PUT',
      body: JSON.stringify({ preferences: valid, catalogState })
    });
    invalidateApiCache('/api/layers/preferences');
    const all = read(KEYS.layerPrefs, {});
    all[user.id] = valid;
    write(KEYS.layerPrefs, all);
    setCachedLayerCatalogState(user.id, data?.catalogState || catalogState);
    const configured = read(KEYS.layerCatalogStateConfigured, {});
    configured[user.id] = true;
    write(KEYS.layerCatalogStateConfigured, configured);
    return valid;
  }

  async function saveLayerCatalogState(value) {
    const user = currentUser();
    if (!user) throw new Error('Sessão não encontrada.');
    const catalogState = normalizeCatalogState(value);
    const allPrefs = read(KEYS.layerPrefs, {});
    const preferences = Array.isArray(allPrefs[user.id]) ? allPrefs[user.id] : [];
    await saveLayerPreferences(preferences, { catalogState });
    return catalogState;
  }

  async function loadUsers(options = {}) {
    const data = await cachedApiFetch(`${CONFIG.adminEndpoint}/users`, CACHE_TTL.adminFast, options);
    write(KEYS.users, data?.users || []);
    return data?.users || [];
  }

  async function createUser(payload) {
    const endpoint = `${CONFIG.adminEndpoint}/users`;
    const body = JSON.stringify(payload);
    const requestOptions = {
      method: 'POST',
      body,
      // Criação de usuário pode envolver Appwrite Auth + perfil + e-mail/PDF.
      // Damos mais tempo do que uma leitura comum para evitar abortar a resposta.
      timeoutMs: 60000
    };
    let data;
    try {
      // Não usamos o header HTTP Idempotency-Key aqui. O fluxo administrativo já
      // possui creationRequestId no corpo e o backend sabe recuperar a mesma
      // tentativa. Isso também mantém compatibilidade com deployments antigos da
      // API cujo preflight CORS ainda não liberava Idempotency-Key.
      data = await apiFetch(endpoint, requestOptions);
    } catch (error) {
      if (Number(error?.status || 0) !== 0) throw error;

      // Se a conexão caiu depois de o servidor processar a conta, primeiro tenta
      // recuperá-la pela listagem para impedir criação duplicada.
      const email = String(payload?.email || '').trim().toLowerCase();
      try {
        await sleep(650);
        const currentUsers = await loadUsers({ forceRefresh: true });
        const recovered = currentUsers.find((item) => String(item?.email || '').trim().toLowerCase() === email);
        if (recovered) {
          return { ok: true, user: recovered, recoveredAfterNetworkError: true, onboardingEmail: { sent: false, skipped: true } };
        }
      } catch {}

      // Uma única nova tentativa é segura porque usamos o MESMO creationRequestId
      // do corpo; a API trata repetição dessa tentativa como retomada.
      await sleep(900);
      data = await apiFetch(endpoint, requestOptions);
    }
    invalidateApiCache('/api/admin/users');
    await loadUsers({ forceRefresh: true });
    return data;
  }

  async function updateRemoteUser(userId, payload) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    invalidateApiCache('/api/admin/users');
    await loadUsers({ forceRefresh: true });
    return data.user;
  }

  async function updateUserEmail(userId, payload) {
    const endpoint = `${CONFIG.adminEndpoint}/users/${encodeURIComponent(userId)}/email`;
    let data;
    try {
      // POST é usado como método principal porque atravessa com mais estabilidade
      // os proxies/CDNs do domínio oficial. A API também aceita PATCH por compatibilidade.
      data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      if (![404, 405].includes(Number(error?.status || 0))) throw error;
      data = await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    }
    invalidateApiCache('/api/admin/users');
    await loadUsers({ forceRefresh: true });
    return data;
  }

  async function deleteRemoteUser(userId) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
    invalidateApiCache('/api/admin/users');
    await loadUsers({ forceRefresh: true });
    return data;
  }

  async function loadWorkspaceTeam(ownerUserId, options = {}) {
    const owner = encodeURIComponent(ownerUserId);
    const requestOptions = { ...options, timeoutMs: Number(options.timeoutMs || 12000) };
    const data = await cachedApiFetchFallbackMany([
      `${CONFIG.adminEndpoint}/users/${owner}/team/members`,
      `${CONFIG.adminEndpoint}/users/${owner}/subusers`,
      `${CONFIG.adminEndpoint}/users/${owner}/team`
    ], CACHE_TTL.adminFast, requestOptions);
    const team = data?.team || data?.workspace || null;
    return team && typeof team === 'object' ? team : null;
  }

  async function updateWorkspaceTeam(ownerUserId, payload = {}) {
    const owner = encodeURIComponent(ownerUserId);
    const endpoint = `${CONFIG.adminEndpoint}/users/${owner}/team`;
    let data;
    try {
      data = await apiFetch(endpoint, { method: 'PATCH', body: JSON.stringify(payload), timeoutMs: 12000 });
    } catch (error) {
      const methodUnsupported = [404, 405].includes(Number(error?.status || 0)) || /rota n[aã]o encontrada|not found|method not allowed/i.test(error?.message || '');
      if (!methodUnsupported) throw error;
      data = await apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(payload), timeoutMs: 12000 });
    }
    invalidateApiCache(`${CONFIG.adminEndpoint}/users/${owner}/team/members`);
    invalidateApiCache(`${CONFIG.adminEndpoint}/users/${owner}/subusers`);
    invalidateApiCache(endpoint);
    return data;
  }

  async function createSubuser(ownerUserId, payload) {
    const owner = encodeURIComponent(ownerUserId);
    // A inclusão do membro é a operação principal. Não acople o sucesso dela
    // a uma segunda leitura global de /admin/users: um cadastro legado inválido
    // nessa lista não pode transformar uma inclusão já concluída em erro visual.
    const data = await apiFetchFallbackMany([
      `${CONFIG.adminEndpoint}/users/${owner}/team/members`,
      `${CONFIG.adminEndpoint}/users/${owner}/subusers`
    ], { method: 'POST', body: JSON.stringify(payload), timeoutMs: 30000 });
    invalidateApiCache('/api/admin/users');
    invalidateApiCache(`${CONFIG.adminEndpoint}/users/${owner}/team/members`);
    invalidateApiCache(`${CONFIG.adminEndpoint}/users/${owner}/subusers`);
    return data;
  }

  async function updateSubuser(userId, payload) {
    const id = encodeURIComponent(userId);
    const data = await apiFetchFallbackMany([
      `${CONFIG.adminEndpoint}/team-members/${id}`,
      `${CONFIG.adminEndpoint}/subusers/${id}`
    ], { method: 'PATCH', body: JSON.stringify(payload), timeoutMs: 30000 });
    invalidateApiCache('/api/admin/users');
    return data;
  }

  async function deleteSubuser(userId) {
    const id = encodeURIComponent(userId);
    const data = await apiFetchFallbackMany([
      `${CONFIG.adminEndpoint}/team-members/${id}`,
      `${CONFIG.adminEndpoint}/subusers/${id}`
    ], { method: 'DELETE', timeoutMs: 15000 });
    invalidateApiCache('/api/admin/users');
    return data;
  }

  async function createPlan(payload) {
    const data = await apiFetch('/api/plans', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    invalidateApiCache('/api/plans');
    await loadPlans({ forceRefresh: true });
    return data.plan;
  }

  async function updatePlan(planId, payload) {
    const data = await apiFetch(`/api/plans/${encodeURIComponent(planId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    invalidateApiCache('/api/plans');
    await loadPlans({ forceRefresh: true });
    return data.plan;
  }

  async function deletePlan(planId) {
    const data = await apiFetch(`/api/plans/${encodeURIComponent(planId)}`, { method: 'DELETE' });
    invalidateApiCache('/api/plans');
    await loadPlans({ forceRefresh: true });
    return data;
  }

  async function dedupePlans() {
    const data = await apiFetch('/api/admin/plans/dedupe', { method: 'POST' });
    invalidateApiCache('/api/plans');
    await loadPlans({ forceRefresh: true });
    return data;
  }

  async function loadAdminLayers(options = {}) {
    const data = await cachedApiFetch(`${CONFIG.adminEndpoint}/layers`, CACHE_TTL.adminFast, options);
    return data?.layers || [];
  }

  async function loadLayerGroups(options = {}) {
    const data = await cachedApiFetch(`${CONFIG.adminEndpoint}/layer-groups`, CACHE_TTL.adminFast, options);
    return data?.groups || [];
  }

  async function createLayerGroup(payload) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layer-groups`, {
      method: 'POST', body: JSON.stringify(payload)
    });
    invalidateApiCache('/api/admin/layer-groups');
    return data.group;
  }

  async function publishLayerGroup(groupId, published) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layer-groups/${encodeURIComponent(groupId)}/publish`, {
      method: 'PATCH', body: JSON.stringify({ published: Boolean(published) })
    });
    invalidateApiCache('/api/admin/layer-groups');
    invalidateApiCache('/api/admin/layers');
    invalidateApiCache('/api/layers');
    invalidateApiCache('/api/layers/catalog');
    invalidateApiCache('/api/layer-catalog');
    emitLayerCatalogChanged('group-publish');
    return data;
  }


  async function testLayerUrl(payload) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layers/test-url`, {
      method: 'POST', body: JSON.stringify(payload)
    });
    return data.detection;
  }

  async function seedGeobahiaOfficialLayers() {
    const payload = { source: 'geobahia-inema', mode: 'upsert-groups-and-layers' };
    const endpoints = [
      `${CONFIG.adminEndpoint}/layers/seed/geobahia-official`,
      `${CONFIG.adminEndpoint}/layers/seed/geobahia`,
      `${CONFIG.adminEndpoint}/layers/corrigir-geobahia`
    ];
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        return await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      } catch (error) {
        lastError = error;
        const message = String(error?.message || '');
        if (!/Rota não encontrada|not found|404/i.test(message)) throw error;
      }
    }
    throw lastError || new Error('Não foi possível cadastrar o catálogo GeoBahia automaticamente.');
  }

  async function loadRemoteLayerData(layerId) {
    const data = await apiFetch(`/api/layers/${encodeURIComponent(layerId)}/remote-data`, {}, false);
    return data?.geojson || { type: 'FeatureCollection', features: [] };
  }

  async function startRemoteLayerImport(layerId, options = {}) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/remote-import/start`, {
      method: 'POST',
      body: JSON.stringify({
        autoPublish: options.autoPublish !== false,
        batchSize: Number(options.batchSize || 500)
      })
    });
    return data?.import || null;
  }

  async function getRemoteLayerImportStatus(layerId) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/remote-import/status`);
    return data?.import || null;
  }

  async function cancelRemoteLayerImport(layerId) {
    return apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/remote-import`, { method: 'DELETE' });
  }

  async function startLayerSpatialIndex(layerId) {
    return apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/spatial-index`, { method: 'POST' });
  }

  async function cancelLayerSpatialIndex(layerId) {
    return apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/spatial-index`, { method: 'DELETE' });
  }

  async function createLayer(payload) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layers`, {
      method: 'POST', body: JSON.stringify(payload)
    });
    invalidateApiCache('/api/admin/layers');
    invalidateApiCache('/api/layers/catalog');
    emitLayerCatalogChanged('layer-create');
    return data.layer;
  }

  async function updateLayer(layerId, payload) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}`, {
      method: 'PATCH', body: JSON.stringify(payload)
    });
    invalidateApiCache('/api/admin/layers');
    invalidateApiCache('/api/layers/catalog');
    emitLayerCatalogChanged('layer-update');
    return data.layer;
  }

  async function uploadLayerGeoJson(layerId, geojson, notes = null) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/data`, {
      method: 'PUT', body: JSON.stringify({ geojson, notes })
    });
    invalidateApiCache('/api/admin/layers');
    invalidateApiCache('/api/layers/catalog');
    return data.layer;
  }

  async function publishLayer(layerId, published) {
    const data = await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}/publish`, {
      method: 'PATCH', body: JSON.stringify({ published: Boolean(published) })
    });
    try {
      invalidateApiCache('/api/layers/catalog');
      invalidateApiCache('/api/layers/preferences');
      await loadLayers({ forceRefresh: true });
      await loadLayerPreferences({ forceRefresh: true });
    } catch (error) {
      console.warn('[camadas] não foi possível atualizar o catálogo local após publicação:', error);
    }
    emitLayerCatalogChanged('layer-publish');
    return data.layer;
  }

  async function archiveLayer(layerId) {
    await apiFetch(`${CONFIG.adminEndpoint}/layers/${encodeURIComponent(layerId)}`, { method: 'DELETE' });
    try {
      invalidateApiCache('/api/layers/catalog');
    emitLayerCatalogChanged('layer-archive');
      invalidateApiCache('/api/layers/preferences');
      await loadLayers({ forceRefresh: true });
      await loadLayerPreferences({ forceRefresh: true });
    } catch (error) {
      console.warn('[camadas] não foi possível atualizar o catálogo local após arquivamento:', error);
    }
  }


  async function listProjects(options = {}) {
    const data = await cachedApiFetch('/api/projects', CACHE_TTL.projects, options);
    return data?.projects || [];
  }

  async function getProject(projectId, options = {}) {
    const data = await cachedApiFetch(`/api/projects/${encodeURIComponent(projectId)}`, CACHE_TTL.projects, options);
    return { project: data?.project || null, features: data?.features || [] };
  }

  async function createProject(payload) {
    const data = await apiFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
      idempotencyKey: clientIdempotencyKey('create-project')
    });
    invalidateApiCache('/api/projects');
    return data.project;
  }

  async function updateProject(projectId, payload) {
    const body = { ...(payload || {}) };
    const expected = body.expectedUpdatedAt || body.expectedRevision || body.revision || body.updatedAt || '';
    if (!String(expected).trim()) {
      const error = new Error('Revisão do projeto ausente. Reabra o projeto antes de salvar.');
      error.status = 428; error.code = 'PROJECT_REVISION_REQUIRED';
      throw error;
    }
    const data = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      headers: expected ? { 'If-Match': `"${expected}"` } : undefined,
      body: JSON.stringify(body),
      idempotencyKey: clientIdempotencyKey(`update-project-${projectId}`)
    });
    invalidateApiCache('/api/projects');
    invalidateApiCache(`/api/projects/${encodeURIComponent(projectId)}`);
    return data.project;
  }

  async function replaceProjectFeatures(projectId, features, expectedUpdatedAt = '') {
    if (!String(expectedUpdatedAt).trim()) {
      const error = new Error('Revisão do projeto ausente. Reabra o projeto antes de editar as feições.');
      error.status = 428; error.code = 'PROJECT_REVISION_REQUIRED';
      throw error;
    }
    const data = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/features`, {
      method: 'PUT',
      headers: expectedUpdatedAt ? { 'If-Match': `"${expectedUpdatedAt}"` } : undefined,
      body: JSON.stringify({ features, expectedUpdatedAt }),
      idempotencyKey: clientIdempotencyKey(`replace-features-${projectId}`)
    });
    invalidateApiCache('/api/projects');
    invalidateApiCache(`/api/projects/${encodeURIComponent(projectId)}`);
    return data?.features || [];
  }

  async function saveProjectBundle(projectId, projectPayload, features) {
    const body = {
      project: { ...(projectPayload || {}) },
      features: Array.isArray(features) ? features : []
    };
    const expected = body.project.expectedUpdatedAt || body.project.expectedRevision || body.project.revision || body.project.updatedAt || '';
    if (projectId && !String(expected).trim()) {
      const error = new Error('Revisão do projeto ausente. Reabra o projeto antes de salvar.');
      error.status = 428;
      error.code = 'PROJECT_REVISION_REQUIRED';
      throw error;
    }
    const endpoint = projectId ? `/api/projects/${encodeURIComponent(projectId)}/bundle` : '/api/projects';
    const data = await saveApiFetch(endpoint, {
      method: projectId ? 'PUT' : 'POST',
      headers: expected ? { 'If-Match': `"${expected}"` } : undefined,
      body: JSON.stringify(body),
      idempotencyKey: clientIdempotencyKey(`${projectId ? 'save-project' : 'create-project'}-${projectId || 'new'}`)
    });
    invalidateApiCache('/api/projects');
    if (projectId) invalidateApiCache(`/api/projects/${encodeURIComponent(projectId)}`);
    return { project: data.project, features: data.features || [] };
  }

  async function deleteProject(projectId) {
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    invalidateApiCache('/api/projects');
  }

  async function listTrashedProjects() {
    const data = await apiFetch('/api/projects/trash');
    return Array.isArray(data?.projects) ? data.projects : [];
  }

  async function restoreProject(projectId) {
    const data = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/restore`, {
      method: 'POST',
      idempotencyKey: clientIdempotencyKey(`restore-project-${projectId}`)
    });
    invalidateApiCache('/api/projects');
    invalidateApiCache(`/api/projects/${encodeURIComponent(projectId)}`);
    return data?.project || null;
  }


  async function listDocuments(category = '', options = {}) {
    const suffix = category ? `?category=${encodeURIComponent(category)}` : '';
    const data = await cachedApiFetch(`/api/documents${suffix}`, CACHE_TTL.documents, options);
    return data?.documents || [];
  }

  function unlimitedGenerationStatus() {
    return { unlimited: true, hidden: true, planLimit: null, planUsed: 0, planRemaining: null, used: 0, remaining: null, total: null };
  }

  async function loadGenerationStatus() {
    return unlimitedGenerationStatus();
  }

  async function consumeGeneration() {
    return unlimitedGenerationStatus();
  }

  async function createDocument(payload) {
    const body = { ...(payload || {}) };
    const data = await apiFetch('/api/documents', { method: 'POST', body: JSON.stringify(body), idempotencyKey: clientIdempotencyKey('create-document') });
    invalidateApiCache('/api/documents');
    return data.document;
  }

  async function updateDocument(documentId, payload) {
    const body = { ...(payload || {}) };
    const expected = body.expectedUpdatedAt || body.expectedRevision || body.revision || body.updatedAt || '';
    const data = await apiFetch(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: 'PATCH',
      headers: expected ? { 'If-Match': `"${expected}"` } : undefined,
      body: JSON.stringify(body),
      idempotencyKey: clientIdempotencyKey(`update-document-${documentId}`)
    });
    invalidateApiCache('/api/documents');
    return data.document;
  }

  async function deleteDocument(documentId) {
    await apiFetch(`/api/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
    invalidateApiCache('/api/documents');
  }

  async function getGoogleDriveStatus() {
    return apiFetch('/api/integrations/google-drive/status', { method: 'GET' });
  }

  async function connectGoogleDrive() {
    const data = await apiFetch('/api/integrations/google-drive/connect', { method: 'POST', body: JSON.stringify({}) });
    return data?.url || '';
  }

  async function testGoogleDrive() {
    return apiFetch('/api/integrations/google-drive/test', { method: 'POST', body: JSON.stringify({}) });
  }

  async function createGoogleDriveUploadSession(payload) {
    return apiFetch('/api/documents/google-drive/session', { method: 'POST', body: JSON.stringify(payload) });
  }

  async function completeGoogleDriveUpload(payload) {
    const data = await apiFetch('/api/documents/google-drive/complete', { method: 'POST', body: JSON.stringify(payload) });
    invalidateApiCache('/api/documents');
    return data.document;
  }

  async function uploadDocumentToGoogleDrive(file, metadata = {}) {
    if (!file) throw new Error('Arquivo não informado.');
    const sessionData = await createGoogleDriveUploadSession({
      fileName: metadata.fileName || file.name,
      title: metadata.title || file.name,
      mimeType: metadata.mimeType || file.type || 'application/octet-stream',
      sizeBytes: file.size,
      category: metadata.category || 'outros',
      tags: metadata.tags || [],
      folderName: metadata.folderName || metadata.folder || '',
      folderId: metadata.folderId || metadata.folder_id || ''
    });
    const uploadUrl = sessionData?.session?.uploadUrl;
    if (!uploadUrl) throw new Error('A API não retornou a sessão de upload do Google Drive.');
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'Content-Length': String(file.size) },
      body: file
    });
    let driveFile = null;
    try { driveFile = await put.json(); } catch { driveFile = null; }
    if (!put.ok) throw new Error(driveFile?.error?.message || `Falha no upload para Google Drive (${put.status}).`);
    return completeGoogleDriveUpload({
      ...metadata,
      fileName: metadata.fileName || file.name,
      title: metadata.title || file.name,
      mimeType: metadata.mimeType || file.type || 'application/octet-stream',
      sizeBytes: file.size,
      driveFile,
      fileId: driveFile?.id
    });
  }

  async function downloadDocumentFile(documentId) {
    const session = getSession();
    const headers = new Headers();
    attachSessionAuthHeaders(headers, session);
    const response = await fetch(apiUrl(`/api/documents/${encodeURIComponent(documentId)}/download`), { headers, cache: 'no-store' });
    if (response.status === 401 && session?.refreshToken && await refreshSession()) return downloadDocumentFile(documentId);
    if (!response.ok) {
      let message = `Falha ao baixar documento (${response.status}).`;
      try { const payload = await response.json(); message = payload?.error || message; } catch {}
      throw new Error(message);
    }
    return response;
  }

  async function getDocumentCustomization(options = {}) {
    const mirror = readCustomizationMirror();
    try {
      const data = await cachedApiFetch('/api/customization/document', CACHE_TTL.customization, { ...options, noCache: options.noCache ?? options.forceRefresh ?? false });
      const custom = mergeCustomization(data?.customization || {}, mirror);
      if (hasUsefulCustomization(custom)) writeCustomizationMirror(custom);
      return custom;
    } catch (error) {
      if (hasUsefulCustomization(mirror)) return mirror;
      throw error;
    }
  }

  async function saveDocumentCustomization(payload) {
    const localPayload = payload && typeof payload === 'object' ? payload : {};
    if (hasUsefulCustomization(localPayload)) writeCustomizationMirror(localPayload);
    const data = await apiFetch('/api/customization/document', {
      method: 'PUT',
      body: JSON.stringify(localPayload),
      idempotencyKey: clientIdempotencyKey('save-customization')
    });
    const saved = mergeCustomization(data?.customization || {}, localPayload);
    writeApiCache('/api/customization/document', { ok: true, customization: saved });
    if (hasUsefulCustomization(saved)) writeCustomizationMirror(saved);
    return saved;
  }

  async function sendPlanDocumentEmail(payload) {
    const data = await apiFetch('/api/admin/plan-documents/send-email', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
    return data;
  }

  async function createProjectShare(projectId, expiresInDays = null) {
    const id = String(projectId || '').trim();
    if (!id) throw new Error('Projeto inválido para compartilhamento.');
    const payload = expiresInDays && typeof expiresInDays === 'object' ? expiresInDays : { expiresInDays };
    const data = await apiFetch(`/api/projects/${encodeURIComponent(id)}/share`, {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey: `project-share-${id}`
    });
    return data.share;
  }

  async function getProjectShare(projectId) {
    const data = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/share`);
    return data.share;
  }

  async function disableProjectShare(projectId) {
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/share`, { method: 'DELETE' });
  }

  async function ensureProjectPublicShort(projectId) {
    const id = String(projectId || '').trim();
    if (!id) throw new Error('Projeto inválido para link público curto.');
    const data = await apiFetch(`/api/projects/${encodeURIComponent(id)}/public-short`, {
      method: 'POST',
      body: JSON.stringify({}),
      idempotencyKey: `project-public-short-${id}`
    });
    return data?.publicShort || null;
  }

  async function getProjectPublicShort(projectId) {
    const id = String(projectId || '').trim();
    if (!id) return null;
    const data = await apiFetch(`/api/projects/${encodeURIComponent(id)}/public-short`);
    return data?.publicShort || null;
  }

  async function duplicateProject(projectId) {
    const data = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/duplicate`, { method: 'POST', body: JSON.stringify({}) });
    invalidateApiCache('/api/projects');
    return data.project;
  }

  async function listProjectVersions(projectId) {
    const data = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/versions`, { method: 'GET' });
    return data.versions || [];
  }

  async function restoreProjectVersion(projectId, versionId) {
    const data = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/versions`, { method: 'POST', body: JSON.stringify({ versionId }) });
    invalidateApiCache('/api/projects');
    invalidateApiCache(`/api/projects/${encodeURIComponent(projectId)}`);
    return data;
  }

  async function setProjectLock(projectId, locked = true) {
    const data = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/lock`, { method: 'POST', body: JSON.stringify({ locked }) });
    invalidateApiCache('/api/projects');
    invalidateApiCache(`/api/projects/${encodeURIComponent(projectId)}`);
    return data;
  }

  async function exportProjectBundle(projectId) {
    const result = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/export`, { method: 'GET' });
    window.__surveyorUsagePreconsumedExportAt = Date.now();
    return result;
  }


  const LOCAL_NOTICE_KEY = 'surveyor-system-notices-local-v21976';
  const LOCAL_NOTICE_READ_KEY = 'surveyor-system-notices-read-v21976';

  function readLocalJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }

  function writeLocalJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn('[Surveyor Avisos] Não foi possível salvar cache local:', error); }
  }

  function localNoticeId() {
    return crypto.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeLocalNotice(notice = {}) {
    const now = nowIso();
    return {
      id: notice.id || notice.Id || localNoticeId(),
      title: String(notice.title || notice.Title || '').trim(),
      message: String(notice.message || notice.Message || '').trim(),
      type: notice.type || notice.Type || 'info',
      deliveryMode: notice.deliveryMode || notice.DeliveryMode || 'notification',
      audience: notice.audience || notice.Audience || 'all',
      targetUserId: notice.targetUserId || notice.TargetUserId || null,
      targetPlanSlug: notice.targetPlanSlug || notice.TargetPlanSlug || null,
      requiresAck: Boolean(notice.requiresAck ?? notice.RequiresAck),
      blocksApp: Boolean(notice.blocksApp ?? notice.BlocksApp),
      isActive: notice.isActive === false || notice.IsActive === false || notice.isActive === 0 || notice.IsActive === 0 ? false : true,
      startsAt: notice.startsAt || notice.StartsAt || null,
      endsAt: notice.endsAt || notice.EndsAt || null,
      createdBy: notice.createdBy || notice.CreatedBy || null,
      createdAt: notice.createdAt || notice.CreatedAt || now,
      updatedAt: notice.updatedAt || notice.UpdatedAt || now,
      readAt: notice.readAt || notice.ReadAt || null,
      dismissedAt: notice.dismissedAt || notice.DismissedAt || null,
      deletedAt: notice.deletedAt || notice.DeletedAt || null,
      metadata: notice.metadata || notice.Metadata || {}
    };
  }

  function readLocalNotices() {
    return readLocalJson(LOCAL_NOTICE_KEY, [])
      .map(normalizeLocalNotice)
      .filter((notice) => notice.title && notice.message && !notice.deletedAt);
  }

  function writeLocalNotices(list) {
    writeLocalJson(LOCAL_NOTICE_KEY, list.map(normalizeLocalNotice));
    try { window.dispatchEvent(new CustomEvent('georural:notices-changed')); } catch {}
  }

  function mergeNoticeLists(primary = [], secondary = []) {
    const map = new Map();
    [...secondary, ...primary].forEach((notice) => {
      const item = normalizeLocalNotice(notice);
      if (item.id) map.set(String(item.id), item);
    });
    return [...map.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function noticeAppliesToUser(notice = {}, user = currentUser()) {
    if (!notice || notice.isActive === false) return false;
    const now = Date.now();
    const end = notice.endsAt ? new Date(notice.endsAt).getTime() : NaN;
    // Avisos agendados também podem aparecer no sino antes do início; o período
    // efetivo continua sendo respeitado para pop-up/banner/manutenção no portal.
    if (Number.isFinite(end) && end <= now) return false;
    const audience = String(notice.audience || 'all').toLowerCase();
    if (!user) return audience === 'all';
    const role = String(user.role || '').toLowerCase();
    const userId = String(user.id || user.sub || '').trim();
    if (audience === 'all') return true;
    if (audience === 'users') return role !== 'admin';
    if (audience === 'admins') return role === 'admin';
    if (audience === 'user') return Boolean(userId) && String(notice.targetUserId || '').trim() === userId;
    if (audience === 'plan') {
      if (role === 'admin') return false;
      return String(notice.targetPlanSlug || '').toLowerCase() === String(user.planSlug || currentPlan()?.slug || '').toLowerCase();
    }
    return false;
  }

  function noticeReadUserKey(user = currentUser()) {
    return String(user?.id || user?.sub || user?.email || 'anon').trim().toLowerCase();
  }

  function readNoticeReadMap(user = currentUser()) {
    const store = readLocalJson(LOCAL_NOTICE_READ_KEY, {});
    const key = noticeReadUserKey(user);
    if (store?.byUser && typeof store.byUser === 'object') return store.byUser[key] || {};
    // O formato legado era global entre contas. Não o reaproveitamos para evitar
    // que um usuário herde o estado "lida" de outro no mesmo navegador.
    return {};
  }

  function writeNoticeReadMap(readMap = {}, user = currentUser()) {
    const store = readLocalJson(LOCAL_NOTICE_READ_KEY, {});
    const key = noticeReadUserKey(user);
    const byUser = store?.byUser && typeof store.byUser === 'object' ? { ...store.byUser } : {};
    byUser[key] = readMap && typeof readMap === 'object' ? readMap : {};
    writeLocalJson(LOCAL_NOTICE_READ_KEY, { byUser });
  }

  function applyLocalReadState(notices = []) {
    const readMap = readNoticeReadMap();
    return notices.map((notice) => {
      const item = normalizeLocalNotice(notice);
      const readAt = readMap[item.id];
      return readAt ? { ...item, readAt, dismissedAt: item.dismissedAt || readAt } : item;
    });
  }


  async function loadSystemNotices(options = {}) {
    const local = readLocalNotices();
    try {
      const data = await cachedApiFetchFallbackMany(['/api/notices', '/api/system/notices', '/api/notifications'], CACHE_TTL.notices, options, false);
      const merged = mergeNoticeLists(data?.notices || [], local).filter((notice) => noticeAppliesToUser(notice));
      return applyLocalReadState(merged);
    } catch (error) {
      console.warn('[Surveyor Avisos] API indisponível; usando avisos locais:', error);
      return applyLocalReadState(local.filter((notice) => noticeAppliesToUser(notice)));
    }
  }

  async function markSystemNoticeRead(noticeId) {
    const id = String(noticeId || '');
    if (!id) return;
    const readMap = readNoticeReadMap();
    readMap[id] = nowIso();
    writeNoticeReadMap(readMap);
    try {
      await apiFetchFallbackMany([
        `/api/notices/${encodeURIComponent(id)}/read`,
        `/api/system/notices/${encodeURIComponent(id)}/read`,
        `/api/notifications/${encodeURIComponent(id)}/read`
      ], { method: 'POST' });
    } catch (error) {
      console.warn('[Surveyor Avisos] leitura salva localmente; API não confirmou:', error);
    }
    try { window.dispatchEvent(new CustomEvent('georural:notices-changed')); } catch {}
  }

  async function loadAdminNotices(options = {}) {
    const local = readLocalNotices();
    try {
      const data = await cachedApiFetchFallbackMany(['/api/admin/notices', '/api/admin/system-notices', '/api/system/admin/notices'], CACHE_TTL.notices, options);
      const merged = mergeNoticeLists(data?.notices || [], local);
      return merged.filter((notice) => !notice.deletedAt);
    } catch (error) {
      console.warn('[Surveyor Avisos] Administração usando cache local:', error);
      return local.filter((notice) => !notice.deletedAt);
    }
  }

  async function createSystemNotice(payload) {
    const data = await apiFetch('/api/admin/notices', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const saved = normalizeLocalNotice(data?.notice || payload);
    invalidateApiCache('/api/notices');
    invalidateApiCache('/api/admin/notices');
    writeLocalNotices(mergeNoticeLists([saved], readLocalNotices()));
    return saved;
  }

  async function updateSystemNotice(noticeId, payload) {
    const id = String(noticeId || '');
    if (!id) throw new Error('Aviso inválido.');
    const data = await apiFetch(`/api/admin/notices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    const saved = normalizeLocalNotice(data?.notice || { ...payload, id });
    invalidateApiCache('/api/notices');
    invalidateApiCache('/api/admin/notices');
    writeLocalNotices(mergeNoticeLists([saved], readLocalNotices().filter((notice) => String(notice.id) !== id)));
    return saved;
  }

  async function archiveSystemNotice(noticeId) {
    const id = String(noticeId || '');
    if (!id) throw new Error('Aviso inválido.');
    await apiFetch(`/api/admin/notices/${encodeURIComponent(id)}`, { method: 'DELETE' });
    writeLocalNotices(readLocalNotices().filter((notice) => String(notice.id) !== id));
    invalidateApiCache('/api/notices');
    invalidateApiCache('/api/admin/notices');
    return { id, archived: true };
  }

  async function deleteSystemNotice(noticeId) {
    const id = String(noticeId || '');
    if (!id) throw new Error('Aviso inválido.');
    await apiFetch(`/api/admin/notices/${encodeURIComponent(id)}/hard-delete`, { method: 'DELETE' });
    writeLocalNotices(readLocalNotices().filter((notice) => String(notice.id) !== id));
    invalidateApiCache('/api/notices');
    invalidateApiCache('/api/admin/notices');
    return { id, deleted: true };
  }

  // REV13: normaliza respostas de login antes de qualquer uso/exportação.
  // Esta função deve permanecer declarada antes de window.GeoRuralAuth.
  function normalizeAuthLoginPayload(data) {
    const source = data && typeof data === 'object' ? data : {};
    const session = source.session && typeof source.session === 'object' ? source.session : {};
    const user = source.user || source.profile || source.account || session.user || null;
    const accessToken = source.accessToken || source.token || source.jwt || source.access_token || session.accessToken || session.token || session.jwt || '';
    const refreshToken = source.refreshToken || source.refresh_token || source.refresh || session.refreshToken || session.refresh_token || session.refresh || '';
    return {
      user,
      accessToken: String(accessToken || '').trim(),
      refreshToken: String(refreshToken || '').trim(),
      geoservicesToken: String(source.geoservicesToken || source.geoservices_token || session.geoservicesToken || '').trim(),
      tokenType: source.tokenType || source.token_type || session.tokenType || session.token_type || 'Bearer',
      expiresIn: source.expiresIn || source.expires_in || session.expiresIn || session.expires_in || null,
      requiresEmailVerification: source.requiresEmailVerification === true || source.requiresVerification === true,
      verificationToken: String(source.verificationToken || source.verification_token || '').trim(),
      verificationCookie: source.verificationCookie === true,
      requiresPasswordChange: source.requiresPasswordChange === true || source.mustChangePassword === true,
      firstAccessToken: String(source.firstAccessToken || source.first_access_token || '').trim(),
      firstAccessCookie: source.firstAccessCookie === true,
      refreshCookie: source.refreshCookie === true,
      firstAccessUrl: source.firstAccessUrl || source.first_access_url || '/primeiro-acesso/',
      email: source.email || user?.email || '',
      maskedEmail: source.maskedEmail || source.masked_email || '',
      message: source.message || ''
    };
  }

  async function login(email, password) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !String(password || '')) return { ok: false, message: 'Informe o e-mail e a senha.' };
    try {
      const data = await apiFetch(`${CONFIG.authEndpoint}/login`, {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, password: String(password) })
      }, false);
      const normalizedLogin = normalizeAuthLoginPayload(data);
      if (normalizedLogin.requiresPasswordChange) {
        return {
          ok: false,
          requiresPasswordChange: true,
          firstAccessToken: normalizedLogin.firstAccessToken,
          firstAccessCookie: normalizedLogin.firstAccessCookie,
          firstAccessUrl: normalizedLogin.firstAccessUrl || '/primeiro-acesso/',
          email: normalizedLogin.email || normalizedEmail,
          maskedEmail: normalizedLogin.maskedEmail,
          message: normalizedLogin.message || 'Crie sua senha definitiva para continuar.'
        };
      }
      if (normalizedLogin.requiresEmailVerification) {
        return {
          ok: false,
          requiresEmailVerification: true,
          verificationToken: normalizedLogin.verificationToken,
          verificationCookie: normalizedLogin.verificationCookie,
          maskedEmail: normalizedLogin.maskedEmail,
          message: normalizedLogin.message || 'Informe o código enviado para o e-mail cadastrado.'
        };
      }
      if (!normalizedLogin.user || !normalizedLogin.accessToken) {
        return { ok: false, message: 'A API validou a requisição, mas não devolveu token de sessão compatível. Verifique o deploy da Function Appwrite.' };
      }
      const sessionTimestamp = nowIso();
      write(KEYS.session, {
        user: normalizeSessionUser(normalizedLogin.user),
        accessToken: normalizedLogin.accessToken,
        token: normalizedLogin.accessToken,
        geoservicesToken: normalizedLogin.geoservicesToken || '',
        ...(!normalizedLogin.refreshCookie && normalizedLogin.refreshToken ? { refreshToken: normalizedLogin.refreshToken } : {}),
        tokenType: normalizedLogin.tokenType || 'Bearer',
        expiresIn: normalizedLogin.expiresIn,
        createdAt: sessionTimestamp,
        updatedAt: sessionTimestamp,
        lastActivityAt: sessionTimestamp
      });
      recordSessionActivity(true);
      // A resposta de login já é autenticada. A conferência continua em segundo plano.
      queueMicrotask(() => { void ensureSession(); });
      return { ok: true, user: getSession()?.user || normalizedLogin.user };
    } catch (error) {
      const code = error.code || error.details?.code || null;
      const details = error.details || null;
      if (error.status === 401) {
        if (code === 'INVALID_CREDENTIALS' && Number.isFinite(Number(details?.remainingAttempts))) {
          return { ok: false, code, details, message: error.message || `Senha incorreta. Você só tem ${details.remainingAttempts} tentativa(s) restante(s).` };
        }
        return { ok: false, code, details, message: 'O e-mail ou a senha não conferem com o cadastro. Confirme os dados ou redefina a senha pelo administrador.' };
      }
      if (error.status === 403 || error.status === 429) return { ok: false, code, details, message: error.message || (error.status === 429 ? 'Aguarde antes de tentar novamente.' : 'A conta está bloqueada, pendente ou expirada.') };
      return { ok: false, code, details, message: error.message || 'Não foi possível validar a conta.' };
    }
  }


  async function changePassword(currentPassword, password, passwordConfirmation = '') {
    const current = String(currentPassword || '');
    const next = String(password || '');
    const confirmation = String(passwordConfirmation || '');
    if (!current) return { ok: false, message: 'Informe a senha atual.' };
    if (next.length < 12) return { ok: false, message: 'A nova senha deve possuir pelo menos 12 caracteres.' };
    if (confirmation && next !== confirmation) return { ok: false, message: 'As senhas informadas não são iguais.' };
    try {
      const data = await apiFetch(`${CONFIG.authEndpoint}/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, password: next, passwordConfirmation: confirmation })
      });
      const session = getSession();
      if (session?.user) {
        write(KEYS.session, { ...session, user: normalizeSessionUser({ ...session.user, mustChangePassword: false }), updatedAt: nowIso() });
      }
      window.dispatchEvent(new CustomEvent('surveyor:password-changed'));
      return { ok: true, user: currentUser(), message: data?.message || 'Senha alterada com sucesso.' };
    } catch (error) {
      return { ok: false, code: error.code || error.details?.code || null, message: error.message || 'Não foi possível alterar a senha.' };
    }
  }

  async function confirmFirstAccessPassword(firstAccessToken, password, passwordConfirmation = '') {
    const token = String(firstAccessToken || '').trim();
    const nextPassword = String(password || '');
    const confirmation = String(passwordConfirmation || '');
    if (!token && !isOfficialSurveyorWeb()) return { ok: false, message: 'A autorização do primeiro acesso não foi encontrada. Solicite um novo link de primeiro acesso.' };
    if (nextPassword.length < 12) return { ok: false, message: 'A nova senha deve possuir pelo menos 12 caracteres.' };
    if (confirmation && nextPassword !== confirmation) return { ok: false, message: 'As senhas informadas não são iguais.' };
    try {
      const data = await apiFetch(`${CONFIG.authEndpoint}/first-access/password`, {
        method: 'POST',
        body: JSON.stringify({ firstAccessToken: token, password: nextPassword, passwordConfirmation: confirmation })
      }, false);
      return { ok: true, email: data.email || '', message: data.message || 'Senha criada com sucesso.' };
    } catch (error) {
      return { ok: false, code: error.code || error.details?.code || null, message: error.message || 'Não foi possível concluir o primeiro acesso.' };
    }
  }

  async function requestPasswordReset(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return { ok: false, message: 'Informe o e-mail cadastrado.' };
    try {
      const data = await apiFetch(`${CONFIG.authEndpoint}/password-reset/request`, {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail })
      }, false);
      return {
        ok: true,
        resetToken: String(data.resetToken || data.token || '').trim(),
        resetCookie: data.resetCookie === true,
        maskedEmail: data.maskedEmail || '',
        message: data.message || 'Código enviado para o e-mail cadastrado.'
      };
    } catch (error) {
      return { ok: false, code: error.code || error.details?.code || null, message: error.message || 'Não foi possível iniciar a recuperação de senha.' };
    }
  }

  async function verifyPasswordResetCode(email, code, resetToken) {
    const normalizedEmail = normalizeEmail(email);
    const cleanCode = String(code || '').replace(/\D/g, '').slice(0, 6);
    if (!normalizedEmail || cleanCode.length !== 6 || (!resetToken && !isOfficialSurveyorWeb())) return { ok: false, message: 'Informe o código de 6 dígitos.' };
    try {
      const data = await apiFetch(`${CONFIG.authEndpoint}/password-reset/verify`, {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, code: cleanCode, resetToken })
      }, false);
      return {
        ok: true,
        resetAuthorization: String(data.resetAuthorization || '').trim(),
        resetAuthorizationCookie: data.resetAuthorizationCookie === true,
        message: data.message || 'Código confirmado.'
      };
    } catch (error) {
      return { ok: false, code: error.code || error.details?.code || null, message: error.message || 'Código incorreto.' };
    }
  }

  async function confirmPasswordReset(email, password, resetAuthorization) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || (!resetAuthorization && !isOfficialSurveyorWeb())) return { ok: false, message: 'Confirme primeiro o código recebido por e-mail.' };
    if (String(password || '').length < 12) return { ok: false, message: 'A nova senha deve possuir pelo menos 12 caracteres.' };
    try {
      const data = await apiFetch(`${CONFIG.authEndpoint}/password-reset/confirm`, {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, password: String(password), resetAuthorization })
      }, false);
      return { ok: true, message: data.message || 'Senha alterada com sucesso.' };
    } catch (error) {
      return { ok: false, code: error.code || error.details?.code || null, message: error.message || 'Não foi possível alterar a senha.' };
    }
  }


  async function verifyLoginCode(email, code, verificationToken) {
    const normalizedEmail = normalizeEmail(email);
    const cleanCode = String(code || '').replace(/\D/g, '').slice(0, 6);
    if (!normalizedEmail || cleanCode.length !== 6 || (!verificationToken && !isOfficialSurveyorWeb())) {
      return { ok: false, message: 'Informe o código de 6 dígitos enviado para o e-mail.' };
    }
    try {
      const data = await apiFetch(`${CONFIG.authEndpoint}/verify-login-code`, {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, code: cleanCode, verificationToken })
      }, false);
      const normalizedLogin = normalizeAuthLoginPayload(data);
      if (!normalizedLogin.user || !normalizedLogin.accessToken) {
        return { ok: false, message: 'Código aceito, mas a API não devolveu sessão válida.' };
      }
      const sessionTimestamp = nowIso();
      write(KEYS.session, {
        user: normalizeSessionUser(normalizedLogin.user),
        accessToken: normalizedLogin.accessToken,
        token: normalizedLogin.accessToken,
        geoservicesToken: normalizedLogin.geoservicesToken || '',
        ...(!normalizedLogin.refreshCookie && normalizedLogin.refreshToken ? { refreshToken: normalizedLogin.refreshToken } : {}),
        tokenType: normalizedLogin.tokenType || 'Bearer',
        expiresIn: normalizedLogin.expiresIn,
        createdAt: sessionTimestamp,
        updatedAt: sessionTimestamp,
        lastActivityAt: sessionTimestamp
      });
      recordSessionActivity(true);
      queueMicrotask(() => { void ensureSession(); });
      return { ok: true, user: getSession()?.user || normalizedLogin.user };
    } catch (error) {
      return { ok: false, message: error.message || 'Código inválido ou expirado.' };
    }
  }


  const PAGE_ROUTES = {
    'index.html': '/',
    'login.html': '/login/',
    'admin.html': '/admin/',
    'admin-cards.html': '/admin/',
    'mapa.html': '/mapa/',
    'car.html': '/car/',
    'consulta-car.html': '/consulta-car/',
    'nuvem.html': '/nuvem/',
    'customizacao.html': '/customizacao/',
    'memorial.html': '/memorial/',
    'ods.html': '/ods/',
    'confrontacao.html': '/confrontacao/',
    'acervos.html': '/acervos/',
    'mapas.html': '/mapas/',
    'pranchas.html': '/pranchas/',
    'planialtimetria.html': '/planialtimetria/',
    'perimetros.html': '/perimetros/',
    'ambiental.html': '/ambiental/',
    'loteamentos-reurb.html': '/loteamentos-reurb/',
    'glebas.html': '/glebas/',
    'earth-3d.html': '/earth-3d/',
    'public-project.html': '/public-project/',
    'sobre.html': '/sobre/',
    'suporte.html': '/suporte/'
  };

  function cleanRouteForPage(page) {
    const key = String(page || 'index.html').split('?')[0].split('#')[0];
    return PAGE_ROUTES[key] || (key.endsWith('.html') ? `/${key.slice(0, -5)}/` : (key.startsWith('/') ? key : `/${key}`));
  }

  function currentCleanReturnTarget() {
    const page = document.body?.dataset?.page;
    if (page) return `${cleanRouteForPage(page)}${location.search || ''}${location.hash || ''}`;
    return `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
  }

  let ensurePromise = null;

  function warmSessionResources() {
    if (sessionWarmupPromise) return sessionWarmupPromise;
    // Catálogo de camadas é carregado sob demanda pelo mapa/admin; a sessão global aquece apenas planos.
    sessionWarmupPromise = Promise.allSettled([loadPlans()])
      .finally(() => { sessionWarmupPromise = null; });
    return sessionWarmupPromise;
  }

  function accessTokenExpiresSoon(token, withinSeconds = 120) {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) return true;
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - (normalized.length % 4)) % 4);
      const payload = JSON.parse(atob(normalized + pad));
      const exp = Number(payload?.exp || 0);
      if (!Number.isFinite(exp) || exp <= 0) return true;
      return exp - Math.floor(Date.now() / 1000) <= Math.max(30, Number(withinSeconds) || 120);
    } catch {
      return true;
    }
  }

  async function ensureSession() {
    if (ensurePromise) return ensurePromise;
    ensurePromise = (async () => {
      const session = getSession();
      if (!session?.user || !session?.accessToken) return false;
      if (!isActiveUser(session.user) || isExpired(session.user)) {
        clear(KEYS.session);
        return false;
      }
      try {
        // R19: login/refresh valida plano e permissões no backend. No uso normal,
        // não chama /auth/me; apenas renova quando o JWT estiver próximo de expirar.
        if (accessTokenExpiresSoon(session.accessToken, 120)) {
          const refreshed = await refreshSession();
          if (!refreshed) return false;
        }
        void warmSessionResources();
        return true;
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          clear(KEYS.session);
          return false;
        }
        console.warn('A sessão foi preservada porque a API apresentou uma falha temporária:', error);
        return Boolean(getSession()?.accessToken);
      }
    })();
    try { return await ensurePromise; } finally { ensurePromise = null; }
  }

  function scheduleSessionWatch(delay = null) {
    if (sessionWatchTimer) clearTimeout(sessionWatchTimer);
    sessionWatchTimer = null;
    if (!getSession()?.accessToken) return;
    const wait = Number.isFinite(Number(delay))
      ? Number(delay)
      : (document.hidden ? SESSION_WATCH_HIDDEN_MS : SESSION_WATCH_VISIBLE_MS);
    sessionWatchTimer = setTimeout(runSessionWatch, Math.max(3_000, wait));
  }

  async function runSessionWatch() {
    if (sessionWatchInFlight || !getSession()?.accessToken) {
      scheduleSessionWatch();
      return;
    }
    sessionWatchInFlight = true;
    try {
      const session = getSession();
      if (accessTokenExpiresSoon(session?.accessToken, 120)) {
        const refreshed = await refreshSession();
        if (!refreshed) revokeLocalSession('SESSION_REVOKED', 'Sua sessão expirou. Entre novamente.');
      }
      if (!document.hidden && getSession()?.accessToken && Date.now() - lastPresenceSentAt >= PRESENCE_HEARTBEAT_MS) {
        lastPresenceSentAt = Date.now();
        apiFetch('/api/auth/presence', { method: 'POST', body: JSON.stringify({}), cache: 'no-store', timeoutMs: 8_000 }, true)
          .catch((error) => console.warn('[Surveyor presence]', error?.message || error));
      }
    } catch (error) {
      const reason = sessionRevocationReason(error);
      if (reason || error?.status === 401 || error?.status === 403) {
        revokeLocalSession(reason || 'SESSION_REVOKED', error?.message || 'Sua sessão foi encerrada.');
      }
    } finally {
      sessionWatchInFlight = false;
      scheduleSessionWatch();
    }
  }

  function startSessionWatch() {
    if (!getSession()?.accessToken) return;
    scheduleSessionWatch(3_500);
  }

  async function logout() {
    const session = getSession() || {};
    const refreshToken = session.refreshToken;
    const accessToken = session.accessToken;
    try {
      await fetch(apiUrl(`${CONFIG.authEndpoint}/logout`), {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(refreshToken ? { refreshToken } : {})
      });
    } catch (error) {
      console.warn('Não foi possível registrar a saída na API:', error);
    } finally {
      clear(KEYS.session);
      clearSessionActivity();
      invalidateApiCache();
      location.href = '/login/';
    }
  }

  const BASIC_FALLBACK_PERMISSIONS = ["map:access","map:view","map:create-basic","map:draw-basic","map:measure-basic","projects:access","projects:create","projects:edit-own","projects:view-own","projects:export","projects:export-basic","projects:unlimited","projects:templates-standard","documents:memorial","documents:memorial-basic","documents:ods","documents:ods-basic","documents:confrontacao","documents:confrontacao-basic","documents:mapas","documents:mapas-basic","documents:pranchas","documents:pranchas-basic","documents:download","cloud:access","cloud:view-own","cloud:basic","support:standard"];
  const PLUS_FALLBACK_PERMISSIONS = ["map:access","map:view","map:create-basic","map:draw-basic","map:measure-basic","projects:access","projects:create","projects:edit-own","projects:view-own","projects:export","projects:export-basic","projects:unlimited","projects:templates-standard","documents:memorial","documents:memorial-basic","documents:ods","documents:ods-basic","documents:confrontacao","documents:confrontacao-basic","documents:mapas","documents:mapas-basic","documents:pranchas","documents:pranchas-basic","documents:download","cloud:access","cloud:view-own","cloud:basic","support:standard","basic:*","car:access","car:full","layers:official","layers:catalog","layers:catalog-full","layers:view-full","layers:wms-wfs","geometry:access","geometry:edit-basic","geometry:offset","geometry:rotate","geometry:scale","geometry:mirror","geometry:vertices-edit","sig:access","sig:basic","terrain:access","terrain:basic","ambiental:access","ambiental:basic","loteamentos:access","loteamentos:basic","documents:perimetros","documents:perimetros-full","documents:planialtimetria","documents:planialtimetria-basic","sharing:readonly","sharing:password","sharing:expires","sharing:revoke","sharing:access-limit","workspace:members","workspace:settings","workspace:storage","workspace:audit-own","security:account-monitoring"];
  const PRO_FALLBACK_PERMISSIONS = ["map:access","map:view","map:create-basic","map:draw-basic","map:measure-basic","projects:access","projects:create","projects:edit-own","projects:view-own","projects:export","projects:export-basic","projects:unlimited","projects:templates-standard","documents:memorial","documents:memorial-basic","documents:ods","documents:ods-basic","documents:confrontacao","documents:confrontacao-basic","documents:mapas","documents:mapas-basic","documents:pranchas","documents:pranchas-basic","documents:download","cloud:access","cloud:view-own","cloud:basic","support:standard","basic:*","car:access","car:full","layers:official","layers:catalog","layers:catalog-full","layers:view-full","layers:wms-wfs","geometry:access","geometry:edit-basic","geometry:offset","geometry:rotate","geometry:scale","geometry:mirror","geometry:vertices-edit","sig:access","sig:basic","terrain:access","terrain:basic","ambiental:access","ambiental:basic","loteamentos:access","loteamentos:basic","documents:perimetros","documents:perimetros-full","documents:planialtimetria","documents:planialtimetria-basic","sharing:readonly","sharing:password","sharing:expires","sharing:revoke","sharing:access-limit","workspace:members","workspace:settings","workspace:storage","workspace:audit-own","security:account-monitoring","plus:*","projects:trash","projects:lock","projects:version-full","projects:templates","projects:export-zip","geometry:advanced","sig:advanced","terrain:advanced","ambiental:full","loteamentos:full","planialtimetria:full","sharing:full","company:settings","cloud:pro","support:priority"];
  const PERMISSION_ALIASES = {
    'mapa': ['map:access', 'map:view'],
    'map': ['map:access', 'map:view'],
    'map:view': ['map:access'],
    'map:access': ['map:view', 'map:create-basic', 'map:draw-basic', 'map:measure-basic'],
    'layers:catalog': ['layers:catalog-full', 'layers:view-full'],
    'layers:catalog-full': ['layers:catalog', 'layers:view-full'],
    'layers:view-basic': ['layers:official', 'layers:official-basic'],
    'layers:official': ['layers:official-basic'],
    'layers:official-basic': ['layers:official'],
    'acervos': ['layers:official', 'layers:official-basic'],
    'memorial': ['documents:memorial', 'documents:memorial-basic', 'documents:memorial-full'],
    'documents:memorial': ['documents:memorial-basic', 'documents:memorial-full'],
    'documents:memorial-basic': ['documents:memorial'],
    'documents:memorial-full': ['documents:memorial'],
    'ods': ['documents:ods', 'documents:ods-basic', 'documents:ods-full'],
    'documents:ods': ['documents:ods-basic', 'documents:ods-full'],
    'documents:ods-basic': ['documents:ods'],
    'documents:ods-full': ['documents:ods'],
    'confrontacao': ['documents:confrontacao', 'documents:confrontacao-basic', 'documents:confrontacao-full'],
    'documents:confrontacao': ['documents:confrontacao-basic', 'documents:confrontacao-full'],
    'documents:confrontacao-basic': ['documents:confrontacao'],
    'documents:confrontacao-full': ['documents:confrontacao'],
    'mapas': ['documents:mapas', 'documents:mapas-basic', 'documents:mapas-full'],
    'documents:mapas': ['documents:mapas-basic', 'documents:mapas-full'],
    'documents:mapas-basic': ['documents:mapas'],
    'documents:mapas-full': ['documents:mapas'],
    'pranchas': ['documents:pranchas', 'documents:pranchas-basic', 'documents:pranchas-full'],
    'documents:pranchas': ['documents:pranchas-basic', 'documents:pranchas-full'],
    'documents:pranchas-basic': ['documents:pranchas'],
    'documents:pranchas-full': ['documents:pranchas'],
    'perimetros': ['documents:perimetros', 'documents:perimetros-full'],
    'documents:perimetros': ['documents:perimetros-full'],
    'documents:perimetros-full': ['documents:perimetros'],
    'planialtimetria': ['documents:planialtimetria', 'documents:planialtimetria-basic', 'planialtimetria:full'],
    'documents:planialtimetria': ['documents:planialtimetria-basic', 'planialtimetria:full'],
    'documents:planialtimetria-basic': ['documents:planialtimetria'],
    'car': ['car:access', 'car:full'],
    'car:access': ['car:full'],
    'car:full': ['car:access'],
    'ambiental': ['ambiental:access', 'ambiental:basic', 'ambiental:full'],
    'ambiental:access': ['ambiental:basic', 'ambiental:full'],
    'ambiental:basic': ['ambiental:access'],
    'ambiental:full': ['ambiental:access', 'ambiental:basic'],
    'loteamentos': ['loteamentos:access', 'loteamentos:basic', 'loteamentos:full'],
    'loteamentos:access': ['loteamentos:basic', 'loteamentos:full'],
    'loteamentos:basic': ['loteamentos:access'],
    'loteamentos:full': ['loteamentos:access', 'loteamentos:basic'],
    'cloud': ['cloud:access', 'cloud:view-own', 'cloud:basic', 'cloud:plus', 'cloud:pro'],
    'cloud:access': ['cloud:view-own', 'cloud:basic'],
    'cloud:view-own': ['cloud:access'],
    'cloud:basic': ['cloud:access'],
    'support': ['support:standard']
  };

  function permissionCandidates(permission) {
    const key = String(permission || '').trim().toLowerCase();
    if (!key) return [];
    return [...new Set([key, ...(PERMISSION_ALIASES[key] || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)])];
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


  function expandedPermissionSet(user = currentUser(), plan = currentPlan()) {
    const raw = [
      ...(Array.isArray(plan?.permissions) ? plan.permissions : []),
      ...(Array.isArray(user?.planPermissions) ? user.planPermissions : []),
      ...(Array.isArray(user?.effectivePermissions) ? user.effectivePermissions : []),
      ...(Array.isArray(user?.permissions) ? user.permissions : []),
      ...(Array.isArray(user?.features) ? user.features : []),
      ...(Array.isArray(user?.scopes) ? user.scopes : [])
    ].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
    const planSlug = String(plan?.slug || user?.planSlug || user?.planId || user?.plan || user?.billingPlan || '').toLowerCase();
    const tier = /^(?:pro(?:_annual|_monthly)?|pro-max|promax)$/.test(planSlug) ? 'pro'
      : /^(?:plus(?:_annual|_monthly)?)$/.test(planSlug) ? 'plus'
      : /^(?:basic(?:_annual|_monthly)?)$/.test(planSlug) ? 'basic' : '';
    const official = tier === 'pro' ? PRO_FALLBACK_PERMISSIONS : tier === 'plus' ? PLUS_FALLBACK_PERMISSIONS : tier === 'basic' ? BASIC_FALLBACK_PERMISSIONS : null;
    let set;
    if (official) {
      const officialSet = new Set(official.map((item) => String(item).toLowerCase()));
      // A matriz oficial do plano é a autoridade para titular e membros.
      // Um membro da equipe não perde recursos do plano compartilhado por causa
      // do papel collaborator/technician/manager.
      set = new Set(officialSet);
      set.add(`${tier}:*`);
    } else {
      set = new Set(raw);
    }
    if (user?.isSubuser !== true) {
      if (set.has('pro:*')) { set.add('plus:*'); PRO_FALLBACK_PERMISSIONS.forEach((perm) => set.add(String(perm).toLowerCase())); }
      if (set.has('plus:*')) { set.add('basic:*'); PLUS_FALLBACK_PERMISSIONS.forEach((perm) => set.add(String(perm).toLowerCase())); }
      if (set.has('basic:*')) BASIC_FALLBACK_PERMISSIONS.forEach((perm) => set.add(String(perm).toLowerCase()));
    }
    addPermissionAliases(set);
    return set;
  }

  function effectivePermissions() {
    return [...expandedPermissionSet()].sort();
  }

  function hasPermission(permission) {
    const user = currentUser();
    if (!user) return false;
    if (!permission) return true;
    const rawUserPermissions = Array.isArray(user.permissions) ? user.permissions.map(String) : [];
    if (user.role === 'admin' || rawUserPermissions.includes('admin:all') || rawUserPermissions.includes('*') || rawUserPermissions.includes('all')) return true;

    const expanded = expandedPermissionSet(user, currentPlan());
    const perm = String(permission).trim().toLowerCase();
    const candidates = permissionCandidates(perm);
    if (expanded.has('*') || expanded.has('all') || candidates.some((candidate) => expanded.has(candidate))) return true;
    for (const candidate of candidates) {
      const [scope, action] = candidate.split(':');
      if (expanded.has(`${scope}:*`)) return true;
      if (action && /-basic$/.test(action) && (expanded.has(`${scope}:full`) || expanded.has(`${scope}:advanced`) || expanded.has(`${scope}:access`))) return true;
      if (action === 'access' && (expanded.has(`${scope}:full`) || expanded.has(`${scope}:basic`) || expanded.has(`${scope}:view-basic`) || expanded.has(`${scope}:view-full`))) return true;
      if (action === 'view-basic' && (expanded.has(`${scope}:view-full`) || expanded.has(`${scope}:catalog-full`) || expanded.has(`${scope}:access`))) return true;
      if (action === 'official-basic' && (expanded.has(`${scope}:official`) || expanded.has(`${scope}:view-full`))) return true;
      if (scope === 'projects' && action === 'limit-20' && (expanded.has('projects:limit-100') || expanded.has('projects:limit-500') || expanded.has('projects:unlimited'))) return true;
      if (scope === 'projects' && action === 'limit-100' && (expanded.has('projects:limit-500') || expanded.has('projects:unlimited'))) return true;
      if (scope === 'projects' && action === 'limit-500' && expanded.has('projects:unlimited')) return true;
    }
    return false;
  }

  function requireAuth() {
    const session = getSession();
    const user = session?.user;
    if (session?.accessToken && sessionIdleExpired()) {
      clear(KEYS.session);
      clearSessionActivity();
      const returnTo = encodeURIComponent(currentCleanReturnTarget());
      location.replace(`/login/?return=${returnTo}&reason=idle_timeout`);
      return null;
    }
    if (user && isExpired(user) && String(user.role || '').toLowerCase() !== 'admin') {
      clear(KEYS.session);
      location.replace('/login/?reason=plan_expired');
      return null;
    }
    if (!user || !session?.accessToken || !isActiveUser(user)) {
      clear(KEYS.session);
      const returnTo = encodeURIComponent(currentCleanReturnTarget());
      location.replace(`/login/?return=${returnTo}`);
      return null;
    }
    ensureSession().then((valid) => {
      if (!valid && !getSession()) {
        const returnTo = encodeURIComponent(currentCleanReturnTarget());
        location.replace(`/login/?return=${returnTo}`);
      }
    });
    return user;
  }

  function requireAdmin() {
    const user = requireAuth();
    const rawPermissions = Array.isArray(user?.permissions) ? user.permissions.map(String) : [];
    const allowed = user?.role === 'admin' || rawPermissions.includes('admin:all');
    if (user && !allowed) location.replace('/');
    return allowed ? user : null;
  }


















  removeLegacyDemoSessions();
  if (!sessionStorage.getItem(KEYS.layers)) write(KEYS.layers, []);


  async function loadUsageStatus() {
    const data = await apiFetch('/api/usage/status', { method: 'GET', noCache: true });
    return data?.usage || null;
  }

  async function loadStorageStatus() {
    const data = await apiFetch('/api/storage/status', { method: 'GET', noCache: true });
    return data?.storage || null;
  }

  async function consumeUsage(kind = 'download', meta = {}) {
    const normalized = String(kind || 'download').toLowerCase() === 'export' ? 'export' : 'download';
    const data = await apiFetch('/api/usage/consume', {
      method: 'POST',
      body: JSON.stringify({ kind: normalized, source: String(meta.source || 'frontend'), fileName: String(meta.fileName || '') })
    });
    if (data?.usage) window.dispatchEvent(new CustomEvent('surveyor:usage-updated', { detail: data.usage }));
    return data;
  }

  function classifyDownloadQuota(fileName = '') {
    const lower = String(fileName || '').toLowerCase();
    if (/\.(zip|geojson|json|kml|kmz|shp|dxf|csv)(?:$|\?)/i.test(lower)) return 'export';
    return 'download';
  }

  function installDownloadQuotaGate() {
    if (window.__surveyorDownloadQuotaGateInstalled || typeof HTMLAnchorElement === 'undefined') return;
    window.__surveyorDownloadQuotaGateInstalled = true;
    const nativeClick = HTMLAnchorElement.prototype.click;
    const bypass = new WeakSet();

    const nativeDownload = (sourceAnchor, href, fileName, blobSnapshot = null) => {
      const anchor = sourceAnchor.cloneNode(true);
      anchor.removeAttribute('id');
      anchor.style.display = 'none';
      anchor.download = fileName;
      let temporaryUrl = '';
      if (blobSnapshot instanceof Blob) {
        temporaryUrl = URL.createObjectURL(blobSnapshot);
        anchor.href = temporaryUrl;
      } else {
        anchor.href = href;
      }
      document.body.appendChild(anchor);
      bypass.add(anchor);
      try {
        nativeClick.call(anchor);
      } finally {
        window.setTimeout(() => {
          bypass.delete(anchor);
          anchor.remove();
          if (temporaryUrl) {
            try { URL.revokeObjectURL(temporaryUrl); } catch {}
          }
        }, 60_000);
      }
    };

    HTMLAnchorElement.prototype.click = function surveyorQuotaAwareClick() {
      const anchor = this;
      const fileName = String(anchor.download || '').trim();
      if (!fileName || bypass.has(anchor)) return nativeClick.call(anchor);
      const href = String(anchor.href || '');
      if (!getSession()?.accessToken) return nativeDownload(anchor, href, fileName);
      // Downloads servidos pela API já são contabilizados no backend da própria rota.
      if (/\/api\/documents\/[^/]+\/download(?:$|\?)/i.test(href) || /\/api\/projects\/[^/]+\/export(?:$|\?)/i.test(href)) return nativeDownload(anchor, href, fileName);
      const kind = classifyDownloadQuota(fileName);
      if (kind === 'export' && Date.now() - Number(window.__surveyorUsagePreconsumedExportAt || 0) < 8000) {
        window.__surveyorUsagePreconsumedExportAt = 0;
        return nativeDownload(anchor, href, fileName);
      }

      // Os geradores usam blob: URLs e historicamente revogam a URL poucos
      // segundos depois de chamar click(). Como a franquia é validada no
      // backend antes do download, essa espera podia fazer Edge/Chromium
      // receber uma URL já revogada. Tiramos uma cópia do Blob imediatamente
      // e criamos uma URL nova somente após a autorização da franquia.
      const blobSnapshotPromise = /^blob:/i.test(href)
        ? fetch(href).then((response) => response.blob()).catch(() => null)
        : Promise.resolve(null);

      Promise.all([
        consumeUsage(kind, { source: 'browser-download', fileName }),
        blobSnapshotPromise
      ]).then(([, blobSnapshot]) => {
        nativeDownload(anchor, href, fileName, blobSnapshot);
      }).catch((error) => {
        const msg = String(error?.message || 'Limite diário atingido para o seu plano.');
        if (typeof window.showSuiteToast === 'function') window.showSuiteToast(msg, 'error');
        else alert(msg);
      });
    };
  }

  function openStorageStore() {
    window.open('https://loja.surveyorr.com.br', '_blank', 'noopener,noreferrer');
  }

  window.GeoRuralAuth = {
    KEYS,
    CONFIG,
    read,
    write,
    uid,
    getSession,
    currentUser,
    currentPlan,
    login,
    changePassword,
    confirmFirstAccessPassword,
    requestPasswordReset,
    verifyPasswordResetCode,
    confirmPasswordReset,
    verifyLoginCode,
    logout,
    ensureSession,
    refreshSession,
    checkHealth,
    requireAuth,
    requireAdmin,
    hasPermission,
    effectivePermissions,
    isExpired,
    renewalDaysLeft,
    apiFetch,
    cachedApiFetch,
    cachedApiFetchFallbackMany,
    invalidateApiCache,
    apiBinaryFetch,
    uploadLargeLayerGeoJson,
    uploadLayerSourceZip,
    getLayerSourceUploadStatus,
    cancelLayerSourceUpload,
    loadLayerGeoJson,
    streamLayerFull,
    streamLayerViewport,
    loadPlans,
    loadLayers,
    loadLayerPreferences,
    saveLayerPreferences,
    saveLayerCatalogState,
    sanitizeLayerPreferencesForCurrentCatalog,
    emitLayerCatalogChanged,
    onLayerCatalogChanged,
    loadUsers,
    createUser,
    updateRemoteUser,
    updateUserEmail,
    deleteRemoteUser,
    loadWorkspaceTeam,
    updateWorkspaceTeam,
    createSubuser,
    updateSubuser,
    deleteSubuser,
    createPlan,
    updatePlan,
    deletePlan,
    dedupePlans,
    loadAdminLayers,
    loadLayerGroups,
    createLayerGroup,
    publishLayerGroup,
    testLayerUrl,
    seedGeobahiaOfficialLayers,
    loadRemoteLayerData,
    startRemoteLayerImport,
    getRemoteLayerImportStatus,
    cancelRemoteLayerImport,
    startLayerSpatialIndex,
    cancelLayerSpatialIndex,
    createLayer,
    updateLayer,
    uploadLayerGeoJson,
    publishLayer,
    archiveLayer,
    listProjects,
    getProject,
    createProject,
    updateProject,
    replaceProjectFeatures,
    saveProjectBundle,
    deleteProject,
    listTrashedProjects,
    restoreProject,
    listDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    getGoogleDriveStatus,
    connectGoogleDrive,
    testGoogleDrive,
    uploadDocumentToGoogleDrive,
    downloadDocumentFile,
    loadGenerationStatus,
    consumeGeneration,
    consumeUsage,
    loadUsageStatus,
    loadStorageStatus,
    openStorageStore,
    getDocumentCustomization,
    saveDocumentCustomization,
    sendPlanDocumentEmail,
    createProjectShare,
    getProjectShare,
    disableProjectShare,
    ensureProjectPublicShort,
    getProjectPublicShort,
    duplicateProject,
    listProjectVersions,
    restoreProjectVersion,
    setProjectLock,
    exportProjectBundle,
    loadSystemNotices,
    markSystemNoticeRead,
    loadAdminNotices,
    createSystemNotice,
    updateSystemNotice,
    archiveSystemNotice,
    deleteSystemNotice,
    getUsers: () => read(KEYS.users, []),
    getPlans: () => read(KEYS.plans, []),
    getLayers: () => read(KEYS.layers, []),
    setLayers: (layers) => write(KEYS.layers, layers),
    getLayerPrefs: () => read(KEYS.layerPrefs, {}),
    getLayerCatalogState,
    isLayerCatalogStateConfigured,
    setLayerPrefs: (prefs) => write(KEYS.layerPrefs, prefs),
    normalizeEmail,
    normalizeAuthLoginPayload,
    startSessionWatch,
    runSessionWatch
  };
  const USER_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'input', 'change', 'wheel', 'touchstart'];
  USER_ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, (event) => {
      // Atualizar pelo navegador (Ctrl/Cmd+R ou F5) não conta como atividade:
      // o guard precisa conseguir detectar o tempo ocioso antes do reload.
      if (eventName === 'keydown' && (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'r'))) return;
      recordSessionActivity(false);
    }, { passive: true, capture: true });
  });
  if (getSession()?.accessToken) recordSessionActivity(false);

  window.addEventListener('focus', () => {
    if (getSession()?.accessToken) scheduleSessionWatch(250);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getSession()?.accessToken) scheduleSessionWatch(250);
    else if (getSession()?.accessToken) scheduleSessionWatch();
  });
  window.addEventListener('georural:session-revoked', (event) => {
    const reason = String(event.detail?.reason || 'SESSION_REVOKED').toLowerCase();
    const message = String(event.detail?.message || 'Sua sessão foi encerrada. Entre novamente.');
    try { sessionStorage.setItem('surveyor:last-session-revocation', JSON.stringify({ reason, message, at: nowIso() })); } catch {}
    if (!/\/login\/?$/i.test(location.pathname)) {
      const loginReason = reason === 'account_blocked' || reason === 'workspace_member_blocked'
        ? 'account_blocked'
        : reason === 'plan_expired'
          ? 'plan_expired'
          : 'session_revoked';
      location.replace(`/login/?reason=${encodeURIComponent(loginReason)}`);
    }
  });

  window.SurveyorAuth = window.GeoRuralAuth;
  installDownloadQuotaGate();
  startSessionWatch();
})();
