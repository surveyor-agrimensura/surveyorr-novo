import {divisionPerimeter} from '../croqui/divisionPerimeter';
import {compositeArea, compositeBoundaryDivisions, compositeParts, compositePerimeter, compositeDivisionVertexName} from '../croqui/compositeMeasures';
import officialTemplate from './official-croqui-template.svg?raw';
import {tarefaCaption} from '../../lib/agrarianMeasure';
import {drawCustomCotas,normalizedCustomCotas,type CustomCota} from '../../lib/customCotas';
import {exteriorBoundaryRuns, visibleDimensionRuns, exteriorDimensionSvg} from '../../lib/cartographicAutomation';
import { distance, fmt, mapLayout, record, type SurveyPolygon, type MapLayout } from './memorialEngine';
import { groupConfrontations, polylineMidpoint, readConfrontation, neighborText, roadBoundaries, smoothRoadCenterline, svgPoints, openRoadEdgesSvg } from '../croqui/croquiGeometry';
import { placeCompactCroquiLabels, type TechnicalLabel } from '../croqui/labelLayout';
import {confrontantCaption} from '../croqui/confrontantCaption';
import {confrontantPinKey,uniqueConfrontantLabels,type ConfrontantPins} from '../../lib/confrontantVisualOrganizer';
import {divisionBounds, type ProjectDivision} from '../croqui/projectDivisions';
import { percentToFitZoomOffset, zoomToPercent } from '../../lib/percentZoom';
import {validGeoPoints,type OverlayGeoPoint} from '../../lib/mapOverlayCoordinates';
import {normalizeMapNames,type MapName} from '../croqui/sharedMapAppearance';

export type ElementKey = 'cotas' | 'gleba' | 'vertices' | 'confrontantes' | 'norte';
export type ElementConfig = { visible: boolean; size: number; color: string };
export type TechnicalLine = { id: string; from: number; start?: {x:number;y:number}; x: number; y: number; to?: number; color: string };
export type NeighborDetails = {property:string;owner:string;cpf:string;rg:string;showProperty:boolean;showOwner:boolean;showCpf:boolean;showRg:boolean;limitType?:string};
export type Easement = { id: string; visible?: boolean; points: {x:number;y:number}[]; geoPoints?: OverlayGeoPoint[]; color: string; width: number; widthMeters?:number; sourceEdges?: {left:{x:number;y:number}[];right:{x:number;y:number}[]} };
export type CroquiPhoto = {src:string;x:number;y:number;size:number;visible:boolean};
export type CroquiSettings = {
  background: 'satellite' | 'street' | 'cloudless' | 'none'; zoom: number; paper: 'A4'|'A3'; title: string; reference: string;
  technician: string; prefix: 'auto'|'V'|'P';
  elements: Record<ElementKey, ElementConfig>;
  names: string[]; neighbors: string[]; vertexOffsets: {dx:number;dy:number}[]; labelOffsets: Record<string,{dx:number;dy:number}>; labelAngles: Record<string,number>; neighborDetails: Record<string,NeighborDetails>; lines: TechnicalLine[]; easements: Easement[];
  mapNames:MapName[];hiddenVertices:number[];exteriorCotas:boolean;memorialExteriorCotas?:boolean;polygonFill:string;polygonFillOpacity:number;polygonStroke:string;polygonStrokeWidth:number;featureStyles?:Record<string,{fillColor?:string;fillOpacity?:number;strokeColor?:string;strokeWidth?:number}>;featureNames?:Record<string,string>;customCotas:CustomCota[];tarefaM2:number;labelColors:Record<string,string>;labelSizes?:Record<string,number>;absoluteLabels?:Record<string,{x:number;y:number}>;confrontantPins?:ConfrontantPins;
  backgroundOffsetX: number; backgroundOffsetY: number; autoAreaTitle?: boolean; photoOverlay?: CroquiPhoto;
  signature: string; signatureSize: number; signatureEnabled: boolean; zoomPreview: number; labelMode: 'smart'|'all';
  profile: 'custom'|'incra'|'ambiental'|'comercial'|'reurb';
  /** Versão da projeção do enquadramento, para migrar rótulos antigos sem deslocá-los. */
  frameVersion?: number;
  syncRevision?: number;
};
export const CROQUI_DIVISION_PALETTE=['#fff4cb','#dbeafe','#dcfce7','#fce7f3','#f3e8ff','#fef3c7'] as const;
const defaults: Record<ElementKey, ElementConfig> = {
  cotas: {visible:true,size:80,color:'#000000'},
  gleba: {visible:false,size:100,color:'#94a3b8'},
  vertices: {visible:true,size:80,color:'#000000'},
  confrontantes: {visible:true,size:100,color:'#000000'},
  norte: {visible:true,size:100,color:'#17212b'}
};
function boundedSettingNumber(value:unknown,min:number,max:number):number|undefined{
 if(typeof value!=='number'&&typeof value!=='string')return undefined;
 const number=Number(value);
 return Number.isFinite(number)?Math.max(min,Math.min(max,number)):undefined;
}
function normalizeFeatureStyles(value:unknown):NonNullable<CroquiSettings['featureStyles']>{
 const output=Object.create(null) as NonNullable<CroquiSettings['featureStyles']>;
 for(const [key,raw] of Object.entries(record(value))){
  const style=record(raw),safe:NonNullable<CroquiSettings['featureStyles']>[string]={};
  if(typeof style.fillColor==='string'&&/^#[0-9a-f]{6}$/i.test(style.fillColor))safe.fillColor=style.fillColor;
  if(typeof style.strokeColor==='string'&&/^#[0-9a-f]{6}$/i.test(style.strokeColor))safe.strokeColor=style.strokeColor;
  const fillOpacity=boundedSettingNumber(style.fillOpacity,0,1);
  const strokeWidth=boundedSettingNumber(style.strokeWidth,1,8);
  if(fillOpacity!==undefined)safe.fillOpacity=fillOpacity;
  if(strokeWidth!==undefined)safe.strokeWidth=strokeWidth;
  output[key]=safe;
 }
 return output;
}
function svgSettingNumber(value:unknown,fallback:number,min:number,max:number):number{
 return boundedSettingNumber(value,min,max)??fallback;
}
export function defaultCroquiSettings(technician=''): CroquiSettings {return {
  background:'satellite',zoom:15,paper:'A4',title:'PLANTA DO IMÓVEL RURAL',reference:'',technician,prefix:'auto',
  elements: structuredClone(defaults),names:[],neighbors:[],vertexOffsets:[],labelOffsets:{},labelAngles:{},hiddenVertices:[],mapNames:[],exteriorCotas:false,polygonFill:'#ff1616',polygonFillOpacity:0.24,polygonStroke:'#e20000',polygonStrokeWidth:2.4,featureStyles:{},featureNames:{},customCotas:[],tarefaM2:0,labelColors:{},labelSizes:{},absoluteLabels:{},confrontantPins:{},neighborDetails:{},lines:[],easements:[],signature:'',signatureSize:45,signatureEnabled:false,
  backgroundOffsetX:0,backgroundOffsetY:0,zoomPreview:100,labelMode:'smart',profile:'custom',frameVersion:2
};}
export function normalizeCroquiSettings(raw: unknown, technician=''): CroquiSettings {
 const def=defaultCroquiSettings(technician), s=record(raw), items=record(s.elements);
 const elements={} as CroquiSettings['elements'];
 (Object.keys(defaults) as ElementKey[]).forEach(k=>{
  const v=record(items[k]); elements[k]={visible:typeof v.visible==='boolean'?v.visible:def.elements[k].visible,
   size:Math.max(k==='cotas'?40:50,Math.min(250,Number(v.size)||def.elements[k].size)),color:validColor(v.color,def.elements[k].color)};
 });
 const fromArray=<T,>(v:unknown, pred:(x:unknown)=>x is T):T[]=>Array.isArray(v)?v.filter(pred):[];
 const isLine=(x:unknown):x is TechnicalLine=>{const r=record(x);return Number.isFinite(Number(r.from))&&Number.isFinite(Number(r.x))&&Number.isFinite(Number(r.y));};
 const isEasement=(x:unknown):x is Easement=>{const r=record(x);return Array.isArray(r.points)&&r.points.length>=2;};
 return {...def, ...s,frameVersion:Number(s.frameVersion)===2?2:1,
  backgroundOffsetX:Math.max(-180,Math.min(180,Number(s.backgroundOffsetX)||0)),
  backgroundOffsetY:Math.max(-180,Math.min(180,Number(s.backgroundOffsetY)||0)),
  zoom:Math.max(8,Math.min(25,Number(s.zoom)||15)), zoomPreview:Math.max(40,Math.min(180,Number(s.zoomPreview)||100)),
  paper:s.paper==='A3'?'A3':'A4',background:s.background==='none'?'none':s.background==='street'?'street':'satellite',
  prefix:s.prefix==='P'?'P':s.prefix==='V'?'V':'auto',
  profile:['incra','ambiental','comercial','reurb'].includes(String(s.profile))?s.profile as CroquiSettings['profile']:'custom',
  labelMode:s.labelMode==='all'?'all':'smart',
  title:String(s.title||def.title),reference:String(s.reference||''),technician:String(s.technician??technician),
  elements, names:Array.isArray(s.names)?s.names.map(String):[],neighbors:Array.isArray(s.neighbors)?s.neighbors.map(neighborText):[],
  vertexOffsets:Array.isArray(s.vertexOffsets)?s.vertexOffsets.map(value=>({dx:clampCoord(record(value).dx),dy:clampCoord(record(value).dy)})):[],
  labelOffsets:Object.fromEntries(Object.entries(record(s.labelOffsets)).map(([k,v])=>[k,{dx:clampCoord(record(v).dx),dy:clampCoord(record(v).dy)}])),
  labelAngles:Object.fromEntries(Object.entries(record(s.labelAngles)).map(([k,v])=>[k,Math.max(-180,Math.min(180,Number(v)||0))])),
  mapNames:normalizeMapNames(s.mapNames),exteriorCotas:s.exteriorCotas===true,memorialExteriorCotas:typeof s.memorialExteriorCotas==='boolean'?s.memorialExteriorCotas:undefined,hiddenVertices:Array.isArray(s.hiddenVertices)?s.hiddenVertices.filter((v:unknown)=>Number.isInteger(v)&&Number(v)>=0).map(Number):[],polygonFill:validColor(s.polygonFill,def.polygonFill),polygonFillOpacity:Number.isFinite(Number(s.polygonFillOpacity))?Math.max(0,Math.min(1,Number(s.polygonFillOpacity))):def.polygonFillOpacity,polygonStroke:validColor(s.polygonStroke,def.polygonStroke),polygonStrokeWidth:Math.max(1,Math.min(10,Number(s.polygonStrokeWidth)||2.4)),featureStyles:normalizeFeatureStyles(s.featureStyles),featureNames:Object.fromEntries(Object.entries(record(s.featureNames)).map(([k,v])=>[k,String(v).slice(0,120)])),customCotas:normalizedCustomCotas(s.customCotas),tarefaM2:Math.max(0,Number(s.tarefaM2)||0),labelColors:Object.fromEntries(Object.entries(record(s.labelColors)).map(([k,v])=>[k,validColor(v,'#17212b')])),labelSizes:Object.fromEntries(Object.entries(record(s.labelSizes)).map(([k,v])=>[k,Math.max(40,Math.min(250,Number(v)||100))])),absoluteLabels:Object.fromEntries(Object.entries(record(s.absoluteLabels)).filter(([,v])=>Number.isFinite(Number(record(v).x))&&Number.isFinite(Number(record(v).y))).map(([key,v])=>[key,{x:clampCoord(record(v).x),y:clampCoord(record(v).y)}])),confrontantPins:Object.fromEntries(Object.entries(record(s.confrontantPins)).filter(([,v])=>Number.isFinite(Number(record(v).x))&&Number.isFinite(Number(record(v).y))).map(([key,v])=>[key,{x:clampCoord(record(v).x),y:clampCoord(record(v).y)}])),
  neighborDetails:Object.fromEntries(Object.entries(record(s.neighborDetails)).map(([k,v])=>{const o=record(v);return [k,{property:String(o.property||''),owner:String(o.owner||''),cpf:String(o.cpf||''),rg:String(o.rg||''),showProperty:o.showProperty===true,showOwner:o.showOwner===true,showCpf:o.showCpf===true,showRg:o.showRg===true,limitType:String(o.limitType||'')}];})),
  lines:fromArray(s.lines,isLine),easements:fromArray(s.easements,isEasement).map(r=>({...r,visible:r.visible!==false,width:Math.max(8,Math.min(90,Number(r.width)||18)),points:r.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),geoPoints:validGeoPoints(r.geoPoints)?r.geoPoints:undefined,widthMeters:Number.isFinite(Number(r.widthMeters))&&Number(r.widthMeters)>0?Number(r.widthMeters):undefined})),
  photoOverlay:normalizeCroquiPhoto(s.photoOverlay),
  signature:String(s.signature||''),signatureSize:Math.max(20,Math.min(110,Number(s.signatureSize)||45)),signatureEnabled:s.signatureEnabled===true
 };
}
/** Foto sobreposta independente do mapa de satélite: nunca altera a projeção geográfica. */
export function normalizeCroquiPhoto(value:unknown):CroquiPhoto|undefined{
 const photo=record(value);
 if(typeof photo.src!=='string'||!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(photo.src))return undefined;
 const size=Math.max(40,Math.min(360,Number(photo.size)||120));
 return {src:photo.src,x:Math.max(44,Math.min(1156-size,Number(photo.x)||880)),y:Math.max(74,Math.min(664-size,Number(photo.y)||105)),size,visible:photo.visible!==false};
}
/** O croqui tem viewBox de 1200px. Um confrontante longo pode ser movido
 * centenas de pixels para fora do polígono. O antigo limite de 150px
 * mutilava o deslocamento AO LER a configuração salva, fazendo o memorial
 * exibir uma posição diferente da escolhida no editor.
 */
function clampCoord(value:unknown){
 const n=Number(value);
 return Number.isFinite(n)?Math.max(-1400,Math.min(1400,n)):0;
}
function validColor(value:unknown,fallback:string) {return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;}
const esc=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const fixed=(value:number)=>value.toFixed(2);
const MAP={x:44,y:74,w:1112,h:590};
export const croquiVertexNames=(poly:SurveyPolygon,s:CroquiSettings)=>{
 const p=record(poly.properties);
 const type=String(p.vertexType||p.pointType||p.tipoPonto||p.pointKind||p.markerType||'').toLowerCase();
 const isPoint=['p','ponto','point','imported-point','importado'].includes(type)||p.isImportedPoint===true||p.isPoint===true;
 const prefix=s.prefix==='auto'?(isPoint?'P':'V'):s.prefix;
 return poly.vertices.map((_,i)=>s.names[i]?.trim()||`${prefix}-${String(i+1).padStart(2,'0')}`);
};
function mapFramePolygon(poly:SurveyPolygon,divisions:readonly ProjectDivision[]):SurveyPolygon{
 // A mesma extensão geográfica é usada nos dois algoritmos de zoom, inclusive
 // quando existem múltiplas glebas. Não muda a ordem dos vértices originais.
 const bounds=divisions.length>1?divisionBounds(divisions):[];
 return bounds.length?{...poly,vertices:[...poly.vertices,...bounds]}:poly;
}
/** Projeção legada, usada exclusivamente para migrar rótulos já salvos em pixels. */
export function legacyLayoutForCroqui(poly:SurveyPolygon,s:CroquiSettings,divisions:readonly ProjectDivision[]=[]):MapLayout{
 const frame=mapFramePolygon(poly,divisions);
 const offset=percentToFitZoomOffset(zoomToPercent(s.zoom));
 const layout=mapLayout(frame,MAP.w,MAP.h,offset,s.background==='none'?'street':s.background,19);
 return {...layout,points:layout.points.slice(0,poly.vertices.length)};
}
/** Enquadramento contínuo: o desenho ocupa a folha como na Prancha Técnica.
 * Uma escala inicial inteira só determina o mosaico raster; o ajuste real é
 * calculado com a extensão projetada dos vértices, sem degraus de zoom. */
export function layoutForCroqui(poly:SurveyPolygon,s:CroquiSettings,divisions:readonly ProjectDivision[]=[]):MapLayout {
 const frame=mapFramePolygon(poly,divisions);
 const background=s.background==='none'?'street':s.background;
 const initial=mapLayout(frame,MAP.w,MAP.h,0,background,19);
 const xs=initial.points.map(p=>p.x),ys=initial.points.map(p=>p.y);
 const spanX=Math.max(...xs)-Math.min(...xs),spanY=Math.max(...ys)-Math.min(...ys);
 const desiredX=MAP.w*.70,desiredY=MAP.h*.76;
 const factor=Math.min(desiredX/Math.max(.001,spanX),desiredY/Math.max(.001,spanY));
 const fitOffset=Math.log2(Math.max(.125,Math.min(8,factor)));
 const relativeZoom=percentToFitZoomOffset(zoomToPercent(s.zoom));
 const result=mapLayout(frame,MAP.w,MAP.h,fitOffset+relativeZoom,background,19);
 return {...result,points:result.points.slice(0,poly.vertices.length)};
}

export function frameCoordinates(map:MapLayout) {return map.points.map(p=>({x:p.x+MAP.x,y:p.y+MAP.y}));}
/** Gera duas extensões externas independentes, jamais uma ligação entre os vértices. */
export function exteriorGuidePair(poly:SurveyPolygon,s:CroquiSettings,segment:number,length=85,divisions:readonly ProjectDivision[]=[]){
 const pts=frameCoordinates(layoutForCroqui(poly,s,divisions));if(pts.length<3)return [];
 const i=Math.max(0,Math.min(pts.length-1,segment)),j=(i+1)%pts.length;
 const a=pts[i],b=pts[j],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
 const signedArea=pts.reduce((sum,v,k)=>{const q=pts[(k+1)%pts.length];return sum+v.x*q.y-q.x*v.y;},0);
 const sign=signedArea>0?1:-1, nx=sign*dy/len,ny=-sign*dx/len;
 return [i,j].map(from=>({from,x:pts[from].x+nx*length,y:pts[from].y+ny*length}));
}
export function renderCroqui(poly:SurveyPolygon,settings:CroquiSettings,info:{company:string;mapLink:string;municipality:string;logo?:string;date?:string;qr?:string;owners?:string[];propertyName?:string;glebas?:SurveyPolygon[];divisions?:readonly ProjectDivision[];markers?:number[];editing?:boolean;composite?:boolean;areaSettings?:Record<string,CroquiSettings>;uf?:string}):string {
 const s=settings, map=layoutForCroqui(poly,s,info.divisions), pts=frameCoordinates(map), names=croquiVertexNames(poly,s);
 const area=pts.reduce((a,p,i)=>{const n=pts[(i+1)%pts.length];return a+p.x*n.y-n.x*p.y;},0);
 const outwardSign=area>0?1:-1;
 const polygon=pts.map(p=>`${fixed(p.x)},${fixed(p.y)}`).join(' ');
 const images=s.background==='none'?'':map.tiles.map(t=>`<image href="${esc(t.url)}" x="${fixed(MAP.x+t.left)}" y="${fixed(MAP.y+t.top)}" width="${fixed(t.tileSize||256)}" height="${fixed(t.tileSize||256)}" preserveAspectRatio="none" />`).join('');
 const opt=s.elements;
 // As cotas de gleba só aparecem quando existem subdivisões criadas no editor do mapa.
 const mercator=(vertex:readonly [number,number])=>{
   const z=256*2**map.zoom;
   const lat=Math.max(-85,Math.min(85,vertex[1]))*Math.PI/180;
   return {x:(vertex[0]+180)/360*z,y:(1-Math.asinh(Math.tan(lat))/Math.PI)/2*z};
 };
 const origin=mercator(poly.vertices[0]);
 const plot=(vertex:readonly [number,number])=>{const a=mercator(vertex);return {x:pts[0].x+a.x-origin.x,y:pts[0].y+a.y-origin.y};};
 // As geometrias das glebas do projeto são renderizadas individualmente.
 // Mesmo quando o perímetro principal possui um preenchimento sólido, os limites
 // internos ficam sobre o preenchimento e continuam visíveis nos PDFs/SVGs.
 const divisions=info.divisions||[];
 const composite=info.composite===true&&divisions.length>1;
 const divisionPerim=divisionPerimeter;
 const divisionPalette=CROQUI_DIVISION_PALETTE;
 const closedPath=(rings:{x:number;y:number}[][])=>rings.map(ring=>ring.length>=3?'M '+ring.map(p=>`${fixed(p.x)} ${fixed(p.y)}`).join(' L ')+' Z':'').join(' ');
 const divisionArtwork=divisions.length>1?divisions.map((part,index)=>{
  const paths=closedPath(part.rings.map(ring=>ring.map(plot)));
  if(!paths.trim())return '';
  const isActivePart=!composite&&part.featureId===String(poly.properties.sourceFeatureId||poly.id)&&part.partIndex===Number(poly.properties.partIndex||0);
  const partId=part.partIndex===0?part.featureId:`${part.featureId}:parte-${part.partIndex+1}`;
  const partS=info.areaSettings?.[partId]||s;
  const fStyle=s.featureStyles?.[partId]||s.featureStyles?.[part.featureId]||{};
  const customColor=(fStyle.fillColor&&/^#[0-9a-f]{6}$/i.test(fStyle.fillColor)?fStyle.fillColor:(part.color&&/^#[0-9a-f]{6}$/i.test(part.color)?part.color:''));
  const strokeColor=fStyle.strokeColor&&/^#[0-9a-f]{6}$/i.test(fStyle.strokeColor)?fStyle.strokeColor:'#17212b';
  const strokeW=svgSettingNumber(fStyle.strokeWidth,2.6,1,8);
  const fillOpacity=svgSettingNumber(fStyle.fillOpacity,s.background==='none'?.78:.24,0,1);
  const fill=customColor||divisionPalette[index%divisionPalette.length];
  // Sem inferir 'área base' por quantidade de vértices: uma gleba sem preenchimento
  // também é um polígono selecionável. Somente categorias explícitas de contorno geral não recebem cor.
  const isBase=/^(?:per[ií]metro geral|[ií]movel completo|[aá]rea total)$/.test(part.category.trim().toLowerCase());
  const plotted=part.rings[0].map(plot);
  const centroid=Number.isFinite(part.labelLon)&&Number.isFinite(part.labelLat)?plot([part.labelLon!,part.labelLat!]):plotted.reduce((o,p)=>({x:o.x+p.x/plotted.length,y:o.y+p.y/plotted.length}),{x:0,y:0});
  const divLabelOffset=s.labelOffsets?.[partId]||s.labelOffsets?.[part.featureId]||{dx:0,dy:0};
  const absoluteName=s.absoluteLabels?.[partId];
  const labelPos={x:(absoluteName?.x??centroid.x)+divLabelOffset.dx,y:(absoluteName?.y??centroid.y)+divLabelOffset.dy};
  const pM=divisionPerim(part);
  const areaNameScale=(s.labelSizes?.[partId]??100)/100;
  const areaNameColor=validColor(s.labelColors?.[partId],'#000000');
  const areaNameAngle=s.labelAngles?.[partId]??0;
  const areaName=divisions.length>1&&!isBase?`<text data-croqui-label="${esc(partId)}" data-division-name="${esc(partId)}" x="${fixed(labelPos.x)}" y="${fixed(labelPos.y)}" transform="rotate(${fixed(areaNameAngle)} ${fixed(labelPos.x)} ${fixed(labelPos.y)})" font-size="${fixed(10.2*areaNameScale)}" font-weight="700" text-anchor="middle" fill="${esc(areaNameColor)}" style="cursor:grab;user-select:none;touch-action:none"><tspan x="${fixed(labelPos.x)}" dy="${fixed(-4*areaNameScale)}">${esc((s.featureNames?.[partId]||part.name).slice(0,32))}</tspan><tspan x="${fixed(labelPos.x)}" dy="${fixed(12.5*areaNameScale)}" font-size="${fixed(8.8*areaNameScale)}" font-weight="600" fill="${esc(areaNameColor)}">${fmt(part.areaM2/10000,4)} ha · ${fmt(pM,2)} m${tarefaCaption(part.areaM2,info.uf||'',s.tarefaM2)?` · ${tarefaCaption(part.areaM2,info.uf||'',s.tarefaM2)}`:''}</tspan></text>`:'';
  const ringSigned=plotted.reduce((sum,v,i)=>{const next=plotted[(i+1)%plotted.length];return sum+v.x*next.y-next.x*v.y;},0);
  const side=ringSigned>0?1:-1;
  const positionLabel=(key:string,x:number,y:number,caption:string,font:number,baseColor:string,rotation=0,partAppearance?:CroquiSettings)=>{
   // Um confronto pertence à sua gleba, mas continua aceitando os estilos globais antigos.
   const offset=partAppearance?.labelOffsets[key]||s.labelOffsets[key]||{dx:0,dy:0};
   const a=partAppearance?.labelAngles[key]??s.labelAngles[key]??rotation;
   const anchor=partAppearance?.absoluteLabels?.[key]||s.absoluteLabels?.[key];
   const px=(anchor?.x??x)+offset.dx,py=(anchor?.y??y)+offset.dy;
   const size=partAppearance?.labelSizes?.[key]??s.labelSizes?.[key]??100;
   const color=partAppearance?.labelColors[key]||s.labelColors[key]||baseColor;
   return `<text data-croqui-label="${esc(key)}" data-croqui-visual-y="${fixed(py)}" x="${fixed(px)}" y="${fixed(py)}" font-size="${fixed(font*size/100)}" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(${fixed(a)} ${fixed(px)} ${fixed(py)})" fill="${esc(color)}" style="cursor:grab;user-select:none;pointer-events:all;touch-action:none">${esc(caption)}</text>`;
  };
  const keyPrefix=`division:${part.featureId}:${part.partIndex}`;
  const partNames=part.rings[0].map((_,i)=>partS.names[i]?.trim()||`${partS.prefix==='P'?'P':partS.prefix==='auto'&&part.properties?.isImportedPoint===true?'P':'V'}-${String(i+1).padStart(2,'0')}`);
   const partOpt=partS.elements;
   const directCotas=!composite?drawCustomCotas(s.customCotas,partId,part.rings[0],plot,'#0f766e',false,{colors:s.labelColors,angles:s.labelAngles,sizes:s.labelSizes,offsets:s.labelOffsets}):'';
   const extraMarks=composite?plotted.map((v,k)=>{
   const next=plotted[(k+1)%plotted.length];const prev=plotted[(k+plotted.length-1)%plotted.length];
   const dx=next.x-v.x,dy=next.y-v.y,len=Math.hypot(dx,dy)||1;
   const vx=2*v.x-prev.x-next.x,vy=2*v.y-prev.y-next.y,vl=Math.hypot(vx,vy)||1;
    const marks=partOpt.vertices.visible&&!partS.hiddenVertices.includes(k)?`<circle data-croqui-area-vertex="${esc(partId)}:${k}" cx="${fixed(v.x)}" cy="${fixed(v.y)}" r="3" fill="#000000" stroke="#ffffff" stroke-width="1.3" pointer-events="none"/>${positionLabel(`${keyPrefix}:vertex:${k}`,v.x+vx/vl*13,v.y+vy/vl*13,partNames[k],Math.max(7,9*partOpt.vertices.size/100),partOpt.vertices.color,0,partS)}`:'';
   const mx=(v.x+next.x)/2,my=(v.y+next.y)/2;
    const cota=!composite&&opt.cotas.visible&&!s.exteriorCotas&&len>34?positionLabel(`${keyPrefix}:cota:${k}`,mx-side*dy/len*12,my+side*dx/len*12,`${fmt(distance(part.rings[0][k],part.rings[0][(k+1)%plotted.length]),1)} m`,Math.max(6.5,8*opt.cotas.size/100),opt.cotas.color):'';
   return marks+cota;
  }).join(''):'';
  const holeMarks=composite&&partOpt.vertices.visible?part.rings.slice(1).flatMap((ring,holeIndex)=>{
   const ringIndex=holeIndex+1,points=ring.map(plot);
   return points.map((point,k)=>{
    const before=points[(k+points.length-1)%points.length],after=points[(k+1)%points.length];
    const vx=(point.x-before.x)+(point.x-after.x),vy=(point.y-before.y)+(point.y-after.y),length=Math.hypot(vx,vy)||1;
    const key=`${keyPrefix}:ring:${ringIndex}:vertex:${k}`;
    const name=compositeDivisionVertexName(index,ringIndex,k);
    return `<circle data-croqui-hole-vertex="${esc(partId)}:${ringIndex}:${k}" cx="${fixed(point.x)}" cy="${fixed(point.y)}" r="3" fill="#000000" stroke="#ffffff" stroke-width="1.3" pointer-events="none"/>${positionLabel(key,point.x+vx/length*13,point.y+vy/length*13,name,Math.max(7,9*partOpt.vertices.size/100),partOpt.vertices.color,0,partS)}`;
   });
  }).join(''):'';
  // No imóvel completo, os confrontantes são cadastrados por aresta, mas
  // identificados uma única vez por trecho contínuo de mesma confrontação.
  const divisionNeighbors=composite&&opt.confrontantes.visible?uniqueConfrontantLabels(groupConfrontations(
   part.rings[0].map((_,k)=>partS.neighbors[k]??readConfrontation(part.properties||{},k,plotted.length))
  )).map(group=>{
   const middle=polylineMidpoint(plotted,group.indices);if(!middle)return '';
   const {point,direction}=middle;
   const len=Math.hypot(direction.x,direction.y)||1;
   const detail=group.indices.map(k=>partS.neighborDetails[String(k)]).find(Boolean)||{};
   const caption=confrontantCaption(group.label,detail).text.replace(/\n/g,' · ').slice(0,100);
   const pin=partS.confrontantPins?.[confrontantPinKey(group.label,`${keyPrefix}:`)];
   return positionLabel(`${keyPrefix}:neighbor:${group.start}`,pin?.x??point.x-side*direction.y/len*29,pin?.y??point.y+side*direction.x/len*29,caption,Math.max(6.5,8*opt.confrontantes.size/100),opt.confrontantes.color,0,partS);
  }).join(''):'';
  if(isActivePart)return areaName;
  return `<path data-croqui-division="${esc(partId)}" data-division-part="${part.partIndex}" d="${paths}" fill="${isBase?'transparent':esc(fill)}" fill-rule="evenodd" fill-opacity="${isBase?0:fillOpacity}" stroke="${esc(strokeColor)}" stroke-width="${strokeW}" stroke-linejoin="round" pointer-events="all" style="cursor:context-menu;"/>${areaName}${extraMarks}${holeMarks}${divisionNeighbors}${directCotas}`;
 }).join(''):'';
 const mapNames=(s.mapNames||[]).map(item=>{const pos=plot([item.lon,item.lat]);
  return `<text data-croqui-label="map-name:${esc(item.id)}" x="${fixed(pos.x)}" y="${fixed(pos.y)}" text-anchor="middle" dominant-baseline="middle" font-size="${fixed(item.size)}" font-weight="600" fill="${esc(item.color)}" transform="rotate(${fixed(item.angle)} ${fixed(pos.x)} ${fixed(pos.y)})" style="cursor:grab;user-select:none;touch-action:none">${esc(item.text)}</text>`;
 }).join('');
 const ownCotas=!composite?drawCustomCotas(s.customCotas,String(poly.id),poly.vertices,plot,'#0f766e',false,{colors:s.labelColors,angles:s.labelAngles,sizes:s.labelSizes,offsets:s.labelOffsets}):'';
 const selectedPrimary=divisions.find(part=>part.featureId===String(poly.properties.sourceFeatureId||poly.id)&&part.partIndex===Number(poly.properties.partIndex||0));
 const selectedPath=selectedPrimary?closedPath(selectedPrimary.rings.map(ring=>ring.map(plot))):closedPath([poly.vertices,...(poly.holes||[])].map(ring=>ring.map(plot)));
 const polyFill=validColor(s.polygonFill,String(poly.properties.fillColor||poly.properties.lotColor||'#ff1616'));
 const polyStroke=validColor(s.polygonStroke,String(poly.properties.strokeColor||poly.properties.lotColor||'#e20000'));
 const polygonFillOpacity=svgSettingNumber(s.polygonFillOpacity,0.24,0,1);
 const polygonStrokeWidth=svgSettingNumber(s.polygonStrokeWidth,2.4,1,10);
 const polyCentroid = pts.reduce((acc, pt) => ({ x: acc.x + pt.x / pts.length, y: acc.y + pt.y / pts.length }), { x: 0, y: 0 });
 const areaLabelOffset = s.labelOffsets?.['area:polygon'] || { dx: 0, dy: 0 };
 const propertyAnchor=s.absoluteLabels?.['area:polygon']||polyCentroid;
 let areaCenter = { x: propertyAnchor.x + areaLabelOffset.dx, y: propertyAnchor.y + areaLabelOffset.dy };
 // O rótulo automático do título não pode encobrir confrontantes e cotas.
 // Posições arrastadas manualmente na prancha/croqui continuam soberanas.
 if(!s.labelOffsets?.['area:polygon']&&(s.autoAreaTitle===true||!s.absoluteLabels?.['area:polygon'])){
  const occupied=pts.map(p=>({x:p.x,y:p.y}));
  const corners=[{x:MAP.x+MAP.w*.24,y:MAP.y+MAP.h*.16},{x:MAP.x+MAP.w*.76,y:MAP.y+MAP.h*.16},
   {x:MAP.x+MAP.w*.24,y:MAP.y+MAP.h*.86},{x:MAP.x+MAP.w*.76,y:MAP.y+MAP.h*.86}];
  const distanceToPolygon=(pos:{x:number;y:number})=>Math.min(...occupied.map(p=>Math.hypot(pos.x-p.x,pos.y-p.y)));
  if(distanceToPolygon(areaCenter)<70){areaCenter=corners.sort((a,b)=>distanceToPolygon(b)-distanceToPolygon(a))[0];}
 }
 const propertyAngle=s.labelAngles?.['area:polygon']||0;
 const propertyColor=validColor(s.labelColors?.['area:polygon'],'#000000');
 const propertySize=(s.labelSizes?.['area:polygon']||100)/100;
 // Nome e medidas são dois rótulos independentes: reduzir a área/perímetro
 // não deve encolher também o nome do sítio (ou vice-versa).
 const areaMetricsKey='area:metrics';
 const metricsOffset=s.labelOffsets?.[areaMetricsKey]||{dx:0,dy:0};
 const metricsAnchor=s.absoluteLabels?.[areaMetricsKey]||{x:areaCenter.x,y:areaCenter.y+Math.max(11,13*propertySize)};
 const metricsCenter={x:metricsAnchor.x+metricsOffset.dx,y:metricsAnchor.y+metricsOffset.dy};
 const metricsSize=(s.labelSizes?.[areaMetricsKey]??100)/100;
 const metricsAngle=s.labelAngles?.[areaMetricsKey]??0;
 const metricsColor=validColor(s.labelColors?.[areaMetricsKey],'#000000');
 const polyAreaBadge = `<text data-croqui-label="area:polygon" x="${fixed(areaCenter.x)}" y="${fixed(areaCenter.y)}" transform="rotate(${fixed(propertyAngle)} ${fixed(areaCenter.x)} ${fixed(areaCenter.y)})" font-size="${fixed(11*propertySize)}" font-weight="700" text-anchor="middle" fill="${esc(propertyColor)}" style="cursor:grab;user-select:none;touch-action:none">${esc(info.propertyName?.trim() || poly.name || 'Área do Imóvel')}</text><text data-croqui-label="area:metrics" x="${fixed(metricsCenter.x)}" y="${fixed(metricsCenter.y)}" transform="rotate(${fixed(metricsAngle)} ${fixed(metricsCenter.x)} ${fixed(metricsCenter.y)})" font-size="${fixed(9.2*metricsSize)}" font-weight="600" text-anchor="middle" fill="${esc(metricsColor)}" style="cursor:grab;user-select:none;touch-action:none">${fmt(poly.areaM2/10000,4)} ha · ${fmt(poly.perimeterM,2)} m</text>`;
 const activeArtwork=composite?'':selectedPath
  ?`<path data-croqui-polygon="true" d="${selectedPath}" fill="${esc(polyFill)}" fill-rule="evenodd" fill-opacity="${polygonFillOpacity}" stroke="${esc(polyStroke)}" stroke-width="${polygonStrokeWidth}"/>`
  :`<polygon data-croqui-polygon="true" points="${polygon}" fill="${esc(polyFill)}" fill-opacity="${polygonFillOpacity}" stroke="${esc(polyStroke)}" stroke-width="${polygonStrokeWidth}"/>`;
 const seenGlebaEdges=new Set<string>();
 const glebas=opt.gleba.visible?(info.glebas||[]).flatMap(g=>{
   const vertices=g.vertices.map(plot);
   if(vertices.length<3)return [];
   const gSigned=vertices.reduce((acc,v,k)=>{const q=vertices[(k+1)%vertices.length];return acc+v.x*q.y-q.x*v.y;},0),gSign=gSigned>0?1:-1;
   const outline=vertices.map(v=>`${fixed(v.x)},${fixed(v.y)}`).join(' ');
   const labels=vertices.map((v,i)=>{
     const n=vertices[(i+1)%vertices.length],dx=n.x-v.x,dy=n.y-v.y,len=Math.hypot(dx,dy);
     if(len<32)return '';
     const va=g.vertices[i],vb=g.vertices[(i+1)%g.vertices.length];
     const edgeKey=[`${va[0].toFixed(6)},${va[1].toFixed(6)}`,`${vb[0].toFixed(6)},${vb[1].toFixed(6)}`].sort().join('|');
     if(seenGlebaEdges.has(edgeKey))return '';
     seenGlebaEdges.add(edgeKey);
     const inx=-gSign*dy/len,iny=gSign*dx/len;
     const key=`gleba-cota:${g.id}:${i}`;
     const shift=s.labelOffsets[key]||{dx:0,dy:0};
     const x=(v.x+n.x)/2+inx*9+shift.dx,y=(v.y+n.y)/2+iny*9+shift.dy;
     const rawAng=Math.atan2(dy,dx)*180/Math.PI;
     const ang=s.labelAngles[key]??(rawAng>90?rawAng-180:rawAng< -90?rawAng+180:rawAng);
     const size=Math.max(6.8,9*opt.gleba.size/100)*(s.labelSizes?.[key]??100)/100;
     const color=s.labelColors[key]||opt.gleba.color;
     return `<text data-croqui-label="${esc(key)}" x="${fixed(x)}" y="${fixed(y)}" transform="rotate(${fixed(ang)} ${fixed(x)} ${fixed(y)})" font-size="${fixed(size)}" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${esc(color)}" paint-order="stroke" style="cursor:grab;user-select:none;touch-action:none">${esc(fmt(distance(va,vb),1))} m</text>`;
   }).join('');
   return [`<g><polygon points="${outline}" fill="none" stroke="${esc(opt.gleba.color)}" stroke-width="1.5" stroke-dasharray="4 3"/>${labels}</g>`];
 }).join(''):'';
 const dimensionPoint=(key:string,x:number,y:number)=>{const offset=s.labelOffsets?.[key]||{dx:0,dy:0};return {x:x+offset.dx,y:y+offset.dy};};
 const dimensionRotation=(key:string,automatic:number)=>{const custom=s.labelAngles?.[key];return Number.isFinite(custom)?custom:automatic;};
 // Construímos primeiro o inventário integral de rótulos, preservando as cotas exatas.
 // A distribuição inteligente reorganiza o texto sem modificar medidas, vértices ou linhas.
 const textLabels:TechnicalLabel[]=[];
 const cotaSegments:string[]=[];
 const circles:string[]=[];
 const crowded=pts.length>24;
 // Rótulos menores em perímetros com muitos vértices, mantendo o ajuste manual de tamanho.
 const densityScale=pts.length>=36?.65:pts.length>=22?.73:pts.length>=12?.82:.93;
 if(!composite)pts.forEach((p,i)=>{
  const q=pts[(i+1)%pts.length],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;
  const nx=outwardSign*dy/len,ny=-outwardSign*dx/len;
  const n={x:nx,y:ny},t={x:dx/len,y:dy/len};
  // Cotas mais próximas da linha do imóvel, traços finos e textos compactos.
  const d=crowded?7.5:10,ax=p.x+nx*d,ay=p.y+ny*d,bx=q.x+nx*d,by=q.y+ny*d;
  const mx=(ax+bx)/2,my=(ay+by)/2;
  const deg=Math.atan2(dy,dx)*180/Math.PI;
  const textAngle=deg>90?deg-180:deg< -90?deg+180:deg;
  const c=opt.cotas,value=`${fmt(distance(poly.vertices[i],poly.vertices[(i+1)%poly.vertices.length]),1)} m`;
  const cFont=Math.max(3.1,Math.max(4.0,Math.min(8,len*.3))*(c.size/100)*(crowded?.86:1)*densityScale);
  const pos=dimensionPoint(`cota:${i}`,mx+nx*(crowded?4.5:6),my+ny*(crowded?4.5:6));
  if(c.visible&&!s.exteriorCotas){
   // Em curvas densas ou trechos muito curtos, suprime a linha de cota para não poluir
   if(!crowded||len>=24){
    cotaSegments.push(`<g stroke="${esc(c.color)}" stroke-width="${crowded?'.68':'.9'}" fill="none"><title>Trecho ${esc(names[i])} a ${esc(names[(i+1)%pts.length])}: ${esc(value)}</title><path d="M ${fixed(p.x)} ${fixed(p.y)} L ${fixed(ax)} ${fixed(ay)} M ${fixed(q.x)} ${fixed(q.y)} L ${fixed(bx)} ${fixed(by)} M ${fixed(ax)} ${fixed(ay)} L ${fixed(bx)} ${fixed(by)}"/></g>`);
   }
   textLabels.push({key:`cota:${i}`,text:value,anchor:{x:mx,y:my},preferred:pos,normal:n,tangent:t,size:cFont,angle:dimensionRotation(`cota:${i}`,textAngle),priority:85+Math.min(75,len)/2,manual:Boolean(s.labelOffsets?.[`cota:${i}`])});
  }
  if(opt.vertices.visible&&!s.hiddenVertices.includes(i)){
   const radius=Math.max(1.8,Math.min(3.2,2.9*opt.vertices.size/100));
   circles.push(`<circle data-croqui-vertex="${i}" cx="${fixed(p.x)}" cy="${fixed(p.y)}" r="${fixed(radius)}" fill="#000000" stroke="#ffffff" stroke-width="1.2"><title>${esc(names[i])}</title></circle>${info.markers?.includes(i)?`<path d="M ${fixed(p.x-6)} ${fixed(p.y-6)} L ${fixed(p.x+6)} ${fixed(p.y+6)} M ${fixed(p.x+6)} ${fixed(p.y-6)} L ${fixed(p.x-6)} ${fixed(p.y+6)}" stroke="${esc(opt.vertices.color)}" stroke-width="1.2"/>`:''}`);
   const prev=pts[(i+pts.length-1)%pts.length];
   const pdx=p.x-prev.x,pdy=p.y-prev.y,plen=Math.hypot(pdx,pdy)||1;
   const pnx=outwardSign*pdy/plen,pny=-outwardSign*pdx/plen;
   const bnx=pnx+nx,bny=pny+ny,blen=Math.hypot(bnx,bny)||1;
   const vn={x:bnx/blen,y:bny/blen};
   const dir={x:q.x-prev.x,y:q.y-prev.y};const magnitude=Math.hypot(dir.x,dir.y)||1;
   const vClearance=crowded?(len<20||plen<20?14:11):14;
   const point=dimensionPoint(`vertex:${i}`,p.x+vn.x*vClearance+(s.labelMode==='all'?(s.vertexOffsets[i]?.dx||0):0),p.y+vn.y*vClearance+(s.labelMode==='all'?(s.vertexOffsets[i]?.dy||0):0));
   textLabels.push({key:`vertex:${i}`,text:names[i],anchor:{x:p.x,y:p.y},preferred:point,normal:vn,tangent:{x:dir.x/magnitude,y:dir.y/magnitude},size:Math.max(4.2,Math.max(4.8,8.5*opt.vertices.size/100)*(crowded?.88:1)*densityScale),angle:dimensionRotation(`vertex:${i}`,0),priority:110+Math.max(0,14-Math.min(14,len))/3,manual:Boolean(s.labelOffsets?.[`vertex:${i}`])});
  }
 });
 const sourceLabels=pts.map((_,i)=>s.neighbors[i]!==undefined&&s.neighbors[i]!=='[object Object]'?s.neighbors[i]:readConfrontation(poly.properties,i,pts.length));
 if(!composite&&opt.confrontantes.visible){
  uniqueConfrontantLabels(groupConfrontations(sourceLabels)).forEach(group=>{
   const middle=polylineMidpoint(pts,group.indices);if(!middle)return;
   const {point,direction}=middle,len=Math.hypot(direction.x,direction.y)||1;
   const n={x:outwardSign*direction.y/len,y:-outwardSign*direction.x/len};
   const key=`neighbor:${group.start}`;
   const deg=Math.atan2(direction.y,direction.x)*180/Math.PI;
   const defaultAngle=deg>90?deg-180:deg< -90?deg+180:deg;
   const angle=dimensionRotation(key,defaultAngle);
   const detail=group.indices.map(i=>s.neighborDetails[String(i)]).find(Boolean)||{};
   const caption=confrontantCaption(group.label,detail);
   const maxLine=Math.max(...caption.text.split('\n').map(line=>line.length));
   const size=Math.max(7,Math.min(11,270/Math.max(10,maxLine)))*opt.confrontantes.size/100;
   const manual=Boolean(s.labelOffsets?.[key]);
   // O centro do nome não basta: um texto comprido e horizontal ao lado de
   // uma divisa vertical pode atravessar o imóvel. Para rótulos automáticos,
   // afastamos a caixa de texto inteira para o lado externo da geometria.
   // NUNCA recalculamos a origem de um rótulo posicionado manualmente, pois
   // seu deslocamento salvo deve produzir a mesma posição nas duas telas.
   const radians=angle*Math.PI/180;
   const u={x:Math.cos(radians),y:Math.sin(radians)};
   const v={x:-u.y,y:u.x};
   const halfWidth=maxLine*size*.32, halfHeight=size*(caption.cpf?1.37:.67);
   const projectedHalf=Math.abs(n.x*u.x+n.y*u.y)*halfWidth+Math.abs(n.x*v.x+n.y*v.y)*halfHeight;
   const minOutside=crowded?24:34;
   const clearance=manual?minOutside:Math.max(minOutside,Math.min(340,projectedHalf+12));
   const pin=s.confrontantPins?.[confrontantPinKey(group.label)];
   const pos=pin?{x:pin.x+(s.labelOffsets?.[key]?.dx||0),y:pin.y+(s.labelOffsets?.[key]?.dy||0)}:dimensionPoint(key,point.x+n.x*clearance,point.y+n.y*clearance);
   textLabels.push({key,text:caption.text,anchor:point,preferred:pos,normal:n,tangent:{x:direction.x/len,y:direction.y/len},size,angle,priority:200,manual:manual||Boolean(pin)});
  });
 }
 const positionedLabels=textLabels.map(label=>{
  const resized={...label,size:label.size*(s.labelSizes?.[label.key]??100)/100};
  const absolute=s.absoluteLabels?.[label.key];if(!absolute)return resized;
  const local=s.labelOffsets?.[label.key]||{dx:0,dy:0};
  return {...resized,preferred:{x:absolute.x+local.dx,y:absolute.y+local.dy},manual:true};
 });
 const placement=placeCompactCroquiLabels(positionedLabels,s.labelMode==='smart',s.labelMode==='smart'&&pts.length>20);
 const labelMarkup=placement.visible.map(label=>{
  const p=label.position,kind=label.key.split(':')[0];
  const color=s.labelColors?.[label.key]||(kind==='cota'?opt.cotas.color:kind==='vertex'?opt.vertices.color:opt.confrontantes.color);
  const anchor='middle';
  const rows=label.text.split('\n'),dy=label.size*1.35;
  const spans=rows.map((line,index)=>`<tspan x="${fixed(p.x)}" dy="${index===0?0:fixed(dy)}"${index>0?' font-weight="500"':''}>${esc(line)}</tspan>`).join('');
  if(kind==='vertex'){
   const ink=s.labelColors?.[label.key]||'#000000';
   return `<text data-croqui-label="${esc(label.key)}" x="${fixed(p.x)}" y="${fixed(p.y)}" transform="rotate(${fixed(label.angle)} ${fixed(p.x)} ${fixed(p.y)})" text-anchor="middle" dominant-baseline="middle" font-size="${fixed(label.size)}" font-weight="650" fill="${esc(ink)}" style="cursor:grab;user-select:none;touch-action:none">${esc(label.text)}</text>`;
  }
  return `<text data-croqui-label="${esc(label.key)}" data-croqui-visual-y="${fixed(p.y)}" x="${fixed(p.x)}" y="${fixed(p.y-(rows.length-1)*dy/2)}" transform="rotate(${fixed(label.angle)} ${fixed(p.x)} ${fixed(p.y)})" text-anchor="${anchor}" dominant-baseline="middle" font-size="${fixed(label.size)}" font-weight="650" fill="${esc(color)}" stroke-linejoin="round" style="cursor:grab;user-select:none;touch-action:none"><title>${esc(label.text)}</title>${spans}</text>`;
 }).join('');
 const dimensions=`${cotaSegments.join('')}${circles.join('')}${labelMarkup}`;
 const hiddenCotas=placement.hidden.filter(key=>key.startsWith('cota:')).length;
 const hiddenVertices=placement.hidden.filter(key=>key.startsWith('vertex:')).length;
 const north=opt.norte.visible?`<g transform="translate(102,138) scale(${(opt.norte.size/100).toFixed(3)})" data-live-element="north"><circle r="31" fill="none" stroke="${esc(opt.norte.color)}" stroke-width="2"/><circle r="26" fill="none" stroke="${esc(opt.norte.color)}" stroke-width="1"/><path d="M0 -30 L8 -8 L0 0 L-8 -8 Z M30 0 L8 8 L0 0 L8 -8 Z M0 30 L-8 8 L0 0 L8 8 Z M-30 0 L-8 -8 L0 0 L-8 8 Z" fill="#fff" stroke="${esc(opt.norte.color)}" stroke-width="2"/><path d="M0 -30L0 0L-8 -8Z M30 0L0 0L8 -8Z M0 30L0 0L8 8Z M-30 0L0 0L-8 8Z" fill="${esc(opt.norte.color)}"/><text x="0" y="-40" text-anchor="middle" font-size="16" fill="${esc(opt.norte.color)}">N</text><text x="42" y="5" font-size="16" fill="${esc(opt.norte.color)}">E</text><text x="0" y="51" text-anchor="middle" font-size="16" fill="${esc(opt.norte.color)}">S</text><text x="-45" y="5" font-size="16" fill="${esc(opt.norte.color)}">W</text></g>`:'';
 const techLines=s.lines.map((l,i)=>{
  const p=l.start||pts[Math.max(0,Math.min(pts.length-1,l.from))];if(!p)return '';
  const end=l.to===undefined?{x:l.x,y:l.y}:pts[l.to]||{x:l.x,y:l.y};
  const col=esc(validColor(l.color,'#17212b'));
  const handles=info.editing?`<line x1="${fixed(p.x)}" y1="${fixed(p.y)}" x2="${fixed(end.x)}" y2="${fixed(end.y)}" stroke="transparent" stroke-width="16" data-croqui-line-body="${i}"/><circle data-croqui-handle="${i}:start" cx="${fixed(p.x)}" cy="${fixed(p.y)}" r="7" fill="white" stroke="${col}" stroke-width="2"/><circle data-croqui-handle="${i}:end" cx="${fixed(end.x)}" cy="${fixed(end.y)}" r="7" fill="white" stroke="#0e61d8" stroke-width="2"/>`:'';
  return `<g class="croqui-technical-line" data-croqui-line="${i}"><line x1="${fixed(p.x)}" y1="${fixed(p.y)}" x2="${fixed(end.x)}" y2="${fixed(end.y)}" stroke="${col}" stroke-width="2" stroke-dasharray="7 3" pointer-events="none"/>${handles}</g>`;
 }).join('');
 // Servidão representada por DUAS bordas paralelas, com faixa de largura variável.
 const easements=s.easements.map((road,i)=>{
  if(road.visible===false)return '';
  const screenPoints=validGeoPoints(road.geoPoints)?road.geoPoints.map(plot):road.points;
  // A faixa acompanha o zoom com largura métrica quando georreferenciada.
  // Servidões antigas sem widthMeters conservam a largura visual histórica.
  const groundMetersPerPixel=156543.03392804097*Math.cos(map.center[1]*Math.PI/180)/2**map.zoom;
  const roadWidthPx=road.widthMeters&&validGeoPoints(road.geoPoints)
    ?Math.max(1,Math.min(5000,road.widthMeters/Math.max(groundMetersPerPixel,1e-9))):road.width;
  const boundaries=!validGeoPoints(road.geoPoints)&&road.sourceEdges&&road.sourceEdges.left.length>=2&&road.sourceEdges.right.length>=2
   ?road.sourceEdges:roadBoundaries(smoothRoadCenterline(screenPoints),roadWidthPx);
  const {left,right}=boundaries;
  if(left.length<2)return '';
  const col=esc(validColor(road.color,'#2563eb'));
  const fill=svgPoints([...left,...right.slice().reverse()]);
  const handles=info.editing?screenPoints.map((p,j)=>`<circle data-croqui-road-handle="${i}:${j}" cx="${fixed(p.x)}" cy="${fixed(p.y)}" r="6.5" stroke="${col}" stroke-width="2" fill="#fff"/>`).join(''):'';
  return `<g class="croqui-road" data-croqui-road="${i}"><polygon points="${fill}" fill="#fff" fill-opacity=".10" stroke="none"/>${openRoadEdgesSvg(left,right,col,2)}${info.editing?`<polygon points="${fill}" fill="transparent" stroke="none" data-croqui-road-body="${i}"/>`:''}${handles}</g>`;
 }).join('');
  const boundaryRings=composite?compositeBoundaryDivisions(divisions).map(part=>({id:`${part.featureId}:${part.partIndex}`,points:part.rings[0]||[],holes:part.rings.slice(1),hidden:info.areaSettings?.[part.featureId]?.hiddenVertices||[]})):[];
  const exteriorRuns=composite?exteriorBoundaryRuns(boundaryRings,{mergeCollinear:true}):visibleDimensionRuns(poly.vertices,s.hiddenVertices);
  const exteriorCotasSvg=composite&&s.exteriorCotas?exteriorDimensionSvg(exteriorRuns,plot,opt.cotas.color,Math.max(7,8*opt.cotas.size/100)):'';
  const boundaryHolePoints=boundaryRings.flatMap(ring=>ring.holes||[]).flat().map(plot);
  const exteriorVertices=composite&&opt.vertices.visible?(()=>{
   const points:(readonly [number,number])[]=[];
   exteriorRuns.flatMap(run=>run.points).forEach(point=>{
    const projected=plot(point);
    if(boundaryHolePoints.some(holePoint=>Math.hypot(holePoint.x-projected.x,holePoint.y-projected.y)<=2.5))return;
    if(!points.some(existing=>{const other=plot(existing);return Math.hypot(projected.x-other.x,projected.y-other.y)<=2.5;}))points.push(point);
   });
   if(!points.length)return '';
   const center=points.reduce((sum,p)=>({x:sum.x+p[0]/points.length,y:sum.y+p[1]/points.length}),{x:0,y:0});
   return points.sort((a,b)=>Math.atan2(a[1]-center.y,a[0]-center.x)-Math.atan2(b[1]-center.y,b[0]-center.x)).map((geo,i)=>{
    const p=plot(geo),dx=p.x-(MAP.x+MAP.w/2),dy=p.y-(MAP.y+MAP.h/2),length=Math.hypot(dx,dy)||1;
    const x=p.x+dx/length*13,y=p.y+dy/length*13,name=`V-${String(i+1).padStart(2,'0')}`;
    return `<circle data-croqui-exterior-vertex="${i}" cx="${fixed(p.x)}" cy="${fixed(p.y)}" r="${fixed(Math.max(2,2.8*opt.vertices.size/100))}" fill="#111827" stroke="#fff" stroke-width="1.2"/><text data-croqui-label="exterior:vertex:${i}" x="${fixed(x)}" y="${fixed(y)}" text-anchor="middle" dominant-baseline="middle" font-size="${fixed(Math.max(7,8.5*opt.vertices.size/100))}" font-weight="650" fill="${esc(opt.vertices.color)}" paint-order="stroke" stroke="#fff" stroke-width="2">${name}</text>`;
   }).join('');
  })():'';
 const photo=normalizeCroquiPhoto(s.photoOverlay);
 const photoArtwork=photo?.visible?`<g data-croqui-photo="true" aria-label="Foto sobreposta"><defs><clipPath id="croqui-photo-square"><rect x="${fixed(photo.x)}" y="${fixed(photo.y)}" width="${fixed(photo.size)}" height="${fixed(photo.size)}"/></clipPath></defs><image data-croqui-photo-body="true" href="${esc(photo.src)}" x="${fixed(photo.x)}" y="${fixed(photo.y)}" width="${fixed(photo.size)}" height="${fixed(photo.size)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#croqui-photo-square)" style="cursor:move;touch-action:none"/><rect x="${fixed(photo.x)}" y="${fixed(photo.y)}" width="${fixed(photo.size)}" height="${fixed(photo.size)}" fill="none" stroke="#ffffff" stroke-width="1.5" pointer-events="none"/>${info.editing?(['top-left','top-right','bottom-left','bottom-right'] as const).map(corner=>{const cx=photo.x+(corner.endsWith('right')?photo.size:0),cy=photo.y+(corner.startsWith('bottom')?photo.size:0);return `<rect data-croqui-photo-corner="${corner}" x="${fixed(cx-6)}" y="${fixed(cy-6)}" width="12" height="12" fill="#000000" stroke="#ffffff" stroke-width="1.5" style="cursor:nwse-resize;touch-action:none"/>`;}).join(''):''}</g>`:'';
 const overlay=`<defs><clipPath id="croqui-active-map"><rect x="44" y="74" width="1112" height="590"/></clipPath></defs>
   <rect x="44" y="74" width="1112" height="590" fill="#ffffff"/>
   <g clip-path="url(#croqui-active-map)"><g data-croqui-basemap="true">${images}</g>
   ${activeArtwork}
   ${divisions.length > 1 ? "" : polyAreaBadge}
    ${divisionArtwork}${ownCotas}${exteriorCotasSvg}${exteriorVertices}${divisions.length>1?'':glebas}${dimensions}${techLines}${easements}${mapNames}${photoArtwork}</g>${north}`;
 let svg=officialTemplate.replace(/<rect x="44" y="74" width="1112" height="590" fill="#fff"\/>[\s\S]*?<g class="sv-map-coordinate-reference">/,`${overlay}<g class="sv-map-coordinate-reference">`);
 // O relatório de densidade fica no SVG para o painel anunciar rótulos reposicionados/ocultos.
 svg=svg.replace('<svg ',`<svg data-hidden-cotas="${hiddenCotas}" data-hidden-vertices="${hiddenVertices}" `);
 // Remove o quadro de referência/legenda fotográfica INTEIRO; limpar só o texto deixava o retângulo.
 svg=svg.replace(/<g class="sv-map-coordinate-reference">[\s\S]*?<\/g>/,'');
 svg=svg.replace(/<text x="600" y="50"[^>]*>[\s\S]*?<\/text>/,`<text x="600" y="50" text-anchor="middle" font-size="22" font-weight="700">${esc(s.title)}</text>`);
 svg=svg.replace(/<text x="514" y="737"[\s\S]*?<\/text>/,`<text x="514" y="737" font-size="12">${esc(info.propertyName?.trim()||poly.name||'Imóvel rural')}</text>`);
 const owners=(info.owners||[]).map(value=>value.trim()).filter(Boolean);
 if(owners.length){
  // Cada proprietário tem sua própria linha, sem o separador horizontal "·".
  // A faixa de 753-782 é reservada ao cadastro, antes do município em 791.
  const many=owners.length>3;
  const size=many?8:owners.length>1?9.5:10.5;
  const dy=many?8:owners.length>2?10:13;
  const initialY=many?755:owners.length>2?758:759;
  const nameRows=owners.map((name,index)=>`<text x="542" y="${initialY+index*dy}" font-size="${size}">${esc(name)}</text>`).join('');
  const labels=`<text x="454" y="${initialY}" font-size="10" font-weight="700">Proprietário(s):</text>${nameRows}`;
  svg=svg.replace(/<text x="454" y="791"/,`${labels}<text x="454" y="791"`);
 }
 svg=svg.replace(/<text x="454" y="791"[\s\S]*?<\/text>/,`<text x="454" y="791" font-size="13"><tspan font-weight="700">Município/UF:</tspan> ${esc(info.municipality||'')}</text>`);
 if(divisions.length>1){
  const summaryDivisions=compositeParts(divisions);
  const totalAreaHa=compositeArea(divisions)/10000;
  const totalPerimM=compositePerimeter(divisions);
  svg=svg.replace(/<text x="454" y="816"[\s\S]*?<\/text>/,`<text x="454" y="816" font-size="12.5"><tspan font-weight="700">Área Total (${summaryDivisions.length}):</tspan> ${esc(fmt(totalAreaHa,4))} ha</text>`);
  svg=svg.replace(/<text x="659" y="816"[\s\S]*?<\/text>/,`<text x="659" y="816" font-size="12.5"><tspan font-weight="700">Perímetro Total:</tspan> ${esc(fmt(totalPerimM))} m</text>`);
  const maxItems=Math.min(summaryDivisions.length,5);
  const stepY=maxItems>=4?10.5:12;
  const fontSz=maxItems>=4?8.3:9;
  const breakdownSvg=`<text x="454" y="844" font-size="8.6" font-weight="700" fill="#475569">Quadro Individual (1 por 1):</text>`+summaryDivisions.slice(0,maxItems).map((d,idx)=>{
   const y=855+idx*stepY;
   const shortName=d.name.length>15?d.name.slice(0,14)+'…':d.name;
   return `<text x="454" y="${fixed(y)}" font-size="${fontSz}" fill="#0f172a"><tspan font-weight="700">${idx+1}. ${esc(shortName)}:</tspan> ${esc(fmt(d.areaM2/10000,4))} ha · ${esc(fmt(divisionPerim(d),2))} m</text>`;
  }).join('');
  svg=svg.replace(/<text x="454" y="912"/,`${breakdownSvg}<text x="454" y="912"`);
 }else{
  svg=svg.replace(/(<text x="454" y="816"[^>]*>)[\s\S]*?(<\/text>)/,`$1<tspan font-weight="700">Área:</tspan> ${esc(fmt(poly.areaM2/10000,4))} ha$2`);
  svg=svg.replace(/(<text x="659" y="816"[^>]*>)[\s\S]*?(<\/text>)/,`$1<tspan font-weight="700">Perímetro:</tspan> ${esc(fmt(poly.perimeterM))} m$2`);
 }
 svg=svg.replace(/<text x="654" y="858"[^>]*>Responsável técnico\(a\):<\/text><text x="654" y="876"[\s\S]*?<\/text>/,`<text x="654" y="858" font-size="13" font-weight="700">Responsável técnico(a):</text><text x="654" y="876" font-size="12">${esc(s.technician||'')}</text>`);
 svg=svg.replace(/<text x="454" y="912"[\s\S]*?<\/text>/,`<text x="454" y="912" font-size="12"><tspan font-weight="700">Data:</tspan> ${esc(info.date||new Date().toLocaleDateString('pt-BR'))}</text>`);
 svg=svg.replace(/<text x="1012\.5" y="792"[\s\S]*?<\/text>/,`<text x="1012.5" y="792" text-anchor="middle" font-size="12" font-weight="700">${esc(info.company||'Surveyor')}</text>`);
 // Old embedded brand is always removed; only the account's current logo can appear.
 const accountLogo=typeof info.logo==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(info.logo)?info.logo:'';
 svg=svg.replace(/<image\b[^>]*x="954\.5" y="708" width="116" height="56"[^>]*\/>/,accountLogo?`<image data-surveyor-account-logo="1" href="${esc(accountLogo)}" x="954.5" y="708" width="116" height="56" preserveAspectRatio="xMidYMid meet"/>`:'');
 svg=svg.replace(/<text x="887" y="870"[\s\S]*?<\/text>/,`<text x="887" y="870" font-size="9.5"><tspan x="887">${esc(info.mapLink.slice(0,38))}</tspan><tspan x="887" dy="12">${esc(info.mapLink.slice(38,76))}</tspan></text>`);
 svg=svg.replace(/>Zoom \d+</,`>Zoom ${map.zoom}<`);
 if(info.qr)svg=svg.replace(/(<image href=")[^"]+(" x="68" y="790" width="100" height="100")/,`$1${esc(info.qr)}$2`);
 else{
  const qrFallback=/^https?:\/\//i.test(info.mapLink)?'Sem QR; utilize o link completo ao lado':'Sem link público';
  svg=svg.replace(/<image\b[^>]*x="68" y="790" width="100" height="100"[^>]*\/>/,`<text x="76" y="842" font-size="11" fill="#64748b">${esc(qrFallback)}</text>`);
 }
 // Apresentação A3 em paisagem: ampliar a folha ao redor da arte, sem deformar o terreno.
 if(s.paper==='A3')svg=svg.replace('viewBox="0 0 1200 970"','viewBox="-90 0 1380 970"');
 if(s.signatureEnabled && /^data:image\/(png|jpeg|webp);base64,/i.test(s.signature)) {
    const width=Math.round(s.signatureSize*3.3);
    const left=600-width/2;
    svg=svg.replace(s.paper==='A3'?'viewBox="-90 0 1380 970"':'viewBox="0 0 1200 970"',s.paper==='A3'?'viewBox="-90 0 1380 1130"':'viewBox="0 0 1200 1130"');
    svg=svg.replace(/<\/svg>\s*$/,`<image href="${esc(s.signature)}" x="${left}" y="973" width="${width}" height="95" preserveAspectRatio="xMidYMid meet"/><line x1="400" y1="1076" x2="800" y2="1076" stroke="#152d49" stroke-width="1.5"/><text x="600" y="1097" text-anchor="middle" font-size="15" font-weight="600">${esc(s.technician||'Responsável técnico')}</text></svg>`);
  }
 return svg;
}
