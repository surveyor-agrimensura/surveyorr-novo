import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const bridgeSource = read('assets/js/core/technical-map-bridge.js');
const confrontantesSource = read('assets/js/features/mapas/confrontantes.js');
const editorSource = read('assets/js/core/technical-document-editor.js');
const mapasSource = read('assets/js/features/mapas/app.js');

const context = { window:{}, globalThis:{}, console };
context.globalThis = context.window;
vm.createContext(context);
vm.runInContext(bridgeSource, context);
vm.runInContext(confrontantesSource, context);
const bridge = context.window.SurveyorTechnicalMapBridge;
const confrontantes = context.window.SurveyorDocumentConfrontantes.create({ escape:(value)=>String(value ?? '') });

const legacySegments = [{
  id:'__linhas-gerais__', nome:'Linhas gerais', startVertex:1, endVertex:2,
  extraLines:[{ id:'l1', x1G:.10, y1G:.20, x2G:.80, y2G:.70 }], manualLinesOnly:true
}];
const migrated = bridge.technicalLinesFromLegacySegments(legacySegments);
assert.equal(migrated.length, 1, 'Layout legado Linhas gerais deve ser migrado para linha técnica real.');
assert.equal(migrated[0].coordinateSpace, 'geometry-v1', 'Linha migrada deve preservar o referencial geométrico compartilhado.');

const feature = { geometry:{ type:'Polygon', coordinates:[[[0,0],[4,0],[4,2],[0,2],[0,0]]] }, properties:{} };
const projector = ([x,y]) => [100 + x * 50, 200 + y * 50];
const mapBox = { x:80, y:160, w:400, h:260 };
const overlay = bridge.visualOverlayMarkup(feature, projector, mapBox, bridge.normalizeSettings({ technicalLines:migrated }));
assert.match(overlay, /class="sv-document-technical-line"/, 'Linha técnica deve sair no SVG final, não só no editor.');
assert.match(overlay, /x1="120\.00"[\s\S]*y1="220\.00"[\s\S]*x2="260\.00"[\s\S]*y2="270\.00"/, 'Linha deve ser reconstruída por geometry-v1 no quadro atual.');
assert.doesNotMatch(overlay, /Linhas gerais/, 'Linha técnica final não deve gerar rótulo fictício.');

const confrontanteSvg = confrontantes.smartConfrontanteLabels(feature, feature.geometry.coordinates[0], projector, mapBox, {
  placement:'boundary', segmentOverrides:legacySegments
});
assert.doesNotMatch(confrontanteSvg, /Linhas gerais/, 'Renderer de confrontantes deve ignorar o segmento legado artificial.');

assert.doesNotMatch(editorSource, /function makeGeneralLineSegment/, 'Editor não deve recriar o confrontante fictício Linhas gerais.');
assert.doesNotMatch(editorSource, /Linhas gerais/, 'Interface ativa não deve exibir Linhas gerais.');
assert.match(editorSource, /promoteTechnicalLinesToGeometrySpace\(\)/, 'Salvamento deve promover linhas técnicas ao referencial geometry-v1.');
assert.match(editorSource, /technicalLines:[^\n]*|technicalLines/, 'Estado oficial do documento deve transportar linhas técnicas.');
assert.match(mapasSource, /legacyTechnicalLines[\s\S]*technicalLinesFromLegacySegments/, 'Geração deve recuperar projetos legados antes de o usuário reabrir o editor.');
assert.match(mapasSource, /visualOverlayMarkup/, 'Pranchas e croquis devem renderizar as linhas pelo overlay visual compartilhado.');

console.log('PASS technical-lines-project-persistence: linhas técnicas persistem, legado migra e rótulo fictício não reaparece.');
