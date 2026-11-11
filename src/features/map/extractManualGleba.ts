import type {Feature,Geometry,GeoJsonProperties} from 'geojson';
import * as polygonClippingModule from 'polygon-clipping';
import type {MultiPolygon,Pair,Polygon} from 'polygon-clipping';
import {measureMapGeometry} from './geometryMetrics';

type F=Feature<Geometry,GeoJsonProperties>;
type Position=number[];
type Ring=Position[];
type XY=[number,number];
type SourceSegment={a:Position;b:Position;xyA:XY;xyB:XY};
const polygonClipping=(polygonClippingModule as unknown as {default:Pick<typeof import('polygon-clipping'),'difference'|'intersection'>}).default;

const sameXY=(a:Position,b:Position)=>a[0]===b[0]&&a[1]===b[1];
const cross=(a:Position,b:Position,c:Position)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const coordinateTolerance=(...points:Position[])=>Number.EPSILON*32*Math.max(1,...points.flatMap(point=>point.slice(0,2).map(Math.abs)));
const orientation=(a:Position,b:Position,c:Position)=>{
 const value=cross(a,b,c);
 const tolerance=Number.EPSILON*32*(Math.abs((b[0]-a[0])*(c[1]-a[1]))+Math.abs((b[1]-a[1])*(c[0]-a[0])));
 return Math.abs(value)<=tolerance?0:value>0?1:-1;
};
const onSegment=(p:Position,a:Position,b:Position)=>{
 const tolerance=coordinateTolerance(p,a,b);
 return orientation(a,b,p)===0&&p[0]>=Math.min(a[0],b[0])-tolerance&&p[0]<=Math.max(a[0],b[0])+tolerance&&p[1]>=Math.min(a[1],b[1])-tolerance&&p[1]<=Math.max(a[1],b[1])+tolerance;
};
const intersects=(a:Position,b:Position,c:Position,d:Position)=>{
 const c1=orientation(a,b,c),c2=orientation(a,b,d),c3=orientation(c,d,a),c4=orientation(c,d,b);
 return (c1*c2<0&&c3*c4<0)||(c1===0&&onSegment(c,a,b))||(c2===0&&onSegment(d,a,b))||(c3===0&&onSegment(a,c,d))||(c4===0&&onSegment(b,c,d));
};
const edges=(ring:Ring)=>ring.slice(0,-1).map((a,i)=>[a,ring[i+1]] as const);
const boundariesIntersect=(a:Ring,b:Ring)=>edges(a).some(([a1,a2])=>edges(b).some(([b1,b2])=>intersects(a1,a2,b1,b2)));

function closeRing(raw:unknown,label:string):Ring{
 if(!Array.isArray(raw)||raw.length<3)throw new Error(label+' precisa ter ao menos três vértices.');
 const ring=raw.map((position:unknown)=>{
  if(!Array.isArray(position)||position.length<2||!position.every(Number.isFinite)||Math.abs(position[0])>180||Math.abs(position[1])>90)throw new Error(label+' contém coordenadas inválidas.');
  return [...position] as number[];
 });
 if(sameXY(ring[0],ring.at(-1)!))ring[ring.length-1]=[...ring[0]];
 else ring.push([...ring[0]]);
 if(ring.length<4)throw new Error(label+' precisa ter ao menos três vértices distintos.');
 return ring;
}

function signedArea2(ring:Ring){
 const origin=ring[0];let area=0;
 for(let i=1;i<ring.length-2;i++)area+=cross(origin,ring[i],ring[i+1]);
 return area;
}

function validateRing(ring:Ring,label:string){
 const vertices=ring.slice(0,-1),unique=new Set(vertices.map(point=>point[0]+','+point[1]));
 if(unique.size<3)throw new Error(label+' precisa ter ao menos três vértices distintos.');
 if(vertices.some((point,index)=>sameXY(point,vertices[(index+1)%vertices.length])))throw new Error(label+' contém um segmento de comprimento zero.');
 const ringEdges=edges(ring);
 for(let i=0;i<ringEdges.length;i++)for(let j=i+1;j<ringEdges.length;j++){
  if(!intersects(...ringEdges[i],...ringEdges[j]))continue;
  const adjacent=j===i+1||(i===0&&j===ringEdges.length-1);
  if(!adjacent)throw new Error(label+' possui autointerseção ou toca a si próprio. Corrija os vértices antes da extração.');
  const [a,b]=ringEdges[i],[c,d]=ringEdges[j];
  const shared=sameXY(b,c)?b:sameXY(a,d)?a:null;
  if(!shared)throw new Error(label+' possui autointerseção. Corrija os vértices antes da extração.');
  const first=shared===b?a:b,second=shared===b?d:c;
  if(orientation(shared,first,second)===0&&(onSegment(first,shared,second)||onSegment(second,shared,first)))throw new Error(label+' possui segmentos sobrepostos. Corrija os vértices antes da extração.');
 }
 const area=signedArea2(ring);
 const magnitude=ringEdges.reduce((sum,[a,b])=>sum+Math.abs((a[0]-ring[0][0])*(b[1]-ring[0][1])-(a[1]-ring[0][1])*(b[0]-ring[0][0])),0);
 if(!Number.isFinite(area)||Math.abs(area)<=Number.EPSILON*64*magnitude)throw new Error(label+' não delimita uma área válida.');
}

function inside(point:Position,ring:Ring){
 let isInside=false;
 for(let i=0,j=ring.length-2;i<ring.length-1;j=i++){
  const a=ring[i],b=ring[j];
  if(onSegment(point,a,b))return false;
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])isInside=!isInside;
 }
 return isInside;
}

function normalizeWinding(ring:Ring,counterClockwise:boolean):Ring{
 const shouldReverse=(signedArea2(ring)>0)!==counterClockwise;
 if(!shouldReverse)return ring.map(point=>[...point]);
 const vertices=ring.slice(0,-1),reversed=[vertices[0],...vertices.slice(1).reverse()].map(point=>[...point]);
 reversed.push([...reversed[0]]);
 return reversed;
}

function validateParentRings(rings:Ring[]){
 const [outer,...holes]=rings;
 if(!outer)throw new Error('O imóvel original não possui um anel externo válido.');
 validateRing(outer,'O perímetro original');
 for(let i=0;i<holes.length;i++){
  const hole=holes[i];validateRing(hole,'O anel interno '+(i+1));
  if(!hole.slice(0,-1).every(point=>inside(point,outer))||boundariesIntersect(outer,hole))throw new Error('O anel interno '+(i+1)+' não está totalmente contido no perímetro original.');
  for(let j=0;j<i;j++)if(boundariesIntersect(holes[j],hole)||inside(hole[0],holes[j])||inside(holes[j][0],hole))throw new Error('O imóvel original possui anéis internos sobrepostos ou aninhados; corrija a geometria antes da extração.');
 }
}

function toClipPolygon(rings:Ring[],project:(position:Position)=>XY):Polygon{
 return rings.map(ring=>ring.map(position=>project(position) as Pair));
}

function sourceSegments(rings:Ring[][],project:(position:Position)=>XY):SourceSegment[]{
 return rings.flatMap(polygon=>polygon.flatMap(ring=>edges(ring).map(([a,b])=>({a,b,xyA:project(a),xyB:project(b)}))));
}

function restorePosition(xy:Pair,segments:SourceSegment[],unproject:(point:XY)=>XY):Position{
 const [lon,lat]=unproject(xy);
 let best:SourceSegment|null=null,bestT=0,bestDistance=Infinity;
 for(const segment of segments){
  const dx=segment.xyB[0]-segment.xyA[0],dy=segment.xyB[1]-segment.xyA[1],lengthSquared=dx*dx+dy*dy;
  if(lengthSquared===0)continue;
  const t=((xy[0]-segment.xyA[0])*dx+(xy[1]-segment.xyA[1])*dy)/lengthSquared;
  if(t<-.00001||t>1.00001)continue;
  const nearestX=segment.xyA[0]+Math.min(1,Math.max(0,t))*dx,nearestY=segment.xyA[1]+Math.min(1,Math.max(0,t))*dy;
  const distance=Math.hypot(xy[0]-nearestX,xy[1]-nearestY);
  if(distance<bestDistance){best=segment;bestT=Math.min(1,Math.max(0,t));bestDistance=distance;}
 }
 if(!best||bestDistance>.25)return [lon,lat];
 const dimensions=Math.max(best.a.length,best.b.length),position:Position=[lon,lat];
 for(let dimension=2;dimension<dimensions;dimension++){
  const a=best.a[dimension],b=best.b[dimension];
  if(Number.isFinite(a)&&Number.isFinite(b))position[dimension]=a+(b-a)*bestT;
  else if(Number.isFinite(a))position[dimension]=a;
  else if(Number.isFinite(b))position[dimension]=b;
 }
 return position;
}

function geometryFromClip(result:MultiPolygon,segments:SourceSegment[],unproject:(point:XY)=>XY):Geometry{
 const polygons=result.map(polygon=>polygon.map((ring,index)=>{
  const restored=ring.map(point=>restorePosition(point,segments,unproject));
  const closed=closeRing(restored,index===0?'O perímetro recortado':'O anel interno recortado');
  return normalizeWinding(closed,index===0);
 }));
 if(!polygons.length)throw new Error('O recorte não deixou uma área utilizável no imóvel original.');
 return polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
}

/** Recorta a área desenhada do imóvel. A parte de fora do imóvel é descartada,
 * e o restante pode formar uma reentrância ou vários polígonos separados.
 */
export function extractManualGleba(parent:F,manual:F):{remainder:F;gleba:F}{
 if(parent.geometry.type!=='Polygon'||manual.geometry.type!=='Polygon')throw new Error('A extração manual exige um imóvel original e uma gleba desenhada como polígonos simples.');
 if(manual.geometry.coordinates.length!==1)throw new Error('A gleba manual possui anéis internos, que não podem ser usados como área de corte.');

 const parentRings=parent.geometry.coordinates.map((ring,index)=>closeRing(ring,index===0?'O perímetro original':'O anel interno '+index));
 const child=closeRing(manual.geometry.coordinates[0],'A gleba desenhada');
 validateParentRings(parentRings);validateRing(child,'A gleba desenhada');
 const holes=parentRings.slice(1);
 if(holes.some(hole=>boundariesIntersect(hole,child)||child.slice(0,-1).some(point=>inside(point,hole))||hole.slice(0,-1).some(point=>inside(point,child))))throw new Error('A gleba desenhada ocupa ou envolve um vazio já cadastrado no imóvel original. Ajuste o desenho antes da extração.');

 const originalPositions:Ring[][]=[parentRings,[child]];
 const allPositions=originalPositions.flat(2);
 const originLon=allPositions.reduce((sum,point)=>sum+point[0],0)/allPositions.length;
 const originLat=allPositions.reduce((sum,point)=>sum+point[1],0)/allPositions.length;
 const scale=6378137*Math.PI/180,cosLat=Math.cos(originLat*Math.PI/180);
 if(!Number.isFinite(cosLat)||Math.abs(cosLat)<1e-6)throw new Error('A localização está próxima dos polos e não pode ser recortada com segurança.');
 const project=(position:Position):XY=>[(position[0]-originLon)*scale*cosLat,(position[1]-originLat)*scale];
 const unproject=(point:XY):XY=>[originLon+point[0]/(scale*cosLat),originLat+point[1]/scale];
 const parentClip:MultiPolygon=[toClipPolygon(parentRings,project)];
 const childClip:MultiPolygon=[toClipPolygon([child],project)];
 let remainderClip:MultiPolygon,childIntersection:MultiPolygon;
 try{remainderClip=polygonClipping.difference(parentClip,childClip);childIntersection=polygonClipping.intersection(parentClip,childClip);}
 catch(error){throw new Error(error instanceof Error?'Não foi possível concluir o recorte geométrico: '+error.message:'Não foi possível concluir o recorte geométrico.');}
 if(!childIntersection.length)throw new Error('A gleba desenhada não intersecta o imóvel original. Nenhuma feição foi alterada.');
 if(!remainderClip.length)throw new Error('A gleba desenhada cobre todo o imóvel. O recorte precisa deixar uma área remanescente.');

 const originalArea=measureMapGeometry(parent.geometry).areaM2;
 const segments=sourceSegments(originalPositions,project);
 const remainderGeometry=geometryFromClip(remainderClip,segments,unproject);
 const childGeometry=geometryFromClip(childIntersection,segments,unproject);
 const remainderArea=measureMapGeometry(remainderGeometry).areaM2;
 const childArea=measureMapGeometry(childGeometry).areaM2;
 if(remainderArea<1||childArea<1)throw new Error('O recorte gerou uma área pequena demais para ser aplicada.');
 if(Math.abs(remainderArea+childArea-originalArea)/Math.max(1,originalArea)>.01)throw new Error('A conferência das áreas falhou. Nenhuma feição foi alterada.');

 const color=String(manual.properties?.lotColor||manual.properties?.fillColor||'#16a34a');
 return {
  remainder:{...parent,geometry:remainderGeometry,properties:{...(parent.properties||{}),areaRemanescente:true}},
  gleba:{...manual,geometry:childGeometry,properties:{...(manual.properties||{}),category:'Gleba',parentFeatureId:String(parent.id),lotColor:color,fillColor:color,strokeColor:color,fillOpacity:0.28,extractedFromParent:true}}
 };
}
