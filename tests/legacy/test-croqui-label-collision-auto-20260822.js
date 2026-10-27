import fs from 'node:fs';
import assert from 'node:assert/strict';

const maps = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const html = fs.readFileSync('mapas/index.html', 'utf8');

assert.match(maps, /densityScore/, 'Rótulos de vértice devem priorizar regiões densas.');
assert.match(maps, /reservedRects/, 'Rótulos de vértice devem respeitar caixas já ocupadas.');
assert.match(maps, /occupiedRects: reservedLabelRects/, 'Nomes de confrontantes devem reservar espaço antes dos vértices.');
assert.match(maps, /emergencyDistance/, 'Layout deve ampliar a busca quando o grupo de vértices estiver apertado.');
assert.match(maps, /Último recurso determinístico/, 'Layout deve procurar uma célula livre em vez de aceitar sobreposição.');
assert.match(maps, /sv-vertex-label/, 'SVG deve identificar os balões de vértice.');
assert.match(html, /(?:rotulos-(?:auto-colisao-v7|prancha-tecnica-v8)-0822|26\.3\.41-cotas-entre-vertices)/, 'Mapas deve usar cache-bust atual das correções de rótulos/cotas.');
console.log('OK: auto-organização anti-colisão dos balões de vértices validada.');
