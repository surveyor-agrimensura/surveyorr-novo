import {describe,expect,it} from 'vitest';
import {withSearchDeadline} from '../src/features/map/searchDeadline';

describe('prazo máximo da pesquisa de imóveis',()=>{
 it('retorna a resposta se a fonte pública responder',async()=>{
  await expect(withSearchDeadline(async()=>['CAR encontrado'],100)).resolves.toEqual(['CAR encontrado']);
 });
 it('encerra uma chamada que não responde e cancela o sinal da rede',async()=>{
  let requestSignal:AbortSignal|undefined;
  await expect(withSearchDeadline(signal=>{requestSignal=signal;return new Promise<string>(()=>{});},15)).rejects.toThrow('ultrapassou');
  expect(requestSignal?.aborted).toBe(true);
 });
 it('respeita o cancelamento do usuário',async()=>{
  const controller=new AbortController();
  const request=withSearchDeadline(()=>new Promise<string>(()=>{}),1000,controller.signal);
  controller.abort();
  await expect(request).rejects.toThrow('cancelada');
 });
});
