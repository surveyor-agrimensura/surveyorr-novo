import { describe,expect,it } from 'vitest';
import { groupConfrontations, resolveSegmentConfrontants, setSegmentConfrontant, readConfrontation } from '../src/features/croqui/croquiGeometry';
import { withSavedCroquiSettings, readSharedConfrontants } from '../src/features/croqui/sharedCroquiSettings';
import { defaultCroquiSettings,renderCroqui } from '../src/features/memorial/croquiRenderer';
import { mergeConfrontantsIntoProperties } from '../src/features/documents/confrontantRegistry';
import type { SurveyPolygon } from '../src/features/memorial/memorialEngine';

const poly:SurveyPolygon={id:'parcela-1',name:'Teste',areaM2:1600,perimeterM:160,properties:{confrontants:{'1-2':'Vizinho antigo'}},vertices:[[-39.6000,-13.1000],[-39.5996,-13.1000],[-39.5996,-13.0996],[-39.6000,-13.0996]]};

describe('Confrontações independentes entre vértices consecutivos',()=>{
 it('não apaga V02→V03 ao cadastrar V03→V04',()=>{
  let labels=resolveSegmentConfrontants(poly.properties,4);
  labels=setSegmentConfrontant(poly.properties,4,labels,1,'João');
  labels=setSegmentConfrontant(poly.properties,4,labels,2,'Maria');
  expect(labels).toEqual(['','João','Maria','']);
  expect(groupConfrontations(labels).map(group=>group.label)).toEqual(['João','Maria']);
 });
 it('preserva dados já existentes na geometria quando apenas outro trecho é editado',()=>{
  const updated=setSegmentConfrontant(poly.properties,4,[],2,'Maria');
  expect(updated[1]).toBe('Vizinho antigo');
  expect(updated[2]).toBe('Maria');
 });
 it('preserva uma exclusão explícita sem ressuscitar o nome anterior',()=>{
  const edited=setSegmentConfrontant(poly.properties,4,[],1,'');
  expect(edited[1]).toBe('');
 });
 it('o croqui e o cadastro da nuvem mostram ambas as confrontações',()=>{
  const neighbors=setSegmentConfrontant(poly.properties,4,[],2,'Maria');
  const settings={...defaultCroquiSettings(),background:'none' as const,neighbors};
  const document=withSavedCroquiSettings({options:{}},'project-1',poly.id,settings);
  const recovered=readSharedConfrontants(document.options,'project-1',poly.id);
  expect(recovered?.neighbors[1]).toBe('Vizinho antigo');
  expect(recovered?.neighbors[2]).toBe('Maria');
  const metadata=mergeConfrontantsIntoProperties(poly.properties,4,recovered||null);
  expect(readConfrontation(metadata,1,4)).toBe('Vizinho antigo');
  expect(readConfrontation(metadata,2,4)).toBe('Maria');
  const svg=renderCroqui(poly,settings,{company:'',municipality:'',mapLink:'',qr:''});
  expect(svg).toContain('data-croqui-label="neighbor:1"');
  expect(svg).toContain('data-croqui-label="neighbor:2"');
  expect(svg).toContain('Vizinho antigo');
  expect(svg).toContain('Maria');
 });
});
