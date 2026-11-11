import { isCompositeBaseCategory } from '../croqui/compositeMeasures';

export type PublicVertex=[number,number];
export type PublicPolygon=PublicVertex[][];
export type PublicMapData={n:string;parts:PublicPolygon[]};

export function publicMapVertexCount(parts:PublicPolygon[]):number{
 return parts.reduce((total,polygon)=>total+polygon.reduce((polygonTotal,ring)=>{
  const first=ring[0],last=ring[ring.length-1];
  const closed=ring.length>1&&first[0]===last[0]&&first[1]===last[1];
  return polygonTotal+ring.length-(closed?1:0);
 },0),0);
}

const MAX_DATA_LENGTH=100_000;
const MAX_VERTICES_PER_RING=800;
const MAX_RINGS_PER_POLYGON=64;
const MAX_POLYGONS=256;
const MAX_TOTAL_VERTICES=MAX_VERTICES_PER_RING*8;

type PolygonLike={vertices:PublicVertex[];holes?:PublicVertex[][];properties?:Record<string,unknown>};

export function publicMapParts<T extends PolygonLike>(polygons:T[],selected:T|null,composite:boolean):PublicPolygon[]{
 const divisions=composite?polygons.filter(polygon=>!isCompositeBaseCategory(polygon.properties?.category)):[];
 const source=composite?(divisions.length?divisions:polygons):selected?[selected]:[];
 return source.map(polygon=>[polygon.vertices,...(polygon.holes||[])]);
}

function validRing(ring:PublicVertex[]):boolean{
 return Array.isArray(ring)&&ring.length>=3&&ring.length<=MAX_VERTICES_PER_RING&&ring.every(vertex=>
  Array.isArray(vertex)&&typeof vertex[0]==='number'&&typeof vertex[1]==='number'&&Number.isFinite(vertex[0])&&Number.isFinite(vertex[1])&&Math.abs(vertex[0])<=180&&Math.abs(vertex[1])<=90
 );
}

export function buildPublicMapUrl(origin:string,name:string,parts:PublicPolygon[]):string{
 if(!Array.isArray(parts)||!parts.length||parts.length>MAX_POLYGONS||parts.some(polygon=>
  !Array.isArray(polygon)||polygon.length<1||polygon.length>MAX_RINGS_PER_POLYGON||polygon.some(ring=>!validRing(ring))
 ))return '';
 const total=parts.reduce((sum,polygon)=>sum+polygon.reduce((ringSum,ring)=>ringSum+ring.length,0),0);
 if(total>MAX_TOTAL_VERTICES)return '';
 const data=JSON.stringify({n:name,parts});
 if(data.length>MAX_DATA_LENGTH)return '';
 try{
  const url=new URL('/publico/imovel/',origin);
  url.searchParams.set('dados',data);
  return url.href;
 }catch{return '';}
}

export function publicMapUrlForProject<T extends PolygonLike>(
 origin:string,name:string,polygons:T[],selected:T|null,composite:boolean,savedUrl=''
):string{
 if(!composite&&/^https?:\/\//i.test(savedUrl)){
  try{
   const saved=new URL(savedUrl);
   const currentMapPath=/\/publico\/imovel\/?$/i.test(saved.pathname);
   const publicMapRoute=/\/publico\/imovel(?:\/|$)/i.test(saved.pathname);
   if(!publicMapRoute||currentMapPath&&parsePublicMapData(saved.searchParams.get('dados')))return savedUrl;
  }catch{/* Recria links malformados usando as coordenadas do imóvel selecionado. */}
 }
 const parts=publicMapParts(polygons,selected,composite).map(polygon=>
  polygon.map(ring=>ring.map(([lng,lat])=>[Number(lng.toFixed(7)),Number(lat.toFixed(7))] as PublicVertex))
 );
 return buildPublicMapUrl(origin,name,parts);
}

function readRing(value:unknown):PublicVertex[]|null{
 if(!Array.isArray(value)||value.length<3||value.length>MAX_VERTICES_PER_RING)return null;
 const vertices:PublicVertex[]=[];
 for(const point of value){
  if(!Array.isArray(point)||point.length<2||typeof point[0]!=='number'||typeof point[1]!=='number')return null;
  if(!Number.isFinite(point[0])||!Number.isFinite(point[1])||Math.abs(point[0])>180||Math.abs(point[1])>90)return null;
  vertices.push([point[0],point[1]]);
 }
 return vertices;
}

export function parsePublicMapData(input:string|null):PublicMapData|null{
 if(!input||input.length>MAX_DATA_LENGTH)return null;
 try{
  const raw=JSON.parse(input) as {n?:unknown;v?:unknown;parts?:unknown};
  const source=Array.isArray(raw.parts)?raw.parts:Array.isArray(raw.v)?[raw.v]:null;
  if(!source||source.length<1||source.length>MAX_POLYGONS)return null;
  const parts:PublicPolygon[]=[];
  let total=0;
  for(const candidate of source){
   if(!Array.isArray(candidate)||!candidate.length)return null;
   // Links antigos guardavam cada componente como um anel externo plano.
   // O formato atual guarda cada componente como [anel externo, vazios...].
   const rawRings=Array.isArray(candidate[0])&&typeof candidate[0][0]==='number'?[candidate]:candidate;
   if(!rawRings.length||rawRings.length>MAX_RINGS_PER_POLYGON)return null;
   const polygon:PublicPolygon=[];
   for(const rawRing of rawRings){
    const ring=readRing(rawRing);
    if(!ring)return null;
    total+=ring.length;
    if(total>MAX_TOTAL_VERTICES)return null;
    polygon.push(ring);
   }
   parts.push(polygon);
  }
  return {n:String(raw.n||'Imóvel rural').slice(0,120),parts};
 }catch{return null;}
}
