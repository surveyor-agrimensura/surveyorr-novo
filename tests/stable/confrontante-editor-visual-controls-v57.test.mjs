import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const app = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const confrontantes = fs.readFileSync('assets/js/features/mapas/confrontantes.js', 'utf8');
const css = fs.readFileSync('assets/css/core/documents.css', 'utf8').replace(/!important/g,'');

assert.ok(editor.includes('data-editor-tool="zoom"'), 'Zoom deve permanecer acessível em ferramenta lateral própria.');
assert.ok(editor.includes('data-editor-tool="vertices"'), 'Ferramentas de vértices devem permanecer acessíveis em painel próprio.');
assert.ok(editor.includes('data-editor-tool="lines"'), 'Ferramentas de linhas devem permanecer acessíveis em painel próprio.');
assert.ok(!editor.includes('data-guide-status></span></div><div class="sv-confrontante-editor-main"'), 'Status/instrução residual não deve ocupar a interface.');
assert.ok(editor.includes("addEventListener('input'"), 'Controle de tamanho dos vértices deve atualizar a prévia em tempo real.');
assert.ok(editor.includes('applyDocumentSettingsToOverlay'), 'Editor deve aplicar configurações visuais diretamente na prévia.');
assert.ok(editor.includes("querySelectorAll('.sv-document-editable-polygon,.sv-document-perimeter-fill')") || editor.includes('applyPolygonStylesToOverlay'), 'Preenchimento e aparência dos polígonos devem ser controláveis ao vivo.');
assert.ok(editor.includes("querySelectorAll('.sv-vertex-label')"), 'Rótulos V-01/V-02 devem ser redimensionáveis ao vivo.');
assert.ok(app.includes('sv-document-editable-polygon'), 'Gerador principal deve marcar os polígonos editáveis.');
assert.ok(confrontantes.includes('sv-document-perimeter-fill sv-document-editable-polygon'), 'Perímetro técnico deve marcar o preenchimento editável.');
assert.ok(css.includes('.sv-editor-tool-rail'), 'Ferramentas devem ficar na barra lateral compacta.');
assert.ok(css.includes('.sv-editor-tool-drawer.open'), 'Painel de ferramenta deve expandir sem ocupar permanentemente a tela.');

console.log('✓ editor visual: ferramentas laterais, vértices e preenchimento validados');
