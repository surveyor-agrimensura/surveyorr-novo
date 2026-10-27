import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js', 'utf8');
const maps = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');

assert.match(editor, /max="8"[^>]*data-document-setting="signatureScale"/, 'O slider da assinatura deve permitir ampliação real até 800%.');
assert.match(editor, /signatureScale:Math\.max\(\.55,Math\.min\(8,Number\(value\?\.signatureScale\|\|1\)\|\|1\)\)/, 'O editor não pode recortar a escala salva em 180%.');
assert.match(editor, /documentSettings\.signatureScale=Math\.max\(\.55,Math\.min\(8,Number\(event\.target\.value\)\|\|1\)\)/, 'A alteração ao vivo deve aceitar até 800%.');
assert.match(bridge, /signatureScale: Math\.max\(\.55, Math\.min\(8, Number\(value\?\.signatureScale \|\| 1\) \|\| 1\)\)/, 'A fonte única do layout deve preservar assinatura acima de 180%.');
assert.match(maps, /const signatureScale = Math\.max\(\.55, Math\.min\(8, Number\(visualSettings\.signatureScale \|\| 1\) \|\| 1\)\)/, 'A geração final deve respeitar a nova escala da assinatura.');
assert.match(editor, /coordinateTableScale:Math\.max\(\.7,Math\.min\(1\.8,Number\(value\?\.coordinateTableScale\|\|1\)\|\|1\)\)/, 'A mudança da assinatura não pode alterar o limite da tabela de coordenadas.');

console.log('PASS signature-scale-v195: assinatura amplia em tempo real até 800% sem afetar outros controles.');
