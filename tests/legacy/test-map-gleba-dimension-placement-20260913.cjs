const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

const srcPath = path.join(__dirname, '..', '..', 'assets', 'js', 'features', 'mapas', 'app.js');
const src = fs.readFileSync(srcPath, 'utf8');
const start = src.indexOf('  function ensureClosedRing(coords) {');
const end = src.indexOf('\n\n  const confrontantePalette', start);
assert.ok(start >= 0 && end > start, 'helpers de cotas não encontrados');
const helpers = src.slice(start, end);

const context = {
  Math,
  Number,
  String,
  console,
  escape: (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
  num: (value, digits = 2) => Number(value || 0).toFixed(digits).replace('.', ','),
  hav: (a, b) => Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1])),
};
vm.createContext(context);
vm.runInContext(`${helpers}\nglobalThis.__cad = { cadDimensionLabels, pointInProjectedRing, projectRingPoints };`, context);
const { cadDimensionLabels, pointInProjectedRing, projectRingPoints } = context.__cad;

function anchors(svg) {
  return [...svg.matchAll(/<text\b[^>]*class="sv-cad-dimension[^\"]*"[^>]*>/g)].map((match) => {
    const tag = match[0];
    const x = /\bx="([\d.-]+)"/.exec(tag)?.[1];
    const y = /\by="([\d.-]+)"/.exec(tag)?.[1];
    return { x: Number(x), y: Number(y) };
  }).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

// Polígono côncavo proposital: a lógica baseada somente em centro/normal falhava aqui.
const concave = [[0,0],[120,0],[120,100],[70,100],[70,45],[0,45],[0,0]];
const project = ([x,y]) => [x,y];
const ringPoints = projectRingPoints(concave, project);
const mapBox = { x: 0, y: 0, w: 120, h: 100 };

const insideSvg = cadDimensionLabels(concave, project, mapBox, {
  placement: 'inside',
  containerCoords: concave,
  offset: 8,
  fontSize: 6,
});
const insideAnchors = anchors(insideSvg);
assert.strictEqual(insideAnchors.length, concave.length - 1, 'quantidade inesperada de cotas internas');
insideAnchors.forEach((point, index) => {
  assert.ok(pointInProjectedRing(point, ringPoints), `cota interna ${index + 1} caiu fora do polígono em ${JSON.stringify(point)}`);
});

const outsideSvg = cadDimensionLabels(concave, project, mapBox, {
  placement: 'outside',
  containerCoords: concave,
  offset: 8,
  fontSize: 6,
});
const outsideAnchors = anchors(outsideSvg);
assert.strictEqual(outsideAnchors.length, concave.length - 1, 'quantidade inesperada de cotas externas');
outsideAnchors.forEach((point, index) => {
  assert.ok(!pointInProjectedRing(point, ringPoints), `cota externa ${index + 1} caiu dentro do polígono em ${JSON.stringify(point)}`);
});

assert.match(src, /containerCoords:\s*closed/, 'cotas da gleba devem usar o próprio polígono da gleba como referência');
assert.match(src, /placement:\s*'inside'/, 'cotas da gleba precisam forçar posicionamento interno');
assert.match(src, /placement:\s*'outside',\s*containerCoords:\s*coords/, 'cotas do perímetro precisam forçar posicionamento externo');

console.log('PASS: cotas de gleba ficam dentro e cotas do perímetro ficam fora, inclusive em polígono côncavo.');
