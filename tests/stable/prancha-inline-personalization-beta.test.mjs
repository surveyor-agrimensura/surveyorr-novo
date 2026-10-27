import fs from 'node:fs';
import assert from 'node:assert/strict';

const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');

assert.match(documents, /hideManualGenerate:true, noFinalStep:true/, 'Pranchas deve ter somente Projeto e Personalização; download fica no rodapé, sem etapa final.');
assert.match(documents, /\{ title:'Projeto', selectors:\['#projectSelect','#mapTitle','#mapRegistration','#mapDistrict','#mapRegistryOffice','#mapIncra','#mapCnib','#mapTechnician'\]/, 'Dados do imóvel devem estar integrados à etapa Projeto.');
assert.match(documents, /\{ title:'Personalização', betaPersonalization:true, runtimePersonalization:true, betaGroups:\[/, 'Pranchas deve manter uma única etapa dedicada de Personalização em runtime, sem tela intermediária.');
assert.match(documents, /tool:'sheet'[\s\S]*title:'Prancha'[\s\S]*#mapSheetLayout[\s\S]*#mapZoom[\s\S]*#mapScale/, 'Configuração da prancha deve estar integrada à Personalização sem duplicar Mapa de fundo.');
assert.doesNotMatch(documents, /title:'Prancha'[\s\S]{0,180}#mapBackground/, 'Prancha não deve duplicar o seletor de Mapa de fundo.');
assert.match(documents, /tool:'elements'[\s\S]*\.sv-doc-options/, 'Elementos da geração devem estar integrados à Personalização.');
const pranchaConfig = documents.slice(documents.indexOf("'pranchas.html':"), documents.indexOf("'planialtimetria.html':"));
assert.doesNotMatch(pranchaConfig, /title:'Configuração da prancha'|title:'Dados do imóvel'|title:'Elementos da geração'/, 'Abas antigas não podem continuar no fluxo de Pranchas.');
assert.match(documents, /sv-doc-draft-dock/, 'Rascunhos devem sair do cabeçalho e usar uma faixa de ações inferior.');
assert.match(documents, /surveyor:beta-personalization-mounted/, 'Ações inferiores devem acompanhar a sessão integrada da Personalização.');
assert.doesNotMatch(documents, /tabs\.appendChild\(actions\)/, 'Salvar/restaurar rascunho não deve continuar no topo das abas.');

assert.match(editor, /startOptions\?\.mode === 'inline'/, 'Editor deve suportar apresentação inline sem duplicar motor.');
assert.match(editor, /sheet\.style\.width = `\$\{Math\.round\(zoomBaseWidth \* zoom\)\}px`/, 'Zoom inline deve alterar a dimensão real do documento em pixels, sem deslocar a página branca.');
assert.match(editor, /function fitZoomToViewport\(\)/, 'Editor inline deve calcular o enquadramento real da prancha dentro da área disponível.');
assert.match(editor, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => fitZoomToViewport\(\)\)\)/, 'Prancha deve abrir já ajustada ao quadro sem exigir rolagem vertical para conferência.');
assert.match(editor, /commitPreviewState/, 'Editor deve conseguir consolidar o estado visual local antes de uma atualização da prévia.');
assert.match(editor, /surveyor:technical-editor-opened/, 'Reaberturas do editor devem notificar a integração dos controles beta.');
assert.match(editor, /overlay\.setAttribute\('font-weight', '400'\)/, 'Overlay editável deve iniciar com peso tipográfico normal e não herdar negrito da interface.');
assert.match(editor, /overlay\.style\.fontSynthesis = 'none'/, 'Edição inline não deve sintetizar peso artificial nos textos técnicos.');
assert.match(editor, /function freezeSvgTypography\(svg\)/, 'Bancada inline deve congelar explicitamente o peso tipográfico do documento antes de separar fundo e overlay.');
assert.match(editor, /async function vectorBackground\(svg\)/, 'Fundo técnico inline deve permanecer vetorial, mas isolado da cascata CSS da interface.');
assert.match(editor, /if \(requestedMode === 'inline'\) raster = await vectorBackground\(parts\.background\);/, 'Modo inline deve usar SVG vetorial isolado em data URL para preservar a tipografia original sem herança da interface.');
assert.match(editor, /else raster = await rasterize\(parts\.background\);/, 'Modal legado deve preservar a rasterização existente sem regressão.');

assert.match(app, /mountPranchaBetaSourceTool\(modal,'sheet','Prancha'\)/, 'Personalização deve expor a configuração da prancha na coluna esquerda.');
assert.match(app, /mountPranchaBetaSourceTool\(modal,'elements','Elementos'\)/, 'Personalização deve expor os elementos cartográficos na coluna esquerda.');
assert.match(app, /refreshPranchaLivePreview/, 'Pranchas deve possuir atualização automática da pré-visualização.');
assert.match(app, /commitPreviewState\?\.\(\)/, 'Atualização de configuração deve preservar o estado visual em edição antes de renderizar novamente.');
assert.match(app, /refreshPranchaLivePreview\(\{projectSwitch:true,projectId:selectedProjectId\}\)/, 'Seleção do projeto deve trocar diretamente a cena da bancada com identidade explícita, sem botão Gerar.');
assert.match(app, /generateSelected\(\{ silent:true, inlineOnly:true, fastPreview:true, preferCache:true \}\)/, 'Atualizações estruturais da bancada devem usar a renderização rápida sem bloquear em recursos remotos.');
assert.doesNotMatch(app, /setPreviewMessage\('Preparando pré-visualização em tempo real/, 'Seleção de projeto não deve exibir mensagem intermediária de preparação/geração.');
assert.match(app, /structuralPranchaControls = \['mapSheetLayout','mapBackground','mapZoom'/, 'Apenas mudanças estruturais da prancha devem solicitar reconstrução da cena.');
assert.match(app, /liveTextFields = \['mapScale','mapSheetNumber','mapTitle','mapRegistration','mapDistrict'/, 'Dados textuais devem possuir atualização direta na cena.');
assert.match(app, /patchPranchaLiveFields\(\)/, 'Campos do Projeto devem atualizar o SVG montado sem reiniciar o editor.');
assert.match(editor, /function patchLiveFields\(values = \{\}\)/, 'Editor técnico deve aceitar patch textual no overlay já montado.');
assert.match(app, /fastPreview/, 'Bancada deve possuir caminho de renderização rápida local.');
assert.match(app, /pranchaSvgCache/, 'Prévia deve manter cache descartável de cenas para reabrir projetos sem nova geração completa.');
assert.match(app, /liveElementPranchaControls = new Set\(Object\.values\(ELEMENT_VISIBILITY_CONTROLS\)\)/, 'Elementos cartográficos devem possuir canal delegado de atualização direta, inclusive para checkboxes criados depois do script.');
assert.match(app, /patchDocumentLiveElements\(\)/, 'Checkboxes de Elementos devem alterar a cena persistente diretamente, sem regenerar a prancha.');
assert.match(app, /function patchSvgLiveElements\(svgText, values = \{\}\)/, 'SVG em memória deve espelhar imediatamente a visibilidade dos elementos para salvar/exportar corretamente.');
assert.match(app, /data-live-element/, 'Prancha rápida deve transportar marcadores de camada para cotas, vértices, confrontantes, norte, grade e escala.');
assert.match(editor, /function patchLiveElements\(values = \{\}, \{ persist = false \} = \{\}\)/, 'Editor inline deve ocultar/exibir camadas diretamente no overlay ativo.');
assert.match(editor, /\.sv-vertex-anchor,\.sv-vertex-label/, 'Pontos e rótulos dos vértices devem estar na camada editável para desaparecerem juntos em tempo real.');
assert.doesNotMatch(app, /structuralPranchaControls = \[[^\]]*mapShowCotas/, 'Checkboxes visuais não podem continuar forçando reconstrução estrutural da cena.');

assert.match(app, /function patchDocumentLiveElements\(\) \{[\s\S]*const editor = ensureTechnicalDocumentEditorInstance\(\);[\s\S]*editor\?\.patchLiveElements\?\.\(values,\{persist:true\}\)/, 'Checkboxes devem atingir o editor ativo mesmo quando lastSvg não estiver disponível.');
assert.doesNotMatch(app, /function patchDocumentLiveElements\(\) \{[\s\S]{0,180}!lastSvg\) return false/, 'Atualização visual dos elementos não pode depender de lastSvg para funcionar no editor inline.');
assert.match(app, /source\.dispatchEvent\(new Event\(event\.type === 'input' \? 'input' : 'change', \{ bubbles:true \}\)\)/, 'Proxy transmite o evento uma vez ao controle canônico, cujo listener aplica o patch visual.');
assert.doesNotMatch(app, /includes\(sourceId\)\) patchDocumentLiveElements\(\)/, 'Proxy não deve aplicar um segundo patch após despachar o evento original.');
assert.match(app, /editor\.patchLiveElements\?\.\(currentPranchaLiveElementValues\(\)\)/, 'Ao abrir/reabrir a bancada, o estado atual dos checkboxes deve ser reaplicado imediatamente à cena.');
assert.match(editor, /function liveElementFallbackSelectors\(element\)/, 'Editor deve localizar cotas, vértices e confrontantes por semântica mesmo se um marcador data-live-element estiver ausente.');
assert.match(editor, /\.sv-cad-dimension-group\[data-owner="perimeter"\]/, 'Cotas perimetrais devem possuir fallback semântico dedicado.');
assert.match(editor, /\.sv-vertex-anchor.*\.sv-vertex-label/s, 'Vértices devem possuir fallback semântico para ponto e rótulo.');
assert.match(editor, /style\.setProperty\('display','none','important'\)/, 'Ocultação ao vivo deve prevalecer sobre regras visuais concorrentes do editor.');

assert.match(css, /\.sv-doc-workspace\.has-draft-dock/, 'Workspace deve reservar a faixa inferior para rascunhos fora do cabeçalho.');
assert.match(css, /grid-template-columns:clamp\(330px,24vw,365px\) minmax\(0,1fr\)/, 'Personalização deve manter menu confinado à esquerda e prévia exclusiva à direita.');
assert.match(css, /\.sv-editor-tool-shell\{[\s\S]*max-width:365px[\s\S]*overflow:hidden/, 'Menus laterais não podem invadir a coluna de pré-visualização.');
assert.match(css, /\.sv-beta-source-proxy \.sv-doc-fields\.is-two\{[\s\S]*grid-template-columns:1fr/, 'Controles incorporados devem caber integralmente na coluna esquerda.');
assert.match(css, /#generateMapV19\[data-live-preview-trigger="1"\]\{display:none\}/, 'Botão manual Gerar deve ficar oculto no fluxo de prévia em tempo real.');
assert.match(css, /sv-confrontante-editor-footer\{[\s\S]*display:grid[\s\S]*grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/, 'Rodapé deve separar ações, zoom central e salvar/cancelar sem sobreposição.');

assert.match(app, /PRANCHA_MAP_TOOL_ORDER = \['elements','miniMap','vertices','lines','servitudes'\]/, 'Mapa deve agrupar Elementos, Minimapa, Vértices, Linhas e Servidões sem blocos redundantes.');
assert.match(app, /mergeConfrontantesIntoVertices\(modal\)/, 'Confrontantes devem ficar integrados ao bloco Vértices.');
assert.match(app, /removeLegacyDimensionPanel\(modal\)/, 'Editar cotas isolado deve ser removido porque os controles agora vivem no cartão Cotas.');
assert.match(app, /mapButton\.dataset\.editorTool = 'map'/, 'Personalização deve expor Mapa como função principal.');
assert.match(app, /rail\.querySelector\('\[data-editor-tool="zoom"\]'\)\?\.remove\(\)/, 'Visualização/zoom não deve permanecer no menu lateral da Prancha.');
assert.match(app, /rail\.querySelector\('\[data-editor-tool="history"\]'\)\?\.remove\(\)/, 'Histórico não deve permanecer no menu lateral da Prancha.');
assert.match(editor, /sv-editor-inline-zoom[\s\S]*data-editor-action="zoom-out"[\s\S]*data-editor-zoom-label[\s\S]*data-editor-action="zoom-in"/, 'Zoom deve existir no rodapé com menos, percentual e mais.');
assert.match(editor, /sv-editor-inline-history-btn[\s\S]*data-editor-action="undo"[\s\S]*data-editor-action="redo"/, 'Desfazer/refazer devem existir no rodapé.');

assert.match(app, /function startPranchaProjectLive\(workspace\)/, 'Etapa Projeto deve usar a mesma apresentação inline da Personalização quando houver projeto selecionado.');
assert.match(app, /if \(!select\?\.value\) \{[\s\S]*mountPranchaPreparingShell\(workspace\);[\s\S]*return true;/, 'Projeto sem seleção também deve abrir imediatamente a mesma bancada compacta, sem voltar ao layout legado de dois cartões.');
assert.doesNotMatch(app, /workspace\.dataset\.pranchaInlineMode = 'project';\s*if \(!select\?\.value\) return false;/, 'Etapa Projeto não pode abandonar a bancada inline só porque ainda não há projeto selecionado.');
assert.match(app, /function syncProjectSelectProxies\(\)/, 'Seletor clonado da bancada vazia deve acompanhar projetos carregados depois da montagem inicial.');
assert.match(app, /function appendProjectOption\(p\) \{[\s\S]*syncProjectSelectProxies\(\);[\s\S]*\n  \}/, 'Carga assíncrona dos projetos deve atualizar também o seletor visível da bancada compacta.');
assert.match(app, /workspace\.dataset\.pranchaInlineMode = 'project'/, 'Modo Projeto deve permanecer explicitamente identificado durante a prévia ao vivo.');
assert.match(app, /mountPranchaProjectLivePanel\(modal\)/, 'Projeto deve montar seu formulário real na coluna esquerda do editor inline.');
assert.match(app, /function setPranchaProjectChrome\(modal, projectMode\)/, 'Projeto deve possuir um controle explícito e único para ocultar o chrome da Personalização.');
assert.match(app, /node\.hidden = true;[\s\S]*node\.style\.display = 'none';[\s\S]*node\.setAttribute\('aria-hidden','true'\)/, 'Projeto deve ocultar de forma determinística rail/drawer para impedir o painel Prancha de vazar para a etapa Projeto.');
assert.match(app, /modal\.classList\.add\('is-project-live'\);[\s\S]*setPranchaProjectChrome\(modal, true\)/, 'Ao montar Projeto, o chrome da Personalização deve ser desligado no mesmo fluxo.');
assert.match(app, /desiredInlineMode === 'project' \|\| desiredInlineMode === 'personalization'/, 'Regeneração ao vivo deve reabrir a mesma bancada tanto em Projeto quanto em Personalização.');
assert.match(css, /is-project-live \.sv-editor-tool-rail,[\s\S]*is-project-live \.sv-editor-tool-drawer\{[\s\S]*display:none/, 'Projeto deve ocultar as ferramentas de Personalização e reservar a coluna esquerda somente aos dados do projeto.');
assert.match(css, /is-project-live \.sv-project-live-panel\{[\s\S]*overflow:auto[\s\S]*background:#fff/, 'Formulário de Projeto deve ocupar a mesma coluna compacta da Personalização sem invadir a prancha.');
assert.match(css, /\.sv-prancha-inline-preparing\{[\s\S]*grid-template-columns:clamp\(330px,24vw,365px\) minmax\(0,1fr\)/, 'Bancada vazia do Projeto deve usar exatamente a mesma proporção esquerda/direita da prancha carregada.');
assert.match(css, /\.sv-prancha-inline-empty-sheet\{[\s\S]*aspect-ratio:1\.6\/1/, 'Prévia vazia deve manter a proporção horizontal da prancha técnica até um projeto ser selecionado.');

console.log('PASS prancha-inline-personalization-beta: Projeto e Personalização compartilham bancada ao vivo, sem geração intermediária, com auto-fit e ações em um único rodapé.');
