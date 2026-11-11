import { describe, expect, it } from 'vitest';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { restoreMapFeatures, serializeMapFeature, hasVerifiedFeatureIds, mapFingerprint } from '../src/features/map/mapCloudPersistence';
import { visibleOnMap, importedPointBatches } from '../src/features/map/importedPointPolygon';

const mk = (id: string, type: 'Point'|'Polygon', props: Record<string,unknown> = {}): Feature<Geometry,GeoJsonProperties> => ({
  type:'Feature', id, properties:props,
  geometry:type==='Point' ? {type,coordinates:[-39.6,-13.0]} : {type,coordinates:[[[-39.6,-13.0],[-39.5,-13.0],[-39.5,-13.1],[-39.6,-13.0]]]}
});
describe('Mapas: sincronização segura de IDs e vínculos', () => {
  it('preserva IDs dos alfinetes e do polígono quando a API muda o ID interno', () => {
    const p=mk('ponto-1','Point',{pointOrigin:'importado',pointBatchId:'lote-1',pointPolygonId:'pol-1'});
    const polygon=mk('pol-1','Polygon',{sourcePointIds:['ponto-1']});
    const remote=[p,polygon].map((f,i)=>({id:`db-${i+1}`,geoJson:f.geometry,properties:serializeMapFeature(f)}));
    expect(hasVerifiedFeatureIds(remote,[p,polygon])).toBe(true);
    const restored=restoreMapFeatures(remote);
    expect(restored.map(f=>f.id)).toEqual(['ponto-1','pol-1']);
    expect(visibleOnMap(restored[0],restored)).toBe(false);
    expect(importedPointBatches(restored)).toHaveLength(0);
  });
  it('recupera vínculo de versões antigas se a API troca o ID do polígono',()=>{
    const remote=[{id:'db-point',geometry:mk('x','Point').geometry,properties:{pointOrigin:'importado',pointPolygonId:'db-polygon'}},{id:'db-polygon',geometry:mk('x','Polygon').geometry,properties:{generatedFromPoints:true}}];
    const restored=restoreMapFeatures(remote);
    expect(visibleOnMap(restored[0],restored)).toBe(false);
  });
  it('identifica quando o backend descarta a propriedade de IDs',()=>{
    const p=mk('meu-ponto','Point',{pointOrigin:'importado'});
    expect(hasVerifiedFeatureIds([{id:'db-1',geometry:p.geometry,properties:{}}],[p])).toBe(false);
  });
  it('identifica alteração na geometria ou perda de associação durante a gravação',()=>{
    const p=mk('p1','Point',{pointPolygonId:'pol1'});
    const remote=[{id:'db-p',geometry:p.geometry,properties:{surveyorFeatureId:'p1'}}];
    expect(hasVerifiedFeatureIds(remote,[p])).toBe(false);
  });
  it('não modifica a assinatura de edição só por acrescentar ID persistente',()=>{
    const p=mk('p1','Point',{name:'Teste'}), old=mapFingerprint([p]);
    expect(mapFingerprint([{...p,properties:serializeMapFeature(p)}])).toBe(old);
  });
});
