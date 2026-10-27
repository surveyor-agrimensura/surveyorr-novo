const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const js = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
assert(js.includes('data-label-style=\"technical\"'), 'Planta deve usar o estilo compacto da prancha técnica.');
assert(js.includes('leaderThreshold'), 'Linhas-guia devem aparecer apenas quando o rótulo precisar ser afastado.');
assert(js.includes('efeito de fila/escadinha'), 'Layout deve priorizar fila/escadinha ao longo da tangente.');
assert(js.includes("angleCandidates = [0, 9, -9, 18, -18, 28, -28, 40, -40]"), 'Primeira busca deve permanecer próxima da normal externa.');
assert(js.includes("pointFill: '#dc2626'"), 'Vértices da planta devem usar vermelho técnico.');

const start = js.indexOf('  function croquiVertexMarks(');
const end = js.indexOf('\n\n\n  function smartConfrontanteLabels', start);
assert(start >= 0 && end > start, 'Função croquiVertexMarks deve existir.');
const source = js.slice(start, end);

// Simula uma lateral quase vertical com seis vértices muito próximos, como V-01..V-06.
const coords = [
  [80, 30], [120, 50], [121, 58], [120.5, 65], [121.5, 72], [123, 80],
  [105, 120], [70, 145], [40, 115], [32, 70], [45, 40], [80, 30]
];
const reserved = [{ x1: 126, y1: 66, x2: 168, y2: 80 }];
const context = { escape: (value) => String(value), result: null };
vm.createContext(context);
vm.runInContext(`${source}\nresult = croquiVertexMarks(${JSON.stringify(coords)}, c => c, {x:0,y:0,w:190,h:170}, {fontSize:5.1,offset:10.8,maxDistance:48,emergencyDistance:96,leaderThreshold:18,pointRadius:2.25,pointFill:'#dc2626',clearGap:1.8,edgePadding:5,paddingX:1.55,paddingY:0.68,reservedRects:${JSON.stringify(reserved)}});`, context);

const re = /<g class="sv-inline-label sv-vertex-label"[^>]*data-label-style="technical"[^>]*><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g;
const boxes = [];
let m;
while ((m = re.exec(context.result))) boxes.push({x1:+m[1],y1:+m[2],x2:+m[1]+ +m[3],y2:+m[2]+ +m[4]});
assert.equal(boxes.length, coords.length - 1, 'Todos os vértices devem receber rótulo compacto.');
const denseRe = /data-vertex="(V-0[2-6])"[^>]*><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g;
const dense = [];
while ((m = denseRe.exec(context.result))) dense.push({id:m[1], x:+m[2], y:+m[3], w:+m[4], h:+m[5]});
assert.equal(dense.length, 5, 'Grupo V-02..V-06 deve ser detectado no cenário denso.');
const orderedDense = dense.slice().sort((a,b) => Number(a.id.slice(2)) - Number(b.id.slice(2)));
for (let i=1;i<orderedDense.length;i++) assert(orderedDense[i].y > orderedDense[i-1].y, 'Grupo denso deve permanecer em fila ordenada como na Prancha Técnica.');
const xs = orderedDense.map(item => item.x);
assert(Math.max(...xs) - Math.min(...xs) < 16, 'Grupo denso deve permanecer aproximadamente alinhado no mesmo lado da divisa.');
const overlaps = (a,b,gap=1.8) => !(a.x2 + gap < b.x1 || a.x1 - gap > b.x2 || a.y2 + gap < b.y1 || a.y1 - gap > b.y2);
for (let i=0;i<boxes.length;i++) {
  assert(!overlaps(boxes[i], reserved[0]), `Rótulo ${i+1} não deve cobrir confrontante.`);
  for (let j=i+1;j<boxes.length;j++) assert(!overlaps(boxes[i], boxes[j]), `Rótulos ${i+1}/${j+1} não devem se sobrepor.`);
}
console.log(`OK: ${boxes.length} rótulos compactos no padrão da Prancha Técnica, sem sobreposição.`);
