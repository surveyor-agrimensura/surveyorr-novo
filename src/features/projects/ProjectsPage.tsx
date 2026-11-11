import {GlobalLoading} from '../../components/GlobalLoading';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, Clock3, Download, Trash2, ExternalLink, FolderKanban, Database, Map, MapPin, Plus, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { createProject, formatBytes, getProject, listProjects, projectTitle, storageStatus, type Project, type ProjectFull, type StorageStatus } from './projectsApi';
import {toKml,toCsv,type Geodata} from '../map/mapFormats';
import {trashProject} from './projectsApi';
import { ProjectMiniMap } from './ProjectMiniMap';
import { STORE_URL } from '../../lib/config';
import { ProjectListSkeleton } from './ProjectListSkeleton';
import { Pagination } from '../../components/Pagination';
import { Dialog } from '../../components/Dialog';

function formatDate(value?:string){if(!value)return 'Sem data'; const d=new Date(value);return Number.isNaN(d.getTime())?'Sem data':d.toLocaleString('pt-BR');}
function formatArea(value?:number){return typeof value==='number'&&value>0?`${value.toLocaleString('pt-BR',{maximumFractionDigits:4})} ha`:'Área não informada';}
export function ProjectsPage(){
 const navigate=useNavigate();
 const {session}=useAuth();const notify=useToast();
 const [projects,setProjects]=useState<Project[]>([]);const [storage,setStorage]=useState<StorageStatus|null>(null);
 const [loading,setLoading]=useState(true); const [storageError,setStorageError]=useState('');const [error,setError]=useState('');
 const [search,setSearch]=useState('');const [sort,setSort]=useState('newest');
 const [page,setPage]=useState(1); const [pageSize,setPageSize]=useState(25);
 const [expanded,setExpanded]=useState<string|null>(null);const [full,setFull]=useState<Record<string,ProjectFull>>({}); const [fetching,setFetching]=useState<string|null>(null);
 const [formatMenu,setFormatMenu]=useState<string|null>(null);const [deleting,setDeleting]=useState<string|null>(null);const [creating,setCreating]=useState(false);const [saving,setSaving]=useState(false);
 const [pendingDeletion,setPendingDeletion]=useState<Project|null>(null);
 const [draft,setDraft]=useState({name:'',ownerName:'',municipality:'',stateCode:'BA'});
 const teamMember=Boolean(session?.user?.isSubuser&&session.user.workspaceOwnerUserId);
 const load=useCallback(async(force=false)=>{
  if(!session)return;
  setLoading(true);setError('');setStorageError('');
  const [list,space]=await Promise.allSettled([listProjects(session,force),storageStatus(session,force)]);
  if(list.status==='fulfilled')setProjects(list.value);else setError(list.reason instanceof Error?list.reason.message:'Falha ao carregar projetos.');
  if(space.status==='fulfilled')setStorage(space.value);else{setStorage(null);setStorageError('Não foi possível consultar o armazenamento.');}
  setLoading(false);
 },[session]);
 useEffect(()=>{void load();},[load]);
 const filtered=useMemo(()=>{
  const term=search.trim().toLocaleLowerCase('pt-BR');
  const arr=projects.filter(p=>[projectTitle(p),p.ownerName,p.municipality,p.stateCode,p.createdByName].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(term)));
  arr.sort((a,b)=>sort==='title'?projectTitle(a).localeCompare(projectTitle(b),'pt-BR'):sort==='oldest'?new Date(a.updatedAt||a.createdAt||0).getTime()-new Date(b.updatedAt||b.createdAt||0).getTime():new Date(b.updatedAt||b.createdAt||0).getTime()-new Date(a.updatedAt||a.createdAt||0).getTime());
  return arr;
 },[projects,search,sort]);
 useEffect(()=>{setPage(1);},[search,sort]);
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const currentPage=Math.max(1,Math.min(page,pages));
 useEffect(()=>{if(page!==currentPage)setPage(currentPage);},[page,currentPage]);
 const visibleProjects=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
 const used=Number(storage?.usedBytes||0),limit=storage?.limitBytes==null?null:Number(storage.limitBytes);
 const percentage=limit&&limit>0?Math.min(100,Math.max(0,used/limit*100)):0;
 async function toggle(p:Project){
  const next=expanded===p.id?null:p.id;setExpanded(next);
  if(!session||!next||full[next])return;
  setFetching(next);
  try{const data=await getProject(session,next);setFull(old=>({...old,[next]:data}));}
  catch(e){notify.error(`Não foi possível carregar a miniatura: ${e instanceof Error?e.message:'erro de conexão'}`);}
  finally{setFetching(id=>id===next?null:id);}
 }
 async function submit(e:FormEvent){
  e.preventDefault();if(!session||!draft.name.trim())return;
  setSaving(true);
  try{
   const created=await createProject(session,{name:draft.name.trim(),propertyName:draft.name.trim(),ownerName:draft.ownerName.trim(),municipality:draft.municipality.trim(),stateCode:draft.stateCode.trim().toUpperCase()||'BA'});
   setProjects(old=>[created,...old]);setCreating(false);setDraft({name:'',ownerName:'',municipality:'',stateCode:'BA'});notify.success('Projeto criado na nuvem.');
   void load(true);
  }catch(error){notify.error(error instanceof Error?error.message:'Não foi possível criar o projeto.');}
  finally{setSaving(false);}
 }
 function downloadFormat(p:Project,format:'geojson'|'kml'|'csv'){
  const loaded=full[p.id];if(!loaded){notify.info('Abra o projeto para carregar os dados antes de baixar.');return;}
  const features:Geodata[]=loaded.features.filter(f=>f.geoJson||f.geometry).map((f,i)=>({type:'Feature',id:f.id||String(i),geometry:(f.geoJson||f.geometry) as Geodata['geometry'],properties:{...f.properties,name:f.name||f.properties?.name||''}}));
  if(!features.length){notify.warning('Este projeto não possui geometrias exportáveis.');return;}
  const slug=projectTitle(p).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w-]+/g,'-');
  const contents=format==='geojson'?JSON.stringify({type:'FeatureCollection',features},null,2):format==='kml'?toKml(features):toCsv(features);
  const mime=format==='geojson'?'application/geo+json':format==='kml'?'application/vnd.google-earth.kml+xml':'text/csv;charset=utf-8';
  const blob=new Blob([contents],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${slug}.${format==='geojson'?'geojson':format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);setFormatMenu(null);
 }
 async function deleteItem(p:Project){
  if(!session||deleting)return;
  setDeleting(p.id);
  try{await trashProject(session,p.id);setProjects(old=>old.filter(item=>item.id!==p.id));setExpanded(v=>v===p.id?null:v);notify.success('Projeto enviado para a lixeira.');}
  catch(err){notify.error(err instanceof Error?err.message:'Não foi possível excluir o projeto.');}
  finally{setDeleting(null);}
 }

 return <main className="workspace-main projects-page"><GlobalLoading active={loading} /><div className="workspace-container projects-container">
  <div className="page-heading project-page-heading"><span className="heading-icon"><FolderKanban size={23}/></span><div><h1>Projetos</h1><p>Gerencie e retome seus trabalhos de campo.</p></div></div>{teamMember&&<p role="status" className="project-team-info">Projetos do espaço compartilhado da equipe. O acesso depende das permissões da sua conta; os projetos pertencem ao titular do espaço.</p>}
  <div className="project-stats">
   <section className="stat-card project-stat-card project-stat-storage"><div className="project-stat-content"><span className="project-stat-icon"><Database size={18}/></span><div className="project-stat-copy"><span className="stat-label">Armazenamento da conta/equipe</span>
    <strong>{storageError?'Indisponível':storage?`${formatBytes(used)}${limit!==null?` de ${formatBytes(limit)}`:' usados'}`:loading?'Carregando...':'Indisponível'}</strong>
    <small>{storageError||(!storage?loading?'Consultando espaço disponível...':'Sem dados de armazenamento':limit!==null?`${formatBytes(Math.max(0,limit-used))} disponíveis`:'Armazenamento sem limite informado')}</small></div></div>
    <div className="storage-track" role="progressbar" aria-label="Espaço usado" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${percentage}%`}}/></div>
    <a className="small-action" href={STORE_URL} target="_blank" rel="noopener noreferrer">Comprar armazenamento <ExternalLink size={12}/></a>
   </section>
   <section className="stat-card project-stat-card"><div className="project-stat-content"><span className="project-stat-icon"><FolderKanban size={18}/></span><div className="project-stat-copy"><span className="stat-label">Projetos na conta/equipe</span><strong>{error?'Indisponível':loading?'…':projects.length}</strong><small>{error||'Trabalhos armazenados na nuvem'}</small></div></div></section>
  </div>
  <div className="projects-toolbar"><label className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Pesquisar projetos" placeholder="Pesquisar projeto, proprietário ou município..."/></label>
   <div className="toolbar-actions"><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Ordenar projetos"><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option><option value="title">Nome (A a Z)</option></select><button type="button" className="icon-refresh" aria-label="Atualizar projetos" title="Atualizar projetos" onClick={()=>void load(true)} disabled={loading}><RefreshCw size={17}/></button><button className="button primary create-project" type="button" onClick={()=>setCreating(true)}><Plus size={19}/> Novo projeto</button></div>
  </div>
  {error&&<div className="page-error" role="alert">{error} <button onClick={()=>void load(true)}>Tentar novamente</button></div>}
  <div className="projects-list" aria-live="polite">{loading?<ProjectListSkeleton rows={4}/>:!error&&filtered.length===0?<div className="empty-state"><FolderKanban size={30}/><strong>{search?'Nenhum projeto encontrado':'Nenhum projeto armazenado'}</strong><small>{search?'Tente outros termos de pesquisa.':'Crie um projeto para começar.'}</small></div>:visibleProjects.map(p=>{
   const isOpen=expanded===p.id;
   return <article className="project-item" key={p.id}><button className="project-item-head" type="button" aria-expanded={isOpen} onClick={()=>void toggle(p)}>
     <span className="project-item-name"><strong>{projectTitle(p)}</strong><small>{p.ownerName||p.owner||'Proprietário não informado'}</small><small>Feito por: <b>{p.createdByName||'Autor não informado'}</b></small></span>
     <span className="project-metadata"><span><MapPin size={13}/>{[p.municipality||p.city||'Município não informado',p.stateCode||p.uf||''].filter(Boolean).join('/')}</span><span><Map size={13}/>{formatArea(p.areaHa)}</span><span><Clock3 size={13}/>{formatDate(p.updatedAt||p.createdAt)}</span></span>
     <span className="expand-name">{isOpen?'Ocultar miniatura':'Exibir miniatura'}{isOpen?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</span>
    </button>{isOpen&&<div className="project-item-body"><ProjectMiniMap summary={p} full={full[p.id]} loading={fetching===p.id}/><div className="project-body-side"><div><strong>Miniatura do projeto</strong><p>{fetching===p.id?'Carregando dados espaciais...':'Visualização por imagem de satélite e perímetro quando disponíveis.'}</p></div><div className="project-body-actions"><button type="button" className="small-action open-map" onClick={()=>navigate(`/mapa/trabalho/?project=${encodeURIComponent(p.id)}`)}><Map size={16}/> Abrir no mapa</button><div className="project-download-wrap"><button className="small-action" type="button" aria-expanded={formatMenu===p.id} onClick={()=>setFormatMenu(id=>id===p.id?null:p.id)}><Download size={16}/> Download <ChevronDown size={14}/></button>{formatMenu===p.id&&<div className="project-download-options">{(['geojson','kml','csv'] as const).map(format=><button type="button" key={format} onClick={()=>downloadFormat(p,format)}>{format.toUpperCase()}</button>)}</div>}</div><button type="button" className="small-action project-trash" disabled={deleting===p.id} title="Enviar para lixeira" onClick={()=>setPendingDeletion(p)}><Trash2 size={16}/> {deleting===p.id?'Excluindo…':'Excluir'}</button></div></div></div>}</article>;
  })}</div>
  {!loading&&!error&&filtered.length>0&&<Pagination page={currentPage} pageSize={pageSize} totalItems={filtered.length} label="projetos" onPageChange={setPage} onPageSizeChange={(size)=>{setPageSize(size);setPage(1);}}/>}
 </div>
  {pendingDeletion&&<Dialog title="Enviar projeto para a lixeira" onClose={()=>setPendingDeletion(null)} className="project-modal" footer={<><button className="button outline" type="button" onClick={()=>setPendingDeletion(null)}>Cancelar</button><button className="button primary" type="button" onClick={()=>{const project=pendingDeletion;setPendingDeletion(null);void deleteItem(project);}}>Enviar para a lixeira</button></>}><p>O projeto <strong>{projectTitle(pendingDeletion)}</strong> será enviado para a lixeira da conta. A ação afeta o espaço compartilhado e exige permissão.</p></Dialog>}
  {creating&&<Dialog title="Novo projeto" description="Depois de criar, abra o projeto no mapa para desenhar, importar e editar o perímetro." onClose={()=>{if(!saving)setCreating(false);}} closeOnEscape={!saving} className="project-modal" footer={<><button className="button outline" type="button" disabled={saving} onClick={()=>setCreating(false)}>Cancelar</button><button className="button primary" type="submit" form="new-project-form" disabled={saving||!draft.name.trim()}>{saving?'Salvando...':'Criar projeto'}</button></>}>
   <form id="new-project-form" onSubmit={e=>void submit(e)} className="modal-form"><label>Nome do projeto *<input autoFocus value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required maxLength={120} placeholder="Ex.: Fazenda Boa Vista"/></label><label>Proprietário<input value={draft.ownerName} onChange={e=>setDraft({...draft,ownerName:e.target.value})} maxLength={120} placeholder="Nome do proprietário"/></label><div className="modal-row"><label>Município<input value={draft.municipality} onChange={e=>setDraft({...draft,municipality:e.target.value})} maxLength={90}/></label><label>UF<input value={draft.stateCode} onChange={e=>setDraft({...draft,stateCode:e.target.value.toUpperCase()})} maxLength={2}/></label></div></form>
  </Dialog>}
 </main>;
}
