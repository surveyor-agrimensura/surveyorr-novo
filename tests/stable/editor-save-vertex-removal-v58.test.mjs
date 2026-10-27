import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const editorCss = fs.readFileSync('assets/css/core/documents.css', 'utf8').replace(/!important/g,'');
const map = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const mapHtml = fs.readFileSync('mapa/index.html', 'utf8');
const mapCss = fs.readFileSync('assets/css/features/mapa/app.css', 'utf8').replace(/!important/g,'');
const docs = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const vertices = fs.readFileSync('assets/js/features/mapas/vertices.js', 'utf8');

assert.ok(editor.includes('showSaveLoading'), 'Salvar alterações deve iniciar loading dedicado.');
assert.ok(editor.includes("await options.regenerate?.();"), 'Loading deve cobrir a regeneração da pré-visualização.');
assert.ok(editor.includes('releaseLoading();'), 'Loading deve ser encerrado após a regeneração.');
assert.ok(editorCss.includes('.sv-document-save-loading'), 'Overlay de loading deve ter estilo próprio.');
assert.ok(editorCss.includes('.sv-document-save-spinner'), 'Loading deve exibir spinner visual.');

assert.ok(!vertices.includes('class="sv-auto-leader"'), 'Rótulos de vértices não devem desenhar linhas automáticas longas.');
assert.ok(vertices.includes('hiddenVertexIndexes.has(point.index)'), 'Renderizador deve suportar vértice virtual sem rótulo.');
assert.ok(vertices.includes('sv-vertex-anchor'), 'Ponto geométrico deve permanecer visível no modo virtual.');
assert.ok(docs.includes('hiddenVertexIndexesForFeature'), 'Geração deve ler vértices ocultos persistidos no projeto.');
assert.ok(docs.includes('surveyorHiddenVertexKeys'), 'Geração deve respeitar os metadados de remoção virtual.');

assert.ok(mapHtml.includes('aria-label="Remover vértice"'), 'Ferramenta deve usar semântica de remoção de vértice.');
assert.ok(map.includes("vertexHideOperation = 'virtual'"), 'Ferramenta deve possuir modo virtual.');
assert.ok(map.includes("operation === 'delete' ? 'delete' : 'virtual'"), 'Ferramenta deve possuir modo definitivo.');
assert.ok(map.includes('openVertexHideChoice'), 'Clique na ferramenta deve abrir as duas escolhas.');
assert.ok(map.includes('rememberHiddenVertex(layer'), 'Modo virtual deve preservar geometria e registrar apenas ocultação técnica.');
assert.ok(map.includes("ring.splice(vertexIndex, 1)"), 'Modo definitivo deve continuar removendo a coordenada da geometria.');
assert.ok(map.includes("Botão direito → Cancelar ferramenta para sair"), 'Ferramenta deve orientar cancelamento por menu de contexto.');
assert.ok(mapCss.includes('.surveyor-vertex-remove-choice'), 'Escolha dos dois modos deve possuir UI própria.');

console.log('✓ V58: loading de salvamento, rótulos sem leader e remoção virtual/definitiva validados');
