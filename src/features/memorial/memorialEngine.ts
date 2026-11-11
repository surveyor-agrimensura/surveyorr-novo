import {projectWgs84ToUtm} from '../../lib/wgs84Utm';
import type {Project,ProjectFeature} from '../projects/projectsApi';
import {readConfrontation} from '../croqui/croquiGeometry';
import {projectPolygonGeometries} from '../croqui/projectGeojsonGeometry';
import {readOpenLonLatRing} from '../../lib/geoJsonRings';
import {sphericalDistanceM, sphericalRingAreaM2} from '../../lib/sphericalGeodesy';

export type Vertex=[number,number]; // longitude, latitude, WGS84
export type CoordinateDisplayMode='wgs84'|'utm'|'both';


export type SurveyPolygon={id:string;name:string;vertices:Vertex[];holes?:Vertex[][];properties:Record<string,unknown>;areaM2:number;perimeterM:number};
export type MemorialFields={kind:string;reference:string;incra:string;cib:string;owner:string;ownerDocument:string;ownerRg:string;district:string;notes:string};
export const text=(v:unknown):string=>typeof v==='string'||typeof v==='number'?String(v):'';
export const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function getPolygons(features:ProjectFeature[]):SurveyPolygon[]{
 return features.filter(f=>(f as {isVisible?:boolean}).isVisible!==false&&record(f.properties).hidden!==true).flatMap((feature,i)=>{
  const geometries=projectPolygonGeometries(feature.geoJson||feature.geometry);
  const parts:unknown[]=geometries.flatMap(g=>g.type==='Polygon'?[g.coordinates]:Array.isArray(g.coordinates)?g.coordinates:[]);
  return parts.flatMap((part,partIndex)=>{
   if(!Array.isArray(part)||!Array.isArray(part[0]))return [];
   const vertices=readOpenLonLatRing(part[0]);
   if(vertices.length<3)return [];
   const props=record(feature.properties);
   const rawId=text(feature.id)||String(i);
   const id=partIndex===0?rawId:`${rawId}:parte-${partIndex+1}`;
   const baseName=text(props.name)||text(feature.name)||`Feição ${i+1}`;
   const name=partIndex===0?baseName:`${baseName} — Parte ${partIndex+1}`;
   const holes=(part as unknown[]).slice(1).map(readOpenLonLatRing).filter(ring=>ring.length>=3);
   const areaM2=Math.max(0,polygonArea(vertices)-holes.reduce((total,ring)=>total+polygonArea(ring),0));
   const perimeterM=[vertices,...holes].reduce((total,ring)=>total+ring.reduce((sum,p,k)=>sum+distance(p,ring[(k+1)%ring.length]),0),0);
   return [{id,name,vertices,holes,properties:{...props,sourceFeatureId:rawId,partIndex},areaM2,perimeterM}];
  });
 });
}
export function distance(a:Vertex,b:Vertex){return sphericalDistanceM(a,b);}
export function azimuth(a:Vertex,b:Vertex){const r=Math.PI/180;const dlon=(b[0]-a[0])*r,p1=a[1]*r,p2=b[1]*r;const y=Math.sin(dlon)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dlon);return(Math.atan2(y,x)*180/Math.PI+360)%360;}
// Área aproximada da superfície esférica. Não substitui levantamento ou cálculo geodésico em CRS apropriado.
export function polygonArea(v:Vertex[]){return sphericalRingAreaM2(v);}
export const fmt=(n:number,dec=2)=>n.toLocaleString('pt-BR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
export function vertexName(i:number){return `V-${String(i+1).padStart(2,'0')}`;}
export const coords=(p:Vertex)=>`${p[1].toFixed(7)}°; ${p[0].toFixed(7)}°`;
export function formatAzimuth(n:number){const tenths=Math.round((((n%360)+360)%360)*36000)%(360*36000),deg=Math.floor(tenths/36000),remaining=tenths-deg*36000,min=Math.floor(remaining/600),sec=(remaining-min*600)/10;return `${deg}°${String(min).padStart(2,'0')}'${fmt(sec,1).padStart(4,'0')}\"`;}
export function segmentNeighbor(p:SurveyPolygon,i:number){
 return readConfrontation(p.properties,i,p.vertices.length);
}
export function formatVertexCoord(v:Vertex,mode:CoordinateDisplayMode='wgs84'){
 const geo=`latitude ${v[1].toFixed(7)}° e longitude ${v[0].toFixed(7)}° (WGS 84)`;
 if(mode==='wgs84')return geo;
 try{
  const u=projectWgs84ToUtm([v[0],v[1]]);
  const utmText=`coordenadas planas UTM E = ${fmt(u.east,3)} m e N = ${fmt(u.north,3)} m (Fuso ${u.zone}${u.hemisphere} · SIRGAS 2000 / WGS 84)`;
  return mode==='utm'?utmText:`${geo} / ${utmText}`;
 }catch{
  return geo;
 }
}
export function memorialNarrative(p:SurveyPolygon, vertexNames?:string[], coordMode:CoordinateDisplayMode='wgs84'){
 const label=(i:number)=>vertexNames?.[i]?.trim()||vertexName(i);
 const v=p.vertices;
 if(!v.length)return '';
 const parts=[`Inicia-se a descrição do perímetro no vértice ${label(0)}, de ${formatVertexCoord(v[0],coordMode)}.`];
 for(let i=0;i<v.length;i++){
  const next=(i+1)%v.length;const other=segmentNeighbor(p,i);const detail=record(record(p.properties.confrontantDetails)[String(i)]);const limit=text(detail.limitType);parts.push(`Deste, segue até o vértice ${label(next)}, de ${formatVertexCoord(v[next],coordMode)}, com azimute aproximado ${formatAzimuth(azimuth(v[i],v[next]))} e distância aproximada de ${fmt(distance(v[i],v[next]))} m${other?`, confrontando com ${other}`:''}${limit?`, pelo limite do tipo ${limit}`:''}.`);
 }
 (p.holes||[]).filter(ring=>ring.length>=3).forEach((ring,ringIndex)=>{
  const holeLabel=(i:number)=>`I${ringIndex+1}-V${String(i+1).padStart(2,'0')}`;
  parts.push(`O contorno interno ${ringIndex+1} inicia no vértice ${holeLabel(0)}, de ${formatVertexCoord(ring[0],coordMode)}.`);
  for(let i=0;i<ring.length;i++){
   const next=(i+1)%ring.length;
   parts.push(`Deste, segue até ${holeLabel(next)}, de ${formatVertexCoord(ring[next],coordMode)}, com azimute aproximado ${formatAzimuth(azimuth(ring[i],ring[next]))} e distância aproximada de ${fmt(distance(ring[i],ring[next]))} m.`);
  }
  const holePerimeter=ring.reduce((sum,point,index)=>sum+distance(point,ring[(index+1)%ring.length]),0);
  parts.push(`O contorno interno ${ringIndex+1} delimita área excluída do polígono e possui perímetro de ${fmt(holePerimeter)} m.`);
 });
 parts.push(`A área cartográfica aproximada é ${fmt(p.areaM2/10000,4)} ha; o perímetro total da divisa, incluindo os contornos internos, é ${fmt(p.perimeterM)} m.`);
 return parts.join(' ');
}
export function initialFields(project:Project):MemorialFields{
 const metadata=record(project.metadata);
 return {kind:'Matrícula',reference:text(metadata.documentReference),incra:text(metadata.incra),cib:text(metadata.cib),owner:text(project.ownerName||project.owner),ownerDocument:text(metadata.ownerCpf),ownerRg:text(metadata.ownerRg),district:text(metadata.district),notes:''};
}
export type MapTile={x:number;y:number;left:number;top:number;url:string;tileSize?:number};
export type MapLayout={tiles:MapTile[];points:{x:number;y:number;name:string}[];holePoints:{x:number;y:number}[][];zoom:number;scaleMeters:number;scalePixels:number;center:Vertex};
const projected=(p:Vertex,zoom:number)=>{const z=256*2**zoom;return {x:(p[0]+180)/360*z,y:(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,p[1]))*Math.PI/180))/Math.PI)/2*z};};
export function mapLayout(poly:SurveyPolygon,width=650,height=315,extraZoom=0,base:'satellite'|'street'|'cloudless'='satellite',maxSourceZoom=19,overscanPx=0):MapLayout{
 const v=poly.vertices;let zoom=4;
 for(let z=4;z<=22;z++){
  const xs=v.map(p=>projected(p,z).x),ys=v.map(p=>projected(p,z).y);
  if(Math.max(...xs)-Math.min(...xs)>width*.70||Math.max(...ys)-Math.min(...ys)>height*.67)break;
  zoom=z;
 }
 zoom=Math.max(3,Math.min(25,zoom+extraZoom));
 const px=v.map(p=>projected(p,zoom));const cx=(Math.min(...px.map(p=>p.x))+Math.max(...px.map(p=>p.x)))/2,cy=(Math.min(...px.map(p=>p.y))+Math.max(...px.map(p=>p.y)))/2;
 const ox=cx-width/2,oy=cy-height/2;
 // Para zoom superior à resolução disponibilizada pelo provedor,
 // amplia os tiles da última resolução conhecida, sem pedir URLs inexistentes.
 // Provedores XYZ só aceitam níveis INTEIROS. O zoom da UI é fracionário (1% em 1%),
 // portanto use um tile de nível inteiro e amplie-o na mesma projeção WebMercator.
 const sourceZoom=Math.max(0,Math.floor(Math.min(zoom,base==='cloudless'?13:maxSourceZoom))), factor=2**(zoom-sourceZoom), tileSize=256*factor;
 // Uma margem de tiles evita faixas brancas quando a imagem é alinhada visualmente.
 const bleed=Math.min(2,Math.ceil(Math.max(0,Math.abs(overscanPx))/tileSize));
 const minX=Math.floor(ox/tileSize)-bleed,maxX=Math.floor((ox+width)/tileSize)+bleed,minY=Math.floor(oy/tileSize)-bleed,maxY=Math.floor((oy+height)/tileSize)+bleed;
 const tiles:MapTile[]=[];
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  const n=2**sourceZoom;if(y<0||y>=n)continue;const tileX=((x%n)+n)%n;
  const url=base==='cloudless'?`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/${sourceZoom}/${y}/${tileX}.jpg`:base==='satellite'?`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${sourceZoom}/${y}/${tileX}`:`https://tile.openstreetmap.org/${sourceZoom}/${tileX}/${y}.png`;
  tiles.push({x,y,left:x*tileSize-ox,top:y*tileSize-oy,url,tileSize});
 }
 const invLon=(cx/(256*2**zoom)*360-180),invLat=Math.atan(Math.sinh(Math.PI*(1-2*cy/(256*2**zoom))))*180/Math.PI;
 const metersPerPx=156543.03392*Math.cos(invLat*Math.PI/180)/2**zoom;
 const scaleMeters=[10,20,50,100,200,500,1000,2000,5000,10000,20000,50000,100000].find(n=>n/metersPerPx>=70)||100000;
 const holePoints=(poly.holes||[]).map(ring=>ring.map(point=>projected(point,zoom)).map(point=>({x:point.x-ox,y:point.y-oy})));
 return {tiles,points:px.map((p,i)=>({x:p.x-ox,y:p.y-oy,name:vertexName(i)})),holePoints,zoom,scaleMeters,scalePixels:scaleMeters/metersPerPx,center:[invLon,invLat]};
}
