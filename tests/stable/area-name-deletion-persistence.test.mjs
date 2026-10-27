import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const bridgeSource = fs.readFileSync('assets/js/core/technical-map-bridge.js', 'utf8');
const editorSource = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const mapasSource = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');

const context = { window:{}, console };
context.globalThis = context;
vm.runInNewContext(bridgeSource, context, { filename:'technical-map-bridge.js' });
const bridge = context.window.SurveyorTechnicalMapBridge;
assert.ok(bridge?.normalizeAreaNames, 'Bridge técnico deve expor a normalização oficial de nomes do mapa.');

const legacy = bridge.normalizeAreaNames({ areaName:'FAZENDA LEGADA', areaNameX:.4, areaNameY:.6 });
assert.equal(legacy.length, 1, 'Projeto antigo sem areaNames deve continuar migrando o campo legado.');
assert.equal(legacy[0].text, 'FAZENDA LEGADA');

const deleted = bridge.normalizeAreaNames({
  areaNames:[],
  areaName:'NOME ANTIGO QUE NÃO PODE VOLTAR',
  areaNameX:.4,
  areaNameY:.6
});
assert.deepEqual(Array.from(deleted), [], 'areaNames vazio explícito deve representar exclusão definitiva, sem ressuscitar o campo legado.');

const normalized = bridge.normalizeSettings({ areaNames:[], areaName:'NOME FANTASMA' });
assert.equal(normalized.areaNames.length, 0, 'Estado visual normalizado deve preservar a coleção explicitamente vazia.');

const feature = {
  type:'Feature',
  properties:{ category:'perimetro' },
  geometry:{ type:'Polygon', coordinates:[[[-40,-13],[-39.9,-13],[-39.9,-13.1],[-40,-13.1],[-40,-13]]] }
};
const projector = ([lng,lat]) => [(lng + 40) * 1000, (-lat - 13) * 1000];
const markup = bridge.visualOverlayMarkup(feature, projector, { x:0, y:0, w:500, h:500 }, { areaNames:[], areaName:'NOME FANTASMA' });
assert.ok(!markup.includes('sv-area-name-label'), 'Renderer não deve recriar nome quando a coleção oficial está vazia.');
assert.ok(!markup.includes('NOME FANTASMA'), 'Campo legado não pode reaparecer na saída depois de uma exclusão explícita.');

const activeNormalizers = [bridgeSource, editorSource, mapasSource]
  .map((source) => (source.match(/(?:function\s+normalizeAreaNames\s*\(|const\s+normalizeAreaNames\s*=)/g) || []).length)
  .reduce((sum, count) => sum + count, 0);
assert.equal(activeNormalizers, 1, 'Deve existir uma única implementação ativa de normalizeAreaNames nos módulos do fluxo documental.');
assert.match(editorSource, /bridge\?\.normalizeAreaNames\?\.\(value\)/, 'Editor deve consumir o normalizador oficial da bridge.');
assert.match(mapasSource, /technicalMapBridge\?\.normalizeAreaNames\?\.\(\{\s*\.\.\.value,\s*defaultAreaName\s*\}\)/, 'Gerador deve consumir o mesmo normalizador oficial, enriquecendo apenas o nome padrão do projeto.');
assert.match(editorSource, /function removeAreaName\(\)[\s\S]*?documentSettings=normalizeDocumentSettings\(\{[\s\S]*?areaNames:\(documentSettings\.areaNames\|\|\[\]\)\.filter/, 'Excluir nome deve normalizar imediatamente o estado e limpar os espelhos legados.');

console.log('PASS area-name-deletion-persistence: exclusão definitiva, migração legada e fonte única de normalização validadas.');
