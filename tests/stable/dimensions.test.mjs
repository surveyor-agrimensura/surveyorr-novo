import fs from 'node:fs';
import assert from 'node:assert/strict';
const src=fs.readFileSync('assets/js/features/mapas/dimensions.js','utf8');
for(const needle of ['function resolveDimensionGlebaFeatures','resolveGlebaFeatures(projectData, rootFeature)','glebaHierarchyDepth(b, features) - glebaHierarchyDepth(a, features)','return area(a) - area(b)','containerCoords: closed','seenSegments','occupiedLabels','chooseCollisionFreeDimensionAnchor',"placement: 'inside'",'data-owner=']) assert.ok(src.includes(needle),`módulo de cotas sem regra: ${needle}`);
assert.ok(!src.includes('resolveLeafGlebaFeatures(projectData, rootFeature)'), 'renderização não deve suprimir automaticamente a gleba-mãe');
console.log('PASS dimensions: cotas hierárquicas preservadas no módulo dedicado.');
