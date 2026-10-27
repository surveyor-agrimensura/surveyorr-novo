import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.match(bridge, /function normalizeHexColor\(value, fallback/);
assert.doesNotMatch(bridge, /\bnormalizeHex\(/, 'A bridge não pode chamar helper inexistente normalizeHex().');
assert.match(bridge, /Object\.freeze\(\{[\s\S]*?normalizeHexColor,/);
assert.match(editor, /SurveyorTechnicalMapBridge\?\.normalizeHexColor/);
assert.match(mapas, /SurveyorTechnicalMapBridge\?\.normalizeHexColor/);

console.log('PASS technical-color-normalizer: normalização de cores centralizada e sem referência indefinida.');
