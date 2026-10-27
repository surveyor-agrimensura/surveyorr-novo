import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../../assets/js/features/memorial/app.js',import.meta.url),'utf8');
function block(start,end){
  const begin=source.indexOf(start);
  const finish=source.indexOf(end,begin+start.length);
  assert.ok(begin>=0&&finish>begin,`Trecho esperado: ${start}`);
  return source.slice(begin,finish);
}

// Imagem quebrada já possui complete=true; jamais aguardar 8 segundos por ela.
{
  const ctx=vm.createContext({Promise,setTimeout(){throw new Error('Não aguardar imagem já concluída/com erro.');}});
  vm.runInContext(`${block('  function waitForImages(', '  async function ensurePdfLibraries(')}\nglobalThis.wait=waitForImages;`,ctx);
  const failed={complete:true,naturalWidth:0,addEventListener(){throw new Error('Evento de erro já foi emitido.');}};
  await ctx.wait({querySelectorAll(){return [failed];}});
}

// Páginas idênticas reaproveitam o JPEG. Ajustar apenas a assinatura muda
// somente o overlay PNG, sem rasterizar novamente os quatro fundos A4.
{
  let imageRenders=0;
  const pdfInstances=[];
  const pages=Array.from({length:4},(_,index)=>({
    scrollWidth:794,scrollHeight:1123,outerHTML:`<section class="standard-memorial-page">Página ${index}</section>`,
    querySelector(){return null;},appendChild(){}
  }));
  const host={style:{cssText:''},innerHTML:'',querySelectorAll(selector){
    if(selector.includes('.standard-signature-image'))return [];
    if(selector.includes('.custom-memorial-page'))return pages;
    return [];
  },remove(){}};
  const document={body:{appendChild(){}},createElement(tag){return tag==='div'?host:{className:'',textContent:''};},fonts:{ready:Promise.resolve()}};
  class FakePdf{
    constructor(){this.images=[];pdfInstances.push(this);}
    addPage(){}
    addImage(data,format,x,y,w,h){this.images.push({data,format,x,y,w,h});}
    output(){return new Blob(['pdf'],{type:'application/pdf'});}
  }
  const ctx=vm.createContext({
    document,window:{jspdf:{jsPDF:FakePdf},html2canvas:async()=>{imageRenders++;return {toDataURL(){return `data:image/jpeg;base64,cGFnZQ==${imageRenders}`;}};}},
    lastPdfHtml:'<article>Memorial</article>',lastMemorialHtml:'<article>Memorial</article>',lastRenderedPdfPages:[],memorialPdfPageCache:[],
    memorialEditSettings:{includeSignature:true,importedSignatureEnabled:false,signaturePageIndex:3,signatureWidth:28,signatureX:50,signatureY:58},
    async readMemorialImportedSignature(){return null;},async resolveMemorialSignature(){return 'data:image/png;base64,c2ln';},
    documentCss(){return '';},async ensurePdfLibraries(){},
    async boundedStep(name,fn){return fn();},async withTimeout(value){return value;},async waitForImages(){},
    requestAnimationFrame(cb){cb();},Image:class{set src(value){this.naturalWidth=100;this.naturalHeight=30;this.onload();}}
  });
  vm.runInContext(`${block('  function memorialSignaturePlacement(', '  function scaleMemorialPreviewHost(')}\nglobalThis.build=buildMemorialPdfBlob;`,ctx);
  await ctx.build();
  assert.equal(imageRenders,4,'Primeiro PDF deve renderizar todas as páginas');
  const signatureBefore=pdfInstances.at(-1).images.find((image)=>image.format==='PNG');
  assert.ok(signatureBefore);
  ctx.memorialEditSettings.signatureY=35;
  await ctx.build();
  assert.equal(imageRenders,4,'Mover apenas a assinatura não deve rasterizar novamente os fundos');
  const signatureAfter=pdfInstances.at(-1).images.find((image)=>image.format==='PNG');
  assert.ok(signatureAfter.y<signatureBefore.y,'PDF precisa refletir a nova posição da assinatura');
  assert.equal(pdfInstances.at(-1).images.filter(({format})=>format==='PNG').length,1,'Assinatura única no PDF');
  pages[2].outerHTML='<section class="standard-memorial-page">Conteúdo alterado na página 3</section>';
  await ctx.build();
  assert.equal(imageRenders,5,'Ao editar apenas uma página, somente ela deve ser rasterizada novamente');
  assert.equal(pdfInstances.at(-1).images.filter(({format})=>format==='JPEG').length,4,'Todas as páginas devem constar no PDF final');
}

// Exportação que segue um salvamento concluído não deve gerar Memorial e mapa outra vez.
{
  const downloadBlock=block('  async function downloadMemorialPdf()', '  function getPerimeter(');
  // Entre o download e a função seguinte estão apenas as ações do PDF.
  let regenerated=0,rendered=0,downloaded=0;
  const trigger={textContent:'Download',setAttribute(){},removeAttribute(){}};
  const menu={querySelector(){return trigger;}};
  const doc={querySelector(sel){return sel==='.sv-doc-preview-download'?menu:null;}};
  const ctx=vm.createContext({
    document:doc,memorialPdfExportPromise:null,lastPdfBlob:null,lastPdfHtml:'documento pronto',lastMemorialHtml:'documento pronto',
    memorialPdfDocumentReady:true,memorialPendingEdits:false,memorialLiveRegenerationTimer:0,
    clearTimeout(){},toast(){},console,
    async generate(){regenerated++;return true;},async renderPdfPreview(){rendered++;ctx.lastPdfBlob=new Blob(['pdf']);},
    $(){return {selectedOptions:[{text:'Sitio Jo'}]};},slug(){return 'sitio-jo';},
    offerMemorialPdfDownload(){},download(){downloaded++;}
  });
  vm.runInContext(`${downloadBlock}\nglobalThis.exportPdf=downloadMemorialPdf;`,ctx);
  await ctx.exportPdf();
  assert.equal(regenerated,0,'Um Memorial já salvo não precisa ser regenerado antes de exportar');
  assert.equal(rendered,1);
  assert.equal(downloaded,1);
  ctx.lastPdfBlob=null;
  ctx.memorialPendingEdits=true;
  await ctx.exportPdf();
  assert.equal(regenerated,1,'Alterações posteriores obrigam a geração atualizada');
}
console.log('PASS memorial-pdf-performance: imagens concluídas, reaproveitamento seguro de páginas, assinaturas e exportação sem regeneração redundante.');
