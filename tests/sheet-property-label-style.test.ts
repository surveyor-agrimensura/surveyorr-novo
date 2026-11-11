import {describe,it,expect} from 'vitest';
import {defaultSheet,normalizeSheet,renderTechnicalSheet,sheetLabelAppearance} from '../src/features/documents/technicalSheet';
import type {SurveyPolygon} from '../src/features/memorial/memorialEngine';

const area:SurveyPolygon={id:'sitio-qa',name:'SÍTIO DEUS DARÁ',
 vertices:[[-39.523,-13.115],[-39.522,-13.115],[-39.522,-13.114],[-39.523,-13.114]],
 properties:{},areaM2:12321,perimeterM:445};
const context={company:'AGR',municipality:'Amargosa / BA',owner:'Pessoa de teste',date:'29/10/2026',publicUrl:'',projectTitle:'SÍTIO DEUS DARÁ'};
const propertyText=(svg:string)=>svg.match(/<text data-sheet-label="property:title"[^>]*>/)?.[0]||'';

describe('Prancha: personalização funcional do nome do imóvel',()=>{
 it('recupera valores inválidos de opacidade sem gerar NaN no SVG',()=>{
  const settings=normalizeSheet({...defaultSheet(),miniOpacity:'inválida' as unknown as number,polygonFillOpacity:'inválida' as unknown as number});
  expect(settings.miniOpacity).toBe(defaultSheet().miniOpacity);
  expect(settings.polygonFillOpacity).toBe(defaultSheet().polygonFillOpacity);
  const shape=renderTechnicalSheet(area,settings,context).match(/<path data-sheet-polygon="true"[^>]*>/)?.[0]||'';
  expect(shape).toContain('fill-opacity="0.2"');
  expect(shape).not.toContain('NaN');
 });
 it('mostra controles antigos com 100% e normaliza novo tamanho isolado',()=>{
  const prior=normalizeSheet({...defaultSheet(),labelSizes:undefined});
  expect(sheetLabelAppearance(prior,'property:title',12,'#17355a')).toMatchObject({size:12,percent:100,angle:0,color:'#17355a'});
  const custom=normalizeSheet({...prior,labelSizes:{'property:title':160,'vertex:0':250,'neighbor:1':-8}});
  expect(custom.labelSizes['property:title']).toBe(160);
  expect(custom.labelSizes['vertex:0']).toBe(250);
  expect(custom.labelSizes['neighbor:1']).toBe(40);
 });
 it('aplica cor, rotação e tamanho no SVG do imóvel individual',()=>{
  const before=propertyText(renderTechnicalSheet(area,{...defaultSheet(),background:'none'},context));
  const settings=normalizeSheet({...defaultSheet(),background:'none',
    labelColors:{'property:title':'#e21f35'},labelAngles:{'property:title':-45},labelSizes:{'property:title':175}});
  const svg=renderTechnicalSheet(area,settings,context);
  const after=propertyText(svg);
  expect(before).toContain('data-sheet-label="property:title"');
  expect(after).toContain('fill="#e21f35"');
  expect(after).toMatch(/transform="rotate\(-45\.00 [\d.]+ [\d.]+\)"/);
  const getFont=(text:string)=>Number(text.match(/font-size="([\d.]+)"/)?.[1]);
  expect(getFont(after)).toBeCloseTo(getFont(before)*1.75,1);
  expect(svg).toContain('SÍTIO DEUS DARÁ');
 });
 it('mantém o rótulo editado depois de serializar e carregar o rascunho',()=>{
  const edited=normalizeSheet({...defaultSheet(),labelAngles:{'property:title':90},labelSizes:{'property:title':200},labelColors:{'property:title':'#2a8b49'},labelOffsets:{'property:title':{dx:20,dy:35}}});
  const reloaded=normalizeSheet(JSON.parse(JSON.stringify(edited)));
  const text=propertyText(renderTechnicalSheet(area,reloaded,context));
  expect(text).toContain('fill="#2a8b49"');
  expect(text).toMatch(/rotate\(90\.00/);
  expect(text).toContain('data-sheet-visual-y=');
  expect(reloaded.labelOffsets['property:title']).toEqual({dx:20,dy:35});
  expect(reloaded.labelSizes['property:title']).toBe(200);
 });
});
