import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const modelSource = fs.readFileSync('assets/js/core/native-technical-document.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const app = fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const pranchas = fs.readFileSync('pranchas/index.html','utf8');

const sandbox = { window:{}, globalThis:null, structuredClone: global.structuredClone, console };
sandbox.globalThis = sandbox;
vm.runInNewContext(modelSource, sandbox, { filename:'native-technical-document.js' });
const api = sandbox.window.SurveyorNativeTechnicalDocument;
assert.ok(api, 'Modelo técnico nativo deve expor runtime oficial.');
const model = api.create({
  project:{ id:'p1', propertyName:'Fazenda Teste', geojson:{features:[{type:'Feature',properties:{category:'perimetro'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]} },
  fields:{ mapTitle:'PLANTA TESTE', mapScale:'1:2.000' },
  elements:{ cotas:true, vertices:true, confrontantes:true, north:true, grid:true, scale:true },
  settings:{ areaNames:[{id:'a1',text:'GLEBA A',xG:.5,yG:.5}], signatureEnabled:false }
});
assert.equal(api.valid(model), true, 'Modelo criado deve ser reconhecido como documento nativo.');
assert.equal(model.fields.mapTitle, 'PLANTA TESTE');
assert.ok(model.objects.some((node)=>node.id==='field:mapTitle' && node.type==='text'), 'Textos devem existir como objetos independentes.');
assert.ok(model.objects.some((node)=>node.type==='vertex-label'), 'Vértices/rótulos devem existir como objetos independentes.');
assert.ok(model.objects.some((node)=>node.id==='area-name:a1'), 'Nomes de área devem existir no modelo nativo.');
api.patchField(model,'mapTitle','PLANTA ALTERADA');
assert.equal(model.fields.mapTitle,'PLANTA ALTERADA','Campo deve ser editado no modelo, sem reconstruir PDF/SVG.');
api.patchElement(model,'cotas',false);
assert.equal(model.elements.cotas,false,'Visibilidade de camada deve pertencer ao modelo nativo.');

const nativeScriptIndex = pranchas.indexOf('/assets/js/core/native-technical-document.js');
const editorScriptIndex = pranchas.indexOf('/assets/js/core/technical-document-editor.js');
assert.ok(nativeScriptIndex >= 0 && nativeScriptIndex < editorScriptIndex, 'Pranchas deve carregar o modelo nativo antes do editor.');
assert.match(app, /let lastNativeDocument = null;/, 'Gerador deve manter o documento nativo corrente.');
assert.match(app, /getNativeDocument: \(\) => lastNativeDocument/, 'Editor deve receber o modelo nativo diretamente.');
assert.match(app, /onNativeSvgChange:[\s\S]*lastSvg = svgText/, 'SVG final deve ser apenas a renderização/exportação do estado editado nativo.');
assert.match(editor, /function mountNativeDocumentSvg\(sourceText, documentModel = null\)/, 'Editor deve montar a projeção SVG vetorial junto do documento nativo, sem converter PDF para SVG.');
assert.match(editor, /nativeMode = Boolean\(nativeDocument\)/, 'Bancada de Pranchas deve ativar o caminho nativo quando o modelo existe.');
assert.match(editor, /nativeMode\?'':`<img class="sv-confrontante-editor-background"/, 'Modo nativo não deve duplicar a prancha com imagem de fundo mais overlay.');
assert.match(editor, /engine\.addNode\(\{ id:'native-document', type:'native-document'/, 'SurveyorEditorEngine deve receber o documento nativo como nó raiz.');
assert.match(editor, /type:`native-\$\{objectNode\.type \|\| 'object'\}`/, 'Objetos nativos devem entrar na Scene do motor próprio.');
assert.match(editor, /mode:nativeMode\?'native':'legacy-svg'/, 'Diagnóstico do engine deve informar se a sessão está no modo nativo.');
assert.match(editor, /if \(!wasNativeMode\) await options\.regenerate\?\.\(\);/, 'Salvar no modo nativo não deve regenerar a prancha pelo fluxo legado.');
assert.match(editor, /function parseSvg\(sourceText\)/, 'Fluxo legado deve permanecer como fallback durante a homologação.');

console.log('PASS native-technical-document-v207: Pranchas usa modelo semântico nativo + SurveyorEditorEngine; a projeção SVG continua vetorial e o legado PDF→SVG não retorna ao fluxo.');
