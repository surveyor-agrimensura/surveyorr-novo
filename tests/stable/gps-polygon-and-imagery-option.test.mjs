import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const mapSource=readFileSync('assets/js/features/mapa/app.js','utf8');
const start=mapSource.indexOf('  function addPolygonFromImportedPoints(');
const end=mapSource.indexOf('  function projectContentSignature(',start);
assert.ok(start>0&&end>start);
const trace=[];
const vertices={clearLayers(){trace.push('clear-point-overlays');}};
const fakePolygon={bringToFront(){},getBounds(){return {} }};
const context=vm.createContext({
  L:{polygon(coords){trace.push('make-polygon');assert.equal(coords.length,3);return fakePolygon;}},
  surveyorFinalStyle(){return {color:'#223344'};},
  resetInteractionModes(){trace.push('exit-draw-edit');},
  pushUndoSnapshot(){trace.push('undo');},snapshotDrawn(){return {};},
  addLayer(polygon,props){trace.push('add-polygon');assert.equal(props.importedPointTypes.join(','),'P,P,M');},
  select(){trace.push('select');},refresh(){trace.push('refresh');},
  vertexMarkers:vertices
});
vm.runInContext(mapSource.slice(start,end)+'\nglobalThis.importPolygon=addPolygonFromImportedPoints;',context);
const result=context.importPolygon([
  {lat:-13.01,lng:-39.55,imported:true,pointCode:'P-01'},
  {lat:-13.02,lng:-39.54,imported:true,pointCode:'P-02'},
  {lat:-13.03,lng:-39.53,imported:true,pointCode:'M-03',hasPhysicalMark:true}
],{name:'Área importada'});
assert.equal(result,fakePolygon);
assert.ok(trace.indexOf('exit-draw-edit')<trace.indexOf('make-polygon'), 'Edição deve terminar antes da criação da nova geometria');
assert.ok(trace.indexOf('clear-point-overlays')>trace.indexOf('select'), 'A seleção automática não deve deixar marcadores temporários');
assert.ok(trace.includes('undo'),'Histórico deve continuar disponível');
assert.throws(()=>context.importPolygon([{lat:1,lng:1}],{}),/3 pontos válidos/);
assert.equal(trace.filter(x=>x==='exit-draw-edit').length,1,'Importação inválida não deve alterar o estado de edição');

const croqui=readFileSync('assets/js/features/mapas/app.js','utf8');
const h=readFileSync('mapas/index.html','utf8');
assert.match(h,/<option value="satClarity">Satélite histórico \(Esri Clarity, experimental\)<\/option>/);
const serviceCode=croqui.slice(croqui.indexOf('  function isGoogleBackground('),croqui.indexOf('  function backgroundUrl('));
const env=vm.createContext({});
vm.runInContext(serviceCode+'\nglobalThis.resolveTileBase=backgroundTileBaseUrl;',env);
assert.match(env.resolveTileBase('satClarity','World_Imagery'),/^https:\/\/clarity\.maptiles\.arcgis\.com\//);
assert.equal(env.resolveTileBase('sat','World_Imagery'),'https://mt1.google.com/vt','A base atual segue a origem do mapa público');
assert.equal(env.resolveTileBase('satOriginal','World_Imagery'),'https://mt1.google.com/vt','A base satélite original da RC185.51 usa a origem comum');
assert.match(croqui,/arcgis-tiles:\$\{backgroundTileBaseUrl\(kind, service\)\}/,'Fontes distintas precisam de chaves de cache distintas');
assert.match(croqui,/if \(kind !== 'satClarity' && kind !== 'satWayback2023'\) \{\s*for \(const url of rawUrls\)/,'Clarity não pode reutilizar imagem padrão guardada em cache');
assert.match(croqui,/if \(kind === 'satClarity' \|\| kind === 'satWayback2023'\) return '';/,'Não retornar nuvens do satélite comum quando Clarity estiver indisponível');
console.log('PASS gps-polygon-and-imagery-option: importação limpa edição e indicadores sem perder vértices; satélite histórico usa cache separado e é opcional.');
