
// V50 performance: JSON cadastral sem geometria deve usar lote grande para reduzir round-trips.
const mapAppFast = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
assert.ok(mapAppFast.includes('pageSize: 5000'), 'Pesquisa rápida local deve baixar até 5.000 imóveis JSON por lote.');
assert.ok(mapAppFast.includes("Math.min(5000, Number(pageSize) || 1000)"), 'WFS local deve preservar teto de 5.000 registros por requisição.');
