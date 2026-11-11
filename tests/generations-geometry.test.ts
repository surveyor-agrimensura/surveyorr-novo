import {describe,expect,it} from 'vitest';
import {bowditch,subdividePolygon,polygonArea,parseAngle,rumboToAz,xmlEscape} from '../src/features/generations/geometry';
import {idw,triangulate,makeContours,stitchContours} from '../src/features/generations/mdtEngine';
import {docxBytes,makeZip} from '../src/features/generations/exportOffice';

describe('Etapa 39 • módulos de geração',()=>{
 it('compensa poligonal fechada proporcionalmente ao comprimento de cada lado',()=>{
  const result=bowditch({x:1000,y:1000},[{angle:90,length:10},{angle:180,length:10},{angle:270,length:10},{angle:0,length:11}],true);
  expect(result.error).toBeGreaterThan(0);
  expect(result.adjusted.at(-1)?.x).toBeCloseTo(1000,6);
  expect(result.adjusted.at(-1)?.y).toBeCloseTo(1000,6);
 });
 it('interpreta azimute GMS e rumo com quadrante',()=>{
  expect(parseAngle(`90°30'00"`)).toBeCloseTo(90.5);
  expect(rumboToAz(45,'NW')).toBe(315);
  expect(()=>parseAngle(`361°`)).toThrow();
 });
 it('escapa nomes inseridos no SVG de prévia da divisão de glebas',()=>{
  expect(xmlEscape('</text><script>alert(1)</script>')).toBe('&lt;/text&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
 });
 it('subdivide polígono sem perda de área',()=>{
  const square=[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}];
  const polygons=subdividePolygon(square,10,'x');
  expect(polygons).toHaveLength(2);
  expect(polygons.reduce((sum,p)=>sum+polygonArea(p),0)).toBeCloseTo(400,8);
 });
 it('triangula pontos XYZ, calcula cotas e extrai curvas',()=>{
  const points=[{x:0,y:0,z:0},{x:2,y:0,z:10},{x:0,y:2,z:20},{x:2,y:2,z:30}];
  const triangles=triangulate(points);
  expect(triangles).toHaveLength(2);
  expect(idw(points,0,0)).toBe(0);
  expect(makeContours(points,triangles,5).length).toBeGreaterThan(0);
 });
 it('liga segmentos adjacentes da mesma cota e mantém níveis diferentes separados',()=>{
  const lines=stitchContours([
   {level:100,a:{x:0,y:0},b:{x:1,y:0}},
   {level:100,a:{x:2,y:0},b:{x:1,y:0}},
   {level:100,a:{x:2,y:1},b:{x:2,y:0}},
   {level:105,a:{x:0,y:0},b:{x:0,y:1}}
  ]);
  expect(lines).toHaveLength(2);
  expect(lines.find(line=>line.level===100)?.points).toHaveLength(4);
  expect(lines.find(line=>line.level===105)?.points).toHaveLength(2);
 });
 it('preserva o fechamento de uma curva fechada',()=>{
  const [line]=stitchContours([
   {level:120,a:{x:0,y:0},b:{x:1,y:0}},
   {level:120,a:{x:1,y:0},b:{x:1,y:1}},
   {level:120,a:{x:1,y:1},b:{x:0,y:1}},
   {level:120,a:{x:0,y:1},b:{x:0,y:0}}
  ]);
  expect(line.points[0].x).toBe(line.points.at(-1)?.x);
  expect(line.points[0].y).toBe(line.points.at(-1)?.y);
 });
 it('gera arquivos com assinatura ZIP local e cabeçalho DOCX',()=>{
  const archive=makeZip([{name:'README.txt',content:'SURVEYOR'}]);
  expect([...archive.slice(0,4)]).toEqual([0x50,0x4b,0x03,0x04]);
  const docx=docxBytes(['Memorial descritivo']);
  expect([...docx.slice(0,4)]).toEqual([0x50,0x4b,0x03,0x04]);
 });
});
