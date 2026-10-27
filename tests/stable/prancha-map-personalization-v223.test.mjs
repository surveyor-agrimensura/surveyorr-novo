import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(css,/data-page="pranchas\.html"[^}]*\.sv-doc-module-head\{[\s\S]*width:max-content;[\s\S]*border:0;[\s\S]*background:transparent;/,'Cabeçalho de Pranchas deve ser compacto, sem cartão branco de largura total.');
assert.match(css,/data-page="pranchas\.html"[^}]*\.sv-doc-tabs\{[\s\S]*width:max-content;[\s\S]*border:0;[\s\S]*background:transparent;/,'Projeto/Personalização deve usar navegação compacta sem cartão redundante.');
assert.match(css,/\.sv-editor-vertex-list\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'Vértices devem ser apresentados em grade compacta.');
assert.match(editor,/row\.innerHTML = `<strong>\$\{key\}<\/strong><input type="checkbox"/,'Cada vértice deve exibir apenas identificador e checkbox.');
assert.doesNotMatch(editor,/Adicionar linha automática para este vértice/,'Instrução redundante de linha automática não deve permanecer.');
assert.doesNotMatch(editor,/function upsertVertexGuideLine/,'Implementação antiga de linha externa por vértice deve ser removida.');
assert.doesNotMatch(editor,/data-tool-panel="names"/,'Painel lateral manual de nomes não deve mais existir.');
assert.match(editor,/data-area-name-context-menu/,'Exclusão do nome do imóvel deve ocorrer por menu de contexto no mapa.');
assert.match(editor,/data-area-name-context-delete/,'Menu de contexto deve expor a ação de excluir nome.');
assert.doesNotMatch(editor,/data-selected-edge-controls hidden><strong data-selected-edge-label>Lado selecionado<\/strong><input type="text" data-selected-edge-name/,'Painel de vértice não deve reexibir o campo inline de confrontante.');
assert.doesNotMatch(editor,/data-selected-edge-controls hidden>[\s\S]*data-selected-edge-distance value="3"/,'Painel de vértice não deve reexibir o ajuste inline de distância do confrontante.');
assert.doesNotMatch(editor,/data-selected-edge-highlight/,'Seleção do vértice não deve pintar o lado do perímetro de vermelho.');
assert.match(editor,/function toggleVertexAutoLine\(key = '', enabled = true\)/,'Checkbox de vértice deve controlar uma linha automática real pela fonte única technicalLines.');
assert.match(editor,/vertex-auto-line-/,'Linhas automáticas de vértice devem possuir identidade persistente própria.');
assert.match(editor,/data-tool-panel="miniMap"/,'Mapa deve conter personalização dedicada do minimapa.');
assert.match(editor,/data-document-setting="miniMapKind"[\s\S]*Vetorial[\s\S]*Satélite[\s\S]*Topográfico[\s\S]*Relevo/,'Minimapa deve permitir estilos cartográficos distintos.');
assert.match(editor,/data-document-setting="miniMapOpacity"/,'Minimapa deve permitir ajuste de opacidade.');
assert.match(editor,/data-document-setting="miniMapPerimeterVisible"/,'Minimapa deve permitir mostrar ou ocultar o perímetro.');
assert.match(app,/const PRANCHA_MAP_TOOL_ORDER = \['elements','miniMap','vertices','lines','servitudes'\]/,'Minimapa deve fazer parte do painel Mapa consolidado, com confrontantes integrados aos vértices e sem Editar cotas duplicado.');
assert.match(app,/data-mini-map-perimeter/,'Renderer deve identificar a camada de perímetro do minimapa.');
assert.match(app,/function centeredMiniMapMercatorBounds\(featureBounds, widthPx, heightPx, paddingFactor = 0\.62\)/,'Minimapa deve usar helper próprio para centralizar o enquadramento.');
assert.match(app,/const miniMercatorBounds = centeredMiniMapMercatorBounds\(boundsFromFeatures\(\[feature\]\) \|\| featureBounds, 330, 210\);/,'Enquadramento do minimapa deve usar bounds mercator centralizados no quadro.');
assert.match(app,/miniMapKind/,'Renderer deve consumir o estilo persistido do minimapa.');
assert.match(app,/defaultAreaName/,'Gerador deve propagar o nome principal do projeto como nome padrão do imóvel.');
assert.match(bridge,/miniMapKind:[\s\S]*miniMapOpacity:[\s\S]*miniMapPerimeterVisible:/,'Configurações do minimapa devem pertencer ao modelo visual persistente.');
assert.match(app,/body\.querySelectorAll\('\.sv-editor-tool-label'\)\.forEach\(\(node\) => node\.remove\(\)\)/,'Consolidação de Mapa deve remover subtítulos internos redundantes.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V223: painel Mapa compacto, nome padrão automático, minimapa centralizado e redundâncias removidas.');
