export function createGoogleDriveService(deps = {}) {
  const {
    crypto, env, statusError, jwtSecret, fromBase64url,
    encryptJsonText, decryptJsonText, isEncryptedText,
    listRows, Query, customizationOptions, updateRow, createRow,
    parseAppwriteResponse, resourceOwnerId, safeJson,
    GOOGLE_DRIVE_SYSTEM_USER_ID, GOOGLE_DRIVE_FOLDER_MIME
  } = deps;

  function googleDriveEnabled() {
    return String(env('GOOGLE_DRIVE_ENABLED', 'false')).toLowerCase() === 'true';
  }

  function googleDriveConfig() {
    return {
      enabled: googleDriveEnabled(),
      clientId: env('GOOGLE_DRIVE_CLIENT_ID'),
      clientSecret: env('GOOGLE_DRIVE_CLIENT_SECRET'),
      redirectUri: env('GOOGLE_DRIVE_REDIRECT_URI'),
      rootFolderName: env('GOOGLE_DRIVE_ROOT_FOLDER_NAME', 'Surveyor Storage'),
      scope: env('GOOGLE_DRIVE_SCOPE', 'https://www.googleapis.com/auth/drive.file')
    };
  }

  function assertGoogleDriveConfigured() {
    const cfg = googleDriveConfig();
    if (!cfg.enabled) throw statusError(409, 'Google Drive não está ativado na Function.');
    if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) throw statusError(500, 'Variáveis GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET ou GOOGLE_DRIVE_REDIRECT_URI não configuradas.');
    return cfg;
  }

  // Compatibilidade temporária: tokens antigos do Google Drive foram cifrados com uma chave
  // derivada do JWT_SECRET. Novos tokens usam a DATA KEY independente. Após a migração,
  // o fallback legado pode ser removido sem afetar os registros já regravados.
  function legacyGoogleDriveCryptoKey() {
    return crypto.createHash('sha256').update(jwtSecret()).digest();
  }

  function encryptSecret(value) {
    return encryptJsonText({ value: String(value || '') }, { aad: 'server-secret' });
  }

  function decryptSecret(value) {
    const raw = String(value || '');
    if (!raw) return '';

    if (isEncryptedText(raw)) {
      const decoded = decryptJsonText(raw, { aad: 'server-secret' });
      return String(decoded?.value || '');
    }

    // Legado v1: somente leitura para permitir a transição do refresh token existente.
    const [, ivText, tagText, encryptedText] = raw.split('.');
    if (!raw.startsWith('v1.') || !ivText || !tagText || !encryptedText) return '';
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', legacyGoogleDriveCryptoKey(), fromBase64url(ivText));
      decipher.setAuthTag(fromBase64url(tagText));
      return Buffer.concat([decipher.update(fromBase64url(encryptedText)), decipher.final()]).toString('utf8');
    } catch {
      return '';
    }
  }

  async function findGoogleDriveStore() {
    const rows = await listRows('customization', [Query.equal('userId', GOOGLE_DRIVE_SYSTEM_USER_ID), Query.limit(1)]).catch(() => []);
    return rows[0] || null;
  }

  function googleDriveStoreOptions(row = {}) {
    const options = customizationOptions(row || {});
    const store = options.googleDriveStorage && typeof options.googleDriveStorage === 'object' ? options.googleDriveStorage : options;
    return store && typeof store === 'object' ? store : {};
  }

  async function readGoogleDriveConnection() {
    const row = await findGoogleDriveStore();
    const store = googleDriveStoreOptions(row || {});
    if (!store.refreshTokenEncrypted) return { connected: false, row, store: {} };
    return { connected: true, row, store };
  }

  async function saveGoogleDriveConnection(patch = {}) {
    const now = new Date().toISOString();
    const current = await findGoogleDriveStore().catch(() => null);
    const currentOptions = customizationOptions(current || {});
    const currentStore = googleDriveStoreOptions(current || {});
    const nextStore = { ...currentStore, ...patch, updatedAt: now };
    const data = {
      userId: GOOGLE_DRIVE_SYSTEM_USER_ID,
      companyName: current?.companyName || 'Surveyor Google Drive Storage',
      logoFileId: current?.logoFileId || '',
      address: current?.address || '',
      phone: current?.phone || '',
      email: current?.email || '',
      crea: current?.crea || '',
      site: current?.site || '',
      footerText: current?.footerText || '',
      options: JSON.stringify({ ...currentOptions, googleDriveStorage: nextStore }),
      createdAt: current?.createdAt || now,
      updatedAt: now
    };
    const row = current?.$id ? await updateRow('customization', current.$id, data) : await createRow('customization', data);
    return googleDriveStoreOptions(row);
  }

  async function googleDriveTokenFromCode(code) {
    const cfg = assertGoogleDriveConfigured();
    const form = new URLSearchParams({
      code: String(code || ''),
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code'
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const payload = await parseAppwriteResponse(response).catch(() => null);
    if (!response.ok) throw statusError(502, payload?.error_description || payload?.error || 'Não foi possível conectar o Google Drive.', payload);
    return payload;
  }

  async function googleDriveAccessToken() {
    const cfg = assertGoogleDriveConfigured();
    const connection = await readGoogleDriveConnection();
    if (!connection.connected) throw statusError(409, 'Google Drive ainda não conectado. Conecte pelo painel da Minha Nuvem.');
    const refreshToken = decryptSecret(connection.store.refreshTokenEncrypted);
    if (!refreshToken) throw statusError(409, 'Token do Google Drive inválido. Reconecte a conta.');
    const form = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const payload = await parseAppwriteResponse(response).catch(() => null);
    if (!response.ok) throw statusError(502, payload?.error_description || payload?.error || 'Não foi possível renovar acesso ao Google Drive.', payload);
    return payload.access_token;
  }

  async function googleDriveRequest(path, options = {}) {
    const accessToken = options.accessToken || await googleDriveAccessToken();
    const url = path.startsWith('http') ? path : `https://www.googleapis.com/drive/v3${path}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (options.body != null && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json; charset=utf-8');
    const response = await fetch(url, { ...options, headers });
    const payload = await parseAppwriteResponse(response).catch(() => null);
    if (!response.ok) throw statusError(response.status >= 500 ? 502 : response.status, payload?.error?.message || payload?.error_description || payload?.message || `Erro Google Drive HTTP ${response.status}`, payload);
    return payload;
  }

  function driveQueryEscape(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  async function findDriveFolderByName({ name, parentId, accessToken }) {
    const clauses = [`name='${driveQueryEscape(name)}'`, `mimeType='${GOOGLE_DRIVE_FOLDER_MIME}'`, 'trashed=false'];
    if (parentId) clauses.push(`'${driveQueryEscape(parentId)}' in parents`);
    const q = encodeURIComponent(clauses.join(' and '));
    const payload = await googleDriveRequest(`/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=1`, { method: 'GET', accessToken });
    return Array.isArray(payload.files) ? payload.files[0] || null : null;
  }

  async function ensureDriveFolder({ name, parentId = '', accessToken }) {
    const existing = await findDriveFolderByName({ name, parentId, accessToken }).catch(() => null);
    if (existing?.id) return existing;
    return googleDriveRequest('/files?fields=id,name', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ name, mimeType: GOOGLE_DRIVE_FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) })
    });
  }

  async function ensureGoogleDriveRoot(accessToken) {
    const cfg = assertGoogleDriveConfigured();
    const connection = await readGoogleDriveConnection();
    let rootFolderId = connection.store.rootFolderId || '';
    if (rootFolderId) {
      const current = await googleDriveRequest(`/files/${encodeURIComponent(rootFolderId)}?fields=id,name,trashed`, { method: 'GET', accessToken }).catch(() => null);
      if (current?.id && current.trashed !== true) return current;
    }
    const root = await ensureDriveFolder({ name: cfg.rootFolderName, accessToken });
    rootFolderId = root.id;
    await saveGoogleDriveConnection({ rootFolderId, rootFolderName: cfg.rootFolderName });
    return root;
  }

  function driveSafeName(value, fallback = 'Arquivo') {
    return String(value || fallback).normalize('NFKC').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || fallback;
  }

  async function ensureGoogleDriveUploadFolder({ auth, folderName = '' }) {
    const accessToken = await googleDriveAccessToken();
    const root = await ensureGoogleDriveRoot(accessToken);
    const usersFolder = await ensureDriveFolder({ name: 'users', parentId: root.id, accessToken });
    const userFolder = await ensureDriveFolder({ name: driveSafeName(resourceOwnerId(auth) || auth.email || 'usuario'), parentId: usersFolder.id, accessToken });
    if (!folderName) return { accessToken, folder: userFolder, root };
    const folder = await ensureDriveFolder({ name: driveSafeName(folderName, 'Pasta'), parentId: userFolder.id, accessToken });
    return { accessToken, folder, root };
  }

  async function deleteGoogleDriveFile(fileId) {
    if (!fileId) return;
    await googleDriveRequest(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }).catch((error) => {
      if (![404, 410].includes(Number(error?.status))) throw error;
    });
  }

  async function googleDriveFileForAuth(fileId, auth = {}, { requireSurveyorTag = false } = {}) {
    const id = String(fileId || '').trim();
    if (!id) throw statusError(400, 'ID do arquivo no Google Drive não informado.');
    const file = await googleDriveRequest(`/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,webViewLink,parents,trashed,appProperties`, { method: 'GET' });
    if (!file?.id || file.trashed === true) throw statusError(404, 'Arquivo do Google Drive não encontrado.');
    const expectedOwner = String(resourceOwnerId(auth) || '').trim();
    const taggedOwner = String(file?.appProperties?.surveyorOwnerUserId || '').trim();
    if ((requireSurveyorTag && !taggedOwner) || (taggedOwner && taggedOwner !== expectedOwner)) {
      // Não revela se um fileId de outro workspace existe no Drive compartilhado.
      throw statusError(404, 'Arquivo do Google Drive não encontrado.', { code: 'DRIVE_FILE_OWNER_MISMATCH' });
    }
    return file;
  }

  async function createGoogleDriveResumableSession({ auth, input }) {
    const fileName = driveSafeName(input.fileName || input.name || 'arquivo.bin', 'arquivo.bin');
    const mimeType = String(input.mimeType || 'application/octet-stream').slice(0, 180);
    const sizeBytes = Math.max(0, Number(input.sizeBytes || input.size || 0));
    if (!fileName) throw statusError(400, 'Nome do arquivo obrigatório.');
    if (!sizeBytes) throw statusError(400, 'Tamanho do arquivo obrigatório.');
    const maxBytes = Number(env('GOOGLE_DRIVE_UPLOAD_MAX_BYTES', String(1024 * 1024 * 1024))) || 1024 * 1024 * 1024;
    if (sizeBytes > maxBytes) throw statusError(413, `Arquivo acima do limite configurado (${Math.round(maxBytes / 1024 / 1024)} MB).`);
    const folderName = String(input.folderName || input.folder || input.folderId || '').slice(0, 120);
    const { accessToken, folder } = await ensureGoogleDriveUploadFolder({ auth, folderName });
    const metadata = { name: fileName, mimeType, parents: [folder.id], appProperties: { surveyorOwnerUserId: String(resourceOwnerId(auth) || ''), surveyorCategory: String(input.category || 'outros').slice(0, 60) } };
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,modifiedTime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(sizeBytes)
      },
      body: JSON.stringify(metadata)
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) throw statusError(response.status >= 500 ? 502 : response.status, 'Não foi possível iniciar upload no Google Drive.', text ? safeJson(text, text) : null);
    const uploadUrl = response.headers.get('location');
    if (!uploadUrl) throw statusError(502, 'Google Drive não retornou URL de upload.');
    return { uploadUrl, fileName, mimeType, sizeBytes, folderId: folder.id, folderName };
  }

  return {
    googleDriveEnabled, googleDriveConfig, assertGoogleDriveConfigured, legacyGoogleDriveCryptoKey, encryptSecret, decryptSecret, findGoogleDriveStore, googleDriveStoreOptions, readGoogleDriveConnection, saveGoogleDriveConnection, googleDriveTokenFromCode, googleDriveAccessToken, googleDriveRequest, driveQueryEscape, findDriveFolderByName, ensureDriveFolder, ensureGoogleDriveRoot, driveSafeName, ensureGoogleDriveUploadFolder, deleteGoogleDriveFile, googleDriveFileForAuth, createGoogleDriveResumableSession
  };
}
