import {describe,it,expect} from 'vitest';
import {renderCroqui,defaultCroquiSettings} from '../src/features/memorial/croquiRenderer';
import {distance,polygonArea,type SurveyPolygon,type Vertex} from '../src/features/memorial/memorialEngine';
import type {ProjectDivision} from '../src/features/croqui/projectDivisions';
const gleba=(index:number):SurveyPolygon=>{
 const x=-39.6+index*0.0015,y=-13.15;
 const vertices:Vertex[]=[[x,y],[x+.001,y],[x+.001,y+.001],[x,y+.001]];
 return {id:`gleba-${index+1}`,name:`GLEBA ${index+1}`,vertices,properties:{name:`GLEBA ${index+1}`},areaM2:polygonArea(vertices),perimeterM:vertices.reduce((sum,v,i)=>sum+distance(v,vertices[(i+1)%vertices.length]),0)};
};
const polygons=Array.from({length:4},(_,i)=>gleba(i));
const divisions:ProjectDivision[]=polygons.map(p=>({featureId:p.id,partIndex:0,category:'',name:p.name,properties:p.properties,areaM2:p.areaM2,perimeterM:p.perimeterM,rings:[p.vertices]}));
const global=defaultCroquiSettings();
global.background='none';
global.featureStyles={'gleba-1':{fillColor:'#1d4ed8'}};
global.featureNames={'gleba-4':'GLEBA 04 OTAVIO'};
const byArea=Object.fromEntries(polygons.map(p=>[p.id,{...defaultCroquiSettings(),names:[`MARCO ${p.id}`],neighbors:[`CONFRONTANTE ${p.id}`],hiddenVertices:p.id==='gleba-2'?[1]:[]} ]));
const render=()=>renderCroqui(polygons[0],global,{company:'SURVEYOR',municipality:'',mapLink:'',propertyName:'Teste conjunto',divisions,composite:true,areaSettings:byArea});
describe('Croqui completo com quatro glebas',()=>{
 it('renderiza as quatro áreas clicáveis mesmo sem cor cadastrada',()=>{
  const svg=render();
  for(const p of polygons)expect(svg).toContain(`data-croqui-division="${p.id}"`);
  expect((svg.match(/pointer-events="all"/g)||[]).length).toBeGreaterThanOrEqual(4);
 });
 it('renderiza os nomes, confrontantes e vértices individuais por gleba',()=>{
  const svg=render();
  for(const p of polygons){expect(svg).toContain(`MARCO ${p.id}`);expect(svg).toContain(`CONFRONTANTE ${p.id}`);}
  expect(svg).not.toContain('data-croqui-area-vertex="gleba-2:1"');
  expect(svg).toContain('data-croqui-area-vertex="gleba-3:1"');
 });
 it('mantém as cores e nomes personalizados sem modificar a geometria',()=>{
  const original=structuredClone(polygons.map(p=>p.vertices));
  const svg=render();
  expect(svg).toContain('#1d4ed8');
  expect(svg).toContain('GLEBA 04 OTAVIO');
  expect(polygons.map(p=>p.vertices)).toEqual(original);
 });
});
