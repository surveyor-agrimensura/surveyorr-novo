import fs from 'node:fs';
import assert from 'node:assert/strict';

const confrontantes=fs.readFileSync('assets/js/features/mapas/confrontantes.js','utf8');
const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const pdf=fs.readFileSync('assets/js/core/pdf-preview.js','utf8');
const bridge=fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const mapas=fs.readFileSync('assets/js/features/mapas/app.js','utf8');

assert.doesNotMatch(confrontantes,/sv-confrontante-hitbox[^>]*fill="#(?:fff|ffffff)"[^>]*fill-opacity="0"/i,'Hitbox do confrontante não pode carregar preenchimento branco transparente para a saída documental.');
assert.match(confrontantes,/sv-confrontante-hitbox[^>]*fill="none"/,'Hitbox do confrontante deve nascer sem tinta.');
assert.match(editor,/hit\.setAttribute\('fill','none'\); hit\.setAttribute\('stroke','none'\); hit\.setAttribute\('pointer-events','all'\);/,'Hitbox criado no editor deve permanecer clicável sem preenchimento imprimível.');
assert.doesNotMatch(bridge,/sv-area-name-hitbox[^>]*fill="#fff"[^>]*fill-opacity="0"/,'Hitbox de nome no mapa também deve ficar livre do mesmo artefato no PDF.');
assert.doesNotMatch(mapas,/sv-area-name-hitbox[^>]*fill="#fff"[^>]*fill-opacity="0"/,'Renderer de Mapas não deve reintroduzir hitbox branca transparente.');
assert.match(pdf,/function stripNonPrintableSvgUi\(svg\)/,'Exportador PDF deve possuir sanitização central das geometrias de interação.');
assert.match(pdf,/\.sv-confrontante-hitbox,\.sv-area-name-hitbox,\.sv-editor-guide-hitbox,\.sv-editor-guide-handle,\.sv-confrontante-editor-anchor/,'Sanitização deve retirar hitboxes e alças do editor antes do svg2pdf.');
assert.match(pdf,/stripNonPrintableSvgUi\(svg\);[\s\S]*normalizeVectorSvgTypography\(svg\);/,'Limpeza deve ocorrer antes da conversão vetorial do PDF.');

console.log('PASS V255: hitboxes de edição não entram como fundo branco nos rótulos do PDF.');
