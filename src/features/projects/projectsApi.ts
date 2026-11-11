import {authenticatedRequest as apiRequest,refreshAuthenticatedSession} from '../../lib/authenticatedRequest';
import {ApiError} from '../../lib/api';
import {readSession} from '../auth/authService';
import { saveFunctionRequest } from '../../lib/saveApi';
import type { SurveyorSession } from '../auth/authService';

export type Project = {
 id: string; revision?:string; name?:string; propertyName?:string; title?:string; ownerName?:string; owner?:string; description?:string;
 municipality?:string; city?:string; stateCode?:string; uf?:string; areaHa?:number; perimeterM?:number;
 featureCount?:number; updatedAt?:string; createdAt?:string; createdByName?:string;
 centerLatitude?:number; centerLongitude?:number; defaultZoom?:number;
 thumbnailUrl?:string; previewImage?:string; metadata?:Record<string,unknown>;
};
export type StorageStatus={usedBytes:number;limitBytes:number|null;maxBytes?:number};
export type GeoGeometry={type:string;coordinates:unknown};
export type ProjectFeature={id?:string;name?:string;geoJson?:GeoGeometry;geometry?:GeoGeometry;properties?:Record<string,unknown>};
export type ProjectFull={project:Project|null;features:ProjectFeature[]};
const withAuth=(session:SurveyorSession)=>({accessToken:session.accessToken});

/** Private, per-session query cache. Stores no credentials on disk and never caches edits.
 * Reuses concurrent responses; invalidated on writes and explicit refresh.
 */
type SessionQueryCache={projects?:{expires:number;value:Project[];pending?:Promise<Project[]>};storage?:{expires:number;value:StorageStatus|null;pending?:Promise<StorageStatus|null>}};
const sessionQueries=new WeakMap<SurveyorSession,SessionQueryCache>();
export function invalidateProjectQueries(session:SurveyorSession){sessionQueries.delete(session);}
function cachedForSession<T>(session:SurveyorSession,name:'projects'|'storage',ms:number,load:()=>Promise<T>,force=false):Promise<T>{
 let state=sessionQueries.get(session);
 if(!state){state={};sessionQueries.set(session,state);}
 const values=state as Record<string,{expires:number;value:T;pending?:Promise<T>}|undefined>;
 const cached=values[name];
 if(!force&&cached?.pending)return cached.pending;
 if(!force&&cached&&cached.expires>Date.now())return Promise.resolve(cached.value);
 // Old in-flight results cannot repopulate a cache invalidated by an edit.
 const generation=state;
 const pending=load().then(value=>{if(sessionQueries.get(session)===generation&&values[name]?.pending===pending)values[name]={value,expires:Date.now()+ms};return value;},error=>{if(sessionQueries.get(session)===generation&&values[name]?.pending===pending)delete values[name];throw error;});
 values[name]={value:undefined as T,expires:0,pending};
 return pending;
}

export async function listProjects(session:SurveyorSession,force=false){
 return cachedForSession(session,'projects',8_000,async()=>{
  const data=await apiRequest<{projects:Project[]}>('/api/projects',withAuth(session));
  return Array.isArray(data.projects)?data.projects:[];
 },force);
}
export async function storageStatus(session:SurveyorSession,force=false){
 return cachedForSession(session,'storage',15_000,async()=>{
  const data=await apiRequest<{storage:StorageStatus|null}>('/api/storage/status',withAuth(session));
  return data.storage||null;
 },force);
}
export async function getProject(session:SurveyorSession,id:string){
 const data=await apiRequest<ProjectFull>(`/api/projects/${encodeURIComponent(id)}`,withAuth(session));
 return {project:data.project??null,features:Array.isArray(data.features)?data.features:[]};
}
export async function createProject(session:SurveyorSession,data:{name:string;propertyName:string;ownerName:string;municipality:string;stateCode:string}){
 const response=await apiRequest<{project:Project}>('/api/projects',{
  ...withAuth(session), method:'POST',idempotencyKey:`create-project-${crypto.randomUUID()}`,body:{...data,status:'active',description:'Projeto criado pelo SURVEYOR Web.',metadata:{source:'surveyor-react-web'}}
 });
 if(!response.project?.id)throw new Error('A API não confirmou a criação do projeto.');
 invalidateProjectQueries(session);
 return response.project;
}
export function formatBytes(bytes:number){
 if(!Number.isFinite(bytes)||bytes<=0)return '0 B';
 const units=['B','KB','MB','GB','TB'];let i=0;let n=bytes;
 while(n>=1024 && i<units.length-1){n/=1024;i++;}
 return `${n.toLocaleString('pt-BR',{maximumFractionDigits:n>=100?0:n>=10?1:2})} ${units[i]}`;
}
export const projectTitle=(p:Project)=>p.propertyName||p.title||p.name||'Projeto sem nome';

export async function saveProjectBundle(session:SurveyorSession,id:string|null,payload:Record<string,unknown>,features:Array<Record<string,unknown>>){
 const revision=String(payload.expectedUpdatedAt||'');
 if(id&&!revision)throw new Error('Revisão remota ausente. Reabra o projeto antes de salvar.');
 const key=`surveyor-bundle-${id||'novo'}-${crypto.randomUUID()}`;
 const path=id?`/api/projects/${encodeURIComponent(id)}/bundle`:'/api/projects';
 const doSave=(token:string)=>saveFunctionRequest<{project:Project;features:ProjectFeature[]}>(path,{project:payload,features},{
  accessToken:token,expectedRevision:id?revision:undefined,idempotencyKey:key,timeoutMs:60000
 });
 const latest=readSession()||session;
 try{const saved=await doSave(latest.accessToken);invalidateProjectQueries(session);return saved;}
 catch(error){
  if(!(error instanceof ApiError)||error.status!==401)throw error;
  // Apenas autenticação recusada: o mesmo identificador de idempotência
  // protege a repetição do pedido após renovar o token.
  const refreshed=await refreshAuthenticatedSession(latest);
  const saved=await doSave(refreshed.accessToken);invalidateProjectQueries(session);return saved;
 }
}

/** Envia o projeto à lixeira da conta/equipe. A API valida as permissões. */
export async function trashProject(session:SurveyorSession,id:string):Promise<void> {
 await apiRequest(`/api/projects/${encodeURIComponent(id)}`,{method:'DELETE',accessToken:session.accessToken});
 invalidateProjectQueries(session);
}
