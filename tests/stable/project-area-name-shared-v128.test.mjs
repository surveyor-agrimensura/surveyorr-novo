import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js', 'utf8');

assert.match(editor, /function geometryFrameFromOverlay\(\)/, 'Editor deve resolver um quadro geométrico independente do quadro da folha.');
assert.match(editor, /dataset\.geomX[\s\S]*?dataset\.geomW/, 'Editor deve priorizar os metadados do quadro geométrico emitidos pelo gerador.');
assert.match(bridge, /coordinateSpace: geometrySpace \? 'geometry-v1' : ''[\s\S]*?xG: Number\.isFinite\(xG\) \? xG : null[\s\S]*?yG: Number\.isFinite\(yG\) \? yG : null/, 'Normalizador oficial deve preservar coordenadas normalizadas pela geometria do imóvel.');
assert.match(editor, /function promoteAreaNamesToGeometrySpace\(\)[\s\S]*?coordinateSpace:'geometry-v1'[\s\S]*?xG:\(px-geom\.x\)\/geom\.w[\s\S]*?yG:\(py-geom\.y\)\/geom\.h/, 'Ao salvar, nomes legados devem ser promovidos para geometry-v1 usando a posição visual corrente.');
assert.match(editor, /syncVisualStateFromOverlay\(\);\s*promoteAreaNamesToGeometrySpace\(\);\s*promoteTechnicalLinesToGeometrySpace\(\);\s*const localSegments/, 'Promoções de nomes e linhas técnicas devem acontecer na mesma transação de salvamento do estado visual do projeto.');
assert.match(editor, /drag\.item\.coordinateSpace='geometry-v1';[\s\S]*?drag\.item\.xG=\(x-drag\.geom\.x\)\/drag\.geom\.w;[\s\S]*?drag\.item\.yG=\(y-drag\.geom\.y\)\/drag\.geom\.h;/, 'Arrastar um nome deve gravar imediatamente sua posição no referencial do imóvel.');

assert.match(mapas, /function projectedFeatureBounds\(feature, project, fallbackBox = null\)/, 'Gerador deve calcular o quadro projetado real do perímetro.');
assert.ok(mapas.includes('data-geom-x="${geomBox.x.toFixed(4)}"') && mapas.includes('data-geom-w="${geomBox.w.toFixed(4)}"'), 'SVG deve transportar o quadro geométrico para o editor compartilhado.');
assert.match(mapas, /geometrySpace=item\.coordinateSpace==='geometry-v1'[\s\S]*?x=geometrySpace\?geomBox\.x\+item\.xG\*geomBox\.w:[\s\S]*?y=geometrySpace\?geomBox\.y\+item\.yG\*geomBox\.h:/, 'Prancha e Croqui devem reconstruir o nome pela geometria do imóvel quando geometry-v1 estiver disponível.');
assert.match(mapas, /Number\.isFinite\(item\.x\)\?mapBox\.x\+item\.x\*mapBox\.w/, 'Layout legado de nomes deve continuar legível até o próximo salvamento.');

console.log('PASS V128 nomes por projeto: posições manuais usam geometry-v1 entre Prancha Técnica e Mapas/Croquis, com migração legada no salvamento.');
