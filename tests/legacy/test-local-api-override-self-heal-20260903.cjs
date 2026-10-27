const fs = require('fs');
const assert = require('assert');
const src = fs.readFileSync('assets/js/core/api.js', 'utf8');
assert.match(src, /persist\s*=\s*true/, 'helper precisa suportar override transitório');
assert.match(src, /storageKey:\s*'SURVEYOR_DEV_API_URL'[\s\S]*?persist:\s*false/, 'API principal em localhost não deve persistir override');
assert.match(src, /localStorage\.removeItem\('SURVEYOR_DEV_API_URL'\)/, 'override antigo da API deve ser limpo');
assert.match(src, /localStorage\.removeItem\('GEORURAL_API_URL_OVERRIDE'\)/, 'override legado da API deve ser limpo');
assert.match(src, /api:\s*'https:\/\/api\.surveyorr\.com\.br'/, 'endpoint oficial deve permanecer como padrão');
console.log('OK: localhost usa API oficial por padrão e não reaproveita override antigo.');
