import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const css = fs.readFileSync('assets/css/core/documents.css', 'utf8').replace(/!important/g,'');

assert.match(editor, /function editableOverlayRoots\(source\)/, 'Editor deve manter uma única raiz visual para elementos editáveis aninhados.');
assert.match(editor, /function freezeSvgTypography\(svg\)/, 'Editor deve congelar os pesos tipográficos do SVG antes de montar a bancada inline.');
assert.match(editor, /node\.setAttribute\('font-weight', weight \|\| '400'\)/, 'Textos e tspans precisam receber peso explícito para não herdar peso da interface HTML.');
assert.match(editor, /freezeSvgTypography\(source\);/, 'A fonte SVG deve ser normalizada antes da separação entre fundo e overlay.');
assert.match(editor, /async function vectorBackground\(svg\)/, 'Fundo vetorial inline deve ser isolado da cascata CSS da aplicação.');
assert.match(editor, /reader\.readAsDataURL\(blob\)/, 'Fundo vetorial deve ser carregado como documento SVG isolado em data URL.');
assert.match(editor, /if \(requestedMode === 'inline'\) raster = await vectorBackground\(parts\.background\);/, 'Modo inline deve usar o fundo SVG isolado, sem inserir o SVG de fundo diretamente no DOM da aplicação.');
assert.match(editor, /<img class="sv-confrontante-editor-background" src="\$\{raster\.dataUrl\}"/, 'Bancada deve exibir o fundo isolado em uma única imagem SVG, com overlay separado.');
assert.doesNotMatch(editor, /inlineVectorBackground/, 'Implementação anterior que inseria o SVG de fundo diretamente no DOM não deve permanecer ativa.');
assert.doesNotMatch(css, /\.sv-confrontante-editor-background-svg\s*\{/, 'CSS da implementação de fundo SVG nativo anterior deve ser removido.');

console.log('PASS technical-editor-inline-typography-isolation: fundo isolado e pesos SVG explícitos impedem negrito artificial na bancada inline.');
