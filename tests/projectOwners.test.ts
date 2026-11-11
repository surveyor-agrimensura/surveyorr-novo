import { describe, it, expect } from 'vitest';
import { projectOwners } from '../src/features/projects/projectOwners';
import { defaultCroquiSettings, renderCroqui } from '../src/features/memorial/croquiRenderer';
import type { SurveyPolygon } from '../src/features/memorial/memorialEngine';

const polygon:SurveyPolygon={id:'1',name:'Área de teste',vertices:[[-39.1,-13.1],[-39.099,-13.1],[-39.099,-13.099]],properties:{},areaM2:5000,perimeterM:350};

describe('Projeto, coproprietários e personalização',()=>{
 it('preserva segundo proprietário e seus documentos em metadata',()=>{
  const owners=projectOwners({ownerName:'Pessoa Principal',metadata:{ownerCpf:'12345678901',additionalOwners:[{name:'Pessoa Secundária',cpf:'98765432100',rg:'12345'}]}});
  expect(owners.map(p=>p.name)).toEqual(['Pessoa Principal','Pessoa Secundária']);
  expect(owners[1].cpf).toBe('987.654.321-00');
 });
 it('aceita formato legado owner2, sem duplicar o titular',()=>{
  const owners=projectOwners({ownerName:'Primeiro',metadata:{owner2:'Segundo',additionalOwners:[{name:'Segundo',cpf:'98765432100'}]}});
  expect(owners).toHaveLength(2);
 });
 it('gera croqui sem mapa raster e com logo exclusivamente da conta',()=>{
  const settings={...defaultCroquiSettings(),background:'none' as const};
  const img='data:image/png;base64,AAAA';
  const data={company:'Empresa de Teste',mapLink:'',municipality:'BA',logo:img,owners:['Principal','Segundo']};
  const svg=renderCroqui(polygon,settings,data);
  expect(svg).toContain('data-surveyor-account-logo="1"');
  expect(svg).toContain('Proprietário(s):');
  expect(svg).toContain('Segundo');
  expect(svg).not.toMatch(/ArcGIS\/rest\/services|tile\.openstreetmap/);
  const unbranded=renderCroqui(polygon,settings,{...data,logo:''});
  expect(unbranded).not.toContain('data-surveyor-account-logo');
 });
});
