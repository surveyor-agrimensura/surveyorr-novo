import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../assets/js/features/memorial/app.js',import.meta.url),'utf8');
const start=source.indexOf('  function memorialSignaturePlacement(');
const finish=source.indexOf('  function scaleMemorialPreviewHost(',start);
assert.ok(start>0&&finish>start);
const buildCode=source.slice(start,finish);
async function scenario({account=false,imported=false}={}){
  const pdfCalls=[],filesRemoved=[];
  const embedded=Array.from({length:2},(_,i)=>({getAttribute(k){return k==='src'?`data:image/png;base64,YWNjb3VudA==`:'';},remove(){filesRemoved.push(i);}}));
  const pages=Array.from({length:2},()=>({scrollWidth:794,scrollHeight:1123,querySelector(){return null;},appendChild(){}}));
  const host={style:{cssText:''},innerHTML:'',querySelectorAll(selector){if(selector.includes('.standard-signature-image'))return embedded;if(selector.includes('.custom-memorial-page'))return pages;return [];},remove(){}};
  const document={body:{appendChild(){}},createElement(name){if(name==='div')return host;return {className:'',textContent:''};},fonts:{ready:Promise.resolve()}};
  class FakePdf{addPage(){}addImage(data,format,...args){pdfCalls.push({data,format,args});}output(){return new Blob(['pdf'],{type:'application/pdf'});}}
  const ctx=vm.createContext({
    document,window:{jspdf:{jsPDF:FakePdf},html2canvas:async()=>({toDataURL(){return 'data:image/jpeg;base64,cGFnZQ==';}})},
    lastPdfHtml:'<div>memorial</div>',lastMemorialHtml:'<div>memorial</div>',lastRenderedPdfPages:[],memorialPdfPageCache:[],
    memorialEditSettings:{includeSignature:account,importedSignatureEnabled:imported,signaturePageIndex:1,signatureWidth:28,signatureX:50,signatureY:58},
    async readMemorialImportedSignature(){return imported?{dataUrl:'data:image/png;base64,aW1wb3J0ZWQ=',height:30,width:100}:null;},
    async resolveMemorialSignature(){return 'data:image/png;base64,YWNjb3VudA==';},
    documentCss(){return '';},async ensurePdfLibraries(){},
    async boundedStep(name,fn){return fn();},async withTimeout(value){return value;},async waitForImages(){},
    requestAnimationFrame(cb){cb();},Image:class{set src(v){this.naturalWidth=100;this.naturalHeight=30;this.onload();}}
  });
  vm.runInContext(buildCode+'\nglobalThis.buildPdf=buildMemorialPdfBlob;',ctx);
  const blob=await ctx.buildPdf();
  assert.equal(blob.type,'application/pdf');
  assert.equal(filesRemoved.length,2,'Imagens de assinatura do HTML devem sempre ser removidas antes da rasterização');
  const png=pdfCalls.filter(x=>x.format==='PNG');
  assert.equal(png.length,Number(account)+Number(imported),'Somente uma imagem por assinatura habilitada deve ser adicionada ao PDF');
  const jpg=pdfCalls.filter(x=>x.format==='JPEG');
  assert.equal(jpg.length,2,'Cada página deve ser renderizada uma vez');
  return {pdfCalls,filesRemoved};
}
await scenario();
await scenario({account:true});
await scenario({imported:true});
await scenario({account:true,imported:true});
assert.match(source,/generate\(\{reason:'export',silent:true\}\)/,'Download PDF deve atualizar documento antes de exportar');
assert.match(source,/if\(generated!==true\)throw new Error/,'Salvar não pode indicar sucesso se falhar a geração');
console.log('PASS memorial-pdf-signature-single-source: PDF com zero, uma e duas assinaturas e sem imagens herdadas.');
