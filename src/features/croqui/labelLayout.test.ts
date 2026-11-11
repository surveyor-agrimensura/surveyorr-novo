import { describe, it, expect } from 'vitest';
import { placeCompactCroquiLabels, placeTechnicalLabels, type TechnicalLabel } from './labelLayout';
import { defaultCroquiSettings, renderCroqui } from '../memorial/croquiRenderer';
import type { SurveyPolygon } from '../memorial/memorialEngine';

describe('organização de rótulos de planta',()=>{
 const labels:TechnicalLabel[]=Array.from({length:35},(_,i)=>({
  key:`cota:${i}`,text:`${(i+10).toFixed(1)} m`,anchor:{x:95+i*1.7,y:130},preferred:{x:95+i*1.7,y:130},
  normal:{x:0,y:1},tangent:{x:1,y:0},size:7,angle:0,priority:i
 }));
 it('distribui ou oculta rótulos excessivamente densos sem perdê-los',()=>{
  const result=placeTechnicalLabels(labels,{left:30,top:20,right:460,bottom:220});
  expect(result.visible.length+result.hidden.length).toBe(labels.length);
  expect(result.hidden.length).toBeGreaterThan(0);
  expect(new Set(result.visible.map(v=>v.key)).size).toBe(result.visible.length);
 });
 it('preserva posição manual mesmo quando há pouco espaço',()=>{
  const result=placeTechnicalLabels([{...labels[0],key:'vertex:0',manual:true,preferred:{x:40,y:40}}],{left:50,top:50,right:350,bottom:150});
  expect(result.visible[0].position).toEqual({x:40,y:40});
 });
 it('não desloca textos nem remove cotas para criar linhas-guia',()=>{
  const result=placeCompactCroquiLabels(labels);
  expect(result.hidden).toEqual([]);
  expect(result.visible).toHaveLength(labels.length);
  expect(result.visible.every(label=>!label.displaced && label.position.x===label.preferred.x && label.position.y===label.preferred.y)).toBe(true);
  expect(result.visible.some(label=>label.size<7)).toBe(true);
 });
 it('mantém edições manuais do rótulo, mesmo quando se sobrepõe a outro',()=>{
  const moved={...labels[0],manual:true,preferred:{x:170,y:150},size:9};
  const other={...labels[1],preferred:{x:170,y:150}};
  const result=placeCompactCroquiLabels([moved,other]);
  expect(result.visible[0].position).toEqual({x:170,y:150});
  expect(result.visible[0].size).toBe(9);
  expect(result.visible[1].size).toBeLessThan(7);
 });
 it('croqui não usa linhas de ligação nem desloca cotas',()=>{
  const poly:SurveyPolygon={id:'1',name:'Teste',vertices:[[-40.365,-12.53],[-40.364,-12.53],[-40.364,-12.5295],[-40.365,-12.5295]],properties:{},areaM2:5000,perimeterM:500};
  const svg=renderCroqui(poly,defaultCroquiSettings(),{company:'Surveyor',municipality:'BA',mapLink:''});
  expect(svg).not.toContain('stroke-dasharray="2 2"');
  expect((svg.match(/data-croqui-label="cota:/g)||[]).length).toBe(4);
  expect((svg.match(/data-croqui-label="vertex:/g)||[]).length).toBe(4);
 });
 it('mantém linhas de cotas para todos os vértices, independentemente de densidade',()=>{
  const vertices:Array<[number,number]>=[[-40.365,-12.53],[-40.364,-12.53],[-40.364,-12.5295],[-40.365,-12.5295]];
  const poly:SurveyPolygon={id:'1',name:'Terreno de teste',vertices,properties:{},areaM2:5000,perimeterM:500};
  const svg=renderCroqui(poly,defaultCroquiSettings(),{company:'Surveyor',municipality:'BA',mapLink:''});
  expect(svg).toContain('data-hidden-cotas="0"');
  expect((svg.match(/Trecho V-\d+ a V-\d+/g)||[]).length).toBe(4);
 });
});
