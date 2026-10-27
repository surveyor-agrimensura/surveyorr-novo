import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const bridge = fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const memorial = fs.readFileSync('assets/js/features/memorial/app.js','utf8');

assert.match(editor, /\.sv-cad-dimension-group,\.sv-coordinate-table-overlay/, 'Tabela técnica previamente salva deve ser tratada como overlay editável, não incorporada ao fundo e duplicada.');
assert.match(editor, /function materializeProjectSegmentsForOverlay/, 'Layout salvo por projeto deve ser materializado no quadro atual antes da edição.');
assert.match(editor, /x1G[\s\S]*x1N[\s\S]*labelDxG/, 'Linhas compartilhadas devem reconstruir coordenadas geométricas transportáveis entre croqui e prancha.');
assert.match(editor, /data-dimension-controls/, 'Editor deve conter o controle contextual das cotas.');
assert.match(editor, /Tamanho geral das cotas/, 'Editor deve expor o controle geral de tamanho das cotas.');
assert.match(editor, /Ajuste desta cota/, 'Editor deve expor o ajuste individual somente após selecionar uma cota.');
assert.match(editor, /\.sv-cad-dimension'\)\?'':'hidden'/, 'Controle de tamanho das cotas deve ficar oculto quando não há cotas geradas.');
assert.match(bridge, /dimensionScale: Number\.isFinite\(rawScale\) \? Math\.max\(0, Math\.min\(5, rawScale\)\) : 1/, 'A ponte técnica deve normalizar a escala geral no intervalo 0–500%.');
assert.match(editor, /dimensionLabelScales/, 'Escalas individuais de cotas devem ser persistidas no estado visual compartilhado.');
assert.match(bridge, /dimensionScale/, 'Ponte de renderização deve transportar a escala de cotas.');
assert.match(mapas, /function documentLegendEntries/, 'Legenda deve ser gerada a partir dos elementos realmente presentes.');
assert.match(mapas, /documentPolygonStyle\(rootFeature,visualSettings/, 'Cor do perímetro na legenda deve seguir o estilo efetivo do polígono.');
assert.match(mapas, /add\('servidao','Servidão',categoryColors\.estrada,'line'\)/, 'Servidão ativa deve ganhar item de legenda correspondente.');
assert.match(mapas, /if\(options\.showCotas\|\|options\.showGlebaCotas\) add\('cotas'/, 'Cotas habilitadas devem aparecer na legenda.');
assert.match(mapas, /Tipo:<\/text>[\s\S]*DD \(graus decimais\)/, 'Prancha/croqui deve informar explicitamente o tipo DD em linha técnica organizada.');
assert.match(mapas, /const coordinateReference = `\$\{backgroundStatus\} • COORDENADAS DD • SIRGAS 2000 • ZOOM \$\{zoom\}`;/, 'Faixa inferior do croqui deve exibir explicitamente sistema de coordenadas e zoom, sem caixa vazia.');
assert.match(mapas, /class="sv-map-coordinate-reference"[\s\S]*fill="#0f172a"/, 'Faixa de referência cartográfica deve possuir texto escuro explícito e legível.');
assert.match(mapas, /SISTEMA DE COORDENADAS UTM/, 'Saídas UTM devem informar explicitamente o sistema correto.');
assert.doesNotMatch(memorial, /<b>COORDENADAS:<\/b>|\nCOORDENADAS:/, 'Memorial não deve mais exibir a linha de coordenadas no topo nem no texto principal.');
assert.match(memorial, /agro-ident-grid/, 'Modelo Agro\+ deve organizar o topo em duas colunas, como no layout aprovado.');
assert.match(memorial, /SurveyorCroquiRenderer/, 'Mapa do Memorial deve herdar a legenda e a cor efetiva do perímetro do renderer oficial de Mapas/Croquis.');

console.log('PASS document-map-visual-regressions: edição única, tabela sem duplicação, legenda dinâmica, coordenadas explícitas e escala contextual de cotas.');
