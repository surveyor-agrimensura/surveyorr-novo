import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const ai = read('assets/js/admin/ai.js');
const css = read('assets/css/admin/ai.css');
const html = read('admin/index.html');
const api = read('functions/surveyor-api/src/main.js');

assert.match(ai, /function parseMarkdownTableCells/);
assert.match(ai, /function isMarkdownTableSeparator/);
assert.match(ai, /function createMarkdownTable/);
assert.match(ai, /admin-ai-table-wrap/);
assert.match(ai, /admin-ai-section/);
assert.match(ai, /Não informado/);
assert.match(css, /REV16 — respostas estruturadas/);
assert.match(css, /admin-ai-table-badge/);
assert.match(css, /admin-ai-section\.summary/);
assert.match(html, /data-ai-revision="rev16"/);
assert.match(html, /admin-ai-v21\.10\.0\.js\?v=21\.10\.0-rev16/);
assert.match(api, /const APP_VERSION = '2\.23\.1-map-ux-21\.11\.2'/);
assert.match(api, /phoneMissing: !contactPhone/);
assert.match(api, /missingFields/);
assert.match(api, /Toda tabela deve estar em Markdown GFM válido/);
assert.match(api, /Nunca coloque uma tabela inteira em uma única linha/);

console.log('OK v21.10.0 REV16: respostas da IA organizadas em seções, tabelas reais e contexto de telefone/campos pendentes.');
