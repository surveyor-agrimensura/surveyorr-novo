import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const documents = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const memorial = fs.readFileSync('assets/js/features/memorial/app.js','utf8');

assert.match(app,/const servitudeDerivedGroup = new L\.LayerGroup\(\)\.addTo\(map\)/,'Faixa de servidão deve viver em grupo derivado separado do FeatureGroup persistente.');
assert.match(app,/const servitudeLabelGroup = new L\.LayerGroup\(\)\.addTo\(map\)/,'Identificação da via deve viver em camada visual separada.');
assert.match(app,/map\.createPane\('servitudePane'\)/,'Faixa derivada deve possuir pane própria.');
assert.match(app,/servitudeDedicatedTool: true/,'Linha oficial de servidão deve registrar sua origem na ferramenta dedicada.');
assert.match(app,/servitudeGenerated: true/,'Linha técnica deve registrar que possui servidão derivada.');
assert.match(app,/migrateLegacyServitudePolygons\(\);[\s\S]*renderServitudeDerivedOverlays\(\);[\s\S]*const projectLayers = drawn\.getLayers\(\)/,'Metadados do projeto devem ser calculados somente após remover polígonos legados de servidão.');
assert.match(app,/remoteFeaturePayloads\(\)[\s\S]*migrateLegacyServitudePolygons\(\);[\s\S]*filter\(\(layer\) => !isLegacyGeneratedServitudeLayer\(layer\)\)/,'Salvamento remoto deve excluir qualquer corredor poligonal legado.');
assert.doesNotMatch(app,/generateServitudeBtn/,'Fluxo antigo de converter linha selecionada em servidão não pode permanecer.');
assert.match(documents,/function servitudeDocumentCorridor\(feature\)/,'Documentos técnicos devem reconstruir a faixa de servidão a partir da linha salva.');
assert.match(documents,/globalThis\.turf\.buffer\(feature, width \/ 2, \{ units: 'meters', steps: 16 \}\)/,'A faixa documental deve respeitar metade da largura total em cada lado da linha.');
assert.match(documents,/class="sv-document-servitude-corridor"/,'SVG técnico deve desenhar a faixa de servidão como corredor derivado.');
assert.match(documents,/servitudeLabelMarkup\?\.\(feature, project/,'Prancha/Croqui deve escrever a identificação da via sobre a linha.');
assert.match(bridge,/function servitudeRoadLabel\(feature\)/,'Bridge técnico deve centralizar a identificação documental da via.');
assert.match(bridge,/function servitudeLabelMarkup\(feature, projector, options = \{\}\)/,'Bridge técnico deve centralizar o rótulo alinhado à servidão.');
assert.match(bridge,/class="sv-document-servitude-road-label"/,'Rótulo documental deve possuir marcação própria.');
assert.match(memorial,/SurveyorCroquiRenderer/,'Memorial deve reutilizar o renderer técnico oficial que reconstrói as servidões salvas no mapa.');
assert.match(memorial,/return renderer\.generate\(p/,'Mapa do Memorial deve delegar o desenho da servidão e sua identificação ao mesmo renderer de Mapas\/Croquis.');

console.log('PASS map-servitude-persistence: servidão dedicada permanece linha-fonte única e sua identificação aparece nas gerações técnicas e no Memorial.');
