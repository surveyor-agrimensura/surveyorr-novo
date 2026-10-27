import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('assets/js/features/mapa/app.js','utf8');
const css=fs.readFileSync('assets/css/features/mapa/app.css','utf8');
const statusStart=app.indexOf('  function updatePropertyContextResultActiveState(');
const statusEnd=app.indexOf('  async function selectPropertyContextResult(',statusStart);
const queueStart=app.indexOf('  // O clique e a antecipação compartilham a mesma promessa de geometria;');
const queueEnd=app.indexOf('  function propertyFeaturePoint(feature)',queueStart);
assert.ok(statusStart>0 && statusEnd>statusStart && queueStart>statusEnd);
const feature=(id)=>({properties:{cod_imovel:`BA2901007${id}`,_surveyor_local_attributes_only:true}});
const features=[feature('S1'),feature('S2'),feature('S3'),feature('S4')];
const memory=new Map();
const pending=new Map();
const state={results:features, selectedIndex:-1, pendingIndex:-1};
const rows=features.map((f,i)=>{
 const names=new Set();
 const action={textContent:'Localizar'};
 return {dataset:{resultIndex:String(i)},action,classes:names,
  classList:{toggle(name,on){if(on)names.add(name);else names.delete(name);}},
  setAttribute(){},querySelector(selector){return selector==='.property-context-result-action'?action:null},
  scrollIntoView(){} };
});
const box={querySelectorAll(selector){return selector==='.property-context-result'?rows:[]},
 querySelector(selector){return selector==='.property-context-result'?rows[0]:null}};
const sandbox={Map,Set,Promise,els:{citySuggestBox:box},propertyContextSearchState:state,
 propertySearchStateCode:()=> 'BA',propertyGeometryCacheKey:(f)=>f.properties.cod_imovel,
 propertyGeometryMemoryCache:memory,
 hydrateLocalPropertyGeometry:(f)=>new Promise(resolve=>pending.set(f.properties.cod_imovel,resolve))};
vm.runInNewContext(app.slice(statusStart,statusEnd)+'\n'+app.slice(queueStart,queueEnd)+ '\nglobalThis.ui={updatePropertyContextResultActiveState,resetPropertyGeometryWarmup,advancePropertyGeometryWarmup,propertyGeometryStatusForFeature,getPropertyGeometryForSelection};',sandbox);
const ui=sandbox.ui;
ui.resetPropertyGeometryWarmup(features,'BA');
ui.updatePropertyContextResultActiveState();
assert.equal(rows[0].action.textContent,'Na fila','Primeira consulta em curso identificada.');
assert.equal(rows[1].action.textContent,'Na fila','Segunda consulta em curso identificada.');
assert.equal(rows[2].action.textContent,'Na fila','Terceiro imóvel na fila.');
assert.equal(rows[3].action.textContent,'Localizar','Quarto imóvel ainda fora da janela.');
// Uma geometria completa torna-se Pronto, sem indicar seleção indevida.
pending.get('BA2901007S1')({geometry:{type:'Polygon',coordinates:[]},properties:{cod_imovel:'BA2901007S1'}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(rows[0].action.textContent,'Pronto','Feição baixada com sucesso fica pronta.');
state.selectedIndex=0;
ui.updatePropertyContextResultActiveState();
assert.equal(rows[0].action.textContent,'Selecionado','Destaque permanece depois da seleção.');
assert.ok(rows[0].classes.has('active'),'Polígono selecionado mantém indicação visual vermelha.');
ui.advancePropertyGeometryWarmup(0);
assert.equal(rows[3].action.textContent,'Na fila','O quarto passa a integrar a janela depois do primeiro clique.');
state.selectedIndex=1;
ui.updatePropertyContextResultActiveState();
assert.equal(rows[0].action.textContent,'Pronto','Ao escolher outro, a geometria anterior fica reutilizável.');
assert.equal(rows[1].action.textContent,'Selecionado','Somente o imóvel atual permanece selecionado.');
state.pendingIndex=2;
ui.updatePropertyContextResultActiveState();
assert.equal(rows[2].action.textContent,'Abrindo…','Clique ainda aguardando não deve simular seleção confirmada.');
assert.equal(rows[1].action.textContent,'Selecionado','A seleção anterior permanece até a próxima dar certo.');
ui.resetPropertyGeometryWarmup([], 'BA');
assert.equal(memory.size,0,'O simulador não insere geometria em cache, apenas verifica a fila.');
assert.match(app,/if \(options\.isCurrentSelection && !options\.isCurrentSelection\(\)\) return false/,'Resposta tardia não pode substituir o imóvel selecionado.');
assert.match(css,/\.property-context-result\.is-queued \.property-context-result-action/,'Status real da fila precisa ter estilo.');
assert.match(css,/\.property-context-result\.is-ready \.property-context-result-action/,'Imóvel preparado precisa ter estilo.');
assert.match(app,/function hideCitySuggestions\(\)[\s\S]*?resetPropertyGeometryWarmup\(\[\], propertySearchStateCode\(\)\)/,'Ao fechar a busca somente a fila é descartada.');
console.log('PASS property-queue-ui-rc18513: na fila, pronto, selecionado persistente e janela móvel reais.');
