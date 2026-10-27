import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { backupEncryptionKey, backupKeyId, decryptBackupBuffer } from './backup-crypto.mjs';

const root = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('Uso: node scripts/backup-verify.mjs <pasta-do-backup>'); process.exit(2); }
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const manifestBuffer = await fs.readFile(path.join(root, 'manifest.json'));
const manifest = JSON.parse(manifestBuffer);
if (!['surveyor-logical-backup-v1', 'surveyor-logical-backup-v2'].includes(manifest.format)) throw new Error('Formato de backup desconhecido.');
const checksumLine = String(await fs.readFile(path.join(root, 'MANIFEST.SHA256'), 'utf8')).trim();
const expectedManifestSha = checksumLine.split(/\s+/)[0] || '';
if (!expectedManifestSha || sha256(manifestBuffer) !== expectedManifestSha) throw new Error('Checksum inválido do manifest.json.');

const encrypted = manifest.format === 'surveyor-logical-backup-v2';
const key = encrypted ? backupEncryptionKey({ required: true }) : null;
if (encrypted && manifest.encryption?.keyId && backupKeyId(key) !== manifest.encryption.keyId) throw new Error('A chave informada não corresponde ao Key ID deste backup.');

for (const [name, entry] of Object.entries(manifest.tables || {})) {
  const storedName = entry.storedName || `${name}.json`;
  const stored = await fs.readFile(path.join(root, 'tables', storedName));
  if (sha256(stored) !== entry.sha256) throw new Error(`Checksum inválido na tabela ${name}.`);
  const plain = encrypted ? decryptBackupBuffer(stored, key, `table:${name}`) : stored;
  if (entry.plainSha256 && sha256(plain) !== entry.plainSha256) throw new Error(`Checksum do conteúdo descriptografado inválido na tabela ${name}.`);
  const rows = JSON.parse(plain.toString('utf8'));
  if (!Array.isArray(rows) || rows.length !== entry.rows) throw new Error(`Contagem inválida na tabela ${name}.`);
}

for (const [name, entry] of Object.entries(manifest.buckets || {})) {
  const dir = path.join(root, 'storage', name);
  const metadataStoredName = entry.metadataStoredName || '_files.json';
  const metaStored = await fs.readFile(path.join(dir, metadataStoredName));
  if (sha256(metaStored) !== entry.metadataSha256) throw new Error(`Metadata inválida no bucket ${name}.`);
  const metaPlain = encrypted ? decryptBackupBuffer(metaStored, key, `bucket:${name}:metadata`) : metaStored;
  if (entry.metadataPlainSha256 && sha256(metaPlain) !== entry.metadataPlainSha256) throw new Error(`Metadata descriptografada inválida no bucket ${name}.`);
  const files = JSON.parse(metaPlain.toString('utf8'));
  let plainBytes = 0;
  for (const file of files) {
    const stored = await fs.readFile(path.join(dir, file.storedName));
    if (sha256(stored) !== file.sha256) throw new Error(`Checksum inválido: ${name}/${file.id}.`);
    const plain = encrypted ? decryptBackupBuffer(stored, key, `bucket:${name}:file:${file.id}`) : stored;
    if (file.plainSha256 && sha256(plain) !== file.plainSha256) throw new Error(`Checksum descriptografado inválido: ${name}/${file.id}.`);
    plainBytes += plain.length;
  }
  if (files.length !== entry.files || plainBytes !== entry.bytes) throw new Error(`Contagem/tamanho inválido no bucket ${name}.`);
}
console.log(`OK: backup ${encrypted ? 'criptografado ' : ''}verificado — ${manifest.totals.rows} linhas, ${manifest.totals.files} arquivos, ${manifest.totals.bytes} bytes.`);
