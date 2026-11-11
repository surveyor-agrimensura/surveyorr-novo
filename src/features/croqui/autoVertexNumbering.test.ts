import { describe, expect, it } from 'vitest';
import { autoNumberVertices, polygonOrientation, type NumberingOptions } from './autoVertexNumbering';
import type { Vertex } from '../memorial/memorialEngine';

const ccw: Vertex[] = [[-39, -13], [-38.9, -13], [-38.9, -12.9], [-39, -12.9]];
const clockwise: Vertex[] = [...ccw].reverse();
const defaults: NumberingOptions = {code:'',kind:'V',firstNumber:1,digits:2,startingVertex:0,direction:'sequence'};
describe('numeração segura de vértices',()=>{
 it('preserva as coordenadas de origem e enumera todos os vértices',()=>{
  const source=JSON.stringify(ccw);const result=autoNumberVertices(ccw,defaults);
  expect(result.names).toEqual(['V-01','V-02','V-03','V-04']);
  expect(JSON.stringify(ccw)).toBe(source);
 });
 it('gera códigos de identificação e começa no vértice selecionado',()=>{
  expect(autoNumberVertices(ccw,{...defaults,code:'o3m',kind:'M',digits:4,firstNumber:12,startingVertex:2}).names)
   .toEqual(['O3M-M-0014','O3M-M-0015','O3M-M-0012','O3M-M-0013']);
 });
 it('segue sentido horário sem alterar a ordem das coordenadas armazenadas',()=>{
  expect(polygonOrientation(ccw)).toBe('counterclockwise');
  expect(polygonOrientation(clockwise)).toBe('clockwise');
  const result=autoNumberVertices(ccw,{...defaults,direction:'clockwise'});
  expect(result.orderedIndices).toEqual([0,3,2,1]);
  expect(result.names).toEqual(['V-01','V-04','V-03','V-02']);
  expect(autoNumberVertices(clockwise,{...defaults,direction:'clockwise'}).orderedIndices).toEqual([0,1,2,3]);
 });
 it('suporta percorrer no sentido anti-horário',()=>{
  expect(autoNumberVertices(clockwise,{...defaults,direction:'counterclockwise',startingVertex:1}).orderedIndices).toEqual([1,0,3,2]);
 });
 it('rejeita código, vértice inicial e números inválidos',()=>{
  expect(()=>autoNumberVertices(ccw,{...defaults,code:'in válido'})).toThrow(/código/);
  expect(()=>autoNumberVertices(ccw,{...defaults,startingVertex:4})).toThrow(/vértice inicial/);
  expect(()=>autoNumberVertices(ccw,{...defaults,firstNumber:0})).toThrow(/numeração inicial/);
  expect(()=>autoNumberVertices(ccw,{...defaults,digits:1})).toThrow(/dígitos/);
 });
 it('não aplica orientação arbitrária a área degenerada',()=>{
  const straight:Vertex[]=[[0,0],[1,0],[2,0]];
  expect(polygonOrientation(straight)).toBeNull();
  expect(()=>autoNumberVertices(straight,{...defaults,direction:'clockwise'})).toThrow(/sentido/);
 });
});
