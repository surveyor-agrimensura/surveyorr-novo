import { describe,expect,it } from 'vitest';
import {azimuthToRumo,degreesMinutesSeconds,segmentReadings,segmentReadingsCsv} from './segmentTable';
import type {SurveyPolygon,Vertex} from '../memorial/memorialEngine';
const verts:Vertex[]=[[-39,-13],[-39,-12.99],[-38.99,-12.99],[-38.99,-13]];
const poly:SurveyPolygon={id:'p-1',name:'Teste',vertices:verts,properties:{},areaM2:0,perimeterM:0};
describe('quadro dinâmico do caminhamento',()=>{
 it('retorna um trecho para cada lado, incluindo o fechamento sem alterar coordenadas',()=>{
  const before=JSON.stringify(poly);const rows=segmentReadings(poly,['A','B','C','D'],['João','Maria','','Estrada']);
  expect(rows).toHaveLength(4);expect(rows[0].from).toBe('A');expect(rows[0].to).toBe('B');
  expect(rows[3].from).toBe('D');expect(rows[3].to).toBe('A');expect(rows[3].neighbor).toBe('Estrada');
  expect(rows.every(row=>row.distanceM>0)).toBe(true);expect(JSON.stringify(poly)).toBe(before);
 });
 it('usa rumo quadrantal correto nos quatro quadrantes',()=>{
  expect(azimuthToRumo(45)).toContain('N 45°');expect(azimuthToRumo(135)).toContain('S 45°');
  expect(azimuthToRumo(225)).toContain('S 45°');expect(azimuthToRumo(315)).toContain('N 45°');
  expect(azimuthToRumo(90)).toBe('L');expect(azimuthToRumo(270)).toBe('O');
 });
 it('não cria segundos com valor 60 quando arredonda',()=>{
  expect(degreesMinutesSeconds(1+59.99999/3600)).toBe('1°01\'00,0″');
 });
 it('reporta trecho coincidente sem azimute fictício',()=>{
  const coincident={...poly,vertices:[verts[0],verts[0],verts[2]]};const rows=segmentReadings(coincident,[],[]);
  expect(rows[0].distanceM).toBe(0);expect(rows[0].azimuthLabel).toBe('—');expect(rows[0].bearingLabel).toBe('—');
 });
 it('CSV escapa nomes, mantém separador compatível com pt-BR e inclui BOM',()=>{
  const csv=segmentReadingsCsv(segmentReadings(poly,['V;A','B','C','D'],['João "Silva"','','','=1+1']));
  expect(csv.charCodeAt(0)).toBe(0xfeff);expect(csv).toContain('"João ""Silva"""');expect(csv).toContain('"V;A"');expect(csv).toContain('"\'=1+1"');
 });
});
