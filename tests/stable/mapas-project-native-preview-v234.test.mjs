import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(app,/function installMapasNativeProjectPreviewGuard\(\)/,'Mapas/Croquis deve proteger a etapa Projeto contra retorno do visualizador PDF.');
assert.match(app,/legacyViewer = previewHost\.querySelector\('iframe,embed,object,\.surveyor-pdf-preview-shell,\.surveyor-pdf-native-wrap,\.pdfViewer'\)/,'A proteção deve detectar visualizadores PDF legados.');
assert.match(app,/Promise\.resolve\(renderMapPreviewSvg\(lastSvg\)\)/,'Qualquer visualizador intermediário deve ser substituído pelo SVG técnico vivo.');
assert.match(app,/window\.SurveyorMapasLivePreviewSvg = markup/,'A cena vetorial atual deve ficar disponível como prévia oficial de Mapas/Croquis.');
assert.match(css,/body\[data-page="mapas\.html"\][\s\S]*#mapPreview\.is-live-svg-preview[\s\S]*place-items:center/,'A etapa Projeto deve centralizar a prancha vetorial como na Personalização.');
assert.match(css,/#mapPreview\.is-live-svg-preview>svg[\s\S]*background:#fff[\s\S]*box-shadow:/,'A prévia vetorial deve manter folha branca e apresentação técnica, sem viewer escuro.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS Mapas/Croquis: Projeto usa a cena SVG nativa, sem visualizador PDF intermediário.');
