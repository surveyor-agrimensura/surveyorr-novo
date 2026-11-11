import {measureMapGeometry} from './geometryMetrics';
import {maskBrazilianDocumentInput,formatBrazilianRg} from '../../lib/documentIdentity';
import {useEffect,useMemo,useRef,useState,type ReactNode,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown, ChevronRight, ExternalLink, FolderOpen, Layers3, MapPin, Plus, Search, X, Eye, EyeOff, Lock, LockOpen, Scissors, Pencil} from 'lucide-react';
import type {Feature,Geometry,GeoJsonProperties} from 'geojson';
import {LayerIndexDownload} from './LayerIndexDownload';
import { checkApiHealth } from '../../lib/api';
import {checkSaveFunctionHealth} from '../../lib/saveApi';
import {FileUploadField} from '../../components/FileUploadField';
import { readConfrontation, neighborText } from '../croqui/croquiGeometry';
import type { NeighborDetails } from '../memorial/croquiRenderer';
import * as L from 'leaflet';
import {getStates,STATES,featureCode} from './geoData';
import type {OfficialLayer} from './geoServices';
import {GEO_GROUPS,layersForUF,officialLayerLegendUrl} from './geoServices';
import {toggleSelectedLayer} from './layerCatalogSelection';
import {Dialog} from '../../components/Dialog';
export type MapFeature=Feature<Geometry,GeoJsonProperties>;
export type Issue={title:string;description:string;critical:boolean;action:()=>void};
export type Panel='project'|'layers'|null;
export type Modal='catalog'|'import'|'verify'|null;
export type MapProjectData={name:string;owner:string;cpf:string;rg:string;owner2:string;additionalOwners?:{name:string;cpf:string;rg:string}[];city:string;uf:string;description:string};
export const baseProject=(city:string,uf:string):MapProjectData=>({name:'',owner:'',cpf:'',rg:'',owner2:'',additionalOwners:[],city,uf,description:''});
const blankConfrontant=():NeighborDetails=>({property:'',owner:'',cpf:'',rg:'',showProperty:true,showOwner:false,showCpf:false,showRg:false});
const UF_LIST=[['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins']];
export type ActiveLayer=OfficialLayer & {visible:boolean;opacity:number;state:'carregando'|'ativa'|'erro'};
function Card({title,children}: {title:string;children:ReactNode}){return <section className="map-work-card"><strong className="map-card-label">{title}</strong>{children}</section>;}
export function WorkSidebar({panel,municipalityState,saveError,onBackupDraft,onClose,onCatalog,project,onProjectChange,onSave,cloudPending,activeLayers,onToggleLayer,onRemoveLayer,onOpacityLayer,onRefreshLayer,features,onStyleFeature,onEditGeometry,onDivideFeature,onRenameFeature,onConfrontantFeature,onConfrontantDetailFeature,selectedFeature,onRemoveFeature}: {
 panel:Panel;municipalityState?:'idle'|'checking'|'confirmed'|'manual';saveError?:string;onBackupDraft:()=>void;onClose:()=>void;onCatalog:()=>void;project:MapProjectData;onProjectChange:(v:MapProjectData)=>void;onSave:()=>void;cloudPending:boolean;activeLayers:ActiveLayer[];onToggleLayer:(id:string)=>void;onRemoveLayer:(id:string)=>void;onOpacityLayer:(id:string,n:number)=>void;onRefreshLayer:(id:string)=>void;features:MapFeature[];onStyleFeature:(id:string,style:Record<string,string|number|boolean>)=>void;onEditGeometry:(id:string)=>void;onDivideFeature:(id:string)=>void;onRenameFeature:(id:string,name:string)=>void;onConfrontantFeature:(id:string,items:Record<string,string>)=>void;onConfrontantDetailFeature:(id:string,items:Record<string,NeighborDetails>)=>void;selectedFeature:string|null;onRemoveFeature:(id:string)=>void;
}){
 const [checkingApi,setCheckingApi]=useState(false);
 const [apiResult,setApiResult]=useState('');
 const [removeFeature,setRemoveFeature]=useState<{id:string;name:string}|null>(null);
 const [municipalIndexOpen,setMunicipalIndexOpen]=useState(false);const [detailsLayer,setDetailsLayer]=useState<ActiveLayer|null>(null);const [expandedDrawing,setExpandedDrawing]=useState<string|null>(null);const [entryTab,setEntryTab]=useState<'description'|'edit'>('description');const [neighborDialog,setNeighborDialog]=useState<{featureId:string;index:number;until:number}|null>(null);const [neighborDraft,setNeighborDraft]=useState<NeighborDetails>(blankConfrontant);
 useEffect(()=>{if(panel==='layers'&&selectedFeature){setExpandedDrawing(selectedFeature);setEntryTab('edit');}},[panel,selectedFeature]);
 useEffect(()=>{if(panel!=='layers'||!selectedFeature)return;const id=requestAnimationFrame(()=>document.querySelector('.map-work-sidebar .map-feature-selected')?.scrollIntoView({block:'nearest',behavior:'smooth'}));return()=>cancelAnimationFrame(id);},[panel,selectedFeature,expandedDrawing]);
 if(!panel)return null;
 const set=(k:keyof MapProjectData,v:string)=>onProjectChange({...project,[k]:v});
 return <aside className="map-work-sidebar" aria-label={panel==='project'?'Dados do projeto':'Camadas do mapa'}>
  <header className="map-sidebar-title"><span className="map-sidebar-title-icon">{panel==='project'?<FolderOpen size={20}/>:<Layers3 size={20}/>}</span><strong>{panel==='project'?'Projeto':'Camadas'}</strong>{panel==='layers'&&<button onClick={onCatalog} title="Adicionar camadas"><Plus size={19}/></button>}<button aria-label="Fechar painel" onClick={onClose}><X size={18}/></button></header>
  <div className="map-work-scroll">
   {panel==='project'?<Card title="Dados do projeto">{saveError&&<div className="map-save-alert" role="alert"><strong>{saveError.includes('desenho em andamento')?'Desenho em andamento':'Salvamento não confirmado na nuvem'}</strong><p>{saveError}</p>{saveError.includes('desenho em andamento')?<small>Finalize o desenho no mapa ou pressione Esc para cancelá-lo; depois, salve novamente.</small>:<><small>Se necessário, exporte seu desenho em GeoJSON e verifique o endereço da API.</small><div className="map-save-recovery"><button type="button" disabled={checkingApi} onClick={()=>{setCheckingApi(true);void Promise.all([checkApiHealth(),checkSaveFunctionHealth()]).then(([api,save])=>setApiResult(`${api} | ${save}`)).finally(()=>setCheckingApi(false));}}>{checkingApi?'Verificando API…':'Testar API e Function Save'}</button><button type="button" onClick={onBackupDraft}>Baixar GeoJSON</button></div>{apiResult&&<p role="status" className="map-api-result">{apiResult}</p>}</>}</div>}<form onSubmit={e=>{e.preventDefault();onSave();}} className="map-project-form">
    <label>Nome do projeto <b>*</b><input required value={project.name} onChange={e=>set('name',e.target.value)} placeholder="Ex.: Levantamento Fazenda Boa Esperança" /></label>
    <label>Proprietário/possuidor<input value={project.owner} onChange={e=>set('owner',e.target.value)} placeholder="Nome completo" /></label>
    <div className="map-field-row"><label>CPF (opcional)<input value={project.cpf} onChange={e=>set('cpf',maskBrazilianDocumentInput(e.target.value))} placeholder="000.000.000-00" /></label><label>RG (opcional)<input value={project.rg} onChange={e=>set('rg',formatBrazilianRg(e.target.value))} placeholder="Número" /></label></div>
    <div className="map-extra-owners"><button type="button" className="map-add-owner" onClick={()=>onProjectChange({...project,additionalOwners:[...(project.additionalOwners||[]),{name:'',cpf:'',rg:''}]})}><Plus size={16}/> + Proprietário</button>{(project.additionalOwners?.length?project.additionalOwners:project.owner2?[{name:project.owner2,cpf:'',rg:''}]:[]).map((person,i)=><section key={i} className="map-extra-owner"><div className="map-owner-heading"><strong>Proprietário {i+2}</strong><button type="button" onClick={()=>onProjectChange({...project,owner2:'',additionalOwners:(project.additionalOwners||[{name:project.owner2,cpf:'',rg:''}]).filter((_,j)=>i!==j)})}>Remover</button></div><label>Nome completo<input value={person.name} onChange={e=>{const people=[...(project.additionalOwners||[{name:project.owner2,cpf:'',rg:''}])];people[i]={...people[i],name:e.target.value};onProjectChange({...project,owner2:people[0]?.name||'',additionalOwners:people});}} placeholder="Nome do proprietário"/></label><div className="map-field-row">{(['cpf','rg'] as const).map(field=><label key={field}>{field.toUpperCase()} (opcional)<input value={person[field]} placeholder={field==='cpf'?'000.000.000-00':'Número'} onChange={e=>{const people=[...(project.additionalOwners||[{name:project.owner2,cpf:'',rg:''}])];people[i]={...people[i],[field]:field==='cpf'?maskBrazilianDocumentInput(e.target.value):formatBrazilianRg(e.target.value)};onProjectChange({...project,additionalOwners:people});}}/></label>)}</div></section>)}</div>
    {municipalityState==='checking'&&<p className="map-save-info" role="status">Identificando o município pelo perímetro…</p>}{municipalityState==='manual'&&<p className="map-save-info" role="status">Não foi possível confirmar o município automaticamente. Confira o valor antes de salvar.</p>}<div className="map-field-row"><label>Município<input value={project.city} onChange={e=>set('city',e.target.value)}/></label><label>UF<select value={project.uf} onChange={e=>set('uf',e.target.value)}>{UF_LIST.map(([uf])=><option key={uf}>{uf}</option>)}</select></label></div>
    <label>Descrição (opcional)<textarea rows={3} value={project.description} onChange={e=>set('description',e.target.value)} placeholder="Levantamento para regularização..." /></label>
    <button type="submit" className="map-primary" disabled={cloudPending}>{cloudPending?'Salvando na nuvem…':'Salvar projeto'}</button>
   </form></Card>:<>
   <Card title={`Camadas do projeto · ${activeLayers.length}`}>
    <div className="map-layer-global-actions"><button type="button" disabled={project.uf.toUpperCase()!=='BA'} title={project.uf.toUpperCase()==='BA'?'Guardar o índice municipal de imóveis rurais da Bahia no navegador':'Índice municipal disponível apenas para projetos da Bahia'} onClick={()=>setMunicipalIndexOpen(true)}>Guardar índice no navegador · Bahia</button></div>
    {activeLayers.length?activeLayers.map(layer=><div className="map-layer-card" key={layer.id}>
     <div className="map-layer-heading"><span className="map-layer-dot" style={{background:layer.color||'#d5b600'}}/><strong>{layer.name}</strong><button title={layer.visible?'Ocultar':'Exibir'} onClick={()=>onToggleLayer(layer.id)}>{layer.visible?'◉':'○'}</button></div>
     <p>{layer.source} · {layer.uf||'Brasil'} · <em>{layer.state==='erro'?'Serviço não respondeu':layer.state==='carregando'?'Carregando tiles':'Visível'}</em></p>
     <div className="map-layer-actions"><button type="button" title={`Informações de ${layer.name}`} onClick={()=>setDetailsLayer(layer)}>Informações</button><button type="button" disabled={!layer.visible||layer.state==='carregando'} title={!layer.visible?'Ative a camada para atualizar':layer.state==='carregando'?'A camada já está carregando':'Solicitar novos tiles ao serviço'} onClick={()=>onRefreshLayer(layer.id)}>Atualizar agora</button><button type="button" onClick={()=>onRemoveLayer(layer.id)}>Remover</button></div>
     <label className="map-opacity">Transparência <input aria-label={`Opacidade de ${layer.name}`} type="range" min="0" max="100" value={layer.opacity} onChange={e=>onOpacityLayer(layer.id,Number(e.target.value))}/><span>{layer.opacity}%</span></label>
    </div>):null}
   </Card>
   <Card title={`Desenhos editáveis · ${features.length}`}>
    {features.length?features.map((f,i)=>{const id=String(f.id??i),opened=expandedDrawing===id,ring=f.geometry.type==='Polygon'?f.geometry.coordinates[0]:null,poly=f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon',divisible=f.geometry.type==='Polygon'&&f.geometry.coordinates.length===1;const measurement=poly?measureMapGeometry(f.geometry):null;return <div className="map-editable-entry" key={id}>
    <button className={`map-feature-item ${selectedFeature===id?'map-feature-selected':''}`} aria-expanded={opened} onClick={()=>{setExpandedDrawing(opened?null:id);setEntryTab('description');}}><span>{f.geometry.type==='Point'?'📍':poly?'▱':'⌁'}</span> {String(f.properties?.name||`Feição ${i+1}`)} <ChevronRight className={opened?'map-entry-chevron-open':''} size={15}/></button>
    {opened&&<div className="map-entry-detail"><div className="map-feature-tabs"><button className={entryTab==='description'?'active':''} type="button" onClick={()=>setEntryTab('description')}>Descrição</button><button className={entryTab==='edit'?'active':''} type="button" onClick={()=>setEntryTab('edit')}>Editar</button></div>{entryTab==='edit'?<>
     {Boolean(f.properties?.confrontantRevisaoPendente)&&<div className="map-save-alert" role="alert"><strong>Confrontantes precisam de revisão</strong><p>Dois trechos com cadastros diferentes foram unidos ao remover um vértice. Confira o novo limite e os confrontantes antes de gerar documentos.</p><button type="button" onClick={()=>onStyleFeature(id,{confrontantRevisaoPendente:false})}>Conferi os confrontantes</button></div>}<div className="map-feature-edit-tools"><button className="map-feature-remove" type="button" onClick={()=>setRemoveFeature({id,name:String(f.properties?.name||`Feição ${i+1}`)})}><X size={13}/>Excluir desenho</button><button onClick={()=>onEditGeometry(id)} disabled={Boolean(f.properties?.locked)}><Pencil size={13}/>Editar geometria</button><button onClick={()=>onStyleFeature(id,{hidden:!Boolean(f.properties?.hidden)})}>{f.properties?.hidden?<Eye size={13}/>:<EyeOff size={13}/>} {f.properties?.hidden?'Exibir':'Ocultar'}</button>{divisible&&<button onClick={()=>onDivideFeature(id)} disabled={Boolean(f.properties?.locked)}><Scissors size={13}/>Dividir</button>}<button onClick={()=>onStyleFeature(id,{locked:!Boolean(f.properties?.locked)})}>{f.properties?.locked?<Lock size={13}/>:<LockOpen size={13}/>} {f.properties?.locked?'Desbloquear':'Bloquear'}</button></div>
     <div className="map-feature-style-box"><label>Cor da linha <input type="color" aria-label="Cor da linha da feição" value={String(f.properties?.strokeColor||f.properties?.lotColor||'#e9a405')} onChange={e=>onStyleFeature(id,{strokeColor:e.target.value})}/></label>{poly&&<label>Cor interna<input type="color" aria-label="Cor interna da feição" value={String(f.properties?.fillColor||f.properties?.lotColor||'#e9a405')} onChange={e=>onStyleFeature(id,{fillColor:e.target.value})}/></label>}<label>Transparência<input type="range" min="0" max="100" aria-label="Transparência da feição" value={Math.round(Number(f.properties?.fillOpacity??.2)*100)} onChange={e=>onStyleFeature(id,{fillOpacity:Number(e.target.value)/100})}/><output>{Math.round(Number(f.properties?.fillOpacity??.2)*100)}%</output></label><label>Espessura<input type="range" min="1" max="8" step="0.5" aria-label="Espessura da feição" value={Number(f.properties?.lineWeight??3)} onChange={e=>onStyleFeature(id,{lineWeight:Number(e.target.value)})}/><output>{Number(f.properties?.lineWeight??3).toFixed(1)}px</output></label></div>
     <label className="map-entry-edit-name">Nome<input defaultValue={String(f.properties?.name||'')} key={`name-${id}`} onBlur={e=>onRenameFeature(id,e.target.value)} /></label>
     {f.geometry.type==='Point'&&f.properties?.pointOrigin==='importado'&&<label className="map-point-classification">Classificação do ponto<select value={String(f.properties?.pointClass||'P')} onChange={e=>onStyleFeature(id,{pointClass:e.target.value,hasMonument:e.target.value==='P+MARCO'})}><option value="P">P · ponto</option><option value="P+MARCO">P + marco</option></select></label>}
     {ring&&<section className="map-confrontants"><h4>Confrontantes por trecho</h4>{ring?.slice(0,-1).map((_,j,arr)=>{const n=arr.length;const k=`${Math.min(j,(j+1)%n)}-${Math.max(j,(j+1)%n)}`;const values=(f.properties?.confrontants as Record<string,string>||{});const detail=f.properties?.confrontantDetails as Record<string,NeighborDetails>|undefined;const val=readConfrontation(f.properties||{},j,n);return <div className="map-confrontant-edit-row" key={j}><label>V-{String(j+1).padStart(2,'0')} a V-{String((j+1)%n+1).padStart(2,'0')}</label><input value={val} placeholder="Nome do confrontante" onChange={e=>onConfrontantFeature(id,{...values,[k]:e.target.value})}/><button type="button" title="Completar cadastro do confrontante" onClick={()=>{setNeighborDialog({featureId:id,index:j,until:(j+1)%n});setNeighborDraft({...blankConfrontant(),...detail?.[String(j)],property:detail?.[String(j)]?.property||neighborText(val)});}}>⋯</button></div>;})}</section>}

     </>:<><div className="map-entry-name"><i style={{background:String(f.properties?.lotColor||'#e4aa0f')}}/>{String(f.properties?.name||`Feição ${i+1}`)}</div><small>{poly?`Perímetro cadastrado · ${((measurement?.areaM2||0)/10000).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4})} ha`:`${f.geometry.type==='Point'?'Ponto':'Desenho'} editável`}</small><div className="map-entry-actions">{ring&&<button onClick={()=>{setExpandedDrawing(id);setEntryTab('edit');}}>Confrontantes</button>}</div></>}</div>}
   </div>;}):<p className="map-empty">Nenhum desenho criado.</p>}
   </Card>
   </>}
  </div>
  {municipalIndexOpen&&<LayerIndexDownload uf={project.uf} onClose={()=>setMunicipalIndexOpen(false)}/>}
  {detailsLayer&&<OfficialLayerDetailsDialog layer={detailsLayer} onClose={()=>setDetailsLayer(null)}/>}
  {neighborDialog&&<div className="map-neighbor-modal-backdrop"><section className="map-neighbor-modal" role="dialog" aria-modal="true" aria-label="Cadastro do confrontante"><header><strong>Cadastro do confrontante</strong><button onClick={()=>setNeighborDialog(null)} aria-label="Fechar"><X size={16}/></button></header><label>Confrontação até o vértice<select value={neighborDialog.until} onChange={e=>setNeighborDialog({...neighborDialog,until:Number(e.target.value)})}>{(()=>{const f=features.find(x=>String(x.id)===neighborDialog.featureId),count=f?.geometry.type==='Polygon'?f.geometry.coordinates[0].length-1:0;return Array.from({length:count},(_,i)=><option key={i} value={i} disabled={i===neighborDialog.index}>{`V-${String(i+1).padStart(2,'0')}`}</option>);})()}</select></label>{([['property','Propriedade','showProperty'],['owner','Proprietário','showOwner'],['cpf','CPF/CNPJ','showCpf'],['rg','RG','showRg']] as const).map(([key,label,flag])=><div key={key} className="map-neighbor-field"><label>{label}<input value={neighborDraft[key]} onChange={e=>setNeighborDraft(p=>({...p,[key]:e.target.value}))}/></label><label className="map-neighbor-display"><input type="checkbox" checked={neighborDraft[flag]} onChange={e=>setNeighborDraft(p=>({...p,[flag]:e.target.checked}))}/>Exibir</label></div>)}<label>Tipo do limite<input placeholder="Ex.: cerca, estrada, rio, marco" value={neighborDraft.limitType||''} onChange={e=>setNeighborDraft(p=>({...p,limitType:e.target.value}))}/></label><footer><button type="button" onClick={()=>setNeighborDialog(null)}>Cancelar</button><button className="map-primary" onClick={()=>{const f=features.find(x=>String(x.id)===neighborDialog.featureId);if(f?.geometry.type!=='Polygon')return;const count=f.geometry.coordinates[0].length-1;const labels={...(f.properties?.confrontants as Record<string,string>||{})};const details={...(f.properties?.confrontantDetails as Record<string,NeighborDetails>||{})};const output=([['property','showProperty'],['owner','showOwner'],['cpf','showCpf'],['rg','showRg']] as const).filter(([key,flag])=>neighborDraft[flag]&&neighborDraft[key].trim()).map(([key])=>neighborDraft[key].trim()).join(' · ');for(let i=neighborDialog.index,safety=0;i!==neighborDialog.until&&safety<count;i=(i+1)%count,safety++){const k=`${Math.min(i,(i+1)%count)}-${Math.max(i,(i+1)%count)}`;labels[k]=output;details[String(i)]={...neighborDraft};}onConfrontantFeature(neighborDialog.featureId,labels);onConfrontantDetailFeature(neighborDialog.featureId,details);setNeighborDialog(null);}}>Aplicar cadastro</button></footer></section></div>}
   {removeFeature&&<Dialog title="Excluir desenho?" description={`O desenho “${removeFeature.name}” será removido do projeto.`} onClose={()=>setRemoveFeature(null)} closeOnBackdrop={false} footer={<><button type="button" className="map-confirm-cancel" onClick={()=>setRemoveFeature(null)}>Cancelar</button><button type="button" className="map-confirm-delete" onClick={()=>{onRemoveFeature(removeFeature.id);setRemoveFeature(null);}}>Excluir desenho</button></>}><p>Essa alteração afeta o projeto atual.</p></Dialog>}
  </aside>;
}
function OfficialLayerDetailsDialog({layer,onClose}:{layer:ActiveLayer;onClose:()=>void}){
 useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose]);
 const status=layer.state==='erro'?'Falha de conexão':layer.state==='carregando'?'Carregando':'Ativa';
 return createPortal(<div className="map-layer-details-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="map-layer-details-dialog" role="dialog" aria-modal="true" aria-labelledby="map-layer-details-title">
  <header className="map-dialog-head"><div><strong id="map-layer-details-title">{layer.name}</strong><small>Detalhes do serviço de mapa</small></div><button type="button" aria-label="Fechar informações da camada" onClick={onClose}><X size={18}/></button></header>
  <div className="map-layer-details-content"><dl>
   <div><dt>Fonte</dt><dd>{layer.source}</dd></div><div><dt>Tipo de serviço</dt><dd>WMS · imagem cartográfica</dd></div>
   <div><dt>Identificador da camada</dt><dd><code>{layer.layers}</code></dd></div><div><dt>UF</dt><dd>{layer.uf||'Brasil'}</dd></div>
   <div><dt>Estado</dt><dd>{status}</dd></div><div><dt>Exibição</dt><dd>{layer.visible?'Visível':'Oculta'} · opacidade {layer.opacity}%</dd></div>
   <div className="map-layer-details-url"><dt>Endereço do serviço</dt><dd><a href={layer.url} target="_blank" rel="noopener noreferrer">{layer.url}<ExternalLink size={14}/></a></dd></div>
  </dl><footer className="map-layer-details-actions"><a href={layer.url} target="_blank" rel="noopener noreferrer">Abrir serviço WMS <ExternalLink size={15}/></a><button type="button" className="map-primary" onClick={onClose}>Fechar</button></footer></div>
 </section></div>,document.body);
}
function BrazilCatalogMap({selected,onSelect,hasLayers,highlightColor,expanded}:{selected:string;onSelect:(uf:string)=>void;hasLayers:boolean;highlightColor:string;expanded:boolean}){
 const el=useRef<HTMLDivElement|null>(null);const mapRef=useRef<L.Map|null>(null);const shapesRef=useRef<L.GeoJSON|null>(null);const [loaded,setLoaded]=useState(0);
 const callbackRef=useRef(onSelect);callbackRef.current=onSelect;const selectedRef=useRef(selected);selectedRef.current=selected;const highlightRef=useRef(hasLayers);highlightRef.current=hasLayers;const colorRef=useRef(highlightColor);colorRef.current=highlightColor;
 useEffect(()=>{
  const container=el.current;if(!container)return;
  let closed=false;let map:L.Map|null=null;
  const frame=requestAnimationFrame(()=>{
   if(closed||!container.isConnected)return;
   try{
    map=L.map(container,{center:[-14.25,-52.8],zoom:3,zoomControl:false,attributionControl:false,scrollWheelZoom:false,doubleClickZoom:false,dragging:false,boxZoom:false,keyboard:false,preferCanvas:true});mapRef.current=map;
    void getStates().then(collection=>{
     if(closed||!map)return;
     const group=L.geoJSON(collection,{
      style:f=>{const state=STATES.find(s=>s.id===featureCode(f?.properties as Record<string,unknown>|null));return {color:'#fff',weight:1.6,fillColor:state?.uf===selected?(hasLayers?highlightColor:'#238bda'):'#c8d3de',fillOpacity:1};},
      onEachFeature:(f,layer)=>{
       const uf=STATES.find(s=>s.id===featureCode(f.properties as Record<string,unknown>|null))?.uf||'';
       if(!uf)return;
       layer.bindTooltip(uf,{sticky:true,className:'surveyor-territorial-tooltip'});
       layer.on('mouseover',()=>{(layer as L.Path).setStyle({fillColor:'#3a9ad6'});});
       layer.on('mouseout',()=>{(layer as L.Path).setStyle({fillColor:uf===selectedRef.current?(highlightRef.current?colorRef.current:'#238bda'):'#c8d3de'});});
       layer.on('click',()=>callbackRef.current(uf));
      }
     }).addTo(map);shapesRef.current=group;
     const bounds=group.getBounds();if(bounds.isValid())map.fitBounds(bounds,{padding:[28,28],animate:false});setLoaded(n=>n+1);
     setTimeout(()=>{if(!closed)map?.invalidateSize({animate:false});},80);
    }).catch(()=>{/* Lista lateral continua funcionando sem malha */});
   }catch{/* Lista de estados é alternativa */}
  });
  return()=>{closed=true;cancelAnimationFrame(frame);if(map)map.remove();mapRef.current=null;shapesRef.current=null;};
 },[]);
 useEffect(()=>{shapesRef.current?.eachLayer(l=>{
  const layer=l as L.Path&{feature?:Feature};const uf=STATES.find(s=>s.id===featureCode(layer.feature?.properties as Record<string,unknown>|null))?.uf;
  if(uf)layer.setStyle({fillColor:uf===selected?(hasLayers?highlightColor:'#238bda'):'#c8d3de'});
 });},[selected,hasLayers,highlightColor]);
 useEffect(()=>{
  const m=mapRef.current,group=shapesRef.current;if(!m||!group)return;
  const handle=requestAnimationFrame(()=>{
   m.invalidateSize({animate:false});
   const full=group.getBounds();
   if(expanded){const selectedBounds:L.LatLngBounds[]=[];
    group.eachLayer(layer=>{const shape=layer as L.Path&{feature?:Feature;getBounds?:()=>L.LatLngBounds};
     const found=STATES.find(x=>x.id===featureCode(shape.feature?.properties as Record<string,unknown>|null));
     if(found?.uf===selected&&shape.getBounds)selectedBounds.push(shape.getBounds());
    });
    if(selectedBounds.length)m.fitBounds(selectedBounds[0],{animate:false,maxZoom:5,paddingTopLeft:[Math.round(m.getSize().x*.28),34],paddingBottomRight:[18,40]});
   }else if(full.isValid())m.fitBounds(full,{animate:false,padding:[40,40]});
  });return()=>cancelAnimationFrame(handle);
 },[expanded,selected,loaded]);
 return <div className="map-catalog-ibge-map" ref={el} title="Clique em um estado para selecionar"/>;
}
export function LayerCatalog({uf,modalOpen,onClose,onUse,existing}: {uf:string;modalOpen:boolean;onClose:()=>void;onUse:(uf:string,layers:OfficialLayer[])=>void;existing:string[]}){
 const [state,setState]=useState(uf||'BA'),[step,setStep]=useState(false),[query,setQuery]=useState(''),[ufQuery,setUfQuery]=useState(''),[expanded,setExpanded]=useState<string[]>([GEO_GROUPS[0]]),[chosen,setChosen]=useState<string[]>([]);
 const all=useMemo(()=>layersForUF(state),[state]);
 if(!modalOpen)return null;
 const toggle=(id:string)=>setChosen(current=>toggleSelectedLayer(current,id));
 const use=()=>{onUse(state,all.filter(x=>chosen.includes(x.id)));onClose();};
 return <div className="map-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className={`map-catalog-dialog ${step?'map-catalog-selected':''}`} role="dialog" aria-modal="true" aria-label="Adicionar camadas ao mapa">
   <header className="map-dialog-head"><div><strong>Adicionar camadas ao mapa</strong><small>Catálogo de fontes oficiais do SURVEYOR</small></div><button aria-label="Fechar catálogo" onClick={onClose}><X size={18}/></button></header>
   <div className="map-catalog-body"><div className="map-catalog-brazil"><BrazilCatalogMap selected={state} expanded={step} hasLayers={chosen.length>0} highlightColor={all.find(layer=>chosen.includes(layer.id))?.color||'#edc84a'} onSelect={uf=>{setState(uf);setChosen([]);setStep(true);setExpanded([GEO_GROUPS[0]]);}}/><span>Passe o mouse sobre um estado ou clique para selecionar uma UF.</span></div>
    {step&&<div className="map-catalog-groups"><h3>Camadas de {UF_LIST.find(x=>x[0]===state)?.[1]||state}</h3><div className="map-search-row"><Search size={15}/><input placeholder="Pesquisar camada" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="map-catalog-groups-scroll">{GEO_GROUPS.map(group=>{
     const matches=all.filter(x=>x.group===group&&`${x.name} ${x.source}`.toLowerCase().includes(query.toLowerCase()));if(query&&!matches.length)return null;
     return <div className="map-catalog-group" key={group}><button className="map-catalog-group-title" onClick={()=>setExpanded(xs=>xs.includes(group)?xs.filter(g=>g!==group):[...xs,group])}>{group}<ChevronDown size={15}/></button>{expanded.includes(group)&&<div className="map-catalog-options">{matches.length?matches.map(layer=><label key={layer.id} className="map-catalog-option"><span className="map-layer-legend"><i style={{background:layer.color||'#517fad'}}/><img loading="lazy" src={officialLayerLegendUrl(layer)} alt="" onError={e=>{e.currentTarget.style.display='none';}} /></span><span><b>{layer.name}</b><small>{layer.source}</small></span><input type="checkbox" checked={chosen.includes(layer.id)||existing.includes(layer.id)} disabled={existing.includes(layer.id)} onChange={()=>toggle(layer.id)}/></label>):<p className="map-empty">Não há serviço configurado para esta categoria nesta UF.</p>}</div>}</div>;
    })}</div><strong className="map-selected-count">{chosen.length} camada(s) selecionada(s)</strong></div>}
    <div className="map-catalog-uf"><div className="map-catalog-label">ESTADOS <b>{state}</b></div><h3>Escolha a UF</h3><div className="map-search-row"><Search size={15}/><input value={ufQuery} onChange={e=>setUfQuery(e.target.value)} placeholder="Buscar estado ou UF"/></div><div className="map-uf-list">{UF_LIST.filter(([code,name])=>`${code} ${name}`.toLowerCase().includes(ufQuery.toLowerCase())).map(([code,name])=><button className={state===code?'active':''} key={code} onClick={()=>{setState(code);setChosen([]);setStep(true);setExpanded([GEO_GROUPS[0]]);}}>{name}<span>{code}</span></button>)}</div><div className="map-catalog-footer"><span>Selecionado: <b>{state}</b></span>{step?<button className="map-primary" onClick={use} disabled={!chosen.length}>Usar {UF_LIST.find(x=>x[0]===state)?.[1]||state} ({chosen.length})</button>:<button className="map-primary" onClick={()=>setStep(true)}>Usar {UF_LIST.find(x=>x[0]===state)?.[1]||state}</button>}</div></div>
   </div>
  </section></div>;
}
export function PointDialog({onClose,onCreate,onPlace,onImport}: {onClose:()=>void;onCreate:(name:string,lat:number,lon:number)=>void;onPlace:()=>void;onImport:(file:File,classification:'P'|'P+MARCO')=>void|Promise<void>}){
 const [name,setName]=useState(''),[text,setText]=useState(''),[error,setError]=useState('');const [pointClass,setPointClass]=useState<'P'|'P+MARCO'>('P');
 const boxRef=useRef<HTMLDivElement|null>(null);
 const dragRef=useRef<{id:number;startX:number;startY:number;left:number;top:number}|null>(null);
 const [position,setPosition]=useState<{left:number;top:number}|null>(null);
 const beginDrag=(e:React.PointerEvent)=>{
  if(e.button!==0||(e.target as HTMLElement).closest('button,input,select,textarea'))return;
  const el=boxRef.current;if(!el)return;
  const rect=el.getBoundingClientRect();
  dragRef.current={id:e.pointerId,startX:e.clientX,startY:e.clientY,left:rect.left,top:rect.top};
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);e.preventDefault();
 };
 const moveDrag=(e:React.PointerEvent)=>{
  const d=dragRef.current,el=boxRef.current;if(!d||e.pointerId!==d.id||!el)return;
  const left=Math.max(8,Math.min(window.innerWidth-el.offsetWidth-8,d.left+e.clientX-d.startX));
  const top=Math.max(75,Math.min(window.innerHeight-el.offsetHeight-36,d.top+e.clientY-d.startY));
  setPosition({left,top});
 };
 const stopDrag=(e:React.PointerEvent)=>{if(dragRef.current?.id===e.pointerId)dragRef.current=null;};
 const submit=(e:FormEvent)=>{
  e.preventDefault();
  const values=text.trim().split(/[,;\s]+/).map(Number);
  if(values.length!==2||values.some(value=>!Number.isFinite(value))||Math.abs(values[0])>90||Math.abs(values[1])>180){setError('Informe latitude e longitude válidas, separadas por vírgula ou espaço.');return;}
  setError('');onCreate(name,values[0],values[1]);
 };
 return <div ref={boxRef} className="map-point-dialog map-point-draggable" style={position?{left:position.left,top:position.top}:undefined}>
  <div className="map-floating-edges" aria-hidden="true">{['top','bottom','left','right'].map(side=><span key={side} className={'map-grab-edge '+side} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}/>)}</div>
  <header className="map-drag-handle" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}><MapPin size={16}/><strong>Marcar pontos</strong><button type="button" onClick={onClose} aria-label="Fechar"><X size={17}/></button></header>
  <form onSubmit={submit}>
   <label>Nome do ponto<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Ponto de divisa"/></label>
   <label>Sistema de coordenadas<span className="map-point-readonly">GPS — Latitude / Longitude (WGS 84)</span></label>
   <label>Coordenadas<input value={text} onChange={e=>{setText(e.target.value);setError('');}} placeholder="Ex.: -13.0312, -39.6059" aria-invalid={Boolean(error)} aria-describedby={error?'map-point-coordinate-error':undefined}/></label>
   {error&&<p className="map-point-error" id="map-point-coordinate-error" role="alert">{error}</p>}
   <div className="map-point-actions">
    <button type="button" onClick={()=>{setError('');onPlace();}}>+ Marcar clicando no mapa</button>
    <label>Classificação dos pontos importados<select value={pointClass} onChange={e=>setPointClass(e.target.value as 'P'|'P+MARCO')}><option value="P">P · ponto</option><option value="P+MARCO">P + marco</option></select></label>
    <FileUploadField className="map-point-file" label="Importar pontos (XLSX, CSV, TXT ou GeoJSON)" accept=".xlsx,.csv,.txt,.geojson,.json" maxBytes={12*1024*1024} description="Coordenadas WGS84; até 12 MB." onFile={file=>onImport(file,pointClass)}/>
    <button type="submit" className="map-primary">Salvar ponto</button>
   </div>
  </form>
 </div>;
}
export function ValidationDialog({issues,onClose}: {issues:Issue[];onClose:()=>void}){
 const errors=issues.filter(x=>x.critical).length,alerts=issues.length-errors;
 return <div className="map-modal-backdrop"><section role="dialog" aria-modal="true" className="map-validation-dialog"><header className="map-dialog-head"><div><strong>✓ Verificar Projeto</strong><small>Checklist técnico antes da exportação</small></div><button onClick={onClose} aria-label="Fechar"><X size={17}/></button></header><div className="map-validation-score"><span>{issues.length?'PROJETO REQUER REVISÃO':'NENHUMA PENDÊNCIA BÁSICA'}<small>{errors} erros · {alerts} alertas</small></span><b>{Math.max(0,100-errors*18-alerts*7)}<small>/100</small></b></div><div className="map-validation-summary"><span>❌ {errors} erros</span><span>⚠ {alerts} alertas</span><span>✓ {issues.length?0:1} itens válidos</span></div><h4>Verificações do projeto</h4><div className="map-validation-list">{issues.length?issues.map(x=><div key={x.title}><span>{x.critical?'❌':'⚠️'}</span><div><strong>{x.title}</strong><small>{x.description}</small></div><button onClick={()=>{onClose();x.action();}}>Corrigir</button></div>):<p>As verificações preliminares passaram. Confira também exigências legais, geométricas e cartográficas antes de emitir peças técnicas.</p>}</div></section></div>;
}
export function ImportDialog({onClose,onImport}: {onClose:()=>void;onImport:(f:File)=>void|Promise<void>}){
 return <div className="map-modal-backdrop"><section className="map-import-dialog" role="dialog" aria-modal="true" aria-label="Importar arquivo para o projeto"><header className="map-dialog-head"><div><strong>Adicionar camadas ao mapa</strong><small>Importação de arquivos locais</small></div><button type="button" onClick={onClose} aria-label="Fechar importação"><X size={18}/></button></header><p className="map-import-note">As camadas importadas entram no projeto atual e ficam disponíveis para edição, salvamento e exportação. Serviços oficiais são adicionados pelo catálogo de camadas.</p><div className="map-import-choices"><FileUploadField label="GeoJSON, KML ou planilha" accept=".geojson,.json,.kml,.csv,.txt,.xlsx" maxBytes={12*1024*1024} description="Coordenadas WGS84; até 12 MB." onFile={onImport}/><FileUploadField label="Shapefile compactado" accept=".zip" maxBytes={12*1024*1024} description="ZIP com .shp, .shx, .dbf e .prj; confira o SRC." onFile={onImport}/></div></section></div>;
}
