import {describe,expect,it} from 'vitest';
import {projectTitle} from '../src/features/projects/projectsApi';
import {defaultCroquiSettings,renderCroqui} from '../src/features/memorial/croquiRenderer';
import {defaultSheet,renderTechnicalSheet} from '../src/features/documents/technicalSheet';
import type {SurveyPolygon} from '../src/features/memorial/memorialEngine';

const polygon:SurveyPolygon={id:'poly-001',name:'NILTON SETE VOLTA',
 vertices:[[-39.52,-13.11],[-39.519,-13.11],[-39.519,-13.109],[-39.52,-13.109]],
 properties:{},areaM2:8000,perimeterM:400};
const project={id:'project-001',propertyName:'GLEBA 02',name:'GLEBA 02'};
const documentName=projectTitle(project);

describe('Nome oficial do imóvel em todas as peças técnicas',()=>{
 it('mantém o nome do projeto em vez de usar o nome interno da feição no Croqui',()=>{
  const svg=renderCroqui(polygon,{...defaultCroquiSettings(),background:'none'},
   {company:'AGR',municipality:'Amargosa / BA',mapLink:'',propertyName:documentName});
  expect(svg).toContain('x="514" y="737"');
  expect(svg).toContain(`>${documentName}</text>`);
  expect(svg).not.toContain('>NILTON SETE VOLTA</text>');
 });
 it('mantém o nome do projeto no carimbo da Prancha Técnica',()=>{
  const svg=renderTechnicalSheet(polygon,{...defaultSheet(),background:'none'},
   {company:'AGR',municipality:'Amargosa / BA',owner:'',date:'28/10/2026',publicUrl:'',projectTitle:documentName});
  expect(svg).toContain('GLEBA 02');
  expect(svg).not.toContain('>NILTON SETE VOLTA</text>');
 });
 it('mantém compatibilidade com geração avulsa sem projeto cadastrado',()=>{
  const svg=renderCroqui(polygon,{...defaultCroquiSettings(),background:'none'},
   {company:'AGR',municipality:'Amargosa / BA',mapLink:''});
  expect(svg).toContain('>NILTON SETE VOLTA</text>');
 });
});
