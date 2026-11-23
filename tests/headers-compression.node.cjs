const assert = require('node:assert/strict');
const fs = require('node:fs');

const headers = fs.readFileSync('public/_headers', 'utf8');

assert.doesNotMatch(
  headers,
  /^\s*Content-Encoding\s*:/im,
  'Do not declare Content-Encoding unless matching precompressed assets are generated and deployed.'
);

console.log('Headers: nenhuma codificação de conteúdo não comprovada é declarada.');
