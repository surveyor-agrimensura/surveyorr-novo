const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/mapa/app.js'), 'utf8');
const mapa = fs.readFileSync(path.join(root, 'mapa/index.html'), 'utf8');
function ok(value, message) { if (!value) { console.error('FAIL:', message); process.exit(1); } console.log('OK:', message); }
ok(app.includes('function registryPolygonContainsLatLng'), 'há verificação geométrica estrita do ponto clicado');
ok(app.includes('turf.booleanPointInPolygon(point, feature, { ignoreBoundary: false }) === true'), 'seleção usa point-in-polygon real, sem tolerância espacial');
const chooser = app.slice(app.indexOf('function chooseRegistryFeatureAt'), app.indexOf('// Retorna somente a feição de Limites de Propriedade'));
ok(chooser.includes('return null;'), 'quando nenhum polígono contém o clique, não há resultado');
ok(!chooser.includes('return features[0]'), 'não existe fallback para o primeiro imóvel vizinho');
ok(!app.includes('.sort((a, b) => a.distance - b.distance);\n      const selected = sorted[0]?.feature;'), 'fallback CAR não escolhe imóvel pelo centróide mais próximo');
ok(app.includes('CAR não usa GetFeatureInfo WMS como fallback de seleção'), 'CAR evita GetFeatureInfo WMS tolerante como seletor cadastral');
ok(app.includes("const hasRegisteredProperty = carFound || sigefFound"), 'ponto sem polígono não vira imóvel vizinho; só ganha cadastro se CAR/SIGEF oficial responder no ponto');
ok(app.includes("coordinatesOnly: !hasRegisteredProperty"), 'clique estritamente vazio permanece apenas como consulta de coordenadas');
ok((app.match(/if \(!registryPolygonContainsLatLng\(/g) || []).length >= 2, 'cliques vetoriais também são validados pela geometria real');
ok(/app-v21\.9\.0\.js\?v=[^\"']+/.test(mapa), 'Mapa usa cache-bust versionado para o runtime fundiário atual');
console.log('PASS: clique em Limites de Propriedade é estrito; imóvel vizinho não pode vazar para ponto vazio.');
