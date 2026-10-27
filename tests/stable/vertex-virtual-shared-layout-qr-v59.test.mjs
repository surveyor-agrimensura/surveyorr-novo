import fs from 'node:fs';
import assert from 'node:assert/strict';

const map = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const vertices = fs.readFileSync('assets/js/features/mapas/vertices.js','utf8');
const docs = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const assets = fs.readFileSync('assets/js/core/document-assets.js','utf8');
const css = fs.readFileSync('assets/css/features/mapa/app.css','utf8').replace(/!important/g,'');

assert.ok(vertices.includes('if (hiddenVertexIndexes.has(point.index)) return;'), 'Vértice virtual deve suprimir ponto e rótulo no documento.');
assert.ok(map.includes("const hiddenVertex = hiddenVertexKeys(selectedLayer).includes(editVertexCoordKey(latlng));"), 'Mapa deve reconhecer vértice virtual na camada de rótulos.');
assert.ok(map.includes("node.style.left = '50%'") && map.includes("node.style.top = '50%'"), 'Escolha de remoção deve abrir centralizada.');
assert.ok(css.includes('visibility:hidden') && css.includes('pointer-events:none'), 'Handle virtual deve desaparecer sem alterar geometria.');
assert.ok(docs.includes('feature?.properties?.confrontanteVisualLayout?.segments'), 'Geração deve priorizar layout compartilhado salvo no projeto.');
assert.ok(docs.includes('readConfrontanteVisualOffsets(p)') && docs.includes('readConfrontanteSegmentOverrides(p)'), 'Prancha e croqui devem usar o mesmo layout por projeto.');
assert.ok(assets.includes('const attempts = Math.max(2, Math.min(3') && assets.includes('fallbackUrl'), 'QR público deve ter retentativa e fallback seguro.');
