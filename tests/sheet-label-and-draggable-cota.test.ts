import {describe,it,expect} from 'vitest';
import {areaLabelAnchor} from '../src/features/documents/areaLabelAnchor';
import {cotaDistance,drawCustomCotas,normalizedCustomCotas} from '../src/lib/customCotas';

describe('Pranchas: rótulo do imóvel e cotas diretas editáveis',()=>{
 it('localiza o nome dentro de um polígono estreito e alongado',()=>{
  const p=areaLabelAnchor([{x:100,y:700},{x:180,y:700},{x:750,y:100},{x:710,y:100}]);
  expect(p.x).toBeGreaterThan(100);expect(p.x).toBeLessThan(750);
  expect(p.y).toBeGreaterThan(100);expect(p.y).toBeLessThan(700);
 });
 it('mantém o valor da distância ao deslocar visualmente a cota',()=>{
  const vertices:[[number,number],[number,number],[number,number]]=[[0,0],[0.001,0],[0.001,0.001]];
  const m=cotaDistance(vertices,0,2);
  expect(m).toBeGreaterThan(0);
  const original=drawCustomCotas([{id:'c1',target:'g1',from:0,to:2}], 'g1',vertices,p=>({x:p[0]*100000,y:p[1]*100000}),'#0f766e',true);
  const shifted=drawCustomCotas([{id:'c1',target:'g1',from:0,to:2,offsetX:32,offsetY:-16}], 'g1',vertices,p=>({x:p[0]*100000,y:p[1]*100000}),'#0f766e',true);
  expect(original).toContain('data-custom-cota-drag="c1"');
  expect(shifted).toContain('data-custom-cota-drag="c1"');
  expect(shifted).not.toEqual(original);
  expect(shifted).toContain(`${m!.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} m`);
  expect(vertices).toEqual([[0,0],[0.001,0],[0.001,0.001]]);
 });
 it('normaliza deslocamentos fora da área de segurança',()=>{
  const [c]=normalizedCustomCotas([{id:'a',target:'g1',from:0,to:2,offsetX:99999,offsetY:-99999}]);
  expect(c.offsetX).toBe(800);expect(c.offsetY).toBe(-800);
 });
});
