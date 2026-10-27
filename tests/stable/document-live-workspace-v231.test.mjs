import fs from 'node:fs';
import assert from 'node:assert/strict';

const docs = fs.readFileSync('assets/js/core/documents.js','utf8');
const docCss = fs.readFileSync('assets/css/core/documents.css','utf8');
const uiCss = fs.readFileSync('assets/css/core/ui.css','utf8');
const memorial = fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const planialt = fs.readFileSync('assets/js/features/planialtimetria/app.js','utf8');
const perimetros = fs.readFileSync('assets/js/features/perimetros/app.js','utf8');
const suite = fs.readFileSync('assets/js/core/suite.js','utf8');

assert.match(docs, /'memorial\.html':[\s\S]*sections:\s*\[[\s\S]*title:'Projeto'[\s\S]*#memDocumentType[\s\S]*#memOwnerName[\s\S]*#memComarca[\s\S]*title:'Personalização'/, 'Memorial deve concentrar documento, proprietário e comarca em Projeto e deixar Personalização como segunda etapa.');
assert.doesNotMatch(docs, /'memorial\.html':[\s\S]{0,2200}title:'Dados do documento'/, 'Memorial não deve recriar a etapa separada Dados do documento.');
assert.doesNotMatch(docs, /'memorial\.html':[\s\S]{0,2200}title:'Proprietário'/, 'Memorial não deve recriar a etapa separada Proprietário.');
assert.match(docs, /function setupProjectLivePreview\(workspace\)[\s\S]*showWorkspacePreviewLoader\(workspace,'Preparando documento…'\)[\s\S]*if \(select\.value && !generatedContent\(\)\) onProjectChange\(\);/, 'Projeto selecionado deve manter loader real até a prévia aparecer, inclusive no carregamento inicial.');
assert.match(docs, /function setupLiveFieldPreview\(workspace\)[\s\S]*generate\.dataset\.liveAutoPreview = '1'[\s\S]*generate\.click\(\)/, 'Campos dos módulos vivos devem atualizar a geração sem botão intermediário.');

assert.match(memorial, /function renderLiveMemorialPreview\(\)[\s\S]*memorial-live-preview-document[\s\S]*lastMemorialHtml/, 'Memorial deve usar HTML técnico vivo na bancada em vez de PDF como fonte visual.');
assert.match(memorial, /renderLiveMemorialPreview\(\);/, 'Geração do Memorial deve publicar a prévia HTML viva.');
assert.match(memorial, /renderPdfPreview\(false\)/, 'PDF do Memorial deve ser produzido apenas para exportação sem substituir a prévia editável.');
assert.match(memorial, /scheduleMemorialLiveRegeneration/, 'Alterações do Memorial devem regenerar a prévia viva.');
assert.match(memorial, /memorialSignaturePages[\s\S]*memorial-sign-page-bg[\s\S]*documentCss\(\)/, 'Personalização do Memorial deve usar conteúdo HTML real de todas as páginas, não screenshot/PDF rasterizado.');

assert.match(mapas, /previewHost\.innerHTML = svg;/, 'Mapas e Croquis devem montar o SVG técnico real diretamente na prévia.');
assert.match(mapas, /if \(select\.value\) \{[\s\S]*await generateSelected/, 'Projeto já selecionado deve gerar o croqui automaticamente sem esperar entrar em Personalização.');
assert.match(mapas, /Preparando croqui para edição/, 'Mapa/Croqui deve usar mensagem própria durante a preparação, sem chamar o croqui de prancha.');
assert.match(planialt, /preview[^\n]*innerHTML[\s\S]*document-generation-finished|elevationPreview[\s\S]*innerHTML/, 'Planialtimetria deve possuir prévia técnica direta e sinalizar conclusão.');
assert.match(perimetros, /previewHost\.innerHTML = lastAzimuthReportHtml;/, 'Perímetros deve exibir o relatório técnico real diretamente na coluna direita.');
assert.match(suite, /surveyor:document-generation-finished/, 'Carta de confrontação e Relatório Ambiental devem integrar o ciclo central de conclusão de geração.');

assert.match(docs, /'ambiental\.html':[\s\S]*compactModel:true[\s\S]*autoPreviewOnProject:true/, 'Relatório Ambiental deve seguir a bancada compacta com carregamento vivo do projeto.');
assert.match(docs, /'confrontacao\.html':[\s\S]*compactModel:true[\s\S]*autoPreviewOnProject:true/, 'Carta de confrontação deve seguir a bancada compacta com carregamento vivo do projeto.');
assert.match(docs, /'loteamentos-reurb\.html':[\s\S]*footerDownloadSelectors:[\s\S]*#downloadLotReportPdf/, 'Loteamentos/REURB deve consolidar os downloads no rodapé sem espalhar ações pela Personalização.');
assert.match(docs, /sv-lote-download-menu[\s\S]*export-menu-list/, 'Loteamentos/REURB deve montar um único menu de Download para suas exportações.');
assert.match(docs, /'ods\.html':[\s\S]*special:'ods'/, 'Planilha ODS deve permanecer no fluxo próprio já validado.');

assert.match(docCss, /\.sv-doc-draft-dock \.export-menu-list,[\s\S]*bottom:calc\(100% \+ 7px\)[\s\S]*z-index:12000/, 'Menu Download da bancada deve abrir para cima, acima do rodapé e sem recorte.');
assert.match(docs, /function normalizeExportMenus\(workspace\)[\s\S]*data-click-target[\s\S]*target\?\.click\?\.\(\)/, 'Menu de Download deve encaminhar cada opção ao botão de exportação real.');
const canonicalExportBlock = uiCss.match(/body\.workspace-shell-v131 \.export-menu,[\s\S]*?body\.workspace-shell-v131 \.export-hidden,/)?.[0] || '';
assert.ok(canonicalExportBlock, 'Bloco canônico de menus de exportação deve continuar existindo.');
assert.doesNotMatch(canonicalExportBlock, /!important/, 'Bloco canônico de Download deve permitir a cascata específica da bancada documental.');
assert.equal((docCss.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V231: gerações usam bancada viva, loader real, Memorial HTML editável e menus de Download clicáveis para cima.');
