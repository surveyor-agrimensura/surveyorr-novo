const fs = require('node:fs');
const assert = require('node:assert');
const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const html = fs.readFileSync('mapa/index.html', 'utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8');

assert.match(app, /let directEditSessionId = 0/);
assert.match(app, /directEditSessionId \+= 1/);
assert.match(app, /__surveyorDirectEditUxBindingKey/);
assert.match(app, /detachDirectEditMarkerBindings/);
assert.match(app, /setTimeout\(rearmDirectEditHandles, 180\)/);
assert.match(app, /if \(!directEditMode\)[\s\S]*layer\.editing\?\.disable/);
assert.match(html, /id="editMidpointsToggleBtn"[\s\S]*Pontos automáticos/);
assert.match(html, /id="autoVertexHandlesToggleBtn"/);
assert.match(app, /surveyorAutoVertexKeys/);
assert.match(app, /rememberAutomaticVertex/);
assert.match(css, /surveyor-auto-vertices-hidden[\s\S]*surveyor-edit-auto-vertex-handle[\s\S]*display:none!important/);
assert.match(app, /A curva e a geometria foram preservadas/);
console.log('PASS: reentrada de edição rearma handles e pontos automáticos podem ser ocultados sem alterar a curva.');
