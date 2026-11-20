import {describe,expect,it} from 'vitest';
import {resolveUndoRedoAction} from '../src/lib/undoRedoShortcuts';

const event=(key:string,options:Partial<Pick<KeyboardEvent,'ctrlKey'|'metaKey'|'shiftKey'|'target'>>={})=>({
 key,ctrlKey:false,metaKey:false,shiftKey:false,target:null,...options
});

describe('atalhos de desfazer e refazer',()=>{
 it('reconhece Ctrl/Cmd+Z, Shift+Z e Y',()=>{
  expect(resolveUndoRedoAction(event('z',{ctrlKey:true}))).toBe('undo');
  expect(resolveUndoRedoAction(event('Z',{metaKey:true}))).toBe('undo');
  expect(resolveUndoRedoAction(event('z',{ctrlKey:true,shiftKey:true}))).toBe('redo');
  expect(resolveUndoRedoAction(event('y',{metaKey:true}))).toBe('redo');
 });

 it('não interfere na edição de campos nem em diálogos',()=>{
  const protectedTarget={closest:(selector:string)=>selector.includes('input')};
  expect(resolveUndoRedoAction(event('z',{ctrlKey:true,target:protectedTarget as unknown as EventTarget}))).toBeNull();
  const dialogTarget={closest:(selector:string)=>selector.includes('[role="dialog"]')};
  expect(resolveUndoRedoAction(event('z',{ctrlKey:true,target:dialogTarget as unknown as EventTarget}))).toBeNull();
 });

 it('ignora teclas sem modificador e combinações desconhecidas',()=>{
  expect(resolveUndoRedoAction(event('z'))).toBeNull();
  expect(resolveUndoRedoAction(event('x',{ctrlKey:true}))).toBeNull();
  expect(resolveUndoRedoAction(event('y',{ctrlKey:true,shiftKey:true}))).toBeNull();
 });
});
