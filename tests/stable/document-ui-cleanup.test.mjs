import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/!important/g,'');
const generatorPages = [
  'memorial',
  'mapas',
  'pranchas',
  'planialtimetria',
  'perimetros',
  'confrontacao',
  'ambiental',
  'ods',
  'loteamentos-reurb'
];

const memorialHtml = read('memorial/index.html');
const memorialJs = read('assets/js/features/memorial/app.js');
const documentJs = read('assets/js/core/documents.js');
const documentCss = read('assets/css/core/documents.css');
const memorialPreviewCss = read('assets/css/features/memorial/memorial-preview.css');
const memorialSignatureCss = read('assets/css/features/memorial/signature.css');
const pdfPreviewJs = read('assets/js/core/pdf-preview.js');
const mapGeneratorJs = read('assets/js/features/mapas/app.js');
const technicalEditorJs = read('assets/js/core/technical-document-editor.js');
const confrontantesJs = read('assets/js/features/mapas/confrontantes.js');

assert.ok(!memorialHtml.includes('memorialGenerationProgress'), 'Memorial não pode manter contador/progresso secundário no DOM.');
assert.ok(!memorialHtml.includes('memorial-generation-progress'), 'Memorial não pode manter markup do progresso secundário.');
assert.ok(!memorialJs.includes('setMemorialProgress'), 'Runtime do Memorial não pode atualizar contador secundário.');
assert.ok(!memorialJs.includes('memorialProgressValue'), 'Estado numérico do contador antigo deve ser removido.');
assert.ok(memorialJs.includes("output.setAttribute('aria-busy', 'true')"), 'Prévia deve sinalizar processamento sem injetar texto de loading.');
assert.ok(memorialJs.includes('output.replaceChildren();'), 'Prévia deve ficar visualmente limpa durante o loading oficial.');

assert.match(documentCss, /\.sv-doc-preview-body\{[^}]*overflow:hidden/, 'Container pai da prévia deve impedir scroll externo redundante.');
assert.match(documentCss, /\.sv-doc-primary-preview,[\s\S]*?border:0;[\s\S]*?box-shadow:none;[\s\S]*?outline:0;/, 'Prévia documental deve ficar sem borda/sombra azul externa.');
assert.match(memorialPreviewCss, /#memorialOutput\{[\s\S]*?border:0;[\s\S]*?box-shadow:none;[\s\S]*?overflow:hidden;/, 'Prévia do Memorial deve ficar sem moldura azul e sem scroll externo.');
assert.match(memorialPreviewCss, /\.memorial-pdf-preview-shell\{[\s\S]*?border:0;[\s\S]*?box-shadow:none;[\s\S]*?overflow:hidden;/, 'Shell PDF do Memorial deve ficar sem borda azul.');
assert.ok(!memorialPreviewCss.includes('border:1px solid #1d63e9'), 'CSS da prévia não pode preservar borda azul antiga.');
assert.ok(pdfPreviewJs.includes('overflow:hidden'), 'Host do visualizador PDF deve evitar scroll pai redundante.');
assert.ok(confrontantesJs.includes('sv-confrontante-callout'), 'Confrontantes devem ser renderizados como callouts editáveis.');
assert.ok(confrontantesJs.includes('manualOffsets'), 'Motor de confrontantes deve aceitar deslocamentos manuais persistidos.');
assert.ok(!mapGeneratorJs.includes('Editar croqui'), 'Mapas/Croquis não deve reintroduzir botão independente Editar croqui fora da etapa Personalização.');
assert.ok(mapGeneratorJs.includes('startMapasPersonalization'), 'Mapas/Croquis deve abrir o editor pela etapa Personalização integrada.');
assert.ok(mapGeneratorJs.includes('surveyor:confrontante-label-layout:v1'), 'Posições manuais dos confrontantes devem ser persistidas por projeto/layout.');
assert.ok(technicalEditorJs.includes('setPointerCapture'), 'Editor técnico formal deve usar Pointer Events para arraste estável.');
assert.ok(confrontantesJs.includes('sv-confrontante-hitbox'), 'Confrontantes devem manter área transparente de clique sem caixa branca visível.');
assert.ok(!confrontantesJs.includes('sv-confrontante-leader'), 'Documento final não deve desenhar linha ligando confrontante ao perímetro.');
assert.ok(!confrontantesJs.includes('sv-confrontante-label-bg'), 'Documento final não deve desenhar fundo branco nos confrontantes.');
assert.ok(technicalEditorJs.includes('sv-confrontante-editor-modal'), 'Edição de confrontantes deve abrir em modal próprio sem substituir a prévia.');
assert.ok(technicalEditorJs.includes('Salvar alterações'), 'Editor modal deve exigir confirmação explícita antes de persistir a posição.');
assert.ok(technicalEditorJs.includes('data-editor-action="zoom-in"'), 'Editor modal deve oferecer zoom para reposicionamento preciso.');
assert.match(documentCss, /\.sv-confrontante-editor-modal\{[\s\S]*?position:fixed/, 'Editor de confrontantes deve abrir sobre a tela em modal dedicado.');
assert.match(documentCss, /\.sv-confrontante-editor-overlay\{[\s\S]*?touch-action:none/, 'Camada SVG do editor deve aceitar arraste sem conflito com scroll.');

assert.match(documentCss, /\.sv-doc-module-head\{[\s\S]*?justify-content:flex-start;[\s\S]*?background:transparent;/, 'Cabeçalho documental próprio deve ficar ancorado à esquerda e sem fundo de cartão.');
assert.match(documentCss, /\.sv-doc-module-title\{[\s\S]*?margin:0;[\s\S]*?border:0;[\s\S]*?background:transparent;/, 'Título documental deve ficar sem caixa branca/borda e sem margem centralizadora.');
assert.match(documentCss, /\.sv-doc-module-icon\{[\s\S]*?border:0;[\s\S]*?background:transparent;[\s\S]*?color:#111827;/, 'Ícone do título documental deve ser preto e sem badge/borda azul.');
assert.match(documentCss, /\.sv-doc-preview-icon\{[^}]*border:0;[^}]*background:transparent;[^}]*color:#111827;/, 'Ícone da prévia documental deve ser preto e sem borda azul.');
assert.match(documentCss, /\.sv-doc-options-grid\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/, 'Elementos da geração devem permanecer organizados em duas colunas.');
assert.match(documentCss, /\.sv-doc-options-grid input\[type=\"checkbox\"\]\{[\s\S]*?appearance:none;[\s\S]*?width:18px;[\s\S]*?height:18px;/, 'Checkboxes dos elementos da geração devem ter tamanho compacto próprio e não herdar o input global.');
assert.match(documentCss, /\.sv-doc-tabs\{[^}]*margin:0 0 11px/, 'Abas devem compartilhar a mesma margem esquerda estrutural.');
assert.match(memorialSignatureCss, /\.memorial-sign-dialog-head>div\{[^}]*text-align:left/, 'Título do modal do Memorial deve permanecer alinhado à esquerda.');

for (const page of generatorPages) {
  const html = read(`${page}/index.html`);
  assert.ok(html.includes('/assets/css/core/documents.css'), `${page} deve carregar o layout documental único.`);
  assert.ok(html.includes('/assets/js/core/documents.js'), `${page} deve carregar o runtime documental único.`);
}

assert.ok(!documentJs.includes('memorialGenerationProgress'), 'Workspace documental não pode carregar o contador removido.');
assert.ok(documentJs.includes("sourceHeader.remove();"), 'Cabeçalho-fonte da página deve ser substituído pelo cabeçalho documental canônico.');
assert.ok(documentJs.includes("sv-doc-module-head"), 'Workspace documental deve criar um cabeçalho próprio sem depender do header legado.');
assert.ok(documentJs.includes("document.body.classList.add('sv-document-workspace-page')"), 'Todas as gerações devem compartilhar o shell documental oficial.');

assert.match(documentCss, /\.sv-confrontante-editor-background\{[\s\S]*?pointer-events:none/, 'Fundo rasterizado do editor deve ser apenas visual e não capturar o arraste.');
assert.doesNotMatch(documentCss, /\.sv-confrontante-editor-overlay text,[\s\S]{0,260}?stroke:none/, 'Editor não pode aplicar reset global de stroke aos textos da camada editável.');
assert.match(documentCss, /\.sv-confrontante-editor-modal \.sv-confrontante-callout text,[\s\S]*?text-rendering:geometricPrecision/, 'Qualquer tratamento visual específico do editor deve ficar restrito aos confrontantes editáveis.');


assert.ok(pdfPreviewJs.includes('function normalizeVectorSvgTypography(svg)'), 'PDF deve expor uma normalização tipográfica vetorial reutilizável.');
assert.ok(pdfPreviewJs.includes("numericWeight >= 600 ? '700' : '400'"), 'Normalização vetorial deve usar os mesmos pesos 700/400 do PDF final.');
assert.ok(pdfPreviewJs.includes('normalizeVectorSvg(svg)'), 'API de preview deve expor o normalizador vetorial ao editor.');
assert.ok(technicalEditorJs.includes('raster = await rasterize(parts.background)'), 'Editor deve usar uma rasterização própria da prancha como fundo visual.');
assert.ok(technicalEditorJs.includes("overlay = modal.querySelector('.sv-confrontante-editor-overlay')"), 'Camada técnica editável deve permanecer vetorial no editor.');

assert.ok(mapGeneratorJs.includes('fontSize: Math.max(14.5, autoLayout.confrontanteFontSize * 2.5)'), 'Confrontantes da prancha georreferenciada devem manter tamanho técnico legível no editor e no PDF.');
assert.ok(technicalEditorJs.includes('const ZOOM_MIN = 0.50')&&technicalEditorJs.includes('const ZOOM_MAX = 3.00'), 'Editor deve oferecer faixa de zoom útil de 50% a 300% para inspeção real da prancha.');
console.log('PASS document-ui-cleanup: loading limpo, preview sem borda/scroll duplo e títulos alinhados à esquerda.');

