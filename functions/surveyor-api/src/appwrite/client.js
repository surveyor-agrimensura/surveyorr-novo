export function createAppwriteClient({ env, statusError, appwriteId, normalizeEmail, invalidateLayerCatalogCache = () => {} }) {
  function endpoint() {
    const value = String(env('APPWRITE_ENDPOINT') || env('APPWRITE_FUNCTION_API_ENDPOINT') || 'https://cloud.appwrite.io/v1').replace(/\/+$/, '');
    const localAllowed = String(env('ALLOW_INSECURE_APPWRITE_LOCAL', 'false')).toLowerCase() === 'true' && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value);
    if (!/^https:\/\//i.test(value) && !localAllowed) throw statusError(500, 'APPWRITE_ENDPOINT deve usar HTTPS.');
    return value;
  }

  function projectId() { return env('APPWRITE_PROJECT_ID') || env('APPWRITE_FUNCTION_PROJECT_ID'); }
  function databaseId() { return env('APPWRITE_DATABASE_ID', 'surveyor_db'); }
  function apiKey() { return env('APPWRITE_FUNCTION_API_KEY') || env('APPWRITE_API_KEY'); }

  function collectionId(name) {
    const map = {
      projects: env('APPWRITE_COLLECTION_PROJECTS', 'projects'),
      folders: env('APPWRITE_COLLECTION_FOLDERS', 'folders'),
      documents: env('APPWRITE_COLLECTION_DOCUMENTS', 'documents'),
      customization: env('APPWRITE_COLLECTION_CUSTOMIZATION', 'customization'),
      users_profile: env('APPWRITE_COLLECTION_USERS_PROFILE', 'users_profile'),
      layers: env('APPWRITE_COLLECTION_LAYERS', 'layers'),
      layer_groups: env('APPWRITE_COLLECTION_LAYER_GROUPS', 'layer_groups'),
      plans: env('APPWRITE_COLLECTION_PLANS', 'plans'),
      workspace_members: env('APPWRITE_COLLECTION_WORKSPACE_MEMBERS', 'workspace_members'),
      commerce_orders: env('APPWRITE_COLLECTION_COMMERCE_ORDERS', 'commerce_orders'),
      payment_events: env('APPWRITE_COLLECTION_PAYMENT_EVENTS', 'payment_events'),
      security_events: env('APPWRITE_COLLECTION_SECURITY_EVENTS', 'security_events')
    };
    return map[name] || name;
  }

  function bucketId(name) {
    const map = {
      project_files: env('APPWRITE_BUCKET_PROJECT_FILES', 'project_files'),
      generated_documents: env('APPWRITE_BUCKET_GENERATED_DOCUMENTS', 'generated_documents'),
      user_assets: env('APPWRITE_BUCKET_USER_ASSETS', 'user_assets')
    };
    return map[name] || name;
  }

  function jsonHeaders(extra = {}) {
    return {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Appwrite-Project': projectId(),
      ...(apiKey() ? { 'X-Appwrite-Key': apiKey() } : {}),
      ...extra
    };
  }

  async function parseAppwriteResponse(response) {
    const type = response.headers.get('content-type') || '';
    if (type.includes('application/json')) return response.json();
    return response.text();
  }

  function appwriteTimeoutMs() {
    const value = Number(env('APPWRITE_UPSTREAM_TIMEOUT_MS', '15000'));
    return Number.isFinite(value) ? Math.max(3000, Math.min(60000, value)) : 15000;
  }

  async function fetchWithAbortTimeout(url, options = {}, timeoutMs = appwriteTimeoutMs()) {
    const controller = new AbortController();
    const parentSignal = options.signal;
    const abortFromParent = () => controller.abort(parentSignal?.reason);
    if (parentSignal?.aborted) controller.abort(parentSignal.reason);
    else parentSignal?.addEventListener?.('abort', abortFromParent, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('Tempo limite da comunicação com o Appwrite excedido.')), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted && !parentSignal?.aborted) {
        throw statusError(504, 'O Appwrite demorou além do limite configurado para responder. Tente novamente.', { code: 'APPWRITE_UPSTREAM_TIMEOUT' });
      }
      throw error;
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener?.('abort', abortFromParent);
    }
  }

  async function awFetch(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const { timeoutMs: requestedTimeout, retryTransient = true, ...requestOptions } = options;
    const timeoutMs = Number.isFinite(Number(requestedTimeout)) && Number(requestedTimeout) > 0
      ? Math.max(100, Math.min(appwriteTimeoutMs(), Number(requestedTimeout)))
      : appwriteTimeoutMs();
    const maxAttempts = retryTransient && ['GET', 'HEAD'].includes(method) ? 2 : 1;
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetchWithAbortTimeout(`${endpoint()}${path}`, {
          ...requestOptions,
          headers: { ...jsonHeaders(), ...(requestOptions.headers || {}) }
        }, timeoutMs);
        const payload = await parseAppwriteResponse(response).catch(() => null);
        if (!response.ok) {
          const message = payload?.message || payload?.error || (typeof payload === 'string' ? payload.slice(0, 300) : '') || `Erro Appwrite HTTP ${response.status}`;
          const error = statusError(response.status >= 500 ? 502 : response.status, message, payload);
          error.appwriteStatus = response.status;
          if (attempt < maxAttempts && [502, 503, 504].includes(response.status)) {
            await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
            continue;
          }
          throw error;
        }
        return payload;
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts || !['GET', 'HEAD'].includes(method) || ![502, 503, 504].includes(Number(error?.status || 0))) throw error;
        await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
      }
    }
    throw lastError || statusError(502, 'Falha de comunicação com o Appwrite.');
  }

  function isPathUnsupported(error) { return [400, 404, 405].includes(Number(error?.appwriteStatus || error?.status)); }
  function normalizeListPayload(payload) { const rows = payload?.documents || payload?.rows || []; return Array.isArray(rows) ? rows : []; }
  function rowData(row = {}) { const safeRow = row && typeof row === 'object' ? row : {}; return safeRow.data && typeof safeRow.data === 'object' ? { ...safeRow.data, $id: safeRow.$id || safeRow.$sequence } : safeRow; }
  function queryParam(query) { return `queries[]=${encodeURIComponent(query)}`; }
  function qs(queries = []) { const clean = queries.filter(Boolean).map(queryParam); return clean.length ? `?${clean.join('&')}` : ''; }
  function appwriteQuery(method, attribute, values) {
    const payload = { method };
    if (attribute) payload.attribute = attribute;
    if (values !== undefined) payload.values = Array.isArray(values) ? values : [values];
    return JSON.stringify(payload);
  }

  const Query = Object.freeze({
    equal(attribute, values) { return appwriteQuery('equal', attribute, Array.isArray(values) ? values : [values]); },
    orderDesc(attribute) { return appwriteQuery('orderDesc', attribute, []); },
    orderAsc(attribute) { return appwriteQuery('orderAsc', attribute, []); },
    limit(value) { return appwriteQuery('limit', '', [Number(value) || 25]); },
    offset(value) { return appwriteQuery('offset', '', [Math.max(0, Number(value) || 0)]); }
  });

  function errorText(error) { return `${error?.message || ''} ${JSON.stringify(error?.details || {})}`; }
  function invalidDateAttributeFromError(error) {
    const text = errorText(error);
    if (!/Invalid document structure/i.test(text)) return null;
    const match = text.match(/Attribute\s+\\?"([A-Za-z0-9_]*(?:At|Date|Until))\\?"/i);
    return match ? match[1] : null;
  }

  const APPWRITE_DATE_FIELD_PATTERN = /(?:At|Date|Until)$/i;
  function toStrictIsoUtc(value, fieldName = 'data') {
    if (value === null || value === undefined || value === '') return value;
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) throw statusError(400, `Data inválida em ${fieldName}.`);
      return value.toISOString();
    }
    let timestamp;
    if (typeof value === 'number' && Number.isFinite(value)) timestamp = Math.trunc(value);
    else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) timestamp = Number(value.trim());
    else timestamp = Date.parse(String(value));
    if (!Number.isFinite(timestamp)) throw statusError(400, `Data inválida em ${fieldName}. Use ISO 8601.`);
    return new Date(timestamp).toISOString();
  }

  function normalizeAppwriteDateFields(data = {}) {
    const clean = { ...data };
    for (const [key, value] of Object.entries(clean)) {
      if (!APPWRITE_DATE_FIELD_PATTERN.test(key) || value === null || value === undefined || value === '') continue;
      clean[key] = toStrictIsoUtc(value, key);
    }
    return clean;
  }

  function legacyIntegerDateSchemaEnabled(collectionName = '') {
    const normalized = String(collectionName || '').trim().toLowerCase();
    if (['layers', 'layer_groups'].includes(normalized)) return true;
    return String(env('ALLOW_LEGACY_INTEGER_DATE_SCHEMA', 'false')).toLowerCase() === 'true';
  }

  function toEpochMillis(value, fieldName = 'data') {
    const iso = toStrictIsoUtc(value, fieldName);
    if (iso === null || iso === undefined || iso === '') return iso;
    return Date.parse(iso);
  }

  /** Appwrite customization.options: atributo STRING (ate 65535 bytes UTF-8).
   * Um objeto pode vir de rotas legadas; serializamos sem descartar campos.
   * Valores maiores precisam passar por stageCustomizationOptions antes do banco.
   * Esta barreira impede o envio de tipos invalidos e evita regravacoes destrutivas.
   */
  function validateCustomizationRowData(collectionName, data) {
    if (collectionName !== 'customization' || !Object.prototype.hasOwnProperty.call(data, 'options')) return data;
    let options = data.options;
    if (options && typeof options === 'object' && !Array.isArray(options)) {
      try { options = JSON.stringify(options); }
      catch { throw statusError(400, 'A personalizacao contem estruturas que nao podem ser serializadas.', {code:'CUSTOMIZATION_OPTIONS_SERIALIZATION'}); }
    }
    if (typeof options !== 'string') {
      throw statusError(400, 'customization.options deve ser uma string JSON valida.', {code:'CUSTOMIZATION_OPTIONS_TYPE'});
    }
    const bytes = Buffer.byteLength(options, 'utf8');
    if (bytes > 65535) {
      throw statusError(413, 'As configuracoes excedem 65535 bytes: grave o conteudo completo no Storage antes de atualizar customization.options.', {code:'CUSTOMIZATION_OPTIONS_TOO_LARGE',bytes});
    }
    try {
      const parsed = JSON.parse(options);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Nao e objeto');
    } catch {
      throw statusError(400, 'customization.options deve conter um objeto JSON valido.', {code:'CUSTOMIZATION_OPTIONS_INVALID_JSON'});
    }
    return {...data, options};
  }

  async function awFetchRowWithDateRetry(path, method, basePayload, data, collectionName = '') {
    const normalizedData = normalizeAppwriteDateFields(validateCustomizationRowData(collectionName, data));
    try {
      return await awFetch(path, { method, body: JSON.stringify({ ...basePayload, data: normalizedData }) });
    } catch (error) {
      const attribute = invalidDateAttributeFromError(error);
      const text = errorText(error);
      const legacyIntegerSchema = attribute && /signed 64-bit integer/i.test(text);
      if (!legacyIntegerSchema || !legacyIntegerDateSchemaEnabled(collectionName) || !Object.prototype.hasOwnProperty.call(normalizedData, attribute)) throw error;
      const legacyData = { ...normalizedData, [attribute]: toEpochMillis(normalizedData[attribute], attribute) };
      return awFetch(path, { method, body: JSON.stringify({ ...basePayload, data: legacyData }) });
    }
  }

  async function listRows(name, queries = []) {
    const id = collectionId(name); const query = qs(queries);
    const legacyPath = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents${query}`;
    try { return normalizeListPayload(await awFetch(legacyPath)).map(rowData); } catch (error) { if (!isPathUnsupported(error)) throw error; }
    const tablePath = `/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows${query}`;
    return normalizeListPayload(await awFetch(tablePath)).map(rowData);
  }

  async function listAllRows(name, baseQueries = [], pageSize = 500) {
    const all = []; let offset = 0; const limit = Math.max(1, Math.min(500, Number(pageSize) || 500));
    while (true) {
      const batch = await listRows(name, [...baseQueries, Query.limit(limit), Query.offset(offset)]);
      all.push(...batch); if (batch.length < limit) break; offset += batch.length;
    }
    return all;
  }

  async function getRowWithMode(name, rowId) {
    const id = collectionId(name);
    const legacyPath = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents/${encodeURIComponent(rowId)}`;
    try { return { row: rowData(await awFetch(legacyPath)), mode: 'documents' }; }
    catch (error) { if (!isPathUnsupported(error)) throw error; }
    const tablePath = `/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows/${encodeURIComponent(rowId)}`;
    return { row: rowData(await awFetch(tablePath)), mode: 'tables' };
  }

  async function getRow(name, rowId, options = {}) {
    const id = collectionId(name);
    const legacyPath = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents/${encodeURIComponent(rowId)}`;
    const tablePath = `/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows/${encodeURIComponent(rowId)}`;
    if (options.mode === 'documents') return rowData(await awFetch(legacyPath));
    if (options.mode === 'tables') return rowData(await awFetch(tablePath));
    try { return rowData(await awFetch(legacyPath)); } catch (error) { if (!isPathUnsupported(error)) throw error; }
    return rowData(await awFetch(tablePath));
  }

  async function createRow(name, data, rowId = appwriteId()) {
    const id = collectionId(name); const legacyPath = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents`;
    let created;
    try { created = rowData(await awFetchRowWithDateRetry(legacyPath, 'POST', { documentId: rowId }, data, name)); } catch (error) { if (!isPathUnsupported(error)) throw error; }
    if (!created) created = rowData(await awFetchRowWithDateRetry(`/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows`, 'POST', { rowId }, data, name));
    if (name === 'layers' || name === 'layer_groups') invalidateLayerCatalogCache();
    return created;
  }

  async function updateRow(name, rowId, data, options = {}) {
    const id = collectionId(name);
    const legacyPath = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents/${encodeURIComponent(rowId)}`;
    const tablePath = `/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows/${encodeURIComponent(rowId)}`;
    if (options.mode === 'documents') return rowData(await awFetchRowWithDateRetry(legacyPath, 'PATCH', {}, data, name));
    if (options.mode === 'tables') return rowData(await awFetchRowWithDateRetry(tablePath, 'PATCH', {}, data, name));
    let updated;
    try { updated = rowData(await awFetchRowWithDateRetry(legacyPath, 'PATCH', {}, data, name)); } catch (error) { if (!isPathUnsupported(error)) throw error; }
    if (!updated) updated = rowData(await awFetchRowWithDateRetry(tablePath, 'PATCH', {}, data, name));
    if (name === 'layers' || name === 'layer_groups') invalidateLayerCatalogCache();
    return updated;
  }

  function nextSystemUpdatedAt(currentValue, now = Date.now()) {
    const current = Date.parse(String(currentValue || ''));
    if (!Number.isFinite(current)) {
      throw statusError(503, 'O Appwrite não retornou a revisão do projeto. Reabra o projeto antes de salvar.', { code: 'PROJECT_REVISION_UNAVAILABLE' });
    }
    const value = new Date(Math.max(Number(now) || Date.now(), current + 1));
    if (!Number.isFinite(value.getTime())) {
      throw statusError(503, 'Não foi possível gerar a próxima revisão do projeto.', { code: 'PROJECT_REVISION_UNAVAILABLE' });
    }
    return value.toISOString();
  }

  function isPatchPresent(row, patch) {
    return Object.entries(patch).every(([key, value]) => JSON.stringify(row?.[key]) === JSON.stringify(value));
  }

  function editConflict() {
    return statusError(409, 'Este projeto foi alterado em outra sessão. Recarregue antes de salvar novamente.', { code: 'EDIT_CONFLICT' });
  }

  async function updateRows(name, queries, data, mode) {
    const id = collectionId(name);
    const legacyPath = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents`;
    const tablePath = `/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows`;
    const path = mode === 'tables' ? tablePath : legacyPath;
    return awFetchRowWithDateRetry(path, 'PATCH', { queries }, data, name);
  }

  async function compareAndSwapRow(name, rowId, observedRow, data, options = {}) {
    const mode = options.mode === 'tables' ? 'tables' : 'documents';
    const expectedSystemRevision = String(observedRow?.$updatedAt || '').trim();
    const nextRevision = nextSystemUpdatedAt(expectedSystemRevision);
    const patch = { ...data, $updatedAt: nextRevision };
    const queries = [
      Query.equal('$id', [String(rowId)]),
      Query.equal('$updatedAt', [expectedSystemRevision])
    ];

    try {
      const result = await updateRows(name, queries, patch, mode);
      const rows = normalizeListPayload(result).map(rowData);
      const total = Number(result?.total);
      if (total === 0) throw editConflict();
      if (rows.length !== 1 || (Number.isFinite(total) && total !== 1)) {
        throw statusError(503, 'O Appwrite não confirmou de forma inequívoca a atualização do projeto.', { code: 'SAVE_COMMIT_STATUS_UNKNOWN', total, returned: rows.length });
      }
      return rows[0];
    } catch (error) {
      if (error?.details?.code === 'EDIT_CONFLICT') throw error;
      const status = Number(error?.appwriteStatus || error?.status || 0);
      if (status === 409) throw editConflict();
      if (status > 0 && status < 500) throw error;

      const latest = await getRow(name, rowId, { mode }).catch(() => null);
      if (String(latest?.$updatedAt || '') === nextRevision && isPatchPresent(latest, patch)) return latest;
      throw statusError(503, 'Não foi possível confirmar o salvamento. Reabra o projeto antes de tentar novamente.', { code: 'SAVE_COMMIT_STATUS_UNKNOWN', cause: String(error?.message || error) });
    }
  }

  async function deleteRow(name, rowId) {
    const id = collectionId(name); const legacyPath = `/databases/${encodeURIComponent(databaseId())}/collections/${encodeURIComponent(id)}/documents/${encodeURIComponent(rowId)}`;
    let deleted = false;
    try { await awFetch(legacyPath, { method: 'DELETE' }); deleted = true; } catch (error) { if (!isPathUnsupported(error)) throw error; }
    if (!deleted) await awFetch(`/tablesdb/${encodeURIComponent(databaseId())}/tables/${encodeURIComponent(id)}/rows/${encodeURIComponent(rowId)}`, { method: 'DELETE' });
    if (name === 'layers' || name === 'layer_groups') invalidateLayerCatalogCache();
  }

  async function createFile(bucket, fileName, content, mimeType = 'application/json', fileId = appwriteId()) {
    const form = new FormData(); form.append('fileId', fileId); form.append('file', new Blob([content ?? ''], { type: mimeType }), fileName || `${fileId}.json`);
    const response = await fetchWithAbortTimeout(`${endpoint()}/storage/buckets/${encodeURIComponent(bucket)}/files`, { method: 'POST', headers: { 'X-Appwrite-Project': projectId(), ...(apiKey() ? { 'X-Appwrite-Key': apiKey() } : {}) }, body: form });
    const payload = await parseAppwriteResponse(response).catch(() => null);
    if (!response.ok) throw statusError(response.status >= 500 ? 502 : response.status, payload?.message || 'Erro ao enviar arquivo para Storage.', payload);
    return payload;
  }

  async function readFileText(bucket, fileId) {
    if (!fileId) return '';
    const response = await fetchWithAbortTimeout(`${endpoint()}/storage/buckets/${encodeURIComponent(bucket)}/files/${encodeURIComponent(fileId)}/download`, { headers: { 'X-Appwrite-Project': projectId(), ...(apiKey() ? { 'X-Appwrite-Key': apiKey() } : {}) } });
    if (!response.ok) return ''; return response.text();
  }

  async function deleteFile(bucket, fileId) {
    if (!bucket || !fileId) return;
    const response = await fetchWithAbortTimeout(`${endpoint()}/storage/buckets/${encodeURIComponent(bucket)}/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { 'X-Appwrite-Project': projectId(), ...(apiKey() ? { 'X-Appwrite-Key': apiKey() } : {}) } });
    if (!response.ok && response.status !== 404) throw statusError(response.status, 'Erro ao excluir arquivo antigo no Storage.');
  }

  async function createAppwriteUser({ email, password, name }) { return awFetch('/users', { method: 'POST', body: JSON.stringify({ userId: appwriteId(), email, password, name }) }); }

  async function awPublicAccountFetch(path, options = {}) {
    const response = await fetchWithAbortTimeout(`${endpoint()}${path}`, { ...options, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Appwrite-Project': projectId(), ...(options.headers || {}) } });
    const payload = await parseAppwriteResponse(response).catch(() => null);
    if (!response.ok) { const message = payload?.message || payload?.error || (typeof payload === 'string' ? payload.slice(0, 300) : '') || `Erro Appwrite HTTP ${response.status}`; const error = statusError(response.status >= 500 ? 502 : response.status, message, payload); error.appwriteStatus = response.status; throw error; }
    return payload;
  }

  async function createEmailSession({ email, password }) { return awPublicAccountFetch('/account/sessions/email', { method: 'POST', body: JSON.stringify({ email, password }) }); }

  async function deletePublicEmailSession(sessionSecret) {
    const secret = String(sessionSecret || '').trim(); if (!secret) return false;
    try {
      const response = await fetchWithAbortTimeout(`${endpoint()}/account/sessions/current`, { method: 'DELETE', headers: { 'X-Appwrite-Project': projectId(), 'X-Appwrite-Session': secret } });
      return response.ok || response.status === 404 || response.status === 401;
    } catch { return false; }
  }

  async function listAppwriteUsersByEmail(email) {
    const normalizedEmail = normalizeEmail(email); const users = []; let searchError = null;
    try { const searchPayload = await awFetch(`/users?search=${encodeURIComponent(normalizedEmail)}&limit=100`); if (Array.isArray(searchPayload?.users)) users.push(...searchPayload.users); } catch (error) { searchError = error; }
    if (!users.length) {
      try { const queryPayload = await awFetch(`/users${qs([Query.equal('email', normalizedEmail), Query.limit(100)])}`); if (Array.isArray(queryPayload?.users)) users.push(...queryPayload.users); }
      catch (queryError) { throw searchError || queryError; }
    }
    return users.filter((user) => normalizeEmail(user?.email) === normalizedEmail);
  }

  async function getAppwriteUserByEmail(email) { const users = await listAppwriteUsersByEmail(email); return users[0] || null; }
  async function getAppwriteUserById(userId) { const id = String(userId || '').trim(); if (!id) return null; return awFetch(`/users/${encodeURIComponent(id)}`).catch(() => null); }

  return Object.freeze({
    endpoint, projectId, databaseId, apiKey, collectionId, bucketId, jsonHeaders,
    parseAppwriteResponse, appwriteTimeoutMs, fetchWithAbortTimeout, awFetch,
    isPathUnsupported, normalizeListPayload, rowData, queryParam, qs, appwriteQuery, Query,
    errorText, invalidDateAttributeFromError, toStrictIsoUtc, normalizeAppwriteDateFields,
    legacyIntegerDateSchemaEnabled, toEpochMillis, awFetchRowWithDateRetry,
    listRows, listAllRows, getRow, getRowWithMode, createRow, updateRow, updateRows, compareAndSwapRow, deleteRow,
    createFile, readFileText, deleteFile, createAppwriteUser, awPublicAccountFetch,
    createEmailSession, deletePublicEmailSession, listAppwriteUsersByEmail,
    getAppwriteUserByEmail, getAppwriteUserById
  });
}
