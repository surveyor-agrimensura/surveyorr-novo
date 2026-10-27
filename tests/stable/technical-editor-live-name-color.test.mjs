import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(editor,/areaColorControl\?\.addEventListener\('input',[\s\S]*item\.color=normalizeHexColor\(event\.target\.value,[\s\S]*applyAreaNameColorsToOverlay\(\);scheduleNativePublish\(\)/,'Seletor individual deve aplicar a cor diretamente no SVG no mesmo evento input.');
assert.match(editor,/globalAreaNameColorControl\?\.addEventListener\('input',[\s\S]*documentSettings\.areaNameColor=normalizeHexColor\(event\.target\.value,'#111827'\)[\s\S]*applyAreaNameColorsToOverlay\(\);scheduleNativePublish\(\)/,'Cor global deve atualizar imediatamente a cena nativa.');
assert.doesNotMatch(css,/\.sv-confrontante-editor-overlay \.sv-area-name-text\{[\s\S]{0,160}fill:#111827/,'Nenhuma regra CSS pode travar o nome em preto.');
assert.match(bridge,/color: normalizeHexColor\(safe\(item\?\.color\)\.trim\(\), '#111827'\)/,'Persistência deve preservar a cor escolhida sem substituir cores claras.');
assert.match(bridge,/const textColor = normalizeHexColor\(safe\(item\?\.color\)\.trim\(\), normalizeHexColor/,'Renderer deve usar a cor exata do objeto.');
assert.match(editor,/text\.setAttribute\('stroke', contrastHaloColor\(color\)\)/,'Halo deve adaptar contraste sem alterar o fill escolhido.');

console.log('PASS technical-editor-live-name-color: cor de nome reage em tempo real e não é bloqueada por CSS legado.');
