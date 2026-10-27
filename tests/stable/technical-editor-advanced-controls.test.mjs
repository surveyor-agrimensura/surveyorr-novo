import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const editor = read('assets/js/core/technical-document-editor.js');
const maps = read('assets/js/features/mapas/app.js');
const vertices = read('assets/js/features/mapas/vertices.js');
const css = read('assets/css/core/documents.css');
const interactions = read('assets/js/core/editor-engine/interaction-controller.js');

assert.doesNotMatch(editor, />Engine local</i, 'O usuário não deve ver rótulo técnico do motor no editor.');
assert.match(editor, /data-document-setting="areaNameScale"/, 'Nome no mapa deve permitir aumentar e diminuir tamanho.');
assert.match(editor, /data-document-setting="areaNameRotation"/, 'Nome no mapa deve permitir rotação precisa.');
assert.match(editor, /item\.color=normalizeHexColor\(event\.target\.value/, 'Cor individual do nome deve aceitar exatamente a cor escolhida.');
assert.doesNotMatch(css, /\.sv-confrontante-editor-overlay \.sv-area-name-text\{[\s\S]{0,160}fill:#111827/, 'CSS não pode sobrescrever a cor dinâmica dos nomes no mapa.');

assert.match(editor, /attachStableConfrontanteDrag/, 'Arraste de confrontante deve usar interação estável dedicada.');
assert.match(editor, /applyOffsetDirect\(drag\.group,dx,dy\)/, 'Arraste de confrontante deve atualizar a posição diretamente durante o movimento.');
assert.match(editor, /commitSnapshot\(current\.before,after,'Mover confrontante'\)/, 'Fim do arraste deve consolidar o deslocamento no histórico do motor.');
assert.match(interactions, /is-dragging/, 'Motor deve manter estado visual explícito durante o drag.');

assert.match(editor, /data-editor-action="edit-lines"/, 'Editor deve possuir modo explícito Editar linhas.');
assert.match(editor, /data-editor-action="delete-selected-line"/, 'Linha selecionada deve poder ser excluída diretamente.');
assert.match(editor, /function renderAllGuidePreviews/, 'Modo de edição deve expor todas as linhas editáveis simultaneamente.');
assert.match(editor, /function updateGuideLineDom/, 'Arraste de linha deve atualizar o traçado sem recriar o alvo a cada movimento.');
assert.match(editor, /selectEditableLine/, 'Linha deve possuir seleção explícita para edição.');

assert.match(editor, /vertexLabelScales:\{\}/, 'Editor deve neutralizar escalas individuais antigas e usar uma única escala geral de vértices.');
assert.doesNotMatch(editor, /data-selected-vertex-scale/, 'Vértice selecionado não deve possuir redimensionamento individual concorrente.');
assert.match(editor, /base \* Math\.max\(\.55,Math\.min\(2\.5,Number\(vertexVisual\.scale\)\|\|1\)\)/, 'Editor deve aplicar uma única escala geral do cartão Vértices aos rótulos V-xx.');
assert.doesNotMatch(vertices, /labelScales/, 'Renderer técnico não deve reaplicar tamanho individual legado de V-xx.');
assert.match(vertices, /data-individual-scale="1"/, 'Todos os vértices devem nascer com escala individual unitária.');

console.log('technical-editor-advanced-controls: ok');
