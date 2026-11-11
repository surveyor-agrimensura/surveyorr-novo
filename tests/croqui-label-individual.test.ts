import {describe,expect,it} from 'vitest';
import {defaultCroquiSettings,normalizeCroquiSettings,renderCroqui} from '../src/features/memorial/croquiRenderer';
import {cloudCroquiDraft,withSavedCroquiSettings} from '../src/features/croqui/sharedCroquiSettings';
import type {SurveyPolygon} from '../src/features/memorial/memorialEngine';

const poly:SurveyPolygon={id:'sitio-qa',name:'SÍTIO DEUS DARÁ',properties:{},areaM2:11416,perimeterM:825,
 vertices:[[-39.523,-13.115],[-39.522,-13.115],[-39.522,-13.114],[-39.523,-13.114]]};
const info={company:'AGR',municipality:'Amargosa/BA',mapLink:'',propertyName:'SÍTIO DEUS DARÁ'};
const getLabel=(svg:string,key:string)=>{
 const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return svg.match(new RegExp(`<text data-croqui-label="${escaped}"[^>]*>`))?.[0]||'';
};
const font=(markup:string)=>Number(markup.match(/font-size="([0-9.]+)"/)?.[1]);

describe('Croqui: menu de aparência individual realmente aplicado no SVG',()=>{
 const colors={'area:polygon':'#b12244','area:metrics':'#0077aa','vertex:0':'#22aa44','neighbor:0':'#aabbcc','cota:0':'#334455','custom-cota:reta':'#3d70ab'};
 const angles={'area:polygon':-45,'area:metrics':15,'vertex:0':-30,'neighbor:0':42,'cota:0':12,'custom-cota:reta':-60};
 const sizes={'area:polygon':180,'area:metrics':60,'vertex:0':65,'neighbor:0':190,'cota:0':125,'custom-cota:reta':220};
 const initial=normalizeCroquiSettings({...defaultCroquiSettings(),background:'none',labelMode:'all',neighbors:['JOSELIA DOS SANTOS SENA'],customCotas:[{id:'reta',target:'sitio-qa',from:0,to:2}]});
 const customized=normalizeCroquiSettings({...initial,labelColors:colors,labelAngles:angles,labelSizes:sizes});
 it('permite cor, rotação e tamanho por rótulo sem alterar os outros',()=>{
  const base=renderCroqui(poly,initial,info);
  const svg=renderCroqui(poly,customized,info);
  for(const [key,percent] of Object.entries(sizes)){
   const item=getLabel(svg,key);
   expect(item,key).toContain(`fill="${colors[key as keyof typeof colors]}"`);
   expect(item,key).toContain(`rotate(${angles[key as keyof typeof angles]}`);
   expect(font(item),key).toBeCloseTo(font(getLabel(base,key))*percent/100,1);
  }
 });
 it('salva e recupera a aparência individual no mesmo projeto',()=>{
  const payload=withSavedCroquiSettings({options:{}},'projeto-qa',poly.id,customized);
  const recovered=normalizeCroquiSettings(cloudCroquiDraft(payload.options,'projeto-qa',poly.id));
  expect(recovered.labelSizes).toEqual(sizes);
  expect(recovered.labelColors).toEqual(colors);
  expect(recovered.labelAngles).toEqual(angles);
  expect(getLabel(renderCroqui(poly,recovered,info),'area:metrics')).toContain('fill="#0077aa"');
  expect(getLabel(renderCroqui(poly,recovered,info),'neighbor:0')).toContain('rotate(42');
 });
 it('aplica aparência independente ao nome e aos vértices de gleba composta',()=>{
  const d={featureId:'gleba-1',partIndex:0,category:'gleba',name:'Gleba A',areaM2:1000,perimeterM:200,rings:[poly.vertices]};
  const d2={...d,featureId:'gleba-2',name:'Gleba B',rings:[poly.vertices.map(([x,y])=>[x+0.002,y] as [number,number])]};
  const settings=normalizeCroquiSettings({...initial,labelColors:{'gleba-1':'#aa2255','division:gleba-1:0:vertex:0':'#116677'},labelAngles:{'gleba-1':25,'division:gleba-1:0:vertex:0':-20},labelSizes:{'gleba-1':150,'division:gleba-1:0:vertex:0':200}});
  const svg=renderCroqui(poly,settings,{...info,divisions:[d,d2],composite:true,areaSettings:{'gleba-1':initial}});
  expect(getLabel(svg,'gleba-1')).toContain('fill="#aa2255"');
  expect(getLabel(svg,'gleba-1')).toContain('rotate(25');
  expect(getLabel(svg,'division:gleba-1:0:vertex:0')).toContain('fill="#116677"');
  expect(getLabel(svg,'division:gleba-1:0:vertex:0')).toContain('rotate(-20');
  expect(getLabel(svg,'gleba-2')).not.toContain('fill="#aa2255"');
 });
});
