import crypto from 'node:crypto';

const ENVELOPE = 'svenc1';
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function env(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function boolEnv(name, fallback = false) {
  const raw = env(name, fallback ? 'true' : 'false').toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function cryptoError(message, code = 'CRYPTO_CONFIGURATION_INVALID', status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = { code };
  return error;
}

function normalizeKid(value) {
  const kid = String(value || '').trim().toLowerCase();
  if (!/^v[1-9][0-9]{0,3}$/.test(kid)) {
    throw cryptoError('SURVEYOR_CRYPTO_ACTIVE_KEY inválida. Use valores versionados como v1, v2, v3.', 'CRYPTO_ACTIVE_KEY_INVALID');
  }
  return kid;
}

function activeKid() {
  return normalizeKid(env('SURVEYOR_CRYPTO_ACTIVE_KEY', 'v1'));
}

function dataKeyEnvName(kid) {
  return `SURVEYOR_DATA_KEY_${normalizeKid(kid).toUpperCase()}`;
}

function blindKeyEnvName(kid) {
  return `SURVEYOR_BLIND_INDEX_KEY_${normalizeKid(kid).toUpperCase()}`;
}

function decodeKey(raw, name) {
  const value = String(raw || '').trim();
  if (!value) return null;

  let key;
  if (/^[a-f0-9]{64}$/i.test(value)) {
    key = Buffer.from(value, 'hex');
  } else {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized + pad)) {
      throw cryptoError(`${name} não está em Base64/hex válido.`, 'CRYPTO_KEY_ENCODING_INVALID');
    }
    key = Buffer.from(normalized + pad, 'base64');
  }

  if (key.length !== KEY_BYTES) {
    throw cryptoError(`${name} deve representar exatamente 32 bytes (256 bits).`, 'CRYPTO_KEY_LENGTH_INVALID');
  }
  return key;
}

function dataKeyForKid(kid) {
  const name = dataKeyEnvName(kid);
  return decodeKey(env(name), name);
}

function blindKeyForKid(kid) {
  const name = blindKeyEnvName(kid);
  return decodeKey(env(name), name);
}

function required() {
  return boolEnv('SURVEYOR_CRYPTO_REQUIRED', false);
}

function legacyReadAllowed() {
  return boolEnv('SURVEYOR_CRYPTO_ALLOW_LEGACY_READ', true);
}

function b64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function fromB64url(value, label) {
  try {
    const decoded = Buffer.from(String(value || ''), 'base64url');
    if (!decoded.length) throw new Error('empty');
    return decoded;
  } catch {
    throw cryptoError(`Envelope criptográfico inválido (${label}).`, 'CRYPTO_ENVELOPE_INVALID', 409);
  }
}

function aadBytes(aad, kid) {
  return Buffer.from(`surveyor|${ENVELOPE}|${kid}|${String(aad || 'generic')}`, 'utf8');
}

function parseMaybeJson(text) {
  if (typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch { return null; }
}

function isEnvelopeObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.$surveyorEncrypted === ENVELOPE);
}

export function isEncryptedText(text) {
  return isEnvelopeObject(parseMaybeJson(String(text || '')));
}

export function cryptoStatus() {
  const kid = activeKid();
  const key = dataKeyForKid(kid);
  return {
    enabled: Boolean(key),
    required: required(),
    activeKid: kid,
    legacyReadAllowed: legacyReadAllowed()
  };
}

export function assertCryptoReady() {
  const status = cryptoStatus();
  if (status.required && !status.enabled) {
    throw cryptoError(`${dataKeyEnvName(status.activeKid)} não configurada. A Function está em modo fail-closed.`, 'CRYPTO_REQUIRED_KEY_MISSING');
  }
  return status;
}

export function encryptJsonText(value, { aad = 'generic' } = {}) {
  const kid = activeKid();
  const key = dataKeyForKid(kid);

  if (!key) {
    // Escritas sensíveis nunca fazem downgrade silencioso para plaintext.
    // SURVEYOR_CRYPTO_REQUIRED controla o fail-closed de inicialização/leitura estrita,
    // não autoriza novos dados em claro.
    throw cryptoError(`${dataKeyEnvName(kid)} não configurada. Salvamento em plaintext foi bloqueado.`, 'CRYPTO_WRITE_KEY_MISSING');
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aadBytes(aad, kid));
  const plaintext = Buffer.from(JSON.stringify(value ?? null), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    $surveyorEncrypted: ENVELOPE,
    v: 1,
    alg: 'A256GCM',
    kid,
    aad: String(aad || 'generic'),
    iv: b64url(iv),
    tag: b64url(tag),
    ct: b64url(ciphertext)
  });
}

export function decryptJsonText(text, { aad = 'generic' } = {}) {
  const raw = String(text ?? '');
  if (!raw) return null;
  const parsed = parseMaybeJson(raw);

  if (!isEnvelopeObject(parsed)) {
    if (required() && !legacyReadAllowed()) {
      throw cryptoError('Registro legado em plaintext bloqueado pelo modo estrito.', 'CRYPTO_LEGACY_PLAINTEXT_BLOCKED', 409);
    }
    if (parsed === null) {
      throw cryptoError('Payload legado não contém JSON válido.', 'CRYPTO_LEGACY_JSON_INVALID', 409);
    }
    return parsed;
  }

  if (Number(parsed.v) !== 1 || parsed.alg !== 'A256GCM') {
    throw cryptoError('Versão/algoritmo do envelope criptográfico não suportado.', 'CRYPTO_ENVELOPE_VERSION_UNSUPPORTED', 409);
  }

  const kid = normalizeKid(parsed.kid);
  const expectedAad = String(aad || 'generic');
  if (String(parsed.aad || '') !== expectedAad) {
    throw cryptoError('Contexto criptográfico do registro não corresponde ao esperado.', 'CRYPTO_AAD_MISMATCH', 409);
  }

  const key = dataKeyForKid(kid);
  if (!key) {
    throw cryptoError(`${dataKeyEnvName(kid)} necessária para abrir este registro não está configurada.`, 'CRYPTO_DECRYPT_KEY_MISSING');
  }

  const iv = fromB64url(parsed.iv, 'iv');
  const tag = fromB64url(parsed.tag, 'tag');
  const ciphertext = fromB64url(parsed.ct, 'ct');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw cryptoError('IV/tag do envelope criptográfico possui tamanho inválido.', 'CRYPTO_ENVELOPE_INVALID', 409);
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(aadBytes(expectedAad, kid));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const value = JSON.parse(plaintext);
    return value;
  } catch (cause) {
    if (cause?.code === 'CRYPTO_DECRYPT_KEY_MISSING') throw cause;
    throw cryptoError('Falha de autenticidade/integridade ao abrir dado criptografado.', 'CRYPTO_AUTHENTICATION_FAILED', 409);
  }
}

export function blindIndex(value, { namespace = 'default', kid = activeKid() } = {}) {
  const normalizedKid = normalizeKid(kid);
  const key = blindKeyForKid(normalizedKid);
  if (!key) {
    throw cryptoError(`${blindKeyEnvName(normalizedKid)} não configurada.`, 'CRYPTO_BLIND_INDEX_KEY_MISSING');
  }
  const normalized = String(value ?? '').normalize('NFKC').trim().toLowerCase();
  const digest = crypto
    .createHmac('sha256', key)
    .update(`surveyor|svbidx1|${String(namespace || 'default')}|${normalized}`, 'utf8')
    .digest('base64url');
  return `svbidx1.${normalizedKid}.${digest}`;
}
