import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const rendererSource = read('assets/js/features/mapas/confrontantes.js');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(rendererSource, context);
const engine = context.window.SurveyorDocumentConfrontantes.create({
  escape: (value) => String(value ?? '').replace(/[&<>"']/g, '')
});
const coords = [[0,0],[2,0],[2,2],[0,2],[0,0]];
const project = ([x,y]) => [100 + x * 100, 100 + y * 100];
const mapBox = { x:50, y:50, w:400, h:400 };

// V-03 pode encerrar o primeiro e iniciar o segundo confrontante.
const semanticFeature = { properties: { confrontanteTrechos: [
  { id:'a', nome:'JOSEFA', startVertex:1, endVertex:3 },
  { id:'b', nome:'JOSEFINA', startVertex:3, endVertex:4 }
] } };
const autoSvg = engine.smartConfrontanteLabels(semanticFeature, coords, project, mapBox, { placement:'boundary', fontSize:10 });
assert.ok(autoSvg.includes('JOSEFA') && autoSvg.includes('JOSEFINA'), 'Dois trechos que compartilham V-03 devem coexistir.');
assert.equal((autoSvg.match(/class="sv-confrontante-guide-extension"/g) || []).length, 4, 'Cada trecho deve ganhar duas linhas automáticas próprias.');
assert.ok(!autoSvg.includes('sv-confrontante-guide-bridge'), 'Linhas não devem ser unidas por ponte.');

// Dados experimentais antigos no mapa não podem mais contaminar a geração.
const legacyFeature = { properties: {
  confrontanteTrechos: [{ id:'a', nome:'NOVO', startVertex:1, endVertex:3 }],
  confrontanteChamadas: [{ id:'legacy', nome:'LEGACY QUEBRADO', line1StartLat:9999, line1StartLng:9999 }],
  confrontanteVisualLayout: { version:2, segments:[{ id:'a', nome:'LAYOUT ANTIGO', startVertex:1, endVertex:3, freeLine1X1N:99, freeLine1Y1N:99, freeLine1X2N:99, freeLine1Y2N:99 }] }
} };
const legacySvg = engine.smartConfrontanteLabels(legacyFeature, coords, project, mapBox, { placement:'boundary' });
assert.ok(legacySvg.includes('NOVO'), 'Trecho semântico deve continuar gerando.');
assert.ok(!legacySvg.includes('LEGACY QUEBRADO') && !legacySvg.includes('LAYOUT ANTIGO'), 'Chamadas do mapa e layout visual anterior a v3 devem ser ignorados.');

// Layout v3 do editor documental deve ser reaproveitado em qualquer geração.
const visualFeature = { properties: {
  confrontanteTrechos: [{ id:'a', nome:'ESTRADA', startVertex:1, endVertex:3 }],
  confrontanteVisualLayout: { version:3, segments:[{
    id:'a', nome:'ESTRADA', startVertex:1, endVertex:3,
    freeLine1X1N:.1, freeLine1Y1N:.2, freeLine1X2N:.1, freeLine1Y2N:.05,
    freeLine2X1N:.7, freeLine2Y1N:.2, freeLine2X2N:.7, freeLine2Y2N:.05,
    labelScale:1.4, labelRotation:90,
    extraLines:[{ id:'x1', x1N:.2, y1N:.3, x2N:.3, y2N:.1 }]
  }] }
} };
const visualSvg = engine.smartConfrontanteLabels(visualFeature, coords, project, mapBox, { placement:'boundary', fontSize:10 });
assert.ok(visualSvg.includes('sv-confrontante-manual-guide'), 'Layout v3 deve substituir o automático.');
assert.ok(visualSvg.includes('sv-confrontante-extra-line'), 'Linha extra salva deve reaparecer.');
assert.ok(visualSvg.includes('rotate(90.00'), 'Rotação do nome deve reaparecer.');
assert.ok(visualSvg.includes('ESTRADA'), 'Nome salvo deve reaparecer.');

console.log('PASS V50 definitivo: chamadas automáticas, vértice compartilhado, legado ignorado e layout v3 reutilizado.');
