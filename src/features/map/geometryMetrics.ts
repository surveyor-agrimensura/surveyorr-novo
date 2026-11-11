/** Áreas e perímetros aproximados em WGS84, com furos e MultiPolygon.
 * As métricas cartográficas não substituem levantamento certificado e não
 * representam a união espacial entre feições sobrepostas.
 */
import { sphericalDistanceM, sphericalRingAreaM2 } from '../../lib/sphericalGeodesy';

export type MapMetrics={areaM2:number;perimeterMeters:number;vertexCount:number;parts:number};
const validPoint=(p:unknown):p is number[]=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
function ringMetrics(raw:unknown):{areaM2:number;perimeterMeters:number;vertexCount:number}{
 if(!Array.isArray(raw)||!raw.every(validPoint)||raw.length<3)return {areaM2:0,perimeterMeters:0,vertexCount:0};
 const ring=raw.length>1&&raw[0][0]===raw.at(-1)![0]&&raw[0][1]===raw.at(-1)![1]?raw.slice(0,-1):raw;
 if(ring.length<3)return {areaM2:0,perimeterMeters:0,vertexCount:0};
 const vertices=ring as [number,number][];
 const perimeterMeters=vertices.reduce((sum,point,index)=>sum+sphericalDistanceM(point,vertices[(index+1)%vertices.length]),0);
 return {areaM2:sphericalRingAreaM2(vertices),perimeterMeters,vertexCount:ring.length};
}
export function measureMapGeometry(geometry:{type:string;coordinates?:unknown}):MapMetrics{
 const zero:MapMetrics={areaM2:0,perimeterMeters:0,vertexCount:0,parts:0};
 if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type)||!Array.isArray(geometry.coordinates))return zero;
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 let areaM2=0,perimeterMeters=0,vertexCount=0,parts=0;
 for(const polygon of polygons){
  if(!Array.isArray(polygon)||!polygon.length)continue;
  const rings=polygon.map(ringMetrics);
  areaM2+=Math.max(0,rings[0].areaM2-rings.slice(1).reduce((sum,item)=>sum+item.areaM2,0));
  perimeterMeters+=rings.reduce((sum,item)=>sum+item.perimeterMeters,0);
  vertexCount+=rings.reduce((sum,item)=>sum+item.vertexCount,0);
  parts++;
 }
 return {areaM2,perimeterMeters,vertexCount,parts};
}
