import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'surveyor-backup-test-'));
fs.mkdirSync(path.join(root, 'tables'), { recursive: true });
fs.mkdirSync(path.join(root, 'storage', 'project_files'), { recursive: true });
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const rows = Buffer.from(JSON.stringify([{ $id: 'p1', name: 'Projeto teste' }], null, 2));
fs.writeFileSync(path.join(root, 'tables', 'projects.json'), rows);
const payload = Buffer.from('surveyor-backup-fixture');
fs.writeFileSync(path.join(root, 'storage', 'project_files', 'f1.bin'), payload);
const files = Buffer.from(JSON.stringify([{ id: 'f1', storedName: 'f1.bin', bytes: payload.length, sha256: sha(payload) }], null, 2));
fs.writeFileSync(path.join(root, 'storage', 'project_files', '_files.json'), files);
const manifest = {
  format: 'surveyor-logical-backup-v1', databaseId: 'surveyor_db',
  tables: { projects: { tableId: 'projects', rows: 1, sha256: sha(rows) } },
  buckets: { project_files: { bucketId: 'project_files', files: 1, bytes: payload.length, metadataSha256: sha(files) } },
  totals: { rows: 1, files: 1, bytes: payload.length }
};
const mb = Buffer.from(JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(root, 'manifest.json'), mb);
fs.writeFileSync(path.join(root, 'MANIFEST.SHA256'), `${sha(mb)}  manifest.json\n`);

const run = (script) => spawnSync(process.execPath, [script, root], { cwd: process.cwd(), encoding: 'utf8' });
const verify = run('scripts/backup-verify.mjs');
assert.equal(verify.status, 0, verify.stderr || verify.stdout);
assert.match(verify.stdout, /backup verificado/i);
const dry = run('scripts/restore.mjs');
assert.equal(dry.status, 0, dry.stderr || dry.stdout);
assert.match(dry.stdout, /DRY-RUN/);
assert.match(dry.stdout, /--confirm-project/);

// Corromper um arquivo deve invalidar o backup.
fs.writeFileSync(path.join(root, 'storage', 'project_files', 'f1.bin'), 'corrompido');
const broken = run('scripts/backup-verify.mjs');
assert.notEqual(broken.status, 0, 'Backup corrompido não pode ser aceito.');

fs.rmSync(root, { recursive: true, force: true });
console.log('OK: backup lógico verifica checksums, dry-run é seguro e corrupção é rejeitada.');
