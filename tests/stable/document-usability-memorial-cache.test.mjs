import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('assets/js/features/memorial/app.js','utf8');
const css=readFileSync('assets/css/core/documents.css','utf8');
const between=(from,to)=>{
  const a=source.indexOf(from),b=source.indexOf(to,a+from.length);
  assert.ok(a>=0&&b>a,`Funções ausentes: ${from}`);
  return source.slice(a,b);
};

// Execução do debounce real: intervalos curtos devem ser consolidados
const timers=[],clears=[],calls=[];
const scheduleSource=between('  function scheduleMemorialLiveRegeneration(', '  async function renderPdfPreview(');
const scheduling=vm.createContext({
  $:()=>({value:'projeto'}),
  clearTimeout:id=>clears.push(id),
  window:{setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;}},
  setMemorialModelLoading:()=>{},
  generate:async(options)=>{calls.push(options);return true;},
  console,
  memorialLiveRegenerationTimer:0,
});
vm.runInContext(`${scheduleSource}\nthis.schedule=scheduleMemorialLiveRegeneration;`,scheduling);
scheduling.schedule(10);
scheduling.schedule(320);
assert.equal(timers[0].delay,200,'Atualizações muito rápidas devem ser amortecidas');
assert.equal(timers[1].delay,320,'Regeneração normal deve aguardar a digitação');
assert.equal(clears.at(-1),1,'Uma nova edição deve cancelar o temporizador anterior');
await timers[1].fn();
assert.equal(calls.length,1,'A última edição deve regenerar somente uma vez');

// Exercício efetivo do cache de páginas: parse só após HTML novo.
const pagesSource=between('  function memorialLivePages(){','  function syncMemorialSignerPages(');
let parses=0;
const context=vm.createContext({
  document:{createElement:()=>({
    set innerHTML(value){parses++;this.value=value;},
    querySelectorAll:()=>[{outerHTML:'<article>página</article>'}],
    querySelector:()=>null
  })},
  lastMemorialHtml:'<div>versão 1</div>',memorialParsedPagesSource:'',memorialParsedPages:[]
});
vm.runInContext(`${pagesSource}\nthis.pages=memorialLivePages;`,context);
assert.equal(context.pages().length,1);
context.pages();
assert.equal(parses,1,'Trocar de aba não deve fazer parsing da página novamente');
context.lastMemorialHtml='<div>versão 2</div>';
context.pages();
assert.equal(parses,2,'HTML alterado precisa invalidar o cache');

assert.match(source,/memorialPreviewHostCache\.get\(live\)/);
assert.match(source,/memorialPreviewSignatureKey\(\)/,'Assinatura deve invalidar o cache visual');
assert.match(source,/live\.hidden\)return/,'Prévia oculta não deve ser renderizada');
assert.match(css,/@media \(max-width:560px\)/);
assert.match(css,/font-size:12px;line-height:1\.4;min-height:38px/);
assert.match(css,/focus-visible/);
assert.match(css,/body\.sv-document-compact-model\.sv-document-workspace-page \.sv-doc-preview-card\{min-height:360px;height:65vh/);
assert.doesNotMatch(css,/!important/);
console.log('PASS document-usability-memorial-cache: debounce, reaproveitamento de páginas, invalidação e layout responsivo.');
