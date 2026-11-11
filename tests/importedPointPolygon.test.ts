import {describe,it,expect} from 'vitest';
import type {Feature, Geometry, GeoJsonProperties} from 'geojson';
import {buildPolygonFromBatch, importedPointBatches, polygonRingFromBatch, visibleOnMap} from '../src/features/map/importedPointPolygon';
const point=(i:number, lon:number, lat:number, batch?:string):Feature<Geometry, GeoJsonProperties>=>({type:'Feature',id:`p-${i}`,geometry:{type:'Point',coordinates:[lon,lat]},properties:{name:`P-${i}`,pointOrigin:'importado',...(batch?{pointBatchId:batch,pointBatchName:`Lote ${batch}.csv`}:{})}});
const points=[point(1,-40,-13,'a'),point(2,-39.999,-13,'a'),point(3,-39.999,-12.999,'a'),point(4,-40,-12.999,'a')];
describe('Gerar polígono de pontos importados',()=>{
 it('exige mais de três pontos e separa importações',()=>{expect(importedPointBatches(points.slice(0,3))).toHaveLength(0);expect(importedPointBatches([...points,point(5,-39,-12,'b')])).toHaveLength(1);});
 it('liga na ordem original e fecha no primeiro ponto',()=>{expect(polygonRingFromBatch(importedPointBatches(points)[0])).toEqual([[-40,-13],[-39.999,-13],[-39.999,-12.999],[-40,-12.999],[-40,-13]]);});
 it('aceita última linha repetida como fechamento',()=>{const result=polygonRingFromBatch({id:'a',label:'teste',points:[...points,point(5,-40,-13,'a')]});expect(result).toHaveLength(5);});
 it('impede geometria que se auto-intersecta',()=>{const crossed=[points[0],points[2],points[1],points[3]];expect(()=>polygonRingFromBatch({id:'x',label:'x',points:crossed})).toThrow('se cruzam');});
 it('preserva os pontos e reexibe alfinetes se o polígono for excluído',()=>{const stored=points.map(p=>({...p,properties:{...p.properties,pointPolygonId:'poly1'}}));const poly:Feature<Geometry,GeoJsonProperties>={type:'Feature',id:'poly1',geometry:{type:'Polygon',coordinates:[polygonRingFromBatch({id:'a',label:'x',points})]},properties:{name:'Perímetro'}};expect(visibleOnMap(stored[0],[...stored,poly])).toBe(false);expect(visibleOnMap(stored[0],stored)).toBe(true);});
 it('oferece converter importação de versões antigas sem agrupamento',()=>{const legacy=points.map(p=>({...p,properties:{...p.properties,pointBatchId:undefined}}));expect(importedPointBatches(legacy)[0].points).toHaveLength(4);});
 it('ignora coordenadas repetidas no meio do arquivo sem perder a sequência dos pontos únicos',()=>{
  const input={id:'a',label:'arquivo com repetições',points:[points[0],points[1],point(5,-39.999,-13,'a'),points[2],points[3],point(6,-39.999,-13,'a')]};
  const result=buildPolygonFromBatch(input);
  expect(result.uniqueVertices).toBe(4);
  expect(result.skippedDuplicates).toBe(2);
  expect(result.ring).toEqual(polygonRingFromBatch({id:'a',label:'x',points}));
  expect(input.points).toHaveLength(6); // entradas preservadas
 });
 it('rejeita quando não há três coordenadas distintas após descartar repetições',()=>{
  const repeated={id:'x',label:'x',points:[points[0],points[0],points[1],points[0]]};
  expect(()=>buildPolygonFromBatch(repeated)).toThrow('menos de três coordenadas distintas');
 });
 it('não marca auto-interseção falsa em perímetro pequeno e estreito',()=>{
  // Dimensões da ordem de dezenas de metros. O antigo epsilon em graus
  // causava falso positivo de interseção entre lados não adjacentes.
  const input=[[-39.60000,-13.13000],[-39.59982,-13.12996],[-39.59980,-13.12950],[-39.59998,-13.12954]]
    .map(([lon,lat],i)=>point(i+30,lon,lat,'x'));
  expect(buildPolygonFromBatch({id:'x',label:'x',points:input}).uniqueVertices).toBe(4);
 });
 it('não mistura importações e nunca mescla pontos diferentes apenas por proximidade normal de campo',()=>{
  const input=[point(1,-39.6,-13.13,'a'),point(2,-39.599999,-13.13,'a'),point(3,-39.599999,-13.129999,'a'),point(4,-39.6,-13.129999,'a')];
  const result=buildPolygonFromBatch({id:'a',label:'a',points:input});
  expect(result.uniqueVertices).toBe(4);
  expect(result.skippedDuplicates).toBe(0);
 });

});
