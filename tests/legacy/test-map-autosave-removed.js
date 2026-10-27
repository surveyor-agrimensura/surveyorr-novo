import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('mapa/index.html', 'utf8');
const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');

assert(!html.includes('id="autosaveStatus"'), 'O indicador Autosave ainda existe no HTML.');
assert(!html.includes('Autosave:'), 'Texto Autosave ainda existe no mapa.');
assert(!app.includes('runAutosave'), 'A rotina runAutosave ainda existe.');
assert(!app.includes('markProjectDirty'), 'O gatilho de autosave ainda existe.');
assert(!app.includes('autosaveTimer'), 'Timer de autosave ainda existe.');
assert(!app.includes('autosaveStatus'), 'Referência DOM do autosave ainda existe.');
assert(!css.includes('.autosave-status'), 'CSS do autosave ainda existe.');
assert(html.includes('id="saveBtn"'), 'O botão Salvar foi removido indevidamente.');
assert(app.includes('els.saveBtn.onclick'), 'O salvamento manual deixou de funcionar.');
assert(app.includes('returnToCarBtn.addEventListener'), 'O salvamento ao voltar ao CAR foi removido indevidamente.');

console.log('Mapa sem Autosave: indicador e rotina automática removidos; salvamento manual preservado.');
