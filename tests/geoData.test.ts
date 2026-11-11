import { describe, expect, it } from 'vitest';
import { STATES, featureCode, normalize } from '../src/features/map/geoData';

describe('Navegação territorial', () => {
 it('inclui as 27 unidades da federação e código IBGE de Bahia', () => {
  expect(STATES).toHaveLength(27);
  expect(STATES.find(s=>s.uf==='BA')).toEqual({id:'29',uf:'BA',name:'Bahia'});
 });
 it('encontra nomes sem diferença de acentuação', () => {
  expect(normalize('São Paulo')).toBe(normalize('Sao Paulo'));
 });
 it('lê geocódigos tanto do IBGE como da fonte alternativa', () => {
  expect(featureCode({codarea:'2915601'})).toBe('2915601');
  expect(featureCode({cd_geocmu:'2915601'})).toBe('2915601');
 });
});
