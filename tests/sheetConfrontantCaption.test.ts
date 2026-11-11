import {describe,expect,it} from 'vitest';
import {confrontantCaption} from '../src/features/croqui/confrontantCaption';
import {placeTechnicalLabels} from '../src/features/croqui/labelLayout';

describe('Etapa 70: rótulos consistentes em croqui e prancha',()=>{
 it('não mistura CPF com nome e não encurta o documento',()=>{
  const result=confrontantCaption('MARIA DO CARMO DOS SANTOS · 983.953.355-04');
  expect(result.name).toBe('MARIA DO CARMO DOS SANTOS');
  expect(result.cpf).toBe('983.953.355-04');
  expect(result.text).toBe('MARIA DO CARMO DOS SANTOS\nCPF/CNPJ: 983.953.355-04');
 });
 it('formata documentos numéricos sem encurtar o conteúdo',()=>{
  expect(confrontantCaption('VALDEMIR MOTA DOS SANTOS',{cpf:'66956048515'}).text).toBe('VALDEMIR MOTA DOS SANTOS\nCPF/CNPJ: 669.560.485-15');
 });
 it('um mesmo confrontante em duas arestas continua sendo dois rótulos',()=>{
  const same='MARIA DO CARMO DOS SANTOS';
  const labels=[1,2].map(i=>({key:`neighbor:${i}`,text:confrontantCaption(same,{cpf:'983.953.355-04'}).text,anchor:{x:80*i,y:90},preferred:{x:80*i,y:65},normal:{x:0,y:-1},tangent:{x:1,y:0},size:8,angle:0,priority:180,manual:true}));
  const result=placeTechnicalLabels(labels,{left:0,top:0,right:400,bottom:200},true);
  expect(result.visible.map(item=>item.key)).toEqual(['neighbor:1','neighbor:2']);
  expect(result.visible.every(item=>item.text.includes('CPF/CNPJ: 983.953.355-04'))).toBe(true);
 });
});
