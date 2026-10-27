import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const mapCode = readFileSync('assets/js/features/mapas/app.js', 'utf8');
const editorCode = readFileSync('assets/js/core/technical-document-editor.js', 'utf8');

// SVG do caso real: duas bordas permanentes e cinco camadas auxiliares de edição.
const fixture = [
  'sv-document-manual-servitude is-selected',
  'sv-document-manual-servitude-line',
  'sv-document-manual-servitude-line',
  'sv-editor-servitude-hitbox',
  'sv-editor-servitude-center',
  'sv-editor-servitude-handle',
  'sv-editor-servitude-handle',
  'sv-editor-servitude-temp',
  'sv-vertex-anchor',
  'sv-vertex-label',
  'sv-confrontante-callout',
];
class FakeSvg {
  constructor(classes = fixture) { this.nodes = classes.map(cls => ({ classes:new Set(cls.split(' ')), removed:false })); this.documentElement = this; }
  cloneNode(){ return new FakeSvg(this.nodes.filter(n=>!n.removed).map(n=>[...n.classes].join(' '))); }
  querySelector(selector){ return selector==='parsererror'?null:undefined; }
  querySelectorAll(selector){
    const selectors=selector.split(',').map(value=>value.trim().split('.').filter(Boolean));
    return this.nodes.filter(n=>!n.removed && selectors.some(classes=>classes.every(cls=>n.classes.has(cls)))).map(n=>({
      remove:()=>{n.removed=true;}, classList:{remove:(cls)=>n.classes.delete(cls)},
    }));
  }
  classes(){ return this.nodes.filter(n=>!n.removed).map(n=>[...n.classes].join(' ')); }
}
const serialize = (node) => `<svg>${node.classes().map(cls=>`<node class="${cls}"/>`).join('')}</svg>`;
const parserContext = {
  DOMParser: class { parseFromString(){ return new FakeSvg(); } },
  XMLSerializer: class { serializeToString(node){ return serialize(node); } },
};
const functionText=mapCode.slice(mapCode.indexOf('  const printableDocumentSvg ='),mapCode.indexOf('  const CONFRONTANTE_LABEL_STORAGE_PREFIX'));
assert.ok(functionText.includes('const printableDocumentSvg ='), 'Sanitizador deve existir na fonte comum');
const context=vm.createContext(parserContext);
vm.runInContext(functionText+'\nglobalThis.sanitizeSvg=printableDocumentSvg;', context);
const exportSvg=context.sanitizeSvg('<svg>com ferramentas</svg>');
for (const cls of ['sv-editor-servitude-handle','sv-editor-servitude-hitbox','sv-editor-servitude-center','sv-editor-servitude-temp','sv-vertex-anchor']) {
  assert.doesNotMatch(exportSvg,new RegExp(cls),`${cls} deve ser removido do arquivo final`);
}
for (const cls of ['sv-document-manual-servitude-line','sv-vertex-label','sv-confrontante-callout']) {
  assert.match(exportSvg,new RegExp(cls),`${cls} deve continuar no arquivo`);
}
assert.doesNotMatch(exportSvg,/is-selected/,'O estado de seleção não pertence ao documento');
assert.match(mapCode,/const svg = printableDocumentSvg\(rawSvg\)/,'O PDF em lote deve receber somente a cena sanitizada');
const pdfCode = readFileSync('assets/js/core/pdf-preview.js','utf8');
assert.match(pdfCode,/stripNonPrintableSvgUi\(svg\)/,'Exportador PDF usa limpeza de interface');
assert.match(pdfCode,/\.sv-editor-servitude-handle,\.sv-editor-servitude-hitbox,\.sv-editor-servitude-center,\.sv-editor-servitude-temp/,'PDF descarta todas as alças de edição da servidão');
assert.match(mapCode,/return printableDocumentSvg\(patchSvgLiveElements\(lastSvg,currentPranchaLiveElementValues\(\)\)\)/,'O download de SVG deve usar a mesma limpeza e respeitar a visibilidade das cotas');

const publishSrc=editorCode.slice(editorCode.indexOf('    function publishNativeCanvas() {'),editorCode.indexOf('    function scheduleNativePublish() {'));
assert.ok(publishSrc.startsWith('    function publishNativeCanvas()'), 'Publicação nativa encontrada');
let captured = '';
const editable=new FakeSvg();
const nativeContext=vm.createContext({
  nativeMode:true, overlay:editable, documentSettings:{}, nativeDocument:{},
  XMLSerializer: parserContext.XMLSerializer,
  window:{SurveyorNativeTechnicalDocument:{patchSettings(){},snapshot(){return {};}}},
  options:{onNativeSvgChange(text){ captured=text; }}, console,
});
vm.runInContext(publishSrc+'\nglobalThis.publish=publishNativeCanvas;',nativeContext);
assert.equal(nativeContext.publish(),true);
assert.doesNotMatch(captured,/sv-editor-servitude-handle|sv-editor-servitude-center|sv-editor-servitude-hitbox|sv-editor-servitude-temp/);
assert.match(captured,/sv-document-manual-servitude-line/);
assert.ok(editable.classes().includes('sv-editor-servitude-handle'),'Os pontos permanecem na cena de edição');
console.log('PASS servitude-export-no-handles: publicação e PDF/SVG limpos; ferramentas continuam editáveis.');
