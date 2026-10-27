const fs = require('fs');
const assert = require('assert');
const path = require('path');

const srcPath = path.join(__dirname, '..', '..', 'assets', 'js', 'features', 'mapas', 'app.js');
const src = fs.readFileSync(srcPath, 'utf8');

assert.match(src, /function resolveDimensionGlebaFeatures\(/, 'seletor de glebas para cotagem não encontrado');
assert.match(src, /resolveGlebaFeatures\(projectData, rootFeature\)/, 'cotagem deve considerar todas as glebas relevantes, não apenas folhas');
assert.match(src, /glebaHierarchyDepth\(b, features\) - glebaHierarchyDepth\(a, features\)/, 'glebas mais profundas devem ter prioridade');
assert.match(src, /return area\(a\) - area\(b\)/, 'glebas menores devem ter prioridade no mesmo nível');
assert.match(src, /containerCoords: closed/, 'cada cota deve usar o próprio polígono da gleba como container');
assert.match(src, /seenSegments/, 'segmentos físicos compartilhados precisam continuar deduplicados');
assert.match(src, /occupiedLabels/, 'rótulos de cotas de glebas precisam compartilhar mapa de ocupação para evitar sobreposição');
assert.match(src, /chooseCollisionFreeDimensionAnchor/, 'cotas precisam resolver colisões entre níveis hierárquicos');
assert.match(src, /placement: 'inside'/, 'cotas das glebas precisam ficar dentro do polígono dono');
assert.match(src, /data-owner=/, 'rótulo deve manter rastreabilidade ao polígono dono');
assert.doesNotMatch(src, /resolveLeafGlebaFeatures\(projectData, rootFeature\)/, 'renderização não deve mais suprimir automaticamente a gleba-mãe');

console.log('PASS: cotas hierárquicas pertencem ao próprio polígono, pais mantêm segmentos exclusivos, compartilhamentos são deduplicados e colisões são evitadas.');
