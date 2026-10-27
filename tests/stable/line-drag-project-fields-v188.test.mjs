import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const mapApp = fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const mapHtml = fs.readFileSync('mapa/index.html','utf8');
const memorialHtml = fs.readFileSync('memorial/index.html','utf8');
const pranchasHtml = fs.readFileSync('pranchas/index.html','utf8');
const mapas = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const memorial = fs.readFileSync('assets/js/features/memorial/app.js','utf8');
const pdfPreview = fs.readFileSync('assets/js/core/pdf-preview.js','utf8');
const confrontantesSource = fs.readFileSync('assets/js/features/mapas/confrontantes.js','utf8');

assert.match(editor, /stage:'technical-line-drag'/, 'Linhas técnicas devem usar modo de arraste, não fluxo de dois cliques.');
assert.match(editor, /pointerdown[\s\S]*pointermove[\s\S]*pointerup/, 'Desenho deve fechar no gesto pressionar-arrastar-soltar.');
assert.match(editor, /technicalLineStartPoint[\s\S]*sv-confrontante-editor-anchor/, 'Início da linha deve fazer snap nos vértices técnicos.');
assert.doesNotMatch(editor, /technical-line-start|technical-line-end/, 'Estados legados de dois cliques não devem permanecer ativos.');
assert.match(mapHtml, /id="ownerCpf"[\s\S]*id="ownerRg"/, 'Cadastro do projeto deve expor CPF e RG opcionais.');
assert.match(mapApp, /ownerCpf[\s\S]*ownerRg/, 'CPF e RG devem entrar no estado persistido do projeto.');
assert.match(memorialHtml, /id="memCnib"/, 'Memorial deve expor Número CIB.');
assert.match(pranchasHtml, /id="mapCnib"/, 'Prancha deve expor Número CIB.');
assert.match(mapas, /cleanDocumentValue[\s\S]*Número CIB/, 'Quadro técnico deve ocultar valores opcionais vazios e incluir CIB quando informado.');
assert.match(memorial, /optionalIdentityValue[\s\S]*Número CIB/, 'Memorial deve omitir rótulos opcionais sem valor e incluir CIB quando informado.');
assert.match(mapHtml, /id="confrontanteQuickProperty"[\s\S]*id="confrontantePropriedade"/, 'Mapa deve cadastrar nome do confrontante e propriedade.');
assert.match(editor, /confrontanteProperty[\s\S]*labelXG[\s\S]*labelYG/, 'Editor deve persistir propriedade e posição absoluta do rótulo do confrontante.');
assert.match(pdfPreview, /svg2pdf\.js@2\.7\.0/g, 'Fallback SVG→PDF deve usar a mesma versão 2.7.0 usada pelas páginas técnicas.');

const context={window:{},console};
vm.createContext(context);
vm.runInContext(confrontantesSource,context);
const confrontantes=context.window.SurveyorDocumentConfrontantes.create({escape:(value)=>String(value??'')});
const feature={properties:{confrontanteVisualLayout:{version:8,segments:[{id:'c1',nome:'João',propriedade:'Fazenda Jacuba',coordinateSpace:'geometry-v1',startVertex:1,endVertex:2,segmentIndexes:[0],labelXG:.75,labelYG:.20,labelScale:1}]}}};
const coords=[[0,0],[4,0],[4,3],[0,3],[0,0]];
const svg=confrontantes.smartConfrontanteLabels(feature,coords,([x,y])=>[100+x*100,100+y*100],{x:80,y:80,w:500,h:400},{placement:'boundary',fontSize:10});
assert.match(svg,/data-confrontante-property="Fazenda Jacuba"/, 'Propriedade do confrontante deve acompanhar o estado documental.');
assert.match(svg,/João — Fazenda Jacuba/, 'Nome e propriedade devem ser apresentados juntos na chamada documental.');
assert.match(svg,/data-dx="0\.00" data-dy="0\.00"/, 'Posição absoluta persistida não deve receber novo deslocamento automático ao regenerar.');

console.log('PASS line-drag-project-fields-v188: arraste de linha, dados do projeto, CIB, confrontante/propriedade e PDF consistente validados.');
