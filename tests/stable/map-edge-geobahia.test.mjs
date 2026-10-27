import fs from 'node:fs';
import assert from 'node:assert/strict';
const app=fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const auth=fs.readFileSync('assets/js/core/auth.js','utf8');
const api=fs.readFileSync('functions/surveyor-api/src/main.js','utf8');

assert.ok(app.includes('function moveDirectEditLatLngInPlace(target, next)'),'arraste de aresta deve mover LatLngs preservando referências do Leaflet.Draw');
assert.ok(app.includes('const movedA = moveDirectEditLatLngInPlace(state.ring[state.indexA], nextA)'),'primeiro extremo da aresta deve ser mutado em lugar');
assert.ok(app.includes('const movedB = moveDirectEditLatLngInPlace(state.ring[state.indexB], nextB)'),'segundo extremo da aresta deve ser mutado em lugar');
assert.ok(!app.includes('state.ring[state.indexA] = nextA;'),'arraste não pode substituir o objeto LatLng e deixar handles órfãos');
assert.ok(app.includes('function syncDirectEditMarkerNeighborhood(marker)'),'editor deve sincronizar os pontos intermediários vizinhos');
assert.ok(app.includes('marker._middleLeft?.setLatLng'),'midpoint esquerdo deve acompanhar o vértice movido');
assert.ok(app.includes('marker._middleRight?.setLatLng'),'midpoint direito deve acompanhar o vértice movido');
assert.ok(app.includes('syncDirectEditMarkerNeighborhood(state.markerA);') && app.includes('syncDirectEditMarkerNeighborhood(state.markerB);'),'ambos os extremos devem atualizar seus midpoints');

assert.ok(app.includes("GEOBAHIA_BOUNDARY_UI_COLOR = '#D0D000'"),'controle interno deve manter a referência amarela do limite oficial');
assert.ok(app.includes('GEOBAHIA_BOUNDARY_UI_WEIGHT = 1.0'),'fallback vetorial deve manter espessura fina');
assert.ok(app.includes("const boundaryStyleMode = 'official'"),'CEFIR/INEMA deve usar somente simbologia oficial');
assert.ok(app.includes('clientRasterRecolor: false'),'GeoBahia deve renderizar o raster oficial sem recoloração do navegador');
assert.ok(app.includes("dashArray: '4 3'"),'fallback vetorial deve usar traço serrilhado fino');
assert.ok(app.includes('GEOBAHIA_BOUNDARY_STYLE_REVISION = 3'),'preferências antigas de cor/espessura devem ser migradas para o padrão oficial');
assert.ok(app.includes('showColor: false') && app.includes('showWeight: false'),'camadas oficiais do catálogo devem expor somente transparência');
assert.ok(app.includes('updateWhenZooming: false'),'WMS cadastral deve preservar tiles durante a animação de zoom');
assert.ok(app.includes('keepBuffer: propertyBoundary ? 5 : 6'),'WMS cadastral deve manter buffer maior para reduzir sumiços no pan/zoom');
assert.ok(app.includes('this.__georuralUsesClientBoundaryStyle'),'redraw deve ocorrer apenas quando existe estilo raster local');
assert.ok(app.includes('if (needsRedraw) tileLayer.redraw?.();'),'alterar somente opacidade não deve recarregar tiles WMS');
assert.ok(auth.includes('styleMode') && api.includes('styleMode'),'compatibilidade dos metadados de estilo deve permanecer no contrato');

console.log('PASS map-edge-geobahia: aresta mantém handles sincronizados e limite oficial usa WMS nativo estável, somente com controle de opacidade.');
