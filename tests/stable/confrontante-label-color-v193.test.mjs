import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const renderer = fs.readFileSync('assets/js/features/mapas/confrontantes.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(editor, /data-segment-field="labelColor"/, 'Editor deve oferecer seletor individual de cor para cada confrontante.');
assert.match(editor, /labelColor:confrontanteLabelColor\(segment\.labelColor\)/, 'Cor escolhida deve ser persistida no layout oficial do projeto.');
assert.match(editor, /applyConfrontanteLabelColor/, 'Mudança de cor deve aparecer imediatamente no editor.');
assert.match(renderer, /labelColor: normalizeLabelColor\(entry\.labelColor\)/, 'Renderer deve hidratar a cor persistida do confrontante.');
assert.match(renderer, /data-label-color="\$\{escape\(labelColor\)\}"/, 'SVG deve transportar a cor individual do confrontante.');
assert.match(renderer, /fill="\$\{labelColor\}" paint-order="stroke fill" stroke="\$\{labelHalo\}"/, 'Nome deve ser renderizado na cor escolhida com halo de contraste.');
assert.match(css, /\.sv-confrontante-label-color input\[type="color"\]/, 'Controle de cor deve possuir acabamento próprio no editor.');

console.log('PASS confrontante: nome e cor individuais persistem e renderizam no croqui/prancha/memorial.');
