const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const ux = fs.readFileSync(path.join(root, 'assets/js/features/mapa/ux.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');

assert.match(app, /finishDirectEditForOrientation:[\s\S]*if \(directEditMode\) disableActiveHandler\(\)/,
  'A orientação precisa conseguir finalizar a edição direta antes de girar.');
assert.match(ux, /function finishDirectEditBeforeRotation\(\)[\s\S]*finishDirectEditForOrientation/,
  'O controle de orientação deve fazer handoff limpo do modo Editar.');
assert.match(ux, /if \(next !== 0 && body\.classList\.contains\('surveyor-direct-editing'\)\)[\s\S]*finishDirectEditBeforeRotation\(\)/,
  'Giro não pode coexistir com handles de edição ativos.');
assert.doesNotMatch(ux, /data-action="rotate-left"[\s\S]{0,180}applyBearing\(state\.bearing - 5, \{ force: true \}\)/,
  'Botão de giro não deve furar as proteções com force:true.');
assert.match(html, /map-ux-v21\.11\.5\.js\?v=20260904-rotation-edit-handoff-r1/,
  'HTML deve invalidar cache do módulo de orientação corrigido.');
console.log('PASS: rotação encerra edição com segurança e não entra no ciclo gira-e-reseta.');
