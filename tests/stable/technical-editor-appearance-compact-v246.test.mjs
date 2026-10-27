import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(app,/function mountCompactAppearancePanel\(modal\)/,'Aparência deve possuir montagem compacta única.');
assert.doesNotMatch(app,/makeToggleCard\(polygonFill,'Preenchimento dos polígonos','polygonFill'\)/,'Controle global de preenchimento não deve voltar para a aba Aparência.');
assert.match(app,/makeToggleCard\(coordinateTable,'Tabela técnica de coordenadas','coordinateTable'\)/,'Tabela técnica deve virar cartão de ativação.');
assert.doesNotMatch(app,/data-global-polygon-opacity|data-global-polygon-color/,'Aparência não deve manter controles globais duplicados do polígono.');
assert.match(app,/mountCompactAppearancePanel\(modal\);[\s\S]*mergeConfrontantesIntoVertices\(modal\)/,'Layout de Aparência deve ser aplicado na mesma consolidação do editor inline.');

assert.match(editor,/sv-editor-polygon-style-card\$\{style\.fill\?' is-active':''\}/,'Polígono individual deve refletir o estado ativo no próprio card.');
assert.match(editor,/sv-editor-polygon-style-toggle[\s\S]*data-polygon-fill/,'Título do polígono deve ser o acionador do preenchimento individual.');
assert.match(editor,/sv-editor-polygon-style-controls[\s\S]*data-polygon-opacity[\s\S]*data-polygon-color/,'Polígono deve concentrar opacidade e cor no mesmo card.');
assert.match(editor,/card\.classList\.toggle\('is-active',documentSettings\.polygonStyles\[id\]\.fill!==false\)/,'Estado visual do card do polígono deve acompanhar o preenchimento real.');

assert.match(css,/\.sv-editor-element-controls\{[\s\S]*grid-template-columns:minmax\(0,1fr\) 70px;[\s\S]*align-items:end/,'Controles de elementos devem manter duas colunas estáveis e alinhadas.');
assert.match(css,/\.sv-editor-element-controls label>span\{[\s\S]*white-space:nowrap/,'Rótulos Tamanho/Cor não podem quebrar verticalmente.');
assert.match(css,/\.sv-editor-element-color-control\{[\s\S]*height:32px[\s\S]*border:1px solid #cbd8e8/,'Seletor de cor deve usar controle composto, estável e alinhado.');
assert.match(css,/\.sv-editor-appearance-card\.is-active \.sv-editor-appearance-toggle\{[\s\S]*background:#0f63e9;[\s\S]*color:#fff/,'Cartão ativo da Aparência deve ficar azul.');
assert.match(css,/\.sv-editor-polygon-style-card\.is-active \.sv-editor-polygon-style-toggle span\{[\s\S]*background:#0f63e9;[\s\S]*color:#fff/,'Polígono ativo deve seguir o mesmo padrão visual azul.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V246: ferramentas compactas alinhadas e Aparência usa cartões ativos com opacidade/cor consolidadas.');
