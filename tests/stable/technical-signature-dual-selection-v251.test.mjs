import fs from 'node:fs';
import assert from 'node:assert/strict';

const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const css=fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(editor,/const IMPORTED_SIGNATURE_DB = 'surveyor-document-assets-v1'/,'Assinatura importada deve usar armazenamento IndexedDB dedicado em vez de depender do limite do localStorage.');
assert.match(editor,/indexedDB\.open\(IMPORTED_SIGNATURE_DB,1\)/,'Persistência da assinatura externa deve abrir o banco local dedicado.');
assert.match(editor,/A assinatura importada ficará disponível somente nesta sessão/,'Falha de persistência não pode impedir o uso imediato da assinatura importada.');
assert.doesNotMatch(editor,/signatureEnabled:value\?\.signatureEnabled===true && !importedSignatureEnabled/,'Assinatura da conta não pode ser ocultada só porque a importada está ativa.');
assert.match(editor,/function activeSignatureMode\(\)\{return signatureModeAvailable\(selectedSignatureMode\)\?selectedSignatureMode:'none';\}/,'Seleção de edição deve ser separada da visibilidade das assinaturas.');
assert.match(editor,/selectedSignatureMode=imported\?'imported':'account';syncSignatureSelectionVisual\(\);syncSettingsControls\(\);/,'Clique direto na assinatura da prévia deve selecionar a assinatura que será movida/redimensionada.');
assert.match(editor,/if\(!documentSettings\.signatureEnabled && selectedSignatureMode==='account'\)selectedSignatureMode='none'/,'Checkbox da conta deve apenas controlar visibilidade sem excluir a assinatura importada.');
assert.match(editor,/if\(!documentSettings\.importedSignatureEnabled && selectedSignatureMode==='imported'\)selectedSignatureMode='none'/,'Checkbox da importada deve apenas controlar visibilidade sem excluir a assinatura da conta.');
assert.match(editor,/sv-editor-signature-toggle-row[\s\S]*importedSignatureEnabled[\s\S]*signatureEnabled/,'Controles Importada e Conta devem ficar lado a lado no mesmo cartão.');
assert.match(editor,/sv-editor-signature-import-actions[\s\S]*data-editor-action="import-signature"[\s\S]*data-editor-action="remove-imported-signature"/,'Importar assinatura deve ficar ao lado do botão Remover.');
assert.match(editor,/downloadSlot\.style\.display=hasUnsavedChanges\?'none':''/,'Quando Salvar alterações estiver ativo, o slot de Download deve ser removido do hit-test.');
assert.match(css,/\.sv-editor-inline-download-slot\[hidden\]\{display:none;pointer-events:none;\}/,'Slot de Download oculto não pode interceptar cliques do botão Salvar.');
assert.match(css,/\[data-editor-action="save"\]\{position:relative;z-index:5;pointer-events:auto;isolation:isolate;\}/,'Botão Salvar deve ter área clicável integral acima dos controles substituídos.');
assert.match(css,/\.is-selected-signature/,'Assinatura selecionada diretamente na prévia deve receber estado visual próprio.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V251: duas assinaturas permanecem visíveis, seleção acontece na prévia, importação é resiliente e Salvar possui hitbox integral.');
