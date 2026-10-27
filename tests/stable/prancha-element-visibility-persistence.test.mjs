import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('assets/js/features/mapas/app.js','utf8');
const editor=fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');
const bridge=fs.readFileSync('assets/js/core/technical-map-bridge.js','utf8');

for (const [name,code] of [['Editor',editor],['Bridge',bridge]]) {
  const from=code.indexOf('  const ELEMENT_VISIBILITY_DEFAULTS = Object.freeze({');
  const end=code.indexOf('  const ELEMENT_VISUAL_DEFAULTS = Object.freeze({',from);
  assert.ok(from>=0 && end>from,`${name} deve implementar normalização canônica de visibilidade`);
  const scope={};
  vm.runInNewContext(code.slice(from,end)+'\nthis.normalize=normalizeElementVisibility;',scope);
  const normal=scope.normalize({});
  assert.deepEqual(JSON.parse(JSON.stringify(normal)),{cotas:true,glebaCotas:false,vertices:true,confrontantes:true,north:true,grid:true,scale:true});
  const toggled=scope.normalize({elementVisibility:{cotas:false,glebaCotas:true,vertices:false,north:false}});
  assert.equal(toggled.cotas,false,`${name} não deve reativar cotas depois de salvar`);
  assert.equal(toggled.glebaCotas,true);
  assert.equal(toggled.vertices,false);
  assert.equal(toggled.north,false);
  assert.equal(toggled.confrontantes,true);
  assert.equal(scope.normalize({elementVisibility:{cotas:'false'}}).cotas,true,'Strings não substituem booleanos');
}
const from=app.indexOf('  const ELEMENT_VISIBILITY_CONTROLS = Object.freeze({');
const end=app.indexOf('  function currentPranchaLiveElementValues()',from);
assert.ok(from>=0 && end>from);
const controls=new Map();
for (const id of ['mapShowCotas','mapShowGlebaCotas','mapShowVertices','mapShowConfrontantes','mapShowNorth','mapShowGrid','mapShowScale'])controls.set(id,{checked:false});
const proxies={};
const context={document:{querySelectorAll:selector=>proxies[selector]||[]},$:id=>controls.get(id),documentVisualSettings:project=>project.settings || {},String,Object};
vm.runInNewContext(app.slice(from,end)+'\nthis.restore=restoreProjectElementVisibility;',context);
context.restore({id:'p1',settings:{elementVisibility:{cotas:false,vertices:false}}});
assert.equal(controls.get('mapShowCotas').checked,false);
assert.equal(controls.get('mapShowVertices').checked,false);
assert.equal(controls.get('mapShowNorth').checked,true);
context.restore({id:'p2',settings:{elementVisibility:{cotas:true,glebaCotas:true,vertices:true}}});
assert.equal(controls.get('mapShowCotas').checked,true,'Visibilidade precisa ser isolada entre projetos');
assert.equal(controls.get('mapShowGlebaCotas').checked,true);
context.restore({id:'p3',settings:{}});
assert.equal(controls.get('mapShowGlebaCotas').checked,false,'Sem configuração, usar padrão seguro');
assert.match(editor,/patchLiveElements\(values = \{}, \{ persist = false \} = \{}\)/);
assert.match(editor,/documentSettings\.elementVisibility = normalizeElementVisibility/);
assert.match(editor,/if \(persist && active\)/);
assert.match(app,/patchLiveElements\?\.\(values,\{persist:true\}\)/);
assert.match(app,/restoreProjectElementVisibility\(p\);/);
assert.match(editor,/elementVisibility:normalizeElementVisibility\(value\)/);
assert.match(bridge,/elementVisibility:normalizeElementVisibility\(value\)/);
console.log('PASS: desligar cotas e outros elementos persiste, restaura por projeto e mantém padrão isolado.');
