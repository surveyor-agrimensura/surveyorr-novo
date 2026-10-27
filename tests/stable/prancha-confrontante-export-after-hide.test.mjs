import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const downloads = fs.readFileSync('assets/js/core/downloads.js','utf8');

// Salvar apenas uma alteração visual não pode zerar confrontantes cadastrados.
const begin = editor.indexOf('  function syncSegmentConfrontantes(feature, segments = []) {');
const end = editor.indexOf('  async function saveProjectVisualLayout(',begin);
assert.ok(begin !== -1 && end > begin,'Rotina original de sincronização deve ser identificada');
const calls = [];
const sandbox = {
  perimeterVertexCount: () => 3,
  layoutItemSegmentIndexes: (_segment) => [0],
  safeText: value => String(value || ''),
  String, Array, Number, Object,
};
vm.runInNewContext(editor.slice(begin,end)+'\nthis.sync=syncSegmentConfrontantes;',sandbox);
const feature = {properties:{confrontantes:[
  {segmentIndex:0,nome:'Vizinho Norte'},
  {segmentIndex:1,nome:'Vizinho Sul'},
  {segmentIndex:2,nome:'Estrada Municipal'}
]}};
const original = JSON.stringify(feature.properties.confrontantes);
sandbox.sync(feature, []);
assert.equal(JSON.stringify(feature.properties.confrontantes),original,'Ocultar cotas não deve remover os três confrontantes');
sandbox.sync(feature,[{id:'__linhas-gerais__',nome:'Linhas técnicas'}]);
assert.equal(JSON.stringify(feature.properties.confrontantes),original,'Linhas técnicas não devem apagar dados cadastrais');
sandbox.sync(feature,[{id:'lado1',nome:'Novo Vizinho',startVertex:1,endVertex:2}]);
assert.equal(feature.properties.confrontantes[0].nome,'Novo Vizinho','Edição real deve ser aplicada');

// Quando segmentos não foram materializados no editor, preservar cadastro remoto.
const startSave = editor.indexOf('  async function saveProjectVisualLayout(');
const stopSave = editor.indexOf('  async function clearProjectVisualLayout(',startSave);
assert.ok(startSave !== -1 && stopSave > startSave);
const project={id:'projeto',geojson:{features:[feature]}};
let saved=0;
const ctx={
  projectIdFor:()=>'projeto',
  window:{GeoRuralProjects:{get:async()=>project,saveLegacy:async(p)=>{saved++;return p;}}},
  projectPerimeterFeature:()=>feature,
  safeText:value=>String(value||''),
  normalizeDocumentSettings: value => value,
  semanticTrechosFromLayout: (_feature,segments)=>segments,
  syncSegmentConfrontantes: sandbox.sync,
  String, Array, Object, Date
};
vm.runInNewContext(editor.slice(startSave,stopSave)+'\nthis.save=saveProjectVisualLayout;',ctx);
feature.properties.confrontanteVisualLayout={segments:[{id:'v1',nome:'Antigo vizinho'}]};
feature.properties.confrontanteTrechos=[{id:'antigo',nome:'Vizinho Norte'}];
const oldTrechos=JSON.stringify(feature.properties.confrontanteTrechos);
const oldLayout=JSON.stringify(feature.properties.confrontanteVisualLayout);
const before = JSON.stringify(feature.properties.confrontantes);
await ctx.save({}, {segments:[],documentSettings:{elementVisibility:{cotas:false,confrontantes:true}}});
assert.equal(saved,1);
assert.equal(JSON.stringify(feature.properties.confrontantes),before);
assert.equal(JSON.stringify(feature.properties.confrontanteTrechos),oldTrechos);
assert.equal(JSON.stringify(feature.properties.confrontanteVisualLayout),oldLayout);
assert.equal(feature.properties.documentVisualSettings.elementVisibility.cotas,false,'Ocultar cotas continua salvo');

// O botão oficial do PDF utiliza uma validação assíncrona da fonte, sem enviar
// silenciosamente a captura incompleta que perdeu rótulos.
assert.match(app,/window\.SurveyorPranchaExportSourceReady\s*=\s*readyPranchaExportSvg;/);
assert.match(app,/projectNeedsConfrontantesInExport\(project\) && !hasPrintableConfrontante\(svg\)/);
assert.match(app,/throw new Error\('Os confrontantes cadastrados não apareceram na prancha/);
assert.match(downloads,/await window\.SurveyorPranchaExportSourceReady\(\)/);
assert.match(app,/await readyPranchaExportSvg\(\)/,'Exportação SVG deve seguir proteção equivalente');
console.log('PASS: ocultar cotas/remover imagens não pode eliminar cadastro de confrontantes e PDF/SVG verificam a cena antes do download.');
