import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(app,/mapPanel\.className = 'sv-editor-tool-panel sv-editor-map-panel'/,'Mapa deve possuir painel canônico próprio para scroll.');
assert.match(app,/mapPanel\.dataset\.mapConsolidated = '1'/,'Consolidação do painel Mapa deve ser idempotente.');
assert.match(app,/if \(!modal\.querySelector\('\[data-tool-panel="map"\]'\)\) mountPranchaBetaSourceTool\(modal,'elements','Elementos'\)/,'Elementos não deve ser recriado após o Mapa já estar consolidado.');
assert.match(app,/documentMapToolOrder\(\)\.forEach\(\(tool\) => rail\.querySelector\(`\[data-editor-tool="\$\{tool\}"\]`\)\?\.remove\(\)\)/,'Ferramentas internas do Mapa devem ser removidas fisicamente da barra superior conforme o documento ativo.');
assert.match(app,/function mountCompactElementCards\(modal\)/,'Elementos deve ser convertido para cartões compactos no painel Mapa.');
assert.match(app,/data-element-visual-key="\$\{meta\.key\}"/,'Cada cartão de elemento deve concentrar tamanho e cor.');
assert.match(app,/function removeLegacyDimensionPanel\(modal\)/,'Editar cotas isolado deve ser removido porque Cotas já concentra os controles.');
assert.match(css,/\.sv-editor-tool-rail>\.sv-editor-tool-button\[hidden\]\{display:none;\}/,'Botões semanticamente ocultos não podem reaparecer por regra display:flex.');
assert.match(css,/\.sv-editor-map-panel[\s\S]*flex:1 1 0;[\s\S]*height:0;[\s\S]*overflow-y:(?:auto|scroll);[\s\S]*overflow-x:hidden;[\s\S]*scrollbar-gutter:stable/,'Mapa deve rolar verticalmente dentro da coluna esquerda, sem scroll horizontal.');
assert.match(css,/\.sv-editor-map-panel::-webkit-scrollbar[\s\S]*width:(?:9|10|11)px;/,'Scrollbar do painel Mapa deve permanecer visível na borda direita.');
assert.doesNotMatch(css,/sv-editor-map-subnav/,'Subnavegação antiga do Mapa não deve permanecer no CSS.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve continuar sem !important.');

console.log('PASS V220: painel Mapa com scroll próprio, elementos compactos e sem Editar cotas duplicado.');
