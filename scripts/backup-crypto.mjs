import crypto from 'node:crypto';

const MAGIC = Buffer.from('SVBK2', 'ascii');
const IV_BYTES = 12;
const TAG_BYTES = 16;

function normalizeKeyText(value = '') {
  return String(value || '').trim();
}

export function backupEncryptionKey({ required = true } = {}) {
  const raw = normalizeKeyText(process.env.SURVEYOR_BACKUP_ENCRYPTION_KEY || process.env.SURVEYOR_BACKUP_KEY || '');
  if (!raw) {
    if (required) throw new Error('Defina SURVEYOR_BACKUP_ENCRYPTION_KEY com uma chave de 32 bytes (64 hex ou Base64).');
    return null;
  }
  let key;
  if (/^[0-9a-f]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else {
    const text = raw.startsWith('base64:') ? raw.slice(7) : raw;
    try { key = Buffer.from(text, 'base64'); } catch { key = null; }
  }
  if (!key || key.length !== 32) throw new Error('SURVEYOR_BACKUP_ENCRYPTION_KEY inválida. Use exatamente 32 bytes (64 hex ou Base64).');
  return key;
}

export function backupKeyId(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function encryptBackupBuffer(plainBuffer, key, aad = '') {
  const plain = Buffer.isBuffer(plainBuffer) ? plainBuffer : Buffer.from(plainBuffer);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(Buffer.from(String(aad), 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

export function decryptBackupBuffer(encryptedBuffer, key, aad = '') {
  const input = Buffer.isBuffer(encryptedBuffer) ? encryptedBuffer : Buffer.from(encryptedBuffer);
  if (input.length < MAGIC.length + IV_BYTES + TAG_BYTES || !input.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Arquivo de backup criptografado inválido ou formato desconhecido.');
  }
  const ivStart = MAGIC.length;
  const tagStart = ivStart + IV_BYTES;
  const dataStart = tagStart + TAG_BYTES;
  const iv = input.subarray(ivStart, tagStart);
  const tag = input.subarray(tagStart, dataStart);
  const ciphertext = input.subarray(dataStart);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  if (aad) decipher.setAAD(Buffer.from(String(aad), 'utf8'));
  decipher.setAuthTag(tag);
  try { return Buffer.concat([decipher.update(ciphertext), decipher.final()]); }
  catch { throw new Error('Não foi possível descriptografar o backup. Chave incorreta ou arquivo adulterado.'); }
}
