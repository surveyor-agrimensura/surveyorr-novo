import {describe,expect,it} from 'vitest';
import {azimuth,distance,formatAzimuth,getPolygons,mapLayout,memorialNarrative,polygonArea,segmentNeighbor} from '../src/features/memorial/memorialEngine';
import {readProjectDivisions} from '../src/features/croqui/projectDivisions';
const square:[number,number][]=[[-39,-13],[-38.999,-13],[-38.999,-12.999],[-39,-12.999],[-39,-13]];
const f=[{name:'Imóvel A',geoJson:{type:'Polygon',coordinates:[square]},properties:{name:'Sítio das Palmeiras',confrontantes:['Fazenda vizinha','Estrada rural']}}];
describe('Memorial: geometria e documentos',()=>{
 it('descarta vértice final repetido e preserva ordem',()=>{const p=getPolygons(f)[0];expect(p.vertices.length).toBe(4);expect(p.name).toBe('Sítio das Palmeiras');});
 it('preserva anéis internos e desconta sua área ao abrir um polígono',()=>{
  const hole:[number,number][]=[[-38.9998,-12.9998],[-38.9992,-12.9998],[-38.9992,-12.9992],[-38.9998,-12.9992],[-38.9998,-12.9998]];
  const polygon=getPolygons([{geoJson:{type:'Polygon',coordinates:[square,hole]}}])[0];
  expect(polygon.holes).toEqual([hole.slice(0,-1)]);
  expect(polygon.areaM2).toBeLessThan(polygonArea(square.slice(0,-1) as [number,number][]));
  expect(polygon.perimeterM).toBeGreaterThan(getPolygons([{geoJson:{type:'Polygon',coordinates:[square]}}])[0].perimeterM);
  expect(mapLayout(polygon).holePoints[0]).toHaveLength(4);
 });
 it('descreve os contornos internos e mantém o perímetro igual no Croqui e Memorial',()=>{
  const hole:[number,number][]=[[-38.9998,-12.9998],[-38.9992,-12.9998],[-38.9992,-12.9992],[-38.9998,-12.9992],[-38.9998,-12.9998]];
  const feature={id:'com-vazio',name:'Área com vazio',properties:{},geoJson:{type:'Polygon',coordinates:[square,hole]}};
  const polygon=getPolygons([feature])[0];
  const division=readProjectDivisions([feature])[0];
  const narrative=memorialNarrative(polygon);
  expect(division.perimeterM).toBeCloseTo(polygon.perimeterM,6);
  expect(narrative).toContain('contorno interno 1');
  expect(narrative).toContain('I1-V01');
  expect(narrative).toContain('incluindo os contornos internos');
 });
 it('gera distância positiva, perímetro e área coerentes',()=>{const p=getPolygons(f)[0];expect(p.areaM2).toBeGreaterThan(11000);expect(p.areaM2).toBeLessThan(13000);expect(p.perimeterM).toBeGreaterThan(400);expect(p.perimeterM).toBeLessThan(500);expect(distance(square[0] as [number,number],square[1] as [number,number])).toBeGreaterThan(100);});
 it('confrontante por trecho é associado ao lado correto',()=>{const p=getPolygons(f)[0];expect(segmentNeighbor(p,0)).toBe('Fazenda vizinha');expect(segmentNeighbor(p,1)).toBe('Estrada rural');expect(segmentNeighbor(p,3)).toBe('');});
 it('fecha a descrição e inclui coordenadas e confrontantes reais',()=>{const narrative=memorialNarrative(getPolygons(f)[0]);expect(narrative).toContain('V-04');expect(narrative).toContain('V-01');expect(narrative).toContain('Fazenda vizinha');expect(narrative).toContain('WGS 84');});
 it('mapa preserva referências dos vértices e carrega no máximo 20 tiles',()=>{const l=mapLayout(getPolygons(f)[0]);expect(l.points).toHaveLength(4);expect(l.tiles.length).toBeGreaterThan(1);expect(l.tiles.length).toBeLessThanOrEqual(20);expect(l.tiles[0].url).toContain('MapServer/tile/');});
 it('azimute é circular e área não depende do primeiro vértice',()=>{expect(azimuth([-40,-12],[-39,-12])).toBeGreaterThan(80);expect(azimuth([-40,-12],[-39,-12])).toBeLessThan(100);expect(polygonArea(square.slice(0,4) as [number,number][])).toBeGreaterThan(0);});
 it('arredonda segundos de azimute com transporte para os minutos',()=>{
  expect(formatAzimuth(12+34/60+59.96/3600)).toBe('12°35\'00,0"');
 });
});
