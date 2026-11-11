import {describe,it,expect} from 'vitest';
import {mapDraftKeys} from '../src/features/map/mapDraftStorage';
import {openRing,closeRing,insertVertexOnEdge,removeVertexAt,replaceExteriorRing,segmentMetadataAfterInsert,segmentMetadataAfterRemove} from '../src/features/map/vertexEditing';
import {geometryLines,findMapSnap} from '../src/features/map/mapSnap';
import {measureMapGeometry} from '../src/features/map/geometryMetrics';
import {hasVerifiedMapEdits,serializeMapFeature} from '../src/features/map/mapCloudPersistence';
import type {Feature,Geometry,GeoJsonProperties} from 'geojson';

describe('Etapa 75: paridade e integridade com SURVEYOR RC185',()=>{
 it('isola rascunhos e revisões por conta e projeto, mantendo legado separado',()=>{
  const a=mapDraftKeys('conta-a','p/3'), b=mapDraftKeys('conta-b','p/3'),c=mapDraftKeys('conta-a','p/4');
  expect(new Set([a.draft,b.draft,c.draft]).size).toBe(3);
  expect(a.metadata).not.toBe(b.metadata);
  expect(a.sync).not.toBe(b.sync);
  expect(a.legacyDraft).toBe(b.legacyDraft); // somente recuperação com confirmação explícita
  expect(a.draft).not.toBe(a.legacyDraft);
 });
 const outer=[[0,0],[10,0],[10,10],[0,10],[0,0]];
 const hole=[[2,2],[3,2],[3,3],[2,3],[2,2]];
 it('habilitar subpontos não modifica o anel, inserir só modifica a aresta escolhida',()=>{
  const initial=JSON.stringify(outer);
  const open=openRing(outer);
  expect(open.length).toBe(4);
  expect(JSON.stringify(outer)).toBe(initial);
  expect(insertVertexOnEdge(open,1,[10,5])).toEqual([[0,0],[10,0],[10,5],[10,10],[0,10],[0,0]]);
  expect(JSON.stringify(outer)).toBe(initial);
 });
 it('remove o vértice selecionado e mantém o fechamento válido',()=>{
  expect(removeVertexAt(openRing(outer),2)).toEqual([[0,0],[10,0],[0,10],[0,0]]);
  expect(()=>removeVertexAt([[0,0],[10,0],[0,10]],0)).toThrow();
  expect(()=>insertVertexOnEdge(openRing(outer),20,[1,1])).toThrow();
 });
 it('mantém confrontantes por trecho quando insere um vértice',()=>{
  const props={confrontants:{'0-1':'Maria','1-2':'Valdemir','2-3':'José','0-3':'Rua'},confrontantDetails:{'0':{owner:'Maria'},'1':{owner:'Valdemir'},'2':{owner:'José'},'3':{owner:'Prefeitura'}}};
  const after=segmentMetadataAfterInsert(props,1,4);
  expect(after.confrontants).toEqual({'0-1':'Maria','1-2':'Valdemir','2-3':'Valdemir','3-4':'José','0-4':'Rua'});
  expect((after.confrontantDetails as Record<string,{owner:string}>)['2'].owner).toBe('Valdemir');
  expect(props.confrontants['2-3']).toBe('José');
 });
 it('na remoção preserva rótulos não afetados e marca divergência do limite unido',()=>{
  const props={confrontants:{'0-1':'Maria','1-2':'Valdemir','2-3':'José','0-3':'Rua'}};
  const after=segmentMetadataAfterRemove(props,2,4);
  expect(after.confrontants).toEqual({'0-1':'Maria','0-2':'Rua'});
  expect(after.confrontantRevisaoPendente).toBe(true);
  expect(after.confrontantCadastroAnterior).toBeDefined();
  const same=segmentMetadataAfterRemove({confrontants:{'0-1':'A','1-2':'B','2-3':'B','0-3':'C'}},2,4);
  expect(same.confrontants).toEqual({'0-1':'A','1-2':'B','0-2':'C'});
  expect(same.confrontantRevisaoPendente).toBeUndefined();
 });
 it('preserva furos e altura ao editar apenas o anel externo',()=>{
  const rings=[outer,hole];const before=JSON.stringify(rings);
  const updated=replaceExteriorRing(rings,insertVertexOnEdge(openRing(outer),0,[5,0]));
  expect(updated[0]).toHaveLength(6);
  expect(updated[1]).toEqual(hole);
  expect(updated[1]).not.toBe(hole);
  expect(JSON.stringify(rings)).toBe(before);
  expect(closeRing([[0,0],[1,0],[0,1]])).toEqual([[0,0],[1,0],[0,1],[0,0]]);
 });
 it('snap reconhece vértices, segmentos e componentes MultiPolygon',()=>{
  const g={geometry:{type:'MultiPolygon',coordinates:[[[[0,0],[10,0],[10,10],[0,10],[0,0]]],[[[20,0],[30,0],[30,10],[20,10],[20,0]]]]}};
  const toPx=([lat,lng]:[number,number]):[number,number]=>[lng*10,lat*10];
  expect(geometryLines(g.geometry).length).toBe(2);
  const vertex=findMapSnap([g],[.2,.2],toPx,15);
  expect(vertex?.kind).toBe('vertice');expect(vertex?.position).toEqual([0,0]);
  const edge=findMapSnap([g],[.3,5],toPx,15);
  expect(edge?.kind).toBe('segmento');expect(edge?.position[0]).toBeCloseTo(0);
  expect(findMapSnap([g],[40,40],toPx,15)).toBe(null);
  expect(findMapSnap([{...g,hidden:true}],[0,0],toPx,15)).toBe(null);
 });
 it('calcula áreas de Polygon com buraco e MultiPolygon sem perder as partes',()=>{
  const lon=-39,lat=-13;
  const outer=[[lon,lat],[lon+.02,lat],[lon+.02,lat+.02],[lon,lat+.02],[lon,lat]];
  const hole=[[lon+.005,lat+.005],[lon+.01,lat+.005],[lon+.01,lat+.01],[lon+.005,lat+.01],[lon+.005,lat+.005]];
  const single=measureMapGeometry({type:'Polygon',coordinates:[outer]});
  const withHole=measureMapGeometry({type:'Polygon',coordinates:[outer,hole]});
  const multi=measureMapGeometry({type:'MultiPolygon',coordinates:[[outer,hole],[outer]]});
  expect(withHole.areaM2).toBeLessThan(single.areaM2);
  expect(withHole.perimeterMeters).toBeGreaterThan(single.perimeterMeters);
  expect(multi.parts).toBe(2);
  expect(multi.areaM2).toBeCloseTo(withHole.areaM2+single.areaM2,6);
  expect(multi.vertexCount).toBe(12);
  expect(measureMapGeometry({type:'Point',coordinates:[-39,-13]}).areaM2).toBe(0);
 });
 it('não confirma a nuvem quando descarta QUALQUER campo técnico, incluindo rótulos',()=>{
  const f:Feature<Geometry,GeoJsonProperties>={type:'Feature',id:'area1',geometry:{type:'Polygon',coordinates:[outer]},properties:{name:'GLEBA 01',fillColor:'#abc123',areaLabelLat:-12.5,areaLabelLng:-39.6,confrontantDetails:{'1-2':{name:'Valdemir',cpf:'12345678900'}},customLabel:'Ponto A'}};
  const original=[f];const cloud=[{id:'db',geoJson:f.geometry,properties:serializeMapFeature(f)}];
  expect(hasVerifiedMapEdits(cloud,original)).toBe(true);
  expect(hasVerifiedMapEdits([{...cloud[0],properties:{...cloud[0].properties,areaLabelLng:0}}],original)).toBe(false);
  const {customLabel:_,...truncated}=cloud[0].properties;
  expect(hasVerifiedMapEdits([{...cloud[0],properties:truncated}],original)).toBe(false);
 });
});
