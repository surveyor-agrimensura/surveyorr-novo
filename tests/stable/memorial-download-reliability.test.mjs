import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../assets/js/features/memorial/app.js', import.meta.url), 'utf8');
function extractFunction(name) {
  const start = source.indexOf(`  ${name === 'downloadMemorialPdf' || name === 'openPdfPrintWindow' ? 'async ' : ''}function ${name}(`);
  assert.ok(start !== -1, `${name} deve existir`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (!depth) return source.slice(start, i + 1);
  }
  throw new Error(`Função incompleta: ${name}`);
}

function fixture({ pdfFails = false, cached = false } = {}) {
  const messages = [];
  const urls = [];
  const downloads = [];
  const list = { elements: [], appendChild(el) { this.elements.push(el); } };
  const button = { textContent: 'Download', attrs: new Map(), setAttribute(k,v) { this.attrs.set(k,v); }, removeAttribute(k) { this.attrs.delete(k); } };
  const menu = { querySelector(sel) { return sel === ':scope > button' ? button : null; } };
  const body = { elements: [], appendChild(el) { el.parentElement = this; this.elements.push(el); } };
  const document = {
    body,
    querySelector(selector) {
      if (selector === '.sv-doc-preview-download' || selector === '.export-menu') return menu;
      if (selector === '.sv-doc-preview-download .export-menu-list' || selector === '.export-menu .export-menu-list') return list;
      return null;
    },
    getElementById(id) { return list.elements.find(el => el.id === id) || null; },
    createElement(type) {
      const el = {
        tagName: type, hidden: false, attrs: {},
        remove() { if (this.parentElement) this.parentElement.elements = this.parentElement.elements.filter(node => node !== this); },
        removeAttribute(name) { delete this[name]; },
        click() { downloads.push({ filename:this.download, type:this.tagName, attached:body.elements.includes(this), mime:this.href }); }
      };
      return el;
    }
  };
  const context = vm.createContext({
    Blob, document, console, setTimeout() {},clearTimeout(){},memorialLiveRegenerationTimer:0,async generate(){return true;},
    URL: { createObjectURL() { const url=`blob:pdf-${urls.length}`; urls.push(url); return url; }, revokeObjectURL() {} },
    lastPdfBlob: cached ? new Blob(['%PDF-1.7'],{type:'application/pdf'}) : null,
    lastPdfBlobUrl: cached ? 'blob:already-ready' : '',
    lastPdfHtml: '<article>Memorial</article>', lastMemorialHtml: '<article>Memorial</article>',
    memorialPdfExportPromise: null, memorialPdfDocumentReady:false,memorialPendingEdits:true,
    toast(message,type) { messages.push([message,type]); },
    slug(value) { return String(value||'documento').toLowerCase(); },
    $(id) { return id === 'projectSelect' ? {selectedOptions:[{text:'SÍTIO JÓ'}]} : null; },
    previewLoading() { throw new Error('Exportação apagou a prévia'); },
    hideMemorialPreview() { throw new Error('Exportação apagou a prévia'); },
    async renderPdfPreview(display) {
      assert.equal(display, false);
      if (pdfFails) throw new Error('Falha simulada do renderizador');
      context.lastPdfBlob = new Blob(['%PDF-1.7'], {type:'application/pdf'});
      context.lastPdfBlobUrl = 'blob:ready';
    }
  });
  const code = ['download', 'offerMemorialPdfDownload', 'downloadMemorialPdf', 'openPdfPrintWindow'].map(extractFunction).join('\n');
  vm.runInContext(`${code}\n globalThis.exports={download,downloadMemorialPdf,openPdfPrintWindow};`, context);
  return { context, messages, downloads, list, button, ...context.exports };
}

const success = fixture();
await success.downloadMemorialPdf();
assert.equal(success.downloads.length, 1, 'PDF deve solicitar download após renderização');
assert.equal(success.downloads[0].filename, 'sítio jó-memorial.pdf');
assert.equal(success.downloads[0].attached, true, 'O link precisa estar conectado ao DOM ao clicar');
assert.equal(success.list.elements[0].download, 'sítio jó-memorial.pdf', 'Link manual deve ficar disponível após geração assíncrona');
assert.equal(success.list.elements[0].hidden, false);
assert.equal(success.list.elements[0].href, 'blob:ready');
assert.equal(success.button.textContent, 'Download', 'Rótulo do botão deve ser restaurado');
assert.ok(success.messages.some(([text]) => /se não baixar/i.test(text)), 'Instrução alternativa deve aparecer');

const error = fixture({pdfFails:true});
await error.downloadMemorialPdf();
assert.equal(error.downloads.length, 0, 'Falhas não devem gerar arquivo vazio');
assert.ok(error.messages.some(([text,type]) => /Falha simulada/.test(text) && type === 'error'), 'Falhas de renderização devem aparecer ao usuário');
assert.equal(error.button.textContent, 'Download', 'Estado do menu deve ser restaurado após erro');

const direct = fixture({cached:true});
direct.download('memorial.html','<!doctype html><title>Memorial</title>','text/html');
direct.download('memorial.txt','Memorial','text/plain');
direct.download('memorial.doc','<html>Word</html>','application/msword');
await direct.downloadMemorialPdf();
assert.deepEqual(direct.downloads.map(item => item.filename), ['memorial.html','memorial.txt','memorial.doc','sítio jó-memorial.pdf']);
assert.ok(direct.downloads.every(item => item.attached), 'Todos os formatos usam âncora efetivamente ligada à página');

console.log('PASS memorial-download-reliability: PDF sem destruir a prévia, fallback nativo, falhas e HTML/TXT/Word validados por execução.');
