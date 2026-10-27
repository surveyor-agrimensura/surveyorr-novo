import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dimensionsSource = fs.readFileSync('assets/js/features/mapas/dimensions.js','utf8');
const bridgeSource = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const mapSource = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const editorSource = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');

assert.match(bridgeSource, /function normalizeDimensionVisualSettings\(value = \{\}\)/, 'A ponte técnica deve normalizar o estado visual das cotas.');
assert.match(bridgeSource, /function dimensionScaleForKey\(value = \{\}, key = '', legacyKey = ''\)/, 'A ponte técnica deve ser a única autoridade da composição entre escala geral e ajuste individual.');
assert.match(bridgeSource, /return Math\.max\(0, Math\.min\(5, globalScale \* individualScale\)\)/, 'A composição final de escala deve ser centralizada na ponte técnica.');
assert.doesNotMatch(mapSource, /dimensionScaleFor\s*=/, 'O gerador não deve manter um segundo controlador de escala das cotas.');
assert.match(mapSource, /dimensionScaleForKey:technicalMapBridge\?\.dimensionScaleForKey/, 'O gerador deve injetar a política oficial de escala no módulo de cotas.');
assert.match(dimensionsSource, /const effectiveScale = dimensionScaleForKey\(visualSettings, dimensionKey, legacyKey\)/, 'O renderer deve consumir a política oficial sem repetir a matemática de escala.');
assert.doesNotMatch(dimensionsSource, /globalScale \* individualScale/, 'O renderer não deve duplicar a composição de escala da ponte técnica.');
assert.match(dimensionsSource, /data-dimension-key="\$\{escape\(dimensionKey\)\}"/, 'Cada cota gerada deve possuir identidade estável própria.');
assert.match(dimensionsSource, /data-dimension-base-font-size=/, 'A fonte-base da cota deve ser preservada separadamente da escala visual.');
assert.match(dimensionsSource, /const lineWidth = Math\.max\(0\.18, Math\.min\(0\.32, baseFontSize \* 0\.085\)\)/, 'A espessura da linha técnica não deve crescer quando apenas a fonte da cota aumenta.');
assert.doesNotMatch(editorSource, /migrateLegacyDimensionScale/, 'O antigo conversor global→individual não deve continuar ativo agora que a escala geral voltou a ser oficial.');

const sandbox = { window:{}, localStorage:{ getItem:()=>null }, globalThis:null };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(bridgeSource, sandbox);
vm.runInContext(dimensionsSource, sandbox);
const dimensionScaleForKey=sandbox.window.SurveyorTechnicalMapBridge.dimensionScaleForKey;
assert.equal(dimensionScaleForKey({dimensionScale:2,dimensionLabelScales:{'perimeter:1':1.5}},'perimeter:1','1'),3,'Escala geral 200% + ajuste individual 150% deve resultar em 300%.');
assert.equal(dimensionScaleForKey({dimensionScale:2,dimensionLabelScales:{}},'perimeter:2','2'),2,'Escala geral deve atingir também cotas sem ajuste individual.');

const mod = sandbox.window.SurveyorDocumentDimensions.create({
  area:()=>0,
  ringOfFeature:(feature)=>feature?.geometry?.coordinates?.[0] || [],
  hav:()=>73.5,
  num:(value,digits=1)=>Number(value).toFixed(digits).replace('.',','),
  escape:(value)=>String(value).replace(/[&<>"']/g,''),
  dimensionScaleForKey
});
const coords=[[0,0],[1,0],[1,1],[0,1],[0,0]];
const project=([x,y])=>[100+x*200,100+y*200];
const html=mod.cadDimensionLabels(coords,project,{x:0,y:0,w:400,h:400},{
  fontSize:4,
  minFontSize:3,
  offset:10,
  placement:'outside',
  containerCoords:coords,
  lockNormalOffset:true,
  visualSettings:{dimensionScale:1.5,dimensionLabelScales:{'perimeter:1':2},dimensionLabelOffsets:{'perimeter:1':{dx:12,dy:6}}}
});
assert.match(html,/data-dimension-key="perimeter:1"/, 'A primeira cota do perímetro deve receber chave estável perimeter:1.');
assert.match(html,/data-offset-dx="12\.000" data-offset-dy="6\.000"/, 'O deslocamento individual deve ser materializado na geração final.');
const font1=Number(html.match(/data-dimension-key="perimeter:1"[^>]*font-size="([0-9.]+)"/)?.[1]);
const font2=Number(html.match(/data-dimension-key="perimeter:2"[^>]*font-size="([0-9.]+)"/)?.[1]);
assert.ok(font1>font2*1.9, 'Ajuste individual 200% deve manter a primeira cota aproximadamente duas vezes maior que as demais sob a mesma escala geral.');

console.log('PASS dimension-source-of-truth: escala geral + ajuste individual usam uma única política e preservam identidade/offset das cotas.');
