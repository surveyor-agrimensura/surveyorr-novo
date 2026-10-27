const endpoint = String(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1').replace(/\/+$/, '');
const projectId = String(process.env.APPWRITE_PROJECT_ID || '');
const databaseId = String(process.env.APPWRITE_DATABASE_ID || 'surveyor_db');
const apiKey = String(process.env.APPWRITE_API_KEY || '');
const collectionId = String(process.env.APPWRITE_COLLECTION_CUSTOMIZATION || 'customization');
const confirm = String(process.env.CONFIRM_REMOVE_COMMERCIAL_DATA || '').toUpperCase() === 'SIM';

if (!projectId || !apiKey) {
  console.error('Configure APPWRITE_PROJECT_ID e APPWRITE_API_KEY antes de executar.');
  process.exit(1);
}

const reservedUserIds = ['__renewal_tokens__', '__generation_credit_tokens__', '__payment_coupons__'];
const headers = {
  'Content-Type': 'application/json',
  'X-Appwrite-Project': projectId,
  'X-Appwrite-Key': apiKey
};
const query = (method, attribute, values) => JSON.stringify({ method, ...(attribute ? { attribute } : {}), values: Array.isArray(values) ? values : [values] });
const qs = (items) => items.map((item) => `queries[]=${encodeURIComponent(item)}`).join('&');

async function request(path, options = {}) {
  const response = await fetch(`${endpoint}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Appwrite respondeu ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function rows(payload) {
  return payload?.documents || payload?.rows || [];
}

async function listByUserId(userId) {
  const suffix = `?${qs([query('equal', 'userId', [userId]), query('limit', '', [100])])}`;
  const legacy = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents${suffix}`;
  try { return rows(await request(legacy)); } catch (error) {
    if (![404, 405].includes(error.status)) throw error;
  }
  const table = `/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(collectionId)}/rows${suffix}`;
  return rows(await request(table));
}

async function deleteRecord(id) {
  const legacy = `/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(id)}`;
  try { await request(legacy, { method: 'DELETE' }); return; } catch (error) {
    if (![404, 405].includes(error.status)) throw error;
  }
  const table = `/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(collectionId)}/rows/${encodeURIComponent(id)}`;
  await request(table, { method: 'DELETE' });
}

let found = 0;
let removed = 0;
for (const userId of reservedUserIds) {
  while (true) {
    const batch = await listByUserId(userId);
    if (!batch.length) break;
    found += batch.length;
    console.log(`${userId}: ${batch.length} registro(s) legado(s) encontrado(s).`);
    if (!confirm) break;
    for (const item of batch) {
      const id = item.$id || item.$sequence || item.id;
      if (!id) continue;
      await deleteRecord(id);
      removed += 1;
    }
    if (batch.length < 100) break;
  }
}

if (!confirm) {
  console.log(`Modo de conferência: ${found} registro(s) encontrado(s). Nada foi excluído.`);
  console.log('Para excluir definitivamente, defina CONFIRM_REMOVE_COMMERCIAL_DATA=SIM e execute novamente.');
} else {
  console.log(`Limpeza concluída: ${removed} registro(s) comerciais antigos removidos da collection ${collectionId}.`);
}
