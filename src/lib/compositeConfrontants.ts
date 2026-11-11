/** Confrontações externas de um imóvel com várias glebas.
 * Os polígonos originais não são unidos, editados nem renumerados: somente
 * as arestas expostas da união são utilizadas na associação cartográfica.
 */
import {exteriorBoundaryRuns,type GeoPoint,type XYPoint} from './cartographicAutomation';
import type {ProjectDivision} from '../features/croqui/projectDivisions';

export type CompositeConfrontantEdge={
 key:string;partId:string;index:number;name:string;
 start:GeoPoint;end:GeoPoint;outward:readonly [number,number];
};
export type CompositeConfrontantLabel={name:string;position:XYPoint;sourceKey:string};
export type CompositeConfrontantAssignment={name:string;targets:string[];confidence:number};
const labelId=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');

/** Não inclui divisas internas, mesmo com vértices intermediários diferentes. */
export function compositeExteriorEdges(parts:readonly ProjectDivision[]):CompositeConfrontantEdge[]{
 const runs=exteriorBoundaryRuns(parts.map(part=>({id:`${part.featureId}:${part.partIndex}`,points:part.rings[0]||[]})));
 const output=new Map<string,CompositeConfrontantEdge>();
 for(const run of runs){
  const part=parts.find(p=>`${p.featureId}:${p.partIndex}`===run.source);
  if(!part||run.points.length<2)continue;
  const n=part.rings[0]?.length||0,index=run.from;
  if(index<0||index>=n)continue;
  const key=`division:${part.featureId}:${part.partIndex}:neighbor:${index}`;
  if(!output.has(key))output.set(key,{key,partId:`${part.featureId}:${part.partIndex}`,index,name:part.name,start:run.points[0],end:run.points[run.points.length-1],outward:run.outward});
 }
 return [...output.values()];
}

/** Seleciona o rótulo existente mais próximo de cada borda EXTERNA.
 * Nenhum texto é reposicionado por esta função. A prévia é obrigatória.
 */
export function suggestCompositeConfrontants(
 edges:readonly CompositeConfrontantEdge[],labels:readonly CompositeConfrontantLabel[],
 project:(coordinate:GeoPoint)=>XYPoint,
):CompositeConfrontantAssignment[]{
 if(!edges.length||!labels.length)return [];
 const points=edges.flatMap(e=>[project(e.start),project(e.end)]);
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
 const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const scale=Math.max(40,Math.hypot(maxX-minX,maxY-minY));
 const unique=new Map<string,CompositeConfrontantLabel>();
 for(const item of labels){
  if(!item.name.trim())continue;
  const key=labelId(item.name);
  const closest=(candidate:CompositeConfrontantLabel)=>Math.min(...edges.map(e=>{
   const a=project(e.start),b=project(e.end),dx=b.x-a.x,dy=b.y-a.y;
   const t=Math.max(0,Math.min(1,((candidate.position.x-a.x)*dx+(candidate.position.y-a.y)*dy)/(dx*dx+dy*dy||1)));
   return Math.hypot(candidate.position.x-a.x-t*dx,candidate.position.y-a.y-t*dy);
  }));
  if(!unique.has(key)||closest(item)<closest(unique.get(key)!))unique.set(key,item);
 }
 const selected=[...unique.values()];
 const result=new Map<string,CompositeConfrontantAssignment>();
 for(const label of selected)result.set(labelId(label.name),{name:label.name,targets:[],confidence:0});
 for(const edge of edges){
  const a=project(edge.start),b=project(edge.end);
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const normal={x:edge.outward[0],y:-edge.outward[1]};
  let winner:CompositeConfrontantLabel|undefined,best=-Infinity;
  for(const label of selected){
   const vx=label.position.x-mid.x,vy=label.position.y-mid.y;
   const dist=Math.hypot(vx,vy),alignment=dist>1?(normal.x*vx+normal.y*vy)/dist:0;
   const score=-dist/scale+0.32*alignment;
   if(score>best){winner=label;best=score;}
  }
  if(winner){const entry=result.get(labelId(winner.name))!;entry.targets.push(edge.key);entry.confidence+=Math.max(0,Math.min(1,(best+1)/1.5));}
 }
 return [...result.values()].map(v=>({...v,confidence:v.targets.length?v.confidence/v.targets.length:0}));
}
