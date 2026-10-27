import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const typographySource = fs.readFileSync('assets/js/core/technical-svg-typography.js','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const modelSource = fs.readFileSync('assets/js/core/native-technical-document.js','utf8');
const pdf = fs.readFileSync('assets/js/core/pdf-preview.js','utf8');
const css = fs.readFileSync('assets/css/core/documents.css','utf8').replace(/!important/g,'');
const uiCss = fs.readFileSync('assets/css/core/ui.css','utf8').replace(/!important/g,'');
const pranchas = fs.readFileSync('pranchas/index.html','utf8');

class FakeStyle {
  constructor() { this.fontWeight=''; this.fill=''; this.stroke=''; this.strokeWidth=''; this.paintOrder=''; this.letterSpacing=''; this.fontSynthesis=''; this.fontSynthesisWeight=''; }
  removeProperty(name) {
    const map={ 'stroke':'stroke', 'stroke-width':'strokeWidth', 'paint-order':'paintOrder', 'letter-spacing':'letterSpacing' };
    if (map[name]) this[map[name]]='';
  }
}
class FakeText {
  constructor(text, attrs={}, classes=[]) { this.textContent=text; this.attrs={...attrs}; this.style=new FakeStyle(); this.isConnected=false; this.nodeType=1; this.parentElement=null; this.classes=new Set(classes); }
  getAttribute(name){ return this.attrs[name] ?? null; }
  setAttribute(name,value){ this.attrs[name]=String(value); }
  removeAttribute(name){ delete this.attrs[name]; }
  matches(selector){ return selector.split(',').some((part)=>{const cls=part.trim().replace(/^\./,'');return this.classes.has(cls);}); }
  closest(selector){ let cur=this; while(cur){ if(cur.matches?.(selector)) return cur; cur=cur.parentElement; } return null; }
}
class FakeSvg extends FakeText {
  constructor(texts){ super('',{}); this.texts=texts; this.dataset={}; texts.forEach((node)=>{ if(!node.parentElement) node.parentElement=this; }); }
  querySelectorAll(selector){ if(selector==='text') return this.texts.filter((n)=>n.kind!=='tspan'); if(selector==='text,tspan') return this.texts; return []; }
}

const typographySandbox={ window:{}, console };
vm.runInNewContext(typographySource, typographySandbox, {filename:'technical-svg-typography.js'});
const typography=typographySandbox.window.SurveyorTechnicalSvgTypography;
assert.ok(typography, 'Política tipográfica compartilhada deve existir.');

const dimension=new FakeText('73,50 m',{x:'10',y:'20','font-size':'9','font-weight':'700',stroke:'#fff','stroke-width':'2','paint-order':'stroke fill'});
const heading=new FakeText('TÍTULO',{x:'20',y:'30','font-size':'18','font-weight':'900'});
const coordinate=new FakeText('-39,5382',{x:'30',y:'40','font-size':'9'});
const areaName=new FakeText('JOSEFA',{x:'40',y:'50','font-size':'12','font-weight':'800',fill:'#111827',stroke:'#fff','stroke-width':'2','paint-order':'stroke fill'},['sv-area-name-text']);
const svg=new FakeSvg([dimension,heading,coordinate,areaName]);
const before=typography.audit(svg);
assert.equal(before.strokedTexts,2,'Auditoria deve detectar halos existentes antes da normalização.');
assert.ok(before.implicitFillTexts>=3,'Auditoria deve identificar textos que dependiam de fill implícito.');
typography.normalize(svg);
const after=typography.audit(svg);
assert.equal(dimension.getAttribute('stroke'),'none','Cota normalizada deve neutralizar explicitamente stroke herdado.');
assert.equal(heading.getAttribute('font-weight'),'700','Peso 900 deve convergir para peso técnico suportado.');
assert.equal(coordinate.getAttribute('font-weight'),'400','Coordenada sem peso explícito deve permanecer normal.');
assert.equal(coordinate.getAttribute('fill'),'#111827','Texto técnico sem fill explícito deve receber cor explícita e nunca desaparecer no canvas nativo.');
assert.equal(heading.getAttribute('fill'),'#111827','Título sem fill explícito deve continuar visível após normalização.');
assert.equal(areaName.getAttribute('stroke'),'#fff','Halo semântico de nome editável deve ser preservado.');
assert.equal(areaName.getAttribute('paint-order'),'stroke fill','Paint-order semântico deve ser preservado no nome editável.');
assert.equal(svg.dataset.technicalTypographyProfile,'surveyor-vector-pdf-v2');

const modelSandbox={ window:{}, globalThis:null, structuredClone:global.structuredClone, console };
modelSandbox.globalThis=modelSandbox;
vm.runInNewContext(modelSource, modelSandbox, {filename:'native-technical-document.js'});
const nativeApi=modelSandbox.window.SurveyorNativeTechnicalDocument;
const model=nativeApi.create({project:{id:'p1',geojson:{features:[{properties:{category:'perimetro'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]}}});
const renderTextA=new FakeText('A',{x:'1',y:'2','font-size':'9','font-weight':'400',fill:'#111827'});renderTextA.closest=()=>null;
const renderTextB=new FakeText('B',{x:'3',y:'4','font-size':'13','font-weight':'700',fill:'#111827'});renderTextB.closest=()=>null;
const renderSvg={querySelectorAll(selector){return selector==='text'?[renderTextA,renderTextB]:[];}};
const renderModel=nativeApi.captureRenderModel(model,renderSvg);
assert.equal(renderModel.texts.length,2,'Documento nativo deve registrar todos os textos realmente montados.');
assert.equal(model.renderModel.texts[0].fontWeight,'400');
assert.ok(renderTextA.getAttribute('data-native-render-id'),'Texto renderizado deve receber vínculo estável com o modelo nativo.');

const typographyIndex=pranchas.indexOf('/assets/js/core/technical-svg-typography.js');
const nativeIndex=pranchas.indexOf('/assets/js/core/native-technical-document.js');
const editorIndex=pranchas.indexOf('/assets/js/core/technical-document-editor.js');
const pdfIndex=pranchas.indexOf('/assets/js/core/pdf-preview.js');
assert.ok(typographyIndex>=0 && typographyIndex<nativeIndex && typographyIndex<editorIndex && typographyIndex<pdfIndex,'Política tipográfica deve carregar antes do modelo, editor e exportador PDF.');
assert.match(pdf,/window\.SurveyorTechnicalSvgTypography\?\.normalize/,'PDF deve usar a mesma política tipográfica da bancada nativa.');
assert.match(editor,/typography\?\.audit\?\.\(source\)/,'Editor deve auditar o SVG efetivamente recebido antes de normalizar.');
assert.match(editor,/typography\.normalize\(source\)/,'Editor nativo deve aplicar a política tipográfica compartilhada ao SVG real.');
assert.match(editor,/captureRenderModel\?\.\(documentModel, source\)/,'Editor deve registrar a projeção textual real no documento nativo.');
assert.match(editor,/type:'native-render-text'/,'Todos os primitivos textuais capturados devem entrar na Scene para diagnóstico do motor.');
assert.match(editor,/typographyAudit:nativeTypographyAudit/,'Runtime deve expor auditoria tipográfica da sessão real.');
assert.match(css,/\.sv-native-document-canvas\{[\s\S]*text-rendering:geometricPrecision/,'Canvas nativo deve manter renderização vetorial estável.');
assert.match(css,/\.sv-native-document-canvas text:not\(\.sv-area-name-text\):not\(\.sv-confrontante-name-text\)\{[\s\S]*stroke:none;[\s\S]*paint-order:normal/,'A bancada pode neutralizar stroke apenas na apresentação de textos comuns, sem alterar nomes com halo.');
assert.doesNotMatch(uiCss,/body\[data-page="pranchas\.html"\] \.preview[\s\S]{0,600}font-weight:500/,'Preview de Pranchas não pode impor peso 500 herdável sobre textos SVG.');

console.log('PASS native-typography-audit-v209: tipografia preserva fill/visibilidade, remove peso herdado e mantém halos apenas onde são semânticos.');
