import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Confere apenas o comportamento declarado na fonte RC185.51; este teste
// não valida licença, disponibilidade, CORS nem permissão de impressão dos tiles.
const app = readFileSync('assets/js/features/mapas/app.js', 'utf8');
const html = readFileSync('mapas/index.html', 'utf8');
const getBlock = (start, end) => {
  const a = app.indexOf('  function ' + start + '(');
  const b = app.indexOf('  function ' + end + '(', a + 4) >= 0
    ? app.indexOf('  function ' + end + '(', a + 4)
    : app.indexOf('  async function ' + end + '(', a + 4);
  assert.ok(a >= 0 && b > a, `Funções ${start}/${end} não encontradas`);
  return app.slice(a, b);
};
const source = getBlock('backgroundService', 'backgroundUrls');
const zoom = getBlock('arcgisMaxUsefulZoom', 'arcgisTileZoomForViewport');
const tile = getBlock('backgroundTileUrl', 'arcgisTileBackgroundDataUrl');
const context = vm.createContext({ URLSearchParams });
vm.runInContext(source + '\n' + zoom + '\n' + tile + '\nglobalThis.api = {backgroundTileBaseUrl,backgroundUrl,arcgisMaxUsefulZoom,backgroundTileUrl};', context);
const { api } = context;
assert.equal(api.arcgisMaxUsefulZoom('sat'), 20);
assert.equal(api.arcgisMaxUsefulZoom('satClarity'), 18);
assert.equal(api.backgroundUrl('sat',{minX:-40,minY:-14,maxX:-39,maxY:-13},400,300), '');
assert.equal(api.backgroundTileUrl('sat', 'World_Imagery', 15, 100, 200), 'https://mt1.google.com/vt?lyrs=s&x=200&y=100&z=15');
assert.equal(api.backgroundTileUrl('hybrid', 'World_Imagery', 15, 100, 200), 'https://mt1.google.com/vt?lyrs=y&x=200&y=100&z=15');
assert.match(html, /<option value="sat" selected>Satélite limpo \(mesma base do mapa\)<\/option>/);
assert.match(app, /if \(isGoogleBackground\(kind\)\) return '';\/\/|if \(isGoogleBackground\(kind\)\) return '';/);
console.log('PASS satellite-basemap-settings: mapeamento da base herdada, zoom e configuração; rede/licenças não avaliadas.');
