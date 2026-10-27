import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const rendererSource = read('assets/js/features/mapas/confrontantes.js');
const editorSource = read('assets/js/core/technical-document-editor.js');
const mapasPage = read('mapas/index.html');
const pranchasPage = read('pranchas/index.html');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(rendererSource, context);
const engine = context.window.SurveyorDocumentConfrontantes.create({ escape: (value) => String(value ?? '') });

const coords = [[0,0],[4,0],[4,2],[0,2],[0,0]];
const mapBox = { x:40, y:30, w:800, h:500 };
const project = ([x,y]) => [200 + x * 50, 80 + y * 150];
const feature = { properties: { confrontanteTrechos:[{ id:'t1', nome:'TESTE', startVertex:1, endVertex:3 }] } };
const shared = {
  id:'t1', nome:'TESTE', startVertex:1, endVertex:3,
  vertices:[1,2,3], segmentIndexes:[0,1],
  coordinateSpace:'geometry-v1',
  // N representa um quadro documental antigo e é propositalmente incompatível
  // com G. Um layout compartilhado por projeto deve usar G no novo documento.
  extraLines:[{
    id:'l1',
    x1N:.10, y1N:.20, x2N:.30, y2N:.40,
    x1G:.25, y1G:.50, x2G:.75, y2G:.50
  }],
  manualLinesOnly:true,
  labelDxN:.10, labelDyN:.10,
  labelDxG:.05, labelDyG:.10,
  labelScale:1
};

const sharedSvg = engine.smartConfrontanteLabels(feature, coords, project, mapBox, {
  placement:'boundary', fontSize:10, segmentOverrides:[shared]
});
assert.ok(sharedSvg.includes('x1="250.00"') && sharedSvg.includes('y1="230.00"'), 'Layout geometry-v1 deve reconstruir a linha pela geometria do imóvel, independentemente do quadro da Prancha/Croqui.');
assert.ok(sharedSvg.includes('x2="350.00"') && sharedSvg.includes('y2="230.00"'), 'Segundo ponto da linha compartilhada deve manter a mesma posição relativa à geometria.');
assert.ok(sharedSvg.includes('data-dx="10.00"') && sharedSvg.includes('data-dy="30.00"'), 'Deslocamento do confrontante geometry-v1 deve ser relativo à geometria do imóvel.');
assert.ok(sharedSvg.includes('data-geom-x="200.00"') && sharedSvg.includes('data-geom-w="200.00"'), 'SVG deve expor o quadro geométrico para o editor salvar coordenadas transportáveis entre documentos.');

const legacy = { ...shared, coordinateSpace:'', extraLines:[{ ...shared.extraLines[0] }] };
const legacySvg = engine.smartConfrontanteLabels(feature, coords, project, mapBox, {
  placement:'boundary', fontSize:10, segmentOverrides:[legacy]
});
assert.ok(legacySvg.includes('x1="120.00"') && legacySvg.includes('y1="130.00"'), 'Layout legado sem geometry-v1 deve continuar lendo N para não quebrar projetos já salvos.');

assert.ok(editorSource.includes("coordinateSpace:'geometry-v1'"), 'Novos salvamentos devem marcar explicitamente o referencial geométrico compartilhado.');
assert.ok(editorSource.includes('clearProjectContextCaches(options)'), 'Editor deve remover caches antigos específicos de página/layout ao consolidar um projeto.');
assert.ok(editorSource.includes(': (fromProject.length ? fromProject : (localSegments.length ? localSegments : stored));'), 'Estado oficial do projeto deve ter prioridade sobre cache antigo específico da tela.');
assert.ok(editorSource.includes('if (options.persistProject === false) {\n              persistOffsets();\n              writeSegments(options, localSegments);'), 'Cache por página/layout deve ser gravado apenas nos editores deliberadamente locais.');
assert.ok(editorSource.includes('if (options.persistProject !== false) clearProjectContextCaches(options);'), 'Salvamento oficial deve limpar resíduos por página/layout do mesmo projeto.');
assert.ok(editorSource.includes('version: 9') && editorSource.includes('version: 8'), 'Layout local e layout persistido devem usar as novas versões de esquema da consolidação.');

for (const [name, page] of [['Mapas/Croquis', mapasPage], ['Prancha Técnica', pranchasPage]]) {
  assert.ok(page.includes('/assets/js/core/technical-document-editor.js'), `${name} deve carregar o mesmo editor técnico compartilhado.`);
  assert.ok(page.includes('/assets/js/features/mapas/app.js'), `${name} deve carregar a mesma aplicação documental compartilhada.`);
}

console.log('PASS V127 layout por projeto: Prancha/Croqui compartilham estado geometry-v1, limpam caches por tela e preservam leitura legada.');
