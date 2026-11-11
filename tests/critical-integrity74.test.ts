import {describe,it,expect} from 'vitest';
import type {Feature, Geometry,GeoJsonProperties} from 'geojson';
import {readDocumentDraft} from '../src/features/documents/cloudDraft';
import {hasVerifiedMapEdits,serializeMapFeature} from '../src/features/map/mapCloudPersistence';

const sample=(id:string,color:string):Feature<Geometry,GeoJsonProperties>=>({
 type:'Feature', id, geometry:{type:'Polygon',coordinates:[[[0,0],[.01,0],[.01,.01],[0,0]]]},
 properties:{name:`GLEBA ${id}`,fillColor:color,strokeColor:'#222222',confrontants:{'0-1':'Valdemir','1-2':'Maria'}}
});
describe('Regressão crítica: documento por gleba e integridade do mapa',()=>{
 it('não aplica o rascunho do memorial de uma gleba a outra',()=>{
  const opts={generatedDocumentDraftsByFeature:{memorial:{p1:{g1:{fields:{reference:'A'}},g2:{fields:{reference:'B'}}}}}};
  expect(readDocumentDraft(opts,'memorial','p1','g1',false).fields).toEqual({reference:'A'});
  expect(readDocumentDraft(opts,'memorial','p1','g2',false).fields).toEqual({reference:'B'});
  expect(readDocumentDraft(opts,'memorial','p1','g3',false)).toEqual({});
 });
 it('não atribui um rascunho antigo genérico a várias glebas',()=>{
  const opts={generatedDocumentDrafts:{memorial:{p1:{fields:{reference:'LEGADO'}}}}};
  expect(readDocumentDraft(opts,'memorial','p1','g1',false)).toEqual({});
  expect(readDocumentDraft(opts,'memorial','p1','g1',true).fields).toEqual({reference:'LEGADO'});
 });
 it('confirma duas áreas somente quando ambas mantêm geometria, cor e confrontantes',()=>{
  const local=[sample('g1','#f00'),sample('g2','#0f0')];
  const remote=local.map((f,i)=>({id:`db-${i}`,geoJson:f.geometry,properties:serializeMapFeature(f)}));
  expect(hasVerifiedMapEdits(remote,local)).toBe(true);
  expect(hasVerifiedMapEdits([{...remote[0],properties:{...remote[0].properties,fillColor:'#000'}},remote[1]],local)).toBe(false);
  expect(hasVerifiedMapEdits([remote[0],{...remote[1],properties:{...remote[1].properties,confrontants:{'0-1':'Valdemir'}}}],local)).toBe(false);
  expect(hasVerifiedMapEdits(remote.slice(0,1),local)).toBe(false);
 });
});
