import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../assets/js/core/technical-document-editor.js', import.meta.url), 'utf8');
const storage = new Map();
const sandbox = {
  window: {},
  document: { body: { dataset: {} } },
  localStorage: {
    getItem(key){ return storage.has(key) ? storage.get(key) : null; },
    setItem(key,value){ storage.set(key,String(value)); },
    removeItem(key){ storage.delete(key); }
  },
  console,
  Date,
  JSON,
  Object,
  Array,
  Number,
  String,
  Math,
  Set,
  Map,
  Promise,
  setTimeout,
  clearTimeout
};
vm.createContext(sandbox);
assert.doesNotThrow(() => vm.runInContext(source, sandbox, { filename: 'technical-document-editor.js' }), 'editor técnico deve carregar sem ReferenceError em tempo de bootstrap');
assert.equal(typeof sandbox.window.SurveyorTechnicalDocumentEditor?.create, 'function');
for (const name of ['readOffsets','clearOffsets','readSegments','clearSegments','readProjectLayout','readProjectSegments','readProjectDocumentSettings','readDocumentSettings']) {
  assert.equal(typeof sandbox.window.SurveyorTechnicalDocumentEditor?.[name], 'function', `API ${name} deve existir no bootstrap`);
}
