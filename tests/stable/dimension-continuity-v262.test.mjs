import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../../assets/js/features/mapas/dimensions.js');

const dimensions = globalThis.SurveyorDocumentDimensions.create({
  area: () => 1,
  ringOfFeature: () => [],
  hav: (a, b) => Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1])),
  num: (value, digits = 1) => Number(value).toFixed(digits).replace('.', ','),
  escape: (value) => String(value),
  dimensionScaleForKey: () => 1
});

const count = 59;
const coords = [];
for (let i = 0; i < count; i += 1) {
  const angle = (Math.PI * 2 * i) / count;
  let radius = 105 + (Math.sin(angle * 3) * 13) + (Math.cos(angle * 7) * 4);
  // Reproduz uma borda densa com reentrância suave semelhante à homologação.
  if (i >= 31 && i <= 38) radius -= 18 - Math.abs(34.5 - i) * 3;
  coords.push([250 + Math.cos(angle) * radius, 250 + Math.sin(angle) * radius]);
}
coords.push([...coords[0]]);

const svg = dimensions.cadDimensionLabels(
  coords,
  (coord) => [Number(coord[0]), Number(coord[1])],
  { x: 0, y: 0, w: 500, h: 500 },
  {
    ownerId: 'perimeter',
    placement: 'outside',
    lockNormalOffset: true,
    offset: 10,
    outsideExtraOffset: 1.45,
    visualSettings: {},
    fontSize: 4.2,
    minFontSize: 2.2
  }
);

const groups = [...svg.matchAll(/<g class="sv-cad-dimension-group[^>]*data-segment="(\d+)"[^>]*>([\s\S]*?)<\/g>/g)];
assert.equal(groups.length, count, 'Geometria densa deve manter cota em 100% dos segmentos do perímetro.');

const lines = groups.map((match) => {
  const line = match[2].match(/<line class="sv-cad-dimension-line"[^>]*x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/);
  assert.ok(line, `Segmento ${match[1]} deve possuir linha de cota.`);
  return { x1:Number(line[1]), y1:Number(line[2]), x2:Number(line[3]), y2:Number(line[4]) };
});

for (let i = 0; i < lines.length; i += 1) {
  const current = lines[i];
  const next = lines[(i + 1) % lines.length];
  assert.ok(Math.hypot(current.x2 - next.x1, current.y2 - next.y1) <= 0.03, `Cota deve ser contínua entre os segmentos ${i + 1} e ${(i + 2) > count ? 1 : i + 2}.`);
  const vertex = coords[(i + 1) % count];
  assert.ok(Math.hypot(current.x2 - vertex[0], current.y2 - vertex[1]) < 40, `Junção ${i + 1} não pode gerar espícula distante do vértice real.`);
}

console.log('PASS V262: cadeia de cotas densa cobre 100% do perímetro sem lacunas nem espículas.');
