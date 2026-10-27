import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const measureStart = app.indexOf('function startSurveyorMeasureTool()');
const measureEnd = app.indexOf('function closeVertexHideChoice()', measureStart);
const measureBlock = app.slice(measureStart, measureEnd);
assert.ok(measureBlock.includes("map.on('mousemove', onMove)"), 'Ferramenta Medir deve atualizar a prévia no movimento do cursor.');
assert.ok(measureBlock.includes("map.on('dblclick', onDblClick)"), 'Ferramenta Medir deve finalizar pelo handler de duplo clique válido.');
assert.ok(!measureBlock.includes("map.on('dblclick', onDoubleClick)"), 'Ferramenta Medir não pode registrar handler inexistente que interrompa a inicialização.');

const liveStart = app.indexOf('function scheduleDirectEditLiveUpdate');
const liveEnd = app.indexOf('function directEditTargetsSnapshot', liveStart);
const liveBlock = app.slice(liveStart, liveEnd);
assert.ok(liveBlock.includes('if (segmentMeasuresEnabled) updateGlebaMeasureTooltip(target)'), 'Cotas devem acompanhar a geometria durante cada frame de edição.');

const editStart = app.indexOf('function beginDirectEditMode');
const editEnd = app.indexOf('function clearVertexHideChoice', editStart) > editStart ? app.indexOf('function clearVertexHideChoice', editStart) : app.indexOf('function ', editStart + 30);
const editBlock = app.slice(editStart, editEnd > editStart ? editEnd : editStart + 12000);
assert.ok(app.includes('if (segmentMeasuresEnabled) updateGlebaMeasureTooltip(targetLayer);'), 'Entrar em Editar deve preservar imediatamente as cotas ativas.');
console.log('map-live-measure-edit-cotas: ok');
