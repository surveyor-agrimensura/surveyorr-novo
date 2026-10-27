const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');

assert.match(app, /let directEditTargetLayers\s*=\s*\[\]/,
  'A edição precisa manter uma lista explícita dos layers alvo.');
assert.match(app, /directEditTargetLayers\s*=\s*\[targetLayer\][\s\S]*directEditFeatureGroup\s*=\s*new L\.FeatureGroup\(directEditTargetLayers\)/,
  'A sessão de edição deve criar um FeatureGroup temporário apenas com o elemento selecionado.');
assert.match(app, /new L\.EditToolbar\.Edit\(map,\s*\{[\s\S]*featureGroup:\s*directEditFeatureGroup/,
  'Leaflet.Draw não deve editar o FeatureGroup drawn inteiro.');
assert.match(app, /if \(!map\.hasLayer\(targetLayer\)\)[\s\S]*Este elemento está oculto\. Clique em Mostrar antes de editar\./,
  'Elemento oculto não pode entrar em edição.');
assert.match(app, /function decorateAllDirectEditHandles\(\)[\s\S]*directEditTargetsSnapshot\(\)\.forEach/,
  'Somente os alvos da sessão devem receber handles de edição.');
assert.match(app, /function select\(layer, options = \{\}\)[\s\S]*directEditMode[\s\S]*!isDirectEditTarget\(layer\)[\s\S]*disableActiveHandler\(\)/,
  'Trocar a seleção durante a edição deve encerrar o editor anterior antes de selecionar outro elemento.');
assert.match(app, /function setDrawnLayerVisibility\(layer, visible\)[\s\S]*if \(directEditMode && isDirectEditTarget\(layer\)\) disableActiveHandler\(\)[\s\S]*map\.removeLayer\(layer\)/,
  'Ocultar o elemento em edição deve desmontar os handles antes de removê-lo do mapa.');
assert.match(app, /function setDrawnLayerVisibility\(layer, visible\)[\s\S]*map\.addLayer\(layer\)[\s\S]*applyStyleToDrawn\(layer\)/,
  'Mostrar novamente deve restaurar o estilo persistido sem recriar estado órfão.');
assert.match(app, /clearDirectEditTargetState\(\)[\s\S]*directEditFeatureGroup\?\.clearLayers\?\.\(\)/,
  'O FeatureGroup temporário deve ser limpo para não deixar event parents/handles órfãos.');
assert.match(html, /app-v21\.9\.0\.js\?v=[A-Za-z0-9._-]+/,
  'O mapa precisa de cache-bust versionado para entregar a correção imediatamente.');

console.log('PASS: edição fica restrita ao elemento selecionado/visível e ocultar/mostrar não deixa handles fantasma.');
