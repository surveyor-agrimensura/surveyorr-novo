import fs from 'node:fs';
import assert from 'node:assert/strict';

const mapApp = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const mapUx = fs.readFileSync('assets/js/features/mapa/ux.js', 'utf8');
const mapWorkspace = fs.readFileSync('assets/js/features/mapa/workspace.js', 'utf8');
const mapsApp = fs.readFileSync('assets/js/features/mapas/app.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js', 'utf8');
const customization = fs.readFileSync('customizacao/index.html', 'utf8');
const odsHtml = fs.readFileSync('ods/index.html', 'utf8');
const odsApp = fs.readFileSync('assets/js/features/ods/app.js', 'utf8');
const documentsCss = fs.readFileSync('assets/css/core/documents.css', 'utf8').replace(/!important/g,'');
const perimeterApp = fs.readFileSync('assets/js/features/perimetros/app.js', 'utf8');
const downloads = fs.readFileSync('assets/js/core/downloads.js', 'utf8');

assert.match(mapApp, /async function maybeRestoreRecovery[\s\S]*return false;\s*\n\s*}/, 'mapa não deve bloquear a abertura para restaurar rascunho');
assert.doesNotMatch(mapApp, /Deseja restaur[aá]-lo agora|Rascunho local restaurado/, 'confirmação recorrente de rascunho deve permanecer removida');

assert.doesNotMatch(customization, /customization-chooser-head/, 'cabeçalho redundante da Central de personalização deve ser removido');
assert.doesNotMatch(customization, /Primeiro complete os dados da empresa/, 'texto redundante da Central de personalização deve ser removido');

assert.match(auth, /const previous = readCustomizationMirror\(\);[\s\S]*planDocumentSignatureDataUrl/, 'mirror da personalização deve preservar assinatura em salvamentos parciais');
assert.match(mapsApp, /getSignatureData:\s*async/, 'editor técnico deve poder recarregar a assinatura cadastrada');
assert.match(editor, /hydrateSignatureFromAccount\(\)/, 'editor técnico deve hidratar a assinatura da conta');
assert.match(editor, /signatureNodeValue\(signatureNode\)/, 'disponibilidade da assinatura deve validar conteúdo real e não apenas o nó SVG');

const gridBlock = mapsApp.match(/function georefGrid\([\s\S]*?return `<g id="grade-/)?.[0] || '';
assert.ok(gridBlock, 'grade georreferenciada precisa existir');
assert.match(gridBlock, /y="\$\{box\.y - 8\}" text-anchor="middle" font-size="9">\$\{num\(lng, 4\)}/, 'coordenadas superiores devem permanecer horizontais');
assert.doesNotMatch(gridBlock, /y="\$\{box\.y - 8\}"[^>]*rotate\(-90/, 'coordenadas superiores não podem ficar rotacionadas');
assert.match(gridBlock, /transform="rotate\(-90,\$\{box\.x - 12\}/, 'coordenadas laterais devem continuar verticais');

assert.match(perimeterApp, /function azimuthReportHtml\(/, 'perímetros deve montar documento completo para a pré-visualização');
assert.match(perimeterApp, /sv-az-table[\s\S]*Planilha técnica de vértices/, 'relatório de perímetro deve conter tabela técnica');
assert.match(perimeterApp, /previewHost\.innerHTML = lastAzimuthReportHtml;[\s\S]*document-preview-visible/, 'prévia de perímetro deve renderizar o documento completo diretamente na bancada, sem PDF intermediário');
assert.match(downloads, /const state = previewPdfState\('azimuthPreview'\);[\s\S]*state\?\.blob[\s\S]*openBlobPdf/, 'PDF de perímetro deve abrir o blob PDF real da prévia');
assert.match(downloads, /th\{background:#0f63e9;color:#fff/, 'tabela exportada de perímetro deve ter cabeçalho colorido');

assert.match(odsHtml, /button data-sheet-tab="map">Mapa<\/button>/, 'aba Mapa da Planilha ODS não deve redirecionar diretamente');
assert.match(odsHtml, /button data-sheet-tab="memorial">Memorial Descritivo<\/button>/, 'aba Memorial da Planilha ODS não deve redirecionar diretamente');
assert.match(odsHtml, /id="sheet-map"[\s\S]*id="sheetGoMap"/, 'aba Mapa deve explicar onde gerar e oferecer CTA explícito');
assert.match(odsHtml, /id="sheet-memorial"[\s\S]*id="sheetGoMemorial"/, 'aba Memorial deve explicar onde gerar e oferecer CTA explícito');
assert.match(odsApp, /sheet-owner-grid/, 'dados de proprietário e imóvel devem ser estruturados sem concatenação visual');
assert.match(odsApp, /async function styledXlsxBlob\(/, 'download Excel deve ser um workbook XLSX real gerado pelo sistema');
assert.match(odsApp, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/, 'XLSX deve usar MIME oficial');
assert.match(odsApp, /fgColor rgb="FF0F63E9"/, 'XLSX deve possuir estilo de cabeçalho colorido');
assert.match(odsApp, /name="Confrontantes"/, 'XLSX deve conter planilha de confrontantes');
assert.match(documentsCss, /body\[data-page="ods\.html"\][\s\S]*sheet-tab-panel\{[\s\S]*border-radius:8px/, 'área de pré-visualização ODS deve ser retangular');
assert.match(documentsCss, /body\[data-page="ods\.html"\][\s\S]*table thead th\{[\s\S]*background:#0f63e9/, 'tabelas visuais da ODS devem ter cabeçalho técnico colorido');

assert.doesNotMatch(mapUx, /label:'Dividir glebas'/, 'atalho duplicado Dividir glebas deve ser removido da grade genérica');
assert.match(mapWorkspace, /sv-context-glebas/, 'atalho contextual oficial de Glebas deve permanecer');

assert.doesNotMatch(mapApp, /row\.append\(content,\s*edit\)/, 'renderização de vértices não pode referenciar variável edit inexistente');
assert.match(mapApp, /row\.append\(content\);/, 'lista de confrontantes/vértices deve concluir cada linha sem exceção');
assert.match(mapApp, /lockedWeight = isLayerLocked\(candidate\) \? 1 : 0/, 'seleção em sobreposição deve considerar bloqueio');
assert.match(mapApp, /a\.lockedWeight - b\.lockedWeight/, 'polígonos desbloqueados devem ter prioridade em sobreposição');
assert.match(mapApp, /if \(!isLayerLocked\(drawnLayer\)\) \{[\s\S]*Editar polígono/, 'menu de contexto não deve oferecer edição para polígono bloqueado');

console.log('PASS system-polish: rascunho, personalização, assinatura, documentos, ODS, vértices e lock protegidos contra regressão.');
