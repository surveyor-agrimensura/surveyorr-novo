import { describe, it, expect } from 'vitest';
import {percentToZoom,zoomToPercent} from '../src/lib/percentZoom';

describe('Zoom cartográfico contínuo na interface',()=>{
 it('permite TODOS os percentuais de 1 a 100 sem saltos',()=>{
  const percentages=Array.from({length:100},(_,i)=>i+1);
  expect(percentages.map(p=>zoomToPercent(percentToZoom(p)))).toEqual(percentages);
 });
 it('preserva compatibilidade com valores antigos',()=>{
  expect(zoomToPercent(15)).toBe(50);
  expect(percentToZoom(50)).toBe(15);
 });
 it('limita dados extremos sem aceitar zoom fora da barra',()=>{
  expect(zoomToPercent(percentToZoom(-100))).toBe(1);
  expect(zoomToPercent(percentToZoom(400))).toBe(100);
 });
});
