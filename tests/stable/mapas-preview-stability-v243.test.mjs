import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(app,/function fitMapPreviewSvgToHost\(previewHost = \$\('mapPreview'\)\)/,'Mapas/Croquis deve ajustar a folha ao viewport pelo viewBox real.');
assert.match(app,/const scale = Math\.min\(availableWidth \/ vbWidth, availableHeight \/ vbHeight\);/,'Fit da prévia deve usar simultaneamente largura e altura disponíveis, sem proporção fixa de A4.');
assert.match(app,/function ensureMapPreviewFitObserver\(previewHost = \$\('mapPreview'\)\)/,'Prévia deve acompanhar somente mudanças reais do contêiner.');
assert.match(app,/fitMapPreviewSvgToHost\(previewHost\);[\s\S]*ensureMapPreviewFitObserver\(previewHost\);/,'Renderização SVG deve estabilizar o tamanho antes de aguardar novos resizes.');
assert.doesNotMatch(css,/width:min\(94%,calc\(\(100vh - 250px\) \* 1\.414\)\)/,'Prévia não pode usar proporção A4 fixa para SVGs com viewBox diferente.');
assert.match(css,/body\[data-page="mapas\.html"\][\s\S]*#mapPreview\.is-live-svg-preview\{[\s\S]*overflow:hidden;[\s\S]*contain:layout paint;/,'Viewport de Mapas/Croquis deve impedir realimentação por barras de rolagem.');
assert.match(documents,/document\.documentElement\.classList\.add\('sv-document-workspace-root'\)/,'Workspace documental deve controlar também o overflow do elemento raiz.');
assert.match(css,/html\.sv-document-workspace-root\{[\s\S]*height:100%;[\s\S]*overflow:hidden;/,'Elemento raiz documental deve permanecer sem scrollbar externa oscilante.');

console.log('PASS mapas-preview-stability-v243: prévia vetorial sem ciclo de scrollbar/escala.');
