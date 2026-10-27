import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { backupEncryptionKey, backupKeyId, encryptBackupBuffer } from './backup-crypto.mjs';

const endpoint = String(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1').replace(/\/+$/, '');
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
const apiKey = process.env.SURVEYOR_BACKUP_API_KEY || process.env.APPWRITE_API_KEY || '';
const databaseId = process.env.APPWRITE_DATABASE_ID || 'surveyor_db';
const tables = [
  ['projects', process.env.APPWRITE_COLLECTION_PROJECTS || 'projects'],
  ['folders', process.env.APPWRITE_COLLECTION_FOLDERS || 'folders'],
  ['documents', process.env.APPWRITE_COLLECTION_DOCUMENTS || 'documents'],
  ['customization', process.env.APPWRITE_COLLECTION_CUSTOMIZATION || 'customization'],
  ['users_profile', process.env.APPWRITE_COLLECTION_USERS_PROFILE || 'users_profile'],
  ['layers', process.env.APPWRITE_COLLECTION_LAYERS || 'layers'],
  ['layer_groups', process.env.APPWRITE_COLLECTION_LAYER_GROUPS || 'layer_groups'],
  ['plans', process.env.APPWRITE_COLLECTION_PLANS || 'plans'],
  ['workspace_members', process.env.APPWRITE_COLLECTION_WORKSPACE_MEMBERS || 'workspace_members'],
  ['commerce_orders', process.env.APPWRITE_COLLECTION_COMMERCE_ORDERS || 'commerce_orders'],
  ['payment_events', process.env.APPWRITE_COLLECTION_PAYMENT_EVENTS || 'payment_events'],
  ['security_events', process.env.APPWRITE_COLLECTION_SECURITY_EVENTS || 'security_events']
];
const buckets = [
  ['project_files', process.env.APPWRITE_BUCKET_PROJECT_FILES || 'project_files'],
  ['generated_documents', process.env.APPWRITE_BUCKET_GENERATED_DOCUMENTS || 'generated_documents'],
  ['user_assets', process.env.APPWRITE_BUCKET_USER_ASSETS || 'user_assets']
];

if (!projectId || !apiKey) {
  console.error('Defina APPWRITE_PROJECT_ID e SURVEYOR_BACKUP_API_KEY (ou APPWRITE_API_KEY).');
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputRoot = path.resolve(process.argv[2] || path.join('backups', `surveyor-${stamp}`));
const headers = { 'X-Appwrite-Project': projectId, 'X-Appwrite-Key': apiKey };
const query = (method, values = []) => JSON.stringify({ method, values });
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const requireEncryption = String(process.env.SURVEYOR_BACKUP_REQUIRE_ENCRYPTION || 'true').toLowerCase() !== 'false';
const encryptionKey = backupEncryptionKey({ required: requireEncryption });
if (!encryptionKey) throw new Error('Backup sem criptografia foi bloqueado. Defina SURVEYOR_BACKUP_ENCRYPTION_KEY ou, apenas em laboratório, SURVEYOR_BACKUP_REQUIRE_ENCRYPTION=false.');

async function request(url, options = {}) {
  const response = await fetch(`${endpoint}${url}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  return response;
}

async function listAllRows(tableId) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const params = new URLSearchParams();
    params.append('queries[]', query('limit', [500]));
    params.append('queries[]', query('offset', [offset]));
    const payload = await (await request(`/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(tableId)}/rows?${params}`)).json();
    const batch = payload.rows || payload.documents || [];
    rows.push(...batch);
    if (batch.length < 500) break;
  }
  return rows;
}

async function listAllFiles(bucketId) {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const params = new URLSearchParams();
    params.append('queries[]', query('limit', [100]));
    params.append('queries[]', query('offset', [offset]));
    const payload = await (await request(`/storage/buckets/${encodeURIComponent(bucketId)}/files?${params}`)).json();
    const batch = payload.files || [];
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

await fs.mkdir(outputRoot, { recursive: true });
await fs.mkdir(path.join(outputRoot, 'tables'), { recursive: true });
await fs.mkdir(path.join(outputRoot, 'storage'), { recursive: true });

const manifest = {
  format: 'surveyor-logical-backup-v2',
  encryption: { algorithm: 'AES-256-GCM', keyId: backupKeyId(encryptionKey), dataEncrypted: true },
  createdAt: new Date().toISOString(),
  appwriteEndpoint: endpoint,
  projectId,
  databaseId,
  tables: {},
  buckets: {},
  totals: { rows: 0, files: 0, bytes: 0 }
};

for (const [name, tableId] of tables) {
  process.stdout.write(`Tabela ${name}... `);
  const rows = await listAllRows(tableId);
  const content = Buffer.from(JSON.stringify(rows, null, 2));
  const storedName = `${name}.json.enc`;
  const encrypted = encryptBackupBuffer(content, encryptionKey, `table:${name}`);
  await fs.writeFile(path.join(outputRoot, 'tables', storedName), encrypted);
  manifest.tables[name] = { tableId, rows: rows.length, storedName, sha256: sha256(encrypted), plainSha256: sha256(content), bytes: encrypted.length };
  manifest.totals.rows += rows.length;
  console.log(`${rows.length} linhas`);
}

for (const [name, bucketId] of buckets) {
  process.stdout.write(`Bucket ${name}... `);
  const files = await listAllFiles(bucketId);
  const dir = path.join(outputRoot, 'storage', name);
  await fs.mkdir(dir, { recursive: true });
  const metadata = [];
  let bytes = 0;
  for (const file of files) {
    const fileId = file.$id || file.id;
    if (!fileId) continue;
    const response = await request(`/storage/buckets/${encodeURIComponent(bucketId)}/files/${encodeURIComponent(fileId)}/download`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const storedName = `${fileId}.bin.enc`;
    const encrypted = encryptBackupBuffer(buffer, encryptionKey, `bucket:${name}:file:${fileId}`);
    await fs.writeFile(path.join(dir, storedName), encrypted);
    metadata.push({
      id: fileId,
      name: file.name || fileId,
      mimeType: file.mimeType || 'application/octet-stream',
      sizeOriginal: Number(file.sizeOriginal || buffer.length),
      permissions: file.$permissions || file.permissions || [],
      storedName,
      bytes: encrypted.length,
      plainBytes: buffer.length,
      sha256: sha256(encrypted),
      plainSha256: sha256(buffer)
    });
    bytes += buffer.length;
  }
  const metaBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
  const metaStoredName = '_files.json.enc';
  const encryptedMeta = encryptBackupBuffer(metaBuffer, encryptionKey, `bucket:${name}:metadata`);
  await fs.writeFile(path.join(dir, metaStoredName), encryptedMeta);
  manifest.buckets[name] = { bucketId, files: metadata.length, bytes, metadataStoredName: metaStoredName, metadataSha256: sha256(encryptedMeta), metadataPlainSha256: sha256(metaBuffer) };
  manifest.totals.files += metadata.length;
  manifest.totals.bytes += bytes;
  console.log(`${metadata.length} arquivos / ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
await fs.writeFile(path.join(outputRoot, 'manifest.json'), manifestBuffer);
await fs.writeFile(path.join(outputRoot, 'MANIFEST.SHA256'), `${sha256(manifestBuffer)}  manifest.json\n`);
console.log(`\nBackup lógico criptografado concluído: ${outputRoot}`);
console.log(`Criptografia: AES-256-GCM | Key ID: ${manifest.encryption.keyId}`);
console.log(`Linhas: ${manifest.totals.rows} | Arquivos: ${manifest.totals.files} | Bytes: ${manifest.totals.bytes}`);
