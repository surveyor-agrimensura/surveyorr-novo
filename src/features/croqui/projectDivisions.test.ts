import {describe,expect,it} from 'vitest';
import type {ProjectFeature} from '../projects/projectsApi';
import {readProjectDivisions} from './projectDivisions';

const projectFeature=(coordinates:unknown):ProjectFeature=>({
 id:'division-test',
 geoJson:{type:'Polygon',coordinates} as unknown as ProjectFeature['geoJson'],
});

describe('readProjectDivisions',()=>{
 it('rejects a polygon whose exterior ring is invalid instead of promoting a hole',()=>{
  const invalidExterior=[[-39,-13],[-39.001,-13],['not-a-longitude',-12.999]];
  const validHole=[[-39.0008,-12.9998],[-39.0002,-12.9998],[-39.0002,-12.9992],[-39.0008,-12.9998]];

  expect(readProjectDivisions([projectFeature([invalidExterior,validHole])])).toEqual([]);
 });

 it('preserves a valid exterior and its valid interior ring',()=>{
  const exterior=[[-39,-13],[-39.002,-13],[-39.002,-12.998],[-39,-12.998],[-39,-13]];
  const hole=[[-39.0005,-12.9995],[-39.0015,-12.9995],[-39.0015,-12.9985],[-39.0005,-12.9985],[-39.0005,-12.9995]];

  const [division]=readProjectDivisions([projectFeature([exterior,hole])]);

  expect(division.rings).toHaveLength(2);
  expect(division.rings[0]).toEqual(exterior.slice(0,-1));
  expect(division.rings[1]).toEqual(hole.slice(0,-1));
 });
});
