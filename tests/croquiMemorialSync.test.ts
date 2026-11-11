import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cloudCroquiDraft, croquiDraftMatches, localCroquiKey, writePendingCroquiDraft, readSharedConfrontants, readCroquiSettingsForDocument,
  readSharedCroquiSettings, resolveSharedCroquiSettings, combineCroquiConfrontants, stampCroquiRevision, pendingCroquiKey, withSavedCroquiSettings
} from '../src/features/croqui/sharedCroquiSettings';
import { defaultCroquiSettings, renderCroqui } from '../src/features/memorial/croquiRenderer';
import { mergeConfrontantsIntoProperties } from '../src/features/documents/confrontantRegistry';
import { memorialNarrative, type SurveyPolygon } from '../src/features/memorial/memorialEngine';

const settingsFor = (name: string) => ({
  ...defaultCroquiSettings(), title: name,
  neighbors: ['Vizinho ' + name, 'Estrada Municipal', 'Fazenda ' + name],
  neighborDetails: { '0': { property: 'Vizinho ' + name, owner:'',cpf:'',rg:'',showProperty:true,showOwner:false,showCpf:false,showRg:false } },
  labelOffsets: { 'vertex:0': {dx:12,dy:-9}},
  labelColors: { 'neighbor:0': '#336699' },
  polygonFill: '#112233'
});
const feature = (id:string): SurveyPolygon => ({
  id, name:'Imóvel '+id, properties:{},areaM2:100,perimeterM:40,
  vertices:[[-39.61,-13.1],[-39.609,-13.1],[-39.61,-13.099]]
});
const local = new Map<string,string>();
afterEach(()=>{local.clear();vi.unstubAllGlobals();});

describe('Mapas e Croquis → Memorial (fonte comum)',()=>{
 it('salva croqui + confrontantes em um único payload, preservando outros imóveis',()=>{
  const initial={options:{otherOption:true,croquiDraftsByFeature:{p1:{'imovel-a':settingsFor('A')}}}};
  const payload=withSavedCroquiSettings(initial,'p1','imovel-b',settingsFor('B'));
  expect(cloudCroquiDraft(payload.options,'p1','imovel-a').title).toBe('A');
  expect(cloudCroquiDraft(payload.options,'p1','imovel-b').title).toBe('B');
  expect(payload.options).toMatchObject({otherOption:true});
  expect(readSharedConfrontants(payload.options,'p1','imovel-b')?.neighbors[0]).toBe('Vizinho B');
  expect(readSharedConfrontants(payload.options,'p1','imovel-a')).toBeNull();
 });
 it('exige confirmação de todos os campos visuais de cada gleba',()=>{
  const payload=withSavedCroquiSettings({options:{}},'p1','a',settingsFor('A'));
  const saved=cloudCroquiDraft(payload.options,'p1','a');
  const staleOptions={croquiDraftsByFeature:{p1:{a:{...saved,labelOffsets:{}}}}};

  expect(croquiDraftMatches(payload.options,payload.options,'p1','a')).toBe(true);
  expect(croquiDraftMatches(payload.options,staleOptions,'p1','a')).toBe(false);
 });
 it('guarda a edição por gleba no navegador e mantém a marca de sincronização pendente',()=>{
  vi.stubGlobal('localStorage',{
   getItem:(key:string)=>local.get(key)||null,
   setItem:(key:string,value:string)=>{local.set(key,value);}
  });
  const settings=settingsFor('EDIÇÃO LOCAL');

  expect(writePendingCroquiDraft('usuario','p1','a',settings)).toBe(true);
  expect(JSON.parse(local.get(localCroquiKey('usuario','p1','a'))||'{}')).toMatchObject({title:'EDIÇÃO LOCAL'});
  expect(local.get(pendingCroquiKey('usuario','p1','a'))).toBe('1');
 });
 it('recupera o mesmo título, cores, posições, confrontações e texto para cada polígono',()=>{
  let payload:Record<string,unknown>={options:{}};
  payload=withSavedCroquiSettings(payload,'p1','a',settingsFor('A'));
  payload=withSavedCroquiSettings(payload,'p1','b',settingsFor('B'));
  const a=readSharedCroquiSettings(payload.options,'p1','a','usuario');
  const b=readSharedCroquiSettings(payload.options,'p1','b','usuario');
  expect(a?.labelOffsets['vertex:0']).toEqual({dx:12,dy:-9});
  expect(a?.polygonFill).toBe('#112233');
  expect(b?.title).toBe('B');
  expect(a?.title).toBe('A');
  const details=readSharedConfrontants(payload.options,'p1','b');
  const merged={...feature('b'),properties:mergeConfrontantsIntoProperties({},3,details)};
  expect(memorialNarrative(merged)).toContain('Vizinho B');
  expect(memorialNarrative(merged)).not.toContain('Vizinho A');
 });
 it('prancha do imóvel completo prioriza o rascunho próprio e cai para a primeira gleba quando necessário',()=>{
  let payload:Record<string,unknown>={options:{}};
  payload=withSavedCroquiSettings(payload,'p1','__imovel_completo__',settingsFor('IMÓVEL COMPLETO'));
  payload=withSavedCroquiSettings(payload,'p1','a',settingsFor('GLEBA A'));

  expect(readCroquiSettingsForDocument(payload.options,'p1','a','usuario','',true)?.title).toBe('IMÓVEL COMPLETO');
  expect(readCroquiSettingsForDocument(payload.options,'p1','a','usuario','',false)?.title).toBe('GLEBA A');

  const legacyComposite=withSavedCroquiSettings({options:{}},'p1','a',settingsFor('LEGADO POR GLEBA'));
  expect(readCroquiSettingsForDocument(legacyComposite.options,'p1','a','usuario','',true)?.title).toBe('LEGADO POR GLEBA');
 });
 it('prioriza o estado confirmado na nuvem mesmo com rascunho local antigo',()=>{
  vi.stubGlobal('localStorage',{getItem:(key:string)=>local.get(key)||null});
  local.set(localCroquiKey('usuario','p1','a'),JSON.stringify(settingsFor('DESATUALIZADO')));
  const payload=withSavedCroquiSettings({options:{}},'p1','a',settingsFor('CONFIRMADO'));
  expect(readSharedCroquiSettings(payload.options,'p1','a','usuario')?.title).toBe('CONFIRMADO');
 });
 it('aceita configurações antigas somente quando não há ambiguidade de polígono',()=>{
  const opts={croquiDrafts:{p1:settingsFor('ANTIGO')}};
  expect(readSharedCroquiSettings(opts,'p1','primeiro','usuario','',true)?.title).toBe('ANTIGO');
  expect(readSharedCroquiSettings(opts,'p1','outro','usuario','',false)).toBeNull();
 });
 it('uma atualização posterior do cadastro comum de confrontantes prevalece sobre o desenho antigo',()=>{
  const p=withSavedCroquiSettings({options:{}},'p1','a',settingsFor('A'));
  const options={...(p.options as Record<string,unknown>),confrontantRegistry:{p1:{a:{neighbors:['Atualizado no mapa'],details:{}}}}};
  expect(readSharedConfrontants(options,'p1','a')?.neighbors).toEqual(['Atualizado no mapa']);
 });
 it('não mistura assinatura local no backend e identifica a chave local por polígono',()=>{
  expect(localCroquiKey('user','p','a')).not.toBe(localCroquiKey('user','p','b'));
  const payload=withSavedCroquiSettings({options:{}},'p','a',{...settingsFor('A'),signature:'data:image/png;base64,XYZ'});
  expect(cloudCroquiDraft(payload.options,'p','a').signature).toBe('');
 });
 it('memorial prioriza revisão local mais recente quando a API ainda devolve croqui antigo',()=>{
  vi.stubGlobal('localStorage',{getItem:(key:string)=>local.get(key)||null});
  const old=stampCroquiRevision(settingsFor('RASCUNHO ANTIGO'),100);
  const latest=stampCroquiRevision({...settingsFor('CROQUI NOVO'),labelOffsets:{'neighbor:1':{dx:45,dy:-30}},polygonFill:'#778899'},200);
  const remote=withSavedCroquiSettings({options:{}},'p1','a',old);
  local.set(localCroquiKey('usuario','p1','a'),JSON.stringify(latest));
  const state=resolveSharedCroquiSettings(remote.options,'p1','a','usuario');
  expect(state.source).toBe('local-newer');
  expect(state.settings?.title).toBe('CROQUI NOVO');
  expect(state.settings?.labelOffsets['neighbor:1']).toEqual({dx:45,dy:-30});
  expect(state.settings?.polygonFill).toBe('#778899');
  expect(resolveSharedCroquiSettings(remote.options,'p1','b','usuario').settings).toBeNull();
 });
 it('uma revisão realmente mais recente da nuvem prevalece sobre cache antigo',()=>{
  vi.stubGlobal('localStorage',{getItem:(key:string)=>local.get(key)||null});
  const localPrevious=stampCroquiRevision(settingsFor('ANTIGO'),100);
  const cloudCurrent=stampCroquiRevision(settingsFor('NOVO NA NUVEM'),200);
  local.set(localCroquiKey('usuario','p1','a'),JSON.stringify(localPrevious));
  const remote=withSavedCroquiSettings({options:{}},'p1','a',cloudCurrent);
  const state=resolveSharedCroquiSettings(remote.options,'p1','a','usuario');
  expect(state.source).toBe('cloud');
  expect(state.settings?.title).toBe('NOVO NA NUVEM');
 });
 it('rascunho pendente de salvamento não desaparece quando um GET retorna cópia antiga',()=>{
  vi.stubGlobal('localStorage',{getItem:(key:string)=>local.get(key)||null});
  const remote=withSavedCroquiSettings({options:{}},'p1','a',settingsFor('VELHO NO SERVIDOR'));
  local.set(localCroquiKey('usuario','p1','a'),JSON.stringify(settingsFor('NÃO SINCRONIZADO')));
  local.set(pendingCroquiKey('usuario','p1','a'),'1');
  expect(resolveSharedCroquiSettings(remote.options,'p1','a','usuario').source).toBe('local-pending');
  expect(readSharedCroquiSettings(remote.options,'p1','a','usuario')?.title).toBe('NÃO SINCRONIZADO');
 });

 it('editor e memorial unem os confrontantes pela mesma regra',()=>{
  const poly=feature('a');
  const settings={...settingsFor('A'),neighbors:['Antigo no croqui','', 'Outro'],neighborDetails:{}};
  const registry={neighbors:['Atualizado no mapa','Vizinho 2','Outro'],details:{}};
  const editor=combineCroquiConfrontants(poly,settings,registry,false);
  const memorial=combineCroquiConfrontants(poly,settings,registry,false);
  expect(memorial.neighbors).toEqual(editor.neighbors);
  expect(memorial.neighbors).toEqual(['Atualizado no mapa','Vizinho 2','Outro']);
  const localPending=combineCroquiConfrontants(poly,settings,registry,true);
  expect(localPending.neighbors).toEqual(['Antigo no croqui','','Outro']);
 });

 it('não confunde um link público sem QR com ausência de link',()=>{
  const longUrl=`https://surveyor.example/publico/imovel/?dados=${'x'.repeat(2500)}`;
  const svg=renderCroqui(feature('qr-longo'),defaultCroquiSettings(),{company:'Empresa exemplo',municipality:'Município exemplo',mapLink:longUrl,qr:''});
  expect(svg).toContain('Sem QR; utilize o link completo ao lado');
  expect(svg).not.toContain('Sem link público');
 });

});
