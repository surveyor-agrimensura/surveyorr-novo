/* Regressão independente do navegador: zoom relativo ao imóvel e projeção única. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function transpiled(file,dependencies={}){
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{exports:module.exports,module,require:id=>{
    if(Object.prototype.hasOwnProperty.call(dependencies,id))return dependencies[id];
    throw Error(`Dependência não prevista: ${id}`);
  },console,Math,Number,String,Array,Object,JSON,Map,Set,RegExp,Date,structuredClone});
  return module.exports;
}
const projectGeo=transpiled('src/features/croqui/projectGeojsonGeometry.ts');
const geoRings=transpiled('src/lib/geoJsonRings.ts');
const utmCore=transpiled('src/lib/wgs84Utm.ts');
const sphericalGeodesy=transpiled('src/lib/sphericalGeodesy.ts');
const engine=transpiled('src/features/memorial/memorialEngine.ts',{'../../lib/wgs84Utm':utmCore,'../../lib/sphericalGeodesy':sphericalGeodesy,'../croqui/projectGeojsonGeometry':projectGeo,'../../lib/geoJsonRings':geoRings,'../croqui/croquiGeometry':{readConfrontation:()=>''}});
const zoom=transpiled('src/lib/percentZoom.ts');
const contrast=transpiled('src/lib/svgTextContrast.ts');
const cartographic=transpiled('src/lib/cartographicAutomation.ts');
const mapOverlay=transpiled('src/lib/mapOverlayCoordinates.ts');
const divisionPerimeter=transpiled('src/features/croqui/divisionPerimeter.ts',{'../memorial/memorialEngine':engine});
const compositeMeasures=transpiled('src/features/croqui/compositeMeasures.ts',{'../../lib/cartographicAutomation':cartographic});
const renderer=transpiled('src/features/memorial/croquiRenderer.ts',{
 './official-croqui-template.svg?raw':'<svg></svg>',
 '../../lib/agrarianMeasure':{tarefaCaption:()=>''},
 '../../lib/customCotas':{drawCustomCotas:()=>'',normalizedCustomCotas:()=>[]},
 '../../lib/cartographicAutomation':cartographic,
 './memorialEngine':engine,
 '../croqui/divisionPerimeter':divisionPerimeter,
 '../croqui/compositeMeasures':compositeMeasures,
 '../croqui/croquiGeometry':{},
 '../croqui/labelLayout':{},
 '../croqui/confrontantCaption':{},
 '../croqui/projectDivisions':{divisionBounds:items=>{
   const pts=items.flatMap(x=>x.rings[0]);const x=pts.map(p=>p[0]),y=pts.map(p=>p[1]);
   return [[Math.min(...x),Math.min(...y)],[Math.min(...x),Math.max(...y)],[Math.max(...x),Math.min(...y)],[Math.max(...x),Math.max(...y)]];
 }},
 '../../lib/percentZoom':zoom,
 '../croqui/sharedMapAppearance':{normalizeMapNames:value=>Array.isArray(value)?value:[]},
 '../../lib/svgTextContrast':contrast,
 '../../lib/mapOverlayCoordinates':mapOverlay,
 '../../lib/confrontantVisualOrganizer':transpiled('src/lib/confrontantVisualOrganizer.ts')
});
const vertices=[[-39.51945,-13.1110],[-39.5191,-13.1108],[-39.5131,-13.1036],[-39.5134,-13.1039]];
const polygon={id:'sitio-ficticio',name:'QA Imóvel estreito',vertices,properties:{},areaM2:10000,perimeterM:900};
const settings=renderer.defaultCroquiSettings();
settings.background='satellite';
const fit=renderer.layoutForCroqui(polygon,settings);
assert.ok(fit.tiles.length>0,'Imagem de satélite deve ter mosaicos');
const extents=map=>({width:Math.max(...map.points.map(p=>p.x))-Math.min(...map.points.map(p=>p.x)),height:Math.max(...map.points.map(p=>p.y))-Math.min(...map.points.map(p=>p.y))});
const fitExtent=extents(fit);
assert.ok(fitExtent.width<=1112*.71,`largura da área enquadrada: ${fitExtent.width}`);
assert.ok(fitExtent.height<=590*.77,`altura da área enquadrada: ${fitExtent.height}`);
assert.ok(fitExtent.height>590*.71||fitExtent.width>1112*.65,'imóvel deve aproveitar o quadro, sem ficar minúsculo');
assert.equal(zoom.zoomToPercent(15),50);
assert.equal(zoom.percentToFitZoomOffset(50),0);
assert.ok(zoom.percentToFitZoomOffset(1)<0);
assert.ok(zoom.percentToFitZoomOffset(100)>0);
const atPercent=percentage=>renderer.layoutForCroqui(polygon,{...settings,zoom:zoom.percentToZoom(percentage)});
const smaller=atPercent(46),larger=atPercent(86);
const ratio=extents(larger).height/extents(smaller).height;
assert.ok(ratio>1.65&&ratio<1.9,`ampliação deve ser suave e relativa, não 48x (${ratio.toFixed(3)}x)`);
for(let i=1;i<=100;i++){
 const result=atPercent(i);
 assert.ok(Number.isFinite(result.zoom),`zoom válido em ${i}%`);
 if(i>1)assert.ok(result.zoom>atPercent(i-1).zoom,`zoom progressivo em ${i}%`);
 for(const tile of result.tiles){
  const z=Number(tile.url.match(/\/tile\/(\d+)\//)?.[1]);
  assert.ok(Number.isInteger(z)&&z<=19,`URL de mosaico deve usar nível XYZ válido (${tile.url})`);
 }
 // Cada vértice tem de ocupar a MESMA referência espacial dos mosaicos.
 for(const vertex of result.points){
  assert.ok(result.tiles.some(tile=>vertex.x>=tile.left-.01&&vertex.x<=tile.left+tile.tileSize+.01&&vertex.y>=tile.top-.01&&vertex.y<=tile.top+tile.tileSize+.01),`mosaico ausente sobre vértice ${i}%`);
 }
}
// Os documentos anteriores podem conter rótulos arrastados com o fit antigo.
// A migração deve preservar a posição geográfica visual e nunca mudar o GeoJSON.
const oldFrame=renderer.legacyLayoutForCroqui(polygon,settings);
const oldAnchor={x:oldFrame.points[0].x+44+35,y:oldFrame.points[0].y+74+18};
const overlay=transpiled('src/features/croqui/zoomCroquiOverlays.ts',{'../memorial/croquiRenderer':renderer});
const legacy={...settings,frameVersion:1,absoluteLabels:{'neighbor:0':oldAnchor},confrontantPins:{p:oldAnchor},labelOffsets:{'vertex:1':{dx:12,dy:8}},lines:[{id:'x',from:0,x:oldAnchor.x,y:oldAnchor.y,color:'#123456'}],easements:[{id:'r',points:[oldAnchor,{x:oldAnchor.x+10,y:oldAnchor.y}],geoPoints:[vertices[0],vertices[1]],color:'#16a34a',width:13}]};
const migrated=overlay.migrateCroquiFrame(polygon,legacy);
const expectedFactor=2**(fit.zoom-oldFrame.zoom);
const expectedX=fit.points[0].x+44+35*expectedFactor;
const expectedY=fit.points[0].y+74+18*expectedFactor;
assert.ok(Math.abs(migrated.absoluteLabels['neighbor:0'].x-expectedX)<.1);
assert.ok(Math.abs(migrated.absoluteLabels['neighbor:0'].y-expectedY)<.1);
assert.equal(migrated.frameVersion,2);
assert.deepEqual(JSON.parse(JSON.stringify(migrated.easements[0].geoPoints)),JSON.parse(JSON.stringify(legacy.easements[0].geoPoints)));
assert.deepEqual(JSON.parse(JSON.stringify(migrated.neighbors)),JSON.parse(JSON.stringify(legacy.neighbors)));
assert.equal(overlay.migrateCroquiFrame(polygon,migrated),migrated,'migração idempotente');
const oldOffset=renderer.layoutForCroqui(polygon,{...settings,backgroundOffsetX:135,backgroundOffsetY:-95});
assert.deepEqual(JSON.parse(JSON.stringify(oldOffset)),JSON.parse(JSON.stringify(fit)), 'Deslocamentos antigos não podem deformar georreferenciamento');
const divisions=[
 {featureId:'a',partIndex:0,rings:[vertices]},
 {featureId:'b',partIndex:0,rings:[vertices.map(([x,y])=>[x+.002,y+.002])]}
];
const fitComposite=renderer.layoutForCroqui(polygon,settings,divisions);
assert.equal(fitComposite.points.length,vertices.length);
assert.ok(fitComposite.zoom<=fit.zoom,'imóvel completo deve enquadrar as demais glebas, sem cortá-las');
const svgSource=fs.readFileSync('src/features/memorial/croquiRenderer.ts','utf8');
assert.ok(svgSource.includes('data-croqui-basemap="true">${images}'), 'camada raster não deve receber translate próprio');
console.log(`SURVEYOR: zoom relativo, 100 passos, ${ratio.toFixed(3)}x de 46% a 86%, enquadramento ${(fitExtent.height/590*100).toFixed(1)}% da altura, antes ${(extents(oldFrame).height/590*100).toFixed(1)}%, migração de rótulos aprovada.`);
