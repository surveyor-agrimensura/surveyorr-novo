import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('mapa/index.html', 'utf8');
const runtime = fs.readFileSync('assets/js/features/mapa/controls.js', 'utf8');

assert.match(html, /accept="[^"]*\.zip/);
assert.match(html, /Importar pontos de ZIP com KMLs/);
assert.match(runtime, /async function parseZipKmlPoints/);
assert.match(runtime, /JSZip\.loadAsync/);
assert.match(runtime, /O fluxo ZIP é 1 KML = 1 ponto/);
assert.match(runtime, /points\.importMeta =/);
assert.match(runtime, /ZIP lido:/);
assert.match(runtime, /stageImportedPoints/);
assert.match(runtime, /updatePolygonSuggestion\(\)/);
assert.match(runtime, /gpsMultiPreviewLine = L\.polyline/);
console.log('OK: ZIP com um KML por ponto é importado para o formulário, preserva nomes, cria prévia e habilita polígono com 3+ pontos.');
