import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('.');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

assert.equal(exists('core/technical-engine/src/engine.ts'), true, 'Technical Engine deve permanecer como núcleo isolado dentro do projeto.');
assert.equal(exists('assets/js/core/technical-document-editor.js'), true, 'Editor técnico oficial deve existir.');
assert.equal(exists('pranchas-v2/index.html'), false, 'Rota experimental Prancha V2 deve ser removida após integração oficial.');

const editor = read('assets/js/core/technical-document-editor.js');
const mapApp = read('assets/js/features/mapas/app.js');
const maps = read('mapas/index.html');
const sheets = read('pranchas/index.html');

assert.match(editor, /SurveyorTechnicalDocumentEditor/, 'Editor deve expor o runtime técnico oficial.');
assert.match(editor, /pranchas\.html'\) return 'prancha técnica'/, 'Editor deve reconhecer a edição da prancha técnica.');
assert.match(editor, /mapas\.html'\) return 'croqui'/, 'Editor deve reconhecer a edição do croqui.');
assert.match(editor, /Desenhar linha/, 'Editor oficial deve manter desenho de linhas livres.');
assert.match(editor, /data-document-setting="vertexScale"/, 'Editor oficial deve controlar tamanho dos vértices.');
assert.match(editor, /data-document-setting="polygonFill"/, 'Editor oficial deve controlar preenchimento do perímetro.');
assert.match(mapApp, /SurveyorTechnicalDocumentEditor/, 'Gerador de mapas/pranchas deve usar o editor técnico oficial.');
assert.match(maps, /technical-document-editor\.js/, 'Mapas e Croquis deve carregar o editor técnico oficial.');
assert.match(sheets, /technical-document-editor\.js/, 'Pranchas Técnicas deve carregar o editor técnico oficial.');
assert.doesNotMatch(sheets, /pranchas-v2/, 'Prancha oficial não deve mais expor rota de laboratório V2.');


const docsCss = read('assets/css/core/documents.css');
const vertices = read('assets/js/features/mapas/vertices.js');
assert.match(editor, /function attachStableVertexLabelDrag/, 'Editor oficial deve manter arraste estável dos rótulos V-xx.');
assert.match(editor, /sceneNode=editorEngine\?\.scene\?\.get\?\.\(`vertex-label:/, 'Arraste estável dos V-xx deve sincronizar o estado com o motor quando disponível.');
assert.match(editor, /SurveyorEditorEngine/, 'Editor oficial deve carregar o motor formal de edição.');
assert.match(editor, /attachGuideLineDrag/, 'Editor oficial deve permitir mover linhas manuais inteiras.');
assert.match(editor, /sv-editor-guide-hitbox/, 'Linhas manuais devem ter área de captura ampla para arraste.');
assert.match(editor, /vertexLabelOffsets/, 'Deslocamentos manuais dos V-xx devem integrar o estado visual do documento.');
assert.match(vertices, /labelOffsets/, 'Renderer deve reaplicar os deslocamentos manuais dos V-xx na geração final.');
assert.match(docsCss, /sv-vertex-label\{pointer-events:all/, 'CSS não pode bloquear o arraste dos rótulos V-xx.');
assert.match(docsCss, /sv-editor-guide-hitbox/, 'CSS deve habilitar a captura das linhas manuais.');

console.log('OK: Technical Engine integrada ao editor oficial de documentos.');
