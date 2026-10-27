import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');

assert.match(editor,/function bindCriticalPanelActions\(\)/,'Ações críticas devem possuir binding direto e independente da delegação geral.');
assert.match(editor,/data-editor-action=\"add-area-name\"[\s\S]*?addAreaName\(\)/,'Adicionar nome deve executar ação direta.');
assert.match(editor,/data-editor-action=\"remove-area-name\"[\s\S]*?removeAreaName\(\)/,'Excluir nome deve executar ação direta.');
assert.match(editor,/data-editor-action=\"add-confrontante\"[\s\S]*?addSegment\(\)/,'Adicionar confrontante deve executar ação direta.');
assert.match(editor,/data-editor-action=\"draw-line\"[\s\S]*?drawGeneralLine\(\)/,'Desenhar linha deve possuir binding direto.');
assert.match(editor,/data-editor-action=\"edit-lines\"[\s\S]*?toggleLineEditMode\(\)/,'Editar linhas deve possuir binding direto.');
assert.match(editor,/data-editor-action=\"draw-servitude\"[\s\S]*?startManualServitudeDrawing\(\)/,'Desenhar servidão deve possuir binding direto.');
assert.match(editor,/data-editor-action=\"finish-servitude\"[\s\S]*?finishManualServitudeDrawing\(\)/,'Finalizar servidão deve possuir binding direto.');
assert.match(editor,/data-editor-action=\"delete-servitude\"[\s\S]*?deleteManualServitude\(\)/,'Excluir servidão deve possuir binding direto.');
assert.match(editor,/data-editor-action=\"draw-line\"[\s\S]*?drawGeneralLine\(\)/,'Desenhar linha deve possuir binding direto.');
assert.match(editor,/data-editor-action=\"edit-lines\"[\s\S]*?toggleLineEditMode\(\)/,'Editar linhas deve possuir binding direto.');
assert.match(editor,/data-editor-action=\"draw-servitude\"[\s\S]*?startManualServitudeDrawing\(\)/,'Desenhar servidão deve possuir binding direto.');
assert.match(editor,/data-editor-action=\"finish-servitude\"[\s\S]*?finishManualServitudeDrawing\(\)/,'Finalizar servidão deve possuir binding direto.');
assert.match(editor,/data-editor-action=\"delete-servitude\"[\s\S]*?deleteManualServitude\(\)/,'Excluir servidão deve possuir binding direto.');
assert.match(editor,/function inferAreaNamesFromOverlay\(\)/,'Editor deve recuperar nomes já renderizados quando o estado persistido estiver ausente.');
assert.match(editor,/inferAreaNamesFromOverlay\(\);[\s\S]{0,900}?bindCriticalPanelActions\(\);/,'Nomes e ações críticas devem ser preparados assim que o overlay estiver disponível, mesmo com bindings nativos intermediários.');
assert.match(editor,/function editorVertexCount\(\)/,'Novo confrontante deve possuir contagem resiliente de vértices.');
assert.match(editor,/fromLabels[\s\S]*?fromSegments/,'Contagem de vértices deve usar rótulos e confrontantes existentes como fallback.');
assert.match(editor,/function safeCheckpoint\(/,'Falha no histórico não pode bloquear a ação solicitada.');

console.log('PASS editor: nomes e confrontantes possuem ações críticas independentes e recuperação do estado visual.');
