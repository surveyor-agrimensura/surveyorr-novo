const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const start = app.indexOf('  const SICAR_STATE_CODES = new Set(');
const end = app.indexOf('  function ensureSmartSearchModeBadge() {');
assert.ok(start >= 0 && end > start, 'bloco de formatadores da busca inteligente deve existir');
const block = app.slice(start, end);

const context = {};
vm.createContext(context);
vm.runInContext(`
function utmHemisphereFromBand(letter) {
  const band = String(letter || '').toUpperCase();
  if (band === 'S') return 'S';
  if (band === 'N') return 'N';
  if (!/^[C-HJ-NP-X]$/.test(band)) return '';
  return band < 'N' ? 'S' : 'N';
}
${block}
this.smart = { isCarDraft, normalizeCarDraft, isCompleteCarDraft, looksLikeCoordinateDraft, formatCoordinateDraft, formatCoordinateDraftProgressive };
`, context);

const s = context.smart;
assert.equal(s.isCarDraft('BA'), true, 'BA sozinho ativa modo CAR');
assert.equal(s.isCarDraft('BA-'), true, 'BA- mantém modo CAR');
assert.equal(s.isCarDraft('BA-2901007-ABC'), true, 'CAR parcial BA mantém roteamento');
assert.equal(s.isCarDraft('PI-2200400-ABC'), true, 'CAR parcial PI mantém roteamento');
assert.equal(s.isCarDraft('Barreiras'), false, 'cidade começando por Ba não deve ser confundida com CAR');
assert.equal(s.normalizeCarDraft('ba 2901007 abcd'), 'BA-2901007-ABCD');
assert.equal(s.normalizeCarDraft('pi 2200400 abcd'), 'PI-2200400-ABCD');
assert.equal(s.isCompleteCarDraft(`BA-2901007-${'A'.repeat(32)}`), true);
assert.equal(s.isCompleteCarDraft(`PI-2200400-${'B'.repeat(32)}`), true);

assert.equal(s.looksLikeCoordinateDraft('13'), true, 'número inicial já oferece formatos');
assert.equal(s.looksLikeCoordinateDraft('-13'), true, 'latitude negativa já oferece formatos');
assert.equal(s.looksLikeCoordinateDraft('23S'), true, 'zona UTM já oferece formatos');
assert.equal(s.looksLikeCoordinateDraft('Amargosa'), false, 'cidade textual continua no autocomplete municipal');

assert.equal(s.formatCoordinateDraft('-13.031785 -39.602848', 'dd'), '-13.031785, -39.602848');
assert.equal(s.formatCoordinateDraft('13 01 54.43 39 36 10.25', 'dms'), `13°01'54.43" S, 39°36'10.25" W`);
assert.equal(s.formatCoordinateDraft('13 01.907 39 36.171', 'ddm'), `13°1.907' S, 39°36.171' W`);
assert.equal(s.formatCoordinateDraft('24S 434634 8559272', 'utm'), 'SIRGAS 2000 / UTM 24S · E 434634 · N 8559272');
assert.equal(s.formatCoordinateDraft('EPSG:31984 434634 8559272', 'epsg'), 'EPSG:31984 434634 8559272');
assert.equal(s.formatCoordinateDraft('434634 8559272', 'utm'), '', 'UTM sem zona não pode inventar o fuso');
assert.equal(s.formatCoordinateDraftProgressive('-13.031785 ', 'dd'), '-13.031785, ', 'DD insere separador automaticamente ao terminar a latitude');
assert.equal(s.formatCoordinateDraftProgressive('-13.031785, -39.6', 'dd'), '-13.031785, -39.6', 'DD mantém e normaliza longitude durante a digitação');
assert.equal(s.formatCoordinateDraftProgressive('13 ', 'dms'), '13°', 'DMS aplica grau ao concluir o primeiro componente');

console.log('OK: formatadores reais da busca inteligente preservam CAR e aplicam DD/DMS/DDM/UTM/EPSG corretamente.');
