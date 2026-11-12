import 'leaflet/dist/leaflet.css';
import './map.css';
import { projectOwners } from '../projects/projectOwners';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as L from 'leaflet';
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import { ArrowLeft, Copy, Check, CheckCircle2, ChevronDown, Download, History, Home, Layers3, LocateFixed, Map as MapIcon, MapPin, Minus, Pentagon, Plus, Route, Save, Share2, Undo2, Redo2, Upload, X, MousePointer2, Circle, Square, Pencil, Trash2, RefreshCw, Ruler, SlidersHorizontal, Mountain, Globe2, Scissors, Crosshair, PanelRightClose, Waypoints, Grid3X3 } from 'lucide-react';
import { useToast } from '../../components/Toast';
import {requestConfirmation} from '../../components/ConfirmDialogHost';
import {addRouteTransitionConfirmation} from '../../lib/routeTransitions';
import { useAuth } from '../auth/AuthContext';
import { getProject,saveProjectBundle } from '../projects/projectsApi';
import {locationForDrawnPolygon,municipalityAtLocation} from './municipalityOfGeometry';
import {getDocumentCustomization} from '../customization/customizationApi';
import {fromProject,mergeConfrontantsIntoProperties,readConfrontants,saveConfrontants as saveSharedConfrontants} from '../documents/confrontantRegistry';
import {record} from '../memorial/memorialEngine';
import type { Municipality } from './geoData';
import { WorkSidebar, LayerCatalog, PointDialog, ValidationDialog, ImportDialog, baseProject, type MapProjectData, type ActiveLayer, type Modal, type Panel, type Issue } from './MapWorkPanels';
import { FeatureDetailsPanel } from './FeatureDetailsPanel';
import { layerProxyUrl, GEOSERVICES_BASE, haversine, type OfficialLayer } from './geoServices';
import { officialInfoTargets, queryOfficialFeatureInfo, type OfficialInfoResult } from './officialFeatureInfo';
import {toKml,toCsv,downloadText,kmlFeatures} from './mapFormats';
import {isLegacyToolSelected,isMoreToolsSelected,legacyMapTools, type LegacyToolId} from './legacyToolCatalog';
import {GlebaPanel} from './GlebaPanel';
import {extractManualGleba} from './extractManualGleba';
import {SpatialAnalysis} from '../analysis/SpatialAnalysis';
import {parcelFromFeature,validateParcel} from '../analysis/topology';
import {AdvancedMapSearch} from './AdvancedMapSearch';
import type {OfficialPropertyResult} from './propertyLookup';
import {importPointFile} from './pointImport';
import { buildPolygonFromBatch, importedPointBatches, visibleOnMap } from './importedPointPolygon';
import { serializeMapFeature, restoreMapFeatures, mapFingerprint, hasVerifiedMapEdits } from './mapCloudPersistence';
import { mapDraftKeys, writeMapDraftSnapshot } from './mapDraftStorage';
import { readOfflineDraft, writeOfflineDraft } from '../../lib/offlineDraftStore';
import { findMapSnap } from './mapSnap';
import { measureMapGeometry } from './geometryMetrics';
import { tarefaCaption, tarefaUnitForState } from '../../lib/agrarianMeasure';
import { openRing, closeRing, insertVertexOnEdge, removeVertexAt, replaceExteriorRing, segmentMetadataAfterInsert, segmentMetadataAfterRemove } from './vertexEditing';
import { getVertexAppearance, updateVertexAppearance, shiftVertexAppearance, copyVertexAppearanceToAll } from './vertexAppearance';
import { svgTextOutline } from '../../lib/svgTextContrast';
import {toShapefileZip,toTechnicalPackage,downloadBytes,zipFiles} from './shapefileExport';
import { AdvancedTerrainModal, reversePolygonRing, featuresToDxf, type AdvancedToolKind } from './advancedTerrainTools';
type Tool = 'pan'|'point'|'line'|'polygon'|'rectangle'|'circle'|'arc'|'measure';
type Basemap='default'|'satellite'|'clarity'|'cloudless'|'hybrid'|'streets'|'topo'|'relief';
type MapFeature=Feature<Geometry,GeoJsonProperties>;
const mapToolLabels:Record<Tool,string>={pan:'Mapa',point:'Pontos',line:'Linha',polygon:'Polígono',rectangle:'Retângulo',circle:'Círculo',arc:'Arco',measure:'Medição'};
const osm='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const satellite='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const claritySatellite='https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const basemapOptions:[Basemap,string][]=[['default','Mapa padrão'],['satellite','Satélite'],['clarity','Satélite Clarity'],['hybrid','Satélite + vias'],['streets','Ruas'],['topo','Topográfico'],['relief','Relevo']];
const lotColors=['#2075db','#15a876','#a855f7','#ef8b25','#d84588','#17a9bf','#83a530','#c15e3c'];
const pointStyle={color:'#0d63c7',fillColor:'#16a34a',fillOpacity:.95,weight:2,radius:7};
// O alfinete é um ícone vetorial, ancorado na ponta da agulha (coordenada real).
const pinIcon=(isMonument:boolean)=>L.divIcon({
 className:'surveyor-point-pin',iconSize:[28,42],iconAnchor:[14,39],popupAnchor:[0,-35],
 html:`<svg viewBox="0 0 28 42" width="28" height="42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="14" cy="39" rx="5" ry="2" fill="#102d4b" fill-opacity=".23"/><path d="M12.6 24H15.4L14 39Z" fill="#788899" stroke="#536477" stroke-width=".7"/><path d="M9 10L19 10 18 22 10 22Z" fill="${isMonument?'#f24c5b':'#f3a018'}" stroke="${isMonument?'#aa2b38':'#ba6c03'}" stroke-width="1.1"/><rect x="5.5" y="6.5" width="17" height="6" rx="3" fill="${isMonument?'#fa6573':'#ffbd41'}" stroke="${isMonument?'#ac3546':'#b87907'}" stroke-width="1"/><ellipse cx="14" cy="6.5" rx="8.5" ry="3.2" fill="${isMonument?'#ff8992':'#ffcd63'}"/><path d="M11 12V20" stroke="white" stroke-opacity=".42" stroke-width="2" stroke-linecap="round"/></svg>`
});
const regularPointPin=pinIcon(false), monumentPointPin=pinIcon(true);
function readJson<T>(key:string, fallback:T):T{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback;}catch{return fallback;}}
function round(value:number,digits=6){return value.toFixed(digits);}
function validFeature(value:unknown):value is MapFeature{return !!value&&typeof value==='object'&&'geometry' in value&&!!value.geometry&&typeof value.geometry==='object'&&'type' in value.geometry&&'coordinates' in value.geometry&&Array.isArray(value.geometry.coordinates);}
function validCollection(value:unknown):MapFeature[]{
 if(!value||typeof value!=='object')return [];
 const data=value as {type?:string;features?:unknown[];geometry?:unknown};
 if(data.type==='FeatureCollection'&&Array.isArray(data.features))return data.features.filter(validFeature).slice(0,1200);
 if(data.type==='Feature'&&validFeature(value))return [value];
 return [];
}
function download(name:string,data:unknown){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/geo+json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function feature(type:'Point'|'LineString'|'Polygon',positions:[number,number][]):MapFeature{
 const coords=positions.map(([lat,lon])=>[lon,lat]);
 const geometry:Geometry=type==='Point'?{type,coordinates:coords[0]}:type==='LineString'?{type,coordinates:coords}:{type,coordinates:[coords.concat([coords[0]])]};
 return {type:'Feature',id:crypto.randomUUID(),properties:{source:'surveyor-web',createdAt:new Date().toISOString()},geometry};
}
const button=(label:string,icon:ReactNode,action:()=>void,selected=false,disabled=false,title?:string)=>
 <button type="button" className={`map-tool ${selected?'map-tool-active':''}`} disabled={disabled} aria-label={label} title={title||label} onClick={action}>{icon}<span>{label}</span></button>;
export function OperationalMap(){
 const navigate=useNavigate();const location=useLocation();const [params]=useSearchParams();const notify=useToast();const {session}=useAuth();
 const placeRef=useRef<Municipality|null>(null);
 if(!placeRef.current){
  const fromState=location.state as Municipality|null;
  if(fromState&&Array.isArray(fromState.center)&&fromState.uf)placeRef.current=fromState;
  else try{const saved=JSON.parse(sessionStorage.getItem('surveyor-map-place-v1')||'null') as Municipality|null;if(saved?.uf&&Array.isArray(saved.center))placeRef.current=saved;}catch{/* fallback abaixo */}
  if(!placeRef.current){const q=new URLSearchParams(location.search);const lat=Number(q.get('lat')),lng=Number(q.get('lng'));if(q.has('lat')&&q.has('lng')&&Math.abs(lat)<=90&&Math.abs(lng)<=180&&q.get('uf'))placeRef.current={id:q.get('cityId')||'',uf:q.get('uf')||'',name:q.get('city')||'Localização compartilhada',stateName:'',center:[lat,lng]};}
 }
 const place=placeRef.current;
 const projectId=params.get('project');
 const accountId=String(session?.user?.id||'visitante');
 const draftKeys=mapDraftKeys(accountId,projectId||place?.id||'workspace');
 const storageKey=draftKeys.draft;
 const versionsKey=draftKeys.versions;
 const projectMetaKey=draftKeys.metadata;
 const syncKey=draftKeys.sync;
 const [features,setFeatures]=useState<MapFeature[]>(()=>readJson(storageKey,[]).filter(validFeature));
 const [loadedScope,setLoadedScope]=useState(storageKey);
 const historyChanges=useRef<MapFeature[][]>([]),redoChanges=useRef<MapFeature[][]>([]);
 const previousFeatures=useRef<MapFeature[]>(features),skipHistory=useRef(false);
 const [historyCount,setHistoryCount]=useState({undo:0,redo:0});
 const [officialInfo,setOfficialInfo]=useState<{layer:string;attributes:Record<string,unknown>|null;geometry?:Geometry|null;uf?:string;lat:number;lng:number;loading:boolean;sources:OfficialInfoResult[]}|null>(null);
 const [infoExpanded,setInfoExpanded]=useState(false);
 const officialMetrics=officialInfo?.geometry?measureMapGeometry(officialInfo.geometry):null;
 const officialTarefa=officialMetrics&&officialInfo?.uf?tarefaCaption(officialMetrics.areaM2,officialInfo.uf):'';
 const officialTarefaUnit=officialInfo?.uf?tarefaUnitForState(officialInfo.uf):'';
 const queryFeatureRef=useRef<(point:L.LatLng)=>void>(()=>{});

 const featureRef=useRef<MapFeature[]>(features);
 const readyPointBatches=useMemo(()=>importedPointBatches(features),[features]);
 const [draft,setDraft]=useState<[number,number][]>([]);
 const draftRef=useRef<[number,number][]>([]);
 const [tool,setTool]=useState<Tool>('pan');const toolRef=useRef<Tool>('pan');
 const [mapMode,setMapMode]=useState<Basemap>(()=>sessionStorage.getItem('surveyor-map-visited-session-v1')==='1'?'satellite':'default');
 useEffect(()=>{sessionStorage.setItem('surveyor-map-visited-session-v1','1');},[]);
 const [historyOpen,setHistoryOpen]=useState(false);
 const [status,setStatus]=useState('Pronto para trabalhar');
 const [mapError,setMapError]=useState<string|null>(null);
 const [mapAttempt,setMapAttempt]=useState(0);
 const [mapReady,setMapReady]=useState(false);
 const [coords,setCoords]=useState<[number,number]>(place?.center||[-12.99,-39.6]);
 const [zoom,setZoom]=useState(13);
 const [projectName,setProjectName]=useState('');
 const [panel,setPanel]=useState<Panel|'gleba'>(null);
 const [analysisOpen,setAnalysisOpen]=useState(false);
 const [terrainModal,setTerrainModal]=useState<AdvancedToolKind|null>(null);
 const [contextAt,setContextAt]=useState<{x:number;y:number;id:string;lat:number;lng:number}|null>(null);
 const [renameDraft,setRenameDraft]=useState<{id:string;name:string}|null>(null);
 const [mapContext,setMapContext]=useState<{x:number;y:number;lat:number;lng:number}|null>(null);
 const officialMarkerRef=useRef<L.Marker|null>(null);
 const propertySearchHighlightRef=useRef<L.GeoJSON|null>(null);
 const spatialOverlayRef=useRef<L.LayerGroup|null>(null);
 const clearOfficialProperty=()=>{const map=mapRef.current;const layer=propertySearchHighlightRef.current;if(layer&&map)map.removeLayer(layer);propertySearchHighlightRef.current=null;};
 const highlightOfficialProperty=(result:OfficialPropertyResult)=>{
  const map=mapRef.current;if(!map)return;
  if(propertySearchHighlightRef.current)map.removeLayer(propertySearchHighlightRef.current);
  const layer=L.geoJSON(result.feature,{interactive:false,style:{color:'#dc2626',weight:4,opacity:1,fillColor:'#e63946',fillOpacity:0.12}}).addTo(map);
  propertySearchHighlightRef.current=layer;
  const bounds=layer.getBounds();if(bounds.isValid())map.flyToBounds(bounds.pad(.18),{maxZoom:18,duration:.7});
  setStatus(`Imóvel localizado: ${result.name} (${result.source}).`);
 };

 const officialLayersRef=useRef<ActiveLayer[]>([]);
 const officialQuerySequence=useRef(0);
 const [activeLegacy,setActiveLegacy]=useState<string>('pan');
 const glebaDrawingRef=useRef<'polygon'|'line'|null>(null);
 const glebaParentRef=useRef<string>('');
 const [modal,setModal]=useState<Modal>(null);
 const [projectData,setProjectData]=useState<MapProjectData>(()=>readJson(projectMetaKey,baseProject(place?.name||'',place?.uf||'BA')));
 const [officialLayers,setOfficialLayers]=useState<ActiveLayer[]>([]);
 const [selectedFeature,setSelectedFeature]=useState<string|null>(null);
 const [detailsFeatureId,setDetailsFeatureId]=useState<string|null>(null);
 const [editingFeature,setEditingFeature]=useState<string|null>(null);
 const [layerUF,setLayerUF]=useState(place?.uf||'BA');
 const [baseMenu,setBaseMenu]=useState(false);
 const [exportMenu,setExportMenu]=useState(false);
 const [paletteOpen,setPaletteOpen]=useState(false);
 const [measureLabels,setMeasureLabels]=useState(true);
 const [editMidpointsEnabled,setEditMidpointsEnabled]=useState(()=>{try{return localStorage.getItem('surveyor-edit-midpoints-v2')==='1';}catch{return false;}});
 const [vertexRemovalMode,setVertexRemovalMode]=useState(false);
 const [vertexMenu,setVertexMenu]=useState<{id:string;index:number;x:number;y:number}|null>(null);
 const vertexMenuElement=useRef<HTMLDivElement|null>(null);
 const [snapEnabled,setSnapEnabled]=useState(()=>{try{return localStorage.getItem('surveyor-live-snap-enabled-v1')==='1';}catch{return false;}});
 const snapEnabledRef=useRef(snapEnabled);snapEnabledRef.current=snapEnabled;
 const [legacyDraftAvailable,setLegacyDraftAvailable]=useState(()=>{try{return Boolean(localStorage.getItem(draftKeys.legacyDraft));}catch{return false;}});
 const [pointDialog,setPointDialog]=useState(false);
 const [pointBatchMenu,setPointBatchMenu]=useState(false);
 const [cloudPending,setCloudPending]=useState(false);
 const [remoteReady,setRemoteReady]=useState(!projectId);
 const [cloudSaved,setCloudSaved]=useState(false);
 const localDraftPersistenceAvailable=useRef(true);
 const [saveError,setSaveError]=useState('');
 const remoteRevision=useRef('');
 const loadedProjectRef=useRef<string|null>(null);
 const loadedProjectAccountRef=useRef<string|null>(null);
 const cloudConflictRef=useRef(false);
 const [shapeProfile,setShapeProfile]=useState<import('./shapefileExport').ShapeTarget>('seia-cefir-ba');
 const [shapeDialog,setShapeDialog]=useState(false);
 const appliedRefs=useRef(new Map<string,L.TileLayer.WMS>());
 officialLayersRef.current=officialLayers;
 const endDrawingRef=useRef<()=>void>(()=>{});
 const editMarkersRef=useRef<L.LayerGroup|null>(null);
 const measureRef=useRef<L.LayerGroup|null>(null);
 const miniMapElement=useRef<HTMLDivElement|null>(null);
 const miniMapRef=useRef<L.Map|null>(null);
 const miniMarkerRef=useRef<L.CircleMarker|null>(null);
 const container=useRef<HTMLDivElement|null>(null);
 const mapRef=useRef<L.Map|null>(null);
 const drawingsRef=useRef<L.GeoJSON|null>(null);
 const provisionalRef=useRef<L.LayerGroup|null>(null);
 const previewRef=useRef<{group:L.LayerGroup;line:L.Polyline;area:L.Polygon;circle:L.Circle;point:L.CircleMarker;closeHalo:L.CircleMarker;measureTip:L.Tooltip}|null>(null);
 const lastPointerRef=useRef<L.LatLng|null>(null);
 const refreshPreviewRef=useRef<(pointer:L.LatLng|null)=>void>(()=>{});
 const baseLayers=useRef<Record<Basemap,L.TileLayer>|null>(null);
 const referenceOverlay=useRef<L.TileLayer|null>(null);
 const [versions,setVersions]=useState<Array<{date:string;features:MapFeature[]}>>(()=>readJson(versionsKey,[]));
 const latestMapState=useRef({lat:place?.center?.[0]??-12.99,lng:place?.center?.[1]??-39.6,zoom:13});
 // Troca de conta/workspace nunca pode reaproveitar o estado carregado pelo React.
 useEffect(()=>{
  let cancelled=false;
  setLegacyDraftAvailable(Boolean(localStorage.getItem(draftKeys.legacyDraft)));
  setVersions(readJson(versionsKey,[]));
  if(projectId){setCloudSaved(false);setRemoteReady(false);setLoadedScope(storageKey);return()=>{cancelled=true;};} // projetos existentes são carregados e validados pela API
  setLoadedScope('');
  const own=readJson<MapFeature[]>(storageKey,[]).filter(validFeature);
  skipHistory.current=true;featureRef.current=own;setFeatures(own);
  setProjectData(readJson(projectMetaKey,baseProject(place?.name||'',place?.uf||'BA')));
  historyChanges.current=[];redoChanges.current=[];setHistoryCount({undo:0,redo:0});
  setCloudSaved(false);
  void Promise.all([
   readOfflineDraft<MapFeature[]>(storageKey),
   readOfflineDraft<MapProjectData>(projectMetaKey),
   readOfflineDraft<Array<{date:string;features:MapFeature[]}>>(versionsKey)
  ]).then(([indexedFeatures,indexedProject,indexedVersions])=>{
   if(cancelled)return;
   let hasLocalFeatures=false,hasLocalProject=false;
   try{hasLocalFeatures=localStorage.getItem(storageKey)!==null;hasLocalProject=localStorage.getItem(projectMetaKey)!==null;}catch{/* IndexedDB permanece como recuperação */}
   const recovered=hasLocalFeatures?own:(Array.isArray(indexedFeatures)?indexedFeatures.filter(validFeature):own);
   const recoveredProject=hasLocalProject?readJson(projectMetaKey,baseProject(place?.name||'',place?.uf||'BA')):indexedProject||baseProject(place?.name||'',place?.uf||'BA');
   if(!hasLocalFeatures){skipHistory.current=true;featureRef.current=recovered;setFeatures(recovered);}
   if(!hasLocalProject)setProjectData(recoveredProject);
   if(!readJson(versionsKey,null)&&Array.isArray(indexedVersions))setVersions(indexedVersions);
   setLoadedScope(storageKey);
  }).catch(()=>{if(!cancelled)setLoadedScope(storageKey);});
  return()=>{cancelled=true;};
 },[storageKey,versionsKey,projectMetaKey,projectId]);
  const recoverLegacyDraft=async()=>{
  const legacy=readJson<MapFeature[]>(draftKeys.legacyDraft,[]).filter(validFeature);
  if(!legacy.length){notify('Não há geometrias recuperáveis nesse rascunho.');setLegacyDraftAvailable(false);return;}
   if(featureRef.current.length&&!await requestConfirmation({title:'Substituir rascunho local?',message:'Já há feições abertas. Exporte o GeoJSON atual antes de continuar.',confirmLabel:'Substituir rascunho',destructive:true}))return;
   if(!await requestConfirmation({title:'Recuperar rascunho antigo?',message:'Este rascunho foi salvo antes de separar os dados por conta. Ele pode pertencer a outro usuário deste navegador. Confirma que é seu e deseja importá-lo para esta conta?',confirmLabel:'Recuperar rascunho',destructive:true}))return;
  try{
   localStorage.setItem(storageKey,JSON.stringify(legacy));
   const oldMeta=readJson<MapProjectData|null>(draftKeys.legacyMetadata,null);
   if(oldMeta){localStorage.setItem(projectMetaKey,JSON.stringify(oldMeta));setProjectData(oldMeta);}
   featureRef.current=legacy;skipHistory.current=true;setFeatures(legacy);setCloudSaved(false);
   cloudConflictRef.current=!!projectId; // A importação legada exige confirmação explícita antes de sobrescrever nuvem.
   setLegacyDraftAvailable(false);setStatus('Rascunho antigo importado para esta conta. Revise e salve na nuvem.');
   notify('Rascunho antigo recuperado nesta conta. A nuvem ainda não confirmou esses dados.');
  }catch{notify('Não foi possível recuperar. Exporte um backup antes de continuar.');}
 };

 const snapAt=useRef<(point:L.LatLng)=>ReturnType<typeof findMapSnap>>(()=>null);
 snapAt.current=(point)=>{
  const map=mapRef.current;if(!map||!snapEnabledRef.current)return null;
  return findMapSnap(featureRef.current.filter(f=>f.properties?.hidden!==true).map(f=>({geometry:f.geometry})),[point.lat,point.lng],([lat,lng])=>{
   const p=map.latLngToContainerPoint([lat,lng]);return [p.x,p.y];
  });
 };
  const changeTool=useCallback(async(next:Tool,discardDraft=false):Promise<boolean>=>{
   const pendingVertices=draftRef.current.length;
   if(pendingVertices&&!discardDraft&&!await requestConfirmation({title:'Descartar desenho em andamento?',message:`O desenho em andamento com ${pendingVertices} ${pendingVertices===1?'vértice':'vértices'} será descartado ao trocar de ferramenta.`,confirmLabel:'Descartar desenho',destructive:true}))return false;
  setVertexRemovalMode(false);setVertexMenu(null);
  if(glebaDrawingRef.current&&next!==glebaDrawingRef.current)glebaDrawingRef.current=null;
  toolRef.current=next;setTool(next);setActiveLegacy(next==='point'?'point':next);draftRef.current=[];setDraft([]);setMapContext(null);
  lastPointerRef.current=null;
  previewRef.current?.group.clearLayers();
   setStatus(pendingVertices?'Desenho em andamento cancelado.':next==='pan'?'Navegue pelo mapa livremente.':next==='point'?'Clique no mapa para marcar pontos.':`Mova o mouse para pré-visualizar. Clique para fixar vértices.`);
   return true;
 },[]);
 const showVertexAppearance=(id:string,index:number,event:L.LeafletMouseEvent)=>{
  L.DomEvent.stop(event.originalEvent);
  const rect=container.current?.getBoundingClientRect();if(!rect)return;
  setMapContext(null);setContextAt(null);setEditingFeature(id);
  setVertexMenu({id,index,x:Math.max(8,Math.min(event.containerPoint.x,rect.width-250)),y:Math.max(65,Math.min(event.containerPoint.y,rect.height-290))});
 };
 // Atualização direta no Leaflet: a prévia acompanha cada movimento do cursor,
 // sem aguardar setState/um novo clique e sem redesenhar o mapa inteiro em React.
 refreshPreviewRef.current=(pointer:L.LatLng|null)=>{
  const map=mapRef.current,preview=previewRef.current;
  if(!map||!preview)return;
  const {group,line,area,circle,point,closeHalo,measureTip}=preview;
  const show=(layer:L.Layer,visible:boolean)=>{
   if(visible&&!group.hasLayer(layer))group.addLayer(layer);
   else if(!visible&&group.hasLayer(layer))group.removeLayer(layer);
  };
  if(!pointer||toolRef.current==='pan'){group.clearLayers();return;}
  const mode=toolRef.current;
  const anchored=draftRef.current;
  const canSnap=mode==='polygon'&&anchored.length>=3;
  const origin=canSnap?L.latLng(anchored[0]):null;
  const nearOrigin=!!(origin&&map.latLngToContainerPoint(origin).distanceTo(map.latLngToContainerPoint(pointer))<=14);
  const snap=nearOrigin?null:snapAt.current(pointer);
  const tail=nearOrigin&&origin?origin:snap?L.latLng(snap.position[0],snap.position[1]):pointer;
  show(closeHalo,nearOrigin||!!snap);
  if(nearOrigin&&origin){closeHalo.setLatLng(origin);closeHalo.bringToFront();}
  else if(snap){closeHalo.setLatLng(tail);closeHalo.bringToFront();}
  show(point,mode==='point');
  if(mode==='point')point.setLatLng(pointer);
  if(mode==='measure'&&anchored.length){
   const path=[...anchored,[pointer.lat,pointer.lng] as [number,number]];
   const meters=path.slice(1).reduce((v,pt,i)=>v+haversine(path[i],pt),0);
   measureTip.setLatLng(pointer).setContent(`${meters.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})} m`);
   show(measureTip,true);
  }else show(measureTip,false);
  if(mode==='circle'&&anchored.length){
   const a=L.latLng(anchored[0]);
   circle.setLatLng(a);circle.setRadius(Math.max(0.01,a.distanceTo(pointer)));
   show(circle,true);
  }else show(circle,false);
  if(mode==='rectangle'&&anchored.length){
   const a=anchored[0];
   area.setLatLngs([[a[0],a[1]],[a[0],tail.lng],[tail.lat,tail.lng],[tail.lat,a[1]]]);
   show(area,true);show(line,false);
  }else if(mode==='polygon'&&anchored.length>=2){
   const pts=[...anchored, [tail.lat,tail.lng] as [number,number]];
   area.setLatLngs(pts);
   line.setLatLngs(pts);
   show(area,true);show(line,true);
  }else{
   show(area,false);
   const wantsLine=['polygon','line','arc','measure'].includes(mode)&&anchored.length>=1;
   if(wantsLine)line.setLatLngs([...anchored,[tail.lat,tail.lng] as [number,number]]);
   show(line,wantsLine);
  }
 };

 const addFeature=useCallback((value:MapFeature)=>{setFeatures(current=>{const polygonCount=current.filter(f=>f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon').length;const styled=(value.geometry.type==='Polygon'||value.geometry.type==='MultiPolygon')?{...value,properties:{...value.properties,fillColor:value.properties?.fillColor||lotColors[polygonCount%lotColors.length],strokeColor:value.properties?.strokeColor||lotColors[polygonCount%lotColors.length],fillOpacity:value.properties?.fillOpacity??.26}}:value;const result=[...current,styled];featureRef.current=result;return result;});},[]);
 const endDrawing=useCallback(()=>{
  const points=draftRef.current;const kind=toolRef.current;
  if(!['line','polygon','rectangle','circle','arc','measure'].includes(kind))return;
  const minimum=kind==='polygon'||kind==='arc'?3:2;
  if(points.length<minimum){notify(`Marque ao menos ${minimum} vértices.`);return;}
  // Fechamento por duplo clique pode disparar clique duplicado: eliminar apenas
  // pontos consecutivos na mesma posição (não confundir com snap geográfico).
  const sanitized=points.filter((p,i)=>i===0||Math.abs(p[0]-points[i-1][0])>1e-8||Math.abs(p[1]-points[i-1][1])>1e-8);
  if(sanitized.length<minimum){notify(`Marque ao menos ${minimum} posições distintas.`);return;}
  let corners=sanitized;
  if(kind==='rectangle'){const a=sanitized[0],b=sanitized[1];corners=[[a[0],a[1]],[a[0],b[1]],[b[0],b[1]],[b[0],a[1]]];}
  if(kind==='circle'){
   const a=sanitized[0],b=sanitized[1],rx=(b[1]-a[1])*Math.cos(a[0]*Math.PI/180),ry=(b[0]-a[0]);const r=Math.hypot(rx,ry);
   corners=Array.from({length:72},(_,i)=>{const t=2*Math.PI*i/72;return [a[0]+r*Math.sin(t),a[1]+r*Math.cos(t)/Math.max(.05,Math.cos(a[0]*Math.PI/180))] as [number,number];});
  }
  if(kind==='measure'){
   const meters=corners.slice(1).reduce((sum,p,i)=>sum+haversine(corners[i],p),0);
   notify(`Medição aproximada: ${meters.toLocaleString('pt-BR',{maximumFractionDigits:2})} m`);
  }
  if(kind==='arc'){
   // Construir arco circular passando por três pontos no plano tangente local.
   // É uma aproximação visual, sem substituir cálculo geodésico certificado.
   const [p0,p1,p2]=sanitized.slice(0,3);
   const lat0=(p0[0]+p1[0]+p2[0])/3;
   const ratio=Math.max(.1,Math.cos(lat0*Math.PI/180));
   const xy=([lat,lng]:[number,number])=>[lng*ratio,lat];
   const [a,b,c]=[p0,p1,p2].map(xy);
   const det=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));
   if(Math.abs(det)<1e-12){
    corners=[p0,p1,p2];
   }else{
    const sq=(q:number[])=>q[0]*q[0]+q[1]*q[1];
    const ox=(sq(a)*(b[1]-c[1])+sq(b)*(c[1]-a[1])+sq(c)*(a[1]-b[1]))/det;
    const oy=(sq(a)*(c[0]-b[0])+sq(b)*(a[0]-c[0])+sq(c)*(b[0]-a[0]))/det;
    const radius=Math.hypot(a[0]-ox,a[1]-oy);
    const angles=[a,b,c].map(q=>Math.atan2(q[1]-oy,q[0]-ox));
    const norm=(x:number)=>(x%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
    const ccw=norm(angles[2]-angles[0]);
    const via=norm(angles[1]-angles[0]);
    const delta=via<=ccw?ccw:ccw-2*Math.PI;
    const count=Math.min(128,Math.max(16,Math.ceil(Math.abs(delta)*24)));
    corners=Array.from({length:count+1},(_,i)=>{
     const angle=angles[0]+delta*i/count;
     return [oy+radius*Math.sin(angle),(ox+radius*Math.cos(angle))/ratio] as [number,number];
    });
   }
  }
  const created=feature(['line','arc','measure'].includes(kind)?'LineString':'Polygon',corners);
  const isManualGleba=glebaDrawingRef.current===kind&&kind==='polygon';
  const manualParentId=isManualGleba?glebaParentRef.current:'';
  if(glebaDrawingRef.current===kind){created.properties={...created.properties,category:kind==='polygon'?'Gleba':'Linha guia (gleba)',name:kind==='polygon'?'Gleba manual':'Linha guia (gleba)',parentFeatureId:kind==='polygon'?glebaParentRef.current:undefined,lotColor:lotColors[featureRef.current.filter(f=>f.properties?.category==='Gleba').length%lotColors.length]};glebaDrawingRef.current=null;}
  if(kind==='measure')created.properties={...created.properties,name:'Medição',distanceM:corners.slice(1).reduce((sum,p,i)=>sum+haversine(corners[i],p),0)};
  if(kind==='arc')created.properties={...created.properties,name:'Arco circular (aproximação cartográfica)'};
  let completed=created;
  let remainder:MapFeature|null=null;
  if(isManualGleba){
   const parent=featureRef.current.find(item=>String(item.id)===manualParentId);
   if(!parent){notify('O polígono de origem não está mais disponível. A gleba manual não foi aplicada.');draftRef.current=[];setDraft([]);void changeTool('pan');return;}
   try{const extracted=extractManualGleba(parent,created);remainder=extracted.remainder;completed=extracted.gleba;}
   catch(error){notify(error instanceof Error?error.message:'Não foi possível recortar a gleba manual.');draftRef.current=[];setDraft([]);void changeTool('pan');return;}
  }
  if(remainder){
   const next=[...featureRef.current.map(item=>String(item.id)===manualParentId?remainder!:item),completed];
   featureRef.current=next;setFeatures(next);
   notify('A gleba manual foi recortada do imóvel original; a área remanescente e a nova gleba estão separadas.');
   setStatus('Recorte aplicado automaticamente. Confira as áreas e salve o projeto.');
  }else{
   addFeature(completed);
   setStatus(kind==='measure'?`Medição total: ${corners.slice(1).reduce((sum,p,i)=>sum+haversine(corners[i],p),0).toLocaleString('pt-BR',{maximumFractionDigits:2})} m`:'Desenho concluído. Clique sobre a geometria para detalhes.');
  }
  setSelectedFeature(String(completed.id));
  if(completed.geometry.type==='Polygon'||completed.geometry.type==='MultiPolygon'){setDetailsFeatureId(String(completed.id));setInfoExpanded(false);}
  draftRef.current=[];setDraft([]);void changeTool('pan');
 },[addFeature,notify,changeTool]);
 endDrawingRef.current=endDrawing;
 useEffect(()=>{
  if(previousFeatures.current===features)return;
  if(!skipHistory.current){historyChanges.current.push(previousFeatures.current);if(historyChanges.current.length>60)historyChanges.current.shift();redoChanges.current=[];}
  else skipHistory.current=false;
  previousFeatures.current=features;
  featureRef.current=features;
  setHistoryCount({undo:historyChanges.current.length,redo:redoChanges.current.length});
 },[features]);
 // O município do imóvel é obtido pelo interior de seu perímetro, não pelo
 // município que serviu de atalho no navegador territorial.
 const municipalityGeometryKey=features.filter(f=>f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon').map(f=>JSON.stringify(f.geometry)).join('|');
 const municipalityLookupRef=useRef('');
 const [municipalityState,setMunicipalityState]=useState<'idle'|'checking'|'confirmed'|'manual'>('idle');
 useEffect(()=>{
  const point=locationForDrawnPolygon(features);
  if(!point){setMunicipalityState('idle');return;}
  const key=`${projectId||'new'}:${point.lat.toFixed(6)}:${point.lon.toFixed(6)}`;
  if(municipalityLookupRef.current===key)return;
  municipalityLookupRef.current=key;
  const controller=new AbortController();setMunicipalityState('checking');
  // Evitar exibir a cidade de entrada como se fosse a cidade do imóvel.
  setProjectData(prev=>prev.city===place?.name?{...prev,city:''}:prev);
  const timer=window.setTimeout(()=>{void municipalityAtLocation(point,controller.signal).then(found=>{
   if(!controller.signal.aborted){setProjectData(prev=>({...prev,city:found.city,uf:found.uf}));setMunicipalityState('confirmed');}
  }).catch(()=>{if(!controller.signal.aborted)setMunicipalityState('manual');});},500);
  return()=>{window.clearTimeout(timer);controller.abort();};
 // Só as coordenadas e o projeto disparam nova consulta. Zoom e pan não interferem.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[municipalityGeometryKey,projectId]);
 const undo=()=>{
  if(draftRef.current.length){const next=draftRef.current.slice(0,-1);draftRef.current=next;setDraft(next);return;}
  const prev=historyChanges.current.pop();if(!prev)return;
  redoChanges.current.push(featureRef.current);
  skipHistory.current=true;featureRef.current=prev;setFeatures(prev);
  setHistoryCount({undo:historyChanges.current.length,redo:redoChanges.current.length});
  setSelectedFeature(null);setEditingFeature(null);
 };
 const redo=()=>{
  const next=redoChanges.current.pop();if(!next)return;
  historyChanges.current.push(featureRef.current);skipHistory.current=true;
  featureRef.current=next;setFeatures(next);
  setHistoryCount({undo:historyChanges.current.length,redo:redoChanges.current.length});
 };

 const save=async(quiet=false):Promise<boolean>=>{
  const snapshot=structuredClone(featureRef.current);
  const next=[{date:new Date().toISOString(),features:snapshot},...versions].slice(0,10);
  const [indexedDraft]=await Promise.all([writeOfflineDraft(storageKey,snapshot),writeOfflineDraft(versionsKey,next)]);
  let browserCopy=false;
  try{localStorage.setItem(storageKey,JSON.stringify(snapshot));localStorage.setItem(versionsKey,JSON.stringify(next));browserCopy=true;}catch{/* IndexedDB continua como fonte de recuperação */}
  setVersions(next);
  if(!indexedDraft&&!browserCopy){notify('Não foi possível salvar o rascunho localmente. Exporte o GeoJSON para preservar o desenho.');return false;}
  setStatus('Rascunho salvo neste dispositivo.');if(!quiet)notify('Rascunho salvo neste dispositivo.');
  return true;
 };
  const makePolygonFromPoints=async(batchId:string)=>{
  const batch=importedPointBatches(featureRef.current).find(group=>group.id===batchId);
  setPointBatchMenu(false);
  if(!batch){notify('É necessário ter quatro ou mais pontos importados ainda não convertidos.');return;}
  try{
   const {ring, skippedDuplicates, uniqueVertices}=buildPolygonFromBatch(batch);
     if(!await changeTool('pan'))return;
   const polygonId=crypto.randomUUID();
   const name=projectData.name.trim()||`Perímetro de ${batch.label}`;
   const created:MapFeature={type:'Feature',id:polygonId,geometry:{type:'Polygon',coordinates:[ring]},properties:{source:'surveyor-web',name,category:'Perímetro',createdAt:new Date().toISOString(),strokeColor:'#efaf0e',fillColor:'#f2c313',fillOpacity:.20,lineWeight:3,generatedFromPoints:true,sourcePointIds:batch.points.map(p=>String(p.id)),sourcePointOrder:'ordem do arquivo',duplicateCoordinatesIgnored:skippedDuplicates}};
   const selectedIds=new Set(batch.points.map(p=>String(p.id)));
   setFeatures(previous=>{const next=[created,...previous.map(p=>selectedIds.has(String(p.id))?{...p,properties:{...p.properties,pointPolygonId:polygonId}}:p)];featureRef.current=next;return next;});
    setSelectedFeature(polygonId);setEditingFeature(null);setPointDialog(false);setPanel('layers');
   const bounds=L.geoJSON(created).getBounds();if(bounds.isValid())mapRef.current?.fitBounds(bounds,{padding:[75,75],maxZoom:18});
   const duplicateMessage=skippedDuplicates>0?` ${skippedDuplicates} ${skippedDuplicates===1?'coordenada repetida foi ignorada':'coordenadas repetidas foram ignoradas'} no contorno, sem excluir os registros originais.`:'';
   notify(`Polígono gerado com ${uniqueVertices} vértices.${duplicateMessage} Alfinetes ocultados; pontos originais preservados.`);
   setStatus(`Polígono criado com ${uniqueVertices} coordenadas únicas na ordem do arquivo.${duplicateMessage} Salve o projeto para conservá-lo.`);
  }catch(error){notify(error instanceof Error?error.message:'Não foi possível gerar o polígono.');}
 };
 const importPoints=async(file:File,classification:'P'|'P+MARCO'='P')=>{
  try{
   const list=await importPointFile(file);
   const batchId=crypto.randomUUID();
   const next=list.map(item=>{const pt=feature('Point',[[item.lat,item.lon]]);pt.properties={...pt.properties,name:item.name,source:'importação de coordenadas',pointOrigin:'importado',pointBatchId:batchId,pointBatchName:file.name,pointClass:classification,hasMonument:classification==='P+MARCO'};return pt;});
     if(!await changeTool('pan'))return;
   setFeatures(prev=>{const joined=[...prev,...next];featureRef.current=joined;return joined;});
   if(next.length){const b=L.latLngBounds(list.map(x=>[x.lat,x.lon] as [number,number]));if(b.isValid())mapRef.current?.fitBounds(b,{padding:[45,45],maxZoom:17});}
   notify(`${next.length} pontos importados.${next.length>=4?' Clique em Gerar polígono para unir os pontos na ordem do arquivo.':''} Salve o projeto para conservar os dados.`);
   }catch(e){throw new Error(e instanceof Error?e.message:'Erro ao importar os pontos.');}
 };
 const importFileFromDialog=async(file:File)=>{
   if(file.size>12*1024*1024)throw new Error('O arquivo deve ter até 12 MB.');
  try{const ext=file.name.toLowerCase();let incoming:MapFeature[]=[];
   if(ext.endsWith('.zip')){
    const {default:shp}=await import('shpjs');
    const parsed=await shp(await file.arrayBuffer());
    incoming=(Array.isArray(parsed)?parsed.flatMap(validCollection):validCollection(parsed));
   }else if(ext.endsWith('.xlsx')||ext.endsWith('.txt')||ext.endsWith('.csv')){
    const points=await importPointFile(file);
    incoming=points.map(p=>({type:'Feature' as const,id:crypto.randomUUID(),geometry:{type:'Point' as const,coordinates:[p.lon,p.lat]},properties:{name:p.name,source:'planilha de coordenadas WGS84'}}));
   }else{
    const text=await file.text();incoming=ext.endsWith('.kml')?kmlFeatures(text):validCollection(JSON.parse(text));
   }
   const batchId=crypto.randomUUID();
   const previousPolygons=featureRef.current.filter(f=>f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon').length;
   let polygonIndex=0;
   const imported=incoming.map(f=>({
    ...f,id:f.id||crypto.randomUUID(),
    ...(['Polygon','MultiPolygon'].includes(f.geometry.type)?{properties:{...f.properties,fillColor:f.properties?.fillColor||lotColors[(previousPolygons+polygonIndex++)%lotColors.length],strokeColor:f.properties?.strokeColor||'#27354b',fillOpacity:f.properties?.fillOpacity??.26}}:{}),
    ...(f.geometry.type==='Point'?{properties:{...f.properties,pointOrigin:'importado',pointBatchId:batchId,pointBatchName:file.name,pointClass:f.properties?.pointClass||'P',hasMonument:Boolean(f.properties?.hasMonument)}}:{})
   }));
    if(!imported.length)throw new Error('O arquivo não contém feições GeoJSON válidas.');
    if(!await requestConfirmation({title:'Confirmar importação?',message:`Prévia da importação: ${imported.length} feição(ões) de ${file.name}.\nTipos: ${[...new Set(imported.map(f=>f.geometry.type))].join(', ')}.\n\nCoordenadas devem estar em WGS84 (longitude/latitude em graus decimais).\n\nAdicionar ao projeto?`,confirmLabel:'Adicionar ao projeto'}))return;
   setFeatures(current=>{const next=[...current,...imported];featureRef.current=next;return next;});
   const bounds=L.geoJSON({type:'FeatureCollection',features:imported} as FeatureCollection).getBounds();if(bounds.isValid())mapRef.current?.fitBounds(bounds,{padding:[70,70],maxZoom:17});
   notify(`${imported.length} feições importadas. Confira o CRS e as coordenadas antes de usar tecnicamente.`);
   setModal(null);
   }catch(error){throw new Error(error instanceof Error?error.message:'Formato inválido. Revise GeoJSON, KML, CSV, TXT ou XLSX com latitude/longitude WGS84.');}
 };
 const ensureCompletedDrawing=(action:string)=>{
  const pendingVertices=draftRef.current.length;
  if(!pendingVertices)return true;
  notify(`Finalize ou cancele o desenho em andamento (${pendingVertices} ${pendingVertices===1?'vértice':'vértices'}) antes de ${action}.`);
  return false;
 };
 const exportFile=()=>{
  if(!ensureCompletedDrawing('exportar'))return false;
  const data:FeatureCollection={type:'FeatureCollection',features:featureRef.current};
  download(`surveyor-${place?.uf?.toLowerCase()||'mapa'}-${new Date().toISOString().slice(0,10)}.geojson`,data);
  notify('GeoJSON gerado para download.');
  return true;
 };
 const validate=()=>{if(!ensureCompletedDrawing('validar o projeto'))return;setModal('verify');};
 const saveProject=async()=>{
  setSaveError('');
  if(draftRef.current.length){setSaveError(`Finalize ou cancele o desenho em andamento (${draftRef.current.length} ${draftRef.current.length===1?'vértice':'vértices'}) antes de salvar o projeto.`);return;}
  if(!projectData.name.trim()){setSaveError('Informe o nome do projeto.');return;}
  if(!await save(true)){setSaveError('Não foi possível preservar o rascunho local. Exporte o GeoJSON.');return;}
  // Só o polígono desenhado define o município. O local escolhido no mapa do Brasil
  // é apenas o ponto de entrada, não a localização cadastral do imóvel.
  let verifiedProject=projectData;
  const locationOfPolygon=locationForDrawnPolygon(featureRef.current);
  if(locationOfPolygon){
   try{
    const found=await municipalityAtLocation(locationOfPolygon);
    verifiedProject={...projectData,city:found.city,uf:found.uf};
    setProjectData(verifiedProject);
   }catch{
     if(!await requestConfirmation({title:'Conferir município?',message:'Não foi possível confirmar automaticamente o município do perímetro. Confira Município/UF neste formulário. Deseja continuar com os dados informados manualmente?',confirmLabel:'Continuar com os dados informados'})){
     setSaveError('Confirme o município do imóvel antes de salvar. A cidade de entrada no mapa não identifica necessariamente o perímetro.');return;
    }
   }
  } else if(featureRef.current.filter(f=>f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon').length>1&&verifiedProject.city.trim()&&verifiedProject.uf.trim()){
   // Se o município foi informado, confirmar que ele vale para todas as glebas.
   // Sem município, salvar como não informado em vez de bloquear o projeto.
    if(!await requestConfirmation({title:'Confirmar município das áreas?',message:`Este projeto contém várias áreas. Confirma que todas pertencem a ${verifiedProject.city} / ${verifiedProject.uf}?`,confirmLabel:'Confirmar'}))return;
  }
  // Salva o formulário e a geometria local antes de qualquer pedido de rede.
  const indexedMetadata=await writeOfflineDraft(projectMetaKey,verifiedProject);
  let browserMetadata=false;
  try{localStorage.setItem(projectMetaKey,JSON.stringify(verifiedProject));browserMetadata=true;}
  catch{/* pode seguir se IndexedDB confirmou a cópia */}
  if(!indexedMetadata&&!browserMetadata){setSaveError('Não foi possível preservar os dados locais. Exporte o GeoJSON antes de prosseguir.');return;}
  setCloudSaved(false);
  if(projectId&&(loadedProjectRef.current!==projectId||loadedProjectAccountRef.current!==accountId)){
   setSaveError('Rascunho preservado neste navegador. Não foi possível carregar a revisão do projeto da nuvem; verifique a API antes de tentar sincronizar.');return;
  }
  if(cloudConflictRef.current){
    if(!await requestConfirmation({title:'Substituir versão da nuvem?',message:'Há um rascunho local modificado e uma versão mais recente na nuvem. Salvar agora substituirá a versão mais nova. Exporte primeiro o GeoJSON como backup.',confirmLabel:'Substituir a versão da nuvem',destructive:true}))return;
  }
  if(!session?.accessToken){setSaveError('Rascunho preservado neste navegador. Faça login para salvar na nuvem.');return;}
  setCloudPending(true);
  // Estado imutável do instante do clique. Editar o mapa durante a rede não
  // muda o que foi enviado nem a geometria usada para validar a resposta.
  const snapshotFeatures=structuredClone(featureRef.current);
  const snapshotFingerprint=mapFingerprint(snapshotFeatures);
  try{
   const center=mapRef.current?.getCenter();
   const ownerEntries=projectOwners({ownerName:verifiedProject.owner,metadata:{ownerCpf:verifiedProject.cpf,ownerRg:verifiedProject.rg,additionalOwners:verifiedProject.additionalOwners||[],owner2:verifiedProject.owner2}});
   const secondaryOwners=ownerEntries.slice(1);
   const payload={name:verifiedProject.name.trim(),propertyName:verifiedProject.name.trim(),ownerName:verifiedProject.owner||null,municipality:verifiedProject.city||null,stateCode:verifiedProject.uf,status:'active',description:verifiedProject.description||'',centerLatitude:center?.lat??latestMapState.current.lat,centerLongitude:center?.lng??latestMapState.current.lng,defaultZoom:mapRef.current?.getZoom()||latestMapState.current.zoom,
    ...(projectId?{expectedUpdatedAt:remoteRevision.current}:{}),metadata:{source:'surveyor-web',ownerCpf:verifiedProject.cpf,ownerRg:verifiedProject.rg,additionalOwners:secondaryOwners,owner2:secondaryOwners[0]?.name||'',savedAt:new Date().toISOString()}};
   if(projectId&&!remoteRevision.current)throw new Error('Projeto sem revisão remota. Reabra o projeto antes de sobrescrever.');
   const all=snapshotFeatures.map((f,i)=>{
    const geometryMetrics=measureMapGeometry(f.geometry);
    const props=f.properties||{};
    return {name:String(props.name||`Elemento ${i+1}`),category:String(props.category||'outros'),geometryType:f.geometry.type,geoJson:f.geometry,
     areaHectares:geometryMetrics.parts?geometryMetrics.areaM2/10000:null,perimeterMeters:geometryMetrics.parts?geometryMetrics.perimeterMeters:null,vertexCount:geometryMetrics.parts?geometryMetrics.vertexCount:f.geometry.type==='Point'?1:f.geometry.type==='LineString'?f.geometry.coordinates.length:0,
     style:{strokeColor:props.strokeColor,fillColor:props.fillColor,lineWeight:props.lineWeight,fillOpacity:props.fillOpacity},properties:serializeMapFeature(f),sortOrder:i,isVisible:!props.hidden};
   });
   const saved=await saveProjectBundle(session,projectId,payload,all);
   const id=saved.project?.id;if(!id)throw new Error('A nuvem não confirmou a criação do projeto.');
   // A Function de gravação e a de leitura são serviços distintos.
   // Permitir replicação eventual curta evita declarar erro quando acabou de gravar.
   let confirmation=await getProject(session,id).catch(()=>({project:null,features:[]} as Awaited<ReturnType<typeof getProject>>));
   for(let attempt=0;attempt<3&&(confirmation.features.length!==all.length||!confirmation.project);attempt++){
    await new Promise(resolve=>setTimeout(resolve,450*(attempt+1)));
    confirmation=await getProject(session,id).catch(()=>({project:null,features:[]} as Awaited<ReturnType<typeof getProject>>));
   }
   if(!confirmation.project||confirmation.features.length!==all.length||String(confirmation.project.propertyName||confirmation.project.name||'')!==verifiedProject.name.trim())throw new Error('Não foi possível confirmar o conteúdo gravado na nuvem.');
   const confirmedOwners=projectOwners(confirmation.project);
   if(secondaryOwners.some(owner=>!confirmedOwners.some(savedOwner=>savedOwner.name===owner.name))){
    throw new Error('A API não devolveu todos os proprietários. Os dados locais foram preservados; confira o backend antes de continuar.');
   }
   const featureIdsVerified=hasVerifiedMapEdits(confirmation.features,snapshotFeatures);
   remoteRevision.current=String(confirmation.project.revision||confirmation.project.updatedAt||saved.project?.revision||saved.project?.updatedAt||'');
   // O projeto é salvo primeiro. O cadastro reutilizável alimenta Memorial, Croqui e Prancha.
   // Falhas de sincronização não desconfirmam um bundle já gravado na API.
   try{for(const item of snapshotFeatures){if(item.geometry.type!=='Polygon')continue;const ring=item.geometry.coordinates[0];const count=ring.length>2?ring.length-1:0;const props=record(item.properties);if(count&&!props.confrontants&&!props.confrontantDetails)continue;const cloudFeature=confirmation.features.find(f=>String(f.properties?.surveyorFeatureId||f.id)===String(item.id));await saveSharedConfrontants(session,id,String(cloudFeature?.id||item.id),fromProject(props,count));}}catch{notify('Projeto salvo. A cópia compartilhada dos confrontantes precisa de nova tentativa.');}
   // Atualizar o rascunho para a chave do projeto remoto, inclusive em uma nova criação.
    const confirmedDraftKeys=mapDraftKeys(accountId,id);
    const confirmedLocal=await writeMapDraftSnapshot(localStorage,confirmedDraftKeys.draft,confirmedDraftKeys.metadata,featureRef.current,verifiedProject);
    if(!confirmedLocal)notify('Projeto salvo na nuvem, mas a cópia local de recuperação não foi confirmada.');
   loadedProjectRef.current=id;loadedProjectAccountRef.current=accountId;
   cloudConflictRef.current=false;
   if(featureIdsVerified){
    localStorage.setItem(mapDraftKeys(accountId,id).sync,JSON.stringify({fingerprint:snapshotFingerprint,revision:remoteRevision.current}));
   }else{
    localStorage.removeItem(mapDraftKeys(accountId,id).sync);
    notify('ATENÇÃO: a API não confirmou fielmente os campos técnicos das feições. O rascunho foi preservado; confira o servidor e exporte também um GeoJSON.');
   }
   const newerEdits=mapFingerprint(featureRef.current)!==snapshotFingerprint;
   if(newerEdits){
    // Uma edição realizada enquanto a requisição está pendente continua em rascunho.
    localStorage.removeItem(mapDraftKeys(accountId,id).sync);
   }
   setProjectName(verifiedProject.name);setCloudSaved(featureIdsVerified&&!newerEdits);
   setStatus(newerEdits?'A versão anterior foi gravada, mas você fez novas edições enquanto salvava. Salve novamente.':featureIdsVerified?'Projeto e conteúdo técnico confirmados na nuvem.':'A nuvem recebeu o projeto, mas ainda não confirmou todos os dados técnicos.');
   setSaveError(newerEdits?'Há novas alterações locais que não foram incluídas neste salvamento. Salve novamente.':featureIdsVerified?'':'A API não confirmou todos os dados das geometrias; preserve o GeoJSON e revise antes de substituir outra versão.');
   if(featureIdsVerified&&!newerEdits)notify('Projeto salvo e confirmado na nuvem.');
   setPanel(featureIdsVerified&&!newerEdits?null:'project');
   if(!projectId)navigate(`${location.pathname}?project=${encodeURIComponent(id)}`,{replace:true,state:place});
  }catch(err){
   const detail=err instanceof Error?err.message:'A nuvem não confirmou o salvamento.';
   const message=`Não foi possível confirmar o salvamento na nuvem: ${detail} O rascunho permanece neste navegador. Verifique a API e tente novamente.`;
   setSaveError(message);setStatus('Rascunho local preservado; nuvem não confirmada.');notify('A nuvem não confirmou o salvamento. Veja os detalhes no painel Projeto.');
   setPanel('project');
  }
  finally{setCloudPending(false);}
 };
 const saveConfrontants=(updated:Record<string,string>,id:string|null=selectedFeature)=>{
  if(!id)return;
  setFeatures(current=>{const next=current.map(f=>String(f.id)===id?{...f,properties:{...f.properties,confrontants:{...record(f.properties?.confrontants),...updated}}}:f);featureRef.current=next;return next;});
 };
 const saveConfrontantDetails=(updated:Record<string,import('../memorial/croquiRenderer').NeighborDetails>,id:string)=>{
  setFeatures(current=>{const next=current.map(f=>String(f.id)===id?{...f,properties:{...f.properties,confrontantDetails:{...record(f.properties?.confrontantDetails),...updated}}}:f);featureRef.current=next;return next;});
 };
 const removeMapFeature=(id:string)=>{setFeatures(current=>{const next=current.filter(f=>String(f.id)!==id);featureRef.current=next;return next;});setSelectedFeature(null);setDetailsFeatureId(current=>current===id?null:current);setEditingFeature(null);};
 const createGlebas=(lots:MapFeature[],parentId:string,replaceParent=false)=>{
  setFeatures(current=>{const base=current.filter(f=>!(f.properties?.category==='Gleba'&&f.properties?.parentFeatureId===parentId)).map(f=>String(f.id)===parentId?{...f,properties:{...f.properties,hidden:replaceParent?true:Boolean(f.properties?.hidden)}}:f);const next=[...base,...lots.map((lot,index)=>{const color=String(lot.properties?.fillColor||lot.properties?.lotColor||lotColors[index%lotColors.length]);return {...lot,properties:{...lot.properties,lotColor:color,fillColor:color,strokeColor:String(lot.properties?.strokeColor||color),fillOpacity:Number(lot.properties?.fillOpacity??.28)}};})];featureRef.current=next;return next;});
  setStatus(`${lots.length} glebas geradas. Salve o projeto para preservá-las.`);notify(`${lots.length} glebas geradas com cores e áreas individuais.`);
 };
 const extractDrawnGleba=(parentId:string,childId:string)=>{
  const parent=featureRef.current.find(f=>String(f.id)===parentId);
  const child=featureRef.current.find(f=>String(f.id)===childId);
  if(!parent||!child)throw new Error('Selecione uma gleba manual e o imóvel de origem.');
  const result=extractManualGleba(parent,child);
  setFeatures(current=>{const next=current.map(f=>String(f.id)===parentId?result.remainder:String(f.id)===childId?result.gleba:f);featureRef.current=next;return next;});
  setDetailsFeatureId(childId);setInfoExpanded(false);
  setStatus('Gleba extraída: imóvel remanescente preservado como polígono com vazio. Salve o projeto.');
  notify('Gleba e remanescente disponíveis como feições diferentes.');
 };
 const styleFeatureById=(id:string,patch:Record<string,string|number|boolean>)=>{
  setFeatures(current=>{const next=current.map(f=>String(f.id)===id?{...f,properties:{...f.properties,...patch}}:f);featureRef.current=next;return next;});
  if(patch.locked===true){setEditingFeature(current=>current===id?null:current);setSelectedFeature(current=>current===id?null:current);}
 };
 const changeVertexAppearance=(id:string,index:number,patch:{color?:string;size?:number}|null)=>{
  setFeatures(current=>{const next=current.map(item=>String(item.id)===id?{...item,properties:updateVertexAppearance(item.properties,index,patch)}:item);featureRef.current=next;return next;});
 };
  const removeSelected=async()=>{
  if(!selectedFeature)return;
   if(!await requestConfirmation({title:'Excluir desenho?',message:'Este desenho será removido do rascunho atual.',confirmLabel:'Excluir desenho',destructive:true}))return;
  setFeatures(current=>{const next=current.filter(f=>String(f.id)!==selectedFeature);featureRef.current=next;return next;});setEditingFeature(null);setSelectedFeature(null);
 };
 const updateSelected=(name:string,coords?:number[][])=>{
  if(!selectedFeature)return;
  setFeatures(current=>{
   const next=current.map(f=>{if(String(f.id)!==selectedFeature)return f;
    const copy=structuredClone(f);copy.properties={...copy.properties,name};
    if(coords&&coords.length&&!copy.properties?.locked){if(copy.geometry.type==='Point'&&coords[0])copy.geometry.coordinates=coords[0];
     else if(copy.geometry.type==='Polygon'&&coords.length>=3){const ring=coords.slice();if(ring.length>1&&ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1])ring.pop();copy.geometry.coordinates=[ring.concat([ring[0]])];if(copy.properties)delete copy.properties.confrontants;}
     else if(copy.geometry.type==='LineString'&&coords.length>=2)copy.geometry.coordinates=coords;
    }return copy;
   });featureRef.current=next;return next;
  });setEditingFeature(null);
 };void updateSelected;
 // O cartão consulta em paralelo a camada ativa e as fontes públicas SIGEF/INCRA.
 // Um retorno vazio ou lento de uma fonte não esconde os dados das demais.
 queryFeatureRef.current=(point:L.LatLng)=>{
  const map=mapRef.current;
  // Falha ao carregar mosaicos não desativa a camada para consultas vetoriais.
  const active=officialLayers.filter(layer=>layer.visible);
  if(!map||!active.length||toolRef.current!=='pan')return;
  const requestId=++officialQuerySequence.current;
  const uf=active.at(-1)?.uf||place?.uf||projectData.uf;
  const targets=officialInfoTargets(active);
  // Mostrar o marcador no clique, sem esperar o GetFeatureInfo do servidor.
  setDetailsFeatureId(null);setOfficialInfo({layer:active.at(-1)?.name||'Camada oficial',attributes:null,uf,lat:point.lat,lng:point.lng,loading:true,sources:targets.map(target=>({id:target.id,label:target.label,group:target.group,status:'loading' as const,attributes:null}))});setInfoExpanded(false);
  void (async()=>{
   const xy=map.latLngToContainerPoint(point),size=map.getSize(),bounds=map.getBounds();
   const pointQuery={bbox:[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()] as [number,number,number,number],width:size.x,height:size.y,x:Math.round(xy.x),y:Math.round(xy.y),lat:point.lat,lng:point.lng};
   await Promise.all(targets.map(async target=>{
    const result=await queryOfficialFeatureInfo(target,pointQuery);
    if(requestId!==officialQuerySequence.current)return;
    setOfficialInfo(current=>{
     if(!current||current.lat!==point.lat||current.lng!==point.lng)return current;
     const sources=current.sources.map(source=>source.id===result.id?result:source);
     const activeResult=sources.find(source=>source.id===('active:'+active.at(-1)?.id));
     return {...current,sources,loading:sources.some(source=>source.status==='loading'),attributes:activeResult?.attributes||null,geometry:activeResult?.geometry||null};
    });
   }));
   if(requestId===officialQuerySequence.current){
    setStatus('Consulta de dados oficiais concluída.');
   }
  })();
 };
 const exportOfficialAt=async(lat:number,lng:number)=>{
  // O estado do tile WMS é independente da visibilidade e não deve bloquear o WFS.
  const active=officialLayersRef.current.filter(layer=>layer.visible);
  if(!active.length){notify('Ative uma camada oficial para consultar o imóvel.');return;}
  const layer=active.at(-1)!;
  notify('Buscando geometria vetorial oficial para gerar o pacote.');
  try{
   const upstream=new URL(layer.url.replace(/\/wms(?:\?.*)?$/i,'/ows'));
   const delta=.0003;
   const fields={service:'WFS',version:'1.0.0',request:'GetFeature',typeName:layer.layers,
    outputFormat:'application/json',srsName:'EPSG:4326',maxFeatures:'50',
    bbox:[lng-delta,lat-delta,lng+delta,lat+delta].join(',')};
   Object.entries(fields).forEach(([key,value])=>upstream.searchParams.set(key,value));
   const endpoint=`${GEOSERVICES_BASE}/wfs?target=${encodeURIComponent(upstream.toString())}`;
   const response=await fetch(endpoint,{signal:AbortSignal.timeout(14000)});
   if(!response.ok)throw new Error(`Serviço vetorial indisponível (HTTP ${response.status}).`);
   const raw=await response.text();if(!raw.trim().startsWith('{'))throw new Error('O serviço não retornou GeoJSON.');
   const received=validCollection(JSON.parse(raw));
   // A busca por BBOX não identifica o imóvel sozinha: a geometria deve conter o clique.
   const contains=(ring:number[][])=>{
    let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
     const a=ring[i],b=ring[j];if(((a[1]>lat)!==(b[1]>lat)) && lng<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }return inside;
   };
   const selected=received.find(f=>{const g=f.geometry;const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return polys.some(rings=>rings.length&&contains(rings[0])&&!rings.slice(1).some(contains));});
   if(!selected)throw new Error('O serviço não forneceu um polígono vetorial compatível nesse ponto. Nenhum perímetro foi inventado.');
   const selectedFeature=[selected];
   const info=JSON.stringify({source:layer.source,layer:layer.layers,consulta:{latitude:lat,longitude:lng},properties:selected.properties},null,2);
   const files:Record<string,string|Uint8Array>={
    'dados_imovel.txt':`SURVEYOR · Imóvel consultado na fonte oficial\nCamada: ${layer.name}\nFonte: ${layer.source}\nPonto da consulta: ${lat}, ${lng}\n\n${Object.entries(selected.properties||{}).map(([k,v])=>`${k}: ${String(v??'')}`).join('\n')}\n`,
    'atributos.json':info,
    'geometria.geojson':JSON.stringify({type:'FeatureCollection',features:selectedFeature},null,2),
    'geometria.kml':toKml(selectedFeature),
    'geometria.csv':toCsv(selectedFeature),
    'shapefile_wgs84.zip':toShapefileZip(selectedFeature),
    'LEIA.txt':'Pacote de consulta técnica não certificado. O Shapefile deriva da geometria vetorial retornada pelo serviço oficial, sem reconstrução artificial pelo mapa. Consulte a fonte antes de uso registral.'
   };
   downloadBytes(`surveyor-imovel-${layer.uf||'BR'}-${new Date().toISOString().slice(0,10)}.zip`,zipFiles(files));
   notify('Pacote de consulta gerado com geometria obtida da fonte oficial.');
  }catch(error){notify(error instanceof Error?error.message:'Não foi possível obter geometria vetorial deste imóvel.');}
 };
 const onOfficialAdd=(uf:string,selected:OfficialLayer[])=>{
  officialQuerySequence.current++;setOfficialInfo(null);setLayerUF(uf);setOfficialLayers(prev=>[...prev.map(x=>({...x,visible:false})),...selected.filter(x=>!prev.some(y=>x.id===y.id)).map((x,i)=>({...x,visible:i===selected.length-1,opacity:100,state:'carregando' as const}))].map(x=>selected.some(y=>y.id===x.id)?{...x,visible:x.id===selected.at(-1)?.id}:x));
  setPanel('layers');setStatus(`${selected.length} camada(s) adicionada(s). Carregando serviço Cloudflare.`);
 };
 const toggleLayer=(id:string)=>{officialQuerySequence.current++;setOfficialInfo(null);setOfficialLayers(a=>{const isVisible=a.find(x=>x.id===id)?.visible;return a.map(x=>({...x,visible:x.id===id?!isVisible:false}));});};
 const removeLayer=(id:string)=>{officialQuerySequence.current++;setOfficialInfo(null);setOfficialLayers(a=>a.filter(x=>x.id!==id));};
 const opacityLayer=(id:string,n:number)=>setOfficialLayers(a=>a.map(x=>x.id===id?{...x,opacity:n}:x));
 const refreshOfficialLayer=(id:string)=>{const tile=appliedRefs.current.get(id);if(!tile){notify('A camada ainda não está pronta para atualização.');return;}setOfficialLayers(current=>current.map(layer=>layer.id===id?{...layer,state:'carregando'}:layer));tile.redraw();notify('Solicitação de atualização enviada ao serviço oficial.');};
 const validateIssues=():Issue[]=>[
  ...features.flatMap((f,i)=>{const parcel=parcelFromFeature(f as {id?:string|number;geometry:{type:string;coordinates?:unknown};properties?:Record<string,unknown>|null},i);return parcel?validateParcel(parcel).map(issue=>({title:`${parcel.name}: ${issue.title}`,description:issue.detail,critical:issue.kind==='error',action:()=>{setAnalysisOpen(true);setSelectedFeature(parcel.id);}})):[];}),
  ...(!projectData.name.trim()?[{title:'Nome do imóvel ausente',description:'Informe um nome antes de finalizar.',critical:true,action:()=>setPanel('project')}]:[]),
  ...(!projectData.city.trim()?[{title:'Município não definido',description:'Complete o cadastro do projeto.',critical:false,action:()=>setPanel('project')}]:[]),
  ...(!features.length?[{title:'Nenhuma geometria',description:'Desenhe ou importe pelo menos uma feição.',critical:true,action:()=>{setPaletteOpen(true);}}]:[]),
  ...(!features.some(f=>f.geometry.type==='Polygon')?[{title:'Perímetro principal não identificado',description:'Adicione um polígono da propriedade.',critical:false,action:()=>{void changeTool('polygon');}}]:[]),
  ...(!officialLayers.some(x=>x.id.includes('cefir')||x.id.includes('sicar'))?[{title:'CAR / CEFIR sem referência',description:'Adicione uma camada oficial se for necessária ao projeto.',critical:false,action:()=>setModal('catalog')}]:[]),
  ...(!officialLayers.some(x=>x.source.includes('INCRA'))?[{title:'SIGEF / INCRA não verificado',description:'A consulta externa deverá ser conferida no portal oficial.',critical:false,action:()=>setPanel('layers')}]:[])
 ];
 // A inicialização acontece após o commit do React. O agendamento também evita
 // a montagem dupla do Leaflet no mesmo elemento durante React.StrictMode.
 useEffect(()=>{
  const element=container.current;
  if(!element)return;
  let disposed=false;
  let activeMap:L.Map|null=null;
  const handleMapLeave=()=>{
   lastPointerRef.current=null;
   refreshPreviewRef.current(null);
  };
  const frame=requestAnimationFrame(()=>{
   if(disposed||!element.isConnected)return;
   try{
    const linkLat=Number(params.get('lat')),linkLng=Number(params.get('lng')),linkZoom=Number(params.get('zoom'));
    const urlCenter=Number.isFinite(linkLat)&&Number.isFinite(linkLng)&&params.has('lat')&&params.has('lng')&&Math.abs(linkLat)<=90&&Math.abs(linkLng)<=180;
    const selectedCenter=place?.center;
    let savedView: {lat:number;lng:number;zoom:number}|null=null;
    try{const s=JSON.parse(sessionStorage.getItem('surveyor-map-last-view-v1')||'null');if(s&&Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&Number.isFinite(s.zoom)&&Math.abs(s.lat)<=90&&Math.abs(s.lng)<=180)savedView=s;}catch{/* primeira visita */}
    const center:L.LatLngExpression=urlCenter?[linkLat,linkLng]:
      (savedView?[savedView.lat,savedView.lng]:(selectedCenter&&selectedCenter.length===2&&selectedCenter.every(Number.isFinite)?selectedCenter:[-12.99,-39.6]));
    const initialZoom=urlCenter&&Number.isFinite(linkZoom)?Math.min(20,Math.max(3,linkZoom)):savedView?Math.min(20,Math.max(3,savedView.zoom)):13;
     const map=L.map(element,{center,zoom:initialZoom,zoomControl:false,attributionControl:false,preferCanvas:true,minZoom:3,maxZoom:20,zoomSnap:.25,dragging:true});
     map.getContainer().classList.toggle('map-pan-ready',toolRef.current==='pan');
     activeMap=map;mapRef.current=map;
     L.control.attribution({prefix:false,position:'bottomright'}).addTo(map);
    const vector=L.tileLayer(osm,{maxZoom:20,maxNativeZoom:19,attribution:'© OpenStreetMap contributors'});
    const sat=L.tileLayer(satellite,{maxZoom:20,maxNativeZoom:19,attribution:'Imagens © Esri e parceiros'});
    const claritySat=L.tileLayer(claritySatellite,{maxZoom:20,maxNativeZoom:20,attribution:'Fonte: Esri, Vantor, Earthstar Geographics, IGN e GIS User Community'});
    const tiles=(service:string)=>L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,{maxZoom:20,maxNativeZoom:17,attribution:'© Esri'});
    baseLayers.current={default:vector,satellite:sat,clarity:claritySat,cloudless:sat,hybrid:sat,streets:tiles('World_Street_Map'),topo:tiles('World_Topo_Map'),relief:tiles('World_Shaded_Relief')};
    referenceOverlay.current=tiles('Reference/World_Boundaries_and_Places');
    baseLayers.current[mapMode].addTo(map);if(mapMode==='hybrid')referenceOverlay.current.addTo(map);
    L.control.scale({imperial:false,metric:true,position:'bottomright'}).addTo(map);
    const drawingPane=map.createPane('surveyor-editable-drawings');const rotatingOverlay=map.getPane('overlayPane');if(rotatingOverlay)rotatingOverlay.appendChild(drawingPane);drawingPane.style.zIndex='450';drawingPane.style.pointerEvents='auto';
    const rendered=L.geoJSON(undefined,{pane:'surveyor-editable-drawings',interactive:true,pointToLayer:(f,latlng)=>L.marker(latlng,{icon:f.properties?.hasMonument?monumentPointPin:regularPointPin,title:String(f.properties?.name||'Ponto marcado'),riseOnHover:true}),style:(f)=>{const color=String(f?.properties?.strokeColor||f?.properties?.lotColor||'#e9a405');return {className:'surveyor-editable-feature-hit-target',color,weight:Number(f?.properties?.lineWeight??3),fill:true,fillColor:String(f?.properties?.fillColor||f?.properties?.lotColor||color),fillOpacity:Number(f?.properties?.fillOpacity??.20)};},onEachFeature:(f,layer)=>{layer.on('click',(event:L.LeafletMouseEvent)=>{L.DomEvent.stopPropagation(event.originalEvent);if(toolRef.current!=='pan'){map.fire('click',event);return;}officialQuerySequence.current++;setOfficialInfo(null);setInfoExpanded(false);setSelectedFeature(String(f.id));setDetailsFeatureId(String(f.id));setEditingFeature(null);setContextAt(null);setMapContext(null);setPanel('layers');});
      layer.on('contextmenu',(event:L.LeafletMouseEvent)=>{
       L.DomEvent.stop(event.originalEvent);const rect=element.getBoundingClientRect();const x=event.originalEvent.clientX-rect.left,y=event.originalEvent.clientY-rect.top;
       if(toolRef.current!=='pan'){setContextAt(null);setMapContext({x:Math.max(8,Math.min(x,rect.width-236)),y:Math.max(75,Math.min(y,rect.height-235)),lat:event.latlng.lat,lng:event.latlng.lng});return;}
       if(f.geometry.type!=='Polygon')return;
       setMapContext(null);setSelectedFeature(String(f.id));setDetailsFeatureId(String(f.id));setInfoExpanded(false);setEditingFeature(null);setPanel('layers');setContextAt({x:Math.max(12,Math.min(x,rect.width-220)),y:Math.max(76,Math.min(y,rect.height-290)),id:String(f.id),lat:event.latlng.lat,lng:event.latlng.lng});
      });}}).addTo(map);
    editMarkersRef.current=L.layerGroup().addTo(map);
    measureRef.current=L.layerGroup().addTo(map);
    drawingsRef.current=rendered;
    provisionalRef.current=L.layerGroup().addTo(map);
    // Camadas efêmeras próprias: nunca interferem nos vértices fixos ou na seleção.
    const liveGroup=L.layerGroup().addTo(map);
    previewRef.current={
     group:liveGroup,
     line:L.polyline([],{color:'#1674f2',weight:3,opacity:.88,dashArray:'8 6',interactive:false}),
     area:L.polygon([],{color:'#edae19',weight:2.4,opacity:.92,fillColor:'#f8bc24',fillOpacity:.22,interactive:false}),
     circle:L.circle([0,0],{radius:1,color:'#edae19',fillColor:'#f8bc24',weight:2.4,fillOpacity:.2,interactive:false}),
     point:L.circleMarker([0,0],{radius:6,color:'#156ad4',fillColor:'#dbeafe',fillOpacity:.6,weight:2,interactive:false}),
     closeHalo:L.circleMarker([0,0],{radius:14,color:'#02aa60',weight:3,fillColor:'#a2f3bd',fillOpacity:.40,interactive:false,className:'surveyor-snap-halo'}),
     measureTip:L.tooltip({permanent:true,interactive:false,direction:'top',className:'surveyor-measure-label'}).setLatLng([0,0]).setContent('0,0 m'),
    };
    // Uma feição local malformada não pode derrubar todo o mapa.
    featureRef.current.filter(f=>visibleOnMap(f,featureRef.current)).forEach(f=>{try{rendered.addData(f);}catch(err){console.warn('SURVEYOR: feição ignorada',err);}});
    draftRef.current.forEach(p=>L.circleMarker(p,{...pointStyle,radius:4,fillColor:'#fff'}).addTo(provisionalRef.current!));
    if(draftRef.current.length>1)L.polyline(draftRef.current,{color:'#2160cb',weight:3,dashArray:'7 5'}).addTo(provisionalRef.current);
    map.on('mousemove',(e:L.LeafletMouseEvent)=>{
     setCoords([e.latlng.lat,e.latlng.lng]);
     lastPointerRef.current=e.latlng;
     refreshPreviewRef.current(e.latlng);
    });
    element.addEventListener('mouseleave',handleMapLeave);
    map.on('moveend zoomend',()=>{const c=map.getCenter();const z=map.getZoom();setZoom(z);latestMapState.current={lat:c.lat,lng:c.lng,zoom:z};sessionStorage.setItem('surveyor-map-last-view-v1',JSON.stringify(latestMapState.current));});
    map.on('contextmenu',(e:L.LeafletMouseEvent)=>{
     L.DomEvent.preventDefault(e.originalEvent);
     const p=e.containerPoint;setContextAt(null);
     setMapContext({x:Math.max(8,Math.min(p.x,element.clientWidth-236)),y:Math.max(75,Math.min(p.y,element.clientHeight-235)),lat:e.latlng.lat,lng:e.latlng.lng});
    });
    map.on('dblclick',(e:L.LeafletMouseEvent)=>{
     if(['polygon','line','arc','measure'].includes(toolRef.current)){
      L.DomEvent.stop(e.originalEvent);endDrawingRef.current();
     }
    });
    map.on('click',(e:L.LeafletMouseEvent)=>{
     setContextAt(null);setMapContext(null);const currentTool=toolRef.current;
     if(currentTool==='pan'){queryFeatureRef.current(e.latlng);return;}
     const snap=snapAt.current(e.latlng);const picked=snap?L.latLng(snap.position[0],snap.position[1]):e.latlng;
     if(currentTool==='point'){const point=feature('Point',[[picked.lat,picked.lng]]);point.properties={...point.properties,pointOrigin:'mapa',pointClass:'P',hasMonument:false};addFeature(point);return;}
     // Fechar clicando nas proximidades do primeiro vértice, inclusive quando
     // o evento é recebido pelo mapa e não diretamente pelo marcador.
     if(currentTool==='polygon'&&draftRef.current.length>=3&&
        map.latLngToContainerPoint(draftRef.current[0]).distanceTo(e.containerPoint)<=14){
      endDrawingRef.current();return;
     }
     // Evitar vértices acidentalmente duplicados durante o duplo clique.
     const last=draftRef.current.at(-1);
     if(last&&map.latLngToContainerPoint(last).distanceTo(map.latLngToContainerPoint(picked))<5)return;
     const list=[...draftRef.current,[picked.lat,picked.lng] as [number,number]];
     draftRef.current=list;setDraft(list);
     refreshPreviewRef.current(picked);
     if((currentTool==='rectangle'||currentTool==='circle')&&list.length>=2){
      const a=list[0],b=list[1];let verts:[number,number][]=[];
      if(currentTool==='rectangle')verts=[[a[0],a[1]],[a[0],b[1]],[b[0],b[1]],[b[0],a[1]]];
      else {const dx=(b[1]-a[1])*Math.cos(a[0]*Math.PI/180),dy=b[0]-a[0],r=Math.hypot(dx,dy);verts=Array.from({length:72},(_,i)=>{const t=2*Math.PI*i/72;return [a[0]+r*Math.sin(t),a[1]+r*Math.cos(t)/Math.max(.05,Math.cos(a[0]*Math.PI/180))] as [number,number];});}
      addFeature(feature('Polygon',verts));draftRef.current=[];setDraft([]);void changeTool('pan');
     }
    });
    setZoom(map.getZoom());setMapError(null);setMapReady(true);
    // O contêiner acabou de aparecer: refazer o cálculo do tamanho dos mosaicos.
    requestAnimationFrame(()=>{if(!disposed&&mapRef.current===map)map.invalidateSize({animate:false});});
   }catch(error){
    console.error('SURVEYOR: falha ao iniciar o mapa operacional',error);
    setMapReady(false);setMapError(error instanceof Error?`${error.name}: ${error.message}`:'Erro desconhecido ao iniciar o mapa.');
    if(activeMap){try{activeMap.remove();}catch{/* montagem parcial */}}
    mapRef.current=null;propertySearchHighlightRef.current=null;drawingsRef.current=null;provisionalRef.current=null;baseLayers.current=null;referenceOverlay.current=null;editMarkersRef.current=null;measureRef.current=null;previewRef.current=null;lastPointerRef.current=null;appliedRefs.current.clear();
   }
  });
  return()=>{
   disposed=true;cancelAnimationFrame(frame);
   element.removeEventListener('mouseleave',handleMapLeave);
   if(activeMap){try{activeMap.remove();}catch(error){console.warn('SURVEYOR: limpeza do mapa',error);}}
   mapRef.current=null;propertySearchHighlightRef.current=null;drawingsRef.current=null;provisionalRef.current=null;baseLayers.current=null;referenceOverlay.current=null;editMarkersRef.current=null;measureRef.current=null;previewRef.current=null;lastPointerRef.current=null;appliedRefs.current.clear();
  };
 // place e params vêm da navegação; quando muda o destino, reinicializamos o mapa.
 },[addFeature,location.key,mapAttempt]);
 useEffect(()=>{
  const map=mapRef.current;
  officialMarkerRef.current?.remove();officialMarkerRef.current=null;
  if(!map||!officialInfo)return;
  const marker=L.marker([officialInfo.lat,officialInfo.lng],{
   icon:L.divIcon({className:'map-official-pin',html:'<span>?</span>',iconSize:[31,31],iconAnchor:[15,30]}),
   keyboard:true,interactive:true,zIndexOffset:1500,title:'Consultar dados do imóvel'
  }).addTo(map);
  marker.on('click',event=>{L.DomEvent.stopPropagation(event.originalEvent);setDetailsFeatureId(null);setPanel('layers');setInfoExpanded(true);});
  officialMarkerRef.current=marker;
  return()=>{marker.remove();if(officialMarkerRef.current===marker)officialMarkerRef.current=null;};
 },[officialInfo?.lat,officialInfo?.lng,mapReady]);
 useEffect(()=>{setCloudSaved(false);},[features,projectData]);
 useEffect(()=>{
  const key=storageKey;
  if(loadedScope!==storageKey||!remoteReady||(projectId&&(loadedProjectRef.current!==projectId||loadedProjectAccountRef.current!==accountId)))return;
  let cancelled=false;
  void writeMapDraftSnapshot(localStorage,key,projectMetaKey,features,projectData).then(persisted=>{
   if(cancelled)return;
   if(!persisted){
    if(localDraftPersistenceAvailable.current)notify('Não foi possível atualizar a cópia local do rascunho. Exporte o GeoJSON antes de sair.');
    localDraftPersistenceAvailable.current=false;
    return;
   }
   localDraftPersistenceAvailable.current=true;
  });
  return()=>{cancelled=true;};
 },[features,projectData,projectId,place?.id,remoteReady,loadedScope,storageKey,projectMetaKey,accountId,notify]);
 useEffect(()=>{
  const group=drawingsRef.current;if(!group)return;
  group.clearLayers();features.filter(f=>visibleOnMap(f,features)).forEach(f=>{try{group.addData(f);}catch(error){console.warn('SURVEYOR: feição GeoJSON inválida ignorada',error);}});
 },[features]);
 useEffect(()=>{
  const map=mapRef.current, group=provisionalRef.current;if(!map||!group)return;
  group.clearLayers();
  if(draft.length>1)L.polyline(draft,{color:'#2160cb',weight:3,dashArray:'7 5',interactive:false}).addTo(group);
  draft.forEach((point,i)=>{
   const first=i===0&&toolRef.current==='polygon'&&draft.length>=3;
   const marker=L.circleMarker(point,{...pointStyle,radius:first?9:5,color:'#0b61cf',weight:2,fillColor:'#ffffff',fillOpacity:1,className:first?'surveyor-close-vertex':''}).addTo(group);
   if(first){
    marker.bindTooltip('Fechar polígono aqui',{direction:'top',className:'surveyor-close-hint',sticky:false});
    marker.on('mouseover',()=>{marker.setRadius(11);marker.setStyle({color:'#07a761',fillColor:'#baf5c8',weight:3});});
    marker.on('mouseout',()=>{marker.setRadius(9);marker.setStyle({color:'#0b61cf',fillColor:'#fff',weight:2});});
    marker.on('click',e=>{L.DomEvent.stopPropagation(e.originalEvent);endDrawingRef.current();});
   }
  });
  refreshPreviewRef.current(lastPointerRef.current);
 },[draft]);
  useEffect(()=>{
   const protectMapWork=(event:BeforeUnloadEvent)=>{
    if(!cloudPending&&!draftRef.current.length)return;
    event.preventDefault();
    event.returnValue='';
   };
   window.addEventListener('beforeunload',protectMapWork);
   return()=>window.removeEventListener('beforeunload',protectMapWork);
  },[cloudPending]);
 useEffect(()=>{
  const protectMapNavigation=(event:Event)=>{
   if(cloudPending){event.preventDefault();setSaveError('Aguarde a confirmação do salvamento na nuvem antes de sair do mapa.');return;}
   const pending=draftRef.current.length;
   if(pending)addRouteTransitionConfirmation(event,requestConfirmation({title:'Sair do mapa?',message:`O desenho em andamento com ${pending} ${pending===1?'vértice':'vértices'} será descartado ao sair do mapa.`,confirmLabel:'Descartar desenho',destructive:true}));
  };
  window.addEventListener('surveyor:before-route-change',protectMapNavigation);
  return()=>window.removeEventListener('surveyor:before-route-change',protectMapNavigation);
 },[cloudPending]);
 useEffect(()=>{
   const escape=async(e:KeyboardEvent)=>{
   if(e.key!=='Escape')return;
   e.preventDefault();
   if(terrainModal){setTerrainModal(null);return;}
   if(modal){setModal(null);return;}
   if(shapeDialog){setShapeDialog(false);return;}
   if(analysisOpen){setAnalysisOpen(false);return;}
    if(pointDialog){await changeTool('pan',true);setPointDialog(false);return;}
   if(vertexMenu){setVertexMenu(null);return;}
   if(mapContext||contextAt){setMapContext(null);setContextAt(null);return;}
   if(pointBatchMenu){setPointBatchMenu(false);return;}
   if(exportMenu){setExportMenu(false);return;}
   if(baseMenu){setBaseMenu(false);return;}
   if(paletteOpen){setPaletteOpen(false);return;}
   if(historyOpen){setHistoryOpen(false);return;}
   if(panel){setPanel(null);return;}
   if(officialInfo){setOfficialInfo(null);setInfoExpanded(false);return;}
    if(toolRef.current!=='pan')await changeTool('pan',true);
  };
  window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
 },[analysisOpen,baseMenu,changeTool,contextAt,exportMenu,historyOpen,mapContext,modal,officialInfo,paletteOpen,panel,pointBatchMenu,pointDialog,shapeDialog,terrainModal,vertexMenu]);
 useEffect(()=>{
  if(!vertexMenu)return;
  const closeOnOutsidePointer=(event:PointerEvent)=>{
   if(event.target instanceof Node&&!vertexMenuElement.current?.contains(event.target))setVertexMenu(null);
  };
  document.addEventListener('pointerdown',closeOnOutsidePointer);
  return()=>document.removeEventListener('pointerdown',closeOnOutsidePointer);
 },[vertexMenu]);
 useEffect(()=>{
  const map=mapRef.current;if(!map)return;
  map.dragging.enable();
  if(tool==='pan')map.doubleClickZoom.enable();
  else map.doubleClickZoom.disable();
  map.getContainer().classList.toggle('map-pan-ready',tool==='pan');
  refreshPreviewRef.current(lastPointerRef.current);
  map.getContainer().classList.toggle('surveyor-actively-drawing',tool!=='pan');
 },[tool,mapReady]);
 useEffect(()=>{
  const map=mapRef.current,bases=baseLayers.current;if(!map||!bases)return;
  try{
   for(const layer of new Set(Object.values(bases)))if(map.hasLayer(layer))map.removeLayer(layer);
   if(referenceOverlay.current&&map.hasLayer(referenceOverlay.current))map.removeLayer(referenceOverlay.current);
   bases[mapMode].addTo(map);bases[mapMode].bringToBack();
   if(mapMode==='hybrid')referenceOverlay.current?.addTo(map);
  }catch(error){console.error('Falha na base cartográfica',error);setStatus('Falha ao trocar a base.');}
 },[mapMode,mapReady]);
 // Integração real com o Worker Cloudflare, sem alterar o backend oficial.
 useEffect(()=>{
  const map=mapRef.current;if(!map)return;
  const refs=appliedRefs.current;
  for(const [id,tile] of Array.from(refs.entries()))if(!officialLayers.some(x=>x.id===id)){
   map.removeLayer(tile);refs.delete(id);
  }
  for(const entry of officialLayers){
   let tile=refs.get(entry.id);
   if(!tile){
    tile=L.tileLayer.wms(layerProxyUrl(entry),{layers:entry.layers,format:'image/png',transparent:true,version:'1.1.1',maxZoom:20,tileSize:256,attribution:entry.source});
    tile.on('tileerror',()=>setOfficialLayers(xs=>xs.map(x=>x.id===entry.id&&x.state!=='erro'?{...x,state:'erro'}:x)));
    tile.on('load',()=>setOfficialLayers(xs=>xs.map(x=>x.id===entry.id&&x.state==='carregando'?{...x,state:'ativa'}:x)));
    refs.set(entry.id,tile);
   }
   tile.setOpacity(entry.opacity/100);
   if(entry.visible&&!map.hasLayer(tile))tile.addTo(map);
   if(!entry.visible&&map.hasLayer(tile))map.removeLayer(tile);
  }
 },[officialLayers,mapAttempt,mapReady]);
 useEffect(()=>{
  const drawing=drawingsRef.current, labels=measureRef.current;labels?.clearLayers();if(!drawing)return;
  drawing.eachLayer((layer)=>{const path=layer as L.Path&{feature?:MapFeature};if(!('setStyle' in path))return;
   const selected=String(path.feature?.id)===selectedFeature;
   const prop=path.feature?.properties||{};const color=String(prop.strokeColor||prop.lotColor||'#e9a405');const fillColor=String(prop.fillColor||prop.lotColor||color);const weight=Number(prop.lineWeight??3);const fillOpacity=Number(prop.fillOpacity??.20);path.setStyle({color,weight:selected?Math.min(10,weight+1):weight,fillColor,fillOpacity});
  });
  if(labels&&measureLabels){
   features.filter(f=>f.geometry.type==='LineString'&&(f.properties?.name==='Medição'||typeof f.properties?.distanceM==='number')).slice(-35).forEach(f=>{
    if(f.geometry.type!=='LineString')return;
    const pts=f.geometry.coordinates;let total=0;
    pts.slice(1).forEach((p,i)=>{
     const a=pts[i],segment=haversine([a[1],a[0]],[p[1],p[0]]);total+=segment;
     L.tooltip({permanent:true,direction:'center',className:'surveyor-measure-label'}).setLatLng([(a[1]+p[1])/2,(a[0]+p[0])/2]).setContent(`${segment.toLocaleString('pt-BR',{maximumFractionDigits:2})} m`).addTo(labels);
    });
    if(pts.length>=2){const p=pts.at(-1)!;
     L.tooltip({permanent:true,direction:'top',className:'surveyor-measure-total'}).setLatLng([p[1],p[0]]).setContent(`Total: ${total.toLocaleString('pt-BR',{maximumFractionDigits:2})} m`).addTo(labels);
    }
   });
  }
  if(!selectedFeature||!labels||!measureLabels)return;
  const selected=features.find(f=>String(f.id)===selectedFeature);if(!selected||selected.geometry.type!=='Polygon'||selected.properties?.locked)return;
  const raw=selected.geometry.coordinates[0],ring=raw.length>1&&raw[0][0]===raw[raw.length-1][0]&&raw[0][1]===raw[raw.length-1][1]?raw.slice(0,-1):raw;
  if(ring.length>40)return;
  ring.forEach((v,i)=>{
   const a:[number,number]=[v[1],v[0]],end=ring[(i+1)%ring.length],b:[number,number]=[end[1],end[0]];
   const appearance=getVertexAppearance(selected.properties,i);
   const circle=L.circleMarker(a,{radius:Math.max(4,appearance.size/3),color:svgTextOutline(appearance.color)==='#ffffff'?'#ffffff':'#142238',weight:2,fillColor:appearance.color,fillOpacity:1}).bindTooltip(`V-${String(i+1).padStart(2,'0')}`,{permanent:true,direction:'top',className:'surveyor-vertex-label'}).addTo(labels);
   circle.on('click',(event:L.LeafletMouseEvent)=>showVertexAppearance(selectedFeature,i,event));
   circle.on('contextmenu',(event:L.LeafletMouseEvent)=>showVertexAppearance(selectedFeature,i,event));
   const dist=haversine(a,b),mid:[number,number]=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   L.tooltip({permanent:true,direction:'center',className:'surveyor-measure-label'}).setLatLng(mid).setContent(`${dist.toLocaleString('pt-BR',{maximumFractionDigits:1})} m`).addTo(labels);
  });
 },[features,selectedFeature,measureLabels]);
 useEffect(()=>{
  const group=editMarkersRef.current;const map=mapRef.current;if(!group||!map)return;
  group.clearLayers();if(!editingFeature)return;
  const f=featureRef.current.find(x=>String(x.id)===editingFeature);if(!f||f.properties?.locked||f.geometry.type!=='Polygon')return;
  const polyCoords=f.geometry.coordinates;
  const raw=polyCoords[0],ring=openRing(raw);
  const coarsePointer=typeof window!=='undefined'&&((typeof window.matchMedia==='function'&&window.matchMedia('(any-pointer: coarse)').matches)||(typeof navigator!=='undefined'&&navigator.maxTouchPoints>0));
  const vertexHitSize=coarsePointer?44:28;
  const midpointHitSize=coarsePointer?44:16;
  let raf=0;
  const renderLive=(preview=ring)=>{
   const points=preview.map(([lng,lat])=>L.latLng(lat,lng));
   drawingsRef.current?.eachLayer(layer=>{const polygon=layer as L.Polygon&{feature?:MapFeature};if(String(polygon.feature?.id)===editingFeature&&polygon instanceof L.Polygon)polygon.setLatLngs([points,...polyCoords.slice(1).map((hole:number[][])=>hole.map(([lng,lat]:number[])=>L.latLng(lat,lng)))]);});
   const labels=measureRef.current;labels?.clearLayers();
   if(labels)preview.forEach((coord,i)=>{
    const after=preview[(i+1)%preview.length],latlng=L.latLng(coord[1],coord[0]),dist=haversine([coord[1],coord[0]],[after[1],after[0]]);
    L.tooltip({permanent:true,direction:'top',className:'surveyor-vertex-label'}).setLatLng(latlng).setContent(`V-${String(i+1).padStart(2,'0')}`).addTo(labels);
    L.tooltip({permanent:true,direction:'center',className:'surveyor-measure-label'}).setLatLng([(coord[1]+after[1])/2,(coord[0]+after[0])/2]).setContent(`${dist.toLocaleString('pt-BR',{maximumFractionDigits:1})} m`).addTo(labels);
   });
  };
  ring.forEach((lnglat,index)=>{
   const appearance=getVertexAppearance(f.properties,index);
   const visualStyle=`width:${appearance.size}px;height:${appearance.size}px;background:${appearance.color};box-shadow:0 0 0 3px ${appearance.color},0 2px 8px #07316699`;
   const marker=L.marker([lnglat[1],lnglat[0]],{draggable:!vertexRemovalMode,autoPan:true,icon:L.divIcon({className:vertexRemovalMode?'surveyor-edit-handle surveyor-remove-handle':'surveyor-edit-handle',html:vertexRemovalMode?'<span>×</span>':`<span style="${visualStyle}"></span>`,iconSize:[vertexHitSize,vertexHitSize],iconAnchor:[vertexHitSize/2,vertexHitSize/2]}),zIndexOffset:1200});
   marker.on('contextmenu',(event:L.LeafletMouseEvent)=>showVertexAppearance(editingFeature,index,event));
   if(!vertexRemovalMode)marker.on('click',(event:L.LeafletMouseEvent)=>showVertexAppearance(editingFeature,index,event));
   marker.bindTooltip(vertexRemovalMode?`Remover V-${String(index+1).padStart(2,'0')}`:`V-${String(index+1).padStart(2,'0')}`,{direction:'top'});
    if(vertexRemovalMode)marker.on('click',async()=>{
     try{const closed=removeVertexAt(ring,index);if(!await requestConfirmation({title:`Remover vértice V-${String(index+1).padStart(2,'0')}?`,message:'Isso modifica o perímetro e pode alterar a área. Confira as medidas e os confrontantes após a remoção.',confirmLabel:'Remover vértice',destructive:true}))return;
     setFeatures(current=>{const updated=current.map(item=>String(item.id)===editingFeature&&item.geometry.type==='Polygon'?{...item,geometry:{...item.geometry,coordinates:replaceExteriorRing(item.geometry.coordinates,closed)},properties:shiftVertexAppearance(segmentMetadataAfterRemove(item.properties||{},index,ring.length),'remove',index)}:item);featureRef.current=updated;return updated;});
     setVertexRemovalMode(false);setVertexMenu(null);setStatus('Vértice removido. Confira área e confrontantes dos trechos unidos antes de salvar.');
    }catch(error){notify(error instanceof Error?error.message:'Não foi possível remover o vértice.');}
   });
   marker.on('drag',()=>{const pos=marker.getLatLng();ring[index]=[pos.lng,pos.lat];cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>renderLive());});
   marker.on('dragend',()=>{cancelAnimationFrame(raf);const pos=marker.getLatLng();ring[index]=[pos.lng,pos.lat];renderLive();const closed=closeRing(ring);
    setFeatures(current=>{const updated=current.map(item=>{if(String(item.id)!==editingFeature||item.geometry.type!=='Polygon')return item;return {...item,geometry:{...item.geometry,coordinates:replaceExteriorRing(item.geometry.coordinates,closed)}};});featureRef.current=updated;return updated;});
   });marker.addTo(group);
  });
  // Assim como no RC185, os subpontos só inserem um vértice quando arrastados.
  if(editMidpointsEnabled&&!vertexRemovalMode&&ring.length>=3&&ring.length<=500){
   ring.forEach((pt,index)=>{
    const next=ring[(index+1)%ring.length],middle:[number,number]=[(pt[0]+next[0])/2,(pt[1]+next[1])/2];
    const midpoint=L.marker([middle[1],middle[0]],{draggable:true,autoPan:true,icon:L.divIcon({className:'surveyor-edit-midpoint',html:'<span>+</span>',iconSize:[midpointHitSize,midpointHitSize],iconAnchor:[midpointHitSize/2,midpointHitSize/2]}),zIndexOffset:1150});
    midpoint.bindTooltip('Arraste para adicionar vértice neste trecho',{direction:'top'});
    midpoint.on('drag',()=>{const location=midpoint.getLatLng();cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>renderLive([...ring.slice(0,index+1),[location.lng,location.lat],...ring.slice(index+1)]));});
    midpoint.on('dragend',()=>{cancelAnimationFrame(raf);const location=midpoint.getLatLng();const closed=insertVertexOnEdge(ring,index,[location.lng,location.lat]);
     setFeatures(current=>{const updated=current.map(item=>String(item.id)===editingFeature&&item.geometry.type==='Polygon'?{...item,geometry:{...item.geometry,coordinates:replaceExteriorRing(item.geometry.coordinates,closed)},properties:shiftVertexAppearance(segmentMetadataAfterInsert(item.properties||{},index,ring.length),'insert',index)}:item);featureRef.current=updated;return updated;});
     setStatus('Subponto convertido em vértice; a confrontação do trecho foi replicada. Confira e salve.');
    });midpoint.addTo(group);
   });
  }
  return()=>{cancelAnimationFrame(raf);};
 },[editingFeature,features,editMidpointsEnabled,vertexRemovalMode]);
 useEffect(()=>{if(panel||selectedFeature){const id=requestAnimationFrame(()=>mapRef.current?.invalidateSize({animate:false}));return()=>cancelAnimationFrame(id);}},[panel,selectedFeature]);
 useEffect(()=>{
  const el=miniMapElement.current;if(!el||miniMapRef.current||!mapRef.current)return;
  try{const center=mapRef.current.getCenter();const m=L.map(el,{center,zoom:8,zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,keyboard:false,boxZoom:false, doubleClickZoom:false,touchZoom:false});miniMapRef.current=m;
   L.tileLayer(osm,{maxZoom:18}).addTo(m);miniMarkerRef.current=L.circleMarker(center,{radius:5,color:'#0c62cc',fillColor:'#0c62cc',fillOpacity:.8}).addTo(m);
   const update=()=>{const c=mapRef.current?.getCenter();if(!c)return;miniMarkerRef.current?.setLatLng(c);m.setView(c,Math.max(3,(mapRef.current?.getZoom()||13)-5));};mapRef.current.on('moveend',update);update();
   return()=>{mapRef.current?.off('moveend',update);m.remove();miniMapRef.current=null;miniMarkerRef.current=null;};
  }catch{return;}
 },[mapAttempt,mapReady]);
 useEffect(()=>{
  if(!projectId||!session)return;
  let cancelled=false;
  getProject(session,projectId).then(async result=>{
   if(cancelled)return;
   let options:Record<string,unknown>={};
   try{options=record(record((await getDocumentCustomization(session)).customization).options);}catch{/* projeto segue normalmente sem personalização */}
   if(cancelled)return;
   const [indexedLocal,indexedMeta]=await Promise.all([
    readOfflineDraft<MapFeature[]>(storageKey),
    readOfflineDraft<MapProjectData>(projectMetaKey)
   ]);
   if(cancelled)return;
   const applyShared=(items:MapFeature[])=>items.map(f=>{
    if(f.geometry.type!=='Polygon')return f;
    const count=Math.max(0,f.geometry.coordinates[0].length-1);
    const shared=readConfrontants(options,projectId,String(f.id));
    return shared?{...f,properties:mergeConfrontantsIntoProperties(record(f.properties),count,shared)}:f;
   });
   const imported=applyShared(restoreMapFeatures(result.features).filter(validFeature));
   // Nunca substitua um rascunho alterado sem avisar. Se a cópia local já tinha sido
   // sincronizada e a nuvem avançou em outro dispositivo, a nuvem é a fonte atual.
   let localJson:string|null=null;
   try{localJson=localStorage.getItem(storageKey);}catch{/* IndexedDB é a cópia de recuperação */}
   const local=localJson?readJson<MapFeature[]>(storageKey,[]).filter(validFeature):Array.isArray(indexedLocal)?indexedLocal.filter(validFeature):null;
   const currentRevision=String(result.project?.revision||result.project?.updatedAt||'');
   const sync=readJson<{fingerprint:string;revision:string}|null>(syncKey,null);
   const locallyModified=!!local&&(!sync||sync.fingerprint!==mapFingerprint(local));
   const newerCloud=!!sync&&!!currentRevision&&currentRevision!==sync.revision;
   // Não preferir um cache antigo sobre uma revisão válida da nuvem.
   const useLocal=!!local&&locallyModified;
   const current=useLocal?applyShared(local||[]):imported;
   skipHistory.current=true;
   setFeatures(current);featureRef.current=current;
   if(current.length){try{const bounds=L.geoJSON({type:'FeatureCollection',features:current} as FeatureCollection).getBounds();if(bounds.isValid())mapRef.current?.fitBounds(bounds,{padding:[55,55],maxZoom:17});}catch{/* dados parciais: manter enquadramento */}}
   remoteRevision.current=currentRevision;
   loadedProjectRef.current=projectId;loadedProjectAccountRef.current=accountId;
   cloudConflictRef.current=Boolean(useLocal&&newerCloud&&locallyModified);
   if(useLocal&&newerCloud&&locallyModified)notify('Há alterações no rascunho local e uma versão mais nova na nuvem. Exporte o GeoJSON e revise antes de salvar para não sobrescrever mudanças de outro dispositivo.');
   if(useLocal&&!sync&&local?.length)notify('Rascunho local anterior recuperado. Confira os dados antes de substituir o projeto na nuvem.');
   setProjectName(result.project?.propertyName||result.project?.name||'');
   if(result.project){
    const meta=record(result.project.metadata);
    const localMeta=readJson<MapProjectData|null>(projectMetaKey,indexedMeta||null);
    setProjectData(prev=>({
      ...prev,name:localMeta?.name||result.project?.propertyName||result.project?.name||prev.name,
      owner:result.project?.ownerName||localMeta?.owner||prev.owner,
      cpf:String(meta.ownerCpf||localMeta?.cpf||''),rg:String(meta.ownerRg||localMeta?.rg||''),
      owner2:projectOwners(result.project)[1]?.name||localMeta?.owner2||'',
      additionalOwners:(Array.isArray(meta.additionalOwners)||meta.owner2||meta.secondOwnerName)
        ?projectOwners(result.project).slice(1)
        :(localMeta?.additionalOwners?.length?localMeta.additionalOwners:projectOwners({ownerName:result.project?.ownerName,metadata:{owner2:localMeta?.owner2||''}}).slice(1)),
      city:localMeta?.city||result.project?.municipality||prev.city,
      uf:localMeta?.uf||result.project?.stateCode||prev.uf,
      description:localMeta?.description||result.project?.description||prev.description
    }));
   }
   const c=result.project;
   if(c&&Number.isFinite(c.centerLatitude)&&Number.isFinite(c.centerLongitude))mapRef.current?.setView([Number(c.centerLatitude),Number(c.centerLongitude)],Math.min(19,Math.max(4,c.defaultZoom||15)));
   setRemoteReady(true);setStatus(useLocal?'Rascunho local recuperado.':'Projeto da nuvem carregado.');
  }).catch(()=>{if(!cancelled){notify('Não foi possível carregar o projeto da nuvem. Rascunho local preservado.');setSaveError('A API não carregou a revisão do projeto. Confira o domínio da API e a Function antes de sincronizar.');}});
  return()=>{cancelled=true;};
 },[projectId,session,notify,storageKey]);
  const confirmMapExit=async()=>{
   if(cloudPending){setSaveError('Aguarde a confirmação do salvamento na nuvem antes de sair do mapa.');return false;}
   const pending=draftRef.current.length;
   return !pending||await requestConfirmation({title:'Sair do mapa?',message:`O desenho em andamento com ${pending} ${pending===1?'vértice':'vértices'} será descartado.`,confirmLabel:'Descartar e sair',destructive:true});
  };
   const navigateBack=async()=>{if(await confirmMapExit())navigate('/mapa/?novo=1');};
   const navigateHome=async()=>{if(await confirmMapExit())navigate('/');};
  const home=()=>mapRef.current?.setView(place?.center||[-14.2,-52.3],13,{animate:true});
 const locateUser=()=>{
  if(!navigator.geolocation){notify('A localização não está disponível neste navegador.');return;}
  navigator.geolocation.getCurrentPosition(
   position=>mapRef.current?.flyTo([position.coords.latitude,position.coords.longitude],16),
   error=>notify(error.code===1?'A permissão para acessar a localização foi negada.':error.code===2?'Não foi possível determinar a localização deste dispositivo.':'A consulta de localização expirou. Tente novamente.'),
   {timeout:12000,maximumAge:60000}
  );
 };
 const useLegacyTool=async(id:LegacyToolId)=>{
  if(['pan','polygon','line','rectangle','circle','arc','point','measure'].includes(id)){
     if(!await changeTool(id as Tool))return;
    setPaletteOpen(false);setContextAt(null);
   if(id==='point')setPointDialog(true);
   return;
  }
   setPaletteOpen(false);setContextAt(null);setActiveLegacy(['edit','pan'].includes(id)?id:'pan');
  switch(id){
   case 'edit':if(selectedFeature){setEditingFeature(selectedFeature);setStatus('Arraste um vértice para mover; toque nele para abrir as opções de aparência.');}else{setPanel('layers');notify('Selecione primeiro um desenho na lista de Camadas ou clique no perímetro.');}break;
   case 'snap':{
    const enabled=!snapEnabled;setSnapEnabled(enabled);snapEnabledRef.current=enabled;
    try{localStorage.setItem('surveyor-live-snap-enabled-v1',enabled?'1':'0');}catch{/* opcional */}
    notify(enabled?'Snap ativado: novos vértices se alinham aos pontos e segmentos existentes, até 15 pixels.':'Snap desativado.');break;
   }
   case 'auto-points':{
    const enabled=!editMidpointsEnabled;setEditMidpointsEnabled(enabled);
    try{localStorage.setItem('surveyor-edit-midpoints-v2',enabled?'1':'0');}catch{/* preferência opcional */}
    const f=features.find(x=>String(x.id)===selectedFeature);
    if(enabled&&f?.geometry.type==='Polygon')setEditingFeature(String(f.id));
    setStatus(enabled?'Subpontos habilitados: arraste um + entre vértices para adicionar, sem alterar o perímetro antes disso.':'Subpontos ocultos. O perímetro permanece inalterado.');
    notify(enabled?'Pontos automáticos visíveis na edição. Arraste para inserir um vértice.':'Pontos automáticos ocultados; nenhum vértice foi alterado.');break;
   }
   case 'hide-vertex':{
    const f=features.find(x=>String(x.id)===selectedFeature);
    if(f?.geometry.type!=='Polygon'){notify('Selecione um polígono para escolher o vértice a remover.');break;}
    if(openRing(f.geometry.coordinates[0]).length<=3){notify('Um polígono precisa manter pelo menos três vértices.');break;}
    setEditingFeature(String(f.id));setVertexRemovalMode(true);setStatus('Clique no vértice exato que deseja remover (marcado com ×).');break;
   }
   case 'frontback':case 'profile':case 'cutfill':case 'contours':case 'spot':case 'earth3d':{const polys=featureRef.current.filter(f=>(id==='profile'?(f.geometry.type==='Polygon'||f.geometry.type==='LineString'):f.geometry.type==='Polygon')&&f.properties?.hidden!==true);if(!polys.length){notify(id==='profile'?'Desenhe primeiro um polígono ou linha no mapa para gerar o perfil do terreno.':'Desenhe ou selecione primeiro um polígono no mapa para usar esta ferramenta.');break;}if(!selectedFeature||!polys.some(p=>String(p.id)===selectedFeature))setSelectedFeature(String(polys[0].id));setTerrainModal(id as AdvancedToolKind);break;}
    case 'delete':await removeSelected();break;
   case 'refresh':mapRef.current?.invalidateSize();baseLayers.current?.[mapMode].redraw();notify('Base cartográfica atualizada.');break;
     case 'mark':if(await changeTool('point'))setPointDialog(true);break;
   case 'coordinates':document.querySelector<HTMLInputElement>('.map-operational-search input')?.focus();break;
   case 'cotas':setMeasureLabels(v=>!v);notify('Exibição de cotas atualizada para o elemento selecionado.');break;
   case 'terrain':setMapMode('topo');notify('Visualização topográfica ativada.');break;
     case 'cancel':await changeTool('pan',true);break;
   default:notify(`A ferramenta "${legacyMapTools.find(t=>t.id===id)?.label}" consta no SURVEYOR oficial, mas seu motor técnico ainda não foi migrado. Nenhum cálculo simulado será usado.`);
  }
 };
 const legacyIcons:Record<string,ReactNode>={pointer:<MousePointer2/>,pentagon:<Pentagon/>,route:<Route/>,square:<Square/>,circle:<Circle/>,arc:<Waypoints/>,pin:<MapPin/>,edit:<Pencil/>,points:<Grid3X3/>,minus:<Minus/>,trash:<Trash2/>,refresh:<RefreshCw/>,ruler:<Ruler/>,coordinate:<Crosshair/>,measure:<SlidersHorizontal/>,split:<PanelRightClose/>,terrain:<Mountain/>,profile:<Route/>,cutfill:<Scissors/>,contours:<Layers3/>,spot:<MapPin/>,earth:<Globe2/>,x:<X/>};
 const formatMapCoordinates=(lat:number,lng:number)=>`Lat ${lat.toFixed(7)} · Lon ${lng.toFixed(7)}`;
 const copyMapCoordinates=async(lat:number,lng:number)=>{
  const value=`${lat.toFixed(7)}, ${lng.toFixed(7)}`;
  try{await navigator.clipboard.writeText(value);notify('Coordenadas copiadas em latitude, longitude.');}
  catch{notify('Não foi possível copiar as coordenadas.');}
 };
 const share=async()=>{
  const m=latestMapState.current;const qs=new URLSearchParams({lat:round(m.lat),lng:round(m.lng),zoom:String(m.zoom)});if(place){qs.set('uf',place.uf);qs.set('city',place.name);qs.set('cityId',place.id);}if(projectId)qs.set('project',projectId);const url=`${window.location.origin}/mapa/trabalho/?${qs.toString()}`;
  try{await navigator.clipboard.writeText(url);notify('Link do enquadramento copiado. O desenho local não é compartilhado.');}catch{notify('Não foi possível copiar o link.');}
 };
 const moreToolsSelected=isMoreToolsSelected({paletteOpen,vertexRemoval:vertexRemovalMode,autoPoints:editMidpointsEnabled,snap:snapEnabled,activeLegacy,tool});
 const legacyToolSelectionState={tool,activeLegacy,autoPoints:editMidpointsEnabled,snap:snapEnabled,vertexRemoval:vertexRemovalMode,showMeasures:measureLabels,basemap:mapMode};
 const detailsFeature=detailsFeatureId?features.find(item=>String(item.id)===detailsFeatureId)??null:null;
 const restore=(snapshot:{date:string;features:MapFeature[]})=>{const updated=snapshot.features.map(f=>structuredClone(f));featureRef.current=updated;setFeatures(updated);setHistoryOpen(false);setStatus('Versão local restaurada. Salve para preservá-la.');};
 if(!place&&!projectId)return <main className="map-missing"><MapIcon size={42}/><h1>Selecione um município</h1><p>Primeiro escolha um estado e um município no mapa territorial.</p><button className="button primary" onClick={navigateBack}>Abrir mapa do Brasil</button></main>;
 return <main className="operational-screen">
   <div className={`operational-leaflet ${tool==='pan'?'map-pan-ready':''}`} ref={container} aria-label="Mapa operacional. Arraste para mover o mapa e use as ferramentas para desenhar." />
  {mapError&&<div className="map-recovery" role="alert"><strong>Não foi possível iniciar o mapa</strong><p>O navegador encontrou um erro ao carregar o editor.</p><code>{mapError}</code><button type="button" onClick={()=>{setMapError(null);setMapAttempt(n=>n+1);}}>Tentar novamente</button><button type="button" onClick={navigateBack}>Voltar ao Brasil</button></div>}
  <header className="map-topbar">
   <button type="button" className="map-home-return" title="Voltar ao início" aria-label="Voltar à página inicial" onClick={navigateHome}><ArrowLeft size={18}/></button>
   <div className="map-tools-scroll">
    <div className="map-tools-group">{button('Salvar',<Save size={17}/>,()=>{setBaseMenu(false);setExportMenu(false);setPaletteOpen(false);setPanel('project');},panel==='project',cloudPending,'Abrir dados do projeto para conferir e salvar')}{button('Versões',<History size={17}/>,()=>{setHistoryOpen(v=>!v);setPanel(null);})}{button('Validar',<CheckCircle2 size={17}/>,validate,false,false,'Conferir geometria e dados do projeto')}</div>
    <div className="map-tools-group">{button('Camadas',<Layers3 size={17}/>,()=>{setPanel(p=>p==='layers'?null:'layers');setBaseMenu(false);},panel==='layers')}</div>
    <div className="map-tools-group">{button('Polígono',<Pentagon size={17}/>,async()=>{const next=tool==='polygon'?'pan':'polygon';if(!await changeTool(next,next==='pan'))return;setPointDialog(false);},tool==='polygon')}{button('Marcar ponto',<MapPin size={17}/>,async()=>{if(pointDialog){await changeTool('pan',true);setPointDialog(false);return;}if(await changeTool('point'))setPointDialog(true);},tool==='point')}{readyPointBatches.length>0&&button('Gerar polígono',<Pentagon size={17}/>,()=>{if(readyPointBatches.length===1)void makePolygonFromPoints(readyPointBatches[0].id);else setPointBatchMenu(v=>!v);},pointBatchMenu)}{button('Gleba',<Scissors size={17}/>,()=>{setPaletteOpen(false);setBaseMenu(false);setPanel(p=>p==='gleba'?null:'gleba');},panel==='gleba',false,'Dividir polígono em glebas e extrair perímetros')}{button('Mais',<ChevronDown size={17} className={paletteOpen?'map-more-chevron open':'map-more-chevron'}/>,()=>{setPaletteOpen(v=>!v);setBaseMenu(false);},moreToolsSelected)}</div>
    <div className="map-tools-group"><button type="button" className={`map-tool ${baseMenu?'map-tool-active':''}`} aria-label="Mapa" title="Mapa" aria-controls="map-basemap-menu" aria-expanded={baseMenu} onClick={()=>{setBaseMenu(v=>!v);setExportMenu(false);}}><MapIcon size={17}/><span>Mapa</span></button></div>
    <div className="map-tools-group">{button('Importar',<Upload size={17}/>,()=>setModal('import'))}{button('Exportar',<Download size={17}/>,()=>{setExportMenu(v=>!v);setBaseMenu(false);},exportMenu,draft.length>0,draft.length?'Finalize ou cancele o desenho para exportar':undefined)}</div>
    <div className="map-tools-group">{button('Compartilhar',<Share2 size={17}/>,()=>void share())}</div>
    {(draft.length>0||historyCount.undo>0||historyCount.redo>0)&&<div className="map-tools-group map-tools-undo">{button('Desfazer',<Undo2 size={16}/>,undo,false,!draft.length&&!historyCount.undo)}{button('Refazer',<Redo2 size={16}/>,redo,false,!historyCount.redo)}</div>}
   </div>
   <AdvancedMapSearch onClearProperty={clearOfficialProperty} onProperty={highlightOfficialProperty} uf={place?.uf||projectData.uf} initialCity={place?{id:place.id,name:place.name,uf:place.uf,stateName:place.stateName}:null} onCoordinates={(lat,lng)=>mapRef.current?.flyTo([lat,lng],16)} onBounds={bounds=>{const map=mapRef.current;if(!map)return;map.invalidateSize({animate:false});map.flyToBounds(bounds,{paddingTopLeft:[panel?390:55,65],paddingBottomRight:[80,65],maxZoom:15,duration:.65});setStatus('Enquadramento atualizado para o município selecionado.');}}/>
  </header>
  {pointBatchMenu&&readyPointBatches.length>1&&<div className="map-point-batch-menu" role="dialog" aria-label="Gerar polígono a partir de pontos"><strong>Escolha os pontos para ligar</strong><p>Os vértices serão conectados na ordem do arquivo original.</p>{readyPointBatches.map(batch=><button key={batch.id} onClick={()=>void makePolygonFromPoints(batch.id)}><Pentagon size={16}/><span>{batch.label}<small>{batch.points.length} pontos</small></span></button>)}<button className="map-point-batch-dismiss" onClick={()=>setPointBatchMenu(false)}>Cancelar</button></div>}
  {baseMenu&&<div id="map-basemap-menu" className="map-basemap-popover map-basemap-rich" role="group" aria-label="Visualização do mapa"><h4>Visualização do mapa</h4><button type="button" className="map-basemap-option" aria-label="Visão territorial" aria-pressed={false} onClick={()=>navigateBack()}><img src="/basemap-thumbs/territorial-brazil.webp" alt=""/><span className="map-basemap-label">Visão territorial</span></button>{basemapOptions.map(([kind,label])=><button type="button" className={`map-basemap-option ${mapMode===kind?'selected':''}`} aria-label={label} aria-pressed={mapMode===kind} title={kind==='clarity'?'Imagens de arquivo; podem ser mais antigas que o Satélite padrão.':label} key={kind} onClick={()=>{setMapMode(kind);setBaseMenu(false);}}><img src={`/basemap-thumbs/${kind==='clarity'||kind==='cloudless'?'satellite':kind}.jpg`} alt=""/><span className="map-basemap-label">{label}</span>{mapMode===kind&&<Check size={16}/>}</button>)}</div>}
  {exportMenu&&<div className="map-export-popover"><h4>Exportar projeto</h4><button onClick={()=>{if(exportFile())setExportMenu(false);}}>GeoJSON</button><button onClick={()=>{if(!ensureCompletedDrawing('exportar KML'))return;downloadText('surveyor.kml',toKml(featureRef.current),'application/vnd.google-earth.kml+xml');setExportMenu(false);}}>KML</button><button onClick={()=>{if(!ensureCompletedDrawing('exportar DXF'))return;downloadText('surveyor.dxf',featuresToDxf(featureRef.current),'application/dxf');setExportMenu(false);}}>AutoCAD (.dxf)</button><button onClick={()=>{if(!ensureCompletedDrawing('exportar CSV'))return;downloadText('surveyor.csv',toCsv(featureRef.current),'text/csv;charset=utf-8');setExportMenu(false);}}>CSV</button><button onClick={()=>{if(!ensureCompletedDrawing('exportar TXT'))return;downloadText('surveyor-feicoes.txt',featureRef.current.map(f=>JSON.stringify(f)).join('\n'),'text/plain');setExportMenu(false);}}>TXT</button><button onClick={()=>{if(!ensureCompletedDrawing('exportar shapefile'))return;setExportMenu(false);setShapeDialog(true);}}>Shapefile (.zip)</button><button onClick={()=>{if(!ensureCompletedDrawing('exportar o pacote técnico'))return;downloadBytes('surveyor-pacote-tecnico.zip',toTechnicalPackage(featureRef.current,projectData));notify('Pacote técnico de trabalho exportado.');setExportMenu(false);}}>Pacote técnico (.zip)</button></div>}
  {paletteOpen&&<div className="map-tools-palette map-tools-legacy"><header><strong>Ferramentas adicionais · {legacyMapTools.filter(x=>!['polygon','point','mark','coordinates','cancel','edit','delete','refresh','terrain'].includes(x.id)).length+1}</strong><button onClick={()=>setPaletteOpen(false)} aria-label="Fechar ferramentas"><X size={15}/></button></header><div className="map-tools-legacy-grid">{legacyMapTools.filter(entry=>!['polygon','point','mark','coordinates','cancel','edit','delete','refresh','terrain'].includes(entry.id)).map(entry=><button key={entry.id} type="button" className={`map-legacy-tool ${isLegacyToolSelected(entry.id,legacyToolSelectionState)?'map-legacy-active':''}`} aria-pressed={isLegacyToolSelected(entry.id,legacyToolSelectionState)} title={entry.label} aria-label={entry.label} onClick={()=>useLegacyTool(entry.id)}>{legacyIcons[entry.icon]}<span>{entry.label}</span></button>)}<button type="button" className="map-legacy-tool" onClick={()=>{setPaletteOpen(false);const polys=featureRef.current.filter(f=>f.geometry.type==='Polygon'&&f.properties?.hidden!==true);if(!polys.length){notify('Desenhe primeiro um polígono no mapa para gerar faixa paralela / buffer.');return;}if(!selectedFeature)setSelectedFeature(String(polys[0].id));setTerrainModal('buffer');}}><SlidersHorizontal size={18}/><span>Buffer / Recuo (m)</span></button></div></div>}
  {historyOpen&&<aside className="map-flyout"><div className="map-flyout-head"><strong>Versões locais</strong><button onClick={()=>setHistoryOpen(false)} aria-label="Fechar"><X size={17}/></button></div><div className="map-flyout-body">{versions.length?versions.map(v=><button key={v.date} onClick={()=>restore(v)}><History size={16}/>{new Date(v.date).toLocaleString('pt-BR')} ({v.features.length} feições)</button>):<p>Nenhuma versão local salva.</p>}</div></aside>}
  {shapeDialog&&<div className="map-modal-backdrop"><section className="map-shape-dialog" role="dialog" aria-modal="true" aria-label="Exportar Shapefile"><header><div><h2>Exportar Shapefile</h2><span>Onde este arquivo será utilizado?</span></div><button onClick={()=>setShapeDialog(false)} aria-label="Fechar"><X size={18}/></button></header><div className="map-shape-profiles">{([
   ['seia-cefir-ba','SEIA / CEFIR — Bahia'],['sicar-car','SICAR / CAR — Brasil'],['sigef-incra','INCRA / SIGEF — referência'],['qgis-arcgis','QGIS / ArcGIS / software SIG'],['other','Outro sistema']
  ] as [import('./shapefileExport').ShapeTarget,string][]).map(([id,title])=><label className={shapeProfile===id?'selected':''} key={id}><input name="shp-profile" type="radio" value={id} checked={shapeProfile===id} onChange={()=>setShapeProfile(id)}/><span>{title}</span></label>)}</div><footer><button onClick={()=>setShapeDialog(false)}>Cancelar</button><button className="map-primary" onClick={()=>{try{const result=toShapefileZip(featureRef.current,shapeProfile);downloadBytes(shapeProfile==='seia-cefir-ba'?'shapeImovelRural-SEIA-CEFIR.zip':`surveyor-${shapeProfile}.zip`,result);setShapeDialog(false);notify('Shapefile gerado.');}catch(err){notify(err instanceof Error?err.message:'Falha ao exportar Shapefile.');}}}>Validar e gerar</button></footer></section></div>}
  {legacyDraftAvailable&&<div className="map-legacy-recovery" role="status"><strong>Rascunho de versão anterior encontrado neste navegador.</strong> <span>Por segurança, não foi carregado automaticamente nesta conta.</span> <button type="button" onClick={recoverLegacyDraft}>Revisar e recuperar rascunho antigo</button> <button type="button" onClick={()=>setLegacyDraftAvailable(false)}>Ocultar aviso</button></div>}
  <WorkSidebar panel={panel==='gleba'?null:panel} municipalityState={municipalityState} saveError={saveError} onBackupDraft={exportFile} onClose={()=>setPanel(null)} onCatalog={()=>setModal('catalog')} project={projectData} onProjectChange={setProjectData} onSave={saveProject} cloudPending={cloudPending} activeLayers={officialLayers} onToggleLayer={toggleLayer} onRemoveLayer={removeLayer} onOpacityLayer={opacityLayer} onRefreshLayer={refreshOfficialLayer} features={features} selectedFeature={selectedFeature} onRemoveFeature={removeMapFeature} onStyleFeature={styleFeatureById} onDivideFeature={id=>{setSelectedFeature(id);setPanel('gleba');}} onRenameFeature={(id,name)=>{setFeatures(current=>{const next=current.map(f=>String(f.id)===id?{...f,properties:{...f.properties,name}}:f);featureRef.current=next;return next;});}} onConfrontantFeature={(id,values)=>saveConfrontants(values,id)} onConfrontantDetailFeature={(id,values)=>saveConfrontantDetails(values,id)} />
  {detailsFeature&&<FeatureDetailsPanel feature={detailsFeature} uf={place?.uf||projectData.uf} onClose={()=>setDetailsFeatureId(null)} />}
  {panel==='gleba'&&<GlebaPanel features={features} selected={selectedFeature} onClose={()=>setPanel(null)} onChoose={id=>setSelectedFeature(id)} onCreate={createGlebas} onExtractManual={extractDrawnGleba} onStyleFeature={styleFeatureById} onRemoveFeature={removeMapFeature} onDraw={async(kind,parentId)=>{if(!await changeTool(kind))return;glebaDrawingRef.current=kind;glebaParentRef.current=parentId;notify(kind==='polygon'?'Clique no mapa para desenhar a gleba manual.':'Desenhe a linha guia e finalize.');}}/>}
  {officialInfo&&infoExpanded&&<section className="map-official-details" aria-label="Dados de imóvel oficial"><header><strong>Dados oficiais · {officialInfo.layer}</strong><button onClick={()=>setInfoExpanded(false)} aria-label="Fechar detalhes"><X size={16}/></button></header>{officialInfo.loading&&<p className="map-official-progress" role="status">As fontes estão respondendo; os dados aparecem conforme cada consulta termina.</p>}{officialMetrics&&officialMetrics.areaM2>0&&<div className="map-official-area"><strong>Área da geometria retornada</strong><span>{(officialMetrics.areaM2/10000).toLocaleString('pt-BR',{maximumFractionDigits:4})} ha</span>{officialTarefa?<small>≈ {officialTarefa.replace(/\s+tarefas$/,'')} {officialTarefaUnit}</small>:officialInfo.uf&&<small>Conversão regional de tarefa não cadastrada · {officialInfo.uf}</small>}</div>}{officialInfo.sources.map(source=><article className={'map-official-source map-official-source--'+source.status} key={source.id}><header><strong>{source.group}</strong><span>{source.status==='loading'?'Consultando…':source.status==='found'?'Dados encontrados':source.status==='empty'?'Sem registro no ponto':'Fonte indisponível'}</span></header><small>{source.label}</small>{source.status==='loading'?<p role="status">Aguardando retorno desta fonte.</p>:source.status==='empty'?<p>Nenhum registro deste tipo foi informado neste ponto.</p>:source.status==='unavailable'?<p>Esta fonte não respondeu ou não disponibilizou um formato de consulta compatível agora.</p>:<dl>{Object.entries(source.attributes||{}).filter(([_,value])=>value!=null&&String(value).trim()).map(([key,value])=><div key={key}><dt>{key.replace(/_/g,' ')}</dt><dd>{String(value)}</dd></div>)}</dl>}</article>)}<p>Consulta: {officialInfo.lat.toFixed(6)}, {officialInfo.lng.toFixed(6)}</p>{!officialInfo.loading&&officialInfo.attributes&&<button className="map-primary" onClick={()=>void exportOfficialAt(officialInfo.lat,officialInfo.lng)}>Baixar pacote ZIP com dados e geometria disponível</button>}</section>}
  {mapContext&&<div className="map-feature-context" role="menu" aria-label={tool==='pan'?'Ações no mapa':`Ações da ferramenta ${mapToolLabels[tool]}`} style={{left:mapContext.x,top:mapContext.y}} onContextMenu={event=>event.preventDefault()}>
   <strong>{tool==='pan'?'Ações no mapa':`Ferramenta: ${mapToolLabels[tool]}`}</strong>
   <div className="map-context-coordinates" role="group" aria-label="Coordenadas do mapa"><span>{formatMapCoordinates(mapContext.lat,mapContext.lng)}</span><button type="button" aria-label="Copiar coordenadas" title="Copiar coordenadas" onClick={()=>void copyMapCoordinates(mapContext.lat,mapContext.lng)}><Copy size={14}/></button></div>
   {tool!=='pan'?tool==='point'?<button type="button" onClick={async()=>{if(await changeTool('pan',true)){setPointDialog(false);setMapContext(null);}}}>Concluir marcação de pontos</button>:<>
    {tool!=='rectangle'&&tool!=='circle'&&<button type="button" disabled={draft.length<(tool==='polygon'||tool==='arc'?3:2)} title={draft.length<(tool==='polygon'||tool==='arc'?3:2)?'Marque mais vértices para concluir.':undefined} onClick={()=>{setMapContext(null);endDrawingRef.current();}}><Check size={15}/>Finalizar desenho</button>}
    <button type="button" onClick={async()=>{if(await changeTool('pan',true)){setPointDialog(false);setMapContext(null);}}}>Cancelar ferramenta atual</button>
   </>:<>
    <button type="button" onClick={()=>{mapRef.current?.invalidateSize();baseLayers.current?.[mapMode].redraw();appliedRefs.current.forEach(t=>t.redraw());setMapContext(null);}}>Atualizar mapa</button>
    {officialLayers.some(layer=>layer.visible)&&<><button type="button" onClick={()=>{queryFeatureRef.current(L.latLng(mapContext.lat,mapContext.lng));setMapContext(null);}}>Identificar imóvel oficial</button><button type="button" onClick={()=>{void exportOfficialAt(mapContext.lat,mapContext.lng);setMapContext(null);}}>Baixar pacote ZIP · imóvel oficial</button></>}
    <button type="button" onClick={()=>setMapContext(null)}>Fechar</button>
   </>}
  </div>}
  {contextAt&&<div className="map-feature-context" role="menu" aria-label="Ações do polígono selecionado" style={{left:contextAt.x,top:contextAt.y}} onContextMenu={event=>event.preventDefault()}>
    <strong>Polígono selecionado</strong>
    <div className="map-context-coordinates" role="group" aria-label="Coordenadas do mapa"><span>{formatMapCoordinates(contextAt.lat,contextAt.lng)}</span><button type="button" aria-label="Copiar coordenadas" title="Copiar coordenadas" onClick={()=>void copyMapCoordinates(contextAt.lat,contextAt.lng)}><Copy size={14}/></button></div>
    <button onClick={()=>{setSelectedFeature(contextAt.id);setDetailsFeatureId(contextAt.id);setInfoExpanded(false);setPanel('layers');setContextAt(null);}}>Ver detalhes</button>
    <label className="map-context-color">Cor de preenchimento<input aria-label="Preenchimento do polígono" type="color" value={String(featureRef.current.find(f=>String(f.id)===contextAt.id)?.properties?.fillColor||'#f2c313')} onChange={e=>styleFeatureById(contextAt.id,{fillColor:e.target.value})}/></label>
    <label className="map-context-color">Cor da borda<input aria-label="Borda do polígono" type="color" value={String(featureRef.current.find(f=>String(f.id)===contextAt.id)?.properties?.strokeColor||'#efaf0e')} onChange={e=>styleFeatureById(contextAt.id,{strokeColor:e.target.value})}/></label>
    {renameDraft?.id===contextAt.id?<form className="map-context-rename" onSubmit={event=>{event.preventDefault();const name=renameDraft.name.trim();if(name)styleFeatureById(renameDraft.id,{name});setRenameDraft(null);setContextAt(null);}}><label>Nome da área<input autoFocus maxLength={180} value={renameDraft.name} onChange={event=>setRenameDraft({...renameDraft,name:event.target.value})}/></label><div><button type="submit" disabled={!renameDraft.name.trim()}>Salvar nome</button><button type="button" onClick={()=>setRenameDraft(null)}>Cancelar</button></div></form>:<button onClick={()=>{const f=featureRef.current.find(x=>String(x.id)===contextAt.id);if(f)setRenameDraft({id:contextAt.id,name:String(f.properties?.name||'Área')});}}>Renomear área</button>}
    <button onClick={()=>{const f=featureRef.current.find(x=>String(x.id)===contextAt.id);if(f?.geometry.type==='Polygon'){const bounds=L.geoJSON(f).getBounds();if(bounds.isValid())mapRef.current?.fitBounds(bounds,{padding:[90,90]});}setContextAt(null);}}>Aproximar ao polígono</button>
    <button title="Abrir a configuração da divisão antes de aplicar" onClick={()=>{setSelectedFeature(contextAt.id);setPanel('gleba');setContextAt(null);}}>Configurar divisão em glebas</button>
    <button onClick={()=>{setSelectedFeature(contextAt.id);setTerrainModal('frontback');setContextAt(null);}}>Classificar Frente / Fundo / Testadas</button>
    <button onClick={()=>{setSelectedFeature(contextAt.id);setTerrainModal('buffer');setContextAt(null);}}>Gerar Faixa Paralela / Buffer (m)</button>
    <button onClick={()=>{const id=contextAt.id;setFeatures(current=>{const next=current.map(f=>String(f.id)===id?reversePolygonRing(f):f);featureRef.current=next;return next;});setContextAt(null);notify('Sentido de caminhamento dos vértices invertido (Horário ↔ Anti-horário).');}}>Inverter sentido dos vértices</button>
    <button onClick={()=>{const f=featureRef.current.find(x=>String(x.id)===contextAt.id);if(f)downloadBytes(`surveyor-desenho-${f.id}.zip`,zipFiles({'dados.txt':Object.entries(f.properties||{}).map(([k,v])=>`${k}: ${String(v)}`).join('\n'),'feicao.geojson':JSON.stringify({type:'FeatureCollection',features:[f]},null,2),'feicao.kml':toKml([f]),'feicao.dxf':featuresToDxf([f]),'feicao.csv':toCsv([f]),'shapefile.zip':toShapefileZip([f])}));setContextAt(null);}}>Baixar pacote ZIP · desenho</button>
    <button className="map-context-danger" onClick={()=>{const id=contextAt.id;void requestConfirmation({title:'Remover elemento?',message:'Este elemento será removido do rascunho atual.',confirmLabel:'Remover elemento',destructive:true}).then(confirmed=>{if(!confirmed)return;setFeatures(current=>{const next=current.filter(f=>String(f.id)!==id);featureRef.current=next;return next;});setSelectedFeature(null);setEditingFeature(null);setContextAt(null);});}}>Remover polígono</button>
    <button className="map-context-close" onClick={()=>setContextAt(null)}>Fechar</button>
   </div>}
  {vertexMenu&&editingFeature===vertexMenu.id&&<div ref={vertexMenuElement} className="map-feature-context map-vertex-context" role="dialog" aria-label={`Aparência do vértice ${vertexMenu.index+1}`} style={{left:vertexMenu.x,top:vertexMenu.y}} onContextMenu={e=>e.preventDefault()}>
    <strong>Vértice V-{String(vertexMenu.index+1).padStart(2,'0')}</strong>
    <small>Aparência visual, sem modificar as coordenadas</small>
    <label className="map-context-color">Cor do marcador<input aria-label="Cor individual do vértice" type="color" value={getVertexAppearance(features.find(f=>String(f.id)===vertexMenu.id)?.properties,vertexMenu.index).color} onChange={e=>changeVertexAppearance(vertexMenu.id,vertexMenu.index,{color:e.target.value})}/></label>
    <label className="map-vertex-size">Tamanho: {getVertexAppearance(features.find(f=>String(f.id)===vertexMenu.id)?.properties,vertexMenu.index).size}px<input aria-label="Tamanho individual do vértice" type="range" min="8" max="28" step="1" value={getVertexAppearance(features.find(f=>String(f.id)===vertexMenu.id)?.properties,vertexMenu.index).size} onChange={e=>changeVertexAppearance(vertexMenu.id,vertexMenu.index,{size:Number(e.target.value)})}/></label>
    <button onClick={()=>{const f=featureRef.current.find(f=>String(f.id)===vertexMenu.id);if(f?.geometry.type!=='Polygon')return;const n=openRing(f.geometry.coordinates[0]).length;setFeatures(current=>{const next=current.map(item=>String(item.id)===vertexMenu.id?{...item,properties:copyVertexAppearanceToAll(item.properties,vertexMenu.index,n)}:item);featureRef.current=next;return next;});notify('Aparência aplicada aos vértices desta feição.');}}>Aplicar esta aparência a todos</button>
    <button onClick={()=>{const f=featureRef.current.find(f=>String(f.id)===vertexMenu.id);if(f?.geometry.type!=='Polygon')return;const coord=openRing(f.geometry.coordinates[0])[vertexMenu.index];if(!coord)return;void navigator.clipboard.writeText(`${coord[1].toFixed(7)}, ${coord[0].toFixed(7)}`).then(()=>notify('Latitude e longitude copiadas.')).catch(()=>notify('Não foi possível copiar as coordenadas.'));}}>Copiar coordenadas (lat, lon)</button>
    <button onClick={()=>changeVertexAppearance(vertexMenu.id,vertexMenu.index,null)}>Restaurar aparência do vértice</button>
    <button className="map-context-close" onClick={()=>setVertexMenu(null)}>Fechar</button>
   </div>}
  {pointDialog&&<PointDialog onClose={async()=>{await changeTool('pan',true);setPointDialog(false);}} onCreate={async(name,lat,lon)=>{if(!await changeTool('pan'))return;const f=feature('Point',[[lat,lon]]);f.properties={...f.properties,name,pointOrigin:'mapa',pointClass:'P',hasMonument:false};addFeature(f);setPointDialog(false);mapRef.current?.panTo([lat,lon]);}} onPlace={async()=>{if(!await changeTool('point'))return;setPointDialog(false);notify('Clique no mapa para marcar um ponto.');}} onImport={(file,classification)=>importPoints(file,classification)} />}
  <LayerCatalog uf={layerUF} modalOpen={modal==='catalog'} onClose={()=>setModal(null)} onUse={onOfficialAdd} existing={officialLayers.map(x=>x.id)}/>
  {modal==='import'&&<ImportDialog onClose={()=>setModal(null)} onImport={importFileFromDialog}/>}
  {modal==='verify'&&<ValidationDialog issues={validateIssues()} onClose={()=>setModal(null)}/>}
  {terrainModal&&<AdvancedTerrainModal tool={terrainModal} features={features} selectedFeatureId={selectedFeature} onSelectFeature={id=>setSelectedFeature(id)} onAddFeatures={items=>{setFeatures(current=>{const next=[...current,...items];featureRef.current=next;return next;});}} onUpdateFeature={(id,patch)=>{setFeatures(current=>{const next=current.map(f=>String(f.id)===id?{...f,...patch,properties:{...f.properties,...patch.properties}}:f);featureRef.current=next;return next;});}} onClose={()=>setTerrainModal(null)} notify={notify} />}
  {analysisOpen&&<SpatialAnalysis features={features} onClose={()=>setAnalysisOpen(false)} onOpenGleba={id=>{setAnalysisOpen(false);setSelectedFeature(id);setPanel('gleba');}} onClear={()=>{spatialOverlayRef.current?.remove();spatialOverlayRef.current=null;notify('Comparação visual removida.');}} onOverlay={(a,b)=>{const map=mapRef.current;if(!map)return;spatialOverlayRef.current?.remove();const group=L.layerGroup().addTo(map);spatialOverlayRef.current=group;const matches=[a,b].map(id=>features.find(f=>String(f.id)===id)).filter((f):f is MapFeature=>!!f);matches.forEach((f,i)=>L.geoJSON(f,{interactive:false,style:{color:i===0?'#2563eb':'#ed7100',weight:4,dashArray:i===0?'8 4':'4 3',fillOpacity:.10}}).addTo(group));const bounds=L.featureGroup(group.getLayers()).getBounds();if(bounds.isValid())map.fitBounds(bounds,{padding:[45,45]});setAnalysisOpen(false);notify('Perímetros A (azul) e B (laranja) sobrepostos visualmente. Os dados não foram alterados.');}} onFocus={id=>{setAnalysisOpen(false);setSelectedFeature(id);const f=features.find(item=>String(item.id)===id);if(f){const bounds=L.geoJSON(f as Feature).getBounds();if(bounds.isValid())mapRef.current?.fitBounds(bounds,{padding:[60,60],maxZoom:18});}}}/>}
   <div className="map-right-controls"><div className="map-compass-control map-compass-safe" role="img" aria-label="Orientação do mapa: norte para cima" title="Norte para cima"><span className="map-north-readonly" aria-hidden="true">N</span></div><button type="button" aria-label="Voltar ao enquadramento inicial do município" title="Voltar ao município" onClick={home}><Home size={19}/></button><button type="button" aria-label="Minha localização" title="Minha localização" onClick={locateUser}><LocateFixed size={20}/></button><button type="button" title="Aproximar" aria-label="Aproximar" onClick={()=>mapRef.current?.zoomIn()}><Plus size={22}/></button><button type="button" title="Afastar" aria-label="Afastar" onClick={()=>mapRef.current?.zoomOut()}><Minus size={22}/></button></div>
  <div className="map-mini-map" ref={miniMapElement} aria-label="Minimapa de localização"/>

  {(tool==='measure'&&draft.length>0||features.some(f=>String(f.id)===selectedFeature&&f.geometry.type==='LineString'&&f.properties?.name==='Medição'))&&<div className="map-measure-readout" role="status"><Ruler size={16}/><span>{tool==='measure'? 'Medindo distância' : 'Medição concluída'}</span><strong>{(()=>{
   const current=features.find(f=>String(f.id)===selectedFeature&&f.geometry.type==='LineString'&&f.properties?.name==='Medição');
   const path=tool==='measure'?[...draft,coords]:current?.geometry.type==='LineString'?current.geometry.coordinates.map(([lon,lat])=>[lat,lon] as [number,number]):[];
   return path.slice(1).reduce((sum,p,i)=>sum+haversine(path[i] as [number,number],p as [number,number]),0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2});
  })()} m</strong></div>}
  <div className="map-screenreader-context"><span role="status" aria-live="polite">{status}</span><span>Projeto: {projectName||place?.name} {place?.uf?`· ${place.uf}`:''}</span><span>Zoom {round(zoom,1)}</span><span>Coordenadas: {round(coords[0])}, {round(coords[1])}</span><span>{features.length} feições</span><span>{cloudSaved?'Na nuvem':'Rascunho local'}</span></div>
 </main>;
}
