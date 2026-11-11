import {describe,it,expect} from 'vitest';
import {tarefaCaption,tarefaValueForState} from '../src/lib/agrarianMeasure';
import {cotaDistance,drawCustomCotas,normalizedCustomCotas} from '../src/lib/customCotas';
import type {Vertex} from '../src/features/memorial/memorialEngine';
const points:Vertex[]=[[-39,-13],[-38.999,-13],[-38.999,-12.999],[-39,-12.999]];
describe('medidas regionais e cota direta',()=>{
 it('usa fator baiano e não supõe tarefa para UF sem preset',()=>{
  expect(tarefaValueForState('BA')).toBe(4356);
  expect(tarefaCaption(8712,'BA')).toBe('2,00 tarefas');
  expect(tarefaCaption(10000,'SC')).toBe('');
  expect(tarefaCaption(10000,'SC',4000)).toBe('2,50 tarefas');
 });
 it('cota entre primeiro e terceiro vértice é direta, não soma dos dois trechos',()=>{
  const direct=cotaDistance(points,0,2)!;
  expect(direct).toBeLessThan(cotaDistance(points,0,1)!+cotaDistance(points,1,2)!);
  const rendered=drawCustomCotas([{id:'c1',target:'gleba-1',from:0,to:2}],'gleba-1',points,p=>({x:p[0]*1000,y:p[1]*1000}));
  expect(rendered).toContain('data-custom-cota="c1"');
  expect(rendered).toContain('V-01');
 });
 it('ignora cotas com índices inválidos',()=>{
  expect(normalizedCustomCotas([{id:'a',target:'x',from:0,to:0}])).toEqual([]);
  expect(cotaDistance(points,0,12)).toBeNull();
 });
});
