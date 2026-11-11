import {describe,it,expect,vi} from 'vitest';
import {layersForUF,polygonMeasures,layerProxyUrl} from '../src/features/map/geoServices';
import {csvFeatures,kmlFeatures,toKml,toCsv} from '../src/features/map/mapFormats';
import type {Feature,Geometry} from 'geojson';
describe('SURVEYOR · ferramentas cartográficas',()=>{
 it('mantém as camadas do GeoBahia no endereço do Worker',()=>{
  const layers=layersForUF('BA');expect(layers.length).toBeGreaterThan(10);
  expect(layers[0].layers).toContain('cefir_imovel_rural_limite_inema');
  expect(layerProxyUrl(layers[0])).toContain('/wms?target=');
 });
 it('calcula medidas aproximadas não negativas',()=>{
  const result=polygonMeasures([[-39.6,-13],[-39.59,-13],[-39.59,-12.99],[-39.6,-13]]);
  expect(result.area).toBeGreaterThan(0);expect(result.perimeter).toBeGreaterThan(0);
 });
 it('exporta KML e CSV sem perder atributos simples',()=>{
  const f:Feature<Geometry>={type:'Feature',id:'teste',properties:{name:'Fazenda & Lote'},geometry:{type:'Point',coordinates:[-39.6,-13]}};
  expect(toKml([f])).toContain('Fazenda &amp; Lote');expect(toCsv([f])).toContain('Fazenda & Lote');
 });
 it('importa todos os polígonos e anéis internos de um placemark KML',()=>{
  type TestNode={name:string;textContent:string|null;children:TestNode[];getElementsByTagName:(name:string)=>TestNode[]};
  const node=(name:string,text:string|null=null,children:TestNode[]=[]):TestNode=>({name,textContent:text??children.map(child=>child.textContent||'').join(''),children,getElementsByTagName(tag){return children.flatMap(child=>[...(child.name===tag?[child]:[]),...child.getElementsByTagName(tag)]);}});
  const coords=(value:string)=>node('coordinates',value);
  const polygon=(outer:string,inner:string[]=[])=>node('Polygon',null,[node('outerBoundaryIs',null,[node('LinearRing',null,[coords(outer)])]),...inner.map(value=>node('innerBoundaryIs',null,[node('LinearRing',null,[coords(value)])]))]);
  const placemark=node('Placemark',null,[node('name','Matrícula 01'),node('MultiGeometry',null,[
   polygon('0e0,0 4,0 4,4 0,4 0,0',['1,1 1,2 2,2 2,1 1,1']),
   polygon('5,0 8,0 8,3 5,3 5,0')
  ])]);
  const document={querySelector:()=>null,getElementsByTagName:(tag:string)=>tag==='Placemark'?[placemark]:[]};
  class TestDOMParser{parseFromString(){return document;}}
  vi.stubGlobal('DOMParser',TestDOMParser);
  try{
   const imported=kmlFeatures('<kml/>');
   expect(imported).toHaveLength(1);
   expect(imported[0].geometry).toMatchObject({type:'MultiPolygon',coordinates:[
    [[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[1,2],[2,2],[2,1],[1,1]]],
    [[[5,0],[8,0],[8,3],[5,3],[5,0]]]
   ]});
  }finally{vi.unstubAllGlobals();}
 });
 it('rejeita a geometria KML inteira quando uma coordenada sai da faixa WGS84',()=>{
  type TestNode={name:string;textContent:string|null;children:TestNode[];getElementsByTagName:(name:string)=>TestNode[]};
  const node=(name:string,text:string|null=null,children:TestNode[]=[]):TestNode=>({name,textContent:text??children.map(child=>child.textContent||'').join(''),children,getElementsByTagName(tag){return children.flatMap(child=>[...(child.name===tag?[child]:[]),...child.getElementsByTagName(tag)]);}});
  const coordinates=node('coordinates','181,0 1,0 1,1 181,0');
  const placemark=node('Placemark',null,[node('Polygon',null,[node('outerBoundaryIs',null,[node('LinearRing',null,[coordinates])])])]);
  const document={querySelector:()=>null,getElementsByTagName:(tag:string)=>tag==='Placemark'?[placemark]:[]};
  class TestDOMParser{parseFromString(){return document;}}
  vi.stubGlobal('DOMParser',TestDOMParser);
  try{expect(kmlFeatures('<kml/>')).toEqual([]);}finally{vi.unstubAllGlobals();}
 });
 it('neutraliza fórmulas em campos de texto exportados para CSV',()=>{
  const f:Feature<Geometry>={type:'Feature',id:'=1+1',properties:{name:'@SUM(A1:A2)'},geometry:{type:'Point',coordinates:[-39.6,-13]}};
  const row=toCsv([f]).split('\r\n')[1];
  expect(row).toContain('"\'=1+1"');expect(row).toContain(';"\'@SUM(A1:A2)";');
 });
 it('reimporta nomes que começam por hífen sem manter o prefixo de proteção CSV',()=>{
  const f:Feature<Geometry>={type:'Feature',id:'gleba-1',properties:{name:'- Gleba 01'},geometry:{type:'Point',coordinates:[-39.6,-13]}};
  expect(csvFeatures(toCsv([f]))[0].properties?.name).toBe('- Gleba 01');
  const quoted:Feature<Geometry>={...f,properties:{name:"'- Gleba 01"}};
  expect(csvFeatures(toCsv([quoted]))[0].properties?.name).toBe("'- Gleba 01");
 });
 it('preserva nomes CSV com delimitadores e quebras de linha no round-trip SURVEYOR',()=>{
  const f:Feature<Geometry>={type:'Feature',id:'gleba-2',properties:{name:'- Gleba; 02\nNorte'},geometry:{type:'Point',coordinates:[-39.6,-13]}};
  expect(csvFeatures(toCsv([f]))[0].properties?.name).toBe('- Gleba; 02\nNorte');
 });
 it('preserva apóstrofo literal em CSV externo com cabeçalhos semelhantes',()=>{
  const imported=csvFeatures('id;nome;tipo;latitude;longitude;coordenadas_geojson\n1;\'- nome literal;Point;-13;-39;"[-39,-13]"');
  expect(imported[0].properties?.name).toBe("'- nome literal");
 });
 it('ignora separadores que aparecem dentro de cabeçalhos entre aspas',()=>{
  const imported=csvFeatures('"campo;extra",latitude,longitude\nvalor,-13,-39');
  expect(imported).toHaveLength(1);
  expect(imported[0].geometry).toMatchObject({type:'Point',coordinates:[-39,-13]});
 });
 it('preserva latitude e longitude iguais a zero no CSV',()=>{
  const f:Feature<Geometry>={type:'Feature',id:'meridiano',properties:{name:'Ponto zero'},geometry:{type:'Point',coordinates:[0,0]}};
  expect(toCsv([f]).split('\r\n')[1]).toContain(';"0";"0";');
 });
 it('preserva identificador numérico zero no CSV',()=>{
  const f:Feature<Geometry>={type:'Feature',id:0,properties:{name:'Origem'},geometry:{type:'Point',coordinates:[0,0]}};
  expect(toCsv([f]).split('\r\n')[1].startsWith('"0";')).toBe(true);
 });
});
