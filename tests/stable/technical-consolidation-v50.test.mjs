import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('assets/js/core/ui.js','utf8');
const mapApp = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const uiCss = fs.readFileSync('assets/css/core/ui.css','utf8');
const mapCss = fs.readFileSync('assets/css/features/mapa/app.css','utf8');

const occurrences = (text, needle) => text.split(needle).length - 1;
assert.equal(occurrences(ui, 'function modernizeMap()'), 1, 'core/ui.js não pode voltar a duplicar modernizeMap.');
assert.equal(occurrences(ui, 'function modernizeSupport()'), 1, 'core/ui.js não pode voltar a duplicar modernizeSupport.');
assert.ok(ui.split('\n').length < 2100, 'core/ui.js voltou a crescer acima do patamar consolidado.');
assert.ok(mapApp.includes('function ensureCityCache()'), 'busca municipal comprovada deve permanecer autocontida.');
assert.ok(mapApp.includes('let citySuggestItems = [];') && mapApp.includes('let citySuggestIndex = -1;') && mapApp.includes('let citySuggestTimer = null;'), 'estado do autocomplete não pode ser removido durante limpeza.');
assert.ok((uiCss.match(/!important/g)||[]).length < 12, 'ui.css voltou a acumular !important acima do patamar consolidado.');
assert.ok((mapCss.match(/!important/g)||[]).length < 30, 'mapa/app.css voltou a acumular !important acima do patamar consolidado.');
console.log('PASS V50 consolidation: JS duplicado removido, busca municipal preservada e cascata CSS reduzida.');
