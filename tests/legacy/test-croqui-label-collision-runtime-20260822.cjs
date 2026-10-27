const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const js = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const start = js.indexOf('  function croquiVertexMarks(');
const end = js.indexOf('\n\n\n  function smartConfrontanteLabels', start);
assert(start >= 0 && end > start, 'Função croquiVertexMarks deve existir.');
const source = js.slice(start, end);

const coords = [];
for (let i = 0; i < 8; i += 1) coords.push([200 + i * 6, 30 + i * 2]);
for (let i = 0; i < 10; i += 1) coords.push([250 + i * 0.9, 48 + i * 4.2]);
coords.push([245, 130], [200, 160], [120, 170], [60, 120], [50, 60], [120, 25]);
coords.push(coords[0]);

const reserved = [{ x1: 235, y1: 78, x2: 295, y2: 94 }];
const context = {
  coords,
  reserved,
  result: null,
  escape: (value) => String(value).replace(/[&<>"']/g, '')
};
vm.createContext(context);
vm.runInContext(`${source}\nresult = croquiVertexMarks(coords, c => c, {x:0,y:0,w:320,h:200}, {fontSize:7,offset:12,maxDistance:60,emergencyDistance:110,clearGap:2.5,edgePadding:5,reservedRects:reserved});`, context);

const re = /<g class="sv-inline-label sv-vertex-label"[^>]*><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g;
const boxes = [];
let match;
while ((match = re.exec(context.result))) {
  boxes.push({
    x1: Number(match[1]),
    y1: Number(match[2]),
    x2: Number(match[1]) + Number(match[3]),
    y2: Number(match[2]) + Number(match[4])
  });
}

assert.equal(boxes.length, coords.length - 1, 'Todos os vértices devem receber balão.');
const overlaps = (a, b, gap = 2.5) => !(a.x2 + gap < b.x1 || a.x1 - gap > b.x2 || a.y2 + gap < b.y1 || a.y1 - gap > b.y2);
for (let i = 0; i < boxes.length; i += 1) {
  assert(!overlaps(boxes[i], reserved[0]), `Balão ${i + 1} não deve cobrir nome/confrontante reservado.`);
  for (let j = i + 1; j < boxes.length; j += 1) {
    assert(!overlaps(boxes[i], boxes[j]), `Balões ${i + 1} e ${j + 1} não devem se sobrepor.`);
  }
}

console.log(`OK: ${boxes.length} balões em grupo denso, zero sobreposições.`);
