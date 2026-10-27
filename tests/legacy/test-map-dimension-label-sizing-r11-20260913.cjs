const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

const srcPath = path.join(__dirname, '..', '..', 'assets', 'js', 'features', 'mapas', 'app.js');
const src = fs.readFileSync(srcPath, 'utf8');

assert.match(src, /cadDimensionLabels\(coords, project, mapBox, \{ fontSize: 3\.00, minFontSize: 2\.15, offset: 7\.8, placement: 'outside'/, 'cotas do perímetro principal devem usar afastamento técnico entre vértices');
assert.match(src, /glebaDimensionLabels\(p, feature, project, mapBox, \{ fontSize: 2\.55, minFontSize: 1\.90, offset: 5\.2, placement: 'inside'/, 'cotas internas das glebas devem manter escala compacta');
assert.match(src, /glebaDimensionLabels\(p, feature, planProject, planBox, \{ fontSize: 2\.45, minFontSize: 1\.82, offset: 4\.9, placement: 'inside'/, 'cotas da prancha vertical devem ser compactas');
assert.match(src, /cadDimensionLabels\(coords, planProject, planBox, \{ fontSize: 2\.95, minFontSize: 2\.10, offset: 7\.4, placement: 'outside'/, 'cotas externas da prancha vertical devem usar linha de dimensão');
assert.match(src, /sv-cad-dimension-witness/, 'cotas devem ter linhas auxiliares saindo dos vértices');
assert.match(src, /sv-cad-dimension-line/, 'cotas devem ter linha paralela entre os vértices');
assert.match(src, /sv-cad-dimension-tick/, 'cotas devem ter terminais técnicos');
assert.match(src, /Math\.max\(fontSize \* 1\.42, 3\.65\)/, 'caixa de colisão deve acompanhar a escala da fonte');

const start = src.indexOf('  function ensureClosedRing(coords) {');
const end = src.indexOf('\n\n  const confrontantePalette', start);
assert.ok(start >= 0 && end > start, 'helpers de cotas não encontrados');
const helpers = src.slice(start, end);
const context = {
  Math, Number, String, console,
  escape: (value) => String(value ?? ''),
  num: (value, digits = 2) => Number(value || 0).toFixed(digits).replace('.', ','),
  hav: (a, b) => Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1])),
};
vm.createContext(context);
vm.runInContext(`${helpers}\nglobalThis.__cad = { cadDimensionLabels };`, context);
const svg = context.__cad.cadDimensionLabels([[0,0],[100,0],[100,100],[0,100],[0,0]], ([x,y]) => [x,y], {x:0,y:0,w:100,h:100}, { fontSize: 4, placement:'inside', containerCoords:[[0,0],[100,0],[100,100],[0,100],[0,0]] });
assert.match(svg, /font-size="4\.00"/, 'fonte solicitada deve ser preservada no SVG');
assert.match(svg, /sv-cad-dimension-witness/, 'SVG deve conter linhas auxiliares de cota');
assert.doesNotMatch(svg, /stroke-width="2\.6"/, 'halo antigo e grosso não deve permanecer');

console.log('PASS: R26.3.41 usa cotas técnicas entre vértices com linhas auxiliares e colisão proporcional.');
