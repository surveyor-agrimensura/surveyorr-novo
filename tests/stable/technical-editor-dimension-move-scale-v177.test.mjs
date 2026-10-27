import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');

assert.match(source, /function attachStableDimensionDrag\(svg\)/, 'O editor deve expor uma única rotina dedicada de arraste das cotas.');
assert.match(source, /activeToolPanel !== 'dimensions'/, 'O arraste das cotas deve ficar restrito ao painel Editar cotas.');
assert.match(source, /selectDimensionLabel\(key\)/, 'O clique na cota deve selecionar exatamente a cota manipulada.');
assert.match(source, /documentSettings\.dimensionLabelOffsets \|\|= \{\}/, 'O editor deve persistir offsets individuais das cotas.');
assert.match(source, /documentSettings\.dimensionLabelScales\|\|=\{\}/, 'O editor deve persistir ajuste individual por cota.');
assert.match(source, /min="0" max="5" step="0\.05" data-document-setting="dimensionScale"/, 'O controle geral deve permitir 0% a 500%.');
assert.match(source, /min="0" max="5" step="0\.05" data-selected-dimension-scale/, 'O ajuste da cota selecionada deve permitir 0% a 500%.');
assert.match(source, /if\(wrap\)wrap\.hidden=!active/, 'A opção individual deve aparecer apenas após selecionar uma cota.');
assert.match(source, /window\.SurveyorTechnicalMapBridge\?\.dimensionScaleForKey[\s\S]*sharedScale\(documentSettings,key,legacyKey\)/, 'A prévia do editor deve delegar a escala à mesma política usada pela geração final.');
assert.doesNotMatch(source, /globalScale\*individualScale/, 'O editor não deve duplicar a matemática de composição das escalas.');
assert.doesNotMatch(source, /node\.style\.cursor = activeToolPanel/, 'Helper global de posição não pode depender do estado local activeToolPanel fora do seu escopo.');

console.log('PASS technical-editor-dimension-move-scale-v177: escala geral, ajuste individual contextual e reposicionamento validados.');
