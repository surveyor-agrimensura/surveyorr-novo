import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('assets/js/core/downloads.js', 'utf8');
const downloads = [];
const revoked = [];
const timers = [];
const alerts = [];
const anchors = [];
const buttons = [];
let projectId = 'projeto-1';
const blob = new Blob(['%PDF-1.7\nConteúdo de teste\n%%EOF'], {type:'application/pdf'});
let previewBlob = blob;
const list = {
  children:[], classList:{contains:()=>false},
  querySelector(selector) {
    return this.children.find(item=>selector==='[data-sv-pdf-retry]' && item.attributes['data-sv-pdf-retry']==='1') || null;
  },
  appendChild(item) { this.children.push(item); item.parentElement=this; return item; }
};
const body = {
  dataset: {page:'mapas.html'},
  children:[],
  appendChild(element) { this.children.push(element); element.parentElement=this; return element; }
};
function element(tagName) {
  const element = {
    tagName, style:{}, attributes:{}, events: {}, hidden:false, parentElement:null,
    setAttribute(k,v) { this.attributes[k]=v; },
    addEventListener(k,cb) { this.events[k]=cb; },
    remove() {
      if(this.parentElement) this.parentElement.children=this.parentElement.children.filter(item=>item!==this);
    },
    click() {
      if(tagName==='a') downloads.push({name:this.download, url:this.href, attached:body.children.includes(this)});
      else this.events.click?.({preventDefault(){},stopPropagation(){}});
    }
  };
  if (tagName==='a') anchors.push(element);
  else if (tagName==='button') buttons.push(element);
  return element;
}
const context = {
  Blob, console,
  document: {
    readyState:'loading', body, addEventListener(){}, createElement:element,
    querySelectorAll(selector) {
      if (selector === '.export-menu .export-menu-list, .sv-prancha-footer-download-menu') return [list];
      return [];
    },
    getElementById(id) {
      if (id==='projectSelect') return {value:projectId,selectedOptions:[{textContent:'SÍTIO MEU REFÚGIO'}]};
      if (id==='mapPreview') return {querySelector(){return null;}};
      return null;
    }
  },
  window: {
    SurveyorPdfPreview: {
      getState(){return {blob:previewBlob,sourceHtml:'<svg id="ready"></svg>',pageFormat:'a4'};},
      async renderHtml() { throw new Error('Não deve regenerar o PDF pronto.'); }
    }
  },
  URL: {
    createObjectURL() {return `blob:teste-${anchors.length}`;},
    revokeObjectURL(url) {revoked.push(url);}
  },
  setTimeout(fn, delay) {timers.push({fn,delay});},
  alert(message) {alerts.push(message);}
};
const patchedSource = source.replace(/\}\)\(\);\s*$/, 'globalThis.__test__={download,offerMapPdfRetry,isolatedMapPdf};})();');
assert.notEqual(patchedSource, source, 'Código de teste exporta apenas funções internas no VM isolado.');
vm.runInNewContext(patchedSource, context, {filename:'downloads.js'});
const {download,offerMapPdfRetry,isolatedMapPdf} = context.__test__;

assert.throws(()=>download('vazio.pdf',new Blob([]),'application/pdf'), /vazio/i);
await isolatedMapPdf();
assert.equal(downloads.length,1,'PDF preparado deve acionar o primeiro download');
assert.equal(downloads[0].attached,true,'Âncora deve estar anexada antes de clicar');
assert.equal(revoked.length,0,'URL do PDF não pode ser revogada logo após o clique');
assert.ok(timers.some(({delay})=>delay>=120000),'URL permanece válida enquanto navegador salva');
assert.equal(list.children.length,1,'Menu deve oferecer uma única opção de retry');
assert.match(list.children[0].textContent,/salvar novamente/i);

list.children[0].click();
assert.equal(downloads.length,2,'Clique manual deve baixar o mesmo PDF sem regenerá-lo');
assert.equal(downloads[1].name,downloads[0].name);
assert.equal(list.children.length,1,'Novo download não duplica opção de retry');

projectId='projeto-2';
list.children[0].click();
assert.equal(downloads.length,2,'Não permitir retry de PDF de outro projeto');
assert.ok(alerts.some(message=>/documento mudou/.test(message)));
projectId='projeto-1';
previewBlob = new Blob(['outra versão do PDF'],{type:'application/pdf'});
list.children[0].click();
assert.equal(downloads.length,2,'Não permitir retry de PDF cuja prévia foi substituída');

for(const t of timers.filter(({delay})=>delay===2000)) t.fn();
assert.equal(body.children.length,0,'Âncoras temporárias devem ser retiradas do DOM');
assert.equal(revoked.length,0,'Retirar âncoras não invalida prematuramente os Blobs');
for(const t of timers.filter(({delay})=>delay===180000)) t.fn();
assert.equal(revoked.length,2,'Blob URLs devem ser liberadas depois da janela de download');

console.log('PASS map-pdf-download-retry: download DOM, tempo do Blob, retry manual e isolamento por projeto/prévia.');
