import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/features/mapa/app.js', 'utf8');
const start = app.indexOf('  function restoreManualGlebaToSource(');
const end = app.indexOf('  function startManualGlebaDrawing(', start);
assert(start > 0 && end > start, 'Recomposição da gleba precisa ter rotina própria.');
const src = app.slice(start, end);
assert.match(app, /if \(!restoreManualGlebaToSource\(target\)\)/, 'A exclusão individual deve restaurar ou recusar.');
assert.match(app, /map\.on\(L\.Draw\.Event\.DELETED, \(event\) => \{[\s\S]*restoreManualGlebaToSource\(glebaLayer\)/,
  'A exclusão por ferramenta também deve recompor o polígono.');

function layer(props, area) {
  return {
    feature: { properties: { ...props } },
    area,
    toGeoJSON() { return { type: 'Feature', properties: { ...this.feature.properties }, geometry: { type: 'Polygon', coordinates: [], __area: this.area } }; }
  };
}
function mock({failUnion = false, hasChildren = false, fromToolbar = false} = {}) {
  const parent = layer({id:'original', category:'perimetro', name:'Perímetro original', areaHectares: 0.008}, 80);
  const child = layer({id:'gleba', category:'gleba', generatedBy:'map-glebas-manual', manualGleba:true, parentLayerId:'original', sourceLayerId:'original'}, 20);
  const other = layer({id:'outro', category:'gleba', generatedBy:'map-glebas-manual', manualGleba:true, parentLayerId:hasChildren ? 'gleba':'original'}, 13);
  const list = [parent, other, ...(fromToolbar ? [] : [child])];
  const state = {list, calls:0, saved:0, refreshes:0};
  const drawn = {getLayers:()=>list.slice(),hasLayer:l=>list.includes(l),removeLayer:l=>{const i=list.indexOf(l);if(i>=0)list.splice(i,1);},addLayer:l=>list.push(l)};
  const context={
    drawn, selectedLayer:child, metadata:l=>l.feature.properties,
    turf: {
      area:f=>f.geometry.__area,
      featureCollection:features=>({features}),
      union:()=>failUnion ? null : {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[],__area:100}},
      polygonToLine:()=>({}), length:()=>0.4
    },
    L:{geoJSON:(feature)=>({eachLayer(fn){fn(layer(feature.properties, feature.geometry.__area));}})},
    styleFor:()=>({}),attach:()=>state.calls++,applyStyleToDrawn:()=>{},
    currentGlebaFeatureCollection:()=>({features:[]}),updateGlebaSourceOptions:()=>{},
    renderGlebaSummary:()=>{},scheduleRecoverySnapshot:()=>state.saved++,refresh:()=>state.refreshes++,
    console
  };
  const restore=vm.runInNewContext(`(function(){${src};return restoreManualGlebaToSource;})()`,context);
  return {restore,child,parent,other,list,state};
}
{
  const t=mock();
  assert.equal(t.restore(t.child),true,'Unir o recorte removido à área restante.');
  assert.equal(t.list.includes(t.child),false,'Gleba removida.');
  assert.equal(t.list.includes(t.other),true,'Outras glebas preservadas.');
  const restored=t.list.find(x=>x.feature.properties.id==='original');
  assert(restored,'ID original preservado.');
  assert.equal(restored.feature.properties.areaHectares,0.01,'Área do polígono restaurada.');
  assert.equal(restored.feature.properties.name,'Perímetro original','Nome original preservado.');
  assert.equal(t.state.saved,1);
}
{
  const t=mock({fromToolbar:true});
  assert.equal(t.restore(t.child),true,'Depois de remover com a ferramenta, a gleba retorna ao pai.');
  assert(t.list.some(x=>x.feature.properties.id==='original' && x.feature.properties.areaHectares===0.01));
}
{
  const t=mock({failUnion:true});
  assert.equal(t.restore(t.child),false,'Se a união falhar, recusar exclusão.');
  assert(t.list.includes(t.child) && t.list.includes(t.parent),'A geometria original não deve mudar.');
}
{
  const t=mock({hasChildren:true});
  assert.equal(t.restore(t.child),false,'Não excluir pai que possui subdivisão dependente.');
  assert(t.list.includes(t.child));
}
console.log('PASS: exclusão individual e via ferramenta restauram área original, preservam outras glebas e recusam restauração inválida.');
