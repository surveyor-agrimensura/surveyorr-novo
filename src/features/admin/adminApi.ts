import { apiRequest, ApiError } from '../../lib/api';
import type { SurveyorSession } from '../auth/authService';

export type Raw = Record<string, unknown>;
export type AdminUser = { id:string; name:string; email:string; role:string; status:string; planSlug?:string; planName?:string; planId?:string; expiresAt?:string; phone?:string; whatsapp?:string; team?:string; lastLogin?:string; lastActivity?:string; latestProject?:string; } & Raw;
export type AdminPlan = { id:string; name:string; slug:string; priceCents?:number; billingCycle?:string; isActive?:boolean; permissions?:string[]; maxMembers?:number; maxStorageMb?:number; } & Raw;
export type AdminLayer = { id:string; name:string; groupId?:string; groupName?:string; sourceName?:string; serviceUrl?:string; geometryType?:string; status?:string; published?:boolean; style?:Raw; } & Raw;
export type AdminGroup = { id:string; name:string; published?:boolean; } & Raw;
export type AdminNotice = { id:string; title:string; message:string; status?:string; isActive?:boolean; type?:'info'|'success'|'warning'|'danger'|'maintenance'|string; category?:string; displayMode?:string; deliveryMode?:string; audience?:'all'|'users'|'admins'|'plan'|'user'|string; targetPlanSlug?:string|null; targetUserId?:string|null; startsAt?:string|null; endsAt?:string|null; blocksApp?:boolean; requiresAck?:boolean; createdAt?:string|null; updatedAt?:string|null; } & Raw;
export type AdminAudit = { id?:string; userId?:string; userEmail?:string; email?:string; action?:string; event?:string; createdAt?:string; timestamp?:string; details?:unknown; } & Raw;

const arr = <T>(value:unknown, ...keys:string[]):T[] => {
 if(Array.isArray(value))return value as T[];
 if(value && typeof value==='object'){
  const o=value as Raw;
  for(const key of keys)if(Array.isArray(o[key]))return o[key] as T[];
  if(o.data && typeof o.data==='object')return arr<T>(o.data,...keys);
 }
 return [];
};
const id = (v:string)=>encodeURIComponent(v);
export function adminApi(session:SurveyorSession){
 const token=session.accessToken;
 const req=<T=Raw>(path:string,method:'GET'|'POST'|'PATCH'|'PUT'|'DELETE'='GET',body?:unknown)=>apiRequest<T>(path,{accessToken:token,method,body,timeoutMs:method==='GET'?20000:60000});
 const fallback=async<T>(paths:string[]):Promise<T>=>{
  let last:unknown;
  for(const p of paths){try{return await req<T>(p);}catch(e){last=e;if(!(e instanceof ApiError)||![404,405].includes(e.status))throw e;}}
  throw last;
 };
 return {
  raw:req,
  users:async()=>arr<AdminUser>(await req('/api/admin/users'),'users'),
  user:async(userId:string)=>req<{user?:AdminUser}>(`/api/admin/users/${id(userId)}`),
  saveUser:async(u:Partial<AdminUser>&Raw,userId?:string)=>req(userId?`/api/admin/users/${id(userId)}`:'/api/admin/users',userId?'PATCH':'POST',u),
  changeEmail:async(userId:string,payload:Raw)=>req(`/api/admin/users/${id(userId)}/email`,'POST',payload),
  removeUser:async(userId:string)=>req(`/api/admin/users/${id(userId)}`,'DELETE'),
  remoteLogout:async(userId:string)=>req(`/api/admin/users/${id(userId)}/logout-remote`,'POST',{}),
  team:async(ownerId:string)=>fallback<Raw>([`/api/admin/users/${id(ownerId)}/team/members`,`/api/admin/users/${id(ownerId)}/subusers`,`/api/admin/users/${id(ownerId)}/team`]),
  createMember:async(ownerId:string,payload:Raw)=>{try{return await req(`/api/admin/users/${id(ownerId)}/team/members`,'POST',payload)}catch(e){if(e instanceof ApiError&&[404,405].includes(e.status))return req(`/api/admin/users/${id(ownerId)}/subusers`,'POST',payload);throw e}},
  deleteMember:async(memberId:string)=>{try{return await req(`/api/admin/team-members/${id(memberId)}`,'DELETE')}catch(e){if(e instanceof ApiError&&[404,405].includes(e.status))return req(`/api/admin/subusers/${id(memberId)}`,'DELETE');throw e}},
  updateTeam:async(ownerId:string,payload:Raw)=>req(`/api/admin/users/${id(ownerId)}/team`,'PATCH',payload),
  plans:async()=>arr<AdminPlan>(await req('/api/plans?all=1'),'plans'),
  savePlan:async(payload:Raw,planId?:string)=>req(planId?`/api/plans/${id(planId)}`:'/api/plans',planId?'PATCH':'POST',payload),
  removePlan:async(planId:string)=>req(`/api/plans/${id(planId)}`,'DELETE'),
  dedupePlans:async()=>req('/api/admin/plans/dedupe','POST',{}),
  layers:async()=>arr<AdminLayer>(await req('/api/admin/layers'),'layers'),
  groups:async()=>arr<AdminGroup>(await req('/api/admin/layer-groups'),'groups'),
  saveLayer:async(payload:Raw,layerId?:string)=>req(layerId?`/api/admin/layers/${id(layerId)}`:'/api/admin/layers',layerId?'PATCH':'POST',payload),
  publishLayer:async(layerId:string,published:boolean)=>req(`/api/admin/layers/${id(layerId)}/publish`,'PATCH',{published}),
  removeLayer:async(layerId:string)=>req(`/api/admin/layers/${id(layerId)}`,'DELETE'),
  createGroup:async(name:string)=>req('/api/admin/layer-groups','POST',{name}),
  seedGeoBahia:async()=>req('/api/admin/layers/seed/geobahia-official','POST',{source:'geobahia-inema',mode:'upsert-groups-and-layers'}),
  notices:async()=>arr<AdminNotice>(await fallback(['/api/admin/notices','/api/admin/system-notices']),'notices'),
  saveNotice:async(payload:Raw,noticeId?:string)=>req<{ok?:boolean;notice?:AdminNotice}>(noticeId?`/api/admin/notices/${id(noticeId)}`:'/api/admin/notices',noticeId?'PATCH':'POST',payload),
  deleteNotice:async(noticeId:string)=>req(`/api/admin/notices/${id(noticeId)}`,'DELETE'),
  dashboard:async()=>req<Raw>('/api/admin/dashboard'),
  sessions:async()=>arr<Raw>(await req('/api/admin/sessions'),'sessions'),
  audits:async()=>arr<AdminAudit>(await req('/api/admin/audit-logs?limit=200'),'logs','auditLogs','events'),
  loginAttempts:async()=>arr<Raw>(await req('/api/admin/login-attempts?limit=100'),'attempts','loginAttempts'),
  settings:async()=>req<Raw>('/api/admin/security/settings'),
 };
}
