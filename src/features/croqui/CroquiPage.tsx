import {findPointFeatureAtVertex} from './vertexPointMatch';
import {polygonSourceColors} from '../../lib/polygonSourceColors';
import {projectOwners} from '../projects/projectOwners';
import {maskBrazilianDocumentInput,formatBrazilianRg} from '../../lib/documentIdentity';
import {GlobalLoading} from '../../components/GlobalLoading';
import { ProjectSourcePicker } from '../../components/ProjectSourcePicker';
import {requestConfirmation} from '../../components/ConfirmDialogHost';
import {addRouteTransitionConfirmation} from '../../lib/routeTransitions';
import { FileUploadField } from '../../components/FileUploadField';
import { readFileAsDataUrl } from '../../lib/readFileAsDataUrl';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { ArrowLeft, ChevronDown, Download, Eye, EyeOff, FileImage, MousePointer2, PenLine, Printer, RotateCcw, Save, Trash2, WandSparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getDocumentCustomization, updateDocumentCustomization } from '../customization/customizationApi';
import { listProjects, getProject, projectTitle, type Project, type ProjectFull } from '../projects/projectsApi';
import { getPolygons, record, text, distance, fmt, type SurveyPolygon } from '../memorial/memorialEngine';
import { croquiVertexNames, exteriorGuidePair, CROQUI_DIVISION_PALETTE, defaultCroquiSettings, frameCoordinates, layoutForCroqui, normalizeCroquiSettings, renderCroqui, type CroquiSettings, type CroquiPhoto, type ElementKey, type TechnicalLine, type NeighborDetails } from '../memorial/croquiRenderer';
import { readConfrontation, resolveSegmentConfrontants, setSegmentConfrontant, roadBoundaries, svgPoints } from './croquiGeometry';
import { resolveConfrontantPath, confrontantPathSummary, type ConfrontantPath } from './confrontantRange';
import {suggestHiddenStraightVertices} from '../../lib/cartographicAutomation';
import {suggestConfrontantByPosition,readConfrontantLabelPositions,applyConfrontantSuggestions,captureConfrontantPins,transferConfrontantAppearance} from '../../lib/confrontantVisualOrganizer';
import { readSharedConfrontants, readSharedCroquiSettings, hasPendingCroquiDraft, localCroquiKey, cloudCroquiDraft, croquiDraftMatches, writePendingCroquiDraft, clearPendingCroquiDraft, withSavedCroquiSettings, stampCroquiRevision, combineCroquiConfrontants } from './sharedCroquiSettings';
import { segmentReadings, segmentReadingsCsv } from './segmentTable';
import { readProjectDivisions,type ProjectDivision } from './projectDivisions';
import {applySheetLayout,sheetLayoutForProject,readSheetLayout} from './sheetPresentationSync';
import {zoomCroquiOverlays,migrateCroquiFrame} from './zoomCroquiOverlays';
import { percentToZoom, zoomToPercent } from '../../lib/percentZoom';
import { publicMapUrlForProject } from '../public/publicMapData';
import { qrCodeDataUrl } from '../../lib/qrCode';
import {framePointToGeo,validGeoPoints,type OverlayPoint} from '../../lib/mapOverlayCoordinates';
import {readMapAppearance,mapAppearancePatch,mapNameForLabel,updateMapNameAppearance,type MapName} from './sharedMapAppearance';
import { readConfrontants } from '../documents/confrontantRegistry';
import { SignaturePadControl } from '../../components/SignaturePadControl';
import { ConfrontantImportDialog } from '../../components/ConfrontantImportDialog';
import './croqui.css';
// Editor 2D carrega apenas quando um rótulo é selecionado, sem afetar o mapa.
const KonvaLabelEditor = lazy(() => import('./KonvaLabelEditor'));
import {embedSvgSatellite} from '../../lib/satelliteSvg';

const icons: Record<ElementKey,string>={cotas:'Cotas',gleba:'Cotas da gleba',vertices:'Vértices',confrontantes:'Confrontantes',norte:'Norte'};
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const emptyNeighbor=():NeighborDetails=>({property:'',owner:'',cpf:'',rg:'',showProperty:true,showOwner:false,showCpf:false,showRg:false});
const imageUrl=(raw:string)=>/^data:image\/(?:png|jpeg|webp);base64,/i.test(raw);
function downloadBlob(filename:string, data:Blob) {
 const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function Setting({label,children}:{label:string;children:ReactNode}){return <label className="cq-field"><span>{label}</span>{children}</label>;}
function Toggle({checked,onChange,label}:{checked:boolean;onChange:(v:boolean)=>void;label:string}){return <label className="cq-toggle"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>{label}</label>;}
export function CroquiPage(){
 const [loadingProjects,setLoadingProjects]=useState(true);
 const {session}=useAuth();const [projects,setProjects]=useState<Project[]>([]);
 const [projectId,setProjectId]=useState('');const [full,setFull]=useState<ProjectFull|null>(null);
 const [featureId,setFeatureId]=useState('');
 const [areaSettings,setAreaSettings]=useState<Record<string,CroquiSettings>>({});
 const [dirtyAreaIds,setDirtyAreaIds]=useState<string[]>([]);
 const areaSettingsRef=useRef(areaSettings); useEffect(()=>{areaSettingsRef.current=areaSettings;},[areaSettings]);
 const [workflowStep,setWorkflowStep]=useState<1|2|3|4>(1);
 const [settings,setSettings]=useState<CroquiSettings>(()=>defaultCroquiSettings());
 const latestSettingsRef=useRef(settings);
 useEffect(()=>{latestSettingsRef.current=settings;},[settings]);
 const [prefs,setPrefs]=useState<Record<string,unknown>>({});
 const [loading,setLoading]=useState(false);const [message,setMessage]=useState('');
 const [signatureFileName,setSignatureFileName]=useState('');
 const [newMapName,setNewMapName]=useState('');
 const [saved,setSaved]=useState(false);const [dirty,setDirty]=useState(false);const [saving,setSaving]=useState(false);const [exportOpen,setExportOpen]=useState(false);
 const projectLoadSequence=useRef(0);
 const [mode,setMode]=useState<'none'|'line'|'edit'|'road'>('none');
 const [roadPoints,setRoadPoints]=useState<{x:number;y:number}[]>([]);
 const [roadCursor,setRoadCursor]=useState<{x:number;y:number}|null>(null);
 const [liveLine,setLiveLine]=useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
 const [croquiContext,setCroquiContext]=useState<{kind:'polygon'|'division'|'label';key:string;x:number;y:number}|null>(null);
 const [selectedRoad,setSelectedRoad]=useState<number|null>(null);
 const [neighborUntil,setNeighborUntil]=useState(0);
 const [neighborDirection,setNeighborDirection]=useState<ConfrontantPath>('auto');
 const [neighborDialog,setNeighborDialog]=useState<number|null>(null);
 const [confrontantImportOpen,setConfrontantImportOpen]=useState(false);
 const [neighborDraft,setNeighborDraft]=useState<NeighborDetails>(emptyNeighbor);
 const [segmentTableOpen,setSegmentTableOpen]=useState(false);
 const [selectedSegment,setSelectedSegment]=useState<number|null>(null);
 const [framingMode,setFramingMode]=useState<'all'|'single'>('all');
 const [hoverAreaId,setHoverAreaId]=useState('');
 const [cotaFrom,setCotaFrom]=useState(0),[cotaTo,setCotaTo]=useState(1);
 type Gesture = {kind:'photo-move';begin:{x:number;y:number};original:CroquiPhoto}|{kind:'photo-resize';corner:'top-left'|'top-right'|'bottom-left'|'bottom-right';original:CroquiPhoto}|{kind:'line';origin:{x:number;y:number};from:number;start?:{x:number;y:number}}|{kind:'road';moved:boolean}|{kind:'label';key:string;begin:{x:number;y:number};offset:{dx:number;dy:number};startClientX:number;startClientY:number;moved:boolean}|{kind:'handle';index:number;end:'start'|'end';}|{kind:'road-point';road:number;point:number}|{kind:'road-body';road:number;begin:{x:number;y:number};points:{x:number;y:number}[]}|{kind:'body';index:number;begin:{x:number;y:number};start:{x:number;y:number};end:{x:number;y:number}};
 const gesture=useRef<Gesture|null>(null);
 const latestRoad=useRef<{x:number;y:number}[]>([]);
 const clearRoadDraft=useCallback(()=>{latestRoad.current=[];setRoadPoints([]);setRoadCursor(null);setLiveLine(null);gesture.current=null;},[]);
 const switchMode=useCallback(async(next:'none'|'line'|'edit'|'road',discardRoadDraft=false):Promise<boolean>=>{
  const target=mode===next?'none':next;
  const pendingPoints=latestRoad.current.length;
  if(pendingPoints&&target!=='road'&&!discardRoadDraft&&!await requestConfirmation({title:'Descartar servidão em desenho?',message:`Há uma servidão em desenho com ${pendingPoints} ponto(s). Trocar de ferramenta vai descartá-la.`,confirmLabel:'Descartar servidão',destructive:true}))return false;
  if(pendingPoints&&(target!=='road'||discardRoadDraft))clearRoadDraft();
  gesture.current=null;setLiveLine(null);setMode(target);return true;
 },[mode,clearRoadDraft]);
 const [lineColor,setLineColor]=useState('#17212b'); const [roadColor,setRoadColor]=useState('#2563eb');
 const [roadWidth,setRoadWidth]=useState(18); const [autoSegment,setAutoSegment]=useState(0);
 const previewRef=useRef<HTMLDivElement>(null);
 const viewerRef=useRef<HTMLDivElement>(null);
 // Zoom da folha é somente visual: não recalcular SVG, mosaicos ou salvar na nuvem a cada clique.
 const [previewZoom,setPreviewZoom]=useState(100);
 const previousPreviewZoom=useRef(previewZoom);
 const [previewBaseWidth,setPreviewBaseWidth]=useState(950);
 useEffect(()=>{
  const element=viewerRef.current;if(!element)return;
  const measure=()=>{
   const width=element.getBoundingClientRect().width-28;
   if(width>0)setPreviewBaseWidth(Math.min(settings.paper==='A3'?1200:950,Math.max(1,width)));
  };
  measure();if(typeof ResizeObserver==='undefined')return;
  const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[settings.paper]);
 useLayoutEffect(()=>{
  const old=previousPreviewZoom.current,next=previewZoom;
  previousPreviewZoom.current=next;
  if(old===next||!viewerRef.current||!previewRef.current)return;
  const viewer=viewerRef.current,paper=previewRef.current,ratio=next/old;
  const w=paper.offsetWidth,h=paper.offsetHeight;
  if(w>viewer.clientWidth) viewer.scrollLeft=Math.max(0,Math.min(w-viewer.clientWidth,(viewer.scrollLeft+viewer.clientWidth/2)*ratio-viewer.clientWidth/2));
  if(h>viewer.clientHeight) viewer.scrollTop=Math.max(0,Math.min(h-viewer.clientHeight,(viewer.scrollTop+viewer.clientHeight/2-15)*ratio-viewer.clientHeight/2+15));
 },[previewZoom]);

 const userId=String(session?.user?.id||session?.user?.email||'local');
 const polygonRef=useRef<SurveyPolygon|null>(null);
 const divisionsRef=useRef<readonly ProjectDivision[]>([]);
 const update=useCallback((delta:Partial<CroquiSettings>)=>{setSettings(current=>{
  const base=delta.zoom!==undefined&&polygonRef.current?zoomCroquiOverlays(polygonRef.current,current,delta.zoom,divisionsRef.current):current;
  const next={...base,...delta};latestSettingsRef.current=next;return next;
 });setSaved(false);setDirty(true);},[]);
 const polys=useMemo(()=>getPolygons(full?.features||[]),[full]);
 const allProjectDivisions=useMemo(()=>readProjectDivisions(full?.features||[]),[full]);
 const isComposite=featureId==='all'&&polys.length>1;
 const hoverArea=polys.find(p=>p.id===hoverAreaId)||polys[0]||null;
 const cotaArea=isComposite?hoverArea:(polys.find(p=>p.id===featureId)||polys[0]||null);
 const cotaTarget=cotaArea?.id||'';
 const cotaVertices=cotaArea?.vertices||[];
 const projectUf=text(full?.project?.uf||full?.project?.stateCode).toUpperCase();
 const polygon=isComposite?(polys[0]||null):(polys.find(x=>x.id===featureId)||polys[0]||null);
 const croquiDraftFeatureId=isComposite?'__imovel_completo__':(polygon?.id||'');
 const projectDivisions=useMemo(()=>(isComposite||framingMode==='all')?allProjectDivisions:(polygon?allProjectDivisions.filter(d=>d.featureId===String(polygon.properties.sourceFeatureId||polygon.id)&&d.partIndex===Number(polygon.properties.partIndex||0)):[]),[allProjectDivisions,isComposite,framingMode,polygon]);
 polygonRef.current=polygon;
 divisionsRef.current=projectDivisions;
 const appearanceOf=(id:string)=>{
  const index=allProjectDivisions.findIndex(d=>(d.partIndex===0?d.featureId:`${d.featureId}:parte-${d.partIndex+1}`)===id);
  const source=index>=0?allProjectDivisions[index]:null;
  const fallback=CROQUI_DIVISION_PALETTE[Math.max(0,index)%CROQUI_DIVISION_PALETTE.length];
  const candidate=settings.featureStyles?.[id]?.fillColor||source?.color||fallback;
  return /^#[0-9a-f]{6}$/i.test(candidate)?candidate:fallback;
 };

 const vertexNames=useMemo(()=>polygon?croquiVertexNames(polygon,settings):[],[polygon,settings]);
 const technicalSegments=useMemo(()=>polygon?segmentReadings(polygon,vertexNames,polygon.vertices.map((_,i)=>settings.neighbors[i]??readConfrontation(polygon.properties,i,polygon.vertices.length))):[],[polygon,settings,vertexNames]);
 const technicalTotal=useMemo(()=>technicalSegments.reduce((sum,row)=>sum+row.distanceM,0),[technicalSegments]);
 const company=text(prefs.companyName)||'Surveyor Agrimensura';
 const accountLogo=text(prefs.logoDataUrl);
 const ownerNames=projectOwners(full?.project).map(owner=>owner.name);
 const basePropertyName=full?.project?projectTitle(full.project):polygon?.name||'Imóvel rural';
 const documentPropertyName=useMemo(()=>{
  if(!polygon||polys.length<=1||isComposite)return basePropertyName;
  const gName=polygon.name?.trim();
  if(!gName||gName.toLowerCase()===basePropertyName.toLowerCase())return basePropertyName;
  return `${basePropertyName} — ${gName}`;
 },[basePropertyName,polygon,polys.length,isComposite]);
 const municipality=[text(full?.project?.municipality||full?.project?.city),text(full?.project?.uf||full?.project?.stateCode)].filter(Boolean).join(' / ');
 const mapLink=useMemo(()=>{
   if(!polygon)return '';
   const fromApi=text(record(full?.project?.metadata).publicUrl||record(full?.project?.metadata).shareUrl||record(full?.project?.metadata).publicLink);
   return publicMapUrlForProject(window.location.origin,documentPropertyName,polys,polygon,isComposite,fromApi);
 },[full,polygon,polys,isComposite,documentPropertyName]);
 const qr=qrCodeDataUrl(mapLink,2);
 const glebas=polys.filter(p=>p.id!==polygon?.id && String(p.properties.category||'').toLowerCase()==='gleba');
 const markerIndexes=polygon?.vertices.flatMap((v,i)=>{
  const feature=full?.features.find(f=>{
   const geom=f.geoJson||f.geometry;if(geom?.type!=='Point'||!Array.isArray(geom.coordinates))return false;
   const pos=geom.coordinates as number[];
   return Math.abs(Number(pos[0])-v[0])<0.000001&&Math.abs(Number(pos[1])-v[1])<0.000001;
  });
  return feature?.properties?.hasMonument===true?[i]:[];
 })||[];
 const svg=useMemo(()=>polygon?renderCroqui(polygon,settings,{company,mapLink,municipality,qr,logo:accountLogo,owners:ownerNames,propertyName:documentPropertyName,glebas,divisions:projectDivisions,markers:markerIndexes,editing:mode==='edit',composite:isComposite,areaSettings:isComposite?areaSettings:undefined,uf:projectUf}):'', [polygon,settings,company,mapLink,municipality,qr,accountLogo,ownerNames,documentPropertyName,mode,projectDivisions,isComposite,areaSettings,glebas,markerIndexes,projectUf]);
 const [portableSvg,setPortableSvg]=useState<{original:string;svg:string;missing:number}|null>(null);
 useEffect(()=>{
  if(!svg)return;
  let cancelled=false;
  void embedSvgSatellite(svg).then(result=>{if(!cancelled)setPortableSvg({original:svg,svg:result.svg,missing:result.missing});})
   .catch(()=>{if(!cancelled)setPortableSvg(null);});
  return ()=>{cancelled=true;};
 },[svg]);
 useEffect(()=>{if(!session)return;let mounted=true;
  setLoadingProjects(true);Promise.allSettled([listProjects(session),getDocumentCustomization(session)]).then(([pr,cu])=>{
   if(!mounted)return;
   if(pr.status==='fulfilled')setProjects(pr.value);else setMessage('Falha ao consultar os projetos na API.');
   if(cu.status==='fulfilled') {const preferences=record(cu.value.customization);if(projectLoadSequence.current===0){setPrefs(preferences);setSettings(s=>({...s,technician:text(preferences.responsibleTechnician)}));}}
   else if(projectLoadSequence.current===0)setMessage(m=>`${m} Personalização da conta indisponível.`.trim());
  }).finally(()=>{if(mounted)setLoadingProjects(false);});return()=>{mounted=false;};
 },[session]);
  useEffect(()=>{
   const protectWorkspaceNavigation=(event:Event)=>{
    if(saving){event.preventDefault();setMessage('Aguarde a confirmação do salvamento antes de sair do Croqui.');return;}
    const pendingRoadPoints=latestRoad.current.length,pendingGesture=Boolean(gesture.current);
    const warnings=[...(dirty||dirtyAreaIds.length?['Existem edições do croqui ainda não salvas.']:[]),...(pendingRoadPoints?[`Há uma servidão em desenho com ${pendingRoadPoints} ponto(s); ela será descartada.`]:[]),...(pendingGesture&&!pendingRoadPoints?['Há um gesto de edição em andamento.']:[])];
    if(warnings.length)addRouteTransitionConfirmation(event,requestConfirmation({title:'Sair do Croqui?',message:warnings.join('\n'),confirmLabel:'Sair do Croqui'}));
   };
   window.addEventListener('surveyor:before-route-change',protectWorkspaceNavigation);
   return()=>window.removeEventListener('surveyor:before-route-change',protectWorkspaceNavigation);
  },[dirty,dirtyAreaIds.length,saving]);
  useEffect(()=>{
   const protectPageLeave=(event:BeforeUnloadEvent)=>{if(!saving&&!dirty&&!dirtyAreaIds.length&&!latestRoad.current.length&&!gesture.current)return;event.preventDefault();event.returnValue='';};
   window.addEventListener('beforeunload',protectPageLeave);
   return()=>window.removeEventListener('beforeunload',protectPageLeave);
  },[dirty,dirtyAreaIds.length,saving]);
 const preparePolygonSettings=useCallback((id:string,poly:SurveyPolygon|null,data:ProjectFull,preferences:Record<string,unknown>,allowLegacy:boolean,compositeDraft=false):CroquiSettings=>{
  const technician=text(preferences.responsibleTechnician);
  const options=record(preferences.options);
  const exclusive=poly?readSharedCroquiSettings(options,id,compositeDraft?'__imovel_completo__':poly.id,userId,technician,allowLegacy):null;
  const loaded=exclusive||((compositeDraft&&poly)?readSharedCroquiSettings(options,id,poly.id,userId,technician,false):null);
  const next=loaded&&poly?migrateCroquiFrame(poly,loaded,readProjectDivisions(data.features)):loaded||defaultCroquiSettings(technician);
  if(poly&&!loaded){
   const pProps=record(poly.properties);
   const {fill:mapFill,stroke:mapStroke}=polygonSourceColors(pProps);
   if(mapFill)next.polygonFill=mapFill;
   if(mapStroke)next.polygonStroke=mapStroke;
   // Retém a identificação P dos pontos importados para novos croquis.
   next.names=poly.vertices.map((vertex,index)=>{
    const point=findPointFeatureAtVertex(data.features,vertex);
    return String(point?.properties?.pointOrigin||'')==='importado'?`P-${String(index+1).padStart(2,'0')}`:'';
   });
  }
  if(poly&&!compositeDraft){
   const common=readSharedConfrontants(options,id,poly.id);
   // Registros parciais antigos não podem apagar trechos de outros confrontantes.
   const pending=hasPendingCroquiDraft(userId,id,poly.id);
   const clean=combineCroquiConfrontants(poly,next,common,pending);
   const individual=readSheetLayout(options,id,poly.id);
   const sheet=individual||sheetLayoutForProject(options,id,poly.id,true);
   return {...applySheetLayout(poly,clean,sheet,readProjectDivisions(data.features),false,!individual&&Boolean(sheet)),...(pending?{}:readMapAppearance(options,id,poly.id))};
  }
  if(poly&&compositeDraft){
   const sheet=sheetLayoutForProject(options,id,'__imovel_completo__');
   const divisions=readProjectDivisions(data.features);
   return {...applySheetLayout(poly,next,sheet,divisions,true),...readMapAppearance(options,id,'__imovel_completo__')};
  }
  return {...next,...readMapAppearance(options,id,compositeDraft?'__imovel_completo__':(poly?.id||''))};
 },[userId]);
 const updateAreaSettings=useCallback((id:string, patch:Partial<CroquiSettings>)=>{
  setAreaSettings(current=>{
   const original=current[id];if(!original)return current;
   const next={...current,[id]:{...original,...patch}};
   areaSettingsRef.current=next;
   return next;
  });
  setDirtyAreaIds(current=>current.includes(id)?current:[...current,id]);
  setDirty(true);setSaved(false);
 },[]);
 const autoHideStraight=()=>{
  if(isComposite){const part=polys.find(p=>p.id===cotaTarget)||polys[0];if(!part)return;
   const local=areaSettings[part.id]||defaultCroquiSettings();
   const suggested=suggestHiddenStraightVertices(part.vertices,local.hiddenVertices);
   updateAreaSettings(part.id,{hiddenVertices:[...new Set([...local.hiddenVertices,...suggested])].sort((a,b)=>a-b)});
   setMessage(`${suggested.length} vértice(s) da gleba ocultados visualmente.`);return;
  }
  if(!polygon)return;const suggested=suggestHiddenStraightVertices(polygon.vertices,settings.hiddenVertices);
  update({hiddenVertices:[...new Set([...settings.hiddenVertices,...suggested])].sort((a,b)=>a-b)});
  setMessage(`${suggested.length} vértice(s) intermediário(s) ocultados; geometria preservada.`);
 };
 const restoreHiddenVertices=()=>{
  if(isComposite){const part=polys.find(p=>p.id===cotaTarget)||polys[0];if(part)updateAreaSettings(part.id,{hiddenVertices:[]});}
  else update({hiddenVertices:[]});
 };
 const organizeConfrontants=async()=>{
  const part=isComposite?(polys.find(p=>p.id===cotaTarget)||polys[0]):polygon;if(!part)return;
  const local=isComposite?(areaSettings[part.id]||defaultCroquiSettings()):settings;
  const ring=part.vertices,projected=frameCoordinates(layoutForCroqui(part,settings,projectDivisions));
  const prefix=isComposite?`division:${String(part.properties.sourceFeatureId||part.id)}:${Number(part.properties.partIndex||0)}:`:'';
  const raw=ring.map((_,i)=>local.neighbors[i]||readConfrontation(part.properties,i,ring.length));
  const labels=readConfrontantLabelPositions(svg,'croqui',prefix).map(v=>({...v,caption:raw[v.source]||''}));
  const suggested=suggestConfrontantByPosition(projected,labels);
  if(!suggested.some(s=>s.targets.length)){setMessage('Preencha e posicione os confrontantes antes de organizar.');return;}
  const summary=suggested.map(s=>`${s.caption.slice(0,32)}: ${s.cardinal} → ${s.targets.length?s.targets.map(i=>`V-${i+1}→V-${(i+1)%ring.length+1}`).join(", "):"sem trecho confiável"}${s.confidence<.25?' (revisar)':''}`).join('\n');
  if(!await requestConfirmation({title:'Aplicar sugestões de confrontantes?',message:`Revise as confrontações sugeridas:\n\n${summary}\n\nAplicar à gleba selecionada?`,confirmLabel:'Aplicar sugestões'}))return;
  const applied=applyConfrontantSuggestions(raw,local.neighborDetails,suggested,ring.length);
  const pins=captureConfrontantPins(svg,'croqui',raw,prefix,local.confrontantPins);
  const labelColors=transferConfrontantAppearance(raw,applied.neighbors,prefix,local.labelColors) as Record<string,string>;
  const labelAngles=transferConfrontantAppearance(raw,applied.neighbors,prefix,local.labelAngles) as Record<string,number>;
  const labelSizes=transferConfrontantAppearance(raw,applied.neighbors,prefix,local.labelSizes||{}) as Record<string,number>;
  const retainedOffsets=Object.fromEntries(Object.entries(local.labelOffsets).filter(([key])=>!key.startsWith(`${prefix}neighbor:`)));
  const retainedAnchors=Object.fromEntries(Object.entries(local.absoluteLabels||{}).filter(([key])=>!key.startsWith(`${prefix}neighbor:`)));
  const patch={neighbors:applied.neighbors,neighborDetails:applied.details,confrontantPins:pins,labelColors,labelAngles,labelSizes,labelOffsets:retainedOffsets,absoluteLabels:retainedAnchors};
  if(isComposite)updateAreaSettings(part.id,patch);
  else update(patch);
  setMessage('Confrontantes reorganizados no rascunho. Confira os vértices e salve.');
 };
 const importConfrontations=(payload:{neighbors:string[];details:Record<string,NeighborDetails>})=>{
  const part=isComposite?(polys.find(p=>p.id===cotaTarget)||polys[0]):polygon;
  if(!part)return;
  const original=isComposite?(areaSettings[part.id]||defaultCroquiSettings()):settings;
  const patch={neighbors:payload.neighbors,neighborDetails:{...original.neighborDetails,...payload.details}};
  if(isComposite)updateAreaSettings(part.id,patch);else update(patch);
  setConfrontantImportOpen(false);
  setMessage('Confrontações importadas no rascunho. Confira os trechos na lateral e salve.');
 };
 const openProject=useCallback(async(id:string)=>{
   if(id===projectId)return;
  if(saving){setMessage('Aguarde a confirmação do salvamento antes de trocar de projeto.');return;}
   const loadSequence=++projectLoadSequence.current;
   const pendingRoadPoints=latestRoad.current.length;
   const warnings=[...(dirty?['Existem edições do croqui ainda não salvas.']:[]),...(pendingRoadPoints?[`Há uma servidão em desenho com ${pendingRoadPoints} ponto(s); ela será descartada.`]:[])];
   if(warnings.length&&!await requestConfirmation({title:'Trocar de projeto?',message:`${warnings.join('\n')}\n\nTrocar de projeto?`,confirmLabel:'Descartar e trocar',destructive:true}))return;
   if(loadSequence!==projectLoadSequence.current)return;
   clearRoadDraft();
   setWorkflowStep(1);
  setProjectId(id);setFull(null);setFeatureId('');setAreaSettings({});setDirtyAreaIds([]);setMode('none');setMessage('');setSaved(false);setDirty(false);setSignatureFileName('');setSelectedSegment(null);
  if(!id||!session){setLoading(false);return;}
  setLoading(true);
  try{
   const data=await getProject(session,id);
   // Carrega novamente a personalização: não confia em um snapshot anterior ao último salvamento.
   let preferences=prefs,preferencesLoaded=false;
   try{preferences=record((await getDocumentCustomization(session)).customization);preferencesLoaded=true;}
   catch{if(loadSequence===projectLoadSequence.current)setMessage('Personalização não pôde ser atualizada. Confira os ajustes antes de salvar.');}
   if(loadSequence!==projectLoadSequence.current)return;
   if(preferencesLoaded)setPrefs(preferences);
   const all=getPolygons(data.features);
   setFull(data);
   setFeatureId(all.length>1?'all':(all[0]?.id||''));
   if(all.length>1)setFramingMode('all');
   setSettings(preparePolygonSettings(id,all[0]||null,data,preferences,all.length===1,all.length>1));
   const each=Object.fromEntries(all.map(item=>[item.id,preparePolygonSettings(id,item,data,preferences,all.length===1)]));
   setAreaSettings(each);areaSettingsRef.current=each;setDirtyAreaIds([]);
  }catch(e){if(loadSequence===projectLoadSequence.current)setMessage(e instanceof Error?e.message:'Não foi possível abrir o projeto na API.');}
  finally{if(loadSequence===projectLoadSequence.current)setLoading(false);}
  },[session,prefs,dirty,saving,preparePolygonSettings,projectId,clearRoadDraft]);
 const importProject=useCallback((data:ProjectFull)=>{
  const id=data.project?.id||'';
  const importedPolygons=getPolygons(data.features);
  ++projectLoadSequence.current;
  clearRoadDraft();
  setWorkflowStep(1);setProjectId(id);setFull(data);setLoading(false);setFeatureId(importedPolygons.length>1?'all':(importedPolygons[0]?.id||''));
  if(importedPolygons.length>1)setFramingMode('all');
  setSettings(preparePolygonSettings(id,importedPolygons[0]||null,data,prefs,importedPolygons.length===1,importedPolygons.length>1));
  const each=Object.fromEntries(importedPolygons.map(item=>[item.id,preparePolygonSettings(id,item,data,prefs,importedPolygons.length===1)]));
  setAreaSettings(each);areaSettingsRef.current=each;setDirtyAreaIds([]);setMode('none');setSignatureFileName('');setSelectedSegment(null);
  setSaved(false);setDirty(false);setMessage('Projeto importado e salvo neste navegador.');
 },[clearRoadDraft,preparePolygonSettings,prefs]);
 const selectPolygon=async(id:string)=>{
   if(id===featureId)return;
  if(saving){setMessage('Aguarde a confirmação do salvamento antes de trocar de polígono.');return;}
   const pendingRoadPoints=latestRoad.current.length;
   const warnings=[...(dirty?['Existem alterações não salvas neste croqui.']:[]),...(pendingRoadPoints?[`Há uma servidão em desenho com ${pendingRoadPoints} ponto(s); ela será descartada.`]:[])];
   if(warnings.length&&!await requestConfirmation({title:'Trocar de polígono?',message:`${warnings.join('\n')}\n\nTrocar de polígono?`,confirmLabel:'Descartar e trocar',destructive:true}))return;
   clearRoadDraft();
  setFeatureId(id);setSaved(false);setDirty(false);setMode('none');setSelectedSegment(null);
  if(id==='all'){
   setFramingMode('all');
   if(full){setSettings(preparePolygonSettings(projectId,polys[0]||null,full,prefs,false,true));
    const each=Object.fromEntries(polys.map(item=>[item.id,preparePolygonSettings(projectId,item,full,prefs,false)]));
    setAreaSettings(each);areaSettingsRef.current=each;setDirtyAreaIds([]);}
   return;
  }
  const selected=polys.find(p=>p.id===id);
  if(full)setSettings(preparePolygonSettings(projectId,selected||null,full,prefs,polys.length===1));
 };
 const chooseAreaForAdvancedEditing=(id:string)=>{
  if(!polys.some(p=>p.id===id))return;
  if(dirty){setMessage('Salve as alterações do imóvel completo antes de abrir a edição detalhada de uma gleba.');return;}
  void selectPolygon(id).then(()=>setFramingMode('all'));
 };
 const save=async()=>{
  if(!projectId||!polygon)return;
  // Cópia local isolada pelo ID do polígono, nunca por projeto inteiro.
  if(saving)return;
  setSaving(true);
  const snapshot=stampCroquiRevision(settings);
  const areaSnapshots=Object.fromEntries(isComposite?dirtyAreaIds.filter(id=>areaSettings[id]).map(id=>[id,stampCroquiRevision(areaSettings[id])]):[]) as Record<string,CroquiSettings>;
  try{if(!writePendingCroquiDraft(userId,projectId,croquiDraftFeatureId,snapshot))throw Error();
   for(const [id,part] of Object.entries(areaSnapshots))if(!writePendingCroquiDraft(userId,projectId,id,part))throw Error();}
  catch{setMessage('Não foi possível salvar o rascunho neste dispositivo.');setSaving(false);return;}
  if(!session){setMessage('Rascunho salvo neste navegador. Sessão indisponível para sincronizar.');setSaving(false);return;}
  try{
   let payload:Record<string,unknown>={};
   const result=await updateDocumentCustomization(session,current=>{
    payload=withSavedCroquiSettings(current,projectId,croquiDraftFeatureId,snapshot);
    payload={...payload,options:{...record(payload.options),...mapAppearancePatch(record(payload.options),projectId,croquiDraftFeatureId,snapshot)}};
    for(const [id,part] of Object.entries(areaSnapshots)){
      payload=withSavedCroquiSettings(payload,projectId,id,part);
      payload={...payload,options:{...record(payload.options),...mapAppearancePatch(record(payload.options),projectId,id,part)}};
    }
    return payload;
   });
   if(!result.saved.customization)throw Error('Servidor não confirmou o salvamento.');
   const confirmed=record((await getDocumentCustomization(session)).customization);
   const opts=record(confirmed.options);
   const expected=record(cloudCroquiDraft(record(payload.options),projectId,croquiDraftFeatureId));
   const verified=cloudCroquiDraft(opts,projectId,croquiDraftFeatureId);
   const fields=['background','backgroundOffsetX','backgroundOffsetY','zoom','paper','title','reference','technician','prefix','elements','names','neighbors','neighborDetails','vertexOffsets','labelOffsets','labelAngles','hiddenVertices','polygonFill','polygonFillOpacity','polygonStroke','polygonStrokeWidth','autoAreaTitle','featureStyles','featureNames','customCotas','tarefaM2','labelColors','labelSizes','absoluteLabels','confrontantPins','lines','easements','signature','signatureSize','signatureEnabled','photoOverlay','zoomPreview','labelMode','profile','syncRevision','mapNames'];
   if(fields.some(key=>JSON.stringify(verified[key])!==JSON.stringify(expected[key]))||JSON.stringify(verified)!==JSON.stringify(expected))
    throw Error('A API não devolveu integralmente as edições, estilos, textos e posições do croqui.');
   const expectedNeighbors=readConfrontants(record(payload.options),projectId,croquiDraftFeatureId);
   const verifiedNeighbors=readConfrontants(opts,projectId,croquiDraftFeatureId);
   if(JSON.stringify(verifiedNeighbors)!==JSON.stringify(expectedNeighbors))
    throw Error('A API não confirmou os confrontantes deste polígono.');
   for(const id of Object.keys(areaSnapshots)){
    if(!croquiDraftMatches(record(payload.options),opts,projectId,id))throw Error(`A nuvem não confirmou todas as edições, estilos, textos e posições da gleba ${id}.`);
    if(JSON.stringify(readConfrontants(opts,projectId,id))!==JSON.stringify(readConfrontants(record(payload.options),projectId,id)))throw Error(`A nuvem não confirmou os confrontantes da gleba ${id}.`);
   }
   const latest=latestSettingsRef.current;
   const changedAreas=Object.entries(areaSnapshots).filter(([id,part])=>JSON.stringify({...areaSettingsRef.current[id],syncRevision:part.syncRevision})!==JSON.stringify(part));
   // Não eliminar edições realizadas enquanto o Appwrite estava gravando.
   const editedDuringSave=JSON.stringify({...latest,syncRevision:snapshot.syncRevision})!==JSON.stringify(snapshot)||changedAreas.length>0;
   if(editedDuringSave){
    let draftsPreserved=writePendingCroquiDraft(userId,projectId,croquiDraftFeatureId,stampCroquiRevision(latest));
    const changedAreaIds=new Set(changedAreas.map(([id])=>id));
    for(const id of Object.keys(areaSnapshots)){
     if(!changedAreaIds.has(id)){clearPendingCroquiDraft(userId,projectId,id);continue;}
     const area=areaSettingsRef.current[id];
     if(!area||!writePendingCroquiDraft(userId,projectId,id,stampCroquiRevision(area)))draftsPreserved=false;
    }
    setPrefs(confirmed);setSaved(false);setDirty(true);
    setMessage(draftsPreserved?'A edição anterior foi confirmada, mas você fez novos ajustes durante a gravação. Eles continuam no navegador: salve novamente.':'A edição anterior foi confirmada, mas novos ajustes não puderam ser guardados neste navegador. Eles continuam abertos nesta tela: salve novamente antes de sair.');
   }else{
    clearPendingCroquiDraft(userId,projectId,croquiDraftFeatureId);for(const id of Object.keys(areaSnapshots))clearPendingCroquiDraft(userId,projectId,id);
    setSettings(snapshot);setPrefs(confirmed);setSaved(true);setDirty(false);setDirtyAreaIds([]);
    setMessage('Croqui confirmado na nuvem. O Memorial Descritivo usará esta revisão salva do mesmo polígono.');
   }
  }catch(e){setSaved(false);setMessage(`NÃO sincronizado na nuvem. Edições preservadas neste navegador e disponíveis nas gerações locais. Tente Salvar alterações novamente: ${e instanceof Error?e.message:'falha de sincronização'}`);}
  finally{setSaving(false);}
 };
 const restore=()=>{
  if(!polygon||!full)return;
  const raw=localStorage.getItem(localCroquiKey(userId,projectId,croquiDraftFeatureId));
  if(raw){try{const restored=normalizeCroquiSettings(JSON.parse(raw),text(prefs.responsibleTechnician));setSettings(polygon?migrateCroquiFrame(polygon,restored,projectDivisions):restored);setMessage('Rascunho deste polígono restaurado.');}
   catch{setMessage('Rascunho inválido.');return;}}
  else setSettings(preparePolygonSettings(projectId,polygon,full,prefs,polys.length===1,isComposite));
  if(isComposite){const each=Object.fromEntries(polys.map(item=>[item.id,preparePolygonSettings(projectId,item,full,prefs,false)]));setAreaSettings(each);areaSettingsRef.current=each;setDirtyAreaIds([]);}
  setSaved(false);setDirty(true);
 };
 const changeElement=(key:ElementKey,change:Partial<CroquiSettings['elements'][ElementKey]>)=>update({elements:{...settings.elements,[key]:{...settings.elements[key],...change}}});
 const finalSvg=()=>polygon?renderCroqui(polygon,settings,{company,mapLink,municipality,qr,logo:accountLogo,owners:ownerNames,propertyName:documentPropertyName,glebas,divisions:projectDivisions,markers:markerIndexes,composite:isComposite,areaSettings:isComposite?areaSettings:undefined,uf:projectUf}):'';
 const exportSvg=async()=>{const source=finalSvg();if(!source)return;
  const out=await embedSvgSatellite(source);
  if(out.missing)setMessage(`Atenção: ${out.missing} imagem(ns) do satélite não puderam ser incorporadas ao SVG. Verifique a conexão e o acesso ao provedor antes de emitir o documento.`);
  downloadBlob('SURVEYOR_CROQUI.svg',new Blob([out.svg],{type:'image/svg+xml;charset=utf-8'}));};
 const exportSegmentTableCsv=()=>{
  if(!technicalSegments.length)return;
  downloadBlob('SURVEYOR_RUMOS_AZIMUTES_DISTANCIAS.csv',new Blob([segmentReadingsCsv(technicalSegments)],{type:'text/csv;charset=utf-8'}));
 };
 const exportCotasCsv=()=>{
  if(!polygon)return;
  const quote=(value:string)=>`"${value.replace(/"/g,'""')}"`;
  const lines=['Vértice inicial;Vértice final;Distância (m);Confrontante'];
  polygon.vertices.forEach((v,i)=>{
   const next=(i+1)%polygon.vertices.length;
   const label=settings.neighbors[i]??readConfrontation(polygon.properties,i,polygon.vertices.length);
   lines.push([vertexNames[i],vertexNames[next],fmt(distance(v,polygon.vertices[next]),2),label].map(quote).join(';'));
  });
  downloadBlob('SURVEYOR_QUADRO_COMPLETO_DE_COTAS.csv',new Blob(['\ufeff',lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
 };
 const exportHtml=async()=>{const source=finalSvg();if(!source)return;const embedded=await embedSvgSatellite(source);const out=embedded.svg;if(embedded.missing)setMessage(`Faltaram ${embedded.missing} imagens do satélite na exportação; confira o arquivo antes de utilizar.`);const paper=settings.paper==='A3'?'A3 landscape':'A4 portrait';const html=`<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><title>Planta do imóvel</title><style>@page{size:${paper};margin:0}body{margin:0;display:grid;place-items:center}svg{display:block;max-width:${settings.paper==='A3'?'420mm':'210mm'};max-height:${settings.paper==='A3'?'297mm':'297mm'};height:auto;width:auto}</style>${out}</html>`;downloadBlob('SURVEYOR_CROQUI.html',new Blob([html],{type:'text/html;charset=utf-8'}));};
 const printCroqui=async()=>{const source=finalSvg();if(!source)return;const embedded=await embedSvgSatellite(source);const out=embedded.svg;if(embedded.missing)setMessage(`Faltaram ${embedded.missing} imagens do satélite na impressão; confira o documento.`);const page=settings.paper==='A3'?'A3 landscape':'A4 portrait';const iframe=document.createElement('iframe');iframe.style.position='fixed';iframe.style.width='1px';iframe.style.height='1px';iframe.style.opacity='0';iframe.style.pointerEvents='none';document.body.append(iframe);
  const d=iframe.contentDocument;if(!d){iframe.remove();return;}
  d.open();d.write(`<html><head><title>Croqui Surveyor</title><style>@page{size:${page};margin:0}html,body{margin:0}svg{display:block;margin:auto;width:auto;height:auto;max-width:${settings.paper==='A3'?'420mm':'210mm'};max-height:297mm}@media print{*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${out}</body></html>`);d.close();iframe.onload=()=>{iframe.contentWindow?.focus();iframe.contentWindow?.print();window.setTimeout(()=>iframe.remove(),10000);};};
 const exportBatchCroquis=async(type:'svg'|'html'|'pdf')=>{
  if(!full||!polys.length)return;
  const rendered=polys.map((poly,idx)=>{
   const polySettings=isComposite?(areaSettings[poly.id]||preparePolygonSettings(projectId,poly,full,prefs,false)):(poly.id===polygon?.id?settings:preparePolygonSettings(projectId,poly,full,prefs,polys.length===1));
   const chosenStyle=isComposite?settings.featureStyles?.[poly.id]:undefined;
   const printablePoly:SurveyPolygon=chosenStyle?{...poly,properties:{...poly.properties,
    fillColor:chosenStyle.fillColor||poly.properties.fillColor,
    strokeColor:chosenStyle.strokeColor||poly.properties.strokeColor
   }}:poly;
   const basePrintable=chosenStyle?.strokeWidth?{...polySettings,polygonStrokeWidth:chosenStyle.strokeWidth}:polySettings;
   const individualCotas=isComposite?settings.customCotas.filter(c=>c.target===poly.id):[];
   const printableSettings=isComposite?{...basePrintable,customCotas:[...basePrintable.customCotas,...individualCotas],tarefaM2:settings.tarefaM2||basePrintable.tarefaM2}:basePrintable;
   const gName=(isComposite?settings.featureNames?.[poly.id]:undefined)||poly.name?.trim()||`Gleba ${idx+1}`;
   const propName=polys.length>1&&gName.toLowerCase()!==basePropertyName.toLowerCase()?`${basePropertyName} — ${gName}`:basePropertyName;
   const singleDivisions=allProjectDivisions.filter(d=>d.featureId===String(poly.properties.sourceFeatureId||poly.id)&&d.partIndex===Number(poly.properties.partIndex||0));
   const pMarkers=poly.vertices.flatMap((v,i)=>{
    const feature=findPointFeatureAtVertex(full.features,v);
    return feature?.properties?.hasMonument===true?[i]:[];
   });
   const svgDoc=renderCroqui(printablePoly,printableSettings,{company,mapLink,municipality,qr,logo:accountLogo,owners:ownerNames,propertyName:propName,glebas:[],divisions:singleDivisions,markers:pMarkers,uf:projectUf});
   return {poly,gName,svgDoc};
  });
  for(const item of rendered){
   const prepared=await embedSvgSatellite(item.svgDoc);
   item.svgDoc=prepared.svg;
   if(prepared.missing)setMessage(`Algumas imagens do satélite não puderam ser incorporadas em ${item.gName}. Confira os arquivos.`);
  }
  if(type==='svg'){
   rendered.forEach((item,idx)=>{
    const slug=item.gName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_');
    window.setTimeout(()=>downloadBlob(`SURVEYOR_CROQUI_${String(idx+1).padStart(2,'0')}_${slug}.svg`,new Blob([item.svgDoc],{type:'image/svg+xml;charset=utf-8'})),idx*180);
   });
   setMessage(`${rendered.length} croquis individuais exportados em SVG (1 por 1).`);
   return;
  }
  const page=settings.paper==='A3'?'A3 landscape':'A4 portrait';
  const maxWidth=settings.paper==='A3'?'420mm':'210mm';
  const pagesHtml=rendered.map((item,idx)=>`<section class="croqui-batch-page"${idx<rendered.length-1?' style="page-break-after:always;break-after:page"':''}>${item.svgDoc}</section>`).join('');
  const htmlDoc=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Croquis (${rendered.length} áreas) — ${basePropertyName}</title><style>@page{size:${page};margin:0}html,body{margin:0;padding:0;background:#fff}.croqui-batch-page{display:grid;place-items:center;min-height:100vh;box-sizing:border-box}svg{display:block;margin:auto;width:auto;height:auto;max-width:${maxWidth};max-height:297mm}@media print{*{print-color-adjust:exact;-webkit-print-color-adjust:exact}.croqui-batch-page{min-height:auto}}</style></head><body>${pagesHtml}</body></html>`;
  if(type==='html'){
   downloadBlob('SURVEYOR_CROQUIS_LOTE.html',new Blob([htmlDoc],{type:'text/html;charset=utf-8'}));
   setMessage(`Arquivo HTML com ${rendered.length} croquis individuais baixado.`);
   return;
  }
  const iframe=document.createElement('iframe');iframe.style.position='fixed';iframe.style.width='1px';iframe.style.height='1px';iframe.style.opacity='0';iframe.style.pointerEvents='none';document.body.append(iframe);
  const d=iframe.contentDocument;if(!d){iframe.remove();return;}
  d.open();d.write(htmlDoc);d.close();iframe.onload=()=>{iframe.contentWindow?.focus();iframe.contentWindow?.print();window.setTimeout(()=>iframe.remove(),12000);};
 };
 const svgCoord=(event:ReactPointerEvent<HTMLDivElement>)=>{
   const root=previewRef.current?.querySelector('svg');if(!root)return null;
   const rect=root.getBoundingClientRect(), vb=root.viewBox.baseVal;
   return {x:clamp((event.clientX-rect.left)/rect.width*vb.width,44,1156),y:clamp((event.clientY-rect.top)/rect.height*vb.height,74,664)};
 };
 const nearestVertex=(pos:{x:number;y:number})=>{
   if(!polygon)return -1;
   const pts=frameCoordinates(layoutForCroqui(polygon,settings,projectDivisions));let best=-1,dist=Infinity;
   pts.forEach((p,i)=>{const d=Math.hypot(p.x-pos.x,p.y-pos.y);if(d<dist){dist=d;best=i;}});
   return dist<=35?best:-1;
 };
 const nearestSegment=(pos:{x:number;y:number})=>{
   if(!polygon)return false;
   const pts=frameCoordinates(layoutForCroqui(polygon,settings,projectDivisions));
   return pts.some((a,i)=>{
     const b=pts[(i+1)%pts.length],dx=b.x-a.x,dy=b.y-a.y;
     const t=clamp(((pos.x-a.x)*dx+(pos.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
     return Math.hypot(pos.x-a.x-t*dx,pos.y-a.y-t*dy)<=27;
   });
 };
 const activatePointer=(e:ReactPointerEvent<HTMLDivElement>)=>{
   e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
 };
 const handlePointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(workflowStep===1||!polygon||event.button!==0||!event.isPrimary)return;
   const pos=svgCoord(event);if(!pos)return;
   const el=event.target as Element;
   const photo=settings.photoOverlay;
   const corner=el.closest('[data-croqui-photo-corner]')?.getAttribute('data-croqui-photo-corner');
   if(photo?.visible&&corner&&['top-left','top-right','bottom-left','bottom-right'].includes(corner)){
     gesture.current={kind:'photo-resize',corner:corner as 'top-left'|'top-right'|'bottom-left'|'bottom-right',original:photo};activatePointer(event);return;
   }
   if(photo?.visible&&el.closest('[data-croqui-photo-body]')&&(mode==='none'||mode==='edit')){
     gesture.current={kind:'photo-move',begin:pos,original:photo};activatePointer(event);return;
   }
   // Em modo selecionar, todos os textos técnicos podem ser movidos sem alterar a geometria.
   const label=el.closest('[data-croqui-label]');
   if(label&&(mode==='none'||mode==='edit')){
     const key=label.getAttribute('data-croqui-label')||'';
     gesture.current={kind:'label',key,begin:pos,offset:settings.labelOffsets[key]||{dx:0,dy:0},startClientX:event.clientX,startClientY:event.clientY,moved:false};
     activatePointer(event);return;
   }
   if(mode==='edit'){
     const roadBody=el.closest('[data-croqui-road-body]');
     const roadHandle=el.closest('[data-croqui-road-handle]');
     if(roadHandle){const match=/^(\d+):(\d+)$/.exec(roadHandle.getAttribute('data-croqui-road-handle')||'');
       if(match){setSelectedRoad(Number(match[1]));gesture.current={kind:'road-point',road:Number(match[1]),point:Number(match[2])};activatePointer(event);}return;
     }
     if(roadBody){const road=Number(roadBody.getAttribute('data-croqui-road-body'));
      const previous=settings.easements[road];if(previous){setSelectedRoad(road);gesture.current={kind:'road-body',road,begin:pos,points:roadScreenPoints(previous).map(v=>({...v}))};activatePointer(event);}return;
     }
     const handle=el.closest('[data-croqui-handle]');
     if(handle){const match=/^(\d+):(start|end)$/.exec(handle.getAttribute('data-croqui-handle')||'');
       if(match){gesture.current={kind:'handle',index:Number(match[1]),end:match[2] as 'start'|'end'};activatePointer(event);}return;
     }
     const body=el.closest('[data-croqui-line-body]');
     if(body){const index=Number(body.getAttribute('data-croqui-line-body')),line=settings.lines[index];if(!line)return;
       const pts=frameCoordinates(layoutForCroqui(polygon,settings,projectDivisions));
       const a=line.start||pts[line.from]; const b=line.to===undefined?{x:line.x,y:line.y}:pts[line.to];
       if(a&&b){gesture.current={kind:'body',index,begin:pos,start:a,end:b};activatePointer(event);}return;
     }
   }
   if(mode==='line'){
     const from=nearestVertex(pos);
     if(from<0&&!nearestSegment(pos)){setMessage('Inicie a linha em um vértice ou na borda do imóvel.');return;}
     const anchor=from>=0?frameCoordinates(layoutForCroqui(polygon,settings,projectDivisions))[from]:pos;
     gesture.current={kind:'line',origin:anchor,from:Math.max(from,0),start:from<0?anchor:undefined};
     setLiveLine({x1:anchor.x,y1:anchor.y,x2:pos.x,y2:pos.y});activatePointer(event);return;
   }
   if(mode==='road'){
     // Um clique insere um ponto de controle. Arrastar o mouse não cria
     // centenas de pontos nem finaliza a faixa involuntariamente.
     const current=latestRoad.current;
     if(!current.length||Math.hypot(pos.x-current[current.length-1].x,pos.y-current[current.length-1].y)>3){
       latestRoad.current=[...current,pos];setRoadPoints(latestRoad.current);
     }
     setRoadCursor(pos);
     return;
   }
 };
 const handlePointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(workflowStep===1||!event.isPrimary)return;
   const pos=svgCoord(event);if(!pos)return;
   if(mode==='road')setRoadCursor(pos);
   const g=gesture.current;if(!g)return;
   if(g.kind==='photo-move'){
     const photo=g.original;update({photoOverlay:{...photo,x:clamp(photo.x+pos.x-g.begin.x,44,1156-photo.size),y:clamp(photo.y+pos.y-g.begin.y,74,664-photo.size)}});return;
   }
   if(g.kind==='photo-resize'){
     const original=g.original,corner=g.corner;
     const anchorX=original.x+(corner.endsWith('left')?original.size:0);
     const anchorY=original.y+(corner.startsWith('top')?original.size:0);
     const maxWidth=corner.endsWith('left')?anchorX-44:1156-anchorX;
     const maxHeight=corner.startsWith('top')?anchorY-74:664-anchorY;
     const size=clamp(Math.max(Math.abs(pos.x-anchorX),Math.abs(pos.y-anchorY)),40,Math.min(360,maxWidth,maxHeight));
     update({photoOverlay:{...original,size,x:corner.endsWith('left')?anchorX-size:anchorX,y:corner.startsWith('top')?anchorY-size:anchorY}});return;
   }
   if(g.kind==='line'){setLiveLine({x1:g.origin.x,y1:g.origin.y,x2:pos.x,y2:pos.y});return;}
   if(g.kind==='label'){
     if(!g.moved&&Math.hypot(event.clientX-g.startClientX,event.clientY-g.startClientY)<8)return;
     g.moved=true;
   }
   if(g.kind==='label'&&g.key.startsWith('map-name:')&&polygon){
     const id=g.key.slice(9),item=settings.mapNames.find(v=>v.id===id);
     if(item){
       const layout=layoutForCroqui(polygon,settings,projectDivisions),z=256*2**layout.zoom;
       const moveX=pos.x-g.begin.x,moveY=pos.y-g.begin.y;
       const latRadians=item.lat*Math.PI/180;
       const mx=(item.lon+180)/360*z+moveX;
       const my=(1-Math.asinh(Math.tan(latRadians))/Math.PI)/2*z+moveY;
       const newLon=Math.max(-180,Math.min(180,mx/z*360-180));
       const newLat=Math.max(-85,Math.min(85,Math.atan(Math.sinh(Math.PI*(1-2*my/z)))*180/Math.PI));
       update({mapNames:settings.mapNames.map(v=>v.id===id?{...v,lon:newLon,lat:newLat}:v)});
       gesture.current={...g,begin:pos};return;
     }
   }
   if(g.kind==='label'){
     update({labelOffsets:{...settings.labelOffsets,[g.key]:{dx:g.offset.dx+pos.x-g.begin.x,dy:g.offset.dy+pos.y-g.begin.y}}});return;
   }
   if(g.kind==='road-body'){
     const dx=pos.x-g.begin.x,dy=pos.y-g.begin.y;update({easements:settings.easements.map((road,i)=>i!==g.road?road:{...road,sourceEdges:undefined,points:g.points.map(v=>({x:v.x+dx,y:v.y+dy})),geoPoints:g.points.map(v=>roadGeoPoint({x:v.x+dx,y:v.y+dy})).filter((p):p is [number,number]=>p!==null)})});return;
   }
   if(g.kind==='road-point'){
     update({easements:settings.easements.map((road,i)=>i!==g.road?road:{...road,sourceEdges:undefined,points:roadScreenPoints(road).map((p,j)=>j===g.point?pos:p),geoPoints:roadScreenPoints(road).map((p,j)=>roadGeoPoint(j===g.point?pos:p)).filter((p):p is [number,number]=>p!==null)})});return;
   }
   if(g.kind==='handle'){
     update({lines:settings.lines.map((line,i)=>i!==g.index?line:g.end==='end'?{...line,to:undefined,x:pos.x,y:pos.y}:{...line,start:pos})});return;
   }
   if(g.kind==='body'){
     const dx=pos.x-g.begin.x,dy=pos.y-g.begin.y;
     update({lines:settings.lines.map((line,i)=>i!==g.index?line:{...line,start:{x:g.start.x+dx,y:g.start.y+dy},to:undefined,x:g.end.x+dx,y:g.end.y+dy})});return;
   }
 };
 const roadGeoPoint=(point:OverlayPoint)=>{
  if(!polygon)return null;
  const layout=layoutForCroqui(polygon,settings,projectDivisions);
  return framePointToGeo(point,{x:44,y:74,w:1112,h:590},layout.zoom,layout.center);
 };
 const roadScreenPoints=(road:CroquiSettings['easements'][number])=>{
  if(!polygon||!validGeoPoints(road.geoPoints))return road.points;
  const layout=layoutForCroqui(polygon,settings,projectDivisions);
  const world=256*2**layout.zoom;
  const latitude=Math.max(-85,Math.min(85,layout.center[1]))*Math.PI/180;
  const cx=(layout.center[0]+180)/360*world;
  const cy=(1-Math.asinh(Math.tan(latitude))/Math.PI)/2*world;
  return road.geoPoints.map(([lon,lat])=>{
   const x=(lon+180)/360*world;
   const y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*world;
   return {x:44+1112/2+x-cx,y:74+590/2+y-cy};
  });
 };
 const commitRoad=(points:{x:number;y:number}[])=>{
   const filtered=points.filter((p,i)=>i===0||Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)>1);
   if(filtered.length<2){setMessage('Desenhe uma servidão com pelo menos dois pontos.');return;}
   const mapLayout=polygon?layoutForCroqui(polygon,settings,projectDivisions):null;
   const metersPerPx=mapLayout?156543.03392804097*Math.cos(mapLayout.center[1]*Math.PI/180)/2**mapLayout.zoom:0;
   update({easements:[...settings.easements,{id:crypto.randomUUID(),points:filtered,geoPoints:polygon?filtered.map(roadGeoPoint).filter((p):p is [number,number]=>p!==null):undefined,color:roadColor,width:roadWidth,widthMeters:metersPerPx>0?roadWidth*metersPerPx:undefined}]});
   clearRoadDraft();setMode('none');setMessage('Servidão curva adicionada.');
 };
 const handlePointerUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
   if(!event.isPrimary)return;
   const g=gesture.current;if(!g)return;
   const pos=svgCoord(event);
   if(g.kind==='label'&&pos&&!g.moved&&Math.hypot(event.clientX-g.startClientX,event.clientY-g.startClientY)<8){
     setCroquiContext({kind:'label',key:g.key,x:Math.max(8,Math.min(event.clientX,window.innerWidth-310)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-555))});
   }
   if(g.kind==='line'&&pos){
     if(Math.hypot(g.origin.x-pos.x,g.origin.y-pos.y)>8){
       const line:TechnicalLine={id:crypto.randomUUID(),from:g.from,start:g.start,x:pos.x,y:pos.y,color:lineColor};
       update({lines:[...settings.lines,line]});setMessage('Linha desenhada. Selecione Editar para mover as extremidades ou a linha inteira.');
     }
     setLiveLine(null);
   }
   gesture.current=null;
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const handlePointerCancel=(event:ReactPointerEvent<HTMLDivElement>)=>{
   if(!event.isPrimary)return;
   gesture.current=null;setLiveLine(null);
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const finishRoad=()=>commitRoad(latestRoad.current);
 const hoverCroquiDivision=(event:ReactMouseEvent<HTMLDivElement>)=>{
   if(!isComposite)return;
   const el=event.target as Element;
   const shape=el.closest('[data-croqui-division]');
   const label=el.closest('[data-division-name]');
   const id=(shape?.getAttribute('data-croqui-division')||label?.getAttribute('data-division-name')||'').trim();
   if(id&&polys.some(p=>p.id===id)){
     if(id!==hoverAreaId)setHoverAreaId(id);
      if(workflowStep>2)setWorkflowStep(2);
   }
 };
 const handleContextMenu=(event:ReactMouseEvent<HTMLDivElement>)=>{
   if(workflowStep===1)return;
  const target=event.target as Element;
  // Textos ganham prioridade sobre o polígono embaixo deles, inclusive os
  // títulos das subdivisões e vértices. Todos usam as mesmas três ferramentas.
  const label=target.closest('[data-croqui-label]');
  const vertexCircle=target.closest('[data-croqui-vertex]');
  const areaVertex=target.closest('[data-croqui-area-vertex]');
  let labelKey=label?.getAttribute('data-croqui-label')||'';
  if(!labelKey&&vertexCircle)labelKey=`vertex:${vertexCircle.getAttribute('data-croqui-vertex')}`;
  if(!labelKey&&areaVertex){
   const match=/^(.*):(\d+)$/.exec(areaVertex.getAttribute('data-croqui-area-vertex')||'');
   if(match){
    const part=projectDivisions.find(d=>(d.partIndex===0?d.featureId:`${d.featureId}:parte-${d.partIndex+1}`)===match[1]);
    if(part)labelKey=`division:${part.featureId}:${part.partIndex}:vertex:${match[2]}`;
   }
  }
  if(labelKey){
   event.preventDefault();event.stopPropagation();
   setCroquiContext({kind:'label',key:labelKey,x:Math.max(8,Math.min(event.clientX,window.innerWidth-310)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-555))});
   return;
  }
  const divisionBody=target.closest('[data-croqui-division]');
  const polygonBody=target.closest('[data-croqui-polygon]');
  if(!polygonBody&&!divisionBody)return;
  event.preventDefault();event.stopPropagation();
  if(divisionBody){
   setCroquiContext({kind:'division',key:divisionBody.getAttribute('data-croqui-division')||'',x:Math.min(event.clientX,window.innerWidth-285),y:Math.min(event.clientY,window.innerHeight-360)});
   return;
  }
  setCroquiContext({kind:'polygon',key:'',x:Math.min(event.clientX,window.innerWidth-285),y:Math.min(event.clientY,window.innerHeight-360)});
 };
 const contextMapName=croquiContext?.kind==='label'?mapNameForLabel(settings.mapNames,croquiContext.key):undefined;
 const restoreLabelAppearance=(key:string)=>{
  const colors={...settings.labelColors}; delete colors[key];
  const angles={...settings.labelAngles}; delete angles[key];
  const sizes={...settings.labelSizes}; delete sizes[key];
  update({labelColors:colors,labelAngles:angles,labelSizes:sizes});
 };
 const addAutomaticLine=()=>{
   if(!polygon)return;
   const generated=exteriorGuidePair(polygon,settings,autoSegment,85,projectDivisions).map(line=>({...line,id:crypto.randomUUID(),color:lineColor}));
   if(!generated.length)return;
   update({lines:[...settings.lines,...generated]});
   const next=(autoSegment+1)%vertexNames.length;
   setMessage(`Duas linhas exteriores criadas a partir de ${vertexNames[autoSegment]} e ${vertexNames[next]}.`);
 };
 const autoOrganize=async()=>{
  if(!polygon)return;
  if(latestRoad.current.length&&!await requestConfirmation({title:'Descartar servidão em desenho?',message:`Há uma servidão em desenho com ${latestRoad.current.length} ponto(s). Organizar rótulos vai descartá-la.`,confirmLabel:'Descartar e organizar',destructive:true}))return;
  clearRoadDraft();setMode('none');
  // Limpa somente deslocamentos manuais de rótulos; coordenadas e medidas não mudam.
  update({vertexOffsets:[],labelOffsets:{},labelMode:'smart',elements:{...settings.elements,
   cotas:{...settings.elements.cotas,size:Math.min(settings.elements.cotas.size,60)},
   vertices:{...settings.elements.vertices,size:Math.min(settings.elements.vertices.size,65)},
   confrontantes:{...settings.elements.confrontantes,size:Math.min(settings.elements.confrontantes.size,90)}}});
  setMessage('Rótulos compactados junto ao perímetro, sem linhas-guia. As medidas e os nomes foram preservados.');
 };
  const loadSignature=async(file:File,reportProgress:(file:File,loaded:number,total:number)=>void,signal:AbortSignal)=>{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Escolha uma imagem PNG, JPEG ou WebP.');
   if(file.size>2_000_000)throw new Error('A assinatura deve ter até 2 MB.');
    const data=await readFileAsDataUrl(file,reportProgress,signal);
   if(!imageUrl(data))throw new Error('O arquivo não contém uma imagem válida.');
   update({signature:data,signatureEnabled:true});setSignatureFileName(file.name);setMessage('');
  };
 const neighbors=(i:number,v:string)=>{
  if(!polygon)return;
  // Usa o estado mais recente mesmo em edições rápidas de trechos adjacentes.
  setSettings(current=>({...current,neighbors:setSegmentConfrontant(polygon.properties,polygon.vertices.length,current.neighbors,i,v)}));
  setSaved(false);setDirty(true);
 };
 const applyProfile=(profile:CroquiSettings['profile'])=>{
  const opts=settings.elements;
  const clean={...opts,norte:{...opts.norte,visible:true},vertices:{...opts.vertices,visible:true},cotas:{...opts.cotas,visible:true},confrontantes:{...opts.confrontantes,visible:profile!=='comercial'}};
  update({profile,elements:clean});setMessage('Perfil aplicado à prévia. Consulte as normas técnicas aplicáveis antes da emissão oficial.');
 };
 const previewPoints=roadPoints.length?[...roadPoints,...(roadCursor&&mode==='road'?[roadCursor]:[])]:[];
 const roadPreview=previewPoints.length>1?(()=>{const edges=roadBoundaries(previewPoints,roadWidth);return `<polyline points="${svgPoints(edges.left)}" fill="none" stroke="${roadColor}" stroke-width="2" stroke-dasharray="7 5"/><polyline points="${svgPoints(edges.right)}" fill="none" stroke="${roadColor}" stroke-width="2" stroke-dasharray="7 5"/>`;})():'';
 const linePreview=liveLine?`<line x1="${liveLine.x1}" y1="${liveLine.y1}" x2="${liveLine.x2}" y2="${liveLine.y2}" stroke="${lineColor}" stroke-width="3" stroke-dasharray="8 5"/>`:'';
 const selectedSegmentOverlay=polygon&&selectedSegment!==null&&selectedSegment>=0&&selectedSegment<polygon.vertices.length?(()=>{
  const pts=frameCoordinates(layoutForCroqui(polygon,settings,projectDivisions));
  const a=pts[selectedSegment],b=pts[(selectedSegment+1)%pts.length];
  if(!a||!b)return '';
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#0c64dc" stroke-width="7" stroke-opacity="0.7" stroke-linecap="round" pointer-events="none"/>`;
 })():'';
 const neighborRangeOverlay=polygon&&neighborDialog!==null&&neighborUntil!==neighborDialog?(()=>{
   const pts=frameCoordinates(layoutForCroqui(polygon,settings,projectDivisions));
   const edges=resolveConfrontantPath(vertexNames,neighborDialog,neighborUntil,neighborDirection).edges;
   return edges.map(i=>{const a=pts[i],b=pts[(i+1)%pts.length];return a&&b?`<line data-preview-confrontant-range="1" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#0969da" stroke-width="5" stroke-opacity="0.75" stroke-linecap="round" stroke-dasharray="8 4" pointer-events="none"/>`:'';}).join('');
  })():'';
  const previewOverlay=roadPreview+linePreview+selectedSegmentOverlay+neighborRangeOverlay;
 const currentSvg=portableSvg?.original===svg?portableSvg.svg:svg;
 const stripBase=previewOverlay?currentSvg.replace(/<\/svg>\s*$/,`${previewOverlay}</svg>`):currentSvg;
 const strip=hoverAreaId&&isComposite?stripBase.replace(new RegExp(`(data-croqui-division=\"${hoverAreaId}\")`), '$1 data-active-gleba=\"true\"'):stripBase;
   const workflowSteps=[{key:'project',label:'Projeto'},{key:'map',label:'Mapa'},{key:'profile',label:'Perfis'},{key:'signature',label:'Assinaturas'}] as const;
   const projectValid=Boolean(projectId&&polygon);
   const currentWorkflowIndex=workflowStep-1;
 return <main className="workspace-main cq-page"><GlobalLoading active={loading || loadingProjects} />
 <header className="cq-workflow-bar" aria-label="Ações do croqui">
  <div className="cq-workflow-start">
   <Link className="cq-back" to="/" aria-label="Voltar à tela inicial" title="Voltar à tela inicial"><ArrowLeft size={19}/></Link>
    <div className="cq-export cq-workflow-download"><button type="button" className="cq-outline" aria-label="Opções de exportação do croqui" aria-expanded={exportOpen} aria-haspopup="menu" disabled={!polygon} onClick={()=>setExportOpen(!exportOpen)}><Download size={16}/> Baixar <ChevronDown size={14}/></button>{exportOpen&&<div className="cq-menu" role="menu">
    <button role="menuitem" onClick={()=>{exportSvg();setExportOpen(false)}}><FileImage size={15}/> SVG vetorial (atual)</button>
    <button role="menuitem" onClick={()=>{exportHtml();setExportOpen(false)}}><Download size={15}/> HTML (atual)</button>
    <button role="menuitem" onClick={()=>{exportCotasCsv();setExportOpen(false)}}><Download size={15}/> Quadro completo das cotas (CSV)</button>
    <button role="menuitem" onClick={()=>{printCroqui();setExportOpen(false)}}><Printer size={15}/> Imprimir / PDF (atual)</button>
    {polys.length>1&&<>
     <hr style={{margin:'4px 0',border:0,borderTop:'1px solid #e2e8f0'}}/>
     <button role="menuitem" onClick={()=>{exportBatchCroquis('pdf');setExportOpen(false)}}><Printer size={15}/> Imprimir / PDF — Todas ({polys.length} áreas 1 por 1)</button>
     <button role="menuitem" onClick={()=>{exportBatchCroquis('html');setExportOpen(false)}}><Download size={15}/> HTML — Todas ({polys.length} áreas 1 por 1)</button>
     <button role="menuitem" onClick={()=>{exportBatchCroquis('svg');setExportOpen(false)}}><FileImage size={15}/> SVG vetorial — Todas ({polys.length} áreas 1 por 1)</button>
    </>}
   </div>}</div>
  </div>
  <ol className="cq-workflow-steps" aria-label="Etapas da geração do croqui">
   {workflowSteps.map(({key,label},index)=><li key={key} id={`cq-step-${key}`} className={`cq-workflow-step${workflowStep===index+1?' is-current':''}${index<currentWorkflowIndex?' is-complete':''}`} aria-current={workflowStep===index+1?'step':undefined}>
    <span className="cq-step-number" aria-hidden="true">{index+1}</span>
    <span>{label}</span>
    </li>)}
  </ol>
  <div className="cq-workflow-actions"><button type="button" className="cq-save-action" disabled={!polygon||saving||!dirty} onClick={()=>void save()} title="Salvar alterações do croqui na nuvem"><Save size={16}/>{saving?'Salvando…':saved?'Salvo na nuvem':'Salvar alterações'}</button></div>
 </header>
 <div className="workspace-container cq-container">
 {message&&<div className="cq-message" role="status">{message}<button type="button" onClick={()=>setMessage('')} aria-label="Fechar aviso"><X size={14}/></button></div>}
  <div className="cq-grid"><aside className="cq-side">
  <div className="cq-panel cq-config cq-panel-scroll">
   {workflowStep===1&&<section className="cq-project-card" aria-label="Projeto">
  <h2>Projeto</h2>
  <ProjectSourcePicker scope="croqui" projects={projects} projectId={projectId} loading={loadingProjects||loading} onProjectChange={id=>{setWorkflowStep(1);void openProject(id);}} onImport={importProject} onClearImport={()=>{setWorkflowStep(1);void openProject('');}} />
  {projectId&&full&&<div className="cq-project-identification"><span>Projeto selecionado</span><strong>{projectTitle(full.project||{id:projectId})}</strong><small>{[text(full.project?.municipality||full.project?.city),text(full.project?.uf||full.project?.stateCode)].filter(Boolean).join(' / ')||`${polys.length} gleba${polys.length===1?'':'s'} disponível${polys.length===1?'':'is'}`}</small></div>}
  {projectId&&full&&!polys.length&&<div className="cq-project-empty">Este projeto não contém polígonos válidos para gerar o croqui. Selecione outro projeto.</div>}
 {polygon&&polys.length>1&&<Setting label="Gerar para"><select value={featureId} onChange={e=>void selectPolygon(e.target.value)}>
  <option value="all">Imóvel completo — todas as {polys.length} áreas juntas</option>
  {polys.map((p,idx)=><option key={p.id} value={p.id}>{idx+1}. {p.name}</option>)}
 </select></Setting>}
 {polygon&&polys.length>1&&!isComposite&&<Setting label="Enquadramento na folha"><select value={framingMode} onChange={e=>setFramingMode(e.target.value as 'all'|'single')}>
  <option value="all">Contextual — destacar área e mostrar demais divisões</option>
  <option value="single">Isolado — exibir somente esta área / gleba</option>
 </select></Setting>}
   </section>}
   <div className="cq-workflow-panels" hidden={workflowStep===1}>
   <section className="cq-step-panel cq-step-panel-map" id="cq-panel-map" aria-labelledby="cq-step-map" hidden={workflowStep!==2}>
  <h2 className="cq-step-heading">Mapa</h2>
  <p className="cq-mobile-edit-hint">Toque em um rótulo para personalizar; arraste para reposicionar.</p>
  <details open className="cq-accordion"><summary>Identificação do croqui</summary><div className="cq-accordion-body">
  <Setting label="Título"><input value={settings.title} onChange={e=>update({title:e.target.value})}/></Setting>
  <Setting label="Matrícula / referência"><input placeholder="Opcional" value={settings.reference} onChange={e=>update({reference:e.target.value})}/></Setting>
  <Setting label="Responsável técnico"><input value={settings.technician} onChange={e=>update({technician:e.target.value})}/></Setting>
 </div></details>
 <details className="cq-accordion" data-group="0"><summary>Mapa de fundo</summary><div className="cq-accordion-body"><Setting label="Camada"><select value={settings.background} onChange={e=>update({background:e.target.value as CroquiSettings['background']})}><option value="satellite">Satélite (Esri, imagem atual)</option><option value="street">Ruas</option><option value="none">Nenhum (fundo branco)</option></select></Setting>
 <Setting label={`Nível de zoom do mapa: ${zoomToPercent(settings.zoom)}%`}>
  <div className="cq-zoom-control"><input type="range" aria-label="Nível de zoom do mapa (1 a 100 por cento)" min="1" max="100" step="1" value={zoomToPercent(settings.zoom)} onChange={e=>update({zoom:percentToZoom(Math.max(1,Math.min(100,Number(e.target.value))))})}/><output>{zoomToPercent(settings.zoom)}%</output></div>
  <button type="button" className="cq-outline" onClick={()=>update({zoom:percentToZoom(50),backgroundOffsetX:0,backgroundOffsetY:0})}>Ajustar ao imóvel (50%)</button>
 </Setting>
 {settings.background!=='none'&&(settings.backgroundOffsetX!==0||settings.backgroundOffsetY!==0)&&<button type="button" className="cq-outline" onClick={()=>update({backgroundOffsetX:0,backgroundOffsetY:0})}>Limpar deslocamento antigo do satélite</button>}
<Setting label="Formato de impressão"><select value={settings.paper} onChange={e=>update({paper:e.target.value as CroquiSettings['paper']})}><option value="A4">A4 · 210 × 297 mm</option><option value="A3">A3 · 420 × 297 mm</option></select></Setting>

 </div></details>
 <details className="cq-accordion" data-group="map-names"><summary>Nome no Mapa</summary><div className="cq-accordion-body">
 <label className="cq-field"><span>Novo nome</span><input value={newMapName} maxLength={180} placeholder="Identificação livre" onChange={e=>setNewMapName(e.target.value)}/></label>
 <button type="button" className="cq-outline" disabled={!polygon||!newMapName.trim()} onClick={()=>{if(!polygon)return;const count=polygon.vertices.length,lon=polygon.vertices.reduce((sum,coord)=>sum+coord[0],0)/count,lat=polygon.vertices.reduce((sum,coord)=>sum+coord[1],0)/count;const name:MapName={id:crypto.randomUUID(),text:newMapName.trim(),lon,lat,color:'#111827',size:13,angle:0};update({mapNames:[...settings.mapNames,name]});setNewMapName('');}}>Adicionar nome</button>
 {settings.mapNames.map(item=><div className="cq-map-name" key={item.id}><input aria-label="Texto do nome no mapa" value={item.text} onChange={e=>update({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,text:e.target.value}:v)})}/><div className="cq-road-actions"><input aria-label="Cor do nome" type="color" value={item.color} onChange={e=>update({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,color:e.target.value}:v)})}/><label>Tamanho<input type="number" min="6" max="36" value={item.size} onChange={e=>update({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,size:Math.max(6,Math.min(36,Number(e.target.value)||13))}:v)})}/></label><label>Rotação<input type="number" min="-180" max="180" value={item.angle} onChange={e=>update({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,angle:Math.max(-180,Math.min(180,Number(e.target.value)||0))}:v)})}/></label><button type="button" className="cq-outline" onClick={()=>update({mapNames:settings.mapNames.filter(v=>v.id!==item.id)})} aria-label="Remover nome"><Trash2 size={14}/></button></div></div>)}
 </div></details>
 <details className="cq-accordion" data-group="1"><summary>Organização dos rótulos</summary><div className="cq-accordion-body">
 <Toggle label="Compactar textos próximos automaticamente" checked={settings.labelMode==='smart'} onChange={v=>update({labelMode:v?'smart':'all'})}/>
 </div></details>
 <details className="cq-accordion" data-group="2"><summary>Elementos do croqui</summary><div className="cq-accordion-body"><div className="sv-auto-cotas-toggle"><label><input type="checkbox" checked={settings.exteriorCotas} onChange={e=>update({exteriorCotas:e.target.checked})}/> Cotas externas (tracejadas)</label><input type="color" aria-label="Cor das cotas externas e seus números" title="Cor das cotas externas e seus números" value={settings.elements.cotas.color} onChange={e=>changeElement('cotas',{color:e.target.value})}/></div><div className="cq-elements">{(Object.keys(icons) as ElementKey[]).map(k=><div className="cq-element" key={k}>
 <button type="button" aria-pressed={settings.elements[k].visible} className={`cq-element-toggle ${settings.elements[k].visible?'on':''}`} onClick={()=>changeElement(k,{visible:!settings.elements[k].visible})}>{icons[k]}</button>
 <div><Setting label={`Tamanho: ${settings.elements[k].size}%`}><input type="range" min={k==='cotas'?40:50} max="250" step="5" value={settings.elements[k].size} onChange={e=>changeElement(k,{size:Number(e.target.value)})}/></Setting><Setting label="Cor"><input type="color" value={settings.elements[k].color} onChange={e=>changeElement(k,{color:e.target.value})}/></Setting></div></div>)}</div>
 <p className="cq-hint">A grade técnica e a escala gráfica não fazem parte deste croqui.</p>
 </div></details>
 <details className="cq-accordion" data-group="3"><summary>Vértices e confrontantes</summary><div className="cq-accordion-body">{isComposite&&<div className="sv-vertex-auto-actions"><button type="button" className="cq-outline" onClick={autoHideStraight}>Ocultar alinhados</button><button type="button" className="cq-outline" onClick={restoreHiddenVertices}>Exibir todos</button></div>}
 <details className="cq-numbering sv-custom-cotas-panel"><summary>Cotas personalizadas</summary><div className="cq-numbering-fields"><p className="cq-hint">Escolha dois vértices. A distância será medida diretamente, sem somar segmentos intermediários. Pode ocultar cotas automáticas em "Elementos do croqui".</p>
 {isComposite&&<Setting label="Gleba ativa"><select value={cotaTarget} onChange={e=>setHoverAreaId(e.target.value)}>{polys.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></Setting>}
 {cotaVertices.length>1&&<><Setting label="Vértice de origem"><select value={Math.min(cotaFrom,cotaVertices.length-1)} onChange={e=>setCotaFrom(Number(e.target.value))}>{cotaVertices.map((_,i)=><option value={i} key={i}>V-{String(i+1).padStart(2,'0')}</option>)}</select></Setting>
 <Setting label="Vértice de destino"><select value={Math.min(cotaTo,cotaVertices.length-1)} onChange={e=>setCotaTo(Number(e.target.value))}>{cotaVertices.map((_,i)=><option value={i} key={i}>V-{String(i+1).padStart(2,'0')}</option>)}</select></Setting>
 <button type="button" className="cq-outline" disabled={cotaFrom===cotaTo||cotaFrom>=cotaVertices.length||cotaTo>=cotaVertices.length} onClick={()=>update({customCotas:[...settings.customCotas,{id:crypto.randomUUID(),target:cotaTarget,from:cotaFrom,to:cotaTo}]})}>Adicionar cota direta</button></>}
 {settings.customCotas.filter(c=>c.target===cotaTarget).map(c=><div key={c.id} className="sv-active-vertex-row"><span>V-{String(c.from+1).padStart(2,'0')} → V-{String(c.to+1).padStart(2,'0')}</span><button type="button" className="cq-outline" onClick={()=>update({customCotas:settings.customCotas.filter(v=>v.id!==c.id)})}>Remover</button></div>)}
 </div></details>
 {isComposite&&<section className="cq-multi-area-list" aria-label="Edição das glebas do imóvel completo">
  <p className="cq-hint">Imóvel completo: {polys.length} áreas independentes. Expanda cada gleba para editar seus próprios vértices, confrontantes e cores. Salve para sincronizar todas as alterações.</p>
  {polys.map((part,i)=>{
   const local=areaSettings[part.id]||defaultCroquiSettings();
   const partNames=croquiVertexNames(part,local);
   const partStyles=settings.featureStyles?.[part.id]||{};
   const partColor=appearanceOf(part.id);
   const validHex=(value:string)=>/^#[0-9a-f]{6}$/i.test(value);
   return <details className="cq-multi-area-card" key={part.id} open={hoverAreaId===part.id} onToggle={e=>{if(e.currentTarget.open&&hoverAreaId!==part.id)setHoverAreaId(part.id);}}>
    <summary><span className="cq-multi-area-dot" style={{background:validHex(partColor)?partColor:'#dbeafe'}}/><span>{i+1}. {part.name}</span><small>{part.vertices.length} vértices · {part.vertices.length} divisas</small></summary>
    <div className="cq-multi-area-body">
     <div className="cq-multi-colors"><Setting label="Preenchimento"><input type="color" value={validHex(partColor)?partColor:'#dbeafe'} onChange={e=>update({featureStyles:{...settings.featureStyles,[part.id]:{...partStyles,fillColor:e.target.value}}})}/></Setting><Setting label="Borda"><input type="color" value={validHex(partStyles.strokeColor||'')?partStyles.strokeColor!:'#17212b'} onChange={e=>update({featureStyles:{...settings.featureStyles,[part.id]:{...partStyles,strokeColor:e.target.value}}})}/></Setting></div>
     <Setting label="Nome exibido na planta"><input maxLength={120} value={settings.featureNames?.[part.id]??part.name} onChange={e=>update({featureNames:{...settings.featureNames,[part.id]:e.target.value}})}/></Setting>
     <strong className="cq-multi-area-subheading">Vértices de {part.name}</strong>
     <div className="cq-multi-vertices">{part.vertices.map((_,vi)=><div className="cq-multi-vertex" key={vi}>
      <Setting label={`Vértice ${vi+1}`}><input value={local.names[vi]??partNames[vi]} onChange={e=>updateAreaSettings(part.id,{names:part.vertices.map((__,j)=>j===vi?e.target.value:(local.names[j]??partNames[j]))})}/></Setting>
      <label className="cq-multi-visibility"><input type="checkbox" checked={!local.hiddenVertices.includes(vi)} onChange={e=>updateAreaSettings(part.id,{hiddenVertices:e.target.checked?local.hiddenVertices.filter(n=>n!==vi):[...local.hiddenVertices,vi]})}/> Exibir</label>
     </div>)}</div>
     <strong className="cq-multi-area-subheading">Confrontantes de {part.name}</strong>
     {part.vertices.map((_,vi)=><Setting key={`neighbor-${vi}`} label={`${partNames[vi]} → ${partNames[(vi+1)%partNames.length]}`}><input value={local.neighbors[vi]??readConfrontation(part.properties,vi,part.vertices.length)} onChange={e=>updateAreaSettings(part.id,{neighbors:setSegmentConfrontant(part.properties,part.vertices.length,local.neighbors,vi,e.target.value)})} placeholder="Confrontante desta divisa"/></Setting>)}
     <button type="button" className="cq-outline" onClick={()=>chooseAreaForAdvancedEditing(part.id)}>Abrir edição avançada desta gleba</button>
    </div>
   </details>
  })}
 </section>}

 {!isComposite&&<><Setting label="Tipo de identificação"><select value={settings.prefix} onChange={e=>{const selected=e.target.value as CroquiSettings['prefix'];update({prefix:selected,names:selected==='auto'?[]:polygon?.vertices.map((_,i)=>`${selected}-${String(i+1).padStart(2,'0')}`)||[]});setMessage('Identificação dos vértices atualizada no rascunho. Confira o desenho antes de salvar.');}}><option value="auto">Automático pelo projeto</option><option value="V">V · Vértice</option><option value="P">P · Ponto</option></select></Setting>
 {polygon&&polygon.vertices.map((_,i)=><div key={i} className="cq-neighbor-row"><label>De {vertexNames[i]} a {vertexNames[(i+1)%vertexNames.length]}</label><input value={settings.neighbors[i]!==undefined&&settings.neighbors[i]!=='[object Object]'?settings.neighbors[i]:readConfrontation(polygon.properties,i,polygon.vertices.length)} onChange={e=>neighbors(i,e.target.value)} placeholder="Nome do confrontante"/><button className="cq-more" type="button" title="Cadastrar confrontante e selecionar até qual vértice" onClick={()=>{setNeighborDialog(i);setNeighborUntil((i+1)%polygon.vertices.length);setNeighborDirection('auto');const label=settings.neighbors[i]!==undefined&&settings.neighbors[i]!=='[object Object]'?settings.neighbors[i]:readConfrontation(polygon.properties,i,polygon.vertices.length);setNeighborDraft({...emptyNeighbor(),...settings.neighborDetails[String(i)],property:settings.neighborDetails[String(i)]?.property||label});}}>⋯</button></div>)}
 <p className="cq-hint">Uma identificação por confrontação contínua. Use ⋯ para cadastrar um intervalo.</p></>}
 {!isComposite&&<details className="cq-vertex-visibility"><summary>Ocultar vértices</summary><div className="sv-vertex-auto-actions"><button type="button" className="cq-outline" onClick={autoHideStraight}>Ocultar alinhados</button><button type="button" className="cq-outline" onClick={restoreHiddenVertices}>Exibir todos</button></div><div className="cq-vertex-checks">{vertexNames.map((name,index)=><label key={index}><input type="checkbox" checked={settings.hiddenVertices.includes(index)} onChange={e=>update({hiddenVertices:e.target.checked?[...settings.hiddenVertices,index]:settings.hiddenVertices.filter(item=>item!==index)})}/>{name}</label>)}</div></details>}
 </div></details>
 <details className="cq-accordion" data-group="4"><summary>Linhas técnicas</summary><div className="cq-accordion-body"><div className="cq-toolrow"><button type="button" aria-label="Desenhar linha" aria-pressed={mode==='line'} className={mode==='line'?'on':''} onClick={()=>switchMode('line')} title="Desenhar linha"><PenLine size={16}/></button><button type="button" aria-label="Editar linhas" aria-pressed={mode==='edit'} className={mode==='edit'?'on':''} onClick={()=>switchMode('edit')} title="Editar extremidade"><MousePointer2 size={16}/></button><button type="button" aria-label="Desfazer última linha" onClick={()=>update({lines:settings.lines.slice(0,-1)})} disabled={!settings.lines.length} title="Desfazer última linha"><RotateCcw size={16}/></button><button type="button" aria-label="Remover todas as linhas" onClick={()=>update({lines:[]})} disabled={!settings.lines.length} title="Remover todas as linhas"><Trash2 size={16}/></button></div>
 {mode==='line'&&<small className="cq-hint">Clique e arraste a partir de um vértice ou da borda do imóvel; solte para concluir a linha.</small>}{mode==='edit'&&<small className="cq-hint">Arraste as pontas ou o corpo da linha técnica, ou os pontos de uma servidão.</small>}
 <Setting label="Linha automática do trecho"><select value={autoSegment} onChange={e=>setAutoSegment(Number(e.target.value))}>{vertexNames.map((n,i)=><option key={i} value={i}>{n} a {vertexNames[(i+1)%vertexNames.length]}</option>)}</select></Setting>
 <button className="cq-outline" disabled={!polygon} onClick={addAutomaticLine}>Criar linha automática</button><Setting label="Cor das linhas"><input type="color" value={lineColor} onChange={e=>setLineColor(e.target.value)}/></Setting>
 </div></details>
 <details className="cq-accordion" data-group="5"><summary>Servidões</summary><div className="cq-accordion-body"><div className="cq-toolrow"><button className={mode==='road'?'on':''} onClick={()=>switchMode('road')}><PenLine size={15}/> Desenhar</button><button disabled={!settings.easements.length} onClick={()=>update({easements:settings.easements.slice(0,-1)})}><Trash2 size={15}/> Última</button></div>
 {mode==='road'&&<><small className="cq-hint">Clique nos pontos do percurso. Dê dois cliques ou use Finalizar servidão.</small><button className="cq-primary" onClick={finishRoad}>Finalizar servidão ({roadPoints.length} pontos)</button><button className="cq-outline" onClick={()=>switchMode('none',true)}>Cancelar desenho</button></>}
 <Setting label="Cor das bordas da nova servidão"><input type="color" value={roadColor} onChange={e=>setRoadColor(e.target.value)}/></Setting>
 <Setting label={`Largura da nova servidão: ${roadWidth}px`}><input type="range" min="8" max="90" value={roadWidth} onChange={e=>setRoadWidth(Number(e.target.value))}/></Setting>
 {settings.easements.map((road,i)=><div key={road.id||i} className={`cq-road-row ${selectedRoad===i?'selected':''} ${road.visible===false?'cq-road-hidden':''}`}><button className="cq-outline" onClick={()=>{if(!switchMode('edit'))return;setSelectedRoad(i);}} disabled={road.visible===false}>Editar servidão {i+1}{road.visible===false?' (oculta)':''}</button><Setting label={`Distância entre bordas: ${Number(road.width.toFixed(2))}px`}><input type="range" min="8" max="90" value={road.width} onChange={e=>update({easements:settings.easements.map((r,j)=>i===j?{...r,sourceEdges:undefined,width:Number(e.target.value),widthMeters:(()=>{if(!polygon||!validGeoPoints(r.geoPoints))return undefined;const layout=layoutForCroqui(polygon,settings,projectDivisions);return Number(e.target.value)*156543.03392804097*Math.cos(layout.center[1]*Math.PI/180)/2**layout.zoom;})()}:r)})}/></Setting><div className="cq-road-actions"><button type="button" className="cq-outline" aria-pressed={road.visible===false} onClick={()=>{update({easements:settings.easements.map((r,j)=>i===j?{...r,visible:r.visible===false}:r)});if(selectedRoad===i)setSelectedRoad(null);}}>{road.visible===false?<Eye size={15}/>:<EyeOff size={15}/>} {road.visible===false?'Exibir':'Ocultar'}</button><button type="button" className="cq-outline" onClick={()=>{update({easements:settings.easements.filter((_,j)=>j!==i)});setSelectedRoad(null);}}><Trash2 size={14}/> Excluir</button></div></div>)}
  </div></details>
  </section>
  <section className="cq-step-panel cq-step-panel-profile" id="cq-panel-profile" aria-labelledby="cq-step-profile" hidden={workflowStep!==3}>
   <h2 className="cq-step-heading">Perfis de apresentação</h2>
   <p className="cq-step-note">Os perfis ajustam a apresentação do croqui. Não certificam conformidade normativa.</p>
   <Setting label="Perfil"><select value={settings.profile} onChange={e=>applyProfile(e.target.value as CroquiSettings['profile'])}><option value="custom">Personalizado (manual)</option><option value="incra">INCRA / Cartório</option><option value="ambiental">SEIA / CEFIR Bahia (Ambiental)</option><option value="comercial">Comercial / Executivo</option><option value="reurb">REURB / Regularização fundiária</option></select></Setting>
   <button type="button" className="cq-outline" onClick={()=>applyProfile(settings.profile)}>Aplicar perfil selecionado</button>
  </section>
  <section className="cq-step-panel cq-step-panel-signature" id="cq-panel-signature" aria-labelledby="cq-step-signature" hidden={workflowStep!==4}>
 <h2 className="cq-step-heading">Assinaturas</h2>
 <Toggle label="Incluir assinatura técnica" checked={settings.signatureEnabled} onChange={v=>update({signatureEnabled:v})}/>
 <FileUploadField label="Importar imagem da assinatura" description={signatureFileName || (settings.signature ? 'Assinatura já carregada · PNG, JPEG ou WebP · até 2 MB' : 'PNG, JPEG ou WebP · até 2 MB')} accept="image/png,image/jpeg,image/webp" maxBytes={2_000_000} cancellable onFile={loadSignature} onRemove={()=>{update({signature:'',signatureEnabled:false});setSignatureFileName('');setSaved(false);setDirty(true);}}/>
 <SignaturePadControl label="Desenhar assinatura na tela" onApply={dataUrl=>{update({signature:dataUrl,signatureEnabled:true});setSignatureFileName('Assinatura desenhada na tela');}}/>
 <button type="button" className="cq-outline cq-signature-remove" disabled={!settings.signature} onClick={()=>{update({signature:'',signatureEnabled:false});setSignatureFileName('');}}><Trash2 size={15}/> Remover assinatura</button>
 <Setting label={`Tamanho: ${settings.signatureSize}%`}><input type="range" min="20" max="110" value={settings.signatureSize} onChange={e=>update({signatureSize:Number(e.target.value)})}/></Setting>
 {settings.signature&&<img className="cq-signature-preview" src={settings.signature} alt="Prévia da assinatura importada"/>}
   </section>
  </div>
  </div>
   <div className="cq-panel-footer">
    <span>Etapa {workflowStep} de {workflowSteps.length}</span>
    <div className="cq-panel-actions">
     {workflowStep>1&&<button type="button" className="cq-outline" onClick={()=>setWorkflowStep(step=>(step-1) as 1|2|3|4)}>Anterior</button>}
     {workflowStep<workflowSteps.length&&<button type="button" className="cq-next-button" disabled={!projectValid} onClick={()=>setWorkflowStep(step=>(step+1) as 1|2|3|4)}>Próximo <span aria-hidden="true">→</span></button>}
    </div>
   </div>
 </aside>
  <div className="cq-workspace"><div className="cq-stage-toolbar"><strong>Prévia do croqui</strong><span>{settings.paper} · atualização em tempo real</span></div><div className="cq-viewer" ref={viewerRef}>
  {loading?<div className="cq-empty">Carregando projeto...</div>:polygon?<div className={`cq-paper ${settings.paper==='A3'?'cq-paper-a3':''} ${mode==='line'||mode==='road'?'cq-interaction-mode':''}`} style={{width:`${previewBaseWidth*previewZoom/100}px`} as CSSProperties} ref={previewRef} onContextMenu={handleContextMenu} onMouseOver={hoverCroquiDivision} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} onDoubleClick={()=>{if(workflowStep>1&&mode==='road'&&latestRoad.current.length>1)finishRoad();}}>
 <div className="cq-svg" dangerouslySetInnerHTML={{__html:strip}}/>

  </div>:<div className="cq-empty">Selecione ou importe um projeto para visualizar o croqui.</div>}
  </div>{workflowStep>1&&segmentTableOpen&&polygon&&!isComposite&&<section className="cq-segment-panel" aria-label="Quadro de rumos e distâncias">
 <div className="cq-segment-head"><div><strong>Rumos, azimutes e distâncias</strong><small>{technicalSegments.length} trechos · Perímetro aprox. {fmt(technicalTotal,2)} m</small></div><div className="cq-segment-tools"><button type="button" onClick={exportSegmentTableCsv} title="Exportar o quadro em CSV"><Download size={14}/> CSV</button><button type="button" onClick={()=>{setSelectedSegment(null);setSegmentTableOpen(false);}} aria-label="Fechar quadro"><X size={16}/></button></div></div>
 <div className="cq-segment-scroll"><table className="cq-segment-table"><thead><tr><th>Trecho</th><th>Azimute</th><th>Rumo</th><th>Distância</th><th>Confrontante</th></tr></thead><tbody>{technicalSegments.map(row=><tr key={row.index} className={selectedSegment===row.index?'cq-segment-selected':''}><td><button type="button" aria-pressed={selectedSegment===row.index} title="Destacar trecho no croqui" onClick={()=>setSelectedSegment(selectedSegment===row.index?null:row.index)}>{row.from} → {row.to}</button></td><td>{row.azimuthLabel}</td><td>{row.bearingLabel}</td><td className="cq-segment-number">{fmt(row.distanceM,2)} m</td><td title={row.neighbor}>{row.neighbor||'—'}</td></tr>)}</tbody></table></div>
 <p className="cq-segment-disclaimer">Valores aproximados calculados das coordenadas geográficas WGS84; não substituem cálculos topográficos em sistema de referência apropriado. Clique em um trecho para destacá-lo.</p>
  </section>}<div className={`cq-bottom${workflowStep===1?' cq-bottom-hidden':''}`} role="toolbar" aria-label="Ferramentas do Croqui"><div className="cq-toolbar-left"><button type="button" className="cq-primary" disabled={!polygon} onClick={autoOrganize} title="Organizar rótulos"><WandSparkles size={15}/> Organizar rótulos</button><button type="button" className="cq-outline" disabled={!polygon} onClick={organizeConfrontants} title="Associar confrontantes aos trechos">Confrontantes</button><button type="button" className="cq-outline" disabled={!polygon} onClick={()=>setConfrontantImportOpen(true)} aria-label="Colar texto dos confrontantes" title="Colar texto dos confrontantes">⋯</button><button type="button" className="cq-outline" disabled={!polygon} onClick={restore} title="Restaurar rascunho"><RotateCcw size={15}/></button><button type="button" className="cq-outline" disabled={!settings.lines.length} onClick={()=>update({lines:settings.lines.slice(0,-1)})} title="Desfazer linha"><ArrowLeft size={15}/></button></div>
 <div className="cq-zoom cq-toolbar-middle"><button type="button" disabled={!polygon||previewZoom<=40} aria-label="Reduzir zoom" onClick={()=>setPreviewZoom(value=>clamp(value-5,40,180))}>−</button><strong>{previewZoom}%</strong><button type="button" disabled={!polygon||previewZoom>=180} aria-label="Aumentar zoom" onClick={()=>setPreviewZoom(value=>clamp(value+5,40,180))}>+</button></div>
 <div className="cq-toolbar-right"><button type="button" className="cq-outline cq-secondary" disabled={!polygon||isComposite} title={isComposite?'Escolha uma gleba para visualizar seus rumos e distâncias':'Quadro de rumos e distâncias'} aria-expanded={segmentTableOpen} onClick={()=>{setSegmentTableOpen(v=>!v);setSelectedSegment(null);}}>Rumos e distâncias</button></div>
 </div></div></div></div> {confrontantImportOpen&&polygon&&<ConfrontantImportDialog vertices={(isComposite?(polys.find(p=>p.id===cotaTarget)||polys[0]):polygon).vertices} names={isComposite?croquiVertexNames(polys.find(p=>p.id===cotaTarget)||polys[0],areaSettings[polys.find(p=>p.id===cotaTarget)?.id||polys[0]?.id]||defaultCroquiSettings()):vertexNames} existing={(isComposite?(areaSettings[polys.find(p=>p.id===cotaTarget)?.id||polys[0]?.id]||defaultCroquiSettings()):settings).neighbors} onClose={()=>setConfrontantImportOpen(false)} onApply={importConfrontations}/>} {croquiContext&&<div className="cq-vertex-context cq-edit-context" style={{left:croquiContext.x,top:croquiContext.y}}><div className="cq-context-head"><strong>{croquiContext.kind==='polygon'||croquiContext.kind==='division'?'Aparência da área':'Personalizar rótulo'}</strong><button onClick={()=>setCroquiContext(null)} aria-label="Fechar"><X size={15}/></button></div>{croquiContext.kind==='division'&&polys.some(p=>p.id===croquiContext.key)&&<button type="button" className="cq-outline" onClick={()=>{chooseAreaForAdvancedEditing(croquiContext.key);setCroquiContext(null);}}>Editar vértices e confrontantes desta gleba</button>}{croquiContext.kind==='polygon'?(
  <>
    <Setting label="Cor de preenchimento"><input type="color" value={settings.polygonFill} onChange={e=>update({polygonFill:e.target.value})}/></Setting>
    <Setting label={`Opacidade do preenchimento: ${Math.round(settings.polygonFillOpacity*100)}%`}><input type="range" min="0" max="100" value={Math.round(settings.polygonFillOpacity*100)} onChange={e=>update({polygonFillOpacity:Number(e.target.value)/100})}/></Setting>
    <Setting label="Cor da borda"><input type="color" value={settings.polygonStroke} onChange={e=>update({polygonStroke:e.target.value})}/></Setting>
    <Setting label={`Espessura da borda: ${settings.polygonStrokeWidth||2.4}px`}>
      <input type="range" min="1" max="8" step="0.5" value={settings.polygonStrokeWidth||2.4} onChange={e=>update({polygonStrokeWidth:Number(e.target.value)})}/>
    </Setting>
  </>
):croquiContext.kind==='division'?(
  <>
    <Setting label="Cor de preenchimento">
      <input type="color" value={appearanceOf(croquiContext.key)} onChange={e=>{
        const prev=settings.featureStyles||{};
        update({featureStyles:{...prev,[croquiContext.key]:{...prev[croquiContext.key],fillColor:e.target.value}}});
      }}/>
    </Setting>
    <Setting label={`Opacidade do preenchimento: ${Math.round((settings.featureStyles?.[croquiContext.key]?.fillOpacity??.24)*100)}%`}><input type="range" min="0" max="100" value={Math.round((settings.featureStyles?.[croquiContext.key]?.fillOpacity??.24)*100)} onChange={e=>{const prev=settings.featureStyles||{};update({featureStyles:{...prev,[croquiContext.key]:{...prev[croquiContext.key],fillOpacity:Number(e.target.value)/100}}});}}/></Setting>
    <Setting label="Cor da borda">
      <input type="color" value={settings.featureStyles?.[croquiContext.key]?.strokeColor||'#17212b'} onChange={e=>{
        const prev=settings.featureStyles||{};
        update({featureStyles:{...prev,[croquiContext.key]:{...prev[croquiContext.key],strokeColor:e.target.value}}});
      }}/>
    </Setting>
    <Setting label={`Espessura da borda: ${settings.featureStyles?.[croquiContext.key]?.strokeWidth||2.6}px`}>
      <input type="range" min="1" max="8" step="0.5" value={settings.featureStyles?.[croquiContext.key]?.strokeWidth||2.6} onChange={e=>{
        const prev=settings.featureStyles||{};
        update({featureStyles:{...prev,[croquiContext.key]:{...prev[croquiContext.key],strokeWidth:Number(e.target.value)}}});
      }}/>
    </Setting>
  </>
):contextMapName?(
  <>
    <Suspense fallback={<small>Carregando controles 2D...</small>}>
      <KonvaLabelEditor key={croquiContext.key} label={contextMapName.text} color={contextMapName.color} size={contextMapName.size/16*100} angle={contextMapName.angle} onTransform={(size,angle)=>update({mapNames:updateMapNameAppearance(settings.mapNames,croquiContext.key,{size:Math.round(size*16/100),angle})})}/>
    </Suspense>
    <Setting label="Cor deste texto"><input type="color" value={contextMapName.color} onChange={e=>update({mapNames:updateMapNameAppearance(settings.mapNames,croquiContext.key,{color:e.target.value})})}/></Setting>
    <Setting label={`Rotação deste texto: ${contextMapName.angle}°`}><input type="range" min="-180" max="180" step="1" value={contextMapName.angle} onChange={e=>update({mapNames:updateMapNameAppearance(settings.mapNames,croquiContext.key,{angle:Number(e.target.value)})})}/></Setting>
    <Setting label={`Tamanho deste texto: ${contextMapName.size}px`}><input type="range" min="6" max="36" step="1" value={contextMapName.size} onChange={e=>update({mapNames:updateMapNameAppearance(settings.mapNames,croquiContext.key,{size:Number(e.target.value)})})}/></Setting>
    <button type="button" className="cq-outline" onClick={()=>update({mapNames:updateMapNameAppearance(settings.mapNames,croquiContext.key,{color:'#111827',size:13,angle:0})})}><RotateCcw size={14}/> Restaurar cor, rotação e tamanho</button>
  </>
):(
  <>
    <Suspense fallback={<small>Carregando controles 2D...</small>}>
      <KonvaLabelEditor key={croquiContext.key} label={Array.from(previewRef.current?.querySelectorAll('[data-croqui-label]')||[]).find(el=>el.getAttribute('data-croqui-label')===croquiContext.key)?.textContent||croquiContext.key} color={settings.labelColors[croquiContext.key]||'#17212b'} size={settings.labelSizes?.[croquiContext.key]??100} angle={settings.labelAngles[croquiContext.key]??0} onTransform={(size,angle)=>update({labelSizes:{...settings.labelSizes,[croquiContext.key]:size},labelAngles:{...settings.labelAngles,[croquiContext.key]:angle}})}/>
    </Suspense>
    <Setting label="Cor deste texto"><input type="color" value={settings.labelColors[croquiContext.key]||'#17212b'} onChange={e=>update({labelColors:{...settings.labelColors,[croquiContext.key]:e.target.value}})}/></Setting>
    <Setting label={`Rotação deste texto: ${settings.labelAngles[croquiContext.key]??0}°`}><input type="range" min="-180" max="180" step="1" value={settings.labelAngles[croquiContext.key]??0} onChange={e=>update({labelAngles:{...settings.labelAngles,[croquiContext.key]:Number(e.target.value)}})}/></Setting>
    <Setting label={`Tamanho deste texto: ${settings.labelSizes?.[croquiContext.key]??100}%`}><input type="range" min="40" max="250" step="5" value={settings.labelSizes?.[croquiContext.key]??100} onChange={e=>update({labelSizes:{...settings.labelSizes,[croquiContext.key]:Number(e.target.value)}})}/></Setting>
    <button type="button" className="cq-outline" onClick={()=>restoreLabelAppearance(croquiContext.key)}><RotateCcw size={14}/> Restaurar cor, rotação e tamanho</button>
  </>
)}</div>} {neighborDialog!==null&&<div className="cq-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setNeighborDialog(null)}}><div className="cq-dialog" role="dialog" aria-modal="true" aria-label="Cadastro do confrontante"><div className="cq-dialog-head"><h2>Confrontante {vertexNames[neighborDialog]} a {vertexNames[neighborUntil]}</h2><button type="button" className="cq-outline" onClick={()=>setNeighborDialog(null)} aria-label="Fechar cadastro do confrontante"><X size={17}/></button></div><p>Complete o cadastro e selecione os vértices inicial e final. A planta exibirá somente um nome para cada confrontação contínua.</p><Setting label="Confrontação até o vértice"><select value={neighborUntil} onChange={e=>setNeighborUntil(Number(e.target.value))}>{vertexNames.map((name,j)=><option key={j} value={j} disabled={j===neighborDialog}>{name}</option>)}</select></Setting><Setting label="Caminho da confrontação"><select value={neighborDirection} onChange={e=>setNeighborDirection(e.target.value as ConfrontantPath)}><option value="auto">Acompanhar numeração dos vértices</option><option value="forward">Via {vertexNames[(neighborDialog+1)%vertexNames.length]}</option><option value="reverse">Via {vertexNames[(neighborDialog-1+vertexNames.length)%vertexNames.length]}</option></select></Setting><small className="cq-hint" title={resolveConfrontantPath(vertexNames,neighborDialog,neighborUntil,neighborDirection).vertices.map(j=>vertexNames[j]).join(' → ')}>Trecho: {confrontantPathSummary(vertexNames,resolveConfrontantPath(vertexNames,neighborDialog,neighborUntil,neighborDirection).vertices)}</small>
 {([['property','Nome da propriedade','showProperty'],['owner','Nome do proprietário','showOwner'],['cpf','CPF/CNPJ','showCpf'],['rg','RG','showRg']] as const).map(([field,label,show])=><div className="cq-dialog-field" key={field}><Setting label={label}><input value={neighborDraft[field]} onChange={e=>setNeighborDraft(d=>({...d,[field]:field==='cpf'?maskBrazilianDocumentInput(e.target.value):field==='rg'?formatBrazilianRg(e.target.value):e.target.value}))}/></Setting><Toggle label="Exibir na planta" checked={neighborDraft[show]} onChange={v=>setNeighborDraft(d=>({...d,[show]:v}))}/></div>)}
 <Setting label="Tipo do limite / divisa"><input value={neighborDraft.limitType||''} placeholder="Cerca, rio, estrada..." onChange={e=>setNeighborDraft(d=>({...d,limitType:e.target.value}))}/></Setting>
 <div className="cq-dialog-actions"><button className="cq-outline" onClick={()=>setNeighborDialog(null)}>Cancelar</button><button className="cq-primary" onClick={()=>{const i=neighborDialog;const display=([['property','showProperty'],['owner','showOwner'],['cpf','showCpf'],['rg','showRg']] as const).filter(([f,t])=>neighborDraft[t]&&neighborDraft[f].trim()).map(([f])=>neighborDraft[f].trim()).join(' · ');const count=polygon?.vertices.length||0;const next=resolveSegmentConfrontants(polygon!.properties,count,settings.neighbors);const details={...settings.neighborDetails};if(count&&neighborUntil!==i){for(const j of resolveConfrontantPath(vertexNames,i,neighborUntil,neighborDirection).edges){next[j]=display;details[String(j)]={...neighborDraft};}}update({neighbors:next,neighborDetails:details});setNeighborDialog(null);}}>Salvar cadastro</button></div></div></div>}
</main>;
}
