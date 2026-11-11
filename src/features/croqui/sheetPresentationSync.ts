/** Read-only adaptation of verified Prancha Técnica drafts for Croqui and Memorial.
 * Geometry and official calculations are never changed. Different page viewBoxes
 * require converting editor offsets and overlay points by the corresponding map
 * projections, not copying raw pixels. Prancha is authoritative for shared items.
 */
import {type SurveyPolygon} from '../memorial/memorialEngine';
import {frameCoordinates,layoutForCroqui,type CroquiSettings} from '../memorial/croquiRenderer';
import {readDocumentDraft} from '../documents/cloudDraft';
import {normalizeSheet,mapPointCoordinates,renderTechnicalSheet,type SheetSettings} from '../documents/technicalSheet';
import type {ProjectDivision} from './projectDivisions';
import {roadBoundaries,smoothRoadCenterline} from './croquiGeometry';

const validColor=(v:unknown):v is string=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const isFinitePoint=(point:{x:number;y:number})=>Number.isFinite(point.x)&&Number.isFinite(point.y);
export function readSheetLayout(options:unknown,projectId:string,featureId:string):SheetSettings|null{
 if(!projectId||!featureId)return null;
 const raw=readDocumentDraft(options,'technicalSheets',projectId,featureId,false);
 return Object.keys(raw).length>0?normalizeSheet(raw):null;
}
function coordinateConverter(poly:SurveyPolygon,sheet:SheetSettings,croqui:CroquiSettings,divisions:readonly ProjectDivision[],composite:boolean){
 const source=mapPointCoordinates(poly,sheet,divisions,composite);
 const target=frameCoordinates(layoutForCroqui(poly,croqui,divisions));
 const span=(values:number[])=>Math.max(...values)-Math.min(...values);
 const xs=source.map(v=>v.x),ys=source.map(v=>v.y),tx=target.map(v=>v.x),ty=target.map(v=>v.y);
 const xFactor=span(xs)>0.01?span(tx)/span(xs):1;
 const yFactor=span(ys)>0.01?span(ty)/span(ys):xFactor;
 const xOrigin=target[0].x-source[0].x*xFactor;
 const yOrigin=target[0].y-source[0].y*yFactor;
 return {xFactor,yFactor,point:(p:{x:number;y:number})=>({x:xOrigin+p.x*xFactor,y:yOrigin+p.y*yFactor})};
}
export function applySheetLayout(poly:SurveyPolygon,croqui:CroquiSettings,sheet:SheetSettings|null,divisions:readonly ProjectDivision[]=[],composite=false,fromComposite=false):CroquiSettings{
 if(!sheet)return croqui;
 // Newer manual Croqui adjustments take precedence until the Prancha is saved again.
 if(sheet.revision>0&&(croqui.syncRevision||0)>sheet.revision)return croqui;
 const {xFactor,yFactor,point}=coordinateConverter(poly,sheet,croqui,divisions,composite);
 const absoluteLabels:Record<string,{x:number;y:number}>={...croqui.absoluteLabels};
 // Map the sheet's semantic labels to the keys actually consumed by Croqui.
 // The old importer kept `division:feature:part:title`, while Croqui renders
 // that label as `feature` or `feature:parte-N`. Appearance was silently lost.
 const croquiKey=(key:string)=>{
  if(key==='property:title')return 'area:polygon';
  if(key==='property:area')return 'area:metrics';
  const title=/^division:(.+):(\d+):title$/.exec(key);
  if(title){const part=Number(title[2]);return part===0?title[1]:`${title[1]}:parte-${part+1}`;}
  return key;
 };
 // Read visual positions produced by the real sheet layout, including moves.
 const rendered=renderTechnicalSheet(poly,sheet,{
  municipality:'',owner:'',company:'',date:'',publicUrl:'',divisions,composite
 });
 for(const match of rendered.matchAll(/<text\b[^>]*data-sheet-label="([^"]+)"[^>]*>/g)){
  const attrs=match[0];const value=(name:string)=>{
   const found=attrs.match(new RegExp(`(?:\\s|^)${name}="([^"]+)"`));return found?.[1]||'';
  };
  const rawKey=match[1];
  // Croqui renders a single area/title label per part. The sheet also emits
  // a separate `:area` line, which cannot overwrite the title's position.
  if(/^division:.+:\d+:area$/.test(rawKey))continue;
  const key=croquiKey(rawKey);
  const x=Number(value('x')),y=Number(value('data-sheet-visual-y')||value('y'));
  if(Number.isFinite(x)&&Number.isFinite(y))absoluteLabels[key]=point({x,y});
 }
 const offsets={...croqui.labelOffsets};
 const colors={...croqui.labelColors};const angles={...croqui.labelAngles};
 const sizes={...croqui.labelSizes};
 for(const [key,offset] of Object.entries(sheet.labelOffsets)){
  if(!offset||!Number.isFinite(offset.dx)||!Number.isFinite(offset.dy))continue;
  const target=croquiKey(key);
  if(!absoluteLabels[target])offsets[target]={dx:offset.dx*xFactor,dy:offset.dy*yFactor};
  else delete offsets[target];
 }
 for(const [key,val] of Object.entries(sheet.labelColors))if(validColor(val))colors[croquiKey(key)]=val;
 for(const [key,val] of Object.entries(sheet.labelAngles))if(Number.isFinite(val))angles[croquiKey(key)]=val;
 for(const [key,val] of Object.entries(sheet.labelSizes))if(Number.isFinite(val))sizes[croquiKey(key)]=val;
 const sourceId=String(poly.properties.sourceFeatureId||poly.id);
 const partIndex=Number(poly.properties.partIndex||0);
 const partPrefix=`division:${sourceId}:${partIndex}`;
 const legacyPrefix=`${sourceId}:${partIndex}`;
 const areaNames=poly.vertices.map((_,index)=>(sheet.divisionVertexNames||{})[`${partPrefix}:vertex:${index}`]||(sheet.divisionVertexNames||{})[`${legacyPrefix}:vertex:${index}`]||croqui.names[index]||'');
 const areaNeighbors=poly.vertices.map((_,index)=>(sheet.divisionNeighbors||{})[`${partPrefix}:neighbor:${index}`]??(sheet.divisionNeighbors||{})[`${legacyPrefix}:neighbor:${index}`]??croqui.neighbors[index]??'');
 const areaDetails={...croqui.neighborDetails};
 for(let index=0;index<poly.vertices.length;index++){const key=`${partPrefix}:neighbor:${index}`;const detail=sheet.divisionNeighborDetails?.[key];if(detail)areaDetails[String(index)]=detail;}
 const areaHidden=poly.vertices.flatMap((_,index)=>((sheet.hiddenDivisionVertices||{})[`${partPrefix}:vertex:${index}`]||(sheet.hiddenDivisionVertices||{})[`${legacyPrefix}:vertex:${index}`])?[index]:[]);
 const elements={...croqui.elements};
 for(const key of ['cotas','gleba','vertices','confrontantes','norte'] as const){
  const item=sheet.elements[key];if(item)elements[key]={...item};
 }
 // The sheet contains absolute SVG canvas positions for manually drawn overlays.
 // Convert to the Croqui's coordinate frame instead of reusing those pixels.
 const lines=sheet.technicalLines.map(line=>{
  const a=point(line.start),b=point(line.end);
  return {id:`sheet:${line.id}`,from:0,start:a,x:b.x,y:b.y,color:line.color};
 }).filter(l=>isFinitePoint(l.start)&&Number.isFinite(l.x)&&Number.isFinite(l.y));
 const easements=sheet.sheetRoads.map(road=>{
  // Preserva o contorno das bordas já calculadas na Prancha Técnica.
  // Recalcular o buffer só depois de distorcer os pontos dos eixos X/Y
  // deformava as servidões em glebas estreitas ou oblíquas.
  const original=roadBoundaries(smoothRoadCenterline(road.points),road.width);
  const sourceEdges={left:original.left.map(point),right:original.right.map(point)};
  return {id:`sheet:${road.id}`,points:road.points.map(point),sourceEdges,
   color:road.color,width:Math.max(8,Math.min(90,road.width*(xFactor+yFactor)/2))};
 }).filter(road=>road.points.length>=2&&road.points.every(isFinitePoint));
 const featureStyles={...croqui.featureStyles};
 const featureNames={...croqui.featureNames};
 for(const [key,color] of Object.entries(sheet.divisionColors)){
  if(!validColor(color))continue;
  const partId=key.endsWith(':0')?key.slice(0,-2):key.replace(/:(\d+)$/,(_match,index)=>`:parte-${Number(index)+1}`);
  featureStyles[partId]={...featureStyles[partId],fillColor:color,strokeColor:color};
 }
 for(const [key,name] of Object.entries(sheet.divisionNames)){
  const partId=key.endsWith(':0')?key.slice(0,-2):key.replace(/:(\d+)$/,(_match,index)=>`:parte-${Number(index)+1}`);
  featureNames[partId]=name;
 }
 return {...croqui,
  // Satellite background is controlled in Croqui: the sheet preview may be vector-only.
  names:fromComposite?areaNames:sheet.names.length?sheet.names:croqui.names,
  neighbors:fromComposite?areaNeighbors:sheet.neighbors.length?sheet.neighbors:croqui.neighbors,
  neighborDetails:{...areaDetails,...sheet.neighborDetails},
  exteriorCotas:sheet.revision>0?sheet.exteriorCotas:croqui.exteriorCotas,
  elements,hiddenVertices:fromComposite?areaHidden:[...sheet.hiddenVertices],
  polygonFill:sheet.polygonFill,polygonStroke:sheet.polygonStroke,polygonStrokeWidth:sheet.polygonStrokeWidth,
  featureStyles,featureNames,
  customCotas:sheet.customCotas.length?sheet.customCotas:croqui.customCotas,
  tarefaM2:sheet.tarefaM2||croqui.tarefaM2,
  autoAreaTitle:!Boolean(sheet.labelOffsets['property:title']||sheet.labelOffsets['area:polygon']),
  labelOffsets:offsets,absoluteLabels,labelAngles:angles,labelColors:colors,labelSizes:sizes,
  lines:[...croqui.lines.filter(line=>!line.id.startsWith('sheet:')),...lines],
  easements:[...croqui.easements.filter(road=>!road.id.startsWith('sheet:')),...easements]
 };
}
export function sheetLayoutForProject(options:unknown,projectId:string,featureId:string,includeComposite=false):SheetSettings|null{
 return readSheetLayout(options,projectId,featureId)||(includeComposite?readSheetLayout(options,projectId,'__imovel_completo__'):null);
}
