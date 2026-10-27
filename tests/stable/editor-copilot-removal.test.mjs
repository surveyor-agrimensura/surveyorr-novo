import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const editor = read('assets/js/core/technical-document-editor.js');
const css = read('assets/css/core/documents.css');
const backend = read('functions/surveyor-api/src/main.js');
const admin = read('admin/index.html');
const adminApp = read('assets/js/admin/app.js');

assert.doesNotMatch(editor, /(?:Copiloto IA|initAiCopilotController|data-editor-tool="ai"|data-tool-panel="ai"|data-ai-form|\/api\/editor\/ai\/)/i, 'Editor não pode oferecer funções, interface nem pedidos do Copiloto');
assert.doesNotMatch(css, /\.sv-ai-|\.sv-editor-ai-panel|svAiPulse/, 'CSS dedicado não deve permanecer no bundle');
for (const page of ['pranchas', 'mapas', 'perimetros', 'planialtimetria', 'loteamentos-reurb']) {
  const html = read(`${page}/index.html`);
  assert.doesNotMatch(html, /editor-ai-commands\.js/, `${page}: remover dependência do Copiloto`);
  assert.match(html, /technical-document-editor\.js/, `${page}: preservar carregamento do editor manual`);
}
assert.equal(existsSync('assets/js/core/editor-ai-commands.js'), false, 'Biblioteca de comandos do Copiloto deve ser removida');
assert.equal(existsSync('functions/surveyor-api/src/domain/editor-ai-response.js'), false, 'Parser exclusivo do Copiloto deve ser removido');
assert.doesNotMatch(backend, /askOpenRouterEditor|userAiMeta|\/api\/editor\/ai\/|\/ai-status|parseEditorAiResponse|OPENROUTER_EDITOR_MODEL/, 'Backend não pode manter rotas/serviços exclusivos do Copiloto');
assert.doesNotMatch(admin, /userAiAccess|userAiBlocked|userAiDailyLimit|Copiloto IA/, 'Admin não pode exibir permissão ou cota do Copiloto');
assert.doesNotMatch(adminApp, /toggle-ai|unblock-ai|block-ai|userAiAccess|aiUsageToday|aiActionButton|aiBadge/, 'Admin não deve emitir comandos de autorização do Copiloto');
assert.match(backend, /\/api\/admin\/ai\/ask/, 'Preservar recurso independente da IA administrativa');
assert.match(admin, /adminAiClear/, 'Preservar chat da IA administrativa');
assert.match(editor, /data-editor-tool="confrontantes"/, 'Preservar editor de confrontantes');
assert.match(editor, /data-editor-action="undo"/, 'Preservar histórico manual');
console.log('PASS editor-copilot-removal: aba, voz, scripts, rotas, permissões retirados, editor manual e IA administrativa preservados.');
