import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encryptBackupBuffer, decryptBackupBuffer, backupKeyId } from '../scripts/backup-crypto.mjs';

const key = crypto.randomBytes(32);
const wrongKey = crypto.randomBytes(32);
const plain = Buffer.from(JSON.stringify({ project:'Surveyor', value:42, text:'área técnica' }), 'utf8');
const aad = 'tables/projects.json';
const encrypted = encryptBackupBuffer(plain, key, aad);
assert.equal(encrypted.subarray(0,5).toString('ascii'), 'SVBK2');
assert.notDeepEqual(encrypted, plain);
assert.deepEqual(decryptBackupBuffer(encrypted, key, aad), plain);
assert.throws(() => decryptBackupBuffer(encrypted, wrongKey, aad), /chave incorreta|adulterado/i);
const tampered = Buffer.from(encrypted); tampered[tampered.length - 1] ^= 0xff;
assert.throws(() => decryptBackupBuffer(tampered, key, aad), /chave incorreta|adulterado/i);
assert.match(backupKeyId(key), /^[0-9a-f]{16}$/);
console.log('OK R15: backup AES-256-GCM autenticado, AAD e detecção de adulteração validados.');
