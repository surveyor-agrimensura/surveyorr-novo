import assert from 'node:assert/strict';
import fs from 'node:fs';

const NEW_API = 'https://api.surveyorr.com.br';
const OLD_API = ['https://6a4515dd00340fa6288d', 'nyc', 'appwrite', 'run'].join('.');
const apiConfig = fs.readFileSync('assets/js/core/api.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('RELEASE_MANIFEST.json', 'utf8'));

assert.match(apiConfig, new RegExp(NEW_API.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  'assets/js/core/api.js não aponta para a domínio oficial permanente da API.');
assert.match(auth, new RegExp(NEW_API.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  'Fallback de assets/js/core/auth.js não aponta para a domínio oficial permanente da API.');
assert.doesNotMatch(apiConfig, new RegExp(OLD_API.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  'assets/js/core/api.js ainda contém a Function antiga.');
assert.doesNotMatch(auth, new RegExp(OLD_API.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  'assets/js/core/auth.js ainda contém a Function antiga.');
assert.equal(manifest.api.publicEndpoint, NEW_API);
assert.equal(manifest.frontend.version, '21.11.5');
assert.match(apiConfig, /21\.11\.5-map-ui/);

console.log('OK v21.10.0: frontend vinculado exclusivamente ao domínio oficial permanente da API.');
