import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'appwrite.config.json'), 'utf8'));
const expected = new Map([
  ['surveyor-api', { path: 'functions/surveyor-api', version: '2.23.0' }],
  ['surveyor-support', { path: 'functions/surveyor-support', version: '1.1.0' }],
  ['surveyor-save', { path: 'functions/surveyor-save', version: '2.0.0' }]
]);

assert.equal(config.projectId, 'surveyor-georural-pro');
assert.equal(config.endpoint, 'https://nyc.cloud.appwrite.io/v1');
assert.equal(config.functions.length, 3);

for (const fn of config.functions) {
  const rule = expected.get(fn.$id);
  assert.ok(rule, `Function inesperada: ${fn.$id}`);
  assert.equal(fn.path, rule.path);
  assert.equal(fn.entrypoint, 'src/main.js');
  assert.equal(fn.runtime, 'node-22');
  assert.ok(!path.isAbsolute(fn.path));
  const functionRoot = path.join(root, fn.path);
  assert.ok(fs.existsSync(path.join(functionRoot, 'package.json')), `${fn.$id}: package.json ausente`);
  assert.ok(fs.existsSync(path.join(functionRoot, fn.entrypoint)), `${fn.$id}: entrypoint ausente`);
  const pkg = JSON.parse(fs.readFileSync(path.join(functionRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, rule.version);
}

const api = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2';/);
assert.match(api, /service: 'Surveyor API Appwrite Function'/);
const support = fs.readFileSync(path.join(root, 'functions/surveyor-support/src/main.js'), 'utf8');
assert.match(support, /const APP_VERSION = '1\.1\.0';/);
const save = fs.readFileSync(path.join(root, 'functions/surveyor-save/src/main.js'), 'utf8');
assert.match(save, /const APP_VERSION = '2\.0\.0';/);
assert.match(save, /SURVEYOR_SAVE_APPWRITE_API_KEY/);
console.log('OK v21.9.420: Functions organizadas para Git/Appwrite com raízes e entrypoints corretos.');
