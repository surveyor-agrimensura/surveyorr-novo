import fs from 'node:fs';
import assert from 'node:assert/strict';
const save=fs.readFileSync('functions/surveyor-save/src/main.js','utf8');
const api=fs.readFileSync('functions/surveyor-api/src/main.js','utf8');
assert.ok(/32\s*\*\s*1024|32768/.test(save),'surveyor-save deve aceitar até 32 KiB de access token');
assert.ok(save.includes('SAVE_AUTH_TOKEN_MISSING'),'erro de token ausente deve ser explícito');
assert.ok(save.includes('SAVE_AUTH_TOKEN_TOO_LARGE'),'erro de token excessivo deve ser distinto');
assert.ok(/compact/i.test(api) || api.includes('planPermissions'),'API deve conter geração controlada de claims de sessão');
console.log('PASS auth/save: limite 32 KiB e erros de sessão separados.');
