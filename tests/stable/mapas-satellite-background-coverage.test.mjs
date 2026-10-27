import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.match(app,/function arcgisMaxUsefulZoom\(kind\)[\s\S]*if \(isGoogleBackground\(kind\)\) return 20;/,'Base de satélite da RC185.51 permite zoom superior ao mosaico antigo.');
assert.match(app,/kind === 'satClarity' \|\| kind === 'satWayback2023'[\s\S]*return 18;/,'Fontes históricas devem manter seu teto de LOD.');
assert.match(app,/function arcgisRasterLooksUnavailable\(image\)[\s\S]*placeholderGray\/visible>=0\.62/,'Tile cinza Map data not yet available deve ser detectado antes de entrar na prancha.');
assert.match(app,/async function arcgisTileBackgroundDataUrl[\s\S]*while \(zoom >= minZoom\)[\s\S]*zoom -= 1;/,'Mosaico deve recuar automaticamente de nível quando a cobertura do LOD atual não estiver disponível.');
assert.match(app,/const satellite = isGoogleBackground\(kind\) \|\| kind === 'satClarity' \|\| kind === 'satWayback2023';[\s\S]*if \(satellite\) \{[\s\S]*arcgisTileBackgroundDataUrl[\s\S]*rejectArcgisUnavailable:true/,'Satélite deve passar pelo fluxo de raster de tiles antes da exportação.');
assert.match(app,/function arcgisSafeExportSize\(kind, bounds, width, height, zoomHint = 15, pixelRatio = 1\)/,'Export raster deve limitar a resolução ao LOD realmente publicado.');
assert.doesNotMatch(app,/if \(options\.preferDirectUrl === true\) return String\(rawUrls\[0\] \|\| ''\);[\s\S]*const satellite/,'Satélite não pode escapar para URL direta antes da validação.');

console.log('PASS mapas-satellite-background-coverage: satélite rejeita placeholders, limita LOD e recua automaticamente.');
