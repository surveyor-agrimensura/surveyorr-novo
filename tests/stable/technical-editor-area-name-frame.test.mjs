import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');

const def = editor.indexOf('function mapFrameFromOverlay()');
const use = editor.indexOf('function syncAreaNameLabels()');
assert.ok(def >= 0, 'Editor deve definir mapFrameFromOverlay para posicionar nomes no mapa.');
assert.ok(def < use, 'mapFrameFromOverlay deve existir antes do fluxo de sincronização dos nomes.');
assert.match(editor,/sv-document-map-metadata[\s\S]*?dataset\.mapX[\s\S]*?dataset\.mapW/,'Quadro dos nomes deve priorizar os metadados cartográficos do SVG.');
assert.match(editor,/getBBox\?\.\(\)/,'Quadro dos nomes deve ter fallback pela geometria do perímetro.');
assert.match(editor,/svgViewBoxSize\(overlay\)/,'Quadro dos nomes deve ter fallback final pelo viewBox do SVG.');
assert.match(editor,/function addAreaName\([^)]*\)[\s\S]*?syncAreaNameLabels\(\)[\s\S]*?syncAreaControls\(\)/,'Adicionar nome deve atualizar desenho e controles na mesma ação.');
assert.match(editor,/function removeAreaName\(\)[\s\S]*?syncAreaNameLabels\(\); syncAreaControls\(\)/,'Excluir nome deve atualizar desenho e controles na mesma ação.');

console.log('PASS editor: quadro cartográfico dos nomes existe e ações de nome permanecem operacionais.');
