import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const editor = fs.readFileSync(path.join(root, 'assets/js/core/technical-document-editor.js'), 'utf8');
const maps = fs.readFileSync(path.join(root, 'assets/js/features/mapas/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/core/documents.css'), 'utf8');

assert.ok(editor.includes('data-editor-action="add-confrontante"'), 'Editor técnico deve oferecer botão para adicionar confrontante diretamente.');
assert.ok(editor.includes("if (action === 'add-confrontante')"), 'Botão de adicionar confrontante deve executar addSegment.');
assert.ok(editor.includes('data-registration-field="startVertex"') && editor.includes('data-registration-field="endVertex"'), 'Cadastro avançado do confrontante deve permitir ajustar vértices inicial e final sem poluir a lista compacta.');
assert.ok(editor.includes('data-segment-remove'), 'Confrontante criado no editor deve poder ser removido antes de salvar.');
assert.ok(editor.includes('data-area-name-input') && editor.includes('data-editor-action="add-area-name"'), 'Editor deve oferecer nomes múltiplos no mapa.');
assert.ok(editor.includes('function attachStableAreaNameDrag') && editor.includes('document-area-name:'), 'Nome da área deve ser arrastável localmente e sincronizado com o engine quando disponível.');
assert.ok(editor.includes('areaNames') && editor.includes('areaNameX') && editor.includes('areaNameY'), 'Nomes múltiplos e compatibilidade legada devem ser persistidos no documentVisualSettings.');
assert.ok(maps.includes('svgDocumentVisualOverlay') && maps.includes('sv-document-map-metadata'), 'Gerador oficial deve renderizar o overlay visual compartilhado, incluindo o nome da área, no quadro cartográfico.');
assert.ok(maps.includes('${areaNameLabel}'), 'Nome da área deve integrar a saída técnica gerada.');
assert.ok(css.includes('.sv-add-confrontante-btn') && css.includes('.sv-editor-area-name-control'), 'Controles novos devem possuir estilo próprio do editor técnico.');
console.log('technical-editor-confrontante-area-name: ok');

assert.ok(editor.includes('readProjectLayout: () => readProjectLayout(options)'), 'Editor deve expor a transação local completa para regeneração imediata.');
assert.ok(editor.includes('documentSettings, updatedAt: layoutUpdatedAt'), 'Confrontantes e nome da área devem compartilhar a mesma revisão de salvamento.');
assert.ok(maps.includes('layoutTimestamp(localProjectLayout.updatedAt) >= remoteLayoutTime'), 'Gerador deve preferir a edição local mais recente quando a cópia remota ainda estiver defasada.');
assert.ok(maps.includes('transactionalLocal'), 'Nome no mapa deve participar do mesmo estado transacional dos confrontantes.');
