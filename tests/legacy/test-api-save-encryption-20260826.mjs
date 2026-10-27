import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

process.env.SURVEYOR_CRYPTO_ACTIVE_KEY = 'v1';
process.env.SURVEYOR_DATA_KEY_V1 = crypto.randomBytes(32).toString('base64');
process.env.SURVEYOR_BLIND_INDEX_KEY_V1 = crypto.randomBytes(32).toString('base64');
process.env.SURVEYOR_CRYPTO_REQUIRED = 'false';
process.env.SURVEYOR_CRYPTO_ALLOW_LEGACY_READ = 'true';

const apiCrypto = await import(pathToFileURL(path.join(root, 'functions/surveyor-api/src/security/crypto.js')).href);
const saveCrypto = await import(pathToFileURL(path.join(root, 'functions/surveyor-save/src/security/crypto.js')).href);

const sample = {
  project: { name: 'Projeto confidencial', ownerName: 'Cliente Teste' },
  features: [{ id: 'v1', geoJson: { type: 'Point', coordinates: [-39.5, -13.1] } }],
  metadata: { privateNote: 'não pode aparecer no Storage' }
};

for (const [label, mod] of [['api', apiCrypto], ['save', saveCrypto]]) {
  const encrypted = mod.encryptJsonText(sample, { aad: 'project-payload' });
  assert.equal(mod.isEncryptedText(encrypted), true, `${label}: deve reconhecer envelope svenc1`);
  assert.ok(encrypted.includes('svenc1'), `${label}: envelope deve identificar svenc1`);
  assert.equal(encrypted.includes('Projeto confidencial'), false, `${label}: plaintext não pode aparecer no Storage`);
  assert.deepEqual(mod.decryptJsonText(encrypted, { aad: 'project-payload' }), sample, `${label}: roundtrip AES-256-GCM`);

  const envelope = JSON.parse(encrypted);
  const ct = Buffer.from(envelope.ct, 'base64url');
  ct[0] ^= 1;
  envelope.ct = ct.toString('base64url');
  assert.throws(
    () => mod.decryptJsonText(JSON.stringify(envelope), { aad: 'project-payload' }),
    (error) => error?.code === 'CRYPTO_AUTHENTICATION_FAILED',
    `${label}: ciphertext adulterado deve falhar`
  );

  assert.deepEqual(
    mod.decryptJsonText(JSON.stringify(sample), { aad: 'project-payload' }),
    sample,
    `${label}: leitura legada deve funcionar durante transição`
  );
}

const idx1 = apiCrypto.blindIndex(' 123.456.789-00 ', { namespace: 'cpf' });
const idx2 = apiCrypto.blindIndex(' 123.456.789-00 ', { namespace: 'cpf' });
assert.equal(idx1, idx2, 'blind index deve ser determinístico');
assert.ok(idx1.startsWith('svbidx1.v1.'), 'blind index deve ser versionado');
assert.equal(idx1.includes('123.456'), false, 'blind index não pode revelar valor original');


process.env.SURVEYOR_CRYPTO_ACTIVE_KEY = 'v2';
process.env.SURVEYOR_CRYPTO_REQUIRED = 'false';
delete process.env.SURVEYOR_DATA_KEY_V2;
assert.throws(
  () => apiCrypto.encryptJsonText(sample, { aad: 'project-payload' }),
  (error) => error?.code === 'CRYPTO_WRITE_KEY_MISSING',
  'mesmo em transição, nova escrita nunca pode cair para plaintext sem chave'
);

process.env.SURVEYOR_CRYPTO_ACTIVE_KEY = 'v2';
process.env.SURVEYOR_CRYPTO_REQUIRED = 'true';
delete process.env.SURVEYOR_DATA_KEY_V2;
assert.throws(
  () => apiCrypto.assertCryptoReady(),
  (error) => error?.code === 'CRYPTO_REQUIRED_KEY_MISSING',
  'modo obrigatório deve falhar fechado sem a chave ativa'
);
process.env.SURVEYOR_CRYPTO_ACTIVE_KEY = 'v1';
process.env.SURVEYOR_CRYPTO_REQUIRED = 'false';

const apiMain = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
const saveMain = fs.readFileSync(path.join(root, 'functions/surveyor-save/src/main.js'), 'utf8');
for (const [label, source] of [['api', apiMain], ['save', saveMain]]) {
  assert.match(source, /encryptJsonText\([^\n]*project-payload/, `${label}: gravação de projeto deve passar pela criptografia`);
  assert.match(source, /decryptJsonText\([^\n]*project-payload/, `${label}: leitura de projeto deve passar pela descriptografia`);
  assert.match(source, /assertCryptoReady\(\)/, `${label}: Function deve validar configuração criptográfica`);
}

assert.match(apiMain, /legacyGoogleDriveCryptoKey/, 'API deve preservar leitura do token Drive legado durante transição');
assert.match(apiMain, /aad: 'server-secret'/, 'novo segredo do Drive deve usar DATA KEY independente');

console.log('OK 2026-08-26: AES-256-GCM svenc1, compatibilidade plaintext, anti-adulteração, blind index, fail-closed e API/Save integrados.');
