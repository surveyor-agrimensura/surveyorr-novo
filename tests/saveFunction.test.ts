import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveProjectBundle } from '../src/features/projects/projectsApi';
import { checkSaveFunctionHealth, saveFunctionRequest } from '../src/lib/saveApi';
import type { SurveyorSession } from '../src/features/auth/authService';

const session={accessToken:'jwt-unit-test',user:{id:'usuario'},tokenType:'Bearer',updatedAt:'2026-01-01T00:00:00Z'} as SurveyorSession;
const response=(body:object,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body),json:async()=>body} as Response);
afterEach(()=>vi.unstubAllGlobals());

describe('surveyor-save: compatibilidade com a Function oficial',()=>{
 it('cria projeto via POST text/plain sem preflight ou cookies',async()=>{
  const fn=vi.fn().mockResolvedValue(response({ok:true,project:{id:'p1'},features:[]},201));vi.stubGlobal('fetch',fn);
  await saveProjectBundle(session,null,{name:'Novo'},[]);
  const [url,init]=fn.mock.calls[0];expect(url).toBe('https://6a7bce66000fc9c90d88.nyc.appwrite.run/api/projects');
  expect(init.method).toBe('POST');expect(init.credentials).toBe('omit');
  expect(init.headers['Content-Type']).toMatch(/^text\/plain/);
  expect(Object.keys(init.headers).sort()).toEqual(['Accept','Content-Type']);
  const body=JSON.parse(init.body);expect(body.project.name).toBe('Novo');
  expect(body.__surveyorSaveTransport).toMatchObject({version:1,accessToken:'jwt-unit-test',expectedRevision:''});
  expect(body.__surveyorSaveTransport.idempotencyKey).toBeTruthy();
 });
 it('atualiza projeto via POST /bundle com expectedRevision',async()=>{
  const fn=vi.fn().mockResolvedValue(response({ok:true,project:{id:'p1'},features:[]}));vi.stubGlobal('fetch',fn);
  await saveProjectBundle(session,'p1',{name:'Atualizado',expectedUpdatedAt:'2026-10-27T00:00:00.000Z'},[]);
  const [url,init]=fn.mock.calls[0];expect(url).toMatch(/\/api\/projects\/p1\/bundle$/);
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body).__surveyorSaveTransport.expectedRevision).toBe('2026-10-27T00:00:00.000Z');
 });
 it('não envia atualização sem revisão para evitar sobrescrever concorrente',async()=>{
  const fn=vi.fn();vi.stubGlobal('fetch',fn);
  await expect(saveProjectBundle(session,'p1',{name:'sem revisao'},[])).rejects.toThrow('Revisão remota ausente');
  expect(fn).not.toHaveBeenCalled();
 });
 it('apresenta erro útil para origem CORS/Function inacessível',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(saveProjectBundle(session,null,{name:'P'},[])).rejects.toThrow('surveyor-save');
 });
 it('propaga o erro real de autenticação/conflito retornado pela Function',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({ok:false,error:'Recarregue antes de salvar',details:{code:'EDIT_CONFLICT'}},409)));
  await expect(saveProjectBundle(session,'p1',{expectedUpdatedAt:'2026-10-27T00:00:00Z'},[])).rejects.toMatchObject({status:409,code:'EDIT_CONFLICT'});
 });
 it('não aceita HTTP 200 sem confirmação ok ou identificador',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({ok:true,features:[]})));
  await expect(saveProjectBundle(session,null,{name:'P'},[])).rejects.toThrow('identificador');
 });
 it('diagnostica disponibilidade da Function sem mandar token',async()=>{
  const fn=vi.fn().mockResolvedValue(response({ok:true,service:'Surveyor Save Function'}));vi.stubGlobal('fetch',fn);
  expect(await checkSaveFunctionHealth()).toMatch(/online/);
  expect(fn.mock.calls[0][0]).toMatch(/\/api\/live$/);
  expect(fn.mock.calls[0][1].credentials).toBe('omit');expect(fn.mock.calls[0][1].body).toBeUndefined();
 });
 it('não aceita rota de gravação fora de /api/projects',async()=>{
  await expect(saveFunctionRequest('/api/auth/login',{}, {accessToken:session.accessToken})).rejects.toThrow('Rota de salvamento inválida');
 });
});
