import {useEffect,useState} from 'react';
import {Dialog} from './Dialog';

export type ConfirmationOptions={
 title?:string;
 message:string;
 confirmLabel?:string;
 cancelLabel?:string;
 destructive?:boolean;
};

type PendingConfirmation={id:number;options:ConfirmationOptions;resolve:(confirmed:boolean)=>void};
let nextId=0;
let active:PendingConfirmation|null=null;
const queue:PendingConfirmation[]=[];
const subscribers=new Set<()=>void>();

function publish(){for(const subscriber of subscribers)subscriber();}
function advance(){active=queue.shift()??null;publish();}

export function requestConfirmation(options:ConfirmationOptions|string):Promise<boolean>{
 const normalized=typeof options==='string'?{message:options}:options;
 return new Promise(resolve=>{
  const request={id:++nextId,options:normalized,resolve};
  if(active){queue.push(request);return;}
  active=request;publish();
 });
}

function settle(id:number,confirmed:boolean){
 if(!active||active.id!==id)return;
 const current=active;
 active=null;
 current.resolve(confirmed);
 advance();
}

export function ConfirmDialogHost(){
 const [request,setRequest]=useState(active);
 useEffect(()=>{
  const update=()=>setRequest(active);
  subscribers.add(update);
  update();
  return()=>{subscribers.delete(update);};
 },[]);
 if(!request)return null;
 const {options,id}=request;
 return <Dialog open title={options.title||'Confirmação necessária'} description="Revise esta ação antes de continuar." onClose={()=>settle(id,false)} closeOnBackdrop={false} backdropClassName="confirm-dialog-layer" footer={<><button type="button" className="button outline" onClick={()=>settle(id,false)}>{options.cancelLabel||'Cancelar'}</button><button type="button" className={options.destructive?'confirm-dialog-danger':'button primary'} onClick={()=>settle(id,true)}>{options.confirmLabel||'Continuar'}</button></>}><p className="confirm-dialog-message">{options.message}</p></Dialog>;
}
