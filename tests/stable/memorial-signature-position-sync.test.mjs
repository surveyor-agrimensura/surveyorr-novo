import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../../assets/js/features/memorial/app.js',import.meta.url),'utf8');
function code(start,end){
  const i=source.indexOf(start),j=source.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,`Não foi possível isolar ${start}`);
  return source.slice(i,j);
}
const settings={includeSignature:true,importedSignatureEnabled:false,signaturePageIndex:1,signatureX:50,signatureY:58,signatureWidth:28};
const signer={pageIndex:3,x:37,y:76,width:21};
let stored=null;
const ctx=vm.createContext({
  memorialEditSettings:settings,memorialSigner:signer,
  saveMemorialEditSettings(){stored={...settings};},
  clampSignerPosition(){},
  pdfGenerationSerial:0,memorialPendingEdits:false,memorialPdfDocumentReady:true,revokePdfPreviewUrl(){},updateSignerUi(){},notifyMemorialDirty(){},scheduleMemorialLiveRegeneration(){},
  signerModal(){return {hidden:true,dataset:{activePersonalizationTool:'memorial'}};},
  $(id){return {checked:true};}
});
vm.runInContext(code('  function syncMemorialSignaturePosition()', '  function removeMemorialSignatureFromDocument(')
  +code('  function captureMemorialEditSettings()', '  async function saveMemorialDocumentState()')
  +'\nglobalThis.savePosition=updateMemorialSignatureSelection;globalThis.captureSettings=captureMemorialEditSettings;',ctx);
ctx.savePosition();
assert.deepEqual(stored,{includeSignature:true,importedSignatureEnabled:false,signaturePageIndex:3,signatureX:37,signatureY:76,signatureWidth:21},'Arrasto deve salvar coordenadas visíveis, não posição antiga');
signer.pageIndex=0;signer.x=50;signer.y=58;signer.width=28;
ctx.captureSettings();
assert.deepEqual(stored,{includeSignature:true,importedSignatureEnabled:false,signaturePageIndex:3,signatureX:37,signatureY:76,signatureWidth:21},'Salvar com editor fechado não pode restaurar coordenadas antigas');

// A mesma geometria do PDF governa a folha responsiva do navegador.
vm.runInContext(code('  function memorialSignaturePlacement(', '  async function buildMemorialPdfBlob()')+'\nglobalThis.placement=memorialSignaturePlacement;',ctx);
const pos=ctx.placement(0.3);
assert.ok(Math.abs(pos.xMm-((210*.37)-(210*.21/2)))<1e-8);
assert.ok(Math.abs(pos.yMm-((297*.76)-(210*.21*.3/2)))<1e-8);
assert.ok(Math.abs(pos.topPct*2.97-pos.yMm)<1e-8);

// Simula o HTML da prévia com dimensões responsivas e imagens embutidas legadas.
const page={appended:[],removed:0,querySelectorAll(selector){return selector.includes('.standard-signature-image')?[{remove:()=>this.removed++}]:[]},appendChild(node){this.appended.push(node)}};
const root={querySelectorAll(){return [page]}};
const fakeDoc={
  createElement(){return {style:{cssText:''},setAttribute(){},src:'',alt:''}},
};
const ctxPreview=vm.createContext({
  memorialEditSettings:settings,document:fakeDoc,
  memorialSignaturePlacement:(...args)=>ctx.placement(...args),
  async resolveMemorialSignature(){return 'data:image/png;base64,YWNjb3VudA=='},
  async imageDimensions(){return {width:100,height:30}},
  async readMemorialImportedSignature(){return null}
});
vm.runInContext(code('  async function applyMemorialPreviewSignatureLayout(', '  function renderMemorialPersonalizationPreview(')
  +'\nglobalThis.placePreview=applyMemorialPreviewSignatureLayout;',ctxPreview);
await ctxPreview.placePreview(root);
assert.equal(page.removed,1,'Imagem fixa antiga deve ser retirada da prévia');
assert.equal(page.appended.length,1,'Somente a imagem posicionada deve aparecer');
const css=page.appended[0].style.cssText;
const percent=(key)=>Number(css.match(new RegExp(`${key}:([0-9.]+)%`))?.[1]);
assert.ok(Math.abs(percent('left')-pos.leftPct)<1e-8,`x da prévia (${percent('left')}) difere do PDF (${pos.leftPct})`);
assert.ok(Math.abs(percent('top')-pos.topPct)<1e-8,`y da prévia (${percent('top')}) difere do PDF (${pos.topPct})`);
assert.ok(Math.abs(percent('width')-pos.widthPct)<1e-8);
assert.ok(Math.abs(percent('height')-pos.heightPct)<1e-8);
assert.ok(!css.includes('mm;'),'Prévia responsiva não pode posicionar assinatura em milímetros fixos');

// Verifica chamada real de addImage(PNG) no PDF com o mesmo x/y após persistência.
const pdfCalls=[];
class FakePdf{
  addPage(){}
  addImage(data,format,...args){pdfCalls.push({format,args})}
  output(){return new Blob(['pdf'],{type:'application/pdf'})}
}
const embedded=[{getAttribute(){return 'data:image/png;base64,YWNjb3VudA=='},remove(){}}];
const pdfPages=Array.from({length:4},()=>({scrollWidth:794,scrollHeight:1123,querySelector(){return null},appendChild(){}}));
const pdfHost={style:{cssText:''},innerHTML:'',querySelectorAll(selector){
  if(selector.includes('.standard-signature-image'))return embedded;
  if(selector.includes('.custom-memorial-page'))return pdfPages;
  return [];
},remove(){}};
const pdfCtx=vm.createContext({
  memorialEditSettings:settings,
  document:{createElement(tag){return tag==='div'?pdfHost:{className:'',textContent:''}},body:{appendChild(){}},fonts:{ready:Promise.resolve()}},
  window:{jspdf:{jsPDF:FakePdf},html2canvas:async()=>({toDataURL(){return 'data:image/jpeg;base64,cGFnZQ=='}})},
  lastPdfHtml:'<div>memorial</div>',lastMemorialHtml:'<div>memorial</div>',lastRenderedPdfPages:[],memorialPdfPageCache:[],
  async readMemorialImportedSignature(){return null},async resolveMemorialSignature(){return 'data:image/png;base64,YWNjb3VudA=='},
  documentCss(){return ''},async ensurePdfLibraries(){},async boundedStep(_name,fn){return fn()},async withTimeout(v){return v},async waitForImages(){},
  requestAnimationFrame(cb){cb()},Image:class{set src(v){this.naturalWidth=100;this.naturalHeight=30;this.onload()}}
});
vm.runInContext(code('  function memorialSignaturePlacement(', '  function scaleMemorialPreviewHost(')
  +'\nglobalThis.buildPdf=buildMemorialPdfBlob;',pdfCtx);
const blob=await pdfCtx.buildPdf();
assert.equal(blob.type,'application/pdf');
assert.equal(pdfCalls.filter(call=>call.format==='JPEG').length,4);
const png=pdfCalls.filter(call=>call.format==='PNG');
assert.equal(png.length,1);
for(const [actual,expected] of [[png[0].args[0],pos.xMm],[png[0].args[1],pos.yMm],[png[0].args[2],pos.widthMm],[png[0].args[3],pos.heightMm]]){
  assert.ok(Math.abs(actual-expected)<1e-8,`Coordenada do PDF diverge da prévia: ${actual} != ${expected}`);
}
assert.match(source,/if\(signatureMode\)\{\s*memorialSigner\.pageIndex=detectMemorialPageIndex\('signature'\)/,'Troca para outras abas não pode substituir a página assinada');
console.log('PASS memorial-signature-position-sync: arrasto persistido, salvamento sem reversão, prévia responsiva e PDF em coordenadas idênticas.');
