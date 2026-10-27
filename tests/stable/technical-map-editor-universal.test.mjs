import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const bridge = read('assets/js/core/technical-map-bridge.js');
const editor = read('assets/js/core/technical-document-editor.js');
const mapas = read('assets/js/features/mapas/app.js');
const perimetros = read('assets/js/features/perimetros/app.js');
const planialt = read('assets/js/features/planialtimetria/app.js');
const memorial = read('assets/js/features/memorial/app.js');
const loteamentos = read('assets/js/features/loteamentos-reurb/app.js');

for (const api of ['readSettings','polygonAttributes','areaNameMarkup','vertexVisual','coordinateTable']) {
  assert.match(bridge, new RegExp(`\\b${api}\\b`), `ponte técnica deve expor ${api}`);
}
assert.match(mapas, /SurveyorTechnicalDocumentEditor/, 'Mapas/Pranchas devem continuar usando o editor técnico oficial');
assert.match(perimetros, /technicalMapBridge\?\.polygonAttributes/);
assert.match(perimetros, /technicalMapBridge\?\.vertexVisual/);
assert.match(perimetros, /technicalMapBridge\?\.coordinateTable/);
assert.match(planialt, /technicalMapBridge\?\.polygonAttributes/);
assert.match(planialt, /technicalMapBridge\?\.areaNameMarkup/);
assert.match(planialt, /getCoordinateRows/);
assert.doesNotMatch(memorial, /SurveyorTechnicalDocumentEditor/, 'Memorial deve limitar o mapa a opções de visualização, sem editor técnico de confrontantes/vértices.');
assert.match(memorial, /SurveyorCroquiRenderer/);
assert.match(memorial, /return renderer\.generate\(p/);
assert.match(memorial, /lastMapSvg=svg/);
assert.match(loteamentos, /editorNoun:'croqui do lote'/);
assert.match(loteamentos, /persistProject:false/);
assert.match(loteamentos, /technicalMapBridge\?\.polygonAttributes/);
assert.match(loteamentos, /documentConfrontantes\?\.smartConfrontanteLabels/);
assert.match(editor, /options\.persistProject !== false/);
assert.match(editor, /options\.onSave/);

for (const page of ['perimetros/index.html','planialtimetria/index.html','loteamentos-reurb/index.html']) {
  const html = read(page);
  const bridgeAt = html.indexOf('/assets/js/core/technical-map-bridge.js');
  const editorAt = html.indexOf('/assets/js/core/technical-document-editor.js');
  assert(bridgeAt >= 0, `${page} deve carregar a ponte técnica`);
  assert(editorAt > bridgeAt, `${page} deve carregar editor após a ponte técnica`);
}


{
  const html = read('memorial/index.html');
  assert.ok(html.includes('/assets/js/core/technical-map-bridge.js'), 'Memorial deve continuar usando a ponte cartográfica compartilhada.');
  assert.equal(html.includes('/assets/js/core/technical-document-editor.js'), false, 'Memorial não deve carregar o editor técnico completo.');
}

for (const page of ['ods/index.html','confrontacao/index.html','ambiental/index.html']) {
  const html = read(page);
  assert.equal(html.includes('/assets/js/core/technical-map-bridge.js'), false, `${page} não deve ganhar editor sem mapa documental`);
}

console.log('PASS technical-map-editor-universal: editor técnico e estado visual compartilhados entre todos os mapas documentais suportados.');
