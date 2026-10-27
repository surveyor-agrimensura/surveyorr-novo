const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

const srcPath = path.join(__dirname, '..', '..', 'assets', 'js', 'features', 'mapas', 'app.js');
const src = fs.readFileSync(srcPath, 'utf8');

assert.match(src, /function projectedSegmentOverlapInfo\(/, 'detector geométrico de sobreposição de segmentos não encontrado');
assert.match(src, /placementResolver:\s*\(a, b\) =>[\s\S]*sharedWithChild[\s\S]*return sharedWithChild \? 'outside' : 'inside'/, 'gleba-mãe deve jogar a cota compartilhada para o lado oposto da filha');
assert.match(src, /rootSegments\.some\(\(rootSegment\) => projectedSegmentOverlapInfo\(current, rootSegment\)\.same\)/, 'segmento idêntico ao perímetro principal deve ser deduplicado');
assert.match(src, /renderedSegments\.some\(\(rendered\) => projectedSegmentOverlapInfo\(current, rendered\)\.same\)/, 'duplicatas entre glebas devem ser deduplicadas por geometria, não só por id');
assert.match(src, /occupiedLabels = Array\.isArray\(options\.occupiedLabels\) \? options\.occupiedLabels : \[\]/, 'cotas do perímetro e das glebas devem compartilhar mapa de colisão');
assert.match(src, /fittedDimensionFontSize\(/, 'segmentos curtos devem poder reduzir a fonte automaticamente');
assert.match(src, /\[t1, 0\], \[-t1, 0\], \[t2, 0\], \[-t2, 0\]/, 'resolução de colisão deve tentar deslocamento tangencial antes de afastar a cota da linha');

const start = src.indexOf('  function projectedDimensionSegment(a, b, project) {');
const end = src.indexOf('\n\n  function glebaDimensionLabels(', start);
assert.ok(start >= 0 && end > start, 'helpers geométricos R12 não encontrados');
const helpers = src.slice(start, end);
const context = { Math, Number, String, Map, Set, Infinity };
vm.createContext(context);
vm.runInContext(`${helpers}\nglobalThis.__r12 = { projectedDimensionSegment, projectedSegmentOverlapInfo };`, context);
const { projectedDimensionSegment, projectedSegmentOverlapInfo } = context.__r12;
const project = ([x, y]) => [x, y];

const parent = projectedDimensionSegment([0, 0], [100, 0], project);
const child = projectedDimensionSegment([36, 0.25], [64, 0.15], project);
const partial = projectedSegmentOverlapInfo(parent, child);
assert.ok(partial.shared, 'trecho filho colinear contido no pai deve ser reconhecido como compartilhado');
assert.ok(!partial.same, 'trecho filho menor não pode ser tratado como duplicata integral do pai');

const duplicate = projectedDimensionSegment([0.35, 0.18], [100.2, -0.08], project);
const same = projectedSegmentOverlapInfo(parent, duplicate);
assert.ok(same.same, 'segmentos praticamente idênticos devem ser reconhecidos como duplicata');

const parallelFar = projectedDimensionSegment([0, 5], [100, 5], project);
assert.ok(!projectedSegmentOverlapInfo(parent, parallelFar).shared, 'linhas paralelas afastadas não podem ser confundidas como o mesmo limite');

console.log('PASS: R12 separa cotas pai/filha, remove duplicatas do perímetro e mantém rótulos junto às linhas.');

// Runtime simples da hierarquia completa: pai compartilha apenas parte de um lado com a filha.
const hierarchyStart = src.indexOf('  const ringOfFeature = (feature) => {');
const hierarchyEnd = src.indexOf('\n\n  const confrontantePalette', hierarchyStart);
assert.ok(hierarchyStart >= 0 && hierarchyEnd > hierarchyStart, 'bloco completo de cotas não encontrado');
const hierarchyHelpers = src.slice(hierarchyStart, hierarchyEnd);
function polygonArea(feature) {
  const ring = feature?.geometry?.coordinates?.[0] || [];
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  return Math.abs(sum) / 2;
}
const hierarchyContext = {
  Math, Number, String, Map, Set, Infinity, console,
  turf: { area: polygonArea },
  escape: (value) => String(value ?? ''),
  num: (value, digits = 1) => Number(value || 0).toFixed(digits),
  hav: (a, b) => Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1])),
  globalThis: null,
};
hierarchyContext.globalThis = hierarchyContext;
vm.createContext(hierarchyContext);
vm.runInContext(`${hierarchyHelpers}\nglobalThis.__hier = { glebaDimensionLabels };`, hierarchyContext);

const root = { type: 'Feature', properties: { id: 'root', category: 'perimetro' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[100,0],[100,100],[0,100],[0,0]]] } };
const parentFeature = { type: 'Feature', properties: { id: 'p', category: 'gleba', parentLayerId: 'root' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[100,0],[100,80],[0,80],[0,0]]] } };
const childFeature = { type: 'Feature', properties: { id: 'c', category: 'gleba', parentLayerId: 'p' }, geometry: { type: 'Polygon', coordinates: [[[0,20],[40,20],[40,80],[0,80],[0,20]]] } };
const projectData = { geojson: { features: [root, parentFeature, childFeature] } };
const hierarchySvg = hierarchyContext.__hier.glebaDimensionLabels(projectData, root, ([x,y]) => [x,y], {x:0,y:0,w:100,h:100}, { fontSize: 3, minFontSize: 2.2, offset: 3 });

const parentOutsideCount = [...hierarchySvg.matchAll(/class="sv-cad-dimension sv-cad-dimension-outside" data-owner="p"/g)].length;
const parentInsideCount = [...hierarchySvg.matchAll(/class="sv-cad-dimension sv-cad-dimension-inside" data-owner="p"/g)].length;
const childInsideCount = [...hierarchySvg.matchAll(/class="sv-cad-dimension sv-cad-dimension-inside" data-owner="c"/g)].length;
assert.strictEqual(parentOutsideCount, 2, 'os dois lados da gleba-mãe compartilhados parcialmente com a filha devem ir para fora');
assert.strictEqual(parentInsideCount, 1, 'lado exclusivo da gleba-mãe deve continuar dentro dela');
assert.strictEqual(childInsideCount, 4, 'cotas da gleba-filha devem permanecer dentro dela');
const parentLabelCount = parentOutsideCount + parentInsideCount;
assert.strictEqual(parentLabelCount, 3, 'segmento da gleba-mãe idêntico ao perímetro principal deve ser suprimido uma única vez');

console.log('PASS: runtime hierárquico confirma pai fora, filha dentro e supressão de duplicata do perímetro.');
