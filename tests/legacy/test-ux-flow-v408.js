import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(name)=>fs.readFileSync(name,'utf8');
const customHtml=read('customizacao/index.html');
const customJs=read('assets/js/features/customizacao/app.js');
const memorialHtml=read('memorial/index.html');
const memorialJs=read('assets/js/features/memorial/app.js');
const auditCss=read('assets/css/core/ui.css');

assert.match(customHtml,/id="customizationChooser"/,'Personalização deve abrir no seletor de áreas.');
assert.match(customHtml,/id="customizationEditor" hidden/,'O editor deve começar fechado.');
assert.match(customHtml,/← Voltar e escolher outro/,'O editor precisa permitir voltar ao seletor.');
assert.match(customHtml,/id="saveCustomizationTop"[^>]*hidden/,'Salvar não deve aparecer antes da escolha.');
assert.match(customJs,/function setCustomizationView/,'O fluxo precisa separar escolha e edição.');
assert.match(customJs,/openDocumentPicker\(\);\n  \}/,'Ao carregar, deve voltar para a tela de escolha.');
assert.doesNotMatch(customHtml,/custom-target-card active/,'Nenhum documento deve vir selecionado visualmente na entrada.');

assert.match(memorialHtml,/id="memorialOutput" hidden/,'A área de pré-visualização deve começar totalmente oculta.');
assert.doesNotMatch(memorialHtml,/Selecione um projeto e clique em [“"]Gerar memorial/,'A página não deve exibir uma caixa vazia de pré-visualização.');
assert.match(memorialJs,/function showMemorialPreview/,'A área deve ser exibida somente sob demanda.');
assert.match(memorialJs,/function hideMemorialPreview/,'A área deve voltar a ficar oculta quando a geração for invalidada.');
assert.match(memorialJs,/hideMemorialPreview\(\{ clear: true \}\);[\s\S]*loadMemorialTemplatePreference/,'A instalação deve começar com a pré-visualização escondida.');
assert.match(auditCss + read('assets/css/features/memorial/memorial-preview.css'),/#memorialOutput\[hidden\][\s\S]*display:none!important/,'O CSS oculto deve vencer o display flex da pré-visualização.');

assert.match(memorialHtml,/id="memorialGenerationProgress" hidden/,'Memorial precisa de painel de progresso.');
assert.match(memorialHtml,/Dados<\/li>.*Cálculos<\/li>.*Mapa<\/li>.*Páginas<\/li>.*PDF<\/li>/s,'O progresso deve mostrar etapas compreensíveis.');
assert.match(memorialJs,/function startMemorialProgress/,'A geração precisa iniciar o progresso.');
assert.match(memorialJs,/setMemorialProgress\(42,'Preparando o mapa e o QR Code/,'A etapa demorada do mapa deve ser indicada.');
assert.match(memorialJs,/Montando página \$\{index\+1\} de \$\{fixedPages\.length\}/,'O progresso deve acompanhar a montagem das páginas.');
assert.match(memorialJs,/finishMemorialProgress\(generatedSuccessfully/,'O botão deve ser liberado ao terminar ou falhar.');

assert.match(auditCss,/\.nav a > span/,'A auditoria precisa proteger os nomes do menu contra texto grudado.');
assert.match(auditCss,/\.form-grid>label>input/,'Campos devem manter espaçamento entre rótulo e controle.');
assert.match(auditCss,/\.custom-target-card/,'Cards de personalização devem manter título e descrição separados.');
console.log('OK v21.9.409: Personalização em duas etapas, progresso e pré-visualização somente sob demanda.');
