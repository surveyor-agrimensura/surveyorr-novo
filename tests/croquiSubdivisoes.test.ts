import {describe,it,expect} from 'vitest';
import {readProjectDivisions,divisionBounds} from '../src/features/croqui/projectDivisions';
import type {ProjectFeature} from '../src/features/projects/projectsApi';
import {getPolygons} from '../src/features/memorial/memorialEngine';
import {renderCroqui,defaultCroquiSettings,layoutForCroqui} from '../src/features/memorial/croquiRenderer';

const p=(x:number,y:number)=>[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]];
const features:ProjectFeature[]=[
 {id:'principal',geometry:{type:'Polygon',coordinates:[p(0,0)]},properties:{name:'Área total'}},
 {id:'gleba-a',geometry:{type:'Polygon',coordinates:[p(0,0)]},properties:{category:'Gleba',lotColor:'#dbeafe'}},
 {id:'gleba-b',geometry:{type:'Polygon',coordinates:[p(1,0)]},properties:{category:'Gleba'}},
 {id:'gleba-c',geometry:{type:'Polygon',coordinates:[p(0,1)]},properties:{category:'Gleba'}},
];
describe('Divisões visíveis no croqui',()=>{
 it('preserva um contorno independente para cada gleba cadastrada',()=>{
  const divisions=readProjectDivisions(features);
  expect(divisions).toHaveLength(4);
  expect(divisions.map(d=>d.featureId)).toEqual(['principal','gleba-a','gleba-b','gleba-c']);
  expect(divisions[1].color).toBe('#dbeafe');
  expect(divisions[1].rings[0]).toHaveLength(4); // fechamento GeoJSON removido só para projeção
  expect(divisionBounds(divisions)).toEqual([[0,0],[0,2],[2,0],[2,2]]);
 });
 it('desenha todas as divisões no croqui e preserva o enquadramento do lote selecionado',()=>{
  const divisions=readProjectDivisions(features);
  const parent=getPolygons(features)[0];
  const opts=defaultCroquiSettings();opts.background='none';
  const svg=renderCroqui(parent,opts,{company:'SURVEYOR',mapLink:'',municipality:'',divisions});
  expect(svg).toContain('data-croqui-division="gleba-a"');
  expect(svg).toContain('data-croqui-division="gleba-b"');
  expect(svg).toContain('data-croqui-division="gleba-c"');
  expect(svg.match(/data-croqui-division=/g)).toHaveLength(3);
  expect(svg).toContain('data-croqui-polygon="true"');
  expect(layoutForCroqui(parent,opts,divisions).points).toHaveLength(parent.vertices.length);
 });
 it('não interpola estilos adulterados de glebas como atributos SVG',()=>{
  const divisions=readProjectDivisions(features);
  const parent=getPolygons(features)[0];
  const opts=defaultCroquiSettings();opts.background='none';
  const injected='0.4" onload="alert(1)';
  opts.featureStyles={'gleba-b':{fillOpacity:injected as unknown as number,strokeWidth:injected as unknown as number,fillColor:'#ffffff" onload="alert(1)'}};
  const svg=renderCroqui(parent,opts,{company:'SURVEYOR',mapLink:'',municipality:'',divisions,composite:true});
  expect(svg).not.toContain('onload=');
  expect(svg).not.toContain('alert(1)');
  expect(svg).toMatch(/data-croqui-division="gleba-b"[^>]+fill-opacity="0\.78"[^>]+stroke-width="2\.6"/);
 });
 it('inclui todas as partes MultiPolygon e preserva os buracos',()=>{
  const multi:ProjectFeature={id:'multi',geoJson:{type:'MultiPolygon',coordinates:[[p(0,0),p(.2,.2)],[p(3,0)]]}};
  const parts=readProjectDivisions([multi]);
  expect(parts).toHaveLength(2);expect(parts[0].rings).toHaveLength(2);
  expect(parts[1].rings[0]).toHaveLength(4);
  expect(divisionBounds(parts)).toEqual([[0,0],[0,1],[4,0],[4,1]]);
 });
 it('ignora pontos, linhas e geometrias inválidas',()=>{
  expect(readProjectDivisions([{id:'p',geometry:{type:'Point',coordinates:[1,2]}},{id:'l',geometry:{type:'LineString',coordinates:p(0,0)}},{id:'bad',geometry:{type:'Polygon',coordinates:[[[999,5]]]}}])).toHaveLength(0);
 });
 it('não altera o GeoJSON de origem',()=>{
  const original=JSON.stringify(features);
  readProjectDivisions(features);
  expect(JSON.stringify(features)).toBe(original);
 });
});
