import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const runtimeBundle = fs.readFileSync('assets/js/core/ui.js', 'utf8');
const cssBundle = fs.readFileSync('assets/css/core/ui.css', 'utf8');
const js = runtimeBundle.split('/* ===== assets/js/core/forms.js ===== */')[1]?.split('/* ===== assets/js/core/commercial.js ===== */')[0] || '';
const css = cssBundle.split('/* ===== assets/css/core/forms.css ===== */')[1]?.split('/* ===== assets/css/core/commercial.css ===== */')[0] || '';

assert.match(js, /servicodados\.ibge\.gov\.br\/api\/v1\/localidades\/municipios/);
assert.match(js, /\['carMunicipality', \{ ufTarget: 'carState' \}\]/);
assert.match(js, /\['lotCity', \{ ufTarget: 'lotUf' \}\]/);
assert.match(js, /\['city', \{ ufTarget: 'uf' \}\]/);
assert.match(js, /\['planDocCity', \{ combined: true \}\]/);
assert.match(js, /\['letterPlace', \{ combined: true \}\]/);
assert.match(js, /\['\.owner-doc', 'cpfcnpj'\]/);
assert.doesNotMatch(js, /fieldDescriptor|inferMask|labelText/);
assert.match(js, /if \(cached\?\.length\) \{[\s\S]*return municipalityList;/);
assert.doesNotMatch(js, /enhance\(document\);\s*loadMunicipalities\(\)/);
assert.match(js, /input\.dataset\.svSelecting/);
assert.match(js, /requestSerial/);
assert.match(js, /if \(input\.value\) input\.value = formatter\(input\.value\)/);
assert.match(css, /--sv-form-shell-max:1080px/);
assert.match(css, /--sv-form-shell-max:1120px/);
assert.match(css, /\.sv-form-panel/);
assert.doesNotMatch(css, /\.panel\{\s*padding:16px/);

const fakeDropdown = {
  className: '',
  style: {},
  dataset: {},
  setAttribute() {},
  append() {},
  appendChild() {},
  addEventListener() {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  replaceChildren() {},
  querySelectorAll() { return []; },
  contains() { return false; }
};
const window = {};
const context = vm.createContext({
  window,
  document: {
    readyState: 'loading',
    createElement() { return { ...fakeDropdown, classList: { ...fakeDropdown.classList } }; },
    addEventListener() {}
  },
  localStorage: { getItem() { return null; }, setItem() {} },
  fetch() { throw new Error('fetch não deve ser executado durante a carga do módulo'); },
  HTMLInputElement: class {},
  HTMLSelectElement: class {},
  Event: class {},
  MouseEvent: class {},
  Node: { ELEMENT_NODE: 1 },
  MutationObserver: class { observe() {} },
  CSS: { escape(value) { return value; } },
  queueMicrotask,
  setTimeout,
  clearTimeout
});
vm.runInContext(js, context);
const api = window.SurveyorSmartForms;
assert.ok(api, 'API pública dos formatadores não foi exposta.');
assert.equal(api.formatCpfCnpj('12345678901'), '123.456.789-01');
assert.equal(api.formatCpfCnpj('12345678000199'), '12.345.678/0001-99');
assert.equal(api.formatPhone('75999998888'), '(75) 99999-8888');
assert.equal(api.formatCep('45300000'), '45300-000');
assert.equal(api.formatRegistration('1º Ofício, Matrícula 123/2026'), '1º OFÍCIO, MATRÍCULA 123/2026');

const pagesWithAssets = [
  'admin/index.html','mapa/index.html','login/index.html','car/index.html',
  'confrontacao/index.html','customizacao/index.html','glebas/index.html',
  'loteamentos-reurb/index.html','mapas/index.html','memorial/index.html',
  'pranchas/index.html','suporte/index.html','acervos/index.html','nuvem/index.html','sobre/index.html'
];
for (const page of pagesWithAssets) {
  const html = fs.readFileSync(page, 'utf8');
  assert.match(html, /surveyor-(?:ui|map|login)-current-v21\.11\.5\.css/, `${page} sem CSS atual consolidado.`);
  assert.match(html, /surveyor-ui-runtime-current-v21\.11\.5\.js/, `${page} sem runtime atual consolidado.`);
}

console.log('OK v21.9.403: máscaras explícitas, municípios lazy/cacheados e formulários compactos sem falsos positivos.');
