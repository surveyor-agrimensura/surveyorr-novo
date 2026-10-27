import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const read = (rel) => fs.readFileSync(new URL(rel, root), 'utf8');
const renderer = read('assets/js/features/mapas/confrontantes.js');
const editor = read('assets/js/core/technical-document-editor.js');
const mapApp = read('assets/js/features/mapa/app.js');
const mapHtml = read('mapa/index.html');
const maps = read('assets/js/features/mapas/app.js');
const planialt = read('assets/js/features/planialtimetria/app.js');
const perimetros = read('assets/js/features/perimetros/app.js');
const memorial = read('assets/js/features/memorial/app.js');
const memorialHtml = read('memorial/index.html');

assert.ok(renderer.includes('function rangeIndexes(startVertex, endVertex, count)'), 'Compatibilidade antiga de V-inicial/V-final deve continuar disponível.');
assert.ok(renderer.includes('explicitVertices') && renderer.includes('explicitIndexes'), 'Motor deve priorizar os vértices/segmentos escolhidos explicitamente no mapa.');
assert.ok(renderer.includes('boundaryConfrontanteLabels'), 'Geração deve criar chamadas automaticamente a partir da seleção do confrontante.');
assert.ok(renderer.includes('data-selected-vertices=') && renderer.includes('data-segment-indexes='), 'SVG deve transportar a seleção exata para o editor documental.');
assert.ok(renderer.includes('confrontanteVisualLayout') && renderer.includes('version || 0) >= 3'), 'Somente o layout visual v3 salvo pelas gerações deve ser reutilizado.');
assert.ok(renderer.includes('normalizeOverrideGroup(entry, count, order, false)'), 'Seleções definidas no mapa devem entrar como semântica, sem reaproveitar guias visuais antigos.');

assert.ok(!mapHtml.includes('Selecione diretamente os vértices no mapa'), 'Mapa não deve manter instrução permanente redundante sobre seleção de vértices.');
assert.ok(mapHtml.includes('id="toggleConfrontanteVertexSelect"') && mapHtml.includes('id="saveConfrontanteVertexSelection"'), 'Mapa deve oferecer modo explícito de seleção e aplicação do nome.');
assert.ok(mapApp.includes('shiftKey'), 'Seleção rápida de intervalo com Shift deve permanecer no comportamento mesmo sem texto explicativo permanente.');
assert.ok(!mapHtml.includes('id="traceConfrontanteGuides"') && !mapHtml.includes('id="addFreeConfrontanteCallout"'), 'Mapa não deve expor desenho visual de linhas de confrontante.');
assert.ok(mapApp.includes('confrontanteSelectedVertices') && mapApp.includes('handleConfrontanteVertexClick'), 'Runtime deve manter seleção explícita de vértices clicados.');
assert.ok(mapApp.includes('confrontanteSelectionPath') && mapApp.includes('shiftKey'), 'Shift + clique deve construir um caminho rápido entre vértices.');
assert.ok(mapApp.includes('vertices:explicitVertices') && mapApp.includes('segmentIndexes:segmentIndexes.slice()'), 'Projeto deve salvar exatamente os vértices/segmentos escolhidos, sem recalcular um arco depois.');
assert.ok(mapApp.includes('vertices.length === 1') || renderer.includes('explicitVertices.length === 1'), 'Um único vértice deve ser aceito como confrontante.');
assert.ok(mapApp.includes('delete p.confrontanteChamadas'), 'Mapa deve limpar chamadas visuais antigas que causavam regressões.');

assert.ok(editor.includes("surveyor:confrontante-label-layout:v4"), 'Editor V55 deve usar namespace novo, sem herdar layouts locais antigos.');
assert.ok(editor.includes('version: 8') && editor.includes('documentSettings'), 'Layout visual salvo no projeto deve persistir confrontantes e configurações documentais na mesma revisão transacional.');
assert.ok(editor.includes('GeoRuralProjects.saveLegacy(project)'), 'Salvar edição visual deve persistir no próprio projeto.');
assert.ok(editor.includes('syncSegmentConfrontantes(feature, segmentsToSave)') && editor.includes('if (!preserveRegistered)'), 'Edições reais sincronizam nomes com memorial/relatórios, sem apagar os confrontantes cadastrados quando a prévia estiver incompleta.');
assert.ok(editor.includes('seleção definida no mapa'), 'Editor deve exibir a seleção vinda do mapa sem obrigar nova escolha de vértices.');
assert.ok(editor.includes('segmentIndexes:Array.isArray(segment.segmentIndexes)'), 'Editor deve preservar os segmentos explicitamente selecionados ao salvar o layout.');
assert.ok(editor.includes('data-editor-action="add-confrontante"') && editor.includes('semanticTrechosFromLayout'), 'Editor documental deve permitir criar confrontante e sincronizar a semântica no projeto.');

assert.ok(maps.includes('segmentOverrides: readConfrontanteSegmentOverrides(p)') && maps.includes('remoteLayout') && maps.includes('editorProjectLayout()'), 'Mapas/pranchas devem aplicar o layout compartilhado mais recente, conciliando projeto remoto e edição local.');
assert.ok(planialt.includes('segmentOverrides: confrontanteEditor?.readProjectSegments?.() || []'), 'Planialtimetria deve aplicar o layout normalizado do projeto.');
assert.ok(perimetros.includes('segmentOverrides: confrontanteEditor?.readProjectSegments?.() || []'), 'Perímetros deve aplicar o layout normalizado do projeto.');
assert.ok(memorialHtml.includes('/assets/js/features/mapas/confrontantes.js') && memorialHtml.includes('id="memShowConfrontantes"'), 'Memorial deve carregar o mesmo motor e oferecer mostrar/ocultar confrontantes no mapa.');
assert.ok(memorial.includes('window.SurveyorCroquiRenderer') && memorial.includes('return renderer.generate(p'), 'Mapa do Memorial deve reutilizar o renderer oficial de Mapas/Croquis, incluindo os confrontantes salvos no projeto.');

console.log('PASS V50 confrontantes: seleção direta de vértices/Shift, seleção única e persistência exata no projeto/documentos.');
