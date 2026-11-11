import {describe,expect,it} from 'vitest';
import {defaultSheet,normalizeSheet} from '../src/features/documents/technicalSheet';
import {sheetDraftKey,parseLocalSheetDraft,selectSheetDraft,sheetDraftMatches} from '../src/features/documents/sheetDraftState';

describe('Etapa 70: persistência da prancha por projeto e polígono',()=>{
 it('usa chaves isoladas por usuário, projeto e feição',()=>{
  expect(sheetDraftKey('usuario-1','gleba-1','pol-1')).not.toBe(sheetDraftKey('usuario-2','gleba-1','pol-1'));
  expect(sheetDraftKey('usuario-1','gleba-1','pol-1')).not.toBe(sheetDraftKey('usuario-1','gleba-2','pol-1'));
  expect(sheetDraftKey('usuario-1','gleba-1','pol-1')).not.toBe(sheetDraftKey('usuario-1','gleba-1','pol-2'));
 });
 it('preserva arraste de assinatura e rótulos mesmo quando nuvem está atrasada',()=>{
  const cloud=normalizeSheet({...defaultSheet(),revision:100,signatureOffsetY:0});
  const edited=normalizeSheet({...cloud,revision:200,signatureOffsetY:360,labelOffsets:{'neighbor:1':{dx:-210,dy:18}}});
  const local=parseLocalSheetDraft(JSON.stringify({settings:edited,pending:true,updatedAt:200}));
  const recovered=selectSheetDraft(cloud,local);
  expect(recovered.recovered).toBe(true);
  expect(recovered.settings.signatureOffsetY).toBe(360);
  expect(recovered.settings.labelOffsets['neighbor:1']).toEqual({dx:-210,dy:18});
 });
 it('confirma a prancha inteira, incluindo posições da assinatura e elementos visuais',()=>{
  const snapshot=normalizeSheet({...defaultSheet(),revision:300,signatureOffsetY:260,labelOffsets:{'neighbor:1':{dx:-210,dy:18}},labelColors:{'neighbor:1':'#336699'}});
  const stale=normalizeSheet({...snapshot,signatureOffsetY:0,labelColors:{'neighbor:1':'#17212b'}});

  expect(sheetDraftMatches(snapshot,snapshot)).toBe(true);
  expect(sheetDraftMatches(snapshot,stale)).toBe(false);
 });
 it('prefere a nuvem mais recente depois de uma gravação confirmada',()=>{
  const old=normalizeSheet({...defaultSheet(),revision:100});
  const next=normalizeSheet({...defaultSheet(),revision:400,title:'Prancha nova'});
  const local=parseLocalSheetDraft(JSON.stringify({settings:old,pending:false,updatedAt:100}));
  expect(selectSheetDraft(next,local).settings.title).toBe('Prancha nova');
 });
 it('não aceita rascunho malformado',()=>{
  expect(parseLocalSheetDraft('{')).toBeNull();
  expect(parseLocalSheetDraft('{}')).toBeNull();
 });
});
