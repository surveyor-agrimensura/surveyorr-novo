import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Building2, Check, FileText, FolderOpen, Layers, Leaf, LockKeyhole, Map, Mountain, PanelTop, PenLine, Save, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getDocumentCustomization, saveDocumentCustomization } from './customizationApi';
import { SignaturePadControl } from '../../components/SignaturePadControl';
import { FileUploadField, type UploadProgressReporter } from '../../components/FileUploadField';
import {requestConfirmation} from '../../components/ConfirmDialogHost';
import './customization.css';

function readUploadDataUrl(file: File, reportProgress: UploadProgressReporter): Promise<string> {
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onprogress=event=>{if(event.lengthComputable&&event.total>0)reportProgress(file,event.loaded,event.total);};
  reader.onerror=()=>reject(reader.error||new Error('Falha ao ler a imagem.'));
  reader.onabort=()=>reject(new Error('Leitura da imagem cancelada.'));
  reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('A imagem não pôde ser lida.'));
  reader.readAsDataURL(file);
 });
}

type Preferences = {
 companyName:string; addressText:string; addressNumber:string; phoneNumber:string; whatsappNumber:string; websiteUrl:string; emailAddress:string; footerText:string;
 responsibleTechnician:string; professionalRegistry:string; professionalTitle:string; logoDataUrl:string; planDocumentSignatureDataUrl:string;
 options:Record<string, unknown>;
};
type Model = {id:string;name:string;image?:string;restricted?:boolean};
type ModuleId='empresa'|'tecnico'|'memorial'|'mapas'|'pranchas'|'planialtimetria'|'perimetro'|'ambiental'|'car'|'loteamento';
const models:Model[]=[
 {id:'standard',name:'Padrão do Surveyor'}, {id:'dourado',name:'Dourado',image:'01_Dourado.webp'}, {id:'ciano',name:'Ciano',image:'02_Ciano.webp'},
 {id:'verde',name:'Verde',image:'03_Verde.webp'}, {id:'amarelo',name:'Amarelo',image:'04_Amarelo.webp'}, {id:'agro-mais',name:'Agro+',image:'05_AgroMais.webp',restricted:true}
];
const modules:{id:ModuleId;title:string;caption:string;icon:typeof FileText;configurable:boolean}[]=[
 {id:'empresa',title:'Dados da empresa',caption:'Identificação, contato e logotipo',icon:Building2,configurable:true},
 {id:'tecnico',title:'Responsável técnico e assinatura',caption:'Dados profissionais e assinatura',icon:PenLine,configurable:true},
 {id:'memorial',title:'Memorial descritivo',caption:'Modelo e opções do documento',icon:FileText,configurable:true},
 {id:'mapas',title:'Mapas e croquis',caption:'Modelo e elementos do croqui',icon:Map,configurable:true},
 {id:'pranchas',title:'Prancha técnica',caption:'Modelo padrão',icon:PanelTop,configurable:false},
 {id:'planialtimetria',title:'Planialtimetria',caption:'Modelo padrão',icon:Mountain,configurable:false},
 {id:'perimetro',title:'Perímetro',caption:'Modelo padrão',icon:Layers,configurable:false},
 {id:'ambiental',title:'Relatório ambiental',caption:'Modelo padrão',icon:Leaf,configurable:false},
 {id:'car',title:'Módulo CAR',caption:'Campos e opções do relatório',icon:ShieldCheck,configurable:true},
 {id:'loteamento',title:'Loteamentos / REURB',caption:'Campos e opções do relatório',icon:FolderOpen,configurable:true}
];
const fields:Record<'empresa'|'tecnico',[keyof Preferences,string][]>={
 empresa:[['companyName','Nome da empresa/escritório'],['addressText','Endereço da empresa'],['addressNumber','Número do endereço'],['websiteUrl','Site da empresa'],['phoneNumber','Telefone da empresa'],['whatsappNumber','WhatsApp da empresa'],['emailAddress','E-mail da empresa'],['footerText','Texto do rodapé']],
 tecnico:[['responsibleTechnician','Nome do responsável técnico'],['professionalRegistry','Registro profissional'],['professionalTitle','Título profissional']]
};
const carOptions:[string,string][]=[['showSummaryCards','Mostrar cards resumidos de área'],['showFeatureTable','Mostrar tabela detalhada de feições'],['showPublicQr','Mostrar QR Code quando houver link público'],['showRegistrant','Mostrar dados do cadastrante'],['showTechnicalNotice','Mostrar aviso técnico preliminar'],['showOwnerDocuments','Mostrar CPF/CNPJ dos proprietários no relatório']];
const lotOptions:[string,string][]=[['showCroqui','Mostrar croqui técnico'],['showSegments','Mostrar descrição perimétrica e segmentos'],['showConfrontants','Mostrar confrontantes'],['showTech','Mostrar responsável técnico'],['showSignature','Mostrar área de assinatura']];
const initial:Preferences={companyName:'',addressText:'',addressNumber:'',phoneNumber:'',whatsappNumber:'',websiteUrl:'',emailAddress:'',footerText:'',responsibleTechnician:'',professionalRegistry:'',professionalTitle:'',logoDataUrl:'',planDocumentSignatureDataUrl:'',options:{}};
const asRecord=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const asText=(value:unknown)=>typeof value==='string'?value:'';
function normalize(raw:Record<string,unknown>):Preferences{
 const r={...initial,...raw} as Preferences;
 r.options=asRecord(raw.options);return r;
}
function Toggle({title,checked,change}:{title:string;checked:boolean;change:(next:boolean)=>void}){return <label className="custom-toggle"><input type="checkbox" checked={checked} onChange={e=>change(e.target.checked)}/><span>{title}</span></label>}
function SettingGroup({title,children}:{title:string;children:ReactNode}){return <section className="custom-box"><h3>{title}</h3>{children}</section>}
export function CustomizationPage(){
 const {session}=useAuth();
 const [selected,setSelected]=useState<ModuleId|null>(null);
 const [stored,setStored]=useState<Preferences>(initial);
 const [draft,setDraft]=useState<Preferences>(initial);
 const [loaded,setLoaded]=useState(false);const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');const [success,setSuccess]=useState('');const [touched,setTouched]=useState(false);
 const options=asRecord(draft.options);
 const selectedModel=asText(options.memorialTemplateId)||'standard';
 const selectableModels=useMemo(()=>models.filter(item=>!item.restricted || (Array.isArray(options.allowedMemorialTemplateIds)&&options.allowedMemorialTemplateIds.includes(item.id))),[options.allowedMemorialTemplateIds]);
 const fetchSettings=useCallback(async()=>{
  if(!session)return;setLoading(true);setError('');
  try{const result=await getDocumentCustomization(session);const data=normalize(asRecord(result.customization));setStored(data);setDraft(data);setLoaded(true);setTouched(false)}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar sua personalização.');setLoaded(false)}
  finally{setLoading(false)}
 },[session]);
 useEffect(()=>{void fetchSettings()},[fetchSettings]);
 const update=(key:keyof Preferences,value:string)=>{setDraft(p=>({...p,[key]:value}));setTouched(true);setSuccess('')};
 const updateOptions=(patch:Record<string,unknown>)=>{setDraft(p=>({...p,options:{...p.options,...patch}}));setTouched(true);setSuccess('')};
 const subOptions=(section:string,patch:Record<string,unknown>)=>updateOptions({[section]:{...asRecord(options[section]),...patch}});
 const optionValue=(section:string,key:string,defaultValue:boolean)=>{const value=asRecord(options[section])[key];return typeof value==='boolean'?value:defaultValue};
 const loadImage=async(file:File,kind:'logoDataUrl'|'planDocumentSignatureDataUrl',reportProgress:UploadProgressReporter)=>{
  const validMime=['image/png','image/jpeg','image/webp'].includes(file.type);
  const validExtension=/\.(png|jpe?g|webp)$/i.test(file.name);
  if(!validMime&&!validExtension)throw new Error('Envie uma imagem PNG, JPEG ou WebP.');
  if(file.size>2*1024*1024)throw new Error('A imagem deve ter no máximo 2 MB.');
  const dataUrl=await readUploadDataUrl(file,reportProgress);
  update(kind,dataUrl);
  setError('');
 };
 const save=async()=>{
  if(!session||!loaded||saving)return;
  setError('');setSuccess('');setSaving(true);
  try{
   // Preserve opções retornadas pelo servidor, inclusive permissões de modelos de memorial.
   const payload={...draft,options:{...stored.options,...draft.options}};
   const response=await saveDocumentCustomization(session,payload);
   if(!response.customization)throw new Error('A API não confirmou o salvamento da personalização.');
   const verification=await getDocumentCustomization(session);
   if(!verification.customization)throw new Error('A API gravou, mas não retornou a personalização para conferência.');
   const latest=normalize(verification.customization);
   // Confere as preferências alteradas pelo usuário e bloqueia sucesso falso.
   const keys:(keyof Preferences)[]=['companyName','addressText','addressNumber','websiteUrl','phoneNumber','whatsappNumber','emailAddress','footerText','responsibleTechnician','professionalRegistry','professionalTitle'];
   const missing=keys.find(k=>draft[k]!==stored[k] && latest[k]!==draft[k]);
   if(missing)throw new Error('A API não confirmou a alteração do campo '+missing+'.');
   if(JSON.stringify(latest.options)!==JSON.stringify(payload.options)){
    // Permite opções gerenciadas pelo servidor sem exigir a mesma ordem de chaves.
    const changed=Object.keys(draft.options).filter(k=>JSON.stringify(stored.options[k])!==JSON.stringify(draft.options[k]));
    const inconsistent=changed.find(k=>JSON.stringify(latest.options[k])!==JSON.stringify(draft.options[k]));
    if(inconsistent)throw new Error('A API não confirmou as opções de '+String(inconsistent||'personalização')+'.');
   }
   if(draft.logoDataUrl!==stored.logoDataUrl&&latest.logoDataUrl!==draft.logoDataUrl)throw new Error('A API não confirmou o logotipo.');
   if(draft.planDocumentSignatureDataUrl!==stored.planDocumentSignatureDataUrl&&latest.planDocumentSignatureDataUrl!==draft.planDocumentSignatureDataUrl)throw new Error('A API não confirmou a assinatura.');
   setStored(latest);setDraft(latest);setTouched(false);setSuccess('Preferências salvas na conta.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar a personalização.');}
  finally{setSaving(false)}
 };
 const choose=(id:ModuleId)=>{if(!modules.find(m=>m.id===id)?.configurable)return;setError('');setSuccess('');setSelected(id)};
 const restore=()=>{void requestConfirmation({title:'Descartar alterações?',message:'As alterações não salvas serão descartadas.',confirmLabel:'Descartar',destructive:true}).then(confirmed=>{if(confirmed){setDraft(stored);setTouched(false);setSelected(null)}})};
 const active=modules.find(m=>m.id===selected);
 return <div className="custom-page">
    <main className="custom-main"><div className="custom-heading"><div className="custom-heading-icon"><SlidersHorizontal size={25}/></div><div><p>PREFERÊNCIAS DA CONTA</p><h1>Personalização</h1><span>Configure dados, modelos e relatórios.</span></div></div>
   {error&&<div role="alert" className="custom-message error"><span>{error}</span><button onClick={()=>setError('')} aria-label="Fechar"><X size={16}/></button></div>}
   {success&&<div role="status" className="custom-message success"><Check size={17}/><span>{success}</span></div>}
   {loading&&<p className="custom-loading">Carregando personalização da conta...</p>}
   {!loading&&!loaded&&<button className="custom-button" onClick={()=>void fetchSettings()}>Tentar novamente</button>}
    {loaded&&!selected&&<><div className="custom-summary"><div><strong>Preferências da conta</strong><span>Compartilhadas pelos módulos disponíveis.</span></div><button className="custom-button outline" onClick={()=>void fetchSettings()} disabled={touched}>Atualizar dados</button></div><div className="custom-grid">{modules.map(m=>{const Icon=m.icon;return <button type="button" key={m.id} disabled={!m.configurable} className={`custom-module ${!m.configurable?'unavailable':''}`} onClick={()=>choose(m.id)}><span className="custom-module-icon"><Icon size={25}/></span><span className="custom-module-body"><b>{m.title}</b><small>{m.configurable?m.caption:'Modelo padrão do sistema'}</small><em>{m.configurable?'Personalizar':'Sem personalização'}</em></span>{!m.configurable?<LockKeyhole size={16}/>:<span className="custom-module-arrow">›</span>}</button>})}</div></>}
    {loaded&&selected&&<><div className="custom-edit-top"><div><small>EDITANDO</small><h2>{active?.title}</h2></div><button className="custom-button outline" onClick={()=>touched?restore():setSelected(null)}><ArrowLeft size={16}/> Voltar às opções</button></div>
    <div className="custom-editor">
     {(selected==='empresa'||selected==='tecnico')&&<><SettingGroup title={selected==='empresa'?'Identificação e contato':'Identificação profissional'}><div className="custom-form-grid">{fields[selected].map(([key,label])=><label key={String(key)} className="custom-field"><span>{label}</span><input value={asText(draft[key])} onChange={e=>update(key,e.target.value)}/></label>)}</div></SettingGroup><SettingGroup title={selected==='empresa'?'Logotipo da empresa':'Assinatura reutilizável do responsável técnico'}><div className="custom-image-upload">{(selected==='empresa'?draft.logoDataUrl:draft.planDocumentSignatureDataUrl)?<img src={selected==='empresa'?draft.logoDataUrl:draft.planDocumentSignatureDataUrl} alt={selected==='empresa'?'Logotipo da empresa':'Assinatura do responsável técnico'}/>:<p>{selected==='empresa'?'Nenhum logotipo cadastrado':'Nenhuma assinatura cadastrada'}</p>}</div><div className="custom-upload-actions"><FileUploadField label={selected==='empresa'?'Importar logotipo':'Importar assinatura'} accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" maxBytes={2*1024*1024} description="PNG, JPEG ou WebP. A imagem será lida localmente." onFile={(file,reportProgress)=>loadImage(file,selected==='empresa'?'logoDataUrl':'planDocumentSignatureDataUrl',reportProgress)}/><button type="button" className="custom-button muted" onClick={()=>update(selected==='empresa'?'logoDataUrl':'planDocumentSignatureDataUrl','')}>{selected==='empresa'?'Remover logotipo':'Remover assinatura'}</button></div>{selected==='tecnico'&&<><p className="custom-signature-note">Assinatura padrão da conta. A assinatura do proprietário é anexada em cada documento.</p><SignaturePadControl label="Desenhar assinatura na tela" onApply={dataUrl=>update('planDocumentSignatureDataUrl',dataUrl)}/></>}</SettingGroup></>}
    {selected==='memorial'&&<><SettingGroup title="Modelo do Memorial Descritivo"><div className="custom-model-gallery">{selectableModels.map(model=><button className={`custom-template ${selectedModel===model.id?'active':''}`} type="button" key={model.id} onClick={()=>updateOptions({memorialTemplateId:model.id,memorialTemplateMode:model.id==='standard'?'standard':'custom',memorialTemplateUpdatedAt:new Date().toISOString()})}>{model.image?<img src={`/admin-models/${model.image}`} alt={`Pré-visualização ${model.name}`} loading="lazy" decoding="async"/>:<div className="custom-model-blank">MEMORIAL<br/>DESCRITIVO</div>}<b>{model.name}</b><small>{model.id==='standard'?'Modelo padrão':'Modelo personalizado'}</small>{selectedModel===model.id&&<Check className="custom-selected" size={18}/>}</button>)}</div></SettingGroup><SettingGroup title="Opções do Memorial Descritivo">{[['showLogo','Mostrar logotipo da empresa'],['showMap','Incluir página de croqui / mapa'],['showVertexTable','Mostrar quadro de vértices'],['showQr','Incluir QR Code no croqui'],['useSatellite','Usar imagem de satélite no mapa']].map(([key,title])=><Toggle key={key} title={title} checked={optionValue('memorial',key,true)} change={v=>subOptions('memorial',{[key]:v})}/>)}</SettingGroup></>}
    {selected==='mapas'&&<SettingGroup title="Modelo de Mapas e Croquis"><div className="custom-model-gallery croqui">{[{id:'classic',title:'Modelo padrão Surveyor',image:''},{id:'rural-reference',title:'Planta do Imóvel Rural',image:'/admin-models/02_planta_imovel_rural.webp'}].map(m=><button type="button" key={m.id} className={`custom-template ${asText(asRecord(options.mapas).croquiTemplateId||'classic')===m.id?'active':''}`} onClick={()=>subOptions('mapas',{croquiTemplateId:m.id})}>{m.image?<img src={m.image} alt={m.title}/>:<div className="custom-model-blank">PLANTA DO IMÓVEL RURAL</div>}<b>{m.title}</b><small>{m.id==='classic'?'Modelo padrão':'Modelo alternativo'}</small>{asText(asRecord(options.mapas).croquiTemplateId||'classic')===m.id&&<Check className="custom-selected" size={18}/>}</button>)}</div></SettingGroup>}
    {(selected==='car'||selected==='loteamento')&&<SettingGroup title={selected==='car'?'Relatório do Módulo CAR':'Relatório de Loteamentos / REURB'}><div className="custom-form-grid">{[['title','Título do relatório'],['subtitle','Subtítulo / descrição']].map(([k,label])=><label className="custom-field" key={k}><span>{label}</span><input value={asText(asRecord(options[selected==='car'?'carReport':'loteamentoReport'])[k])} onChange={e=>subOptions(selected==='car'?'carReport':'loteamentoReport',{[k]:e.target.value})}/></label>)}</div><div className="custom-checkboxes">{(selected==='car'?carOptions:lotOptions).map(([key,label])=><Toggle key={key} title={label} checked={optionValue(selected==='car'?'carReport':'loteamentoReport',key,selected==='car'?!['showTechnicalNotice','showOwnerDocuments'].includes(key):true)} change={v=>subOptions(selected==='car'?'carReport':'loteamentoReport',{[key]:v})}/>)}</div></SettingGroup>}
     <div className="custom-savebar"><div><strong>{touched?'Alterações pendentes':'Tudo salvo'}</strong><span>{touched?'Salve para aplicar as alterações.':'Preferências sincronizadas com a conta.'}</span></div><button className="custom-button primary" disabled={saving||!touched} onClick={()=>void save()}><Save size={17}/>{saving?'Salvando...':'Salvar alterações'}</button></div></div></>}
  </main>
 </div>;
}
