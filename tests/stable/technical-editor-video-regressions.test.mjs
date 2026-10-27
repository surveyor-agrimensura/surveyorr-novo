import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const interactions = fs.readFileSync('assets/js/core/editor-engine/interaction-controller.js', 'utf8');
const engine = fs.readFileSync('assets/js/core/editor-engine/engine.js', 'utf8');
const renderer = fs.readFileSync('assets/js/core/editor-engine/renderer.js', 'utf8');

assert.match(editor, /hydrateEditorSegments/, 'Editor deve hidratar a sessão com a geometria absoluta já renderizada.');
assert.match(editor, /const renderedSegments=fromDocument\.filter[\s\S]*renderedSegments\.length[\s\S]*hydrateEditorSegments\(preferredSegments, renderedSegments\)/, 'SVG atual, após filtrar somente o legado sintético, deve ser a fonte geométrica da sessão de edição.');
assert.match(editor, /materializeGuideGeometry/, 'Linhas já existentes precisam poder virar linhas editáveis.');
assert.match(editor, /setOriginalGuideVisibility/, 'Visibilidade das linhas originais deve ser reversível.');
assert.match(editor, /renderAllGuidePreviews\(\);[\s\S]*Edição de linhas concluída/, 'Concluir edição não pode apagar as demais linhas.');
assert.match(editor, /label\.style\.opacity = '1'/, 'Rótulo de confrontante deve permanecer explicitamente visível durante reposicionamento.');
assert.match(interactions, /root\.setPointerCapture/, 'Arraste deve capturar ponteiro no viewport estável.');
assert.match(interactions, /renderNode\?\.\(drag\.id\)/, 'Arraste deve renderizar somente o objeto ativo.');
assert.match(engine, /renderNode\(id/, 'Engine deve oferecer renderização isolada por nó.');
assert.match(renderer, /renderNode\(node, context\)/, 'Registro de renderização deve suportar renderização isolada.');

console.log('technical-editor-video-regressions: ok');
