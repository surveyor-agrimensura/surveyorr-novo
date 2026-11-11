import {describe,it,expect} from 'vitest';
import {segmentConfrontations,groupConfrontations} from './croquiGeometry';

describe('confrontantes independentes por trecho',()=>{
 it('não funde V-02→V-03 com V-03→V-04 quando os nomes são iguais',()=>{
  const entries=segmentConfrontations(['A','MARIA DO CARMO · 983.953.355-04','MARIA DO CARMO · 983.953.355-04','B']);
  expect(entries.map(item=>item.start)).toEqual([0,1,2,3]);
  expect(entries[1].label).toBe(entries[2].label);
  expect(entries[1].indices).toEqual([1]);
  expect(entries[2].indices).toEqual([2]);
  // Agrupamento antigo continua disponível para outras rotinas, mas não para a planta.
  expect(groupConfrontations(['A','MARIA','MARIA','B']).length).toBe(3);
 });
 it('não desenha rótulo para segmento vazio',()=>{
  expect(segmentConfrontations(['MARIA','',null,'JOÃO']).map(item=>item.start)).toEqual([0,3]);
 });
});
