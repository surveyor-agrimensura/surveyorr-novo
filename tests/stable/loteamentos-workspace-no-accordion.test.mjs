import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('assets/js/core/ui.js','utf8');
const docs = fs.readFileSync('assets/js/core/documents.js','utf8');
const html = fs.readFileSync('loteamentos-reurb/index.html','utf8');

assert.match(ui, /if \(page === 'loteamentos-reurb\.html'\) return;/, 'Loteamentos/REURB must not receive the legacy accordion wrapper');
assert.match(docs, /sv-lote-lots-zone/, 'The lots step must be mounted by the document workspace');
assert.match(docs, /if \(node\.matches\?\.\('h1,h2,h3,h4,h5,h6'\)\) return;/, 'Legacy duplicate headings must be stripped');
console.log('Loteamentos workspace sem acordeão legado: OK');
