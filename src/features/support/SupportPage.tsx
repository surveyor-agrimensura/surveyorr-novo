import { useState, type FormEvent } from 'react';
import { BookOpen, CheckCircle2, Clock3, Headphones, Mail, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SUPPORT_EMAIL } from '../../lib/config';
const ENDPOINT=(import.meta.env.VITE_SURVEYOR_SUPPORT_API_URL || 'https://6a46d3d0003091f98222.nyc.appwrite.run').replace(/\/+$/,'');
const types=[['ajuda','Preciso de ajuda / suporte'],['erro','Reportar erro ou bug'],['contratacao','Contratação de plano / proposta comercial'],['renovacao','Renovação de plano / acesso bloqueado'],['acesso','Problema de acesso ou login'],['privacidade','Privacidade / solicitação sobre meus dados'],['nova_funcao','Pedir função nova'],['outro','Outro assunto']];
export function SupportPage(){
 const {session}=useAuth();
 const [name,setName]=useState(session?.user?.name||'');
 const [email,setEmail]=useState(session?.user?.email||'');
 const [type,setType]=useState('ajuda');
 const [details,setDetails]=useState('');
 const [sending,setSending]=useState(false);
 const [feedback,setFeedback]=useState<{type:'success'|'error';message:string}|null>(null);
 async function send(e:FormEvent){
  e.preventDefault();setFeedback(null);
  const min=type==='nova_funcao'?30:12;
  if(details.trim().length<min){setFeedback({type:'error',message:`Escreva pelo menos ${min} caracteres na mensagem.`});return;}
  setSending(true);
  try {
   const response=await fetch(`${ENDPOINT}/api/support/request`,{
    method:'POST',mode:'cors',headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({name:name.trim(),email:email.trim(),type,details:details.trim(),page:window.location.href,createdAt:new Date().toISOString()})
   });
   let data:Record<string,unknown>={};
   try{data=await response.json() as Record<string,unknown>;}catch{throw new Error('Resposta inválida do serviço de suporte.');}
   if(!response.ok||data.ok===false||data.sent===false)throw new Error(String(data.error||data.message||'O suporte não confirmou o envio.'));
   setFeedback({type:'success',message:'Sua solicitação foi enviada ao suporte. A resposta será encaminhada ao e-mail informado.'});
   setDetails('');setType('ajuda');
  }catch(error){setFeedback({type:'error',message:error instanceof Error?error.message:'Não foi possível enviar. Verifique a conexão.'});}
  finally{setSending(false);}
 }
 return <main className="workspace-main"><div className="workspace-container support-container">
  <div className="page-heading"><span className="heading-icon"><Headphones size={29}/></span><h1>Central de Suporte</h1></div>
  <div className="support-grid"><section className="support-form-card"><h2>Abrir solicitação</h2><form className="support-form" onSubmit={e=>void send(e)}>
   <label>Seu nome<input autoComplete="name" placeholder="Nome completo" maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
   <label>Seu e-mail<input type="email" required autoComplete="email" placeholder="seuemail@exemplo.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Tipo de solicitação<select value={type} onChange={e=>setType(e.target.value)}>{types.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
   {type==='nova_funcao'&&<p className="support-feature-hint">Explique onde a função deve aparecer, como deve funcionar e qual problema ela resolve.</p>}
   <label>{type==='nova_funcao'?'Detalhe a função solicitada':'Mensagem'}<textarea rows={8} required minLength={type==='nova_funcao'?30:12} placeholder={type==='nova_funcao'?'Descreva a função com detalhes...':'Descreva sua solicitação com detalhes.'} value={details} onChange={e=>setDetails(e.target.value)}/></label>
   <button className="support-send" type="submit" disabled={sending}><Send size={16}/>{sending?'Enviando solicitação...':'Enviar solicitação'}</button>
   {feedback&&<div role="status" className={`support-feedback ${feedback.type}`}>{feedback.type==='success'&&<CheckCircle2 size={19}/>} {feedback.message}</div>}
  </form></section>
  <aside className="support-info">
   <a className="support-info-card" href={`mailto:${SUPPORT_EMAIL}`}><span><Mail size={22}/></span><div><strong>E-mail Direto</strong><small>{SUPPORT_EMAIL}</small></div></a>
   <Link className="support-info-card" to="/cursos/"><span><BookOpen size={22}/></span><div><strong>Guias do sistema</strong><small>Abra roteiros práticos para mapa, croqui, memorial e prancha técnica.</small></div></Link>
   <div className="support-info-card"><span><Clock3 size={22}/></span><div><strong>Horário de Atendimento</strong><small>Segunda a Sexta, das 08h às 18h (Horário de Brasília).</small></div></div>
  </aside></div>
 </div></main>;
}
