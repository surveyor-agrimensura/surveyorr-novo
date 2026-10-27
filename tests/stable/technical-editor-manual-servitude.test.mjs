import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (file) => fs.readFileSync(file, 'utf8');
const editor = read('assets/js/core/technical-document-editor.js');
const bridgeSource = read('assets/js/core/technical-map-bridge.js');
const mapas = read('assets/js/features/mapas/app.js');
const css = read('assets/css/core/documents.css');

assert.ok(editor.includes('data-editor-tool="servitudes"'), 'Editor técnico deve possuir ferramenta lateral de Servidões.');
assert.ok(editor.includes('data-tool-panel="servitudes"'), 'Servidões devem possuir painel próprio no editor técnico.');
assert.ok(editor.includes('data-editor-action="draw-servitude"'), 'Painel deve permitir desenhar uma servidão diretamente na prancha/croqui.');
assert.ok(editor.includes('data-editor-action="delete-servitude"'), 'Painel deve permitir excluir a servidão documental selecionada.');
assert.ok(editor.includes('data-servitude-width'), 'Painel deve permitir regular a largura visual entre as duas bordas.');
assert.match(editor, /manualServitudes/, 'Estado visual compartilhado do projeto deve transportar as servidões documentais.');
assert.match(editor, /coordinateSpace:'geometry-v1'/, 'Servidão manual deve ficar ancorada na geometria do imóvel.');
assert.match(editor, /attachManualServitudeInteractions\(overlay\)/, 'Interação da servidão deve ser montada no overlay oficial.');
assert.match(editor, /stroke-linecap','butt'/, 'Bordas da servidão no editor devem manter extremidades retas.');
assert.ok(css.includes('.sv-document-manual-servitude-line') && css.includes('stroke-linecap:butt'), 'CSS documental deve preservar pontas finais retas.');
assert.ok(css.includes('.is-servitude-draw-mode'), 'Editor deve sinalizar modo de desenho da servidão.');
assert.match(editor, /svg\.addEventListener\('dblclick',dbl,true\)/, 'Servidão deve concluir diretamente com duplo clique no último ponto.');
assert.match(editor, /function insertOverlayLayer\(node, beforeSelector = ''\)/, 'Camadas editáveis devem usar inserção segura no SVG raiz.');
assert.match(editor, /insertOverlayLayer\(group,beforeSelector\)/, 'Servidão final deve ser reinserida com segurança quando os rótulos estão em grupos aninhados.');
assert.match(editor, /function insertOverlayLayer\(node, beforeSelector = ''\)/, 'Camadas editáveis devem usar inserção segura no SVG raiz.');
assert.match(editor, /insertOverlayLayer\(group,beforeSelector\)/, 'Servidão final deve ser reinserida com segurança quando os rótulos estão em grupos aninhados.');
assert.match(editor, /finishManualServitudeDrawing\(\)\{[\s\S]*renderManualServitudesInOverlay\(\);syncManualServitudeControls\(\);scheduleNativePublish\(\);markDirty\(true\);/, 'Conclusão da servidão deve permanecer visível e marcar a prancha como alterada.');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(bridgeSource, context);
const bridge = context.window.SurveyorTechnicalMapBridge;
assert.equal(typeof bridge.normalizeManualServitudes, 'function');
assert.equal(typeof bridge.manualServitudeMarkup, 'function');
assert.equal(typeof bridge.manualServitudeGeometry, 'function');

const feature = { geometry: { type:'Polygon', coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]]] } };
const projector = ([x,y]) => [100 + x * 10, 200 + y * 10];
const legacySettings = { manualServitudes:[{ id:'srv-legacy', x1G:.1, y1G:.2, x2G:.9, y2G:.8, widthG:.08 }] };
const normalizedLegacy = bridge.normalizeManualServitudes(legacySettings);
assert.equal(normalizedLegacy.length, 1, 'Traçado legado deve continuar sendo reconhecido.');
assert.equal(normalizedLegacy[0].pointsG.length, 2, 'Formato antigo de dois extremos deve migrar para dois pontos de controle.');
assert.equal('x1G' in normalizedLegacy[0], false, 'Normalização nova deve consolidar a geometria em pointsG sem manter duas fontes concorrentes.');

const markup = bridge.manualServitudeMarkup(feature, projector, {x:80,y:180,w:140,h:140}, legacySettings);
assert.ok(markup.includes('class="sv-document-manual-servitude"'), 'Gerador deve emitir grupo próprio para a servidão documental.');
assert.equal((markup.match(/class="sv-document-manual-servitude-line"/g) || []).length, 2, 'Servidão documental deve possuir exatamente duas bordas paralelas.');
assert.equal((markup.match(/stroke-linecap="butt"/g) || []).length, 2, 'As duas bordas devem ter pontas finais retas.');
assert.equal(markup.includes('stroke-linecap="round"'), false, 'Pontas da servidão documental não podem virar caps arredondados.');
assert.equal(/<polygon/i.test(markup), false, 'Servidão documental não pode virar polígono de buffer preenchido.');

const areaMarkup = bridge.areaNameMarkup(feature, projector, {x:80,y:180,w:140,h:140}, legacySettings);
assert.ok(areaMarkup.includes('sv-document-manual-servitude'), 'A ponte técnica deve incluir a servidão nas gerações documentais compartilhadas.');
assert.match(mapas, /technicalMapBridge\?\.normalizeSettings\?\.\(\{\s*\.\.\.value,\s*defaultAreaName\s*\}\)/, 'Mapas/Pranchas devem consumir a normalização visual única da ponte técnica.');
assert.match(bridgeSource, /manualServitudes:\s*normalizeManualServitudes\(value\)/, 'A ponte técnica deve manter a servidão documental dentro da normalização visual compartilhada.');
assert.match(mapas, /technicalMapBridge\?\.areaNameMarkup/, 'Mapas/Pranchas devem renderizar a servidão pela ponte técnica compartilhada.');

for (const page of ['mapas/index.html','pranchas/index.html']) {
  const html = read(page);
  const bridgeAt = html.indexOf('/assets/js/core/technical-map-bridge.js');
  const editorAt = html.indexOf('/assets/js/core/technical-document-editor.js');
  assert(bridgeAt >= 0, `${page} deve carregar a ponte técnica compartilhada.`);
  assert(editorAt > bridgeAt, `${page} deve carregar o editor somente depois da ponte técnica.`);
}

console.log('PASS servidão documental: duas bordas, pontas retas, geometry-v1 e migração do formato legado para pointsG.');
