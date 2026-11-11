import {useEffect,useMemo,useRef,useState} from 'react';
import {Archive,Bell,Check,CircleCheck,Inbox,RefreshCw,Undo2,X} from 'lucide-react';
import {authenticatedRequest} from '../../lib/authenticatedRequest';
import type {SurveyorSession} from '../../features/auth/authService';
import {getDocumentCustomization,updateDocumentCustomization} from '../../features/customization/customizationApi';

type Notice={id?:string;title?:string;message?:string;type?:string;category?:string;createdAt?:string;source?:string;origin?:string;senderName?:string};
type NoticeState={readIds:string[];dismissedIds:string[]};
const EMPTY_NOTICE_STATE:NoticeState={readIds:[],dismissedIds:[]};
const NOTICE_TYPES:Record<string,string>={info:'Informação',success:'Sucesso',warning:'Alerta',danger:'Urgente',maintenance:'Manutenção'};

function noticeDate(value?:string){
 if(!value)return '';
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 const seconds=(date.getTime()-Date.now())/1000,absolute=Math.abs(seconds);
 const [unit,divisor]=absolute<60?['second',1]:absolute<3600?['minute',60]:absolute<86400?['hour',3600]:['day',86400];
 return new Intl.RelativeTimeFormat('pt-BR',{numeric:'auto'}).format(Math.round(seconds/divisor),unit as Intl.RelativeTimeFormatUnit);
}
function noticeStorageKey(owner:string){
 return 'surveyor-notice-state:v1:'+encodeURIComponent(owner.trim().toLowerCase());
}
function readNoticeState(key:string|null):NoticeState{
 if(!key||typeof window==='undefined')return EMPTY_NOTICE_STATE;
 try{
  const value=JSON.parse(window.localStorage.getItem(key)||'{}') as Partial<NoticeState>;
  return {
   readIds:Array.isArray(value.readIds)?value.readIds.filter((id):id is string=>typeof id==='string'):[],
   dismissedIds:Array.isArray(value.dismissedIds)?value.dismissedIds.filter((id):id is string=>typeof id==='string'):[]
  };
 }catch{return EMPTY_NOTICE_STATE;}
}
function normalizeNoticeState(value:unknown):NoticeState{
 const state=value&&typeof value==='object'&&!Array.isArray(value)?value as Partial<NoticeState>:{};
 return {readIds:Array.isArray(state.readIds)?state.readIds.filter((id):id is string=>typeof id==='string'):[],dismissedIds:Array.isArray(state.dismissedIds)?state.dismissedIds.filter((id):id is string=>typeof id==='string'):[]};
}
export function mergeNoticeStates(a:NoticeState,b:NoticeState):NoticeState{
 return {readIds:[...new Set([...a.readIds,...b.readIds])],dismissedIds:[...new Set([...a.dismissedIds,...b.dismissedIds])]};
}
function optionsOf(value:unknown):Record<string,unknown>{
 return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function saveNoticeState(key:string|null,value:NoticeState){
 if(!key||typeof window==='undefined')return false;
 try{window.localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
}
export function notificationIdentity(notice:Notice){
 if(notice.id)return 'id:'+notice.id;
 const source=[notice.title||'',notice.message||'',notice.createdAt||''].join('|');
 let hash=2166136261;
 for(let index=0;index<source.length;index++)hash=Math.imul(hash^source.charCodeAt(index),16777619);
 return 'fallback:'+(hash>>>0).toString(16);
}
export function updateNoticeState(current:NoticeState,id:string,kind:'read'|'dismissed',enabled:boolean):NoticeState{
 const key=kind==='read'?'readIds':'dismissedIds';
 const values=new Set(current[key]);
 if(enabled)values.add(id);else values.delete(id);
 return {...current,[key]:[...values]};
}

export function NotificationCenter({session}:{session:SurveyorSession|null}){
 const root=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const closeButton=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[reload,setReload]=useState(0),[filter,setFilter]=useState<'all'|'unread'|'dismissed'>('all');
 const [notices,setNotices]=useState<Notice[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [storedStates,setStoredStates]=useState<Record<string,NoticeState>>({});
 const [storageUnavailable,setStorageUnavailable]=useState(false);
 const [stateSync,setStateSync]=useState<'loading'|'synced'|'local'|'saving'|'error'>('loading');
 const [stateSyncMessage,setStateSyncMessage]=useState('');
 const owner=String(session?.user?.id||session?.user?.email||'').trim();
 const storageKey=owner?noticeStorageKey(owner):null;
 const noticeState=useMemo(()=>storageKey?(storedStates[storageKey]||readNoticeState(storageKey)):EMPTY_NOTICE_STATE,[storageKey,storedStates]);
 const readIds=useMemo(()=>new Set(noticeState.readIds),[noticeState.readIds]);
 const dismissedIds=useMemo(()=>new Set(noticeState.dismissedIds),[noticeState.dismissedIds]);

 useEffect(()=>{
  if(storageKey)setStoredStates(previous=>previous[storageKey]?previous:{...previous,[storageKey]:readNoticeState(storageKey)});
 },[storageKey]);
 useEffect(()=>{
  if(!session?.accessToken||!storageKey){setStateSync('local');setStateSyncMessage('');return;}
  let active=true;setStateSync('loading');setStateSyncMessage('');
  void getDocumentCustomization(session).then(result=>{
   if(!active)return;
   const remote=normalizeNoticeState(optionsOf(result.customization?.options).notificationState);
   const merged=mergeNoticeStates(readNoticeState(storageKey),remote);
   setStorageUnavailable(!saveNoticeState(storageKey,merged));
   setStoredStates(previous=>({...previous,[storageKey]:mergeNoticeStates(previous[storageKey]||EMPTY_NOTICE_STATE,merged)}));
   setStateSync('synced');
  }).catch(()=>{
   if(!active)return;
   setStateSync('error');
   setStateSyncMessage('Não foi possível sincronizar as preferências de avisos. Elas continuam salvas neste navegador.');
  });
  return()=>{active=false;};
 },[session?.accessToken,storageKey]);
 useEffect(()=>{
  const accessToken=session?.accessToken;
  if(!accessToken){setNotices([]);setLoading(false);setError('');return;}
  const controller=new AbortController();
  let active=true,inFlight=false;
  const load=async(initial=false)=>{
   if(!active||inFlight)return;
   inFlight=true;
   if(initial)setLoading(true);
   setError('');
   try{
    const result=await authenticatedRequest<{notices?:Notice[]}>('/api/notices',{accessToken,signal:controller.signal,timeoutMs:12000});
    if(active)setNotices(Array.isArray(result.notices)?result.notices.filter(item=>item&&item.title&&item.message):[]);
   }catch(reason){
    if(active&&!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Não foi possível carregar os avisos.');
   }finally{
    inFlight=false;
    if(active&&initial)setLoading(false);
   }
  };
  void load(true);
  const interval=window.setInterval(()=>void load(),5*60*1000);
  const onVisibility=()=>{if(document.visibilityState==='visible')void load();};
  window.addEventListener('focus',onVisibility);
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{
   active=false;controller.abort();window.clearInterval(interval);
   window.removeEventListener('focus',onVisibility);
   document.removeEventListener('visibilitychange',onVisibility);
  };
 },[session?.accessToken,reload]);
 useEffect(()=>{
  if(!open)return;
  closeButton.current?.focus();
  const outside=(event:PointerEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false);};
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}
  };
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keyboard);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard);};
 },[open]);

 const persistState=(id:string,kind:'read'|'dismissed',enabled:boolean)=>{
  if(!storageKey){setStorageUnavailable(true);return;}
  const next=updateNoticeState(storedStates[storageKey]||readNoticeState(storageKey),id,kind,enabled);
  setStoredStates(previous=>{
   setStorageUnavailable(!saveNoticeState(storageKey,next));
   return {...previous,[storageKey]:next};
  });
  if(!session?.accessToken){setStateSync('local');return;}
  setStateSync('saving');setStateSyncMessage('');
  void updateDocumentCustomization(session,current=>{
   const currentOptions=optionsOf(current.options);
   const cloud=normalizeNoticeState(currentOptions.notificationState);
   const latest=updateNoticeState(mergeNoticeStates(cloud,next),id,kind,enabled);
   return {...current,options:{...currentOptions,notificationState:latest}};
  }).then(async result=>{
   if(!result.saved.customization)throw new Error('O servidor não confirmou a atualização dos avisos.');
   const confirmed=await getDocumentCustomization(session);
   const saved=normalizeNoticeState(optionsOf(confirmed.customization?.options).notificationState);
   const values=kind==='read'?saved.readIds:saved.dismissedIds;
   if(values.includes(id)!==enabled)throw new Error('A releitura da conta não confirmou o estado deste aviso.');
   const merged=mergeNoticeStates(next,saved);
   setStorageUnavailable(!saveNoticeState(storageKey,merged));
   setStoredStates(previous=>({...previous,[storageKey]:mergeNoticeStates(previous[storageKey]||EMPTY_NOTICE_STATE,merged)}));
   setStateSync('synced');setStateSyncMessage('');
  }).catch(()=>{
   setStateSync('error');
   setStateSyncMessage('Não foi possível confirmar a alteração na conta. Ela continua salva neste navegador; tente novamente quando a conexão voltar.');
  });
 };
 const unreadCount=notices.filter(notice=>!dismissedIds.has(notificationIdentity(notice))&&!readIds.has(notificationIdentity(notice))).length;
 const dismissedCount=notices.filter(notice=>dismissedIds.has(notificationIdentity(notice))).length;
 const visibleNotices=notices.filter(notice=>{
  const id=notificationIdentity(notice),dismissed=dismissedIds.has(id),read=readIds.has(id);
  if(filter==='dismissed')return dismissed;
  if(dismissed)return false;
  return filter==='unread'?!read:true;
 });

 return <div className="notification-center" ref={root}>
  <button ref={trigger} className="shortcut small notification-trigger" type="button" title="Avisos e notificações" aria-label={'Avisos e notificações'+(unreadCount?(', '+unreadCount+' não lidos'):', nenhum não lido')} aria-expanded={open} aria-haspopup="dialog" aria-controls="surveyor-notification-panel" onClick={()=>setOpen(value=>!value)}>
   <Bell size={19} aria-hidden="true"/>{unreadCount>0&&<span className="notification-count" aria-hidden="true">{unreadCount>9?'9+':unreadCount}</span>}
  </button>
  {open&&<section className="notification-panel" id="surveyor-notification-panel" role="dialog" aria-modal="false" aria-labelledby="surveyor-notification-title" aria-describedby="surveyor-notification-description">
   <header>
    <div><h2 id="surveyor-notification-title">Avisos</h2><small id="surveyor-notification-description">{String(session?.user?.name||'Comunicados para sua conta')} · {unreadCount} não lidos</small></div>
    <button type="button" title="Atualizar avisos" aria-label="Atualizar avisos" disabled={loading} onClick={()=>setReload(value=>value+1)}><RefreshCw size={15} aria-hidden="true"/></button>
    <button ref={closeButton} type="button" title="Fechar avisos" aria-label="Fechar avisos" onClick={()=>{setOpen(false);trigger.current?.focus();}}><X size={17} aria-hidden="true"/></button>
   </header>
   <div className="notification-account-email">{String(session?.user?.email||'')}</div>
   <nav className="notification-tabs" aria-label="Filtrar avisos">
    <button type="button" className={filter==='all'?'is-active':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}><Inbox size={16}/> Todos</button>
    <button type="button" className={filter==='unread'?'is-active':''} aria-pressed={filter==='unread'} onClick={()=>setFilter('unread')}><Bell size={16}/> Não lidos{unreadCount>0?` (${unreadCount})`:''}</button>
    <button type="button" className={filter==='dismissed'?'is-active':''} aria-pressed={filter==='dismissed'} onClick={()=>setFilter('dismissed')}><Archive size={16}/> Dispensados{dismissedCount>0?` (${dismissedCount})`:''}</button>
   </nav>
   {stateSync==='error'&&<p className="notification-state notification-error" role="status">{stateSyncMessage||'A sincronização das preferências falhou; a leitura continua disponível neste navegador.'}</p>}
   {stateSync==='saving'&&<p className="notification-state" role="status">Salvando sua preferência…</p>}
   {storageUnavailable&&<p className="notification-state notification-error" role="status">O navegador não permitiu salvar a leitura localmente; ela poderá ser perdida ao sair.</p>}
   {!session?.accessToken&&<p className="notification-state" role="status">Entre na sua conta para carregar os avisos.</p>}
   {loading&&<p className="notification-state" role="status">Carregando avisos…</p>}
   {!loading&&error&&<div className="notification-state notification-error" role="alert"><p>{error}</p><button type="button" onClick={()=>setReload(value=>value+1)}>Tentar novamente</button></div>}
   {!loading&&!error&&session?.accessToken&&!notices.length&&<p className="notification-state" role="status">Não há avisos ativos para sua conta.</p>}
   <div className="notification-list" aria-live="polite">
    {visibleNotices.map(notice=>{
     const id=notificationIdentity(notice);
     const isRead=readIds.has(id),isDismissed=dismissedIds.has(id);
     const type=String(notice.type||notice.category||'info').toLowerCase();
     const typeClass=Object.prototype.hasOwnProperty.call(NOTICE_TYPES,type)?type:'info';
     return <article className={'notification-item notification-'+typeClass+(isRead?' is-read':'')+(isDismissed?' is-dismissed':'')} key={id} aria-label={(isRead?'Lido':'Não lido')+': '+notice.title}>
      <div className="notification-item-heading"><div><span className="notification-category">{NOTICE_TYPES[typeClass]}</span><strong>{notice.title}</strong><small>{notice.source||notice.origin||notice.senderName||'Publicado pelo Surveyor'}</small></div>{notice.createdAt&&<time dateTime={notice.createdAt}>{noticeDate(notice.createdAt)}</time>}</div>
      <p>{notice.message}</p>
      <div className="notification-item-actions">
       <button type="button" aria-pressed={isRead} aria-label={(isRead?'Marcar como não lido: ':'Marcar como lido: ')+notice.title} onClick={()=>persistState(id,'read',!isRead)}>{isRead?'Marcar como não lido':<><Check size={14} aria-hidden="true"/> Marcar como lido</>}</button>
       <button type="button" aria-label={(isDismissed?'Restaurar aviso: ':'Dispensar aviso: ')+notice.title} onClick={()=>persistState(id,'dismissed',!isDismissed)}>{isDismissed?<><Undo2 size={14} aria-hidden="true"/> Restaurar</>:<><X size={14} aria-hidden="true"/> Dispensar</>}</button>
      </div>
     </article>;
    })}
    {!loading&&session?.accessToken&&!error&&!visibleNotices.length&&<div className="notification-empty" role="status"><CircleCheck size={24}/><strong>{filter==='unread'?'Nenhum aviso não lido':filter==='dismissed'?'Nenhum aviso dispensado':notices.length?'Todos os avisos foram dispensados':'Você está em dia'}</strong><span>{filter==='all'&&!notices.length?'Os novos comunicados aparecerão aqui.':'Não há avisos nesta lista.'}</span></div>}
   </div>
  </section>}
 </div>;
}
