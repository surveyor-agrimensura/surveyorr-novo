'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
function load(file,stubs={}){
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal((js.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,file+' sintaxe');
 const module={exports:{}};
 vm.runInNewContext(js.outputText,{module,exports:module.exports,require:id=>{if(Object.hasOwn(stubs,id))return stubs[id];throw Error('Dependência não prevista: '+id);},console,Math,Number,String,Array,Object,JSON,Set,Map,Date,RegExp});
 return module.exports;
}
const geoRings=load('src/lib/geoJsonRings.ts');
const utm=load('src/lib/wgs84Utm.ts');
const sphericalGeodesy=load('src/lib/sphericalGeodesy.ts');
const grid=load('src/features/documents/utmGrid.ts',{'../../lib/wgs84Utm':utm});
// Resultados calculados pela fórmula original antes da refatoração.
function utmLegacy([lon,lat],zoneOverride){
 const rad=Math.PI/180,a=6378137,e2=0.00669437999014,k0=.9996;
 const zone=zoneOverride||Math.min(60,Math.max(1,Math.floor((lon+180)/6)+1));
 const phi=lat*rad,lam=(lon-(zone*6-183))*rad;
 const ep=e2/(1-e2),n=a/Math.sqrt(1-e2*Math.sin(phi)**2),t=Math.tan(phi)**2,c=ep*Math.cos(phi)**2,A=Math.cos(phi)*lam;
 const M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*phi-(3*e2/8+3*e2**2/32+45*e2**3/1024)*Math.sin(2*phi)+(15*e2**2/256+45*e2**3/1024)*Math.sin(4*phi)-(35*e2**3/3072)*Math.sin(6*phi));
 const east=k0*n*(A+(1-t+c)*A**3/6+(5-18*t+t*t+72*c-58*ep)*A**5/120)+500000;
 const north=k0*(M+n*Math.tan(phi)*(A*A/2+(5-t+9*c+4*c*c)*A**4/24+(61-58*t+t*t+600*c-330*ep)*A**6/720))+(lat<0?10000000:0);
 return {east,north,zone,hemisphere:lat<0?'S':'N'};
}
let cases=0;
for(const coordinate of [[-39.5,-12.9],[-46.6333,-23.5505],[0,0],[12,78.1],[179.9,12.3],[-179.9,-22.4],[34.2,-47.7]]){
 for(const zone of [undefined,18,23]){
  const expected=utmLegacy(coordinate,zone),actual=utm.projectWgs84ToUtm(coordinate,zone);
  assert.equal(JSON.stringify(actual),JSON.stringify(expected),'UTM manteve fórmula/precisão/hemisfério');
  if(coordinate[1]>-80&&coordinate[1]<84)assert.equal(JSON.stringify(grid.utmFromWgs84(coordinate,zone)),JSON.stringify(expected));
  cases++;
 }
}
for(const bad of [[181,0],[-181,0],[0,84],[0,-80],[NaN,0]]){assert.throws(()=>grid.utmFromWgs84(bad));cases++;}
const color=load('src/lib/polygonSourceColors.ts');
const fixtures=[
 [{}, {fill:'',stroke:''}],
 [{fillColor:'#0000ff'}, {fill:'#0000ff',stroke:'#0000ff'}],
 [{lotColor:'#abcdef'}, {fill:'#abcdef',stroke:'#abcdef'}],
 [{fillColor:'#aaaacc',lotColor:'#bbbbcc',strokeColor:'#ffee22'}, {fill:'#aaaacc',stroke:'#ffee22'}],
 [{fillColor:'red',lotColor:'#123456',strokeColor:'invalid'}, {fill:'#123456',stroke:'#123456'}],
 [{fillColor:'#AAAAAA',strokeColor:'#000000'}, {fill:'#AAAAAA',stroke:'#000000'}]
];
for(const [input,expected] of fixtures){assert.deepEqual(JSON.parse(JSON.stringify(color.polygonSourceColors(input))),expected);cases++;}
const engine=load('src/features/memorial/memorialEngine.ts',{
 '../../lib/wgs84Utm':utm,
 '../../lib/sphericalGeodesy':sphericalGeodesy,
 '../croqui/projectGeojsonGeometry':load('src/features/croqui/projectGeojsonGeometry.ts'),
 '../../lib/geoJsonRings':geoRings,
 '../croqui/croquiGeometry':{readConfrontation:()=>''}
});
const division=load('src/features/croqui/divisionPerimeter.ts',{'../memorial/memorialEngine':engine});
const ring=[[-39.5,-12.9],[-39.49,-12.9],[-39.49,-12.89],[-39.5,-12.89]];
const expectedPerimeter=ring.reduce((n,pt,i)=>n+engine.distance(pt,ring[(i+1)%ring.length]),0);
assert.equal(division.divisionPerimeter({perimeterM:5000,rings:[ring]}),5000);cases++;
assert.equal(division.divisionPerimeter({perimeterM:0,rings:[ring]}),expectedPerimeter);cases++;
assert.equal(division.divisionPerimeter({perimeterM:-1,rings:[ring]}),expectedPerimeter);cases++;
assert.equal(division.divisionPerimeter({perimeterM:0,rings:[]}),0);cases++;
const vertex=load('src/features/croqui/vertexPointMatch.ts');
const feature={id:'p',geoJson:{type:'Point',coordinates:[-39.5,-12.9]},properties:{pointOrigin:'importado'}};
const far={id:'far',geometry:{type:'Point',coordinates:[-39.5001,-12.9]},properties:{}};
const poly={id:'polygon',geometry:{type:'Polygon',coordinates:[ring]},properties:{}};
assert.equal(vertex.findPointFeatureAtVertex([poly,far,feature],[-39.5,-12.9]),feature);cases++;
assert.equal(vertex.findPointFeatureAtVertex([far,feature],[-39.5000005,-12.9]),feature);cases++;
assert.equal(vertex.findPointFeatureAtVertex([far],[-39.5,-12.9]),undefined);cases++;
assert.equal(vertex.findPointFeatureAtVertex([],[-39.5,-12.9]),undefined);cases++;
// Regressão da leitura compartilhada de anéis GeoJSON: sem arredondar ou mudar CRS.
const ringChecks=[
 [null,[]], [{},[]], [[],[]], [[[1,2],[1,3]],[]],
 [[[1,2],[1,3],[2,3]],[[1,2],[1,3],[2,3]]],
 [[[1,2],[1,3],[2,3],[1,2]],[[1,2],[1,3],[2,3]]],
 [[['1','2'],['1','3'],['2','3'],['1','2']],[[1,2],[1,3],[2,3]]],
 [[[181,0],[1,2],[1,3],[2,3]],[[1,2],[1,3],[2,3]]],
 [[[-181,0],[1,2],[1,3],[2,3]],[[1,2],[1,3],[2,3]]],
 [[[0,91],[1,2],[1,3],[2,3]],[[1,2],[1,3],[2,3]]],
 [[['x',3],[1,2],[1,3],[2,3]],[[1,2],[1,3],[2,3]]]
];
for(const [raw,expected] of ringChecks){
 assert.deepEqual(JSON.parse(JSON.stringify(geoRings.readOpenLonLatRing(raw))),expected);
 cases++;
}
for(const coordinate of [[-180,-90],[180,90],[0,0],['-39.5','-12.9']]){
 assert.equal(geoRings.isValidLonLat(coordinate),true);cases++;
}
for(const coordinate of [[181,0],[0,-91],null,['invalid',0],[Infinity,0]]){
 assert.equal(geoRings.isValidLonLat(coordinate),false);cases++;
}
for(const file of ['src/features/croqui/CroquiPage.tsx','src/features/memorial/MemorialPage.tsx','src/features/generations/LotCenterPage.tsx']){
 assert.match(fs.readFileSync(file,'utf8'),/polygonSourceColors\(/);cases++;
}
for(const file of ['src/features/memorial/croquiRenderer.ts','src/features/documents/technicalSheet.ts']){
 assert.match(fs.readFileSync(file,'utf8'),/const divisionPerim=divisionPerimeter;/);cases++;
}
console.log(`SURVEYOR BLOCO 1: ${cases} verificações de projeção UTM, cores, perímetros, pontos e integração aprovadas.`);
