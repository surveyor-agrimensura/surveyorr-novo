import {divisionPerimeter} from '../croqui/divisionPerimeter';
import {compositeArea, compositeBoundaryDivisions, compositeDivisionVertexName, compositeParts, compositePerimeter} from '../croqui/compositeMeasures';
import {exteriorBoundaryRuns, visibleDimensionRuns, exteriorDimensionSvg} from '../../lib/cartographicAutomation';
import {normalizeMapNames,type MapName} from '../croqui/sharedMapAppearance';
import template from './prancha-oficial.svg?raw';
import {tarefaCaption} from '../../lib/agrarianMeasure';
import {drawCustomCotas,normalizedCustomCotas,type CustomCota} from '../../lib/customCotas';
import {areaLabelAnchor} from './areaLabelAnchor';
import { distance, fmt, record, mapLayout, type SurveyPolygon } from '../memorial/memorialEngine';
import { croquiVertexNames, type CroquiSettings, type NeighborDetails } from '../memorial/croquiRenderer';
import { placeTechnicalLabels, placeCompactCroquiLabels, type TechnicalLabel } from '../croqui/labelLayout';
import { buildUtmGrid } from './utmGrid';
import {confrontantCaption} from '../croqui/confrontantCaption';
import {confrontantPinKey,uniqueConfrontantLabels,type ConfrontantPins} from '../../lib/confrontantVisualOrganizer';
import {compositeExteriorEdges} from '../../lib/compositeConfrontants';
import { groupConfrontations, polylineMidpoint, readConfrontation, roadBoundaries, smoothRoadCenterline, svgPoints, openRoadEdgesSvg } from '../croqui/croquiGeometry';
import { divisionBounds, type ProjectDivision } from '../croqui/projectDivisions';
import { svgTextOutline } from '../../lib/svgTextContrast';
import {framePointToGeo,validGeoPoints,type OverlayGeoPoint} from '../../lib/mapOverlayCoordinates';
import {layoutForCroqui} from '../memorial/croquiRenderer';
import {partitionAreaM2,overlappedArea2D,polygonArea2D,type AreaPoint} from '../../lib/areaOverlay';
import {qrCodeDataUrl} from '../../lib/qrCode';

export type SheetTechnicalLine={id:string;start:{x:number;y:number};end:{x:number;y:number};color:string};
export type SheetRoad={id:string;points:{x:number;y:number}[];geoPoints?:OverlayGeoPoint[];color:string;width:number};
export type SheetElement = 'cotas'|'vertices'|'confrontantes'|'norte'|'grade'|'escala'|'gleba';
export type SheetSettings={ revision:number;title:string;reference:string;district:string;registry:string;incra:string;cib:string;technician:string;sheet:string;scale:string;paper:'A4'|'A3';zoom:number;type:'lateral'|'compact';background:'vector'|'satellite'|'street'|'none';miniOpacity:number;highlight:boolean; elements:Record<SheetElement,{visible:boolean;size:number;color:string}>; names:string[];neighbors:string[];divisionNames:Record<string,string>;divisionColors:Record<string,string>;divisionNeighbors:Record<string,string>;divisionNeighborDetails:Record<string,NeighborDetails>;divisionVertexNames:Record<string,string>;customCotas:CustomCota[];tarefaM2:number;labelOffsets:Record<string,{dx:number;dy:number}>;labelAngles:Record<string,number>;labelColors:Record<string,string>;labelSizes:Record<string,number>;hiddenLabels:string[];confrontantPins:ConfrontantPins;mapNames:MapName[];hiddenVertices:number[];hiddenDivisionVertices:Record<string,boolean>;exteriorCotas:boolean;polygonFill:string;polygonStroke:string;polygonFillOpacity:number;polygonStrokeWidth:number;neighborDetails:Record<string,NeighborDetails>;technicalLines:SheetTechnicalLine[];sheetRoads:SheetRoad[];signature:string;signatureEnabled:boolean;signatureSource:'account'|'custom'|'none';signatureSize:number;signatureOffsetX:number;signatureOffsetY:number;profile:'custom'|'incra'|'ambiental'|'comercial'|'reurb'};
export const defaultSheet=():SheetSettings=>({revision:0,title:'PLANTA DO IMÓVEL GEORREFERENCIADO',reference:'',district:'',registry:'',incra:'',cib:'',technician:'',sheet:'ÚNICA',scale:'1:3.500',paper:'A4',zoom:15,type:'lateral',background:'satellite',miniOpacity:88,highlight:true,elements:{cotas:{visible:true,size:82,color:'#17212b'},vertices:{visible:true,size:78,color:'#17212b'},confrontantes:{visible:true,size:92,color:'#17212b'},norte:{visible:true,size:100,color:'#17212b'},grade:{visible:true,size:100,color:'#94a3b8'},escala:{visible:true,size:100,color:'#17212b'},gleba:{visible:false,size:100,color:'#94a3b8'}},names:[],neighbors:[],divisionNames:{},divisionColors:{},divisionNeighbors:{},divisionNeighborDetails:{},divisionVertexNames:{},customCotas:[],tarefaM2:0,labelOffsets:{},labelAngles:{},labelColors:{},labelSizes:{},hiddenLabels:[],confrontantPins:{},hiddenVertices:[],mapNames:[],hiddenDivisionVertices:{},exteriorCotas:false,polygonFill:'#f2c313',polygonStroke:'#f59e0b',polygonFillOpacity:0.2,polygonStrokeWidth:2.5,neighborDetails:{},technicalLines:[],sheetRoads:[],signature:'',signatureEnabled:false,signatureSource:'account',signatureSize:45,signatureOffsetX:0,signatureOffsetY:0,profile:'custom'});

/** Inicializa a prancha respeitando as cores definidas no Mapa Operacional quando disponíveis. */
export function defaultSheetForPolygon(poly?:SurveyPolygon|null,technician=''):SheetSettings{
 const base=defaultSheet();
 base.technician=technician;
 if(!poly)return base;
 const p=record(poly.properties);
 const fill=typeof p.fillColor==='string'&&/^#[0-9a-f]{6}$/i.test(p.fillColor)?p.fillColor:typeof p.lotColor==='string'&&/^#[0-9a-f]{6}$/i.test(p.lotColor)?p.lotColor:base.polygonFill;
 const stroke=typeof p.strokeColor==='string'&&/^#[0-9a-f]{6}$/i.test(p.strokeColor)?p.strokeColor:typeof p.lotColor==='string'&&/^#[0-9a-f]{6}$/i.test(p.lotColor)?p.lotColor:fill!==base.polygonFill?fill:base.polygonStroke;
 const opacity=Number(p.fillOpacity);
 return {...base,polygonFill:fill,polygonStroke:stroke,polygonFillOpacity:Number.isFinite(opacity)&&opacity>=0&&opacity<=1?opacity:0.26};
}

export function normalizeSheet(raw:unknown):SheetSettings {const def=defaultSheet(),v=record(raw),elems=record(v.elements);return {...def,...v,revision:Number.isFinite(Number(v.revision))?Math.max(0,Number(v.revision)):0,paper:v.paper==='A3'?'A3':'A4',background:v.background==='satellite'?'satellite':v.background==='street'?'street':v.background==='none'?'none':'vector',zoom:Math.max(8,Math.min(25,Number(v.zoom)||15)),miniOpacity:boundedSheetNumber(v.miniOpacity,def.miniOpacity,0,100),elements:Object.fromEntries(Object.entries(def.elements).map(([k,el])=>{const r=record(elems[k]);return [k,{visible:typeof r.visible==='boolean'?r.visible:el.visible,size:Math.max(35,Math.min(250,Number(r.size)||el.size)),color:typeof r.color==='string'&&/^#[0-9a-f]{6}$/i.test(r.color)?r.color:el.color}]})) as SheetSettings['elements'],names:Array.isArray(v.names)?v.names.map(String):[],divisionNames:Object.fromEntries(Object.entries(record(v.divisionNames)).map(([k,value])=>[k,String(value).slice(0,100)])),divisionColors:Object.fromEntries(Object.entries(record(v.divisionColors)).filter(([,color])=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color)).map(([key,color])=>[key,String(color)])) as Record<string,string>,divisionNeighbors:Object.fromEntries(Object.entries(record(v.divisionNeighbors)).map(([k,value])=>[k,String(value).slice(0,200)])),divisionNeighborDetails:record(v.divisionNeighborDetails) as SheetSettings["divisionNeighborDetails"],divisionVertexNames:Object.fromEntries(Object.entries(record(v.divisionVertexNames)).map(([k,value])=>[k,String(value).slice(0,60)])),customCotas:normalizedCustomCotas(v.customCotas),tarefaM2:Math.max(0,Number(v.tarefaM2)||0),neighbors:Array.isArray(v.neighbors)?v.neighbors.map(x=>typeof x==='string'?x:''):[],labelOffsets:record(v.labelOffsets) as SheetSettings['labelOffsets'],labelAngles:Object.fromEntries(Object.entries(record(v.labelAngles)).map(([k,a])=>[k,Math.max(-180,Math.min(180,Number(a)||0))])),labelColors:Object.fromEntries(Object.entries(record(v.labelColors)).map(([k,a])=>[k,typeof a==='string'&&/^#[0-9a-f]{6}$/i.test(a)?a:'#17212b'])),labelSizes:Object.fromEntries(Object.entries(record(v.labelSizes)).map(([k,a])=>[k,Number.isFinite(Number(a))?Math.max(40,Math.min(250,Number(a))):100])),mapNames:normalizeMapNames(v.mapNames),confrontantPins:Object.fromEntries(Object.entries(record(v.confrontantPins)).filter(([,pt])=>Number.isFinite(Number(record(pt).x))&&Number.isFinite(Number(record(pt).y))).map(([key,pt])=>[key,{x:Number(record(pt).x),y:Number(record(pt).y)}])),hiddenLabels:Array.isArray(v.hiddenLabels)?[...new Set(v.hiddenLabels.filter((key:unknown):key is string=>typeof key==='string'&&key.length>0&&key.length<=200))]:[],hiddenVertices:Array.isArray(v.hiddenVertices)?v.hiddenVertices.filter((i:unknown)=>Number.isInteger(i)&&Number(i)>=0).map(Number):[],hiddenDivisionVertices:Object.fromEntries(Object.entries(record(v.hiddenDivisionVertices)).map(([key,value])=>[key,value===true])),exteriorCotas:v.exteriorCotas===true,polygonFill:typeof v.polygonFill==='string'&&/^#[0-9a-f]{6}$/i.test(v.polygonFill)?v.polygonFill:def.polygonFill,polygonStroke:typeof v.polygonStroke==='string'&&/^#[0-9a-f]{6}$/i.test(v.polygonStroke)?v.polygonStroke:def.polygonStroke,polygonFillOpacity:boundedSheetNumber(v.polygonFillOpacity,def.polygonFillOpacity,0,1),polygonStrokeWidth:Math.max(.5,Math.min(12,Number(v.polygonStrokeWidth)||def.polygonStrokeWidth)),neighborDetails:record(v.neighborDetails) as SheetSettings['neighborDetails'],technicalLines:Array.isArray(v.technicalLines)?v.technicalLines.filter(x=>{const r=record(x);return Number.isFinite(Number(record(r.start).x))&&Number.isFinite(Number(record(r.end).x));}) as SheetTechnicalLine[]:[],sheetRoads:Array.isArray(v.sheetRoads)?v.sheetRoads.filter(x=>Array.isArray(record(x).points)&&((record(x).points as unknown[]).length)>=2) as SheetRoad[]:[],signature:typeof v.signature==='string'?v.signature:'',signatureEnabled:v.signatureEnabled===true,signatureSource:v.signatureSource==='none'||v.signatureSource==='account'||v.signatureSource==='custom'?v.signatureSource:(typeof v.signature==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(v.signature)?v.signatureEnabled===false?'none':'custom':'account'),signatureSize:Math.max(20,Math.min(180,Number(v.signatureSize)||45)),signatureOffsetX:Number.isFinite(v.signatureOffsetX)?Math.max(-1400,Math.min(1400,Number(v.signatureOffsetX))):0,signatureOffsetY:Number.isFinite(v.signatureOffsetY)?Math.max(-1000,Math.min(1000,Number(v.signatureOffsetY))):0,profile:['incra','ambiental','comercial','reurb'].includes(String(v.profile))?v.profile as SheetSettings['profile']:'custom', type:v.type==='compact'?'compact':'lateral', title:String(v.title||def.title),sheet:String(v.sheet||def.sheet),scale:String(v.scale||def.scale),district:String(v.district||''),registry:String(v.registry||''),reference:String(v.reference||''),incra:String(v.incra||''),cib:String(v.cib||''),technician:String(v.technician||'')};}
function boundedSheetNumber(value:unknown,fallback:number,min:number,max:number){
 const number=typeof value==='number'||typeof value==='string'?Number(value):Number.NaN;
 return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
}
const esc=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rect={x:112,y:40,w:800,h:845};
const croquiFrame={x:44,y:74,w:1112,h:590};
const validColor=(value:string,fallback:string)=>/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
const fixed=(n:number)=>Number.isFinite(n)?n.toFixed(2):'0.00';
/** A aparência por rótulo é compartilhada pela prévia, impressão e SVG exportado. */
export function sheetLabelAppearance(settings:Pick<SheetSettings,'labelAngles'|'labelColors'|'labelSizes'>,key:string,baseSize:number,defaultColor:string,defaultAngle=0){
 const rawSize=settings.labelSizes?.[key];
 const percent=typeof rawSize==='number'&&Number.isFinite(rawSize)?Math.max(40,Math.min(250,rawSize)):100;
 const rawAngle=settings.labelAngles?.[key];
 const angle=typeof rawAngle==='number'&&Number.isFinite(rawAngle)?Math.max(-180,Math.min(180,rawAngle)):defaultAngle;
 return {size:baseSize*percent/100,percent,angle,color:validColor(settings.labelColors?.[key]||'',defaultColor)};
}

const divisionPalette=['#2075db','#15a876','#a855f7','#ef8b25','#d84588','#17a9bf','#83a530','#c15e3c'];
/** A mesma cor deve aparecer no editor, na prancha, no quadro e no minimapa. */
export function sheetDivisionColor(part:Pick<ProjectDivision,'featureId'|'partIndex'|'color'>, index:number, overrides:Record<string,string>):string{
 return validColor(overrides[`${part.featureId}:${part.partIndex}`]||part.color||'',divisionPalette[index%divisionPalette.length]);
}

// Geometria única para a assinatura da prévia HTML e da prancha SVG exportada.
export function sheetSignatureBox(s:Pick<SheetSettings,'signatureSize'|'signatureOffsetX'|'signatureOffsetY'>){
 const width=s.signatureSize*2.3,height=Math.max(43,s.signatureSize*.9);
 return {x:1240-width/2+s.signatureOffsetX,y:480+s.signatureOffsetY,width,height};
}
export function clampSheetSignatureOffset(s:SheetSettings,offsetX:number,offsetY:number){
 const {width,height}=sheetSignatureBox({...s,signatureOffsetX:0,signatureOffsetY:0});
 const baseX=1240-width/2;
 return {
  signatureOffsetX:Math.max(18-baseX,Math.min(1582-width-baseX,offsetX)),
  signatureOffsetY:Math.max(18-480,Math.min(974-height-480,offsetY))
 };
}
export function sheetProjection(poly:SurveyPolygon,s:SheetSettings,divisions?:readonly ProjectDivision[],composite=false){
 const bounds=composite&&divisions&&divisions.length>1?divisionBounds(divisions):[];
 const allCoords=bounds.length?[...poly.vertices,...bounds]:poly.vertices;
 const lat0=allCoords.reduce((sum,p)=>sum+p[1],0)/allCoords.length*Math.PI/180;
 const cosLat=Math.cos(lat0);
 const basis=allCoords.map(p=>({x:p[0]*cosLat,y:-p[1]}));
 const xs=basis.map(p=>p.x),ys=basis.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const factor=Math.min(700/Math.max(1e-12,maxX-minX),715/Math.max(1e-12,maxY-minY))*Math.pow(1.27,s.zoom-15);
 const midX=(minX+maxX)/2,midY=(minY+maxY)/2;
 const project=(p:readonly [number,number])=>({x:rect.x+rect.w/2+(p[0]*cosLat-midX)*factor,y:rect.y+rect.h/2+(-p[1]-midY)*factor});
 const unproject=(p:{x:number;y:number}):OverlayGeoPoint=>[(midX+(p.x-rect.x-rect.w/2)/factor)/cosLat,-midY-(p.y-rect.y-rect.h/2)/factor];
 return {project,unproject,allCoords};
}
export function mapPointCoordinates(poly:SurveyPolygon,s:SheetSettings,divisions?:readonly ProjectDivision[],composite=false){
 const {project}=sheetProjection(poly,s,divisions,composite);
 return poly.vertices.map(project);
}
function clean(svg:string){return svg.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');}
const replaceTextLines=(source:string,x:number,y:number,values:string[])=>{
 const lines=values.map(value=>value.trim()).filter(Boolean);
 const pattern=new RegExp(`(<text\\b(?=[^>]*\\bx="${x}(?:\\.0+)?")(?=[^>]*\\by="${y}(?:\\.0+)?")[^>]*>)[\\s\\S]*?(<\\/text>)`);
 if(!lines.length)return source.replace(pattern,(_,a,b)=>a+b);
 const step=lines.length>2?9:13;
 const font=lines.length>2?9.5:12;
 const value=lines.map((line,index)=>`<tspan x="${x}" dy="${index===0?0:step}" font-size="${font}">${esc(line)}</tspan>`).join('');
 return source.replace(pattern,(_,a,b)=>a+value+b);
};
const replaceText=(source:string,x:number,y:number,value:string)=>{
 const pattern=new RegExp(`(<text\\b(?=[^>]*\\bx="${x}(?:\\.0+)?")(?=[^>]*\\by="${y}(?:\\.0+)?")[^>]*>)[\\s\\S]*?(<\\/text>)`);
 return source.replace(pattern,(_,a,b)=>a+esc(value)+b);
};
function fitText(text:string,max=42){return text.length>max?text.slice(0,max-1)+'…':text;}
function projectCroquiPoint(point:{x:number;y:number}){
 return {x:rect.x+((point.x-croquiFrame.x)/croquiFrame.w)*rect.w,y:rect.y+((point.y-croquiFrame.y)/croquiFrame.h)*rect.h};
}

export function renderMiniPerimeter(points:{x:number;y:number}[]){
 const box={x:964,y:644,w:330,h:210,pad:12};
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const w=Math.max(1,maxX-minX),h=Math.max(1,maxY-minY);
 const scale=Math.min((box.w-box.pad*2)/w,(box.h-box.pad*2)/h);
 const offsetX=box.x+(box.w-w*scale)/2-minX*scale;
 const offsetY=box.y+(box.h-h*scale)/2-minY*scale;
 return points.map(p=>({x:offsetX+p.x*scale,y:offsetY+p.y*scale}));
}
export function renderTechnicalSheet(
 poly:SurveyPolygon,
 s:SheetSettings,
 ctx:{
  municipality:string;
  owner:string;
  owners?:string[];
  company:string;
  date:string;
  publicUrl:string;
  logo?:string;
  croqui?:CroquiSettings|null;
  projectTitle?:string;
  editing?:boolean;
  previewSignatureOverlay?:boolean;
  divisions?:readonly ProjectDivision[];
  composite?:boolean;
  uf?:string;
 }
):string{
 const isComposite=Boolean(ctx.composite&&ctx.divisions&&ctx.divisions.length>1);
 const {project,unproject,allCoords}=sheetProjection(poly,s,ctx.divisions,isComposite);
 const pts=poly.vertices.map(project);
 const signed=pts.reduce((a,p,i)=>{const q=pts[(i+1)%pts.length];return a+p.x*q.y-q.x*p.y;},0),sign=signed>0?1:-1;

 // Camada de subdivisões / glebas quando em modo Imóvel Completo ou quando Cotas da gleba está ativo.
 const divisions=ctx.divisions||[];
 const showDivisions=isComposite||(s.elements.gleba.visible&&divisions.length>1);
 const seenGlebaEdges=new Set<string>();
 const divisionLabelLayer:string[]=[];
 // A opção Imóvel completo apresenta uma única confrontação por pessoa no
 // contorno exterior, sem apagar os cadastros próprios das glebas.
 const outerNeighborKeys=isComposite?new Set(compositeExteriorEdges(divisions).map(e=>e.key)):null;
 const exteriorNeighborNames=new Set<string>();
 const compositeNeighborDetails=new Map<string,NeighborDetails>();
 if(outerNeighborKeys)for(const part of divisions){
  const ring=part.rings[0]||[],prefix=`division:${part.featureId}:${part.partIndex}`;
  ring.forEach((_,i)=>{
   const key=`${prefix}:neighbor:${i}`;
   const name=s.divisionNeighbors[key]??readConfrontation(part.properties||{},i,ring.length);
   if(!name.trim())return;
   const identity=confrontantPinKey(name);
   const detail=s.divisionNeighborDetails[key];
   if(detail){
    const old=compositeNeighborDetails.get(identity);
    if(!old)compositeNeighborDetails.set(identity,detail);
    else compositeNeighborDetails.set(identity,{
     ...old,property:old.property||detail.property,owner:old.owner||detail.owner,
     cpf:old.cpf||detail.cpf,rg:old.rg||detail.rg,
     showCpf:old.showCpf||detail.showCpf,showOwner:old.showOwner||detail.showOwner,showRg:old.showRg||detail.showRg,
    });
   }
   if(outerNeighborKeys.has(key))exteriorNeighborNames.add(identity);
  });
 }
 const seenCompositeNeighborNames=new Set<string>();
 // Cada gleba possui geometria, vértices e rótulos PRÓPRIOS no imóvel completo.
 // Usar sempre uma chave estável (featureId + parte) para que um arraste não
 // altere os dados ou as posições de outra gleba.
 const divisionPolygons=showDivisions?divisions.map((part,index)=>{
  const ring=part.rings[0];if(!ring||ring.length<3)return '';
  const plotted=ring.map(project);
  const color=sheetDivisionColor(part,index,s.divisionColors);
  const selectedId=String(poly.properties.sourceFeatureId||poly.id);
  const isSelected=!isComposite&&part.featureId===selectedId&&part.partIndex===Number(poly.properties.partIndex||0);
  if(isSelected)return ''; // A gleba individual continua usando sua edição existente.
  const prefix=`division:${part.featureId}:${part.partIndex}`;
  const offset=(key:string,x:number,y:number)=>{
   const p=record(s.labelOffsets[key]);
   return {x:x+Math.max(-1200,Math.min(1200,Number(p.dx)||0)),y:y+Math.max(-1200,Math.min(1200,Number(p.dy)||0))};
  };
  const label=(key:string,x:number,y:number,content:string,size:number,colorText:string,angle=0)=>{
   if(s.hiddenLabels.includes(key))return '';
   const pos=offset(key,x,y);
   const appearance=sheetLabelAppearance(s,key,size,colorText,angle);
   return `<text data-sheet-label="${esc(key)}" data-sheet-base-x="${fixed(x)}" data-sheet-base-y="${fixed(y)}" data-sheet-visual-y="${fixed(pos.y)}" x="${fixed(pos.x)}" y="${fixed(pos.y)}" text-anchor="middle" dominant-baseline="middle" font-size="${fixed(appearance.size)}" font-weight="700" transform="rotate(${fixed(appearance.angle)} ${fixed(pos.x)} ${fixed(pos.y)})" fill="${esc(appearance.color)}" stroke="${svgTextOutline(appearance.color)}" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke fill" style="cursor:grab;user-select:none;pointer-events:all;touch-action:none">${esc(content)}</text>`;
  };
  const ringSigned=plotted.reduce((a,p,k)=>{const q=plotted[(k+1)%plotted.length];return a+p.x*q.y-q.x*p.y;},0);
  const ringSign=ringSigned>0?1:-1;
  const centroid=Number.isFinite(part.labelLon)&&Number.isFinite(part.labelLat)
   ?project([part.labelLon!,part.labelLat!])
   :plotted.reduce((acc,p)=>({x:acc.x+p.x/plotted.length,y:acc.y+p.y/plotted.length}),{x:0,y:0});
  const perimM=divisionPerimeter(part);
  const customLines=drawCustomCotas(s.customCotas,`${part.featureId}:${part.partIndex}`,ring,project,'#0f766e',true);
  const titleKey=`${prefix}:title`;
  const title=s.divisionNames[titleKey]||part.name;
  const nameTag=label(titleKey,centroid.x,centroid.y-6,title.slice(0,52),Math.max(7,9.6*s.elements.gleba.size/100),'#17212b')+
   label(`${prefix}:area`,centroid.x,centroid.y+8,`${fmt(part.areaM2/10000,4)} ha · ${fmt(perimM,2)} m${tarefaCaption(part.areaM2,ctx.uf||'',s.tarefaM2)?` · ${tarefaCaption(part.areaM2,ctx.uf||'',s.tarefaM2)}`:''}`,Math.max(6,8*s.elements.gleba.size/100),'#17212b');
  const seenOnPart=new Set<string>();
  const cotaLabels=(!s.exteriorCotas&&(s.elements.cotas.visible||s.elements.gleba.visible))?ring.map((v,k)=>{
   const next=ring[(k+1)%ring.length],pa=plotted[k],pb=plotted[(k+1)%plotted.length];
   const dx=pb.x-pa.x,dy=pb.y-pa.y,len=Math.hypot(dx,dy);
   if(len<38)return '';
   const edgeKey=[`${v[0].toFixed(7)},${v[1].toFixed(7)}`,`${next[0].toFixed(7)},${next[1].toFixed(7)}`].sort().join('|');
   if(seenOnPart.has(edgeKey)||seenGlebaEdges.has(edgeKey))return '';
   seenOnPart.add(edgeKey);seenGlebaEdges.add(edgeKey);
   const nx=-ringSign*dy/len,ny=ringSign*dx/len;
   const mx=(pa.x+pb.x)/2+nx*12,my=(pa.y+pb.y)/2+ny*12;
   const rawAng=Math.atan2(dy,dx)*180/Math.PI;
   const angle=rawAng>90?rawAng-180:rawAng< -90?rawAng+180:rawAng;
   return label(`${prefix}:cota:${k}`,mx,my,`${fmt(distance(v,next),1)} m`,Math.max(6,8*s.elements.cotas.size/100),s.elements.cotas.color,angle);
  }).join(''):'';
  const vertexLabels=isComposite&&s.elements.vertices.visible?part.rings.flatMap((vertexRing,ringIndex)=>{
   const ringPoints=vertexRing.map(project);
   return ringPoints.map((point,k)=>{
    const key=ringIndex===0?`${prefix}:vertex:${k}`:`${prefix}:ring:${ringIndex}:vertex:${k}`;
    if(s.hiddenDivisionVertices[key])return '';
    const before=ringPoints[(k+ringPoints.length-1)%ringPoints.length],after=ringPoints[(k+1)%ringPoints.length];
    const vx=(point.x-before.x)+(point.x-after.x),vy=(point.y-before.y)+(point.y-after.y);
    const normal=Math.hypot(vx,vy)||1;
    // Os anéis internos têm identificadores próprios, consistentes com o Croqui.
    const name=ringIndex===0?s.divisionVertexNames[key]||`V-${String(k+1).padStart(2,'0')}`:compositeDivisionVertexName(index,ringIndex,k);
    return `<circle data-sheet-division-vertex="${esc(key)}" cx="${fixed(point.x)}" cy="${fixed(point.y)}" r="3" fill="#fff" stroke="${esc(s.elements.vertices.color)}" stroke-width="1.4"/>`+
     label(key,point.x+vx/normal*12,point.y+vy/normal*12,name,Math.max(6.2,8.3*s.elements.vertices.size/100),s.elements.vertices.color);
   });
  }).join(''):'';
  const neighbors=isComposite&&s.elements.confrontantes.visible?uniqueConfrontantLabels(groupConfrontations(ring.map((_,k)=>
   s.divisionNeighbors[`${prefix}:neighbor:${k}`]??readConfrontation(part.properties||{},k,ring.length)
  )).filter(group=>!exteriorNeighborNames.has(confrontantPinKey(group.label))||group.indices.some(k=>outerNeighborKeys?.has(`${prefix}:neighbor:${k}`)))).map(group=>{
   const identity=confrontantPinKey(group.label);
   if(seenCompositeNeighborNames.has(identity))return '';
   seenCompositeNeighborNames.add(identity);
   const middle=polylineMidpoint(plotted,group.indices);if(!middle)return '';
   const {point,direction}=middle;
   const dx=direction.x,dy=direction.y,len=Math.hypot(dx,dy)||1;
   const detail=group.indices.map(k=>s.divisionNeighborDetails[`${prefix}:neighbor:${k}`]).find(Boolean)||compositeNeighborDetails.get(identity);
   const caption=detail?confrontantCaption(group.label,detail).text.replace(/\n/g,' · '):group.label;
   const pin=s.confrontantPins[confrontantPinKey(group.label)]||s.confrontantPins[confrontantPinKey(group.label,`${prefix}:`)];
   return label(`${prefix}:neighbor:${group.start}`,pin?.x??point.x-ringSign*dy/len*28,pin?.y??point.y+ringSign*dx/len*28,caption.slice(0,100),Math.max(6.3,8*s.elements.confrontantes.size/100),s.elements.confrontantes.color);
  }).join(''):'';
  const divisionPath=part.rings.filter(ring=>ring.length>=3).map(ring=>`M ${ring.map(project).map(p=>`${fixed(p.x)} ${fixed(p.y)}`).join(' L ')} Z`).join(' ');
  divisionLabelLayer.push(cotaLabels+vertexLabels+neighbors+nameTag+customLines);
  return `<g data-sheet-division="${esc(part.featureId)}" data-sheet-division-part="${part.partIndex}"><path data-sheet-polygon="${esc(prefix)}" d="${divisionPath}" fill="${esc(color)}" fill-opacity="${s.highlight?fixed(s.polygonFillOpacity):'0'}" fill-rule="evenodd" stroke="${esc(color)}" stroke-width="${fixed(s.polygonStrokeWidth)}"/></g>`;
 }).join(''):'';

 const singleCustomCotas=!isComposite?drawCustomCotas(s.customCotas,String(poly.id),poly.vertices,project,'#0f766e',true):'';
 const singleGlebaCotas=(!s.exteriorCotas&&!showDivisions&&s.elements.gleba.visible&&!s.elements.cotas.visible)?pts.map((pa,k)=>{
  const pb=pts[(k+1)%pts.length],dx=pb.x-pa.x,dy=pb.y-pa.y,len=Math.hypot(dx,dy);
  if(len<30)return '';
  const inx=-sign*dy/len,iny=sign*dx/len;
  const mx=(pa.x+pb.x)/2+inx*9,my=(pa.y+pb.y)/2+iny*9;
  const rawAng=Math.atan2(dy,dx)*180/Math.PI;
  const ang=rawAng>90?rawAng-180:rawAng< -90?rawAng+180:rawAng;
  return `<text data-sheet-gleba-cota="${k}" x="${fixed(mx)}" y="${fixed(my)}" transform="rotate(${fixed(ang)} ${fixed(mx)} ${fixed(my)})" font-size="${fixed(8.2*s.elements.gleba.size/100)}" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="${esc(s.elements.gleba.color)}" paint-order="stroke" stroke="${svgTextOutline(s.elements.gleba.color)}" stroke-width="2.4">${esc(fmt(distance(poly.vertices[k],poly.vertices[(k+1)%poly.vertices.length]),1))} m</text>`;
 }).join(''):'';

 const singlePolygonPath=[poly.vertices,...(poly.holes||[])].filter(ring=>ring.length>=3).map(ring=>`M ${ring.map(project).map(p=>`${fixed(p.x)} ${fixed(p.y)}`).join(' L ')} Z`).join(' ');
 const polygon=isComposite
  ?divisionPolygons
  :`${divisionPolygons}<path data-sheet-polygon="true" d="${singlePolygonPath}" fill="${esc(s.polygonFill)}" fill-opacity="${s.highlight?s.polygonFillOpacity:0}" fill-rule="evenodd" stroke="${esc(s.polygonStroke)}" stroke-width="${s.polygonStrokeWidth}"/>${singleGlebaCotas}${singleCustomCotas}`;

 const exteriorRings=isComposite?compositeBoundaryDivisions(divisions).map(part=>({id:`${part.featureId}:${part.partIndex}`,points:part.rings[0]||[],holes:part.rings.slice(1),hidden:(part.rings[0]||[]).map((_,i)=>i).filter(i=>s.hiddenDivisionVertices[`division:${part.featureId}:${part.partIndex}:vertex:${i}`])})):[];
 const exteriorCotasSvg=s.exteriorCotas?exteriorDimensionSvg(isComposite?exteriorBoundaryRuns(exteriorRings):visibleDimensionRuns(poly.vertices,s.hiddenVertices),project,s.elements.cotas.color,Math.max(7,8*s.elements.cotas.size/100)):'';
 const vertexNames=ctx.croqui?croquiVertexNames(poly,ctx.croqui):pts.map((_,i)=>s.names[i]?.trim()||`V-${String(i+1).padStart(2,'0')}`);
 // Deslocamentos manuais precisam alcançar toda a planta (inclusive a margem esquerda).
 // A origem de cada rótulo é guardada no SVG para evitar saltos ao iniciar um arraste
 // a partir de uma posição que havia sido reorganizada automaticamente.
 const maxLabelOffset=1200;
 const boundedLabelOffset=(value:unknown)=>Math.max(-maxLabelOffset,Math.min(maxLabelOffset,Number(value)||0));
 const labelPoint=(key:string,x:number,y:number)=>{const p=record(s.labelOffsets[key]);return {x:x+boundedLabelOffset(p.dx),y:y+boundedLabelOffset(p.dy)};};
 const textLabels:TechnicalLabel[]=[];
 const primitives:string[]=[];
 const cotaPaths=new Map<string,string>();
 const crowded=pts.length>24;
 const densityScale=pts.length>=40?.68:pts.length>=26?.77:pts.length>=15?.88:1;
 if(!isComposite)pts.forEach((p,i)=>{
  const q=pts[(i+1)%pts.length],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1,nx=sign*dy/len,ny=-sign*dx/len;
  if(s.elements.cotas.visible&&!s.exteriorCotas){
   const d=(crowded?9.5:13)*(s.elements.cotas.size/100)*densityScale,a={x:p.x+nx*d,y:p.y+ny*d},b={x:q.x+nx*d,y:q.y+ny*d};
   if(len>=24){
    cotaPaths.set(`cota:${i}`,`<path d="M${fixed(p.x)},${fixed(p.y)} L${fixed(a.x)},${fixed(a.y)} L${fixed(b.x)},${fixed(b.y)} L${fixed(q.x)},${fixed(q.y)}" fill="none" stroke="${s.elements.cotas.color}" stroke-width="${crowded?'.68':'.8'}"/>`);
    const pref=labelPoint(`cota:${i}`,(a.x+b.x)/2+nx*(crowded?7:10),(a.y+b.y)/2+ny*(crowded?7:10));
    const rawAngle=Math.atan2(dy,dx)*180/Math.PI;
    const textAngle=rawAngle>90?rawAngle-180:rawAngle< -90?rawAngle+180:rawAngle;
    textLabels.push({key:`cota:${i}`,text:`${fmt(distance(poly.vertices[i],poly.vertices[(i+1)%pts.length]),1)} m`,anchor:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},preferred:pref,normal:{x:nx,y:ny},tangent:{x:dx/len,y:dy/len},size:Math.max(5.8,9.2*(s.elements.cotas.size/100)*densityScale),angle:textAngle,priority:110+Math.min(70,len)/2,manual:Boolean(s.labelOffsets[`cota:${i}`])});
   }
  }
  if(s.elements.vertices.visible&&!s.hiddenVertices.includes(i)){
   const radius=Math.max(2.2,3.5*densityScale);
   primitives.push(`<circle cx="${fixed(p.x)}" cy="${fixed(p.y)}" r="${fixed(radius)}" fill="#fff" stroke="${s.elements.vertices.color}" stroke-width="${crowded?'1.1':'1.4'}"/>`);
   const prev=pts[(i+pts.length-1)%pts.length];
   const pdx=p.x-prev.x,pdy=p.y-prev.y,plen=Math.hypot(pdx,pdy)||1,pnx=sign*pdy/plen,pny=-sign*pdx/plen;
   const bx=pnx+nx,by=pny+ny,blen=Math.hypot(bx,by)||1;
   const vnx=bx/blen,vny=by/blen;
   const vDist=(crowded?13:18)*densityScale;
   const pref=labelPoint(`vertex:${i}`,p.x+vnx*vDist,p.y+vny*vDist);
   textLabels.push({key:`vertex:${i}`,text:vertexNames[i],anchor:p,preferred:pref,normal:{x:vnx,y:vny},tangent:{x:-vny,y:vnx},size:Math.max(6.4,10*(s.elements.vertices.size/100)*densityScale),angle:0,priority:210,manual:Boolean(s.labelOffsets[`vertex:${i}`])});
  }
 });
 if(!isComposite&&s.elements.confrontantes.visible){
  // Um rótulo por intervalo CONTÍNUO de um mesmo confrontante; cadastro de
  // cada aresta permanece independente para Memorial e edições posteriores.
  // O croqui editado e salvo prevalece sobre um rascunho antigo da prancha.
  const sources=pts.map((_,i)=>s.neighbors[i]!==undefined?s.neighbors[i].trim():ctx.croqui?.neighbors[i]!==undefined?ctx.croqui.neighbors[i].trim():readConfrontation(poly.properties,i,pts.length));
  for(const group of uniqueConfrontantLabels(groupConfrontations(sources))){
   const seg=group.start;
   const middleInfo=polylineMidpoint(pts,group.indices);if(!middleInfo)continue;
   const {point:middle,direction}=middleInfo;
   const dx=direction.x,dy=direction.y,len=Math.hypot(dx,dy)||1,nx=sign*dy/len,ny=-sign*dx/len;
   const detail=record(group.indices.map(i=>s.neighborDetails[String(i)]||ctx.croqui?.neighborDetails[String(i)]).find(Boolean));
   const {text:content}=confrontantCaption(group.label,detail);
   if(!content)continue;
   // Nome e CPF juntos, uma identificação para o trecho contínuo inteiro.
   const pin=s.confrontantPins[confrontantPinKey(group.label)];
   const pref=labelPoint(`neighbor:${seg}`,pin?.x??middle.x+nx*45,pin?.y??middle.y+ny*45);
   const maxLength=Math.max(...content.split('\n').map(line=>line.length));
   const font=Math.max(7.6,Math.min(10.4,530/Math.max(20,maxLength)))*s.elements.confrontantes.size/100;
   textLabels.push({key:`neighbor:${seg}`,text:content,anchor:middle,preferred:pref,normal:{x:nx,y:ny},tangent:{x:dx/len,y:dy/len},size:font,angle:0,priority:180,manual:Boolean(pin||s.labelOffsets[`neighbor:${seg}`])});
  }
 }
 const visibleTextLabels=textLabels.filter(label=>!s.hiddenLabels.includes(label.key));
 const placed=placeTechnicalLabels(visibleTextLabels,{left:rect.x+8,top:rect.y+8,right:rect.x+rect.w-8,bottom:rect.y+rect.h-8},true);
 for(const item of placed.visible){
  if(item.key.startsWith('cota:')){
   const path=cotaPaths.get(item.key);
   if(path)primitives.unshift(path);
  }
 }
 // A disposição automática não pode eliminar uma confrontação existente.
 // Se não couber no posicionamento padrão, mantém o texto reduzido perto do trecho,
 // sem alterar o rótulo nem o valor cadastrado. O usuário pode arrastar depois.
 const missing=placed.hidden.filter(key=>key.startsWith('neighbor:')||key.startsWith('cpf:')).map(key=>visibleTextLabels.find(label=>label.key===key)).filter((label):label is TechnicalLabel=>Boolean(label));
 const recovered=placeCompactCroquiLabels(missing,true).visible.map(label=>{
  const size=Math.min(label.size,7.5);
  const halfWidth=Math.min(rect.w/2-8,Math.max(...label.text.split('\n').map(line=>line.length))*size*.32+3);
  return {...label,size,position:{x:Math.max(rect.x+8+halfWidth,Math.min(rect.x+rect.w-8-halfWidth,label.preferred.x)),y:Math.max(rect.y+12,Math.min(rect.y+rect.h-12,label.preferred.y))}};
 });
 const labels=[...placed.visible,...recovered].map(label=>{
  const p=label.position,kind=label.key.split(':')[0];
  const currentOffset=record(s.labelOffsets[label.key]);
  const baseX=label.preferred.x-boundedLabelOffset(currentOffset.dx);
  const baseY=label.preferred.y-boundedLabelOffset(currentOffset.dy);
  const appearance=sheetLabelAppearance(s,label.key,label.size,kind==='cota'?s.elements.cotas.color:kind==='vertex'?s.elements.vertices.color:s.elements.confrontantes.color,label.angle);
  const color=appearance.color;
  const leader=label.displaced?`<line x1="${fixed(label.anchor.x)}" y1="${fixed(label.anchor.y)}" x2="${fixed(p.x)}" y2="${fixed(p.y)}" stroke="${color}" stroke-opacity=".38" stroke-width=".65" stroke-dasharray="2 2" pointer-events="none"/>`:'';
  const rows=label.text.split('\n');
  const spacing=appearance.size*1.38;
  const spans=rows.map((row,index)=>`<tspan x="${fixed(p.x)}" dy="${index===0?0:fixed(spacing)}"${index>0?' font-weight="500"':''}>${esc(row)}</tspan>`).join('');
  return `${leader}<text data-sheet-label="${esc(label.key)}" data-sheet-base-x="${fixed(baseX)}" data-sheet-base-y="${fixed(baseY)}" data-sheet-visual-y="${fixed(p.y)}" style="cursor:grab;user-select:none;pointer-events:all;touch-action:none;filter:drop-shadow(0 0 1.4px ${svgTextOutline(color)})" stroke="transparent" stroke-width="14" paint-order="stroke fill" x="${fixed(p.x)}" y="${fixed(p.y-(rows.length-1)*spacing/2)}" text-anchor="middle" dominant-baseline="middle" font-size="${fixed(appearance.size)}" font-weight="${kind==='vertex'?'700':'600'}" transform="rotate(${fixed(appearance.angle)} ${fixed(p.x)} ${fixed(p.y)})" fill="${color}">${spans}</text>`;
 }).join('');
 // O nome do imóvel individual deve existir DENTRO da planta, não só no carimbo lateral.
 // É um rótulo editável como os vértices/confrontantes e tem posição isolada no rascunho.
 const propertyAnchor=areaLabelAnchor(pts);
 const propertyPosition=labelPoint('property:title',propertyAnchor.x,propertyAnchor.y);
 const propertyTitle=(ctx.projectTitle?.trim()||poly.name||'Imóvel rural').slice(0,90);
 const propertyTitleSize=Math.max(8,Math.min(13,480/Math.max(24,propertyTitle.length)));
 const propertyStyle=sheetLabelAppearance(s,'property:title',propertyTitleSize,'#17355a');
 const propertyNameLabel=!isComposite&&propertyTitle&&!s.hiddenLabels.includes('property:title')?`<text data-sheet-label="property:title" data-sheet-base-x="${fixed(propertyAnchor.x)}" data-sheet-base-y="${fixed(propertyAnchor.y)}" data-sheet-visual-y="${fixed(propertyPosition.y)}" x="${fixed(propertyPosition.x)}" y="${fixed(propertyPosition.y)}" text-anchor="middle" dominant-baseline="middle" font-size="${fixed(propertyStyle.size)}" font-weight="700" fill="${esc(propertyStyle.color)}" transform="rotate(${fixed(propertyStyle.angle)} ${fixed(propertyPosition.x)} ${fixed(propertyPosition.y)})" stroke="${svgTextOutline(propertyStyle.color)}" stroke-width="4" paint-order="stroke fill" style="cursor:grab;user-select:none;pointer-events:all;touch-action:none">${esc(propertyTitle)}</text>`:'';
 // A prancha de uma única gleba exibe as medidas junto ao nome, assim como a prancha completa.
 // O rótulo possui chave própria para posição, cor, tamanho e rotação persistirem no rascunho.
 const propertyMeasureText=`${fmt(poly.areaM2/10000,4)} ha · ${fmt(poly.perimeterM,2)} m${tarefaCaption(poly.areaM2,ctx.uf||'',s.tarefaM2)?` · ${tarefaCaption(poly.areaM2,ctx.uf||'',s.tarefaM2)}`:''}`;
 const measureBase={x:propertyPosition.x,y:propertyPosition.y+17};
 const measurePosition=labelPoint('property:area',measureBase.x,measureBase.y);
 const measureStyle=sheetLabelAppearance(s,'property:area',Math.max(7,Math.min(9,310/Math.max(25,propertyMeasureText.length))),'#17355a');
 const propertyAreaLabel=!isComposite&&!s.hiddenLabels.includes('property:area')?`<text data-sheet-label="property:area" data-sheet-base-x="${fixed(measureBase.x)}" data-sheet-base-y="${fixed(measureBase.y)}" data-sheet-visual-y="${fixed(measurePosition.y)}" x="${fixed(measurePosition.x)}" y="${fixed(measurePosition.y)}" text-anchor="middle" dominant-baseline="middle" font-size="${fixed(measureStyle.size)}" font-weight="600" fill="${esc(measureStyle.color)}" transform="rotate(${fixed(measureStyle.angle)} ${fixed(measurePosition.x)} ${fixed(measurePosition.y)})" style="cursor:grab;user-select:none;pointer-events:all;touch-action:none">${esc(propertyMeasureText)}</text>`:'';
 const croquiLines=(ctx.croqui?.lines||[]).filter(line=>!line.id.startsWith('sheet:')).map((line,i)=>{
  const safeIndex=(n:number)=>Math.max(0,Math.min(pts.length-1,n));
  const start=line.start?projectCroquiPoint(line.start):pts[safeIndex(line.from)];
  const end=line.to===undefined?projectCroquiPoint({x:line.x,y:line.y}):pts[safeIndex(line.to)];
  return `<g class="sheet-tech-line" data-sheet-line="${i}"><line x1="${fixed(start.x)}" y1="${fixed(start.y)}" x2="${fixed(end.x)}" y2="${fixed(end.y)}" stroke="${esc(validColor(line.color,'#17212b'))}" stroke-width="2" stroke-dasharray="7 3"/></g>`;
 }).join('');
 const localLines=(s.technicalLines||[]).map((line,i)=>`<g data-sheet-local-line="${i}"><line x1="${fixed(line.start.x)}" y1="${fixed(line.start.y)}" x2="${fixed(line.end.x)}" y2="${fixed(line.end.y)}" stroke="${esc(validColor(line.color,'#17212b'))}" stroke-width="2.3" stroke-dasharray="6 3"/><line data-sheet-line-body="${i}" x1="${fixed(line.start.x)}" y1="${fixed(line.start.y)}" x2="${fixed(line.end.x)}" y2="${fixed(line.end.y)}" stroke="transparent" stroke-width="14"/>${ctx.editing?`<circle data-sheet-line-handle="${i}:start" cx="${fixed(line.start.x)}" cy="${fixed(line.start.y)}" r="8" fill="white" stroke="#0b60d8" stroke-width="2"/><circle data-sheet-line-handle="${i}:end" cx="${fixed(line.end.x)}" cy="${fixed(line.end.y)}" r="8" fill="white" stroke="#0b60d8" stroke-width="2"/>`:''}</g>`).join('');
 const areaRoads:{color:string;name:string;polygon:AreaPoint[]}[]=[];
 const localRoads=(s.sheetRoads||[]).map((road,i)=>{
  const screenPoints=validGeoPoints(road.geoPoints)?road.geoPoints.map(project):road.points;
  const center=smoothRoadCenterline(screenPoints);
  const {left,right}=roadBoundaries(center,road.width);if(left.length<2)return '';
  const color=esc(validColor(road.color,'#16a34a'));
  areaRoads.push({color,name:`Servidão ${areaRoads.length+1}`,polygon:[...left,...right.slice().reverse()]});
  const polygonPoints=svgPoints([...left,...right.slice().reverse()]);
  const handles=ctx.editing?screenPoints.map((point,j)=>`<circle data-sheet-road-handle="${i}:${j}" cx="${fixed(point.x)}" cy="${fixed(point.y)}" r="7" fill="#fff" stroke="${color}" stroke-width="2"/>`).join(''):'';
  return `<g data-sheet-road="${i}"><polygon points="${polygonPoints}" fill="#fff" fill-opacity=".12" stroke="none"/>${openRoadEdgesSvg(left,right,color,2.5)}${handles}</g>`;
 }).join('');
 const croquiEasements=(ctx.croqui?.easements||[]).filter(road=>!road.id.startsWith('sheet:')&&road.visible!==false).map((road,i)=>{
  const points=validGeoPoints(road.geoPoints)?road.geoPoints.map(project):road.points.map(projectCroquiPoint);
  const {left,right}=roadBoundaries(smoothRoadCenterline(points),Math.max(8,(road.width/18)*14));
  if(left.length<2)return '';
  const color=esc(validColor(road.color,'#2563eb'));
  areaRoads.push({color,name:`Servidão ${areaRoads.length+1}`,polygon:[...left,...right.slice().reverse()]});
  const fill=svgPoints([...left,...right.slice().reverse()]);
  return `<g class="sheet-easement" data-sheet-road="${i}"><polygon points="${fill}" fill="#fff" fill-opacity=".10" stroke="none"/>${openRoadEdgesSvg(left,right,color,2)}</g>`;
 }).join('');
 let base=template;
 // Grade calculada no sistema UTM do CENTRO do imóvel. A transformação local
 // usa a mesma escala cartográfica do perímetro e não altera os pontos.
 try{
  const grid=buildUtmGrid(allCoords as [number,number][],project,rect,s.elements.grade.color);
  base=base.replace(/<g id="grade-principal">[\s\S]*?<\/g>/,`<g id="grade-principal">${grid.svg}</g>`);
 }catch{
  base=base.replace(/<g id="grade-principal">[\s\S]*?<\/g>/,'<g id="grade-principal"><text x="124" y="56" font-size="11" fill="#64748b">Grade UTM indisponível para este perímetro</text></g>');
 }
 // O desenho fica recortado no quadro do mapa, mas os rótulos são livres:
 // caso o técnico mova um confrontante para a margem esquerda, ele permanece visível.
 base=base.replace(/(<g clip-path="url\(#mapClipGeo\)">)[\s\S]*?(<\/g>\s*<g class="sv-live-element-layer sv-live-element-north")/,(_whole:string,opening:string)=>`${opening}\n${polygon}${primitives.join('')}${croquiLines}${croquiEasements}${localLines}${localRoads}\n</g>\n<g data-sheet-label-layer="1">${labels}${propertyNameLabel}${propertyAreaLabel}${divisionLabelLayer.join('')}${exteriorCotasSvg}</g>\n<g class="sv-live-element-layer sv-live-element-north"`);
 if(!base.includes('data-sheet-label')){
  base=base.replace(/(<g clip-path="url\(#mapClipGeo\)">)/,`$1<g>${polygon}${primitives.join('')}${croquiLines}${croquiEasements}${localLines}${localRoads}</g>`);
  base=base.replace(/<\/svg>\s*$/,`<g data-sheet-label-layer="1">${labels}${propertyNameLabel}${propertyAreaLabel}${divisionLabelLayer.join('')}${exteriorCotasSvg}</g></svg>`);
  base=base.replace(/<g class="sv-cad-dimension-group[^>]*>[\s\S]*?<\/g>/g,'');
  base=base.replace(/<text[^>]*class="sv-inline-label sv-vertex-label"[^>]*>[\s\S]*?<\/text>/g,'');
  base=base.replace(/<polygon class="sv-document-editable-polygon[^>]*\/>/g,'');
 }
 base=base.replace(/<g class="sv-area-name-label[^>]*>[\s\S]*?<\/g>/g,'');
 base=base.replace(/<g class="sv-live-element-layer sv-live-element-grid"[^>]*>/,tag=>s.elements.grade.visible?tag:tag.replace(/style="[^"]*"/, 'style="display:none"'));
 base=base.replace(/<g class="sv-live-element-layer sv-live-element-north"[^>]*>/,tag=>s.elements.norte.visible?tag:tag.includes('style=')?tag.replace(/style="[^"]*"/,'style="display:none"'):tag.replace(/>$/,' style="display:none">'));
 base=base.replace(/<g class="sv-live-element-layer sv-live-element-scale"[^>]*>/,tag=>s.elements.escala.visible?tag:tag.includes('style=')?tag.replace(/style="[^"]*"/,'style="display:none"'):tag.replace(/>$/,' style="display:none">'));
 base=base.replace(/<text[^>]*data-live-element="scale"[^>]*>/,tag=>s.elements.escala.visible?tag:tag.includes('style=')?tag.replace(/style="[^"]*"/,'style="display:none"'):tag.replace(/>$/,' style="display:none">'));

 // Cálculo topológico na MESMA projeção usada no desenho. A área geográfica
 // oficial permanece a referência; apenas a fração intersectada é descontada.
 // Sobreposições entre servidões são computadas uma única vez (união).
 const parcelParts=isComposite&&divisions.length>1?divisions.map(d=>({rings:d.rings.map(r=>r.map(project)),areaM2:d.areaM2})): [{rings:[poly.vertices.map(project)],areaM2:poly.areaM2}];
 const portions=parcelParts.map(part=>{
  const footprints=areaRoads.map(r=>r.polygon);
  const overall=partitionAreaM2(part.rings,footprints,part.areaM2);
  const planar=polygonArea2D(part.rings);
  const byRoad=areaRoads.map((_road,index)=>{
   const previous=index?overlappedArea2D(part.rings,footprints.slice(0,index)):0;
   const current=overlappedArea2D(part.rings,footprints.slice(0,index+1));
   return planar>1e-8?Math.max(0,(current-previous)/planar*part.areaM2):0;
  });
  return {...overall,byRoad};
 });
 const totalServM2=portions.reduce((sum,part)=>sum+part.easementM2,0);
 const totalRemM2=portions.reduce((sum,part)=>sum+part.remainderM2,0);
 const roadTotals=areaRoads.map((road,index)=>({...road,areaM2:portions.reduce((sum,p)=>sum+p.byRoad[index],0)}));
 const fmtHa=(m2:number)=>fmt(m2/10000,4);
 const colorForMain=isComposite&&divisions.length>1?sheetDivisionColor(divisions[0],0,s.divisionColors):(s.highlight&&s.polygonFillOpacity>0.05?s.polygonFill:s.polygonStroke);
 const marker=(color:string,y:number)=>`<circle cx="1338" cy="${fixed(y-3)}" r="3" fill="${esc(color)}"/>`;
 const totalAreaM2=isComposite&&divisions.length>1?compositeArea(divisions):poly.areaM2;
 const divisionPerim=divisionPerimeter;
 const totalPerimM=isComposite&&divisions.length>1?compositePerimeter(divisions):poly.perimeterM;

 base=replaceText(base,1169,74,ctx.company);
 base=replaceText(base,1109,262,ctx.projectTitle?.trim()||poly.name);
 base=replaceText(base,964,283,ctx.owners&&ctx.owners.length>1?'PROPRIETÁRIOS:':'PROPRIETÁRIO:');
 base=replaceTextLines(base,1109,283,ctx.owners?.length?ctx.owners:[ctx.owner]);
 base=replaceText(base,1109,304,ctx.municipality||'');
 base=replaceText(base,1109,325,s.district);
 base=replaceText(base,1024,432,`${fmt(totalAreaM2/10000,4)} ha`);
 base=replaceText(base,1335,432,`${fmt(totalPerimM)} m`);
 base=replaceText(base,1022,446,ctx.date);
 // A lista do projeto só entra no quadro quando o usuário escolheu "Imóvel completo".
 // Em uma prancha individual, mesmo que existam outras glebas no projeto, usamos SOMENTE poly.
 if(isComposite&&divisions.length>1){
  const summaryDivisions=compositeParts(divisions);
  const maxItems=Math.min(summaryDivisions.length,areaRoads.length?4:6);
  const stepY=maxItems>=5?11.5:13.5;
  const fontSz=maxItems>=5?8.2:9.2;
  const startY=668;
  const rowsSvg=summaryDivisions.slice(0,maxItems).map((d,idx)=>{
   const y=startY+idx*stepY;
   const col=sheetDivisionColor(d,idx,s.divisionColors);
   const shortName=d.name.length>11?d.name.slice(0,10)+'…':d.name;
   const pM=divisionPerim(d);
   return `<circle cx="1338" cy="${fixed(y-3)}" r="2.8" fill="${esc(col)}"/><text x="1344" y="${fixed(y)}" font-size="${fontSz}" font-weight="600" fill="#1e293b">${esc(shortName)}</text><text x="1420" y="${fixed(y)}" font-size="${fontSz}" fill="#0f172a">${esc(fmt(d.areaM2/10000,4))}</text><text x="1478" y="${fixed(y)}" font-size="${fontSz}" fill="#0f172a">${esc(fmt(pM,2))}</text>`;
  }).join('');
  const sumAreaHa=fmt(compositeArea(divisions)/10000,4);
  const sumPerimM=fmt(compositePerimeter(divisions),2);
  const totalY=startY+maxItems*stepY+3;
  const extra=areaRoads.length?`${marker(colorForMain,totalY+12)}<text x="1345" y="${fixed(totalY+12)}" font-size="8.6" fill="#334155">Remanescente</text><text x="1420" y="${fixed(totalY+12)}" font-size="8.6">${fmtHa(totalRemM2)}</text>${marker(roadTotals[0]?.color||'#16a34a',totalY+25)}<text x="1345" y="${fixed(totalY+25)}" font-size="8.6" fill="#334155">Servidões</text><text x="1420" y="${fixed(totalY+25)}" font-size="8.6">${fmtHa(totalServM2)}</text>`:'';
  const quadroGroup=`<text x="1344" y="655" font-size="8.8" font-weight="700" fill="#475569">Gleba/Área</text><text x="1420" y="655" font-size="8.8" font-weight="700" fill="#475569">Área(ha)</text><text x="1478" y="655" font-size="8.8" font-weight="700" fill="#475569">Perím.(m)</text>${rowsSvg}<line x1="1336" y1="${fixed(totalY-9)}" x2="1524" y2="${fixed(totalY-9)}" stroke="#cbd5e1" stroke-width="0.8"/><text x="1344" y="${fixed(totalY)}" font-size="9.2" font-weight="700" fill="#0f172a">Total (${summaryDivisions.length}):</text><text x="1420" y="${fixed(totalY)}" font-size="9.2" font-weight="700" fill="#0f172a">${esc(sumAreaHa)}</text><text x="1478" y="${fixed(totalY)}" font-size="9.2" font-weight="700" fill="#0f172a">${esc(sumPerimM)}</text>`;
  base=base.replace(/<text x="1352" y="660"[\s\S]*?<text x="1466" y="684"[^>]*>[\s\S]*?<\/text>/,quadroGroup+extra);
  if(totalY>742){
   base=base.replace('<text x="1344" y="754"','<text x="1344" y="772"');
  }
 }else{
  // Quadro da gleba selecionada: nunca somar outras feições do projeto.
  const shortName=poly.name.length>11?poly.name.slice(0,10)+'…':poly.name;
  const tarefa=tarefaCaption(poly.areaM2,ctx.uf||'',s.tarefaM2);
  const quadroIndividual=areaRoads.length?(()=>{
   const row=(y:number,name:string,area:number,color:string,perimeter='')=>
    `${marker(color,y)}<text x="1345" y="${fixed(y)}" font-size="8.4" fill="#0f172a">${esc(name)}</text><text x="1420" y="${fixed(y)}" font-size="9" fill="#0f172a">${esc(fmtHa(area))}</text>${perimeter?`<text x="1478" y="${fixed(y)}" font-size="9" fill="#0f172a">${esc(perimeter)}</text>`:''}`;
   // O quadro é estreito; para muitas faixas, a união segue correta e aparece agrupada.
   const roads=roadTotals.filter(r=>r.areaM2>0.000001);
   const roadLabels=roads.length<=2?roads.map(r=>({name:r.name,color:r.color,areaM2:r.areaM2})):[{name:`Servidões (${roads.length})`,color:roads[0]?.color||'#16a34a',areaM2:totalServM2}];
   const pieces=roadLabels.map((r,i)=>row(693+i*17,r.name,r.areaM2,r.color)).join('');
   const totalY=693+roadLabels.length*17;
   return `<g data-sheet-area-scope="individual" data-sheet-servitude-accounting="true"><title>${esc(poly.name)}</title>`+
    `<text x="1344" y="655" font-size="8.8" font-weight="700" fill="#475569">Gleba/Área</text><text x="1420" y="655" font-size="8.8" font-weight="700" fill="#475569">Área(ha)</text><text x="1478" y="655" font-size="8.8" font-weight="700" fill="#475569">Perím.(m)</text>`+
    row(675,'Remanescente',totalRemM2,colorForMain)+pieces+
    `<line x1="1335" x2="1520" y1="${fixed(totalY-10)}" y2="${fixed(totalY-10)}" stroke="#cbd5e1"/>`+
    row(totalY,'Total do imóvel',poly.areaM2,colorForMain,fmt(poly.perimeterM,2))+
    (tarefa?`<text x="1344" y="${fixed(totalY+14)}" font-size="8.6" fill="#334155">${esc(tarefa)}</text>`:'')+`</g>`;
  })():`<g data-sheet-area-scope="individual"><title>${esc(poly.name)}</title>`+
   `<text x="1344" y="655" font-size="8.8" font-weight="700" fill="#475569">Gleba/Área</text><text x="1420" y="655" font-size="8.8" font-weight="700" fill="#475569">Área(ha)</text><text x="1478" y="655" font-size="8.8" font-weight="700" fill="#475569">Perím.(m)</text>`+
   `<text x="1344" y="676" font-size="9.2" font-weight="600" fill="#0f172a">${esc(shortName)}</text><text x="1420" y="676" font-size="9.2" fill="#0f172a">${esc(fmt(poly.areaM2/10000,4))}</text><text x="1478" y="676" font-size="9.2" fill="#0f172a">${esc(fmt(poly.perimeterM,2))}</text>`+
   (tarefa?`<text x="1344" y="696" font-size="9" fill="#334155">${esc(tarefa)}</text>`:'')+`</g>`;
  base=base.replace(/<text x="1352" y="660"[\s\S]*?<text x="1466" y="684"[^>]*>[\s\S]*?<\/text>/,quadroIndividual);
 }
 base=replaceTextLines(base,1240,552,ctx.owners?.length?ctx.owners:[ctx.owner]);
 base=replaceText(base,1432,840,s.technician);
 base=base.replace(/(<text[^>]*data-live-field="mapTitle"[^>]*>)[\s\S]*?(<\/text>)/,(_,a,b)=>a+esc(s.title)+b);
 base=base.replace(/(<text[^>]*data-live-field="mapSheetNumber"[^>]*>)[\s\S]*?(<\/text>)/,(_,a,b)=>a+esc(s.sheet)+b);
 base=base.replace(/(<text[^>]*data-live-field="mapScale"[^>]*>)[\s\S]*?(<\/text>)/,(_,a,b)=>a+esc(s.scale)+b);
 base=base.replace(/(<text[^>]*data-live-field="mapScaleGraphic"[^>]*>)[\s\S]*?(<\/text>)/,(_,a,b)=>a+esc('Escala Gráfica '+s.scale)+b);
 base=base.replace(/(<line x1="958" y1="414")/,`<text x="1109" y="346" font-size="13">${esc(s.registry)}</text><text x="1109" y="367" font-size="13">${esc(s.reference)}</text><text x="1109" y="388" font-size="13">${esc(s.incra)}</text><text x="1109" y="409" font-size="13">${esc(s.cib)}</text>$1`);
 base=base.replace(/<image data-live-asset-value="miniMap"[^>]*\/>/,'');
 base=base.replace(/<g data-mini-map-perimeter="">[\s\S]*?<\/g>/,'');
 // Minimapa: a imagem usa o enquadramento de TODAS as glebas, mas
 // NÃO conecta vértices de polígonos diferentes (isso criava o laço cruzado).
 const cameraPoly=isComposite&&divisions.length>1?{
  ...poly,vertices:divisionBounds(divisions)
 } : poly;
 const miniMap=mapLayout(cameraPoly,330,210,0,s.background==='street'?'street':'satellite');
 const miniBg=(s.background==='vector'||s.background==='none')?'':miniMap.tiles.map(t=>`<image href="${esc(t.url)}" x="${fixed(964+t.left)}" y="${fixed(644+t.top)}" width="${t.tileSize||256}" height="${t.tileSize||256}" preserveAspectRatio="none"/>`).join('');
 const miniProject=(p:[number,number])=>{
  const z=256*2**miniMap.zoom;
  const latitude=Math.max(-85,Math.min(85,p[1]))*Math.PI/180;
  const x=(p[0]+180)/360*z;
  const y=(1-Math.asinh(Math.tan(latitude))/Math.PI)/2*z;
  const centerLatitude=Math.max(-85,Math.min(85,miniMap.center[1]))*Math.PI/180;
  const cy=(1-Math.asinh(Math.tan(centerLatitude))/Math.PI)/2*z;
  const cx=(miniMap.center[0]+180)/360*z;
  return {x:964+165+x-cx,y:644+105+y-cy};
 };
 const miniAreas=isComposite&&divisions.length>1?divisions:[{
  featureId:poly.id,partIndex:0,category:'',name:poly.name,areaM2:poly.areaM2,
  perimeterM:poly.perimeterM,rings:[poly.vertices]
 }];
 // O mesmo sistema WGS84 do minimapa posiciona as servidões:
 // nunca reutilizar diretamente os pixels do desenho principal neste quadro.
 const croquiRoads=ctx.croqui?.easements||[];
 const croquiLayout=ctx.croqui?layoutForCroqui(poly,ctx.croqui,divisions):null;
 const croquiFrame={x:44,y:74,w:1112,h:590};
 const miniCroquiRoads=croquiRoads.filter(road=>road.visible!==false&&!road.id.startsWith('sheet:')).map((road,i)=>{
  if(!croquiLayout)return '';
  const geoPoints=validGeoPoints(road.geoPoints)?road.geoPoints:road.points.map(p=>framePointToGeo(p,croquiFrame,croquiLayout.zoom,croquiLayout.center));
  if(geoPoints.length<2)return '';
  const center=geoPoints.map(miniProject);
  const width=Math.max(.6,road.width*2**(miniMap.zoom-croquiLayout.zoom));
  const {left,right}=roadBoundaries(smoothRoadCenterline(center),width);
  if(left.length<2)return '';
  return `<polygon data-sheet-mini-croqui-road="${i}" points="${svgPoints([...left,...right.slice().reverse()])}" fill="none" stroke="${esc(validColor(road.color,'#2563eb'))}" stroke-width="1.8" stroke-linejoin="round"/>`;
 }).join('');
 const miniSheetRoads=(s.sheetRoads||[]).map((road,i)=>{
  const screenPoints=validGeoPoints(road.geoPoints)?road.geoPoints.map(project):road.points;
  const original=roadBoundaries(smoothRoadCenterline(screenPoints),road.width);
  if(original.left.length<2)return '';
  const points=[...original.left,...original.right.slice().reverse()].map(point=>miniProject(unproject(point)));
  return `<polygon data-sheet-mini-local-road="${i}" points="${svgPoints(points)}" fill="none" stroke="${esc(validColor(road.color,'#16a34a'))}" stroke-width="1.8" stroke-linejoin="round"/>`;
 }).join('');
 const miniPerimeters=miniAreas.map((area,index)=>{
  const color=isComposite?sheetDivisionColor(area,index,s.divisionColors):s.polygonStroke;
  const rings=area.rings.filter(ring=>ring.length>=3).map(ring=>`M ${ring.map(miniProject).map(p=>`${fixed(p.x)} ${fixed(p.y)}`).join(' L ')} Z`).join(' ');
  return `<g data-sheet-mini-division="${esc(area.featureId)}"><path d="${rings}" fill="${esc(color)}" fill-opacity=".18" fill-rule="evenodd" stroke="${esc(color)}" stroke-width="1.6"/></g>`;
 }).join('');
 const miniOverlay=`<defs><clipPath id="sheet-mini-clip"><rect x="964" y="644" width="330" height="210"/></clipPath></defs>
 <g clip-path="url(#sheet-mini-clip)"><rect x="964" y="644" width="330" height="210" fill="#edf2f7"/>
 <g opacity="${s.miniOpacity/100}">${miniBg}</g>${miniPerimeters}${miniCroquiRoads}${miniSheetRoads}</g>`;
 base=base.replace(/(<rect x="964" y="644" width="330" height="210"[^>]*\/>)/,`$1${miniOverlay}`);
 base=base.replace(/<text x="1026" y="930"[^>]*>[\s\S]*?<\/text>/,`<text x="1026" y="930" font-size="9">${esc(fitText(ctx.publicUrl,75))}</text>`);
 base=base.replace(/<text x="1026" y="942"[^>]*>[\s\S]*?<\/text>/,'');
 base=base.replace(/<image[^>]*x="966" y="920"[^>]*\/>/,'');
 if(/^https?:\/\//i.test(ctx.publicUrl)){
  const qr=qrCodeDataUrl(ctx.publicUrl,2);
  if(qr)base=base.replace(/(<text x="966" y="910"[^>]*>[\s\S]*?<\/text>)/,`$1<image href="${esc(qr)}" x="966" y="920" width="44" height="44"/>`);
  else base=base.replace(/<text x="966" y="910"[^>]*>[\s\S]*?<\/text>/,'<text x="966" y="910" font-size="8" fill="#475569"><tspan x="966">QR indisponível para este link.</tspan><tspan x="966" dy="12">Copie o link completo no SURVEYOR.</tspan></text>');
 }
 const logoValid=typeof ctx.logo==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(ctx.logo);
 if(logoValid){
  base=base.replace(/(<image data-live-asset="logo" href=")[^"]+(")/,(_,a:string,b:string)=>a+esc(ctx.logo!)+b);
 }else{
  base=base.replace(/<image data-live-asset="logo"[^>]*\/>/,'');
 }
 // O template original pode conter uma assinatura de exemplo. Não reutilizá-la
 // como se fosse a assinatura do usuário autenticado.
 base=base.replace(/<image\b[^>]*data-document-signature="1"[^>]*\/>/g,'');
 base=base.replace(/<image(?![^>]*data-live-asset="logo")[^>]*x="740" y="466"[^>]*\/>/g,'');
 if(!ctx.previewSignatureOverlay&&s.signatureEnabled&&/^data:image\/(png|jpeg|webp);base64,/i.test(s.signature)){
  const {x,y,width,height}=sheetSignatureBox(s);
  const topLayer=`<g data-sheet-signature="1" aria-label="Assinatura técnica" style="cursor:grab;touch-action:none"><rect x="${fixed(x)}" y="${fixed(y)}" width="${fixed(width)}" height="${fixed(height)}" fill="transparent" pointer-events="all"/><image href="${esc(s.signature)}" x="${fixed(x)}" y="${fixed(y)}" width="${fixed(width)}" height="${fixed(height)}" preserveAspectRatio="xMidYMid meet" pointer-events="none"/></g>`;
  base=base.replace(/<\/svg>\s*$/,`${topLayer}</svg>`);
 }
 // Nomes livres são sempre renderizados, mesmo que o modelo SVG já possua outros rótulos.
 const sharedNames=normalizeMapNames(s.mapNames).filter(name=>!s.hiddenLabels.includes(`map-name:${name.id}`)).map(name=>{
  const point=project([name.lon,name.lat]);
  return `<text data-sheet-label="map-name:${esc(name.id)}" data-sheet-base-x="${fixed(point.x)}" data-sheet-base-y="${fixed(point.y)}" data-sheet-visual-y="${fixed(point.y)}" x="${fixed(point.x)}" y="${fixed(point.y)}" font-size="${fixed(name.size)}" font-weight="600" fill="${esc(name.color)}" text-anchor="middle" transform="rotate(${fixed(name.angle)} ${fixed(point.x)} ${fixed(point.y)})" style="cursor:grab;user-select:none;touch-action:none">${esc(name.text)}</text>`;
 }).join('');
 if(sharedNames)base=base.replace(/<\/svg>\s*$/,`<g data-sheet-shared-map-names="true">${sharedNames}</g></svg>`);
 return clean(base);
}
