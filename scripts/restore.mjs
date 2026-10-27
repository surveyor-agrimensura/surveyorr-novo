import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { backupEncryptionKey, backupKeyId, decryptBackupBuffer } from './backup-crypto.mjs';

const root = path.resolve(process.argv[2] || '');
const apply = process.argv.includes('--apply');
const confirmArg = process.argv.find((arg) => arg.startsWith('--confirm-project='));
const confirmedProject = confirmArg ? confirmArg.slice('--confirm-project='.length) : '';
if (!process.argv[2]) { console.error('Uso: node scripts/restore.mjs <pasta-do-backup> [--apply --confirm-project=ID]'); process.exit(2); }

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const manifestBuffer = await fs.readFile(path.join(root, 'manifest.json'));
const manifest = JSON.parse(manifestBuffer);
if (!['surveyor-logical-backup-v1', 'surveyor-logical-backup-v2'].includes(manifest.format)) throw new Error('Formato de backup desconhecido.');
const checksumLine = String(await fs.readFile(path.join(root, 'MANIFEST.SHA256'), 'utf8')).trim();
const expectedManifestSha = checksumLine.split(/\s+/)[0] || '';
if (!expectedManifestSha || sha256(manifestBuffer) !== expectedManifestSha) throw new Error('Checksum do manifest inválido. Não restaure este backup.');
const encrypted = manifest.format === 'surveyor-logical-backup-v2';
const key = encrypted ? backupEncryptionKey({ required: true }) : null;
if (encrypted && manifest.encryption?.keyId && backupKeyId(key) !== manifest.encryption.keyId) throw new Error('A chave informada não corresponde ao Key ID deste backup.');

async function tableRows(name, entry) {
  const storedName = entry.storedName || `${name}.json`;
  const stored = await fs.readFile(path.join(root, 'tables', storedName));
  if (sha256(stored) !== entry.sha256) throw new Error(`Checksum inválido na tabela ${name}.`);
  const plain = encrypted ? decryptBackupBuffer(stored, key, `table:${name}`) : stored;
  if (entry.plainSha256 && sha256(plain) !== entry.plainSha256) throw new Error(`Checksum descriptografado inválido na tabela ${name}.`);
  return JSON.parse(plain.toString('utf8'));
}

async function bucketFiles(name, entry) {
  const dir = path.join(root, 'storage', name);
  const storedName = entry.metadataStoredName || '_files.json';
  const stored = await fs.readFile(path.join(dir, storedName));
  if (sha256(stored) !== entry.metadataSha256) throw new Error(`Metadata inválida no bucket ${name}.`);
  const plain = encrypted ? decryptBackupBuffer(stored, key, `bucket:${name}:metadata`) : stored;
  if (entry.metadataPlainSha256 && sha256(plain) !== entry.metadataPlainSha256) throw new Error(`Metadata descriptografada inválida no bucket ${name}.`);
  return JSON.parse(plain.toString('utf8'));
}

if (!apply) {
  console.log('DRY-RUN: nenhum dado será alterado.');
  console.log(`Backup ${encrypted ? 'criptografado ' : ''}válido em nível de manifest. Restauraria ${manifest.totals.rows} linhas e ${manifest.totals.files} arquivos.`);
  console.log('Antes do --apply, execute também: npm run backup:verify -- <pasta-do-backup>.');
  console.log('Para aplicar: SURVEYOR_RESTORE_ALLOW_APPLY=true e --apply --confirm-project=<ID do projeto de recuperação>.');
  process.exit(0);
}

const endpoint = String(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1').replace(/\/+$/, '');
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
const apiKey = process.env.SURVEYOR_BACKUP_API_KEY || process.env.APPWRITE_API_KEY || '';
const allowApply = String(process.env.SURVEYOR_RESTORE_ALLOW_APPLY || 'false').toLowerCase() === 'true';
const allowNonEmpty = String(process.env.SURVEYOR_RESTORE_ALLOW_NONEMPTY || 'false').toLowerCase() === 'true';
if (!projectId || !apiKey) { console.error('Defina APPWRITE_PROJECT_ID e SURVEYOR_BACKUP_API_KEY.'); process.exit(2); }
if (!allowApply) { console.error('Aplicação bloqueada. Defina SURVEYOR_RESTORE_ALLOW_APPLY=true apenas durante uma restauração autorizada.'); process.exit(2); }
if (!confirmedProject || confirmedProject !== projectId) { console.error('Confirmação de projeto inválida. Use --confirm-project=<APPWRITE_PROJECT_ID>.'); process.exit(2); }

const headers = { 'X-Appwrite-Project': projectId, 'X-Appwrite-Key': apiKey };
async function request(url, options = {}) {
  const response = await fetch(`${endpoint}${url}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response;
}

if (!allowNonEmpty) {
  const occupied = [];
  for (const [name, entry] of Object.entries(manifest.tables || {})) {
    const params = new URLSearchParams();
    params.append('queries[]', JSON.stringify({ method: 'limit', values: [1] }));
    const payload = await (await request(`/tablesdb/${encodeURIComponent(manifest.databaseId)}/tables/${encodeURIComponent(entry.tableId)}/rows?${params}`)).json();
    if ((payload.rows || payload.documents || []).length) occupied.push(`tabela:${name}`);
  }
  for (const [name, entry] of Object.entries(manifest.buckets || {})) {
    const params = new URLSearchParams();
    params.append('queries[]', JSON.stringify({ method: 'limit', values: [1] }));
    const payload = await (await request(`/storage/buckets/${encodeURIComponent(entry.bucketId)}/files?${params}`)).json();
    if ((payload.files || []).length) occupied.push(`bucket:${name}`);
  }
  if (occupied.length) throw new Error(`Destino não está vazio (${occupied.join(', ')}). Para recuperação excepcional, revise o risco e defina SURVEYOR_RESTORE_ALLOW_NONEMPTY=true explicitamente.`);
}

const databaseId = manifest.databaseId;
for (const [name, entry] of Object.entries(manifest.tables || {})) {
  const rows = await tableRows(name, entry);
  console.log(`Restaurando tabela ${name}: ${rows.length} linhas...`);
  for (const row of rows) {
    const rowId = row.$id || row.id;
    if (!rowId) continue;
    const data = { ...row };
    for (const keyName of Object.keys(data)) if (keyName.startsWith('$')) delete data[keyName];
    const response = await fetch(`${endpoint}/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(entry.tableId)}/rows`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ rowId, data, permissions: row.$permissions || [] })
    });
    if (!response.ok && response.status !== 409) throw new Error(`Tabela ${name}/${rowId}: ${response.status} ${await response.text()}`);
  }
}
for (const [name, entry] of Object.entries(manifest.buckets || {})) {
  const dir = path.join(root, 'storage', name);
  const files = await bucketFiles(name, entry);
  console.log(`Restaurando bucket ${name}: ${files.length} arquivos...`);
  for (const file of files) {
    const stored = await fs.readFile(path.join(dir, file.storedName));
    if (sha256(stored) !== file.sha256) throw new Error(`Checksum inválido: ${name}/${file.id}.`);
    const bytes = encrypted ? decryptBackupBuffer(stored, key, `bucket:${name}:file:${file.id}`) : stored;
    if (file.plainSha256 && sha256(bytes) !== file.plainSha256) throw new Error(`Checksum descriptografado inválido: ${name}/${file.id}.`);
    const form = new FormData();
    form.append('fileId', file.id);
    form.append('file', new Blob([bytes], { type: file.mimeType || 'application/octet-stream' }), file.name || file.id);
    if (Array.isArray(file.permissions)) file.permissions.forEach((permission) => form.append('permissions[]', permission));
    const response = await fetch(`${endpoint}/storage/buckets/${encodeURIComponent(entry.bucketId)}/files`, { method: 'POST', headers, body: form });
    if (!response.ok && response.status !== 409) throw new Error(`Bucket ${name}/${file.id}: ${response.status} ${await response.text()}`);
  }
}
console.log('Restauração lógica concluída. Execute testes de integridade e aplicação antes de promover este ambiente.');
