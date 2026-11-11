/** Divisões existentes no projeto: leitura, nunca altera as coordenadas originais. */
import type { ProjectFeature } from '../projects/projectsApi';
import { distance, polygonArea, type Vertex } from '../memorial/memorialEngine';
import {projectPolygonGeometries} from './projectGeojsonGeometry';
import {readOpenLonLatRing} from '../../lib/geoJsonRings';

export type ProjectDivision = {
 featureId: string;
 partIndex: number;
 category: string;
 properties?: Record<string,unknown>;
 name: string;
 areaM2: number;
 perimeterM: number;
 labelLon?: number;
 labelLat?: number;
 color?: string;
 rings: Vertex[][]; // primeiro anel exterior; demais anéis são vazios
};
export function readProjectDivisions(features:readonly ProjectFeature[]):ProjectDivision[]{
 return features.filter(f=>(f as {isVisible?:boolean}).isVisible!==false&&(f.properties as Record<string,unknown>|undefined)?.hidden!==true).flatMap((feature,index)=>{
  const geometries=projectPolygonGeometries(feature.geoJson||feature.geometry);
  const parts:unknown[]=geometries.flatMap(g=>g.type==='Polygon'?[g.coordinates]:Array.isArray(g.coordinates)?g.coordinates:[]);
  return parts.flatMap((part,partIndex)=>{
   if(!Array.isArray(part))return [];
   const sourceRings=part.map(readOpenLonLatRing);
   const exterior=sourceRings[0];
   if(!exterior||exterior.length<3)return [];
   const rings=[exterior,...sourceRings.slice(1).filter(ring=>ring.length>=3)];
   const props=feature.properties||{};
   const perimeterM=rings.reduce((total,ring)=>total+ring.reduce((sum,pt,i)=>sum+distance(pt,ring[(i+1)%ring.length]),0),0);
   return [{featureId:String(feature.id||index),partIndex,category:String(props.category||''),properties:props,name:String(props.name||feature.name||`Área ${index+1}`),areaM2:Math.max(0,polygonArea(rings[0])-rings.slice(1).reduce((sum,ring)=>sum+polygonArea(ring),0)),perimeterM,labelLon:typeof props.areaLabelLng==='number'?props.areaLabelLng:undefined,labelLat:typeof props.areaLabelLat==='number'?props.areaLabelLat:undefined,color:typeof props.fillColor==='string'?props.fillColor:typeof props.lotColor==='string'?props.lotColor:undefined,rings}];
  });
 });
}
/** Limites para enquadrar as glebas mesmo quando são feições distintas. */
export function divisionBounds(divisions:readonly ProjectDivision[]):Vertex[] {
 const vertices=divisions.flatMap(part=>part.rings[0]||[]);
 if(!vertices.length)return [];
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const [x,y] of vertices){if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}
 return [[minX,minY],[minX,maxY],[maxX,minY],[maxX,maxY]];
}
