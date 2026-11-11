import { projectOwners } from '../projects/projectOwners';
import {maskBrazilianDocumentInput,formatBrazilianRg} from '../../lib/documentIdentity';
import {GlobalLoading} from '../../components/GlobalLoading';
import {requestConfirmation} from '../../components/ConfirmDialogHost';
import {addRouteTransitionConfirmation} from '../../lib/routeTransitions';
import { FileUploadField } from '../../components/FileUploadField';
import { ProjectSourcePicker } from '../../components/ProjectSourcePicker';
import { writeOfflineDraft } from '../../lib/offlineDraftStore';
import { readFileAsDataUrl } from '../../lib/readFileAsDataUrl';
import { DocumentWorkflowBar } from '../../components/layout/DocumentWorkflowBar';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Download, FileText, Map as MapIcon, Palette, PenLine, Printer, RotateCcw, Save, WandSparkles, Trash2, X, Edit3 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ConfrontantImportDialog } from '../../components/ConfrontantImportDialog';
import { getDocumentCustomization } from '../customization/customizationApi';
import { listProjects,getProject,projectTitle,type Project,type ProjectFull } from '../projects/projectsApi';
import { getPolygons,record,text,type SurveyPolygon } from '../memorial/memorialEngine';
import { type CroquiSettings, type NeighborDetails } from '../memorial/croquiRenderer';
import { readCroquiSettingsForDocument, readSharedCroquiSettings } from '../croqui/sharedCroquiSettings';
import {readMapAppearance,mapNameForLabel,updateMapNameAppearance,type MapName} from '../croqui/sharedMapAppearance';
import { readProjectDivisions } from '../croqui/projectDivisions';
import { percentToZoom, zoomToPercent } from '../../lib/percentZoom';
import { readConfrontation, resolveSegmentConfrontants, setSegmentConfrontant, roadBoundaries, smoothRoadCenterline, openRoadEdgesSvg, svgPoints } from '../croqui/croquiGeometry';
import { resolveConfrontantPath, confrontantPathSummary, type ConfrontantPath } from '../croqui/confrontantRange';
import {suggestHiddenStraightVertices} from '../../lib/cartographicAutomation';
import {suggestConfrontantByPosition,readConfrontantLabelPositions,applyConfrontantSuggestions,captureConfrontantPins,transferConfrontantAppearance,transferHiddenConfrontantLabels,confrontantPinKey} from '../../lib/confrontantVisualOrganizer';
import {compositeExteriorEdges,suggestCompositeConfrontants,type CompositeConfrontantLabel} from '../../lib/compositeConfrontants';
import { readDocumentDraft,saveDocumentDraft,readProjectDocumentIdentity } from './cloudDraft';
import {readConfrontants,saveConfrontants} from './confrontantRegistry';
import {sheetDraftKey,parseLocalSheetDraft,selectSheetDraft,sheetDraftMatches} from './sheetDraftState';
import { renderTechnicalSheet,defaultSheet,defaultSheetForPolygon,normalizeSheet,sheetDivisionColor,mapPointCoordinates,sheetProjection,sheetSignatureBox,clampSheetSignatureOffset,type SheetSettings,type SheetElement,type SheetTechnicalLine,type SheetRoad } from './technicalSheet';
import {resolveSheetSignature,isSheetSignatureImage} from './sheetSignature';
import {buildPublicMapUrl,publicMapUrlForProject} from '../public/publicMapData';
import { SignaturePadControl } from '../../components/SignaturePadControl';
import './documents.css';
import {tarefaCaption,tarefaValueForState} from '../../lib/agrarianMeasure';
const blankNeighbor=():NeighborDetails=>({property:'',owner:'',cpf:'',rg:'',showProperty:true,showOwner:false,showCpf:false,showRg:false});
const inSheetMap=(point:{x:number;y:number})=>point.x>=112&&point.x<=912&&point.y>=40&&point.y<=885;
const distance2=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
/** A prévia emprega as mesmas bordas e curvatura usadas no SVG final. */
const roadDraftSvg=(points:{x:number;y:number}[],width:number,color:string)=>{
 if(points.length<2)return '';
 const center=smoothRoadCenterline(points);
 const {left,right}=roadBoundaries(center,width);
 if(left.length<2)return '';
 return `<g clip-path="url(#mapClipGeo)" pointer-events="none"><polygon points="${svgPoints([...left,...right.slice().reverse()])}" fill="${color}" fill-opacity=".12"/>${openRoadEdgesSvg(left,right,color,2.2)}</g>`;
};

const labels:Record<SheetElement,string>={cotas:'Cotas',gleba:'Cotas da gleba',vertices:'Vértices',confrontantes:'Confrontantes',norte:'Norte',grade:'Grade UTM (referência)',escala:'Escala gráfica'};
const fileExport=(name:string,body:string,mime:string)=>{const a=document.createElement('a');const u=URL.createObjectURL(new Blob([body],{type:mime}));a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);};
const dateToday=()=>new Date().toLocaleDateString('pt-BR');
const downloadHtml=(svg:string,title:string,paper:'A4'|'A3')=>`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title.replace(/</g,'')}</title><style>html,body{margin:0;background:#fff}svg{display:block;width:100%;max-height:100vh}.sheet-page{page-break-after:always;break-after:page}.sheet-page:last-child{page-break-after:auto;break-after:auto}@media print{@page{size:${paper} landscape;margin:0}svg{width:100vw;height:100vh}}</style></head><body>${svg}</body></html>`;

export function TechnicalSheetsPage(){
 const [loadingProjects,setLoadingProjects]=useState(true);
 const {session}=useAuth(); const [projects,setProjects]=useState<Project[]>([]),[full,setFull]=useState<ProjectFull|null>(null),[projectId,setProjectId]=useState(''),[featureId,setFeatureId]=useState('');
 const [prefs,setPrefs]=useState<Record<string,unknown>>({}),[settings,setSettings]=useState<SheetSettings>(defaultSheet),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
 const [tab,setTab]=useState<'project'|'custom'>('project'),[projectStep,setProjectStep]=useState<0|1>(0),[section,setSection]=useState<'prancha'|'mapa'|'perfil'|'assinatura'>('prancha'),[previewZoom,setPreviewZoom]=useState(100),[downloadOpen,setDownloadOpen]=useState(false),[editingOpen,setEditingOpen]=useState(false);
 const viewerRef=useRef<HTMLDivElement>(null);
 const [newMapName,setNewMapName]=useState('');
 const [mode,setMode]=useState<'none'|'line'|'road'|'edit'>('none');
 const [lineColor,setLineColor]=useState('#17212b'),[roadColor,setRoadColor]=useState('#16a34a'),[roadWidth,setRoadWidth]=useState(18);
 const [autoLineSegment,setAutoLineSegment]=useState(0);
 const [activePartId,setActivePartId]=useState('');
 const [cotaFrom,setCotaFrom]=useState(0),[cotaTo,setCotaTo]=useState(1);
 const [linePreview,setLinePreview]=useState<{start:{x:number;y:number};end:{x:number;y:number}}|null>(null);
 const changePreviewZoom=(delta:number)=>{
  const viewer=viewerRef.current;
  const centerX=viewer?(viewer.scrollLeft+viewer.clientWidth/2)/Math.max(1,viewer.scrollWidth):.5;
  const centerY=viewer?(viewer.scrollTop+viewer.clientHeight/2)/Math.max(1,viewer.scrollHeight):.5;
  setPreviewZoom(previous=>Math.max(40,Math.min(180,previous+delta)));
  requestAnimationFrame(()=>{const updated=viewerRef.current;if(updated){
   updated.scrollLeft=Math.max(0,centerX*updated.scrollWidth-updated.clientWidth/2);
   updated.scrollTop=Math.max(0,centerY*updated.scrollHeight-updated.clientHeight/2);
  }});
 };
 const [roadAnchors,setRoadAnchors]=useState<{x:number;y:number}[]>([]);
 const [roadCursor,setRoadCursor]=useState<{x:number;y:number}|null>(null);
 const roadAnchorsRef=useRef<{x:number;y:number}[]>([]);
 const lastRoadClickRef=useRef<{when:number;point:{x:number;y:number}}|null>(null);
 const customCotaDrag=useRef<{id:string;startX:number;startY:number;initialX:number;initialY:number}|null>(null);
 const drawGesture=useRef<{kind:'line';start:{x:number;y:number}}|{kind:'line-handle';index:number;end:'start'|'end'}|{kind:'road-handle';index:number;point:number}|null>(null);
 const [sheetContext,setSheetContext]=useState<{kind:'polygon'|'label';key:string;x:number;y:number}|null>(null);
 const [confrontantImportOpen,setConfrontantImportOpen]=useState(false);
  const [neighborDialog,setNeighborDialog]=useState<number|null>(null),[neighborUntil,setNeighborUntil]=useState(0),[neighborDirection,setNeighborDirection]=useState<ConfrontantPath>('auto'),[neighborDraft,setNeighborDraft]=useState<NeighborDetails>(blankNeighbor);
 const polys=useMemo(()=>getPolygons(full?.features||[]),[full]);
 const projectDivisions=useMemo(()=>readProjectDivisions(full?.features||[]),[full]);
 const orderedProjectDivisions=useMemo(()=>[...projectDivisions].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{numeric:true,sensitivity:'base'})),[projectDivisions]);
 const isComposite=featureId==='all'&&polys.length>1;
 const compositeEdges=useMemo(()=>isComposite?compositeExteriorEdges(projectDivisions):[],[isComposite,projectDivisions]);
 const activePart=projectDivisions.find(part=>`${part.featureId}:${part.partIndex}`===activePartId)||projectDivisions[0]||null;
 const activeVertices=isComposite?(activePart?.rings[0]||[]):(polys.find(p=>p.id===featureId)||polys[0])?.vertices||[];
 const activeTarget=isComposite&&activePart?`${activePart.featureId}:${activePart.partIndex}`:(polys.find(p=>p.id===featureId)||polys[0])?.id||'';
 const projectUf=text(full?.project?.stateCode||full?.project?.uf).toUpperCase();
 const sheetFeatureKey=isComposite?'__imovel_completo__':(polys.find(p=>p.id===featureId)?.id||polys[0]?.id||'');
 const polygon=isComposite?(polys[0]||null):(polys.find(p=>p.id===featureId)||polys[0]||null);
 const userKey=String(session?.user?.id||session?.user?.email||'local');
 const croqui=useMemo<CroquiSettings|null>(()=>polygon&&projectId?readCroquiSettingsForDocument(record(prefs.options),projectId,polygon.id,userKey,text(prefs.responsibleTechnician),isComposite,polys.length===1):null,[polygon,projectId,prefs,userKey,polys.length,isComposite]);
 const municipality=[text(full?.project?.municipality||full?.project?.city),text(full?.project?.stateCode||full?.project?.uf)].filter(Boolean).join('/');
 const owners=useMemo(()=>{
  const base=projectOwners(full?.project,text(polygon?.properties.owner||polygon?.properties.ownerName)).map(person=>person.name);
  if(!isComposite)return base;
  const perGleba=polys.flatMap(p=>[text(p.properties.owner||p.properties.ownerName||p.properties.proprietario)]).filter(Boolean);
  return [...new Set([...perGleba,...base])];
 },[full,polygon,polys,isComposite]);
 const owner=owners[0]||'';
 const basePropertyName=full?.project?projectTitle(full.project):polygon?.name||'Imóvel rural';
 const documentPropertyName=useMemo(()=>{
  if(!polygon||polys.length<=1||isComposite)return basePropertyName;
  const gName=polygon.name?.trim();
  if(!gName||gName.toLowerCase()===basePropertyName.toLowerCase())return basePropertyName;
  return `${basePropertyName} — ${gName}`;
 },[basePropertyName,polygon,polys.length,isComposite]);
 const accountSignature=text(prefs.planDocumentSignatureDataUrl);
 const effectiveSettings=useMemo(()=>resolveSheetSignature(settings,accountSignature),[settings,accountSignature]);
 const site=useMemo(()=>{
  const meta=record(full?.project?.metadata);
  const saved=text(meta.publicUrl||meta.publicLink||meta.shareUrl);
  if(!polygon)return '';
  return publicMapUrlForProject(window.location.origin,documentPropertyName,polys,polygon,isComposite,saved);
 },[full,polygon,documentPropertyName,polys,isComposite]);
 const svg=useMemo(()=>polygon?renderTechnicalSheet(polygon,effectiveSettings,{municipality,owner,owners,company:text(prefs.companyName)||'SURVEYOR',date:dateToday(),publicUrl:site,croqui,projectTitle:documentPropertyName,logo:text(prefs.logoDataUrl),editing:mode==='edit',previewSignatureOverlay:true,divisions:projectDivisions,composite:isComposite,uf:projectUf}):'',[polygon,effectiveSettings,municipality,owner,owners,prefs,site,croqui,documentPropertyName,mode,projectDivisions,isComposite,projectUf]);
 const roadPreview=mode==='road'&&roadAnchors.length?(roadCursor&&inSheetMap(roadCursor)&&distance2(roadAnchors[roadAnchors.length-1],roadCursor)>2?[...roadAnchors,roadCursor]:roadAnchors):[];
 const previewOverlay=linePreview?`<line x1="${linePreview.start.x}" y1="${linePreview.start.y}" x2="${linePreview.end.x}" y2="${linePreview.end.y}" stroke="${lineColor}" stroke-width="3" stroke-dasharray="8 5"/>`:roadDraftSvg(roadPreview,roadWidth,roadColor);
 const roadAnchorMarks=mode==='road'?roadAnchors.map((p,i)=>`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="4.5" fill="white" stroke="${roadColor}" stroke-width="2" pointer-events="none" data-road-draft-point="${i}"/>`).join(''):'';
 const displaySvgBase=(previewOverlay||roadAnchorMarks)?svg.replace(/<\/svg>\s*$/,`${previewOverlay}${roadAnchorMarks}</svg>`):svg;
 const displaySvg=activePart&&isComposite?displaySvgBase.replace(new RegExp(`(<g data-sheet-division=\"${activePart.featureId}\" data-sheet-division-part=\"${activePart.partIndex}\")`), '$1 data-active-gleba=\"true\"'):displaySvgBase;

 const showSignatureOverlay=effectiveSettings.signatureEnabled&&isSheetSignatureImage(effectiveSettings.signature);
 const signatureBox=sheetSignatureBox(effectiveSettings);
 const original=useRef<SheetSettings>(defaultSheet());const latestSettingsRef=useRef(settings);useEffect(()=>{latestSettingsRef.current=settings;},[settings]);const projectLoadSeq=useRef(0);const drag=useRef<{key:string,startX:number,startY:number,startClientX:number,startClientY:number,visualX:number,visualY:number,baseX:number,baseY:number,initialLon?:number,initialLat?:number,moved:boolean}|null>(null);const signatureDrag=useRef<{x:number;y:number;dx:number;dy:number}|null>(null);

 const buildSettingsForPolygon=useCallback((id:string,target:SurveyPolygon|null,data:ProjectFull|null,livePrefs:Record<string,unknown>,allowLegacy:boolean,draftId?:string):{settings:SheetSettings;stored:SheetSettings;recovered:boolean}=>{
  const opts=record(livePrefs.options);
  const featureKey=draftId||target?.id||'';
  const primaryRaw=featureKey?readDocumentDraft(opts,'technicalSheets',id,featureKey,allowLegacy):{};
  // Compatibilidade: usar a personalização antiga como ponto de partida se
  // ainda não existir um rascunho exclusivo do imóvel completo.
  const raw=draftId&&Object.keys(primaryRaw).length===0&&target
   ?readDocumentDraft(opts,'technicalSheets',id,target.id,false):primaryRaw;
  const defaults=defaultSheetForPolygon(target,text(livePrefs.responsibleTechnician));
  const metadata=record(data?.project?.metadata),common=readProjectDocumentIdentity(opts,id);
  defaults.district=text(common.district||metadata.district);
  defaults.reference=text(common.reference||metadata.documentReference);
  defaults.incra=text(common.incra||metadata.incra);defaults.cib=text(common.cib||metadata.cib);
  const hasRaw=Object.keys(raw).length>0;
  const stored=hasRaw?normalizeSheet({...defaults,...raw,
   polygonFill:typeof raw.polygonFill==='string'&&raw.polygonFill!=='#f2c313'?raw.polygonFill:defaults.polygonFill,
   polygonStroke:typeof raw.polygonStroke==='string'&&raw.polygonStroke!=='#f59e0b'?raw.polygonStroke:defaults.polygonStroke
  }):defaults;
  const s=normalizeSheet({...stored,
   reference:typeof common.reference==='string'?common.reference:stored.reference,
   district:typeof common.district==='string'?common.district:stored.district,
   incra:typeof common.incra==='string'?common.incra:stored.incra,
   cib:typeof common.cib==='string'?common.cib:stored.cib});
  if(featureKey)Object.assign(s,readMapAppearance(opts,id,featureKey));
  const shared=target?readConfrontants(opts,id,target.id):null;
  if(target)s.neighbors=resolveSegmentConfrontants(target.properties,target.vertices.length,shared?.neighbors||[],s.neighbors);
  if(shared)s.neighborDetails={...s.neighborDetails,...shared.details};
  const local=featureKey?parseLocalSheetDraft(localStorage.getItem(sheetDraftKey(userKey,id,featureKey))):null;
  const selected=selectSheetDraft(s,local);
  return {settings:selected.settings,stored:s,recovered:selected.recovered};
 },[userKey]);

 const writeLocalSheet=useCallback((data:SheetSettings,pending:boolean,id=projectId,feature=sheetFeatureKey)=>{
  if(!id||!feature)return;
   try{const key=sheetDraftKey(userKey,id,feature);const draft={settings:data,pending,updatedAt:Date.now()};localStorage.setItem(key,JSON.stringify(draft));void writeOfflineDraft(key,draft);}
  catch{setMessage('O armazenamento local está indisponível. Exporte a prancha antes de sair.');}
 },[userKey,projectId,sheetFeatureKey]);
 useEffect(()=>{if(dirty&&projectId&&polygon)writeLocalSheet(settings,true);},[dirty,projectId,polygon,settings,writeLocalSheet]);
 const modify=useCallback((patch:Partial<SheetSettings>)=>{setSettings(curr=>({...curr,...patch}));setDirty(true);setMessage('');},[]);
 const clearRoadDraft=useCallback(()=>{roadAnchorsRef.current=[];lastRoadClickRef.current=null;setRoadAnchors([]);setRoadCursor(null);},[]);
  const switchTool=useCallback(async(next:'none'|'line'|'road'|'edit',discardRoadDraft=false):Promise<boolean>=>{
   const pendingPoints=roadAnchorsRef.current.length;
   if(pendingPoints&&!discardRoadDraft&&!await requestConfirmation({title:'Descartar servidão em desenho?',message:`Há uma servidão em desenho com ${pendingPoints} ponto(s). Trocar de ferramenta vai descartá-la.`,confirmLabel:'Descartar servidão',destructive:true}))return false;
   clearRoadDraft();setLinePreview(null);drawGesture.current=null;setMode(old=>old===next?'none':next);return true;
  },[clearRoadDraft]);
 const finishRoad=useCallback((point?:{x:number;y:number})=>{
  const pts=[...roadAnchorsRef.current];
  if(point&&inSheetMap(point)&&pts.length>0&&distance2(pts[pts.length-1],point)>6)pts.push(point);
  const valid=pts.filter((p,i)=>i===0||distance2(p,pts[i-1])>2);
   if(valid.length<2){setMessage('Marque pelo menos dois pontos distintos para concluir a servidão. Os pontos atuais foram mantidos.');return;}
   if(!valid.some((p,i)=>i>0&&distance2(p,valid[0])>8)){setMessage('Afaste o último ponto do início para concluir a servidão. Os pontos atuais foram mantidos.');return;}
   const road:SheetRoad={id:crypto.randomUUID(),points:valid,geoPoints:polygon?valid.map(point=>sheetProjection(polygon,settings,projectDivisions,isComposite).unproject(point)):undefined,color:roadColor,width:roadWidth};
   modify({sheetRoads:[...settings.sheetRoads,road]});
  clearRoadDraft();setMode('none');
 },[clearRoadDraft,modify,roadColor,roadWidth,settings,polygon,projectDivisions,isComposite]);
  useEffect(()=>{if(mode!=='road')return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){switchTool('none',true);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[mode,switchTool]);
  useEffect(()=>{
   const protectRoadDraft=(event:BeforeUnloadEvent)=>{if(!saving&&!dirty&&!roadAnchorsRef.current.length)return;event.preventDefault();event.returnValue='';};
   window.addEventListener('beforeunload',protectRoadDraft);
   return()=>window.removeEventListener('beforeunload',protectRoadDraft);
  },[dirty,saving]);
  useEffect(()=>{
   const protectWorkspaceNavigation=(event:Event)=>{
    if(saving){event.preventDefault();setMessage('Aguarde a confirmação do salvamento antes de sair da Prancha Técnica.');return;}
    const pendingPoints=roadAnchorsRef.current.length;
    const warnings=[...(dirty?['Existem edições da prancha ainda não salvas.']:[]),...(pendingPoints?[`Há uma servidão em desenho com ${pendingPoints} ponto(s); ela será descartada.`]:[])];
    if(warnings.length)addRouteTransitionConfirmation(event,requestConfirmation({title:'Sair da Prancha Técnica?',message:warnings.join('\n'),confirmLabel:'Sair da Prancha Técnica'}));
   };
   window.addEventListener('surveyor:before-route-change',protectWorkspaceNavigation);
   return()=>window.removeEventListener('surveyor:before-route-change',protectWorkspaceNavigation);
  },[dirty,saving]);

 useEffect(()=>{setAutoLineSegment(current=>{const total=polygon?.vertices.length||0;if(total<1)return 0;return Math.min(current,total-1);});},[polygon?.vertices.length]);
 const addAutomaticLine=useCallback(()=>{if(!polygon||polygon.vertices.length<2)return;const projected=mapPointCoordinates(polygon,settings,projectDivisions,isComposite);const i=Math.max(0,Math.min(autoLineSegment,projected.length-1));const startVertex=projected[i];const endVertex=projected[(i+1)%projected.length];const midpoint={x:(startVertex.x+endVertex.x)/2,y:(startVertex.y+endVertex.y)/2};const dx=endVertex.x-startVertex.x,dy=endVertex.y-startVertex.y;const len=Math.hypot(dx,dy)||1;const signedArea=projected.reduce((acc,point,index)=>{const next=projected[(index+1)%projected.length];return acc+point.x*next.y-next.x*point.y;},0);const side=signedArea>0?1:-1;const nx=side*dy/len,ny=-side*dx/len;const line={id:`sheet-line-${Date.now()}`,start:midpoint,end:{x:midpoint.x+nx*58,y:midpoint.y+ny*58},color:lineColor};modify({technicalLines:[...settings.technicalLines,line]});},[autoLineSegment,lineColor,modify,polygon,settings,projectDivisions,isComposite]);
 useEffect(()=>{if(!session)return;let active=true;setLoadingProjects(true);Promise.allSettled([listProjects(session),getDocumentCustomization(session)]).then(([a,b])=>{if(!active)return;if(a.status==='fulfilled')setProjects(a.value);else setMessage('Não foi possível carregar os projetos.');if(b.status==='fulfilled')setPrefs(record(b.value.customization));else setMessage('Personalização da conta indisponível.');}).finally(()=>{if(active)setLoadingProjects(false);});return()=>{active=false;};},[session]);
  const openProject=useCallback(async(id:string)=>{if(id===projectId)return;if(saving){setMessage('Aguarde a confirmação do salvamento antes de trocar de projeto.');return;}const pendingRoadPoints=roadAnchorsRef.current.length;const warnings=[...(dirty?['Existem edições da prancha ainda não salvas.']:[]),...(pendingRoadPoints?[`Há uma servidão em desenho com ${pendingRoadPoints} ponto(s); ela será descartada.`]:[])];if(warnings.length&&!await requestConfirmation({title:'Trocar de projeto?',message:`${warnings.join('\n')}\n\nTrocar de projeto?`,confirmLabel:'Descartar e trocar',destructive:true}))return;const loadSeq=++projectLoadSeq.current;setProjectStep(0);setProjectId(id);setFull(null);setFeatureId('');setActivePartId('');setDirty(false);setMessage('');setMode('none');setLinePreview(null);clearRoadDraft();if(!id||!session){setLoading(false);return;}setLoading(true);try{const [result,latestPrefs]=await Promise.all([getProject(session,id),getDocumentCustomization(session).catch(()=>({customization:prefs}))]);if(loadSeq!==projectLoadSeq.current)return;const livePrefs=record(latestPrefs.customization);setPrefs(livePrefs);setFull(result);const p=getPolygons(result.features);setFeatureId(p.length>1?'all':(p[0]?.id||''));
  const built=buildSettingsForPolygon(id,p[0]||null,result,livePrefs,p.length===1,p.length>1?'__imovel_completo__':undefined);
  setSettings(built.settings);original.current=structuredClone(built.stored);setDirty(built.recovered);
  if(built.recovered)setMessage('Edição local recuperada. Clique em Salvar alterações para sincronizar com a nuvem.');
  else if(p.length>1)setMessage(`Projeto com ${p.length} áreas/glebas exibidas com seus tamanhos 1 por 1 no Quadro de Áreas. Escolha cada área ou use "Baixar → Todas (1 por 1)" para emitir separado.`);
 }catch(err){if(loadSeq===projectLoadSeq.current)setMessage(err instanceof Error?err.message:'Erro ao abrir projeto.');}finally{if(loadSeq===projectLoadSeq.current)setLoading(false);}},[session,prefs,dirty,saving,projectId,clearRoadDraft,buildSettingsForPolygon]);
 const save=async()=>{if(!session||!projectId||!dirty||saving)return;
  const id=projectId,feature=sheetFeatureKey;
  const snapshot=structuredClone({...settings,revision:Date.now()});
  writeLocalSheet(snapshot,true,id,feature);
  setSaving(true);setMessage('');
  try{
   await saveDocumentDraft(session,'technicalSheets',id,snapshot as unknown as Record<string,unknown>,feature);
   if(polygon&&!isComposite)await saveConfrontants(session,id,polygon.id,{neighbors:resolveSegmentConfrontants(polygon.properties,polygon.vertices.length,snapshot.neighbors,croqui?.neighbors),details:snapshot.neighborDetails});
   const remote=await getDocumentCustomization(session);
   const verified=normalizeSheet(readDocumentDraft(record(record(remote.customization).options),'technicalSheets',id,feature,false));
   if(!sheetDraftMatches(snapshot,verified))throw new Error('A nuvem não confirmou todas as configurações e edições da prancha. A edição ficou preservada neste navegador.');
   if(id===projectId&&feature===sheetFeatureKey){
    original.current=structuredClone(snapshot);
    const latest=latestSettingsRef.current;
    const changedSinceClick=JSON.stringify(latest)!==JSON.stringify({...snapshot,revision:latest.revision});
    if(changedSinceClick){
     writeLocalSheet(latest,true,id,feature);
     setDirty(true);
     setMessage('Alterações anteriores confirmadas na nuvem. Existem novas edições locais: salve novamente.');
    }else{
     writeLocalSheet(snapshot,false,id,feature);
     setSettings(snapshot);setDirty(false);
     setMessage('Prancha e confrontantes confirmados na nuvem.');
    }
    setPrefs(record(remote.customization));
   }else{
    writeLocalSheet(snapshot,false,id,feature);
   }
  }catch(error){writeLocalSheet(snapshot,true,id,feature);setMessage(`${error instanceof Error?error.message:'Falha ao salvar alterações.'} Rascunho preservado neste navegador; a nuvem NÃO foi confirmada.`);}
  finally{setSaving(false);}
 };
 const restore=()=>{const restored=structuredClone(original.current);writeLocalSheet(restored,false);setSettings(restored);setDirty(false);setMessage('Edições locais descartadas; versão confirmada na nuvem restaurada.');};
 const signature=async(file:File,reportProgress:(file:File,loaded:number,total:number)=>void,signal:AbortSignal)=>{if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>2*1024*1024)throw new Error('Selecione imagem PNG, JPEG ou WEBP de até 2 MB.');const data=await readFileAsDataUrl(file,reportProgress,signal);modify({signature:data,signatureEnabled:true,signatureSource:'custom'});};
 const autoOrganize=()=>{modify({labelOffsets:{}});setMessage('Posições de rótulos reorganizadas. Salve para confirmar na nuvem.');};
 const autoHideStraight=()=>{
  if(isComposite&&activePart){const prefix=`division:${activePart.featureId}:${activePart.partIndex}:vertex:`;const points=activePart.rings[0]||[];
   const prior=points.map((_,i)=>i).filter(i=>settings.hiddenDivisionVertices[`${prefix}${i}`]);const suggested=suggestHiddenStraightVertices(points,prior);
   modify({hiddenDivisionVertices:{...settings.hiddenDivisionVertices,...Object.fromEntries(suggested.map(i=>[`${prefix}${i}`,true]))}});
   setMessage(`${suggested.length} vértice(s) intermediário(s) ocultados na prancha; geometria preservada.`);return;
  }
  if(!polygon)return;const suggested=suggestHiddenStraightVertices(polygon.vertices,settings.hiddenVertices);
  modify({hiddenVertices:[...new Set([...settings.hiddenVertices,...suggested])].sort((a,b)=>a-b)});
  setMessage(`${suggested.length} vértice(s) intermediário(s) ocultados; geometria preservada.`);
 };
 const restoreHiddenVertices=()=>{
  if(isComposite&&activePart){const prefix=`division:${activePart.featureId}:${activePart.partIndex}:vertex:`;
   modify({hiddenDivisionVertices:Object.fromEntries(Object.entries(settings.hiddenDivisionVertices).filter(([key])=>!key.startsWith(prefix)))});
  }else modify({hiddenVertices:[]});
 };
 const organizeConfrontants=async()=>{
  if(!polygon)return;
  // No Imóvel completo, o perímetro é o contorno EXTERNO da união das glebas.
  // O ramo antigo selecionava silenciosamente a primeira gleba e não enxergava
  // rótulos em outras áreas, exibindo indevidamente “posicione os rótulos”.
  if(isComposite){
   const boundary=compositeExteriorEdges(projectDivisions);
   const candidates:CompositeConfrontantLabel[]=[];
   const pins={...settings.confrontantPins};
   const detailsByPerson=new Map<string,NeighborDetails>();
   const appearanceByPerson=new Map<string,{color?:string;angle?:number;size?:number}>();
   const project=sheetProjection(polygon,settings,projectDivisions,true).project;
   for(const part of projectDivisions){
    const prefix=`division:${part.featureId}:${part.partIndex}:`;
    const ring=part.rings[0]||[];
    const named=ring.map((_,i)=>settings.divisionNeighbors[`${prefix}neighbor:${i}`]||readConfrontation(part.properties||{},i,ring.length));
    for(let i=0;i<ring.length;i++){
     const name=named[i]?.trim();if(!name)continue;
     const identity=confrontantPinKey(name);
     const detail=settings.divisionNeighborDetails[`${prefix}neighbor:${i}`];
     if(detail){
      const earlier=detailsByPerson.get(identity);
      if(!earlier)detailsByPerson.set(identity,detail);
      else detailsByPerson.set(identity,{
       ...earlier,
       property:earlier.property||detail.property,
       owner:earlier.owner||detail.owner,
       cpf:earlier.cpf||detail.cpf,
       rg:earlier.rg||detail.rg,
       showCpf:earlier.showCpf||detail.showCpf,
       showOwner:earlier.showOwner||detail.showOwner,
       showRg:earlier.showRg||detail.showRg,
      });
     }
     const previous=appearanceByPerson.get(identity)||{};
     appearanceByPerson.set(identity,{
      color:previous.color??settings.labelColors[`${prefix}neighbor:${i}`],
      angle:previous.angle??settings.labelAngles[`${prefix}neighbor:${i}`],
      size:previous.size??settings.labelSizes[`${prefix}neighbor:${i}`],
     });
    }
    for(const item of readConfrontantLabelPositions(svg,'sheet',prefix)){
     const name=named[item.source]?.trim();if(!name)continue;
     candidates.push({name,sourceKey:`${prefix}neighbor:${item.source}`,position:item.position});
     // As coordenadas visuais serão capturadas depois de identificar qual
     // etiqueta deve ser mantida quando há várias cópias do mesmo nome.
    }
   }
   const exteriorKeys=new Set(boundary.map(edge=>edge.key));
   for(const candidate of candidates){
    const identity=confrontantPinKey(candidate.name);
    if(!pins[identity]||exteriorKeys.has(candidate.sourceKey)){
     pins[identity]=candidate.position;
    }
   }
   const suggested=suggestCompositeConfrontants(boundary,candidates,project).filter(item=>item.targets.length);
   if(!suggested.length){setMessage('Não foram encontrados rótulos de confrontantes para organizar no contorno externo. Confira a visualização das quatro glebas.');return;}
   const summary=suggested.map(item=>{
    const target=item.targets.map(key=>{
     const edge=boundary.find(e=>e.key===key);
     return edge?`${edge.name}, V-${edge.index+1}→V-${edge.index+2}`:key;
    }).join(', ');
    return `${item.name}: ${target}${item.confidence<.25?' (verificar)':''}`;
   }).join('\n');
   if(!await requestConfirmation({title:'Aplicar confrontantes ao imóvel completo?',message:`Imóvel completo: associações sugeridas no PERÍMETRO EXTERNO das ${projectDivisions.length} glebas:\n\n${summary}\n\nAs posições dos nomes, vértices, divisas internas e áreas serão preservadas. Confira e confirme.`,confirmLabel:'Aplicar confrontantes'}))return;
   const divisionNeighbors={...settings.divisionNeighbors};
   const divisionNeighborDetails={...settings.divisionNeighborDetails};
   const labelColors={...settings.labelColors};
   const labelAngles={...settings.labelAngles};
   const labelSizes={...settings.labelSizes};
   const labelOffsets={...settings.labelOffsets};
   // Só alteramos arestas exteriores. Confrontações internas de cada gleba
   // continuam disponíveis na edição individual, sem perda cadastral.
   for(const item of suggested){
    const identity=confrontantPinKey(item.name),detail=detailsByPerson.get(identity),appearance=appearanceByPerson.get(identity);
    for(const key of item.targets){
     divisionNeighbors[key]=item.name;
     if(detail)divisionNeighborDetails[key]=detail;
     if(appearance?.color)labelColors[key]=appearance.color;
     if(appearance?.angle!==undefined)labelAngles[key]=appearance.angle;
     if(appearance?.size!==undefined)labelSizes[key]=appearance.size;
     delete labelOffsets[key]; // O pino preservado determina a posição real.
    }
   }
   modify({divisionNeighbors,divisionNeighborDetails,labelColors,labelAngles,labelSizes,labelOffsets,confrontantPins:pins});
   setMessage('Confrontantes associados ao contorno externo do imóvel completo. Confira e salve; as divisas internas foram preservadas.');
   return;
  }
  const part=isComposite?activePart:null;
  const points=part?.rings[0]||polygon.vertices;
  const projected=points.map(point=>sheetProjection(polygon,settings,projectDivisions,isComposite).project(point));
  const prefix=part?`division:${part.featureId}:${part.partIndex}:`:'';
  const raw=part?points.map((_,i)=>settings.divisionNeighbors[`${prefix}neighbor:${i}`]||readConfrontation(part.properties||{},i,points.length))
   :points.map((_,i)=>settings.neighbors[i]||croqui?.neighbors[i]||readConfrontation(polygon.properties,i,points.length));
  const labels=readConfrontantLabelPositions(svg,'sheet',prefix).map(label=>({...label,caption:raw[label.source]||''}));
  const suggested=suggestConfrontantByPosition(projected,labels);
  if(!suggested.some(s=>s.targets.length)){setMessage('Posicione os rótulos dos confrontantes no mapa antes de organizar.');return;}
  const summary=suggested.map(s=>`${s.caption.slice(0,32)}: ${s.cardinal} → ${s.targets.length?s.targets.map(i=>`V-${i+1}→V-${(i+1)%points.length+1}`).join(", "):"sem trecho confiável"}${s.confidence<.25?' (revisar)':''}`).join('\n');
  if(!await requestConfirmation({title:'Aplicar sugestões de confrontantes?',message:`Confira as confrontações sugeridas antes de aplicar:\n\n${summary}\n\nNão serão alterados vértices ou áreas.`,confirmLabel:'Aplicar sugestões'}))return;
  const details:Record<string,NeighborDetails>=part?Object.fromEntries(points.map((_,i)=>[String(i),settings.divisionNeighborDetails[`${prefix}neighbor:${i}`]] as const).filter(([,v])=>Boolean(v))) as Record<string,NeighborDetails>:settings.neighborDetails;
  const applied=applyConfrontantSuggestions<NeighborDetails>(raw,details,suggested,points.length);
  const pins=captureConfrontantPins(svg,'sheet',raw,prefix,settings.confrontantPins);
  const labelColors=transferConfrontantAppearance(raw,applied.neighbors,prefix,settings.labelColors) as Record<string,string>;
  const labelAngles=transferConfrontantAppearance(raw,applied.neighbors,prefix,settings.labelAngles) as Record<string,number>;
  const labelSizes=transferConfrontantAppearance(raw,applied.neighbors,prefix,settings.labelSizes) as Record<string,number>;
  const labelOffsets=Object.fromEntries(Object.entries(settings.labelOffsets).filter(([key])=>!key.startsWith(`${prefix}neighbor:`)));
  const hiddenLabels=transferHiddenConfrontantLabels(raw,applied.neighbors,prefix,settings.hiddenLabels);
  const appearance={confrontantPins:pins,labelColors,labelAngles,labelSizes,labelOffsets,hiddenLabels};
  if(part){
   const divisionNeighbors={...settings.divisionNeighbors};
   const divisionNeighborDetails={...settings.divisionNeighborDetails};
   for(let i=0;i<points.length;i++){
    divisionNeighbors[`${prefix}neighbor:${i}`]=applied.neighbors[i];
    if(applied.details[String(i)]!==undefined)divisionNeighborDetails[`${prefix}neighbor:${i}`]=applied.details[String(i)];
    else delete divisionNeighborDetails[`${prefix}neighbor:${i}`];
   }
   modify({...appearance,divisionNeighbors,divisionNeighborDetails});
  }else modify({...appearance,neighbors:applied.neighbors,neighborDetails:applied.details});
  setMessage('Confrontantes reorganizados no rascunho. Confira os trechos e salve.');
 };

 const importConfrontations=(payload:{neighbors:string[];details:Record<string,NeighborDetails>})=>{
  if(isComposite){
   const divisionNeighbors={...settings.divisionNeighbors};
   const divisionNeighborDetails={...settings.divisionNeighborDetails};
   compositeEdges.forEach((edge,i)=>{
    const value=payload.neighbors[i];
    if(value)divisionNeighbors[edge.key]=value;
    if(payload.details[String(i)])divisionNeighborDetails[edge.key]=payload.details[String(i)];
   });
   modify({divisionNeighbors,divisionNeighborDetails});
  }else modify({neighbors:payload.neighbors,neighborDetails:{...settings.neighborDetails,...payload.details}});
  setConfrontantImportOpen(false);
  setMessage('Confrontações importadas no rascunho. Confira os trechos e salve.');
 };
 const svgPos=(e:ReactPointerEvent<HTMLDivElement>|ReactMouseEvent<HTMLDivElement>)=>{
  const node=e.currentTarget.querySelector('svg');if(!node)return null;
  const box=node.getBoundingClientRect();if(box.width<1||box.height<1)return null;
  const vb=node.viewBox.baseVal;
  return {x:(e.clientX-box.left)/box.width*vb.width+vb.x,y:(e.clientY-box.top)/box.height*vb.height+vb.y};
 };
 const onRoadClick=(event:ReactMouseEvent<HTMLDivElement>)=>{
  if(mode!=='road'||tab!=='custom'||section!=='mapa'||!polygon||event.button!==0)return;
  const pos=svgPos(event);if(!pos||!inSheetMap(pos))return;
  const prior=lastRoadClickRef.current;
  if(event.detail>=2||(prior&&Date.now()-prior.when<=380&&distance2(prior.point,pos)<=12)){finishRoad(pos);return;}
  lastRoadClickRef.current={when:Date.now(),point:pos};
  const current=roadAnchorsRef.current;
  if(current.length===0||distance2(current[current.length-1],pos)>=3){
   const next=[...current,pos];roadAnchorsRef.current=next;setRoadAnchors(next);
  }
  setRoadCursor(pos);
 };
 const onRoadDoubleClick=(event:ReactMouseEvent<HTMLDivElement>)=>{
  if(mode!=='road'||tab!=='custom'||section!=='mapa'||!polygon||roadAnchorsRef.current.length===0)return;
  event.preventDefault();event.stopPropagation();
  finishRoad(svgPos(event)||undefined);
 };
 const hoverSheetDivision=(event:ReactMouseEvent<HTMLDivElement>)=>{
  if(!isComposite)return;
  const node=event.target as Element;
  const group=node.closest('[data-sheet-division]');
  const label=node.closest('[data-sheet-label^="division:"]');
  const labelId=label?.getAttribute('data-sheet-label')||'';
  const matched=/^division:(.*):(\d+):(title|area|vertex|neighbor|cota)/.exec(labelId);
  const id=group?`${group.getAttribute('data-sheet-division')}:${group.getAttribute('data-sheet-division-part')}`:(matched?`${matched[1]}:${matched[2]}`:'');
  if(id&&projectDivisions.some(d=>`${d.featureId}:${d.partIndex}`===id)){
   if(id!==activePartId)setActivePartId(id);
   if(tab!=='custom')setTab('custom');
   if(section!=='mapa')setSection('mapa');
  }
 };
 const sheetRightClick=(event:ReactMouseEvent<HTMLDivElement>)=>{
  if(!polygon)return;
  const el=event.target as Element;
  const label=el.closest('[data-sheet-label]');const shape=el.closest('[data-sheet-polygon]');
  const group=el.closest('[data-sheet-division]');
  if(group&&isComposite)setActivePartId(`${group.getAttribute('data-sheet-division')}:${group.getAttribute('data-sheet-division-part')}`);
  if(!label&&!shape)return;
  event.preventDefault();event.stopPropagation();
  const key=label?.getAttribute('data-sheet-label')||'';
  setSheetContext({kind:label?'label':'polygon',key:label?key:(shape?.getAttribute('data-sheet-polygon')||''),x:Math.min(event.clientX,window.innerWidth-275),y:Math.max(12,Math.min(event.clientY,window.innerHeight-450))});
 };
 const contextMapName=sheetContext?.kind==='label'?mapNameForLabel(settings.mapNames,sheetContext.key):undefined;
 const onPointerDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!polygon||e.button!==0||!e.isPrimary)return;
  const pos=svgPos(e);if(!pos)return;
  const element=e.target as Element;
  // Arraste a própria linha verde tracejada ou o valor da cota direta.
  const customCotaElement=element.closest('[data-custom-cota-drag]');
  if(customCotaElement&&(mode==='none'||mode==='edit')){
   const id=customCotaElement.getAttribute('data-custom-cota-drag');
   const cota=settings.customCotas.find(c=>c.id===id);
   if(cota){customCotaDrag.current={id:cota.id,startX:pos.x,startY:pos.y,initialX:cota.offsetX||0,initialY:cota.offsetY||0};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();return;}
  }
  if(element.closest('[data-sheet-signature]')&&effectiveSettings.signatureEnabled){
   signatureDrag.current={x:pos.x,y:pos.y,dx:settings.signatureOffsetX,dy:settings.signatureOffsetY};
   e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();return;
  }
  if(mode==='edit'&&tab==='custom'&&section==='mapa'){
   const lineHandle=element.closest('[data-sheet-line-handle]');
   const roadHandle=element.closest('[data-sheet-road-handle]');
   if(lineHandle){const m=/(\d+):(start|end)/.exec(lineHandle.getAttribute('data-sheet-line-handle')||'');if(m){drawGesture.current={kind:'line-handle',index:Number(m[1]),end:m[2] as 'start'|'end'};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}return;}
   if(roadHandle){const m=/(\d+):(\d+)/.exec(roadHandle.getAttribute('data-sheet-road-handle')||'');if(m){drawGesture.current={kind:'road-handle',index:Number(m[1]),point:Number(m[2])};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}return;}
  }
  const label=element.closest('[data-sheet-label]');
  if(label&&(mode==='none'||mode==='edit')){
   const key=label.getAttribute('data-sheet-label');if(!key)return;
   const visualX=Number(label.getAttribute('x'));
   const visualY=Number(label.getAttribute('data-sheet-visual-y')||label.getAttribute('y'));
   const baseX=Number(label.getAttribute('data-sheet-base-x'));
   const baseY=Number(label.getAttribute('data-sheet-base-y'));
   if(![visualX,visualY,baseX,baseY].every(Number.isFinite))return;
   const selectedMapName=key.startsWith('map-name:')?settings.mapNames.find(n=>n.id===key.slice(9)):undefined;
   drag.current={key,startX:pos.x,startY:pos.y,startClientX:e.clientX,startClientY:e.clientY,visualX,visualY,baseX,baseY,initialLon:selectedMapName?.lon,initialLat:selectedMapName?.lat,moved:false};
   e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();return;
  }
  if(tab!=='custom'||section!=='mapa'||pos.x<112||pos.x>912||pos.y<40||pos.y>885)return;
  if(mode==='line'){
   const vertices=mapPointCoordinates(polygon,settings,projectDivisions,isComposite);let start=pos,best=28;
   for(const v of vertices){const d=Math.hypot(v.x-pos.x,v.y-pos.y);if(d<best){start=v;best=d;}}
   drawGesture.current={kind:'line',start};setLinePreview({start,end:pos});e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();return;
  }
 };
 const onPointerMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!e.isPrimary)return;
  const pos=svgPos(e);
  if(customCotaDrag.current&&pos){
   const g=customCotaDrag.current;
   const offsetX=Math.max(-800,Math.min(800,g.initialX+pos.x-g.startX));
   const offsetY=Math.max(-800,Math.min(800,g.initialY+pos.y-g.startY));
   setSettings(old=>({...old,customCotas:old.customCotas.map(c=>c.id===g.id?{...c,offsetX,offsetY}:c)}));setDirty(true);return;
  }
  if(signatureDrag.current&&pos){const g=signatureDrag.current;setSettings(old=>({...old,...clampSheetSignatureOffset(old,g.dx+pos.x-g.x,g.dy+pos.y-g.y)}));setDirty(true);return;}
  if(mode==='road'&&pos&&inSheetMap(pos)&&roadAnchorsRef.current.length>0)setRoadCursor(previous=>previous&&distance2(previous,pos)<3?previous:pos);const g=drawGesture.current;
  if(g&&pos){
   if(g.kind==='line'){setLinePreview({start:g.start,end:pos});return;}
   if(g.kind==='line-handle'){setSettings(old=>({...old,technicalLines:old.technicalLines.map((line,i)=>i===g.index?{...line,[g.end]:pos}:line)}));setDirty(true);return;}
   if(g.kind==='road-handle'){setSettings(old=>({...old,sheetRoads:old.sheetRoads.map((road,i)=>{if(i!==g.index)return road;const conversion=polygon?sheetProjection(polygon,old,projectDivisions,isComposite):null;const current=conversion&&road.geoPoints?.length===road.points.length?road.geoPoints.map(conversion.project):road.points;const points=current.map((p,j)=>j===g.point?pos:p);return {...road,points,geoPoints:conversion?points.map(conversion.unproject):road.geoPoints};})}));setDirty(true);return;}
  }
  if(!drag.current||!pos)return;
  const d=drag.current;
  if(!d.moved&&Math.hypot(e.clientX-d.startClientX,e.clientY-d.startClientY)<8)return;
  d.moved=true;
  if(d.key.startsWith('map-name:')&&d.initialLon!==undefined&&d.initialLat!==undefined&&polygon){
   const {project}=sheetProjection(polygon,settings,projectDivisions,isComposite);
   const origin=project([d.initialLon,d.initialLat]);
   const lonUnit=project([d.initialLon+.0001,d.initialLat]).x-origin.x;
   const latUnit=project([d.initialLon,d.initialLat+.0001]).y-origin.y;
   if(Math.abs(lonUnit)>1e-9&&Math.abs(latUnit)>1e-9){
    const lon=Math.max(-180,Math.min(180,d.initialLon+(pos.x-d.startX)*.0001/lonUnit));
    const lat=Math.max(-85,Math.min(85,d.initialLat+(pos.y-d.startY)*.0001/latUnit));
    setSettings(old=>({...old,mapNames:old.mapNames.map(item=>item.id===d.key.slice(9)?{...item,lon,lat}:item)}));setDirty(true);
   }
   return;
  }
  const dx=Math.max(-1200,Math.min(1200,d.visualX+(pos.x-d.startX)-d.baseX));
  const dy=Math.max(-1200,Math.min(1200,d.visualY+(pos.y-d.startY)-d.baseY));
  setSettings(old=>({...old,labelOffsets:{...old.labelOffsets,[d.key]:{dx,dy}}}));setDirty(true);
 };
 const onPointerUp=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!e.isPrimary)return;
  const g=drawGesture.current;const pos=svgPos(e);
  const labelGesture=drag.current;
  const labelMoved=labelGesture&&(labelGesture.moved||Math.hypot(e.clientX-labelGesture.startClientX,e.clientY-labelGesture.startClientY)>=8);
  if(labelGesture&&pos&&!labelMoved){
   setSheetContext({kind:'label',key:labelGesture.key,x:Math.max(12,Math.min(e.clientX,window.innerWidth-275)),y:Math.max(12,Math.min(e.clientY,window.innerHeight-450))});
  }
  if(g?.kind==='line'&&pos&&Math.hypot(pos.x-g.start.x,pos.y-g.start.y)>7){
   const line:SheetTechnicalLine={id:crypto.randomUUID(),start:g.start,end:pos,color:lineColor};modify({technicalLines:[...settings.technicalLines,line]});
  }
  drawGesture.current=null;setLinePreview(null);drag.current=null;signatureDrag.current=null;customCotaDrag.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const cancelPointerGesture=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(!e.isPrimary)return;
  drawGesture.current=null;setLinePreview(null);drag.current=null;signatureDrag.current=null;customCotaDrag.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const applyNeighbor=()=>{
  if(neighborDialog===null||!polygon)return;
  const i=neighborDialog;const count=polygon.vertices.length;const next=resolveSegmentConfrontants(polygon.properties,count,settings.neighbors,croqui?.neighbors);
  const value=([['property','showProperty'],['owner','showOwner'],['cpf','showCpf'],['rg','showRg']] as const).filter(([field,flag])=>neighborDraft[flag]&&neighborDraft[field].trim()).map(([field])=>neighborDraft[field].trim()).join(' · ');
  const details={...settings.neighborDetails};
  for(const j of resolveConfrontantPath(names,i,neighborUntil,neighborDirection).edges){next[j]=value;details[String(j)]={...neighborDraft};}
  modify({neighbors:next,neighborDetails:details});setNeighborDialog(null);
 };
 const exportFile=(type:'svg'|'html'|'pdf')=>{
  if(!polygon)return;
  setDownloadOpen(false);
  const cleanSvg=renderTechnicalSheet(polygon,effectiveSettings,{municipality,owner,owners,company:text(prefs.companyName)||'SURVEYOR',date:dateToday(),publicUrl:site,croqui,projectTitle:documentPropertyName,logo:text(prefs.logoDataUrl),divisions:projectDivisions,composite:isComposite,uf:projectUf});
  const slug=documentPropertyName.toLowerCase().replace(/[^a-z0-9-_]+/gi,'-')||'prancha-tecnica';
  if(type==='svg')fileExport(`${slug}.svg`,cleanSvg,'image/svg+xml;charset=utf-8');
  else if(type==='html')fileExport(`${slug}.html`,downloadHtml(cleanSvg,settings.title,settings.paper),'text/html;charset=utf-8');
  else {const w=window.open('','_blank');if(!w){setMessage('Permita pop-ups para imprimir a prancha.');return;}w.document.write(downloadHtml(cleanSvg,settings.title,settings.paper));w.document.close();w.focus();setTimeout(()=>w.print(),600);}
 };
 const exportBatchAll=(type:'svg'|'html'|'pdf')=>{
  if(!polys.length)return;
  setDownloadOpen(false);
  const pages=polys.map((item,idx)=>{
   const baseIndividual=buildSettingsForPolygon(projectId,item,full,prefs,false).settings;
   const sheetTarget=`${String(item.properties.sourceFeatureId||item.id)}:${Number(item.properties.partIndex||0)}`;
   const individualFromComplete=isComposite?settings.customCotas.filter(c=>c.target===sheetTarget).map(c=>({...c,target:item.id})):[];
   const itemSettings=item.id===polygon?.id&&!isComposite?effectiveSettings:resolveSheetSignature({
    ...baseIndividual,
    customCotas:[...baseIndividual.customCotas,...individualFromComplete],
    tarefaM2:isComposite&&settings.tarefaM2>0?settings.tarefaM2:baseIndividual.tarefaM2,
    sheet:`${String(idx+1).padStart(2,'0')}/${String(polys.length).padStart(2,'0')}`
   },accountSignature);
   const itemCroqui=readSharedCroquiSettings(record(prefs.options),projectId,item.id,userKey,text(prefs.responsibleTechnician),false);
   const gName=item.name?.trim();
   const itemTitle=gName&&gName.toLowerCase()!==basePropertyName.toLowerCase()?`${basePropertyName} — ${gName}`:basePropertyName;
   const itemOwners=projectOwners(full?.project,text(item.properties.owner||item.properties.ownerName)).map(p=>p.name);
   const itemUrl=buildPublicMapUrl(window.location.origin,itemTitle,[[item.vertices,...(item.holes||[])].map(ring=>ring.map(v=>[Number(v[0].toFixed(7)),Number(v[1].toFixed(7))]))]);
   const rendered=renderTechnicalSheet(item,itemSettings,{
    municipality,
    owner:itemOwners[0]||owner,
    owners:itemOwners.length?itemOwners:owners,
    company:text(prefs.companyName)||'SURVEYOR',
    date:dateToday(),
    publicUrl:itemUrl,
    croqui:itemCroqui,
    projectTitle:itemTitle,
    logo:text(prefs.logoDataUrl),
    composite:false,uf:projectUf
   });
   return {name:gName||`gleba-${idx+1}`,svg:rendered};
  });
  if(type==='svg'){
   pages.forEach((p,idx)=>{
    const slug=p.name.toLowerCase().replace(/[^a-z0-9-_]+/gi,'-')||`gleba-${idx+1}`;
    setTimeout(()=>fileExport(`prancha-${String(idx+1).padStart(2,'0')}-${slug}.svg`,p.svg,'image/svg+xml;charset=utf-8'),idx*180);
   });
   setMessage(`${pages.length} pranchas SVG geradas individualmente (1 por 1).`);
   return;
  }
  const combined=pages.map(p=>`<div class="sheet-page">${p.svg}</div>`).join('\n');
  const html=downloadHtml(combined,`${basePropertyName} — ${pages.length} Pranchas`,settings.paper);
  if(type==='html'){
   fileExport('pranchas-todas-1-por-1.html',html,'text/html;charset=utf-8');
   setMessage(`${pages.length} pranchas exportadas 1 por 1 em HTML.`);
  }else{
   const w=window.open('','_blank');if(!w){setMessage('Permita pop-ups para imprimir todas as pranchas.');return;}
   w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),700);
  }
 };
 const names=polygon?.vertices.map((_,i)=>settings.names[i]||croqui?.names[i]||`V-${String(i+1).padStart(2,'0')}`)||[];
 const lineCount=(croqui?.lines?.length||0)+settings.technicalLines.length,easementCount=(croqui?.easements?.filter(road=>road.visible!==false).length||0)+settings.sheetRoads.length;
 return <><main className="workspace-main doc-root"><GlobalLoading active={loading || loadingProjects} />
 <DocumentWorkflowBar
  label="Prancha técnica"
   steps={['Projeto','Dados','Edição','Prancha']}
   currentStep={tab==='project'?projectStep:editingOpen?2:3}
  onStepChange={index=>{
    if(index>(tab==='project'?projectStep:editingOpen?2:3))return;
    if(index===0){setTab('project');setProjectStep(0);setEditingOpen(false);return;}
    if(!polygon)return;
    if(index===1){setTab('project');setProjectStep(1);setEditingOpen(false);return;}
    setTab('custom');setSection('prancha');setEditingOpen(index===2);
  }}
  startActions={<div className="doc-menu-wrap"><button type="button" className="doc-workflow-action doc-outline" disabled={!polygon} aria-haspopup="menu" aria-expanded={downloadOpen} onClick={()=>setDownloadOpen(!downloadOpen)}><Download size={15}/> Baixar</button>{downloadOpen&&<div className="doc-download-menu" role="menu"><button role="menuitem" onClick={()=>exportFile('svg')}>SVG vetorial (atual)</button><button role="menuitem" onClick={()=>exportFile('html')}>HTML (atual)</button><button role="menuitem" onClick={()=>exportFile('pdf')}><Printer size={14}/> Imprimir / PDF (atual)</button>{polys.length>1&&<><hr style={{margin:'4px 0',borderColor:'#e2e8f0'}}/><button role="menuitem" onClick={()=>exportBatchAll('pdf')}><Printer size={14}/> Imprimir / PDF — Todas ({polys.length} áreas 1 por 1)</button><button role="menuitem" onClick={()=>exportBatchAll('html')}>HTML — Todas ({polys.length} áreas 1 por 1)</button><button role="menuitem" onClick={()=>exportBatchAll('svg')}>SVG vetorial — Todas ({polys.length} áreas 1 por 1)</button></>}</div>}</div>}
   actions={tab==='custom'?<>
    <button type="button" className="doc-workflow-action doc-primary" disabled={saving||!polygon||!dirty} onClick={()=>void save()}><Save size={15}/>{saving?'Salvando...':'Salvar alterações'}</button>
    {editingOpen&&<button type="button" className="doc-workflow-action doc-outline" disabled={!polygon} onClick={()=>{setDownloadOpen(false);setEditingOpen(false);}}><PenLine size={15}/>Pré-visualizar</button>}
   </>:undefined}
 />

  <div className="workspace-container doc-container">{message&&<div className="doc-alert" role="status">{message}<button onClick={()=>setMessage('')}>×</button></div>}<div className={`doc-layout${tab==='custom'&&!editingOpen?' doc-layout--editing-closed':''}`}><aside className={`doc-sidebar${tab==='project'?' doc-sidebar--workflow':''}`}>{tab==='project'?<div className="doc-panel doc-panel--workflow"><strong>{projectStep===0?'Projeto':'Dados da prancha'}</strong>{projectStep===0?<>
 <ProjectSourcePicker scope="technical-sheets" projects={projects} projectId={projectId} loading={loadingProjects||loading} onProjectChange={id=>{setProjectStep(0);void openProject(id);}} onImport={data=>{
  const id=data.project?.id||'';
  const importedPolygons=getPolygons(data.features);
  const first=importedPolygons[0]||null;
  const composite=importedPolygons.length>1;
  const built=buildSettingsForPolygon(id,first,data,prefs,!composite&&Boolean(first),composite?'__imovel_completo__':undefined);
  setProjectStep(0);setProjectId(id);setFull(data);setFeatureId(composite?'all':first?.id||'');setActivePartId('');
  setSettings(built.settings);original.current=structuredClone(built.stored);setDirty(built.recovered);
  setMessage(built.recovered?'Edição local recuperada. Clique em Salvar alterações para sincronizar com a nuvem.':'Projeto importado e salvo neste navegador.');
 }} onClearImport={()=>{setProjectStep(0);void openProject('');}} />
 {!projectId&&<p className="doc-hint">Selecione um projeto salvo no mapa ou importe um arquivo GeoJSON ou KML para começar.</p>}
 {projectId&&full&&!polygon&&<p className="doc-hint">Este projeto não contém polígonos válidos para gerar a prancha.</p>}
 {projectId&&full&&polygon&&<p className="doc-hint"><strong>Projeto selecionado:</strong> {projectTitle(full.project||{id:projectId})}</p>}
</>:<>{polys.length>1&&<label>Imóvel / Gleba<select value={featureId} onChange={async e=>{
   const pendingRoadPoints=roadAnchorsRef.current.length;
   const warnings=[...(dirty?['Há alterações pendentes nesta gleba. O rascunho local está preservado.']:[]),...(pendingRoadPoints?[`Há uma servidão em desenho com ${pendingRoadPoints} ponto(s); ela será descartada.`]:[])];
   if(warnings.length&&!await requestConfirmation({title:'Trocar de imóvel?',message:`${warnings.join('\n')}\n\nTrocar de imóvel?`,confirmLabel:'Descartar e trocar',destructive:true}))return;
   if(pendingRoadPoints){clearRoadDraft();setMode('none');setLinePreview(null);}
  const next=e.target.value;
  if(next==='all'){
   const first=polys[0]||null;
   const built=buildSettingsForPolygon(projectId,first,full,prefs,false,'__imovel_completo__');
   setFeatureId('all');
   setSettings(built.settings);
   original.current=structuredClone(built.stored);
   setDirty(built.recovered);
   setMessage(`Modo Imóvel completo ativado: exibindo todas as ${polys.length} áreas coloridas do projeto.`);
   return;
  }
  const selected=polys.find(p=>p.id===next);if(!selected)return;
  const built=buildSettingsForPolygon(projectId,selected,full,prefs,false);
  setFeatureId(next);setSettings(built.settings);original.current=structuredClone(built.stored);setDirty(built.recovered);
  setMessage(built.recovered?'Edição local deste imóvel recuperada. Salve para sincronizar.':'Configuração e cor individual desta gleba carregadas.');
 }}>
  {polys.map((p,idx)=><option key={p.id} value={p.id}>{`${idx+1}. ${p.name} (${(p.areaM2/10000).toFixed(4)} ha)`}</option>)}
  <option value="all">Imóvel completo — todas as {polys.length} áreas juntas</option>
 </select></label>}{([['title','Título'],['reference','Matrícula / referência']] as const).map(([key,label])=><label key={key}>{label}<input value={settings[key]} onChange={e=>modify({[key]:e.target.value})}/></label>)}<details className="doc-accordion"><summary>Identificação complementar</summary><div className="doc-accordion-body">{([['district','Comarca'],['registry','Cartório'],['incra','Código INCRA'],['cib','Número CIB'],['technician','Responsável técnico']] as const).map(([key,label])=><label key={key}>{label}<input value={settings[key]} onChange={e=>modify({[key]:e.target.value})}/></label>)}</div></details></>}{projectStep===0?<div className="doc-step-navigation"><span>Etapa 1 de 4</span><button type="button" className="doc-workflow-action doc-primary" disabled={!polygon} onClick={()=>setProjectStep(1)}>Próximo →</button></div>:<div className="doc-step-navigation"><button type="button" className="doc-workflow-action doc-outline" onClick={()=>setProjectStep(0)}>← Anterior</button><span>Etapa 2 de 4</span><button type="button" className="doc-workflow-action doc-primary" disabled={!polygon} onClick={()=>{setTab('custom');setSection('prancha');setEditingOpen(true);}}>Próximo →</button></div>}</div>:<><div className="doc-subtabs">{([['prancha','Prancha',FileText],['mapa','Elementos',MapIcon],['perfil','Perfis',Palette],['assinatura','Assinatura',PenLine]] as const).map(([key,title,Icon])=><button key={key} className={section===key?'active':''} title={title} onClick={()=>setSection(key)}><Icon size={15}/><span>{title}</span></button>)}</div><div className="doc-panel">{section==='prancha'&&<><details className="doc-accordion"><summary>PRANCHA</summary><div className="doc-accordion-body"><label>Tipo de prancha<select value={settings.type} onChange={e=>modify({type:e.target.value as SheetSettings['type']})}><option value="lateral">Planta georreferenciada lateral</option><option value="compact">Planta técnica compacta</option></select></label><label className="doc-zoom-field">Nível de zoom do mapa: {zoomToPercent(settings.zoom)}%<div className="doc-zoom-control"><input aria-label="Nível de zoom do mapa (1 a 100 por cento)" type="range" min="1" max="100" step="1" value={zoomToPercent(settings.zoom)} onChange={e=>modify({zoom:percentToZoom(Number(e.target.value))})}/><output>{zoomToPercent(settings.zoom)}%</output></div><small>1% a 100% · ajuste de 1 em 1</small></label><label>Formato de impressão<select value={settings.paper} onChange={e=>modify({paper:e.target.value as 'A4'|'A3'})}><option value="A4">A4 — 210 × 297 mm</option><option value="A3">A3 — 297 × 420 mm</option></select></label><label>Escala técnica<input value={settings.scale} onChange={e=>modify({scale:e.target.value})}/></label><label>Folha<input value={settings.sheet} onChange={e=>modify({sheet:e.target.value})}/></label></div></details><details className="doc-accordion"><summary>ÁREA EM TAREFAS (REGIONAL)</summary><div className="doc-accordion-body"><p className="doc-hint">As áreas oficiais em hectares e m² são preservadas. A tarefa é uma medida tradicional que varia conforme a região.</p><label>UF do projeto<input value={projectUf||'Não informada'} disabled/></label><label>Metros quadrados por tarefa (0 = referência regional)<input type="number" min="0" step="1" value={settings.tarefaM2} onChange={e=>modify({tarefaM2:Math.max(0,Number(e.target.value)||0)})}/></label><small>{tarefaValueForState(projectUf,settings.tarefaM2)||'Informe a equivalência tradicional adotada na região'} m² por tarefa{activePart?` · ${tarefaCaption(activePart.areaM2,projectUf,settings.tarefaM2)}`:''}</small></div></details><details className="doc-accordion"><summary>COR DO PERÍMETRO NA PRANCHA</summary><div className="doc-accordion-body"><label>Cor interna<input type="color" value={isComposite&&sheetContext?.key.startsWith("division:")?sheetDivisionColor(projectDivisions.find(d=>`${d.featureId}:${d.partIndex}`===sheetContext!.key.slice(9))||projectDivisions[0],Math.max(0,projectDivisions.findIndex(d=>`${d.featureId}:${d.partIndex}`===sheetContext!.key.slice(9))),settings.divisionColors):settings.polygonFill} onChange={e=>isComposite&&sheetContext?.key.startsWith("division:")?modify({divisionColors:{...settings.divisionColors,[sheetContext!.key.slice(9)]:e.target.value}}):modify({polygonFill:e.target.value})}/></label><label>Cor da borda<input type="color" value={isComposite&&sheetContext?.key.startsWith("division:")?sheetDivisionColor(projectDivisions.find(d=>`${d.featureId}:${d.partIndex}`===sheetContext!.key.slice(9))||projectDivisions[0],Math.max(0,projectDivisions.findIndex(d=>`${d.featureId}:${d.partIndex}`===sheetContext!.key.slice(9))),settings.divisionColors):settings.polygonStroke} onChange={e=>isComposite&&sheetContext?.key.startsWith("division:")?modify({divisionColors:{...settings.divisionColors,[sheetContext!.key.slice(9)]:e.target.value}}):modify({polygonStroke:e.target.value})}/></label><label>Opacidade interna: {Math.round(settings.polygonFillOpacity*100)}%<input type="range" min="0" max="100" value={Math.round(settings.polygonFillOpacity*100)} onChange={e=>modify({polygonFillOpacity:Number(e.target.value)/100})}/></label></div></details></>}
 {section==='mapa'&&<><details className="doc-accordion"><summary>ELEMENTOS</summary><div className="doc-accordion-body">
 {isComposite&&activePart&&<div className="sv-active-gleba-panel" aria-label="Edição da gleba destacada">
   <strong>Gleba selecionada para edição</strong>
   <label>Gleba<select value={`${activePart.featureId}:${activePart.partIndex}`} onChange={e=>setActivePartId(e.target.value)}>{orderedProjectDivisions.map(part=><option key={`${part.featureId}:${part.partIndex}`} value={`${part.featureId}:${part.partIndex}`}>{part.name}</option>)}</select></label>
   <small>Passe o mouse sobre outra gleba na planta para destacá-la e mostrar os controles dela aqui.</small>
   <label>Nome na prancha<input value={settings.divisionNames[`division:${activePart.featureId}:${activePart.partIndex}:title`]??activePart.name} onChange={e=>modify({divisionNames:{...settings.divisionNames,[`division:${activePart.featureId}:${activePart.partIndex}:title`]:e.target.value}})}/></label>
   <label>Preenchimento<input type="color" value={sheetDivisionColor(activePart,projectDivisions.indexOf(activePart),settings.divisionColors)} onChange={e=>modify({divisionColors:{...settings.divisionColors,[`${activePart.featureId}:${activePart.partIndex}`]:e.target.value}})}/></label>
   <details><summary>Editar vértices desta gleba ({activeVertices.length})</summary>{activeVertices.map((_,i)=>{const key=`division:${activePart.featureId}:${activePart.partIndex}:vertex:${i}`;return <div className="sv-active-vertex-row" key={key}><input aria-label={`Nome do vértice ${i+1}`} value={settings.divisionVertexNames[key]??`V-${String(i+1).padStart(2,'0')}`} onChange={e=>modify({divisionVertexNames:{...settings.divisionVertexNames,[key]:e.target.value}})}/><label><input type="checkbox" checked={!settings.hiddenDivisionVertices[key]} onChange={e=>modify({hiddenDivisionVertices:{...settings.hiddenDivisionVertices,[key]:!e.target.checked}})}/> Exibir</label></div>})}</details>
   <details><summary>Confrontantes desta gleba</summary>{activeVertices.map((_,i)=>{const key=`division:${activePart.featureId}:${activePart.partIndex}:neighbor:${i}`;return <label key={key}>V-{String(i+1).padStart(2,'0')} → V-{String((i+1)%activeVertices.length+1).padStart(2,'0')}<input value={settings.divisionNeighbors[key]??''} onChange={e=>modify({divisionNeighbors:{...settings.divisionNeighbors,[key]:e.target.value}})}/></label>})}</details>
 </div>}
 <details className="doc-accordion doc-accordion-nested"><summary>COTAS PERSONALIZADAS</summary><div className="doc-accordion-body sv-custom-cotas-panel">
 <p className="doc-hint">Medição direta entre dois vértices, sem somar lados intermediários. Arraste a linha verde tracejada ou o valor na planta para reposicionar a cota sem modificar a distância. Desative "Cotas" para mostrar apenas as cotas personalizadas.</p>
 {activeVertices.length>1&&<><label>Vértice inicial<select value={Math.min(cotaFrom,activeVertices.length-1)} onChange={e=>setCotaFrom(Number(e.target.value))}>{activeVertices.map((_,i)=><option key={i} value={i}>V-{String(i+1).padStart(2,'0')}</option>)}</select></label>
 <label>Vértice final<select value={Math.min(cotaTo,activeVertices.length-1)} onChange={e=>setCotaTo(Number(e.target.value))}>{activeVertices.map((_,i)=><option key={i} value={i}>V-{String(i+1).padStart(2,'0')}</option>)}</select></label>
 <button type="button" className="doc-outline" disabled={cotaFrom===cotaTo||cotaFrom>=activeVertices.length||cotaTo>=activeVertices.length} onClick={()=>modify({customCotas:[...settings.customCotas,{id:crypto.randomUUID(),target:activeTarget,from:cotaFrom,to:cotaTo}]})}>Adicionar cota direta</button></>}
 {settings.customCotas.filter(c=>c.target===activeTarget).map(c=><div key={c.id} className="sv-active-vertex-row"><span>V-{String(c.from+1).padStart(2,'0')} → V-{String(c.to+1).padStart(2,'0')}</span><button type="button" className="doc-outline" onClick={()=>modify({customCotas:settings.customCotas.map(item=>item.id===c.id?{...item,offsetX:0,offsetY:0}:item)})}>Centralizar</button><button type="button" className="doc-outline" onClick={()=>modify({customCotas:settings.customCotas.filter(item=>item.id!==c.id)})}>Remover</button></div>)}
 </div></details> <details className="doc-accordion"><summary>Nome no Mapa</summary><div className="doc-accordion-body"><label>Nome<input value={newMapName} maxLength={180} onChange={e=>setNewMapName(e.target.value)}/></label><button type="button" className="doc-outline" disabled={!polygon||!newMapName.trim()} onClick={()=>{if(!polygon)return;const n=polygon.vertices.length,lon=polygon.vertices.reduce((acc,v)=>acc+v[0],0)/n,lat=polygon.vertices.reduce((acc,v)=>acc+v[1],0)/n;const item:MapName={id:crypto.randomUUID(),text:newMapName.trim(),lon,lat,color:'#111827',size:13,angle:0};modify({mapNames:[...settings.mapNames,item]});setNewMapName('');}}>Adicionar nome</button>{settings.mapNames.map(item=><div className="doc-neighbor-row" key={item.id}><label>Texto<input value={item.text} onChange={e=>modify({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,text:e.target.value}:v)})}/></label><label>Cor<input type="color" value={item.color} onChange={e=>modify({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,color:e.target.value}:v)})}/></label><label>Longitude<input type="number" step="0.000001" value={item.lon} onChange={e=>modify({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,lon:Number(e.target.value)}:v)})}/></label><label>Latitude<input type="number" step="0.000001" value={item.lat} onChange={e=>modify({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,lat:Number(e.target.value)}:v)})}/></label><label>Tamanho<input type="number" min="6" max="36" value={item.size} onChange={e=>modify({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,size:Math.max(6,Math.min(36,Number(e.target.value)||13))}:v)})}/></label><label>Rotação<input type="number" min="-180" max="180" value={item.angle} onChange={e=>modify({mapNames:settings.mapNames.map(v=>v.id===item.id?{...v,angle:Math.max(-180,Math.min(180,Number(e.target.value)||0))}:v)})}/></label><button className="doc-outline" type="button" onClick={()=>modify({mapNames:settings.mapNames.filter(v=>v.id!==item.id)})} aria-label="Remover nome"><Trash2 size={14}/></button></div>)}</div></details><div className="sv-auto-cotas-toggle"><label><input type="checkbox" checked={settings.exteriorCotas} onChange={e=>modify({exteriorCotas:e.target.checked})}/> Cotas externas (tracejadas)</label><input type="color" aria-label="Cor das cotas externas e seus números" title="Cor das cotas externas e seus números" value={settings.elements.cotas.color} onChange={e=>modify({elements:{...settings.elements,cotas:{...settings.elements.cotas,color:e.target.value}}})}/></div><div className="doc-element-grid">{(Object.keys(labels) as SheetElement[]).map(k=><div className="doc-element" key={k}><button type="button" aria-pressed={settings.elements[k].visible} className={settings.elements[k].visible?'active':''} onClick={()=>modify({elements:{...settings.elements,[k]:{...settings.elements[k],visible:!settings.elements[k].visible}}})}>{labels[k]}</button><div className="doc-element-controls"><label>Tamanho: {settings.elements[k].size}%<input type="range" min="40" max="250" step="5" aria-label={`Tamanho ${labels[k]}`} value={settings.elements[k].size} onChange={e=>modify({elements:{...settings.elements,[k]:{...settings.elements[k],size:Number(e.target.value)}}})}/></label><label>Cor<input aria-label={`Cor ${labels[k]}`} type="color" value={settings.elements[k].color} onChange={e=>modify({elements:{...settings.elements,[k]:{...settings.elements[k],color:e.target.value}}})}/></label></div></div>)}</div><details className="doc-vertex-visibility"><summary>Ocultar vértices</summary><div className="sv-vertex-auto-actions"><button type="button" className="doc-outline" onClick={autoHideStraight}>Ocultar alinhados</button><button type="button" className="doc-outline" onClick={restoreHiddenVertices}>Exibir todos</button></div><div className="doc-vertex-checks">{isComposite?projectDivisions.flatMap((part,index)=>(part.rings[0]||[]).map((_,vertex)=>{const key=`division:${part.featureId}:${part.partIndex}:vertex:${vertex}`;return <label key={key}><input type="checkbox" checked={Boolean(settings.hiddenDivisionVertices[key])} onChange={event=>modify({hiddenDivisionVertices:{...settings.hiddenDivisionVertices,[key]:event.target.checked}})}/>{index+1}. {part.name} · V-{String(vertex+1).padStart(2,'0')}</label>})):names.map((name,index)=><label key={index}><input type="checkbox" checked={settings.hiddenVertices.includes(index)} onChange={event=>modify({hiddenVertices:event.target.checked?[...settings.hiddenVertices,index]:settings.hiddenVertices.filter(item=>item!==index)})}/>{name}</label>)}</div></details><p className="doc-hint">A grade UTM é calculada em WGS84, no fuso do imóvel, apenas para referência cartográfica. Verifique datum, escala e precisão antes da emissão técnica.</p></div></details>{isComposite&&<><details className="doc-accordion"><summary>GLEBAS DO IMÓVEL COMPLETO</summary><div className="doc-accordion-body"><p className="doc-hint">Cada gleba tem contorno, vértices e etiquetas independentes. Arraste os nomes e os vértices diretamente na prévia. Toque em um texto para abrir as opções de aparência; no computador, use o botão direito. Arraste para reposicionar.</p>{orderedProjectDivisions.map((part,index)=>{const id=`division:${part.featureId}:${part.partIndex}:title`;const areaId=`${part.featureId}:${part.partIndex}`;return <div className="doc-neighbor-row doc-division-card" key={areaId}><label>{index+1}. {part.name} · {(part.areaM2/10000).toFixed(4)} ha</label><input aria-label={`Nome exibido na prancha da gleba ${index+1}`} value={settings.divisionNames[id]??part.name} onChange={e=>modify({divisionNames:{...settings.divisionNames,[id]:e.target.value}})}/><label className="doc-color-control">Cor da gleba<input aria-label={`Cor da gleba ${index+1}`} type="color" value={sheetDivisionColor(part,projectDivisions.indexOf(part),settings.divisionColors)} onChange={e=>modify({divisionColors:{...settings.divisionColors,[areaId]:e.target.value}})}/></label></div>})}</div></details></>}<details className="doc-accordion"><summary>MINIMAPA</summary><div className="doc-accordion-body"><label>Estilo<select value={settings.background} onChange={e=>modify({background:e.target.value as SheetSettings['background']})}><option value="vector">Vetorial</option><option value="satellite">Satélite</option><option value="street">Ruas</option><option value="none">Nenhum (fundo branco)</option></select></label><label>Opacidade: {settings.miniOpacity}%<input type="range" min="0" max="100" value={settings.miniOpacity} onChange={e=>modify({miniOpacity:Number(e.target.value)})}/></label><label className="doc-inline"><input type="checkbox" checked={settings.highlight} onChange={e=>modify({highlight:e.target.checked})}/> Destacar perímetro</label></div></details><details className="doc-accordion"><summary>VÉRTICES E CONFRONTANTES</summary><div className="doc-accordion-body"><label>Tipo de identificação<select value="auto" disabled><option value="auto">Automático pelo projeto</option></select></label>{!isComposite&&names.map((name,i)=><div className="doc-neighbor-row" key={i}><label>De {name} a {names[(i+1)%names.length]}</label><div className="doc-neighbor-edit"><input placeholder="Nome do confrontante" value={settings.neighbors[i]??croqui?.neighbors[i]??(polygon?readConfrontation(polygon.properties,i,names.length):'')} onChange={e=>modify({neighbors:setSegmentConfrontant(polygon!.properties,names.length,settings.neighbors,i,e.target.value,croqui?.neighbors)})}/><button title="Completar cadastro do confrontante" onClick={()=>{setNeighborDialog(i);setNeighborUntil((i+1)%names.length);setNeighborDirection('auto');const value=settings.neighbors[i]??croqui?.neighbors[i]??readConfrontation(polygon!.properties,i,names.length);setNeighborDraft({...blankNeighbor(),...settings.neighborDetails[String(i)],property:settings.neighborDetails[String(i)]?.property||value});}}>⋯</button></div></div>)}{isComposite&&<><h3 className="doc-accordion-subtitle">CONFRONTAÇÕES POR GLEBA</h3><p className="doc-hint">As confrontações de cada gleba são independentes nesta prancha. A edição não altera os dados cadastrais das outras glebas.</p>{orderedProjectDivisions.map((part,idx)=><details key={`${part.featureId}:${part.partIndex}`} className="doc-division-group"><summary><span>{idx+1}. {part.name}</span><span>{(part.rings[0]||[]).length} divisas</span></summary><div className="doc-division-edges">{(part.rings[0]||[]).map((_,vertex)=>{const key=`division:${part.featureId}:${part.partIndex}:neighbor:${vertex}`;return <div className="doc-neighbor-row doc-confrontation-row" key={key}><label>V-{String(vertex+1).padStart(2,'0')} → V-{String((vertex+1)%(part.rings[0]?.length||1)+1).padStart(2,'0')}</label><input aria-label={`Confrontante da gleba ${part.name}, segmento ${vertex+1}`} placeholder="Confrontante desta divisa" value={settings.divisionNeighbors[key]??readConfrontation(part.properties||{},vertex,part.rings[0].length)} onChange={e=>modify({divisionNeighbors:{...settings.divisionNeighbors,[key]:e.target.value}})}/></div>})}</div></details>)}</>}<p className="doc-hint">Uma identificação por confrontação contínua. Use ⋯ para cadastrar um intervalo de vértices.</p></div></details><details className="doc-accordion"><summary>LINHAS TÉCNICAS</summary><div className="doc-accordion-body"><div className="doc-tool-row"><button className={mode==='line'?'active':''} onClick={()=>switchTool('line')} title="Desenhar linha"><PenLine size={16}/></button><button className={mode==='edit'?'active':''} onClick={()=>switchTool('edit')} title="Editar extremidade"><Edit3 size={16}/></button><button disabled={!settings.technicalLines.length} onClick={()=>modify({technicalLines:settings.technicalLines.slice(0,-1)})} title="Desfazer última linha"><RotateCcw size={16}/></button><button disabled={!settings.technicalLines.length} onClick={()=>modify({technicalLines:[]})} title="Remover todas as linhas"><Trash2 size={16}/></button></div>{mode==='line'&&<small className="doc-hint">Clique e arraste sobre a planta para criar a linha técnica.</small>}{mode==='edit'&&<small className="doc-hint">Arraste as extremidades azuis da linha técnica ou os pontos verdes da servidão.</small>}<label>Linha automática do trecho<select value={autoLineSegment} onChange={e=>setAutoLineSegment(Number(e.target.value))}>{names.map((n,i)=><option key={i} value={i}>{n} a {names[(i+1)%names.length]}</option>)}</select></label><button className="doc-outline" disabled={!polygon} onClick={addAutomaticLine}>Criar linha automática</button><label>Cor das linhas<input type="color" value={lineColor} onChange={e=>setLineColor(e.target.value)}/></label></div></details><details className="doc-accordion"><summary>SERVIDÕES</summary><div className="doc-accordion-body"><div className="doc-servitude-row"><button className={`doc-servitude-action ${mode==='road'?'active':''}`} onClick={()=>switchTool('road')}><PenLine size={15}/> Desenhar</button><button className="doc-servitude-action" disabled={!settings.sheetRoads.length} onClick={()=>modify({sheetRoads:settings.sheetRoads.slice(0,-1)})}><Trash2 size={15}/> Última</button></div>{mode==='road'&&<><small className="doc-hint">Clique na planta para marcar os pontos do percurso, formando curvas suaves. Dê dois cliques no último ponto para finalizar.</small><div className="doc-servitude-draft-actions"><span>{roadAnchors.length} ponto(s) marcados</span><button disabled={roadAnchors.length<2} onClick={()=>finishRoad()}>Finalizar servidão</button><button onClick={()=>switchTool('none',true)}>Cancelar desenho</button></div></>}<label>Cor das bordas da nova servidão<input type="color" value={roadColor} onChange={e=>setRoadColor(e.target.value)}/></label><label>Largura da nova servidão: {roadWidth}px<input type="range" min="8" max="90" value={roadWidth} onChange={e=>setRoadWidth(Number(e.target.value))}/></label>{settings.sheetRoads.map((road,i)=><div className="doc-saved-road" key={road.id||i}><strong>Servidão {i+1} · {road.points.length} pontos</strong><button onClick={()=>switchTool('edit')}>Editar pontos</button><label>Largura: {road.width}px<input type="range" min="8" max="90" value={road.width} onChange={e=>modify({sheetRoads:settings.sheetRoads.map((r,j)=>i===j?{...r,width:Number(e.target.value)}:r)})}/></label><button onClick={()=>modify({sheetRoads:settings.sheetRoads.filter((_,j)=>j!==i)})}>Excluir servidão</button></div>)}<div className="doc-status-card"><strong>{lineCount} linha(s) técnica(s)</strong><span>{easementCount} servidão(ões) reaproveitadas do croqui do projeto.</span></div><small className="doc-hint">A prancha replica automaticamente as linhas e servidões salvas no croqui do mesmo projeto.</small><small className="doc-hint">Toque em um rótulo para personalizar sua aparência; arraste para reposicioná-lo. No computador, o botão direito abre as mesmas opções.</small></div></details></>}
 {section==='mapa'&&settings.hiddenLabels.length>0&&<details className="doc-accordion"><summary>Rótulos excluídos ({settings.hiddenLabels.length})</summary><div className="doc-accordion-body">{settings.hiddenLabels.map(key=><div key={key} className="doc-neighbor-row"><span>{key.startsWith('neighbor:')?`Confrontante ${Number(key.slice(9))+1}`:key.includes(':neighbor:')?`Confrontante ${Number(key.split(':').pop())+1}`:key.startsWith('map-name:')?settings.mapNames.find(name=>name.id===key.slice(9))?.text||'Nome no mapa':key.endsWith(':title')?'Nome da gleba':key.startsWith('property:')?'Nome ou medida do imóvel':key.startsWith('vertex:')?'Nome do vértice':key}</span><button type="button" className="doc-outline" onClick={()=>modify({hiddenLabels:settings.hiddenLabels.filter(item=>item!==key)})}>Restaurar</button></div>)}</div></details>}
{section==='perfil'&&<><details className="doc-accordion"><summary>PADRÃO REGULATÓRIO / PERFIL</summary><div className="doc-accordion-body"><label>Perfil<select value={settings.profile} onChange={e=>modify({profile:e.target.value as SheetSettings['profile']})}><option value="custom">Personalizado (manual)</option><option value="incra">INCRA / Cartório</option><option value="ambiental">SEIA / CEFIR Bahia</option><option value="comercial">Comercial / Executivo</option><option value="reurb">REURB / Regularização fundiária</option></select></label><button className="doc-outline" onClick={()=>{modify({elements:{...settings.elements,cotas:{...settings.elements.cotas,size:settings.profile==='comercial'?75:100},vertices:{...settings.elements.vertices,size:settings.profile==='comercial'?75:100}}});}}>Aplicar perfil</button></div></details><details className="doc-accordion"><summary>TABELA TÉCNICA DE COORDENADAS</summary><div className="doc-accordion-body"><p>Dados de cada vértice disponíveis na origem do projeto.</p></div></details></>}
 {section==='assinatura'&&<><details className="doc-accordion"><summary>ASSINATURA</summary><div className="doc-accordion-body"><label className="doc-inline"><input type="checkbox" checked={effectiveSettings.signatureEnabled} onChange={e=>modify({signatureSource:e.target.checked?(isSheetSignatureImage(settings.signature)?'custom':'account'):'none',signatureEnabled:e.target.checked})}/> Incluir assinatura técnica</label><small>{settings.signatureSource==='account'&&effectiveSettings.signatureEnabled?'Assinatura da conta — carregada automaticamente':settings.signatureSource==='custom'&&effectiveSettings.signatureEnabled?'Assinatura personalizada desta prancha':accountSignature?'Assinatura desativada nesta prancha':'Nenhuma assinatura disponível. Cadastre uma em Personalização → Responsável técnico e assinatura.'}</small><FileUploadField label="Substituir assinatura nesta prancha" description="PNG, JPEG ou WebP · até 2 MB" accept="image/png,image/jpeg,image/webp" maxBytes={2*1024*1024} cancellable onFile={signature} onRemove={()=>modify({signature:accountSignature||'',signatureSource:accountSignature?'account':'none',signatureEnabled:Boolean(accountSignature)})}/><SignaturePadControl label="Desenhar assinatura na tela" onApply={dataUrl=>modify({signature:dataUrl,signatureSource:'custom',signatureEnabled:true})}/>{isSheetSignatureImage(accountSignature)&&<button className="doc-outline" type="button" onClick={()=>modify({signature:'',signatureSource:'account',signatureEnabled:true})}>Usar assinatura da conta</button>}<button className="doc-outline" onClick={()=>modify({signature:'',signatureEnabled:false,signatureSource:'none'})}>Remover assinatura desta prancha</button><label>Tamanho: {settings.signatureSize}%<input type="range" min="20" max="180" value={settings.signatureSize} onChange={e=>modify({signatureSize:Number(e.target.value)})}/></label><button className="doc-outline" type="button" onClick={()=>modify({signatureOffsetX:0,signatureOffsetY:0})}>Centralizar assinatura</button><small>Arraste a imagem da assinatura na prévia para reposicionar.</small>{effectiveSettings.signatureEnabled&&<img className="doc-sign-preview" src={effectiveSettings.signature} alt="Prévia da assinatura técnica"/>}</div></details></>}
 </div>{editingOpen&&<div className="doc-step-navigation"><button type="button" className="doc-workflow-action doc-outline" onClick={()=>{setTab('project');setProjectStep(1);setEditingOpen(false);}}>← Anterior</button><span>Etapa 3 de 4</span><button type="button" className="doc-workflow-action doc-primary" disabled={!polygon} onClick={()=>setEditingOpen(false)}>Próximo →</button></div>}</>}</aside>
 <div className="doc-main"><div className="doc-viewer" ref={viewerRef}>{loading?<div className="doc-empty">Carregando dados do projeto...</div>:polygon?<div className={`doc-svg-paper ${mode==='line'||mode==='road'?'doc-interaction-mode':''}`} style={{width:`${previewZoom}%`}} onContextMenu={sheetRightClick} onMouseOver={hoverSheetDivision} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancelPointerGesture} onClick={onRoadClick} onDoubleClick={onRoadDoubleClick}>
 <div className="doc-svg-content" dangerouslySetInnerHTML={{__html:displaySvg}}/>
 {showSignatureOverlay&&<div data-sheet-signature="1" className="doc-signature-overlay" role="img" aria-label="Assinatura técnica arrastável" style={{left:`${signatureBox.x/1600*100}%`,top:`${signatureBox.y/1000*100}%`,width:`${signatureBox.width/1600*100}%`,height:`${signatureBox.height/1000*100}%`}}><img src={effectiveSettings.signature} alt="Assinatura técnica" draggable={false}/></div>}
 </div>:<div className="doc-empty">Selecione um projeto para visualizar a prancha.</div>}</div><div className="doc-toolbar"><div className="doc-toolbar-left"><button disabled={!polygon} onClick={autoOrganize}><WandSparkles size={15}/> Organizar</button><button disabled={!polygon} onClick={organizeConfrontants} title="Organizar confrontantes por posição">Confrontantes</button><button disabled={!polygon} onClick={()=>setConfrontantImportOpen(true)} title="Importar confrontantes por texto" aria-label="Colar texto dos confrontantes">⋯</button><button disabled={!dirty} title="Descartar edições" onClick={restore}><RotateCcw size={15}/></button></div><div className="doc-toolbar-middle"><button disabled={!polygon||previewZoom<=40} aria-label="Reduzir zoom da prancha" onClick={()=>changePreviewZoom(-10)}>−</button>{previewZoom}%<button disabled={!polygon||previewZoom>=180} aria-label="Aumentar zoom da prancha" onClick={()=>changePreviewZoom(10)}>+</button></div></div>{tab==='custom'&&!editingOpen&&<div className="doc-step-navigation doc-preview-step-navigation"><button type="button" className="doc-workflow-action doc-outline" onClick={()=>{setTab('custom');setSection('prancha');setEditingOpen(true);}}>← Anterior</button><span>Etapa 4 de 4</span><button type="button" className="doc-workflow-action doc-primary" disabled={!polygon} onClick={()=>setDownloadOpen(true)}><Download size={14}/> Baixar prancha</button></div>}</div></div></div>{sheetContext&&<div className="doc-sheet-context" role="dialog" aria-label={sheetContext.kind==='polygon'?'Aparência do polígono':'Aparência do rótulo'} style={{left:sheetContext.x,top:sheetContext.y}}><header><strong>{sheetContext.kind==='polygon'?'Aparência do polígono':'Personalizar rótulo'}</strong><button onClick={()=>setSheetContext(null)} aria-label="Fechar"><X size={16}/></button></header>{sheetContext.kind==='polygon'?<><label>Cor interna<input type="color" value={isComposite&&sheetContext?.key.startsWith("division:")?sheetDivisionColor(projectDivisions.find(d=>`${d.featureId}:${d.partIndex}`===sheetContext!.key.slice(9))||projectDivisions[0],Math.max(0,projectDivisions.findIndex(d=>`${d.featureId}:${d.partIndex}`===sheetContext!.key.slice(9))),settings.divisionColors):settings.polygonFill} onChange={e=>isComposite&&sheetContext?.key.startsWith("division:")?modify({divisionColors:{...settings.divisionColors,[sheetContext!.key.slice(9)]:e.target.value}}):modify({polygonFill:e.target.value})}/></label><label>Cor da borda<input type="color" value={isComposite&&sheetContext?.key.startsWith("division:")?sheetDivisionColor(projectDivisions.find(d=>`${d.featureId}:${d.partIndex}`===sheetContext!.key.slice(9))||projectDivisions[0],Math.max(0,projectDivisions.findIndex(d=>`${d.featureId}:${d.partIndex}`===sheetContext!.key.slice(9))),settings.divisionColors):settings.polygonStroke} onChange={e=>isComposite&&sheetContext?.key.startsWith("division:")?modify({divisionColors:{...settings.divisionColors,[sheetContext!.key.slice(9)]:e.target.value}}):modify({polygonStroke:e.target.value})}/></label><label>Opacidade interna · {Math.round(settings.polygonFillOpacity*100)}%<input type="range" min="0" max="100" value={Math.round(settings.polygonFillOpacity*100)} onChange={e=>modify({polygonFillOpacity:Number(e.target.value)/100})}/></label><label>Espessura da borda<input type="range" min="1" max="10" step=".5" value={settings.polygonStrokeWidth} onChange={e=>modify({polygonStrokeWidth:Number(e.target.value)})}/></label></>:<>{sheetContext.key.startsWith('division:')&&sheetContext.key.endsWith(':title')&&<label>Nome exibido<input value={settings.divisionNames[sheetContext.key]??projectDivisions.find(d=>sheetContext.key===`division:${d.featureId}:${d.partIndex}:title`)?.name??''} onChange={e=>modify({divisionNames:{...settings.divisionNames,[sheetContext.key]:e.target.value}})}/></label>}{contextMapName?<><label>Cor do texto<input type="color" value={contextMapName.color} onChange={e=>modify({mapNames:updateMapNameAppearance(settings.mapNames,sheetContext.key,{color:e.target.value})})}/></label><label>Rotação · {contextMapName.angle}°<input type="range" min="-180" max="180" step="1" value={contextMapName.angle} onChange={e=>modify({mapNames:updateMapNameAppearance(settings.mapNames,sheetContext.key,{angle:Number(e.target.value)})})}/></label><label>Tamanho do texto · {contextMapName.size}px<input type="range" min="6" max="36" step="1" value={contextMapName.size} onChange={e=>modify({mapNames:updateMapNameAppearance(settings.mapNames,sheetContext.key,{size:Number(e.target.value)})})}/></label><button className="doc-outline" onClick={()=>modify({mapNames:updateMapNameAppearance(settings.mapNames,sheetContext.key,{color:'#111827',size:13,angle:0})})}>Restaurar aparência do rótulo</button></>:<><label>Cor do texto<input type="color" value={settings.labelColors[sheetContext.key]||(sheetContext.key==='property:title'?'#17355a':'#17212b')} onChange={e=>modify({labelColors:{...settings.labelColors,[sheetContext.key]:e.target.value}})}/></label><label>Rotação · {settings.labelAngles[sheetContext.key]||0}°<input type="range" min="-180" max="180" step="1" value={settings.labelAngles[sheetContext.key]||0} onChange={e=>modify({labelAngles:{...settings.labelAngles,[sheetContext.key]:Number(e.target.value)}})}/></label><label>Tamanho do texto · {settings.labelSizes[sheetContext.key]??100}%<input type="range" min="40" max="250" step="5" value={settings.labelSizes[sheetContext.key]??100} onChange={e=>modify({labelSizes:{...settings.labelSizes,[sheetContext.key]:Number(e.target.value)}})}/></label><button className="doc-outline" onClick={()=>{const angles={...settings.labelAngles};const sizes={...settings.labelSizes};const colors={...settings.labelColors};delete angles[sheetContext.key];delete sizes[sheetContext.key];delete colors[sheetContext.key];modify({labelAngles:angles,labelSizes:sizes,labelColors:colors});}}>Restaurar aparência do rótulo</button></>}<button type="button" className="doc-outline" onClick={()=>{const key=sheetContext.key;if(!settings.hiddenLabels.includes(key))modify({hiddenLabels:[...settings.hiddenLabels,key]});setSheetContext(null);}}><Trash2 size={14}/> Excluir da prancha</button></>}</div>}{neighborDialog!==null&&<div className="doc-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setNeighborDialog(null)}}><div className="doc-dialog" role="dialog" aria-modal="true" aria-label="Cadastro de confrontante"><header><strong>Cadastro do confrontante</strong><button onClick={()=>setNeighborDialog(null)}><X size={18}/></button></header><p>Preencha e escolha até qual vértice se estende a confrontação. Cada trecho mantém um rótulo independente, mesmo com nomes iguais.</p><label>Confrontação até o vértice<select value={neighborUntil} onChange={e=>setNeighborUntil(Number(e.target.value))}>{names.map((n,i)=><option key={i} value={i} disabled={i===neighborDialog}>{n}</option>)}</select></label><label>Caminho da confrontação<select value={neighborDirection} onChange={e=>setNeighborDirection(e.target.value as ConfrontantPath)}><option value="auto">Acompanhar numeração dos vértices</option><option value="forward">Via {names[(neighborDialog+1)%names.length]}</option><option value="reverse">Via {names[(neighborDialog-1+names.length)%names.length]}</option></select></label><small className="doc-hint" title={resolveConfrontantPath(names,neighborDialog,neighborUntil,neighborDirection).vertices.map(j=>names[j]).join(' → ')}>Trecho: {confrontantPathSummary(names,resolveConfrontantPath(names,neighborDialog,neighborUntil,neighborDirection).vertices)}</small>{([['property','Propriedade','showProperty'],['owner','Proprietário','showOwner'],['cpf','CPF/CNPJ','showCpf'],['rg','RG','showRg']] as const).map(([field,title,flag])=><div className="doc-dialog-row" key={field}><label>{title}<input value={neighborDraft[field]} onChange={e=>setNeighborDraft(d=>({...d,[field]:field==='cpf'?maskBrazilianDocumentInput(e.target.value):field==='rg'?formatBrazilianRg(e.target.value):e.target.value}))}/></label><label className="doc-checkbox"><input type="checkbox" checked={neighborDraft[flag]} onChange={e=>setNeighborDraft(d=>({...d,[flag]:e.target.checked}))}/> Exibir na planta</label></div>)}<label>Tipo do limite / divisa<input placeholder="Cerca, rio, estrada..." value={neighborDraft.limitType||''} onChange={e=>setNeighborDraft(d=>({...d,limitType:e.target.value}))}/></label><footer><button onClick={()=>setNeighborDialog(null)}>Cancelar</button><button className="doc-primary" onClick={applyNeighbor}>Salvar cadastro</button></footer></div></div>}</main>{confrontantImportOpen&&polygon&&<ConfrontantImportDialog
   vertices={(isComposite?compositeEdges.map(edge=>edge.start):polygon.vertices).map(point=>[point[0],point[1]])}
   names={(isComposite?compositeEdges:polygon.vertices).map((_,i)=>`V-${String(i+1).padStart(2,'0')}`)}
   edgeLabels={isComposite?compositeEdges.map(edge=>`${edge.name} · V-${edge.index+1} → V-${edge.index+2}`):undefined}
   edgeSides={isComposite?compositeEdges.map(edge=>Math.abs(edge.outward[0])>Math.abs(edge.outward[1])?(edge.outward[0]>0?'LESTE':'OESTE'):(edge.outward[1]>0?'NORTE':'SUL')):undefined}
   existing={isComposite?compositeEdges.map(edge=>settings.divisionNeighbors[edge.key]||''):settings.neighbors}
   onClose={()=>setConfrontantImportOpen(false)} onApply={importConfrontations}/>}</>;
}
