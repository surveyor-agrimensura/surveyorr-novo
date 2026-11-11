import {describe,it,expect} from 'vitest';
import {defaultSheet,normalizeSheet,renderTechnicalSheet} from './technicalSheet';
import {defaultCroquiSettings,renderCroqui} from '../memorial/croquiRenderer';
import {distance,polygonArea,type SurveyPolygon,type Vertex} from '../memorial/memorialEngine';
import type {ProjectDivision} from '../croqui/projectDivisions';
import {exteriorBoundaryRuns} from '../../lib/cartographicAutomation';

const rings:Vertex[][]=Array.from({length:4},(_,i)=>{
 const x=-39.65+(i%2)*0.0002,y=-12.99+Math.floor(i/2)*0.0002;
 return [[x,y],[x+.0002,y],[x+.0002,y+.0002],[x,y+.0002]];
});
const innerRing:Vertex[]=[[-39.64995,-12.98995],[-39.64991,-12.98995],[-39.64991,-12.98991],[-39.64995,-12.98991]];
const divisions:ProjectDivision[]=rings.map((ring,i)=>({
 featureId:`feature-${i}`,partIndex:0,category:'gleba',name:`GLEBA ${i+1}`,
 areaM2:polygonArea(ring),perimeterM:ring.reduce((sum,point,k)=>sum+distance(point,ring[(k+1)%ring.length]),0),
 color:['#ff0000','#00aa00','#0000ff','#ffaa00'][i],rings:i===0?[ring,innerRing]:[ring]
}));
const poly:SurveyPolygon={id:'feature-0',name:'Imóvel completo',properties:{},vertices:rings[0],areaM2:divisions[0].areaM2,perimeterM:divisions[0].perimeterM};
const ctx={municipality:'Amargosa/BA',owner:'Proprietário fictício',company:'Teste',date:'28/10/2026',publicUrl:'',divisions,composite:true};

describe('prancha e croqui de imóvel com quatro glebas importadas',()=>{
 it('mostra todas as quatro geometrias e minimapas sem conectar polígonos distintos',()=>{
  const svg=renderTechnicalSheet(poly,{...defaultSheet(),background:'vector'},ctx);
  expect((svg.match(/data-sheet-division="feature-\d"/g)||[])).toHaveLength(4);
  expect((svg.match(/data-sheet-mini-division="feature-\d"/g)||[])).toHaveLength(4);
  expect(svg).not.toContain('data-sheet-polygon="true"');
 });
 it('preserva vazios internos sem pintar o mapa com branco sobre eles',()=>{
  const sheet=renderTechnicalSheet(poly,defaultSheet(),ctx);
  const croqui=renderCroqui(poly,defaultCroquiSettings(),{company:'Teste',mapLink:'',municipality:'Amargosa/BA',divisions,composite:true});
  expect(sheet).toMatch(/data-sheet-polygon="division:feature-0:0" d="[^"]+ Z M /);
  expect(sheet).toMatch(/data-sheet-mini-division="feature-0"><path d="[^"]+ Z M /);
  expect(croqui).toMatch(/data-croqui-division="feature-0"[^>]*d="[^"]+ Z M /);
 });
 it('dimensiona os anéis internos na prancha e no croqui do imóvel composto',()=>{
  const boundaries=divisions.map(part=>({id:`${part.featureId}:${part.partIndex}`,points:part.rings[0]||[],holes:part.rings.slice(1)}));
  const withoutHoles=divisions.map((part,index)=>index===0?{...part,rings:[part.rings[0]]}:part);
  const expectedHoleRuns=exteriorBoundaryRuns(boundaries,{mergeCollinear:true}).length-exteriorBoundaryRuns(withoutHoles.map(part=>({id:`${part.featureId}:${part.partIndex}`,points:part.rings[0]||[],holes:part.rings.slice(1)})),{mergeCollinear:true}).length;
  const sheet=renderTechnicalSheet(poly,{...defaultSheet(),exteriorCotas:true},ctx);
  const sheetWithoutHole=renderTechnicalSheet(poly,{...defaultSheet(),exteriorCotas:true},{...ctx,divisions:withoutHoles});
  const croqui=renderCroqui(poly,{...defaultCroquiSettings(),exteriorCotas:true},{company:'Teste',mapLink:'',municipality:'Amargosa/BA',divisions,composite:true});
  const croquiWithoutHole=renderCroqui(poly,{...defaultCroquiSettings(),exteriorCotas:true},{company:'Teste',mapLink:'',municipality:'Amargosa/BA',divisions:withoutHoles,composite:true});
  const count=(svg:string)=>(svg.match(/data-exterior-cota="/g)||[]).length;
  expect(count(sheet)-count(sheetWithoutHole)).toBe(expectedHoleRuns);
  expect(count(croqui)-count(croquiWithoutHole)).toBe(expectedHoleRuns);
  expect(sheet).toContain('data-sheet-label="division:feature-0:0:ring:1:vertex:0"');
  expect(croqui).toContain('data-croqui-label="division:feature-0:0:ring:1:vertex:0"');
  expect(sheet).toContain('A01-H01-V01');
  expect(croqui).toContain('A01-H01-V01');
 });
 it('usa a feição-base tanto nas medidas totais como nas cotas externas',()=>{
  const base:Vertex[]=[[0,0],[.001,0],[.001,.001],[0,.001]];
  const detached:Vertex[]=[[.002,.002],[.003,.002],[.003,.003],[.002,.003]];
  const area=(ring:Vertex[])=>polygonArea(ring);
  const perimeterOf=(ring:Vertex[])=>ring.reduce((sum,point,index)=>sum+distance(point,ring[(index+1)%ring.length]),0);
  const baseDivision:ProjectDivision={featureId:'base',partIndex:0,category:'Perímetro Geral',name:'Imóvel completo',areaM2:area(base),perimeterM:perimeterOf(base),rings:[base]};
  const detachedDivision:ProjectDivision={featureId:'detached',partIndex:0,category:'gleba',name:'Gleba fora',areaM2:area(detached),perimeterM:perimeterOf(detached),rings:[detached]};
  const duplicateBase:ProjectDivision={...baseDivision,featureId:'base-copy'};
  const testPolygon:SurveyPolygon={id:'base',name:'Imóvel completo',properties:{},vertices:base,areaM2:area(base),perimeterM:perimeterOf(base)};
  const renderSheet=(items:ProjectDivision[])=>renderTechnicalSheet(testPolygon,{...defaultSheet(),exteriorCotas:true},{...ctx,divisions:items,composite:true});
  const renderMap=(items:ProjectDivision[])=>renderCroqui(testPolygon,{...defaultCroquiSettings(),exteriorCotas:true},{company:'Teste',mapLink:'',municipality:'Amargosa/BA',divisions:items,composite:true});
  const count=(svg:string)=>(svg.match(/data-exterior-cota="/g)||[]).length;
  expect(count(renderSheet([baseDivision,detachedDivision]))).toBe(count(renderSheet([baseDivision,duplicateBase])));
  expect(count(renderMap([baseDivision,detachedDivision]))).toBe(count(renderMap([baseDivision,duplicateBase])));
 });
 it('cria rótulos movíveis e vértices independentes para cada uma das quatro glebas',()=>{
  const svg=renderTechnicalSheet(poly,defaultSheet(),ctx);
  divisions.forEach((part,i)=>{
   expect(svg).toContain(`data-sheet-label="division:${part.featureId}:0:title"`);
   for(let k=0;k<rings[i].length;k++)expect(svg).toContain(`data-sheet-label="division:${part.featureId}:0:vertex:${k}"`);
  });
 });
 it('preserva renomeação, cores e ocultação individual sem afetar demais glebas',()=>{
  const settings=normalizeSheet({...defaultSheet(),divisionNames:{'division:feature-2:0:title':'Área da Maria'},divisionColors:{'feature-3:0':'#123456'},hiddenDivisionVertices:{'division:feature-1:0:vertex:0':true}});
  const svg=renderTechnicalSheet(poly,settings,ctx);
  expect(svg).toContain('Área da Maria');
  expect(svg).toContain('stroke="#123456"');
  expect(svg).not.toContain('data-sheet-label="division:feature-1:0:vertex:0"');
  expect(svg).toContain('data-sheet-label="division:feature-0:0:vertex:0"');
 });
 it('croqui completo tem os vértices de todas as glebas sem destacar apenas a primeira',()=>{
  const svg=renderCroqui(poly,defaultCroquiSettings(),{company:'Teste',mapLink:'',municipality:'Amargosa/BA',divisions,composite:true});
  divisions.forEach(part=>expect(svg).toContain(`data-croqui-label="division:${part.featureId}:0:vertex:0"`));
  expect(svg).not.toContain('data-croqui-polygon="true"');
 });
});
