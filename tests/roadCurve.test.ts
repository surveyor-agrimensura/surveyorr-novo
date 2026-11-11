import {describe,it,expect} from 'vitest';
import {smoothRoadCenterline,roadBoundaries} from '../src/features/croqui/croquiGeometry';

describe('Servidão curvilínea por pontos',()=>{
 const controls=[{x:0,y:0},{x:45,y:0},{x:90,y:-30},{x:108,y:-90},{x:115,y:-105}];
 it('mantém os pontos de início e fim após suavização',()=>{
  const curve=smoothRoadCenterline(controls);
  expect(curve.length).toBeGreaterThan(controls.length);
  expect(curve[0]).toEqual(controls[0]);
  expect(curve[curve.length-1].x).toBeCloseTo(controls[controls.length-1].x);
  expect(curve[curve.length-1].y).toBeCloseTo(controls[controls.length-1].y);
 });
 it('permite duas bordas paralelas com distâncias reguláveis',()=>{
  const curve=smoothRoadCenterline(controls);
  const narrow=roadBoundaries(curve,12),wide=roadBoundaries(curve,28);
  expect(narrow.left).toHaveLength(curve.length);
  expect(narrow.right).toHaveLength(curve.length);
  expect(wide.left).toHaveLength(curve.length);
  const width=(edges:ReturnType<typeof roadBoundaries>,i:number)=>Math.hypot(edges.left[i].x-edges.right[i].x,edges.left[i].y-edges.right[i].y);
  const mid=Math.floor(curve.length/2);
  expect(width(wide,mid)).toBeGreaterThan(width(narrow,mid));
 });
 it('não cria segmentos degenerados após cliques repetidos no mesmo ponto',()=>{
  const curve=smoothRoadCenterline([controls[0],controls[0],controls[1],controls[1],controls[2]]);
  expect(curve.length).toBeGreaterThan(3);
  expect(curve.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
 });
});
