import {describe,it,expect} from 'vitest';
import {locationForDrawnPolygon} from '../src/features/map/municipalityOfGeometry';
import {maskBrazilianDocumentInput,formatBrazilianRg} from '../src/lib/documentIdentity';
import type {Feature,Geometry,GeoJsonProperties} from 'geojson';
describe('Etapa 58: município vem do perímetro; máscaras preservam entrada',()=>{
 it('extrai coordenada interior do único imóvel mesmo com mapa inicial em outra cidade',()=>{
 const features:Feature<Geometry,GeoJsonProperties>[]=[{type:'Feature',geometry:{type:'Polygon',coordinates:[[[-39.466,-13.020],[-39.462,-13.020],[-39.462,-13.023],[-39.466,-13.023],[-39.466,-13.020]]]},properties:{}}];
 const point=locationForDrawnPolygon(features);expect(point).not.toBeNull();expect(point!.lat).toBeCloseTo(-13.0215,3);expect(point!.lon).toBeCloseTo(-39.464,3);
 });
 it('recusa inferir município quando há dois imóveis',()=>{const poly:Feature<Geometry,GeoJsonProperties>={type:'Feature',geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[0,1],[0,0]]]},properties:{}};expect(locationForDrawnPolygon([poly,poly])).toBeNull();});
 it('máscara CPF parcial, completa e RG de nove dígitos',()=>{expect(maskBrazilianDocumentInput('87988640500')).toBe('879.886.405-00');expect(maskBrazilianDocumentInput('87988')).toBe('879.88');expect(formatBrazilianRg('123456789')).toBe('12.345.678-9');});
});
