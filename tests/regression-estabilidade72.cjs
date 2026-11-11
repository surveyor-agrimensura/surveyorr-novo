// Testes sem dependências externas; utiliza apenas o compilador TS já instalado no host.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,stubs={}){
 const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const js=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 const requireMock=(name)=>stubs[name]||(()=>{throw new Error(`Stub não implementado: ${name}`)})();
 vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{console,Number,Math,Array,String,JSON,Date,Map,Set,Boolean,Error,NaN,Infinity,parseInt,parseFloat,isFinite})(requireMock,module,module.exports);
 return module.exports;
}
const geo=load('src/features/croqui/projectGeojsonGeometry.ts');
const geoRings=load('src/lib/geoJsonRings.ts');
const utmCore=load('src/lib/wgs84Utm.ts');
const sphericalGeodesy=load('src/lib/sphericalGeodesy.ts');
const memorial=load('src/features/memorial/memorialEngine.ts',{'../../lib/wgs84Utm':utmCore,'../../lib/sphericalGeodesy':sphericalGeodesy,'../croqui/projectGeojsonGeometry':geo,'../../lib/geoJsonRings':geoRings,'../croqui/croquiGeometry':{readConfrontation:()=>''}});
const d=load('src/features/croqui/projectDivisions.ts',{'../memorial/memorialEngine':memorial,'./projectGeojsonGeometry':geo,'../../lib/geoJsonRings':geoRings});
const square=(x,y)=>[[x,y],[x+.002,y],[x+.002,y+.001],[x,y+.001],[x,y]];
const data=[
 {id:'a',name:'Gleba 01',properties:{category:'Gleba',name:'Gleba 01',fillColor:'#3270dd',areaLabelLng:-39.5,areaLabelLat:-12.9},geometry:{type:'Polygon',coordinates:[square(-39.5,-12.9)]}},
 {id:'b',name:'Gleba 02',properties:{category:'Gleba',name:'Gleba 02',fillColor:'#12aa68'},geometry:{type:'Polygon',coordinates:[square(-39.498,-12.9)]}},
 {id:'c',properties:{category:'Gleba'},geometry:{type:'MultiPolygon',coordinates:[[square(-39.496,-12.9)],[square(-39.494,-12.9)]]}}
];
const areas=d.readProjectDivisions(data);
const polys=memorial.getPolygons(data);
assert.equal(polys.length,4,'Memorial precisa recuperar todas as partes do MultiPolygon');
assert.equal(polys[3].name,'Feição 3 — Parte 2');
assert.notEqual(polys[2].id,polys[3].id,'Cada parte precisa de ID distinto para gerar memorial');
assert.equal(areas.length,4,'Dois Polygon e duas partes MultiPolygon');
assert.equal(areas[0].name,'Gleba 01');
assert.equal(areas[0].color,'#3270dd');
assert.equal(areas[0].labelLon,-39.5);
assert.ok(areas.every(a=>a.areaM2>0),'Áreas calculáveis');
assert.ok(d.divisionBounds(areas).length===4,'Enquadramento de todas as glebas');
assert.equal(new Set(areas.map(x=>`${x.featureId}:${x.partIndex}`)).size,4,'Partes identificadas separadamente');
console.log('OK: quatro partes geográficas, cores, nomes, rótulos móveis e áreas individuais.');
