import {afterEach, describe, expect, it, vi} from 'vitest';
import {adminApi} from '../src/features/admin/adminApi';
import {getDocumentCustomization, saveDocumentCustomization} from '../src/features/customization/customizationApi';
import {saveProjectBundle, getProject} from '../src/features/projects/projectsApi';
import type {SurveyorSession} from '../src/features/auth/authService';

const session={accessToken:'token-de-teste',user:{id:'usuario'},tokenType:'Bearer',updatedAt:'2026-01-01T00:00:00Z'} as SurveyorSession;
const mockResponse=(body:object,status=200)=>({ok:status<400,status,text:async()=>JSON.stringify(body)} as Response);
afterEach(()=>vi.unstubAllGlobals());

describe('Contrato de persistência: API do SURVEYOR',()=>{
 it('envia criação de usuário por POST autenticado',async()=>{
  const fetcher=vi.fn().mockResolvedValue(mockResponse({user:{id:'novo'}}));vi.stubGlobal('fetch',fetcher);
  await adminApi(session).saveUser({name:'Novo usuário',email:'novo@example.com'});
  const [url,options]=fetcher.mock.calls[0];
  expect(String(url)).toContain('/api/admin/users');expect(options.method).toBe('POST');
  expect(options.headers.Authorization).toBe('Bearer token-de-teste');
  expect(JSON.parse(options.body).email).toBe('novo@example.com');
 });
 it('envia edição de usuário por PATCH e permite confirmar via GET',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(mockResponse({ok:true})).mockResolvedValueOnce(mockResponse({users:[{id:'123',name:'Nome novo',email:'a@example.com',status:'active',role:'user'}]}));
  vi.stubGlobal('fetch',fetcher);const api=adminApi(session);
  await api.saveUser({name:'Nome novo'},'123');const list=await api.users();
  expect(list[0].name).toBe('Nome novo');expect(fetcher.mock.calls[0][1].method).toBe('PATCH');
  expect(String(fetcher.mock.calls[0][0])).toContain('/api/admin/users/123');
 });
 it('recusa confirmação em caso de erro retornado pelo servidor',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(mockResponse({error:'Acesso negado'},403)));
  await expect(adminApi(session).saveUser({name:'A'},'123')).rejects.toThrow('Acesso negado');
 });
 it('salva geometria e projeto pela API e relê o bundle na nuvem',async()=>{
  const geometry={type:'Point',coordinates:[-39.6,-13]};
  const project={id:'projeto-1',name:'Levantamento',propertyName:'Levantamento',updatedAt:'2026-10-25T12:00:00Z'};
  const features=[{name:'Ponto P-01',geoJson:geometry}];
  const fetcher=vi.fn().mockResolvedValueOnce(mockResponse({ok:true,project,features})).mockResolvedValueOnce(mockResponse({project,features}));
  vi.stubGlobal('fetch',fetcher);
  const saved=await saveProjectBundle(session,null,{name:'Levantamento'},features);
  expect(saved.project.id).toBe('projeto-1');
  const confirmed=await getProject(session,'projeto-1');
  expect(confirmed.features).toHaveLength(1);
  expect(fetcher.mock.calls[0][1].method).toBe('POST');
  expect(fetcher.mock.calls[1][1].method).toBe('GET');
  expect(String(fetcher.mock.calls[0][0])).toBe('https://6a7bce66000fc9c90d88.nyc.appwrite.run/api/projects');
  expect(fetcher.mock.calls[0][1].credentials).toBe('omit');
  expect(fetcher.mock.calls[0][1].headers['Content-Type']).toBe('text/plain;charset=UTF-8');
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
  const outgoing=JSON.parse(fetcher.mock.calls[0][1].body);
  expect(outgoing.features[0].name).toBe('Ponto P-01');
  expect(outgoing.__surveyorSaveTransport.version).toBe(1);
  expect(outgoing.__surveyorSaveTransport.accessToken).toBe('token-de-teste');
 });
 it('persiste preferências pela rota PUT e confirma por GET',async()=>{
  const saved={companyName:'Empresa teste',options:{memorialTemplateId:'verde'}};
  const fetcher=vi.fn().mockResolvedValueOnce(mockResponse({customization:saved})).mockResolvedValueOnce(mockResponse({customization:saved}));
  vi.stubGlobal('fetch',fetcher);
  const first=await saveDocumentCustomization(session,saved);const verified=await getDocumentCustomization(session);
  expect(first.customization).toEqual(saved);expect(verified.customization).toEqual(saved);
  expect(fetcher.mock.calls[0][1].method).toBe('PUT');expect(fetcher.mock.calls[1][1].method).toBe('GET');
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer token-de-teste');
 });
});
