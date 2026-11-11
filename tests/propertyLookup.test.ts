import {afterEach,describe,expect,it,vi} from 'vitest';
import {findPropertyByCar,normalizeCar} from '../src/features/map/propertyLookup';
vi.mock('../src/features/map/searchServices',()=>({municipalFeature:vi.fn(),intersectsMunicipality:vi.fn()}));
vi.mock('../src/features/map/geoServices',()=>({GEOSERVICES_BASE:'https://geo.example.test'}));
const valid='BA-2901007-0123456789ABCDEF0123456789ABCDEF';
const polygon={type:'Polygon' as const,coordinates:[[[-39.61,-13.05],[-39.59,-13.05],[-39.59,-13.03],[-39.61,-13.05]]]};
const official=(code:string)=>({type:'Feature',geometry:polygon,properties:{cod_imovel:code,nomearea:'Sítio pesquisado'}});
function response(body:unknown){return {ok:true,status:200,text:async()=>JSON.stringify(body)};}
describe('Busca exata de CAR com geometria oficial',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('normaliza códigos com ou sem separadores e rejeita registros incompletos',()=>{
  expect(normalizeCar(valid)).toBe(valid);
  expect(normalizeCar(valid.replace(/[^A-Z0-9]/g,''))).toBe(valid);
  expect(normalizeCar('BA-2901007-1234')).toBe('');
 });
 it('não aceita a primeira feição que não corresponde ao CAR consultado',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({features:[official('BA-2901007-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),official(valid)]})));
  const result=await findPropertyByCar(valid);
  expect(result.car).toBe(valid);
  expect(result.feature.geometry.type).toBe('Polygon');
 });
 it('não localiza imóvel incorreto quando a fonte retorna código diferente',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({features:[official('BA-2901007-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')]})));
  await expect(findPropertyByCar(valid)).rejects.toThrow(/não foi localizado|Nenhuma geometria/);
 });
});
