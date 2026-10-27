import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const code=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const begin=code.indexOf('  function bindBetaProxyControl(proxy, source) {');
const end=code.indexOf('  const COMPACT_ELEMENT_META',begin);
assert.ok(begin>=0 && end>begin,'Função real de vinculação localizada');
const ctx={document:{querySelectorAll:()=>[]},globalThis:{CSS:{escape:s=>s}},Event:class {constructor(type, options={}){this.type=type;this.bubbles=options.bubbles;}},String,patchDocumentLiveElements:()=>{}};
vm.runInNewContext(code.slice(code.indexOf('  function syncBetaProxyFromSource('),end)+'\nthis.bind=bindBetaProxyControl;',ctx);
const source={id:'mapShowCotas',type:'checkbox',checked:true,disabled:false,dataset:{},listeners:new Map(),calls:0,addEventListener(t,fn){let a=this.listeners.get(t)||[];a.push(fn);this.listeners.set(t,a);},dispatchEvent(e){this.calls++;for(const cb of (this.listeners.get(e.type)||[]))cb(e);}};
function proxy(){return {type:'checkbox',checked:false,disabled:false,dataset:{},attributes:{},listeners:new Map(),removeAttribute(){},addEventListener(t,fn){let a=this.listeners.get(t)||[];a.push(fn);this.listeners.set(t,a);},emit(t){for(const f of (this.listeners.get(t)||[])) f({type:t});}};}
const first=proxy(),second=proxy();
ctx.bind(first,source);ctx.bind(second,source);
assert.equal(source.dataset.betaProxyMirrorBound,'1','Mirror do campo original deve ser marcado após primeiro vínculo');
assert.equal(source.listeners.get('change')?.length,1,'Remontagem da Personalização não deve acumular ouvintes change');
assert.equal(source.listeners.get('input')?.length,1,'Remontagem da Personalização não deve acumular ouvintes input');
first.checked=false;
first.emit('change');
assert.equal(source.calls,1,'Uma ação do usuário deve emitir um único evento original');
assert.equal(source.checked,false);
assert.equal((first.listeners.get('input')||[]).length,0,'Checkbox não deve disparar por dois caminhos (input/change)');
assert.ok(code.includes('function mapasEditorOwnsPreview()'),'Deve haver um único dono da prévia ativa');
assert.match(code,/if \(mapasEditorOwnsPreview\(\)\) \{ mapasProjectPreviewDeferred = true; return; \}/,'O renderizador não deve criar uma segunda cena quando o editor controla a tela.');
assert.match(code,/if \(mapasEditorOwnsPreview\(\) \|\| mapasPreviewAwaitingRefresh\) return;/,'Guarda não pode recriar preview legado por trás do editor');
assert.match(code,/function suspendMapasPersonalization\(workspace\)[\s\S]*?renderMapPreviewSvg\(lastSvg\)/,'Prévia Projeto deve ser reposta ao sair do editor sem obrigar dupla inicialização');
assert.match(code,/function startMapasPersonalizationOnce\(workspace\)[\s\S]*?previewHost\.replaceChildren\(\)/,'SVG legado completo precisa ser desmontado ao abrir a Personalização');
console.log('PASS Mapas: vínculo único de controles e propriedade exclusiva da prévia.');

// Teste comportamental do observer antigo: não pode recolocar SVG na bancada.
const guardBegin=code.indexOf('  function suspendMapPreviewFitObserver()');
const guardEnd=code.indexOf('  function technicalDocumentEditorOptions()',guardBegin);
assert.ok(guardBegin > 0 && guardEnd > guardBegin);
let observerCallback=null, rebuilds=0;
const guardState={
  document:{body:{dataset:{page:'mapas.html'}},querySelector:()=>({dataset:{betaPersonalizationSelected:'1'}})},
  technicalDocumentEditor:{isActive:()=>true,presentationMode:()=> 'inline'},
  select:{value:'P1'},lastSvg:'<svg viewBox="0 0 100 100"></svg>',
  mapasPreviewAwaitingRefresh:false,
  mapPreviewResizeObserver:null,mapPreviewFitHost:null,mapPreviewFitRaf:0,
  MutationObserver:class{constructor(fn){observerCallback=fn;}observe(){}},
  previewHost:{dataset:{},querySelector:()=>null},
  $:()=>guardState.previewHost,
  renderMapPreviewSvg:async()=>{rebuilds++;},
  window:{addEventListener(){}},
  queueMicrotask:fn=>fn(),requestAnimationFrame:fn=>fn(),cancelAnimationFrame:()=>{},
  Promise,Boolean,String,console
};
vm.runInNewContext(code.slice(guardBegin,guardEnd)+'\nthis.install=installMapasNativeProjectPreviewGuard;',guardState);
guardState.install();
assert.equal(rebuilds,0,'O preview legado não deve ser restaurado com o editor ativo.');
observerCallback();
assert.equal(rebuilds,0,'Observer não pode reconstruir o SVG do Projeto durante a personalização.');
guardState.document.querySelector=()=>({dataset:{betaPersonalizationSelected:'0'}});
guardState.mapasPreviewAwaitingRefresh=true;
observerCallback();
assert.equal(rebuilds,0,'Observer não deve criar uma segunda cena durante a atualização pendente.');
guardState.mapasPreviewAwaitingRefresh=false;
observerCallback();
assert.equal(rebuilds,1,'Ao voltar ao Projeto, o observador recupera a prévia se ela estiver ausente.');
console.log('PASS Mapas: observer respeita editor ativo e troca controlada de cenas.');
