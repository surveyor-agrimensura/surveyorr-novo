import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const documents=fs.readFileSync('assets/js/core/documents.js','utf8');
const controls=['mapShowCotas','mapShowGlebaCotas','mapShowVertices','mapShowConfrontantes','mapShowNorth','mapShowGrid','mapShowScale'];
assert.ok(documents.includes('function ensureMapOptions()'),'Opções são criadas dinamicamente');
assert.ok(documents.includes('DOMContentLoaded'),'Opções podem ser criadas depois que mapas/app.js é executado');
const begin=app.indexOf('    // Os checkboxes da cartografia são injetados por core/documents.js');
const end=app.indexOf('    const structuralPranchaControls',begin);
assert.ok(begin>=0 && end>begin,'Assinatura delegada dos toggles deve existir');
assert.doesNotMatch(app.slice(begin,end),/const control=\$\(id\); if\(!control\)return/,'Não registrar evento somente em elementos que ainda não existem');

let handleChange=null,patchCount=0;
const ctx={
  ELEMENT_VISIBILITY_CONTROLS:Object.fromEntries(controls.map(id=>[id,id])),
  document:{body:{dataset:{page:'pranchas.html'}},addEventListener(type,fn){if(type==='change')handleChange=fn;}},
  select:{value:'imovel-1'},
  patchDocumentLiveElements(){patchCount++;},
  String,Object,Set
};
vm.runInNewContext(app.slice(begin,end),ctx);
assert.equal(typeof handleChange,'function','Handler deve ser registrado mesmo sem checkboxes na página');
handleChange({target:{id:'mapShowCotas',checked:false}});
assert.equal(patchCount,1,'Desativar cotas precisa atualizar imediatamente o SVG');
handleChange({target:{id:'mapShowGlebaCotas',checked:false}});
assert.equal(patchCount,2,'Desativar cotas da gleba precisa atualizar imediatamente');
handleChange({target:{id:'mapShowVertices',checked:false}});
assert.equal(patchCount,3,'Ocultar vértices deve atualizar imediatamente');
handleChange({target:{id:'campoNaoCartografico',checked:false}});
assert.equal(patchCount,3,'Outros campos não podem regenerar a cena cartográfica');
ctx.document.body.dataset.page='mapas.html';
handleChange({target:{id:'mapShowConfrontantes',checked:false}});
assert.equal(patchCount,4,'Mesmo vínculo deve atender Mapas e croquis');
ctx.select.value='';
handleChange({target:{id:'mapShowCotas',checked:true}});
assert.equal(patchCount,4,'Sem projeto, não deve haver atualização indevida');
assert.match(app,/return printableDocumentSvg\(patchSvgLiveElements\(lastSvg,currentPranchaLiveElementValues\(\)\)\);/,'SVG de exportação deve respeitar a visibilidade atual dos controles');
assert.match(app,/lastSvg = patchSvgLiveElements\(lastSvg, values\)/,'Alteração de visibilidade deve atualizar o SVG de origem');
console.log('PASS: Cotas desativadas atualizam mesmo com checkbox injetado após o carregamento, e exportação respeita controle atual.');
