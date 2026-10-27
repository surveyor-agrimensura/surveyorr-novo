const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const start = app.indexOf('  const SICAR_STATE_CODES = new Set(');
const end = app.indexOf('  function ensureSmartSearchModeBadge() {');
assert.ok(start >= 0 && end > start, 'bloco de formatadores deve existir');
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
this.f = formatCoordinateDraftProgressive;
`, context);
const f = context.f;

assert.equal(f('1', 'dms'), '1', 'primeiro dígito DMS deve permanecer visível');
assert.equal(f('13', 'dms'), '13°', 'graus DMS devem receber símbolo sem espaço');
assert.equal(f('1300', 'dms'), "13°00'", 'minutos DMS devem ser mascarados sem espaço');
assert.equal(f('130042', 'dms'), "13°00'42.", 'segundos DMS devem abrir casas decimais automaticamente');
assert.equal(f('13004215', 'dms'), `13°00'42.15" S, `, 'latitude DMS completa deve inserir hemisfério e separador');
assert.equal(f('1300421539370435', 'dms'), `13°00'42.15" S, 39°37'04.35" W`, 'DMS contínuo completo deve ser formatado automaticamente');
assert.equal(f('8588888888888', 'dms'), `85°88'88.88" S, 88°88'8`, 'mesmo uma sequência ainda inválida deve receber máscara visual durante a digitação');

assert.equal(f('13', 'dd'), '-13.', 'DD contínuo deve abrir decimal automaticamente');
assert.equal(f('130317850', 'dd'), '-13.0317850, -', 'DD deve formatar latitude sem exigir pontuação manual');
assert.equal(f('130317850396028480', 'dd'), '-13.0317850, -39.6028480', 'DD contínuo completo deve inserir vírgula e sinais do Brasil');

assert.equal(f('1301', 'ddm'), '13°01.', 'DDM contínuo deve abrir minutos decimais');
assert.equal(f('1301907', 'ddm'), `13°01.907' S, `, 'DDM deve fechar latitude automaticamente');
assert.equal(f('13019073936171', 'ddm'), `13°01.907' S, 39°36.171' W`, 'DDM contínuo completo deve ser mascarado');

assert.equal(f('24', 'utm'), 'UTM 24S · E ', 'UTM deve assumir hemisfério sul na máscara brasileira');
assert.equal(f('244346348559272', 'utm'), 'UTM 24S · E 434634 · N 8559272', 'UTM contínuo deve separar zona, E e N');

console.log('OK: máscaras contínuas DD/DMS/DDM/UTM formatam enquanto o usuário digita, sem exigir espaços.');
