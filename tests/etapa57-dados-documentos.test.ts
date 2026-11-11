import { describe, it, expect, vi } from 'vitest';
import { formatBrazilianDocument } from '../src/lib/documentIdentity';
import { locationForDrawnPolygon, municipalityAtLocation } from '../src/features/map/municipalityOfGeometry';
import { readProjectDocumentIdentity } from '../src/features/documents/cloudDraft';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
const polygon=(x:number):Feature<Geometry,GeoJsonProperties>=>({type:'Feature',geometry:{type:'Polygon',coordinates:[[[x,-13],[x+.01,-13],[x+.01,-12.99],[x,-12.99],[x,-13]]]},properties:{}});
describe('Etapa 57: identificação, município, documentos compartilhados',()=>{
 it('formata CPF e CNPJ sem inventar valor',()=>{
  expect(formatBrazilianDocument('87988640500')).toBe('879.886.405-00');
  expect(formatBrazilianDocument('12345678000199')).toBe('12.345.678/0001-99');
  expect(formatBrazilianDocument('')).toBe('');
 });
 it('usa a geometria do único imóvel e nunca o centro do mapa',()=>{
  const center=locationForDrawnPolygon([polygon(-39)]);
  expect(center).not.toBeNull();expect(center!.lon).toBeGreaterThan(-39);
  expect(locationForDrawnPolygon([])).toBeNull();
  expect(locationForDrawnPolygon([polygon(-39),polygon(-38.8)])).toBeNull();
 });
 it('rejeita reverse-geocode sem município ou UF válidos',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({address:{municipality:'Cidade',country_code:'xx','ISO3166-2-lvl4':'XX-AA'}})}) as typeof fetch;
  try{await expect(municipalityAtLocation({lat:-13,lon:-39})).rejects.toThrow('não confirmou');}
  finally{globalThis.fetch=original;}
 });
 it('mantém identidade comum específica por projeto',()=>{
  const options={documentIdentityByProject:{p1:{reference:'123',ownerDocument:'00011122233'},p2:{reference:'234'}}};
  expect(readProjectDocumentIdentity(options,'p1').reference).toBe('123');
  expect(readProjectDocumentIdentity(options,'p2').reference).toBe('234');
  expect(readProjectDocumentIdentity(options,'desconhecido')).toEqual({});
 });
});
