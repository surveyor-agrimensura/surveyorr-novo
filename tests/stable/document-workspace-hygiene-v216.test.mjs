import fs from 'node:fs';
import assert from 'node:assert/strict';

const js = fs.readFileSync('assets/js/core/documents.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.equal((css.match(/!important/g) || []).length, 0, 'documents.css deve respeitar a cascata natural sem !important.');
assert.doesNotMatch(css, /\b(?:HOTFIX|PATCH|legacy|RC\d+|V\d+)\b/i, 'documents.css não pode carregar marcadores históricos de implementação.');
assert.doesNotMatch(js, /cleanupLegacy|legacyTop/i, 'documents.js não pode manter rotinas ou nomes de compatibilidade legada.');
assert.ok(js.includes("workspace.dataset.documentWorkspaceRoot = '1'"), 'Workspace documental deve expor papel estrutural canônico.');
assert.ok(js.includes("left.dataset.documentConfigPanel = '1'"), 'Painel de configuração deve ter papel estrutural explícito.');
assert.ok(js.includes("right.dataset.documentPreviewPanel = '1'"), 'Painel de preview deve ter papel estrutural explícito.');
assert.ok(js.includes("rightHead.dataset.documentPreviewHeader = '1'"), 'Cabeçalho do preview deve ter papel estrutural explícito.');
assert.ok(js.includes("rightBody.dataset.documentPreviewBody = '1'"), 'Corpo do preview deve ter papel estrutural explícito.');
assert.ok(js.includes("right.setAttribute('aria-labelledby', previewTitleId)"), 'Preview deve apontar semanticamente para o próprio título.');
assert.ok(js.includes("rightBody.setAttribute('role','region')"), 'Corpo do preview deve ser uma região semântica independente.');
assert.doesNotMatch(js, /mapa\/app\.js|features\/mapa\/app/i, 'Motor documental não pode depender do monólito do mapa.');

const forbiddenOrphans = [
  'sv-doc-legacy-actions','sv-doc-mobile-toggle','sv-doc-page-head','sv-doc-completion',
  'sv-step-pills','sv-doc-quota-cards','sv-field-help-wrap','sv-doc-loteamento-preview',
  'sv-editor-engine-badge','sv-editor-guide-status','data-legacy-editor-hidden'
];
for (const token of forbiddenOrphans) {
  assert.ok(!css.includes(token), `Seletor órfão/residual removido: ${token}`);
}

assert.match(css, /\.sv-doc-preview-card\{[^}]*overflow:hidden/, 'Card de preview deve apenas recortar o shell, sem assumir scroll de conteúdo.');
assert.match(css, /\.sv-doc-preview-body\{[^}]*overflow:hidden/, 'Corpo do preview deve permanecer como host estrutural sem scroll externo duplicado.');
assert.match(css, /\.sv-doc-primary-preview,[\s\S]*?overflow:auto/, 'Superfície real da prévia deve continuar sendo a dona do scroll interno.');

console.log('PASS document-workspace-hygiene-v216: runtime documental isolado, sem resíduos e com cascata natural.');
