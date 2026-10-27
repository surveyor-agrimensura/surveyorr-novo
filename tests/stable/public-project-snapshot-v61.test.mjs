import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const assets = read('assets/js/core/document-assets.js');
const publicProject = read('assets/js/features/public-project/public-project.js');
const mapas = read('assets/js/features/mapas/app.js');
const memorial = read('assets/js/features/memorial/app.js');
const planialt = read('assets/js/features/planialtimetria/app.js');
const publicHtml = read('public-project/index.html');

assert.ok(assets.includes('function publicSnapshotUrl(project = {})'), 'helper legado de snapshot deve permanecer disponível para compatibilidade');
assert.ok(assets.includes("params.set('snapshot', `v1:${encoded}`)"), 'snapshot deve usar formato versionado');
assert.ok(assets.includes("reason: 'PUBLIC_SNAPSHOT_FALLBACK'"), 'documentos devem usar snapshot do perímetro quando o backend curto não estiver disponível');
assert.ok(assets.includes('publicSnapshotUrl,'), 'helper legado de snapshot deve continuar exportado');
assert.ok(mapas.includes('documentAssets.publicProjectAccess(p, {'), 'Mapas/Pranchas devem fornecer o projeto completo para o fallback');
assert.ok(memorial.includes('publicProjectAccess(p,{qrSize:220})'), 'Memorial deve fornecer o projeto completo para o fallback');
assert.ok(planialt.includes('publicProjectAccess(project, { qrSize: 180 })'), 'Planialtimetria deve fornecer o projeto completo para o fallback');
assert.ok(publicProject.includes("const snapshot=hashParams.get('snapshot')"), 'visualizador público deve aceitar snapshot no hash');
assert.ok(publicProject.includes('function decodeSnapshot(raw)'), 'visualizador público deve reconstruir a geometria do snapshot');
assert.ok(publicProject.includes('renderFeatures([feature]'), 'snapshot deve ser desenhado no mapa público');
assert.match(publicHtml, /\?v=\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/, 'página pública deve carregar assets versionados para invalidar cache');

console.log('PASS V61: snapshot público volta a ser fallback geométrico para o QR, preservando a área completa.');
