import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(file)=>fs.readFileSync(file,'utf8');
const docs=read('assets/js/core/documents.js');
const memorial=read('assets/js/features/memorial/app.js');
const mapas=read('assets/js/features/mapas/app.js');
const editor=read('assets/js/core/technical-document-editor.js');

assert.match(docs,/function setupUnifiedDocumentActions\(workspace,left\)/,'Fluxo documental deve ter uma única política Salvar alterações → Download.');
assert.match(docs,/generate\.hidden=true;[\s\S]*generate\.dataset\.documentInternalGenerate='1'/,'Geradores manuais devem permanecer internos e fora da interface.');
assert.match(docs,/sv-doc-save-changes/,'Rodapé deve expor ação canônica Salvar alterações.');
assert.match(docs,/postSaveNodes\.forEach\(\(node\)=>\{node\.hidden=dirty;\}\)/,'Download deve ficar oculto enquanto houver alterações não salvas.');
assert.match(docs,/saveButton\.hidden=!dirty/,'Salvar alterações só deve aparecer quando o documento estiver sujo.');
assert.match(docs,/surveyor:document-save-request/,'Salvamento deve permitir persistência específica de cada documento.');

assert.doesNotMatch(memorial,/id="applyMemorialEdit">Aplicar alterações/,'Memorial não deve manter botão paralelo Aplicar alterações.');
assert.match(memorial,/function syncMemorialSignerPages/,'Assinatura deve consumir as mesmas páginas do modelo ativo.');
assert.match(memorial,/syncMemorialSignerPages\(\{preserveIndex:true\}\);[\s\S]*updateSignerUi\(\)/,'Aba Assinatura deve sincronizar o modelo atual antes de renderizar.');
assert.match(memorial,/surveyor:document-save-request[\s\S]*captureMemorialEditSettings/,'Salvar alterações deve persistir assinatura e personalização do Memorial sem trocar de modelo.');

assert.match(mapas,/const publicProjectAccessCache = new Map\(\)/,'QR/link público deve ser resolvido uma vez por projeto e reutilizado nas prévias vivas.');
assert.match(mapas,/documentAssets\.publicProjectAccess\(p, \{ qrSize:300 \}\)/,'Croqui deve resolver o link público real mesmo na prévia automática.');
assert.match(mapas,/const access = await resolveDocumentPublicAccess\(p\)/,'Geração cartográfica deve usar acesso público persistente no fluxo principal.');
assert.match(mapas,/Link do mapa:/,'Rodapé técnico deve identificar explicitamente o link do mapa/projeto.');

assert.match(editor,/surveyor:document-dirty/,'Editor técnico deve publicar estado de alterações para a política global.');
assert.match(editor,/surveyor:document-save-success/,'Editor técnico deve publicar confirmação de salvamento para liberar Download.');

console.log('PASS V244: modelo do Memorial permanece único, QR/link real e política global Salvar alterações → Download validados.');
