import {describe,it,expect} from 'vitest';
import {sheetDivisionColor} from '../src/features/documents/technicalSheet';

describe('Cor da gleba consistente em todas as saídas',()=>{
 const gleba={featureId:'f1',partIndex:0,color:undefined};
 it('mantém o mesmo padrão de cor para a gleba sem cor salva',()=>{
  expect(sheetDivisionColor(gleba,0,{})).toBe('#2075db');
  expect(sheetDivisionColor(gleba,2,{})).toBe('#a855f7');
 });
 it('respeita cor original informada no mapa',()=>{
  expect(sheetDivisionColor({...gleba,color:'#ff00ff'},0,{})).toBe('#ff00ff');
 });
 it('prioriza edição local e ignora cores inválidas',()=>{
  expect(sheetDivisionColor({...gleba,color:'#ff00ff'},0,{'f1:0':'#eeaa44'})).toBe('#eeaa44');
  expect(sheetDivisionColor(gleba,1,{'f1:0':'invalid'})).toBe('#15a876');
 });
});
