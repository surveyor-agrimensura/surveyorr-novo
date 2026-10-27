import fs from 'node:fs';
import assert from 'node:assert/strict';

const documents = fs.readFileSync('assets/js/core/documents.js','utf8');
const maps = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const memorial = fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const perimetros = fs.readFileSync('assets/js/features/perimetros/app.js','utf8');
const planialtimetria = fs.readFileSync('assets/js/features/planialtimetria/app.js','utf8');
const loteamentos = fs.readFileSync('assets/js/features/loteamentos-reurb/app.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8');

assert.match(documents, /'mapas\.html':[\s\S]*sections:\[[\s\S]*title:'Projeto'[\s\S]*title:'Personalização', betaPersonalization:true/, 'Mapas/Croquis deve seguir Projeto → Personalização como a Prancha Técnica.');
assert.match(documents, /tool:'sheet', title:'Croqui'[\s\S]*tool:'elements', title:'Elementos'/, 'Personalização de Mapas/Croquis deve integrar Croqui e Elementos.');
assert.doesNotMatch(documents, /bottomActionSelectors:\['#generateMapV19','#editConfrontanteLabelsBtn'/, 'Editar croqui não pode voltar ao rodapé.');
assert.match(maps, /async function startMapasPersonalization\(workspace\)/, 'Mapas/Croquis deve abrir o SurveyorEditorEngine em Personalização.');
assert.match(maps, /editor\.start\(\{ mode:'inline', mount:workspace \}\)/, 'Editor do Croqui deve ser montado inline na mesma bancada documental.');
assert.match(maps, /mountPranchaBetaSourceTool\(modal,'sheet','Croqui'\)/, 'Croqui deve aparecer como ferramenta de personalização no mesmo padrão da Prancha.');
assert.match(maps, /const CROQUI_MAP_TOOL_ORDER = \['elements','vertices','lines','servitudes'\]/, 'Mapa do Croqui deve concentrar as ferramentas cartográficas aplicáveis sem Confrontantes e Editar cotas duplicados.');
assert.doesNotMatch(maps, /Editar croqui/, 'Implementação antiga com botão Editar croqui deve ser eliminada.');

assert.match(documents, /'memorial\.html':[\s\S]*title:'Personalização', betaPersonalization:true, runtimePersonalization:true, betaBadge:false/, 'Memorial deve possuir etapa Personalização integrada.');
assert.match(memorial, /memorial-personalization-tabs[\s\S]*Memorial[\s\S]*Mapa[\s\S]*Assinatura/, 'Memorial deve organizar a Personalização por Memorial, Mapa e Assinatura.');
assert.doesNotMatch(memorial, /data-memorial-personalization-tool=\"appearance\"/, 'Memorial não deve reservar espaço para uma aba Aparência vazia.');
assert.match(memorial, /openMemorialEditDialog\(\{inlineMount:workspace\}\)/, 'Memorial deve usar a própria bancada inline em Personalização.');
assert.doesNotMatch(memorial, /SurveyorTechnicalDocumentEditor/, 'Memorial deve manter apenas opções visuais de mapa e assinatura, sem editor técnico completo.');
assert.match(editor, /optionValue\(options, 'standaloneControls', true\) === false/, 'Motor documental deve permitir integração sem controles legados independentes.');
assert.match(css, /body\.sv-document-inline-personalization \.memorial-sign-modal\.is-inline-personalization[\s\S]*height:100%/, 'Memorial inline deve ocupar a mesma bancada compacta.');
assert.match(css, /body\.sv-document-inline-personalization \.sv-confrontante-editor-modal\.is-inline-beta/, 'Editor técnico inline deve ser compartilhado por todos os documentos que usam Personalização.');

assert.match(documents, /'perimetros\.html':[\s\S]*title:'Personalização', betaPersonalization:true/, 'Perímetros deve concentrar a edição técnica na etapa Personalização.');
assert.match(perimetros, /standaloneControls: false/, 'Perímetros não deve criar botão Editar planta independente.');
assert.match(perimetros, /startPerimeterPersonalization\(workspace\)/, 'Perímetros deve abrir o editor técnico inline pela etapa Personalização.');

assert.match(documents, /'planialtimetria\.html':[\s\S]*title:'Personalização', betaPersonalization:true/, 'Planialtimetria deve concentrar a edição técnica na etapa Personalização.');
assert.match(planialtimetria, /standaloneControls: false/, 'Planialtimetria não deve criar botão Editar independente.');
assert.match(planialtimetria, /startPlanialtimetriaPersonalization\(workspace\)/, 'Planialtimetria deve abrir o editor técnico inline pela etapa Personalização.');

assert.match(documents, /'loteamentos-reurb\.html':[\s\S]*title:'Personalização', betaPersonalization:true/, 'Croqui do lote deve concentrar a edição técnica em uma etapa Personalização.');
assert.doesNotMatch(documents, /#editLotTechnicalMapBtn|#resetLotTechnicalMapBtn/, 'Loteamentos não deve reintroduzir ações Editar/Restaurar como botões da etapa.');
assert.match(loteamentos, /standaloneControls:false/, 'Croqui do lote não deve criar botões técnicos independentes.');
assert.match(loteamentos, /startLotPersonalization\(workspace\)/, 'Croqui do lote deve abrir o editor técnico inline pela etapa Personalização.');
assert.equal((css.match(/!important/g)||[]).length,0,'documents.css deve permanecer sem !important.');

console.log('PASS V230: edição documental centralizada na etapa Personalização para Prancha, Croqui, Memorial e croqui de lote.');
