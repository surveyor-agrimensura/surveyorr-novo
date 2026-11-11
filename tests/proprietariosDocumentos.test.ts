import {describe,expect,it} from 'vitest';
import {projectOwners} from '../src/features/projects/projectOwners';
import {defaultCroquiSettings,renderCroqui} from '../src/features/memorial/croquiRenderer';
import {defaultSheet,renderTechnicalSheet} from '../src/features/documents/technicalSheet';
import type {SurveyPolygon} from '../src/features/memorial/memorialEngine';

const poly:SurveyPolygon={id:'imovel-1',name:'Gleba 3',areaM2:7000,perimeterM:360,
 properties:{},vertices:[[-39.52,-13.11],[-39.519,-13.11],[-39.519,-13.109],[-39.52,-13.109]]};
const owners=['OTAVIO EVANDRO CUNHA','ZENAIDE ASSIS DA COSTA CUNHA'];

describe('Proprietários independentes nos documentos',()=>{
 it('mantém CPFs associados a cada pessoa sem colocá-los junto ao nome',()=>{
  const rows=projectOwners({ownerName:owners[0],metadata:{ownerCpf:'36144932534',
   additionalOwners:[{name:owners[1],cpf:'39335607568'}]}});
  expect(rows.map(row=>row.name)).toEqual(owners);
  expect(rows.map(row=>row.cpf)).toEqual(['361.449.325-34','393.356.075-68']);
 });
 it('escreve os dois nomes em linhas distintas no croqui técnico do memorial',()=>{
  const svg=renderCroqui(poly,{...defaultCroquiSettings(),background:'none'},
   {company:'AGR',municipality:'Amargosa / BA',mapLink:'',owners});
  expect(svg).toContain(`>${owners[0]}</text>`);
  expect(svg).toContain(`>${owners[1]}</text>`);
  expect(svg).not.toContain(owners.join(' · '));
  expect(svg.indexOf(owners[0])).toBeLessThan(svg.indexOf(owners[1]));
 });
 it('escreve os dois proprietários em linhas distintas na prancha técnica',()=>{
  const svg=renderTechnicalSheet(poly,{...defaultSheet(),background:'none'},
   {municipality:'Amargosa / BA',owner:owners[0],owners,company:'AGR',date:'27/10/2026',publicUrl:''});
  expect(svg).toContain('PROPRIETÁRIOS:');
  expect(svg).toContain(`>${owners[0]}</tspan>`);
  expect(svg).toContain(`>${owners[1]}</tspan>`);
  expect(svg).not.toContain(owners.join(' · '));
 });
});
