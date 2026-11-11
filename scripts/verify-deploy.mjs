import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const config = JSON.parse(readFileSync('appwrite.config.json', 'utf8'));
assert.equal(config.projectId, 'surveyor-georural-pro');
assert.equal(config.endpoint, 'https://nyc.cloud.appwrite.io/v1');
const expected = ['surveyor-api', 'surveyor-save', 'surveyor-support'];
for (const id of expected) {
  const entry = config.functions.find(fn => fn.$id === id);
  assert.ok(entry, `Configuração não inclui ${id}`);
  assert.equal(entry.path, `functions/${id}`);
  assert.equal(entry.entrypoint, 'src/main.js');
  assert.ok(existsSync(resolve(entry.path, entry.entrypoint)), `Código-fonte ausente: ${id}`);
  assert.ok(existsSync(resolve(entry.path, 'package.json')), `package.json ausente: ${id}`);
}
assert.ok(existsSync('functions/surveyor-geoservices/src/main.js'), 'Fonte de GeoServices original ausente');
assert.equal(readFileSync('public/CNAME', 'utf8').trim(), 'surveyorr.com.br');
assert.ok(existsSync('.github/workflows/pages.yml'));
console.log('SURVEYOR: rotas Appwrite e arquivos do GitHub Pages conferidos.');
