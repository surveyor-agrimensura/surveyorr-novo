import assert from 'node:assert/strict';
import fs from 'node:fs';

const docs = fs.readFileSync('assets/js/core/documents.js', 'utf8');
const css = fs.readFileSync('assets/css/core/documents.css', 'utf8').replace(/!important/g,'');

assert.match(docs, /const GENERATION_CONSENT_SECONDS = 5;/, 'Confirmação de geração deve exigir 5 segundos de espera.');
assert.match(docs, /function setupGenerationConsent\(\)/, 'Workspace deve possuir uma única barreira compartilhada de consentimento.');
assert.match(docs, /event\.stopImmediatePropagation\(\)/, 'Primeiro clique em Gerar não pode chegar ao gerador antes da confirmação.');
assert.match(docs, /generationConsentBypass/, 'Após confirmação, somente um clique autorizado deve atravessar a barreira.');
assert.match(docs, /Confirmar geração \(\$\{remaining\}s\)/, 'Botão deve exibir a contagem regressiva em segundos.');
assert.ok(docs.includes("confirm.textContent = 'Confirmar e gerar';"), 'Depois da contagem, ação final deve ficar explícita.');
assert.ok(docs.includes('Voltar e revisar'), 'Modal deve permitir retornar ao formulário sem gerar.');
assert.ok(docs.includes("addConsentRow(rows, seen, 'CPF/CNPJ'"), 'Resumo deve exibir CPF/CNPJ quando esse dado existir no projeto.');
assert.ok(docs.includes("addConsentRow(rows, seen, 'Proprietário'"), 'Resumo deve exibir o proprietário do projeto.');
assert.ok(docs.includes("addConsentRow(rows, seen, 'Município / UF'"), 'Resumo deve exibir município/UF quando disponíveis.');
assert.match(docs, /previewDownloadPages = new Set\([\s\S]*?'memorial\.html'[\s\S]*?'mapas\.html'[\s\S]*?'pranchas\.html'/, 'Download pós-geração deve ser compartilhado entre os principais documentos.');
assert.match(docs, /rightHead\.innerHTML = `[\s\S]*sv-doc-preview-actions[\s\S]*hidden/, 'Cabeçalho da prévia deve possuir área própria de ações inicialmente oculta.');
assert.match(docs, /actions\.appendChild\(menu\)/, 'Menu Download deve ser movido fisicamente para o cabeçalho da prévia.');
assert.match(docs, /actions\.hidden = !ready/, 'Download deve permanecer invisível enquanto não existir geração válida.');
assert.match(docs, /downloadAction\?\.setReady\?\.\(!generationErrorText\(\) && generatedContent\(\)\)/, 'Download só pode ser liberado após conteúdo gerado sem erro.');
assert.match(docs, /downloadAction\?\.setReady\?\.\(false\);[\s\S]*?showGenerationOverlay\(\)/, 'Nova geração deve esconder imediatamente o download antigo.');
assert.match(docs, /configCard\?\.addEventListener\('input', invalidate\)/, 'Alterar os dados deve invalidar o download anterior.');
assert.match(css, /\.sv-doc-preview-actions\{[\s\S]*?margin-left:auto/, 'Ação de download deve ficar no canto direito do cabeçalho da prévia.');
assert.match(css, /\.sv-doc-preview-actions\[hidden\]\{display:none;\}/, 'Estado oculto do download deve ter precedência visual.');
assert.match(css, /\.sv-generation-consent\{[\s\S]*?position:fixed[\s\S]*?backdrop-filter:blur/, 'Consentimento deve abrir como modal dedicado sobre a geração.');
assert.match(css, /\.sv-generation-consent-summary\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'Resumo deve apresentar dados de forma compacta e legível.');
assert.match(css, /\.sv-generation-consent-footer \.btn\.primary:disabled\{[\s\S]*?cursor:not-allowed/, 'Confirmação deve permanecer visualmente bloqueada durante a contagem.');

console.log('PASS document-generation-consent-download: download pós-geracao e consentimento de 5s validados.');
