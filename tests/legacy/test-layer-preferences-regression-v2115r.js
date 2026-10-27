import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiPath = new URL('../functions/surveyor-api/src/main.js', import.meta.url);
const api = fs.readFileSync(apiPath, 'utf8');
const match = api.match(/async function saveLayerPreferencesForUser\([\s\S]*?\n}\n\n/);
assert.ok(match, 'saveLayerPreferencesForUser precisa existir.');
const source = match[0];
assert.doesNotMatch(source, /\bidentity\./, 'Preferências de camadas não podem depender da variável inexistente identity.');
assert.match(source, /phone:\s*current\?\.phone\s*\|\|\s*''/, 'Telefone existente deve ser preservado ao salvar preferências.');
assert.match(source, /email:\s*current\?\.email\s*\|\|\s*''/, 'E-mail existente deve ser preservado ao salvar preferências.');
console.log('OK: v21.11.5r — salvar preferências de camadas não usa identidade inexistente e preserva contato atual.');
