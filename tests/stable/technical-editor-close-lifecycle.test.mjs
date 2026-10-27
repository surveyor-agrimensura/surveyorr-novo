import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('assets/js/core/technical-document-editor.js', 'utf8');

// Executa o código real do editor em um contexto DOM mínimo: o encerramento
// não pode depender das variáveis do Copiloto retirado na RC185.71.
for (const page of ['pranchas.html', 'mapas.html', 'planialtimetria.html']) {
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const classes = new Set();
  const context = {
    window: { dispatchEvent() {} },
    document: {
      body: {
        dataset: { page },
        classList: {
          remove: (...values) => values.forEach((value) => classes.delete(value)),
          add: (...values) => values.forEach((value) => classes.add(value))
        }
      },
      getElementById: () => null
    },
    localStorage: storage,
    sessionStorage: storage,
    URL: { revokeObjectURL() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    cancelAnimationFrame() {},
    console
  };
  runInNewContext(source, context, { filename: 'technical-document-editor.js' });
  const editor = context.window.SurveyorTechnicalDocumentEditor.create({
    page,
    projectId: 'teste-fechamento',
    getSvg: () => ''
  });
  classes.add('sv-confrontante-editor-open');
  assert.doesNotThrow(() => editor.close(), `${page}: fechar o editor não pode acessar estado do Copiloto removido`);
  assert.equal(classes.has('sv-confrontante-editor-open'), false, `${page}: fechar deve limpar o estado da interface`);
  assert.doesNotThrow(() => editor.close(), `${page}: fechamento repetido deve ser seguro`);
  assert.equal(editor.isActive(), false, `${page}: editor deve permanecer inativo`);
}
assert.doesNotMatch(source, /\b(?:aiConversationHistory|aiVoiceActive|aiVoiceRecognition)\b/, 'Não deixar estado residual do Copiloto no editor manual.');
console.log('PASS technical-editor-close-lifecycle: fechar e repetir fechamento sem dependências do Copiloto nas três páginas.');
