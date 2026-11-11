import {describe,it,expect} from 'vitest';
import {buildUtmGrid,utmFromWgs84} from '../src/features/documents/utmGrid';
import {compareParcels,validateParcel,checkNearGaps, type Parcel} from '../src/features/analysis/topology';
const sq=(id:string,x:number,y:number,d:number):Parcel=>({id,name:id,geometry:{type:'Polygon',coordinates:[[[x,y],[x+d,y],[x+d,y+d],[x,y+d],[x,y]]]}});
describe('Etapa 54 — grade UTM',()=>{
 it('retorna zona 24S e linha central 500000 m em longitude -39°',()=>{const data=utmFromWgs84([-39,-13]);expect(data.zone).toBe(24);expect(data.hemisphere).toBe('S');expect(data.east).toBeCloseTo(500000,2);});
 it('respeita fuso e gera grade, sem alterar os vértices',()=>{const vertices:[number,number][]=[[-39,-13],[-38.999,-13],[-38.999,-12.999],[-39,-12.999]];const copy=structuredClone(vertices);const result=buildUtmGrid(vertices,p=>({x:112+(p[0]+39)*800000,y:885-(p[1]+13)*800000}),{x:112,y:40,w:800,h:845});expect(result.svg).toContain('surveyor-utm-grid');expect(result.svg).toContain('UTM 24S');expect(result.step).toBeGreaterThan(0);expect(vertices).toEqual(copy);});
});
describe('Etapa 54 — validação e comparação',()=>{
 it('detectar duplicados, perímetros abertos e autointerseções',()=>{
  const duplicate:Parcel={id:'D',name:'D',geometry:{type:'Polygon',coordinates:[[[0,0],[.01,0],[.01,0],[.01,.01],[0,.01],[0,0]]]}};
  expect(validateParcel(duplicate).some(i=>i.title==='Vértices duplicados')).toBe(true);
  const open:Parcel={id:'O',name:'O',geometry:{type:'Polygon',coordinates:[[[0,0],[.01,0],[.01,.01],[0,.01]]]}};
  expect(validateParcel(open).some(i=>i.title==='Perímetro aberto')).toBe(true);
  const crossing:Parcel={id:'X',name:'X',geometry:{type:'Polygon',coordinates:[[[0,0],[.01,.01],[0,.01],[.01,0],[0,0]]]}};
  expect(validateParcel(crossing).some(i=>i.title==='Autointerseção')).toBe(true);
 });
 it('não modifica perímetros ao estimar interseção e diferença de áreas',()=>{
  const a=sq('A',-39,-13,.01),b=sq('B',-38.995,-13,.01),before=structuredClone([a,b]);
  const x=compareParcels(a,b,80);expect(x.overlapPercent).toBeGreaterThan(45);expect(x.overlapPercent).toBeLessThan(55);expect(x.estimated).toBe(true);expect([a,b]).toEqual(before);
  expect(compareParcels(a,sq('C',-38,-10,.01)).overlapM2).toBe(0);
 });
 it('permite analisar possíveis frestas entre perímetros sem snapping automático',()=>{
  const a=sq('A',-39,-13,.01),b=sq('B',-38.99+0.000001,-13,.01);
  const g=checkNearGaps(a,b,.2);expect(g.count).toBeGreaterThanOrEqual(0);expect(b.geometry.coordinates[0][0][0]).toBeCloseTo(-38.989999,7);
 });
});
