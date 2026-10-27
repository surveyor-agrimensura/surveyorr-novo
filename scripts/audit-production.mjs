const endpoint = String(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1').replace(/\/+$/, '');
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
const apiKey = process.env.SURVEYOR_AUDIT_API_KEY || process.env.APPWRITE_API_KEY || '';
const databaseId = process.env.APPWRITE_DATABASE_ID || 'surveyor_db';
const tables = [
  process.env.APPWRITE_COLLECTION_PROJECTS || 'projects',
  process.env.APPWRITE_COLLECTION_DOCUMENTS || 'documents',
  process.env.APPWRITE_COLLECTION_CUSTOMIZATION || 'customization',
  process.env.APPWRITE_COLLECTION_USERS_PROFILE || 'users_profile',
  process.env.APPWRITE_COLLECTION_LAYERS || 'layers',
  process.env.APPWRITE_COLLECTION_LAYER_GROUPS || 'layer_groups',
  process.env.APPWRITE_COLLECTION_PLANS || 'plans',
  process.env.APPWRITE_COLLECTION_WORKSPACE_MEMBERS || 'workspace_members',
  process.env.APPWRITE_COLLECTION_COMMERCE_ORDERS || 'commerce_orders',
  process.env.APPWRITE_COLLECTION_PAYMENT_EVENTS || 'payment_events',
  process.env.APPWRITE_COLLECTION_SECURITY_EVENTS || 'security_events'
];
const buckets = [
  process.env.APPWRITE_BUCKET_PROJECT_FILES || 'project_files',
  process.env.APPWRITE_BUCKET_GENERATED_DOCUMENTS || 'generated_documents',
  process.env.APPWRITE_BUCKET_USER_ASSETS || 'user_assets'
];
if (!projectId || !apiKey) { console.error('Defina APPWRITE_PROJECT_ID e SURVEYOR_AUDIT_API_KEY.'); process.exit(2); }
const headers = { 'X-Appwrite-Project': projectId, 'X-Appwrite-Key': apiKey };
async function get(url) {
  const response = await fetch(`${endpoint}${url}`, { headers });
  if (!response.ok) throw new Error(`${response.status} ${url}: ${await response.text()}`);
  return response.json();
}
function permissionText(value) { return JSON.stringify(value?.$permissions || value?.permissions || []); }

function hasPublicPermission(value) { return /role:any|role:guests|"any"|guests/i.test(permissionText(value)); }
async function sampleRows(tableId, limit = 50) {
  const params = new URLSearchParams();
  params.append('queries[]', JSON.stringify({ method: 'limit', values: [limit] }));
  const payload = await get(`/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(tableId)}/rows?${params}`);
  return payload.rows || payload.documents || [];
}
async function sampleFiles(bucketId, limit = 50) {
  const params = new URLSearchParams();
  params.append('queries[]', JSON.stringify({ method: 'limit', values: [limit] }));
  const payload = await get(`/storage/buckets/${encodeURIComponent(bucketId)}/files?${params}`);
  return payload.files || [];
}

let warnings = 0;
console.log(`Auditando Appwrite ${projectId} em ${endpoint}\n`);
for (const tableId of tables) {
  try {
    const table = await get(`/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(tableId)}`);
    const perms = permissionText(table);
    const rowSecurity = table.rowSecurity === true || table.documentSecurity === true;
    const exposed = /role:any|"any"|guests/i.test(perms);
    const sensitive = /projects|documents|customization|users_profile|workspace_members|commerce_orders|payment_events|security_events/i.test(tableId);
    const issues = [];
    if (sensitive && !rowSecurity) issues.push('rowSecurity desativado');
    if (sensitive && exposed) issues.push('permissão pública na tabela');
    if (sensitive && rowSecurity) {
      const rows = await sampleRows(tableId).catch(() => []);
      const publicRows = rows.filter(hasPublicPermission);
      if (publicRows.length) issues.push(`${publicRows.length} linha(s) pública(s) na amostra`);
    }
    if (issues.length) warnings += issues.length;
    console.log(`${issues.length ? 'ALERTA' : 'OK'} tabela ${tableId}: rowSecurity=${rowSecurity} permissions=${perms}${issues.length ? ` -> ${issues.join(', ')}` : ''}`);
  } catch (error) { warnings += 1; console.log(`ALERTA tabela ${tableId}: ${error.message}`); }
}
for (const bucketId of buckets) {
  try {
    const bucket = await get(`/storage/buckets/${encodeURIComponent(bucketId)}`);
    const perms = permissionText(bucket);
    const fileSecurity = bucket.fileSecurity === true;
    const exposed = /role:any|"any"|guests/i.test(perms);
    const issues = [];
    if (!fileSecurity) issues.push('fileSecurity desativado');
    if (exposed) issues.push('permissão pública no bucket');
    if (fileSecurity) {
      const files = await sampleFiles(bucketId).catch(() => []);
      const publicFiles = files.filter(hasPublicPermission);
      if (publicFiles.length) issues.push(`${publicFiles.length} arquivo(s) público(s) na amostra`);
    }
    if (issues.length) warnings += issues.length;
    console.log(`${issues.length ? 'ALERTA' : 'OK'} bucket ${bucketId}: fileSecurity=${fileSecurity} permissions=${perms}${issues.length ? ` -> ${issues.join(', ')}` : ''}`);
  } catch (error) { warnings += 1; console.log(`ALERTA bucket ${bucketId}: ${error.message}`); }
}
console.log(`\nResultado: ${warnings ? `${warnings} alerta(s) — NÃO liberar comercialmente sem revisão.` : 'sem alertas básicos de exposição.'}`);
process.exit(warnings ? 1 : 0);
