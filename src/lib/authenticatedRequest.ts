import {apiRequest,ApiError,type RequestOptions} from './api';
import {checkSession,readSession,type SurveyorSession} from '../features/auth/authService';

/** Uma renovação de sessão por vez, inclusive quando vários módulos carregam juntos.
 * Uma falha de rede NÃO apaga as credenciais nem força logout.
 */
let refreshInFlight:Promise<SurveyorSession>|null=null;
const sessionListeners=new Set<(session:SurveyorSession)=>void>();
export function subscribeAuthenticatedSession(listener:(session:SurveyorSession)=>void){
 sessionListeners.add(listener);
 return()=>{sessionListeners.delete(listener);};
}
export async function refreshAuthenticatedSession(session:SurveyorSession):Promise<SurveyorSession>{
 if(!refreshInFlight){
  const cached=readSession();
  const source=cached?{...cached,accessToken:cached.accessToken||session.accessToken}:session;
  refreshInFlight=checkSession(source).then(updated=>{
   sessionListeners.forEach(listener=>listener(updated));
   return updated;
  }).finally(()=>{refreshInFlight=null;});
 }
 return refreshInFlight;
}
export async function authenticatedRequest<T>(path:string,options:RequestOptions={}):Promise<T>{
 const current=readSession();
 const initialToken=current?.accessToken||options.accessToken;
 try{return await apiRequest<T>(path,{...options,accessToken:initialToken});}
 catch(error){
  if(!(error instanceof ApiError)||error.status!==401||!initialToken||path.startsWith('/api/auth/'))throw error;
  const refreshSource=current?{...current,accessToken:initialToken}:{user:{},accessToken:initialToken,tokenType:'Bearer',updatedAt:new Date().toISOString()};
  const next=await refreshAuthenticatedSession(refreshSource);
  if(!next.accessToken)throw error;
  return apiRequest<T>(path,{...options,accessToken:next.accessToken});
 }
}
