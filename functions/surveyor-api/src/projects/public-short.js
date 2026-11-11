// Localizadores públicos de projetos. Mantém códigos v3 e HMAC legado.
export function createPublicShortCodes({ crypto, jwtSecret, bucketId, deleteFile, createFile, readFileText, getRow, listAllRows }) {
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

  return { projectShortCode, legacyProjectShortCode, normalizePublicShortCode, displayPublicShortCode, publicShortPath, findProjectRowByShortCode, writePublicShortIndex };
}
