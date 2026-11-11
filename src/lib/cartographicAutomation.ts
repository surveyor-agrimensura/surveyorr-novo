/** Ferramentas cartográficas somente visuais. Não modificam GeoJSON nem coordenadas oficiais. */
export type GeoPoint = readonly [number, number];
export type XYPoint = {x:number;y:number};
export type ExteriorRing={id:string;points:readonly GeoPoint[];holes?:readonly (readonly GeoPoint[])[];hidden?:readonly number[]};
export type DimensionRun={id:string;points:GeoPoint[];distanceM:number;from:number;to:number;outward:[number,number];source?:string};
const rad=Math.PI/180;
const meters=(points:readonly GeoPoint[])=>{
 const lat=points.reduce((s,p)=>s+p[1],0)/Math.max(1,points.length);
 const kx=111319.49*Math.cos(lat*rad),ky=111319.49;
 return (p:GeoPoint):XYPoint=>({x:p[0]*kx,y:p[1]*ky});
};
const cross=(a:XYPoint,b:XYPoint)=>a.x*b.y-a.y*b.x;
const diff=(a:XYPoint,b:XYPoint):XYPoint=>({x:a.x-b.x,y:a.y-b.y});
const mag=(v:XYPoint)=>Math.hypot(v.x,v.y);
const near=(a:XYPoint,b:XYPoint,t=.01)=>mag(diff(a,b))<=t;
const pointSegmentDistance=(point:XYPoint,a:XYPoint,b:XYPoint)=>{
 const segment=diff(b,a),lengthSquared=segment.x*segment.x+segment.y*segment.y;
 if(lengthSquared<1e-12)return mag(diff(point,a));
 const t=Math.max(0,Math.min(1,((point.x-a.x)*segment.x+(point.y-a.y)*segment.y)/lengthSquared));
 return mag(diff(point,{x:a.x+segment.x*t,y:a.y+segment.y*t}));
};
const geographicDistance=(a:GeoPoint,b:GeoPoint)=>{
 const lat1=a[1]*rad,lat2=b[1]*rad,dlat=(b[1]-a[1])*rad,dlon=(b[0]-a[0])*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
 return 2*6371008.8*Math.asin(Math.min(1,Math.sqrt(h)));
};
/** Seleção conservadora: cantos e a geometria permanecem intactos. */
export function suggestHiddenStraightVertices(points:readonly GeoPoint[], current:readonly number[]=[], options?:{angleDeg?:number;toleranceM?:number}):number[]{
 const n=points.length;if(n<4)return [];
 const proj=meters(points),p=points.map(proj),threshold=(options?.angleDeg??3)*rad,tol=options?.toleranceM??.5;
 const existing=new Set(current);
 const candidates:number[]=[];
 for(let i=0;i<n;i++){
  if(existing.has(i))continue;
  const a=p[(i+n-1)%n],b=p[i],c=p[(i+1)%n];
  const ab=diff(b,a),bc=diff(c,b),ac=diff(c,a),la=mag(ab),lb=mag(bc),lc=mag(ac);
  if(la<.1||lb<.1||lc<.1)continue;
  const turn=Math.atan2(Math.abs(cross(ab,bc)),ab.x*bc.x+ab.y*bc.y);
  const deviation=Math.abs(cross(diff(b,a),ac))/lc;
  if(turn<=threshold&&deviation<=tol)candidates.push(i);
 }
 // Nunca ocultar mais de n-3 vértices; restaurar cantos já protegidos.
 return candidates.slice(0,Math.max(0,n-3-existing.size));
}
export function visibleDimensionRuns(points:readonly GeoPoint[],hidden:readonly number[]=[]):DimensionRun[]{
 const n=points.length;if(n<3)return [];
 const removed=new Set(hidden),anchors=Array.from({length:n},(_,i)=>i).filter(i=>!removed.has(i));
 if(anchors.length<3)return [];
 const p=points.map(meters(points));
 const signed=p.reduce((sum,v,i)=>sum+cross(v,p[(i+1)%n]),0),sign=signed>=0?1:-1;
 return anchors.map((start,k)=>{
  const end=anchors[(k+1)%anchors.length],path:GeoPoint[]=[points[start]],ids=[start];let j=start,dist=0;
  while(j!==end&&ids.length<=n){const next=(j+1)%n;dist+=geographicDistance(points[j],points[next]);path.push(points[next]);ids.push(next);j=next;}
  const a=p[start],b=p[end],d=diff(b,a),length=mag(d)||1;
  return {id:`${start}:${end}`,points:path,distanceM:dist,from:start,to:end,outward:[sign*d.y/length,-sign*d.x/length] as [number,number]};
 });
}
function insideRing(point:XYPoint,ring:readonly XYPoint[]):boolean{
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if(((a.y>point.y)!==(b.y>point.y))&&(point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x))inside=!inside;
 }
 return inside;
}
/** Calcula o limite exposto da união dos polígonos; arestas internas não aparecem. */
export function exteriorBoundaryRuns(rings:readonly ExteriorRing[],options?:{mergeCollinear?:boolean}):DimensionRun[]{
 const all=rings.flatMap(r=>[...r.points,...(r.holes||[]).flatMap(hole=>hole)]),project=meters(all);if(all.length<3)return [];
 const data=rings.filter(r=>r.points.length>=3).map(r=>({...r,p:r.points.map(project),holeRings:(r.holes||[]).filter(hole=>hole.length>=3).map(points=>({points,p:points.map(project)}))}));
 const inside=(p:XYPoint)=>data.some(d=>insideRing(p,d.p)&&!d.holeRings.some(hole=>insideRing(p,hole.p)));
 type BoundaryRing={points:readonly GeoPoint[];p:XYPoint[];source:string;hidden?:readonly number[]};
 const boundaries:BoundaryRing[]=data.flatMap(d=>[
  {points:d.points,p:d.p,source:d.id,hidden:d.hidden},
  ...d.holeRings.map(hole=>({points:hole.points,p:hole.p,source:d.id}))
 ]);
 type Edge={a:XYPoint;b:XYPoint;ga:GeoPoint;gb:GeoPoint;source:string;from:number;to:number;outward:[number,number];hidden?:readonly number[]};
 const edges:Edge[]=[];
 for(const boundary of boundaries){
  for(let i=0;i<boundary.p.length;i++){
   const a=boundary.p[i],b=boundary.p[(i+1)%boundary.p.length],v=diff(b,a),len=mag(v);if(len<.05)continue;
   const cuts=[0,1];
   // Divide também as bordas cujos vizinhos têm quantidades diferentes de vértices.
   for(const other of boundaries)for(let j=0;j<other.p.length;j++){
    const p=other.p[j],t=((p.x-a.x)*v.x+(p.y-a.y)*v.y)/(len*len);
    if(t>1e-7&&t<1-1e-7&&Math.abs(cross(diff(p,a),v))/len<.08)cuts.push(t);
    const q=other.p[(j+1)%other.p.length],w=diff(q,p),den=cross(v,w);
    if(Math.abs(den)>1e-8){const t2=cross(diff(p,a),w)/den,u=cross(diff(p,a),v)/den;
     if(t2>1e-7&&t2<1-1e-7&&u>=0&&u<=1)cuts.push(t2);
    }
   }
   cuts.sort((x,y)=>x-y);const unique=cuts.filter((t,j)=>j===0||t-cuts[j-1]>1e-7);
   for(let j=1;j<unique.length;j++){
    const from=unique[j-1],to=unique[j];if(to-from<1e-8)continue;
    const mid={x:a.x+v.x*(from+to)/2,y:a.y+v.y*(from+to)/2},normal={x:-v.y/len,y:v.x/len};
    let clearance=Infinity;
    for(const other of boundaries)for(let k=0;k<other.p.length;k++){
     if(other===boundary&&k===i)continue;
     const gap=pointSegmentDistance(mid,other.p[k],other.p[(k+1)%other.p.length]);
     if(gap>1e-7&&gap<clearance)clearance=gap;
    }
    const sample=Math.min(.25,len*(to-from)*.01,Number.isFinite(clearance)?clearance*.25:.25);
    const onLeft=inside({x:mid.x+normal.x*sample,y:mid.y+normal.y*sample});
    const onRight=inside({x:mid.x-normal.x*sample,y:mid.y-normal.y*sample});
    if(onLeft===onRight)continue;
    const ga:GeoPoint=[boundary.points[i][0]+(boundary.points[(i+1)%boundary.p.length][0]-boundary.points[i][0])*from,boundary.points[i][1]+(boundary.points[(i+1)%boundary.p.length][1]-boundary.points[i][1])*from];
    const gb:GeoPoint=[boundary.points[i][0]+(boundary.points[(i+1)%boundary.p.length][0]-boundary.points[i][0])*to,boundary.points[i][1]+(boundary.points[(i+1)%boundary.p.length][1]-boundary.points[i][1])*to];
    edges.push({a:{x:a.x+v.x*from,y:a.y+v.y*from},b:{x:a.x+v.x*to,y:a.y+v.y*to},ga,gb,source:boundary.source,from:i,to:(i+1)%boundary.p.length,outward:(onLeft?[normal.x*-1,normal.y*-1]:[normal.x,normal.y]),hidden:boundary.hidden});
   }
  }
 }
 const unique:Edge[]=[];
 for(const edge of edges){if(!unique.some(e=>(near(e.a,edge.a)&&near(e.b,edge.b))||(near(e.a,edge.b)&&near(e.b,edge.a))))unique.push(edge);}
 // Arestas exteriores separadas e verificáveis. Respeita os pontos ocultados no agrupamento.
 const result:DimensionRun[]=[];
 const seen=new Set<number>();
 for(let i=0;i<unique.length;i++){
  if(seen.has(i))continue;
  const first=unique[i];seen.add(i);
  const path=[first.ga,first.gb];let end=first.b,dist=geographicDistance(first.ga,first.gb);
  for(let counter=0;counter<unique.length;counter++){
   let found=-1,reverse=false;
   for(let j=0;j<unique.length;j++)if(!seen.has(j)){
    if(near(unique[j].a,end)){found=j;break;}
    if(near(unique[j].b,end)){found=j;reverse=true;break;}
   }
   if(found<0)break;
   const edge=unique[found];
   // Pára nos vértices visíveis ou quando o contorno muda de direção.
   const prev=diff(end,project(path[path.length-2])),next=diff(reverse?edge.a:edge.b,end);
   const bend=Math.atan2(Math.abs(cross(prev,next)),prev.x*next.x+prev.y*next.y);
   const vertex=reverse?edge.to:edge.from;
   const isHidden=edge.hidden?.includes(vertex)??false;
   if(bend>3*rad||(!isHidden&&!options?.mergeCollinear))break;
   seen.add(found);dist+=geographicDistance(edge.ga,edge.gb);path.push(reverse?edge.ga:edge.gb);end=reverse?edge.a:edge.b;
  }
  result.push({id:`outer:${i}`,points:path,distanceM:dist,from:first.from,to:first.to,outward:first.outward,source:first.source});
 }
 return result;
}
export function exteriorDimensionSvg(runs:readonly DimensionRun[],project:(point:GeoPoint)=>XYPoint, color:string,fontsize=9):string{
 const esc=(v:string)=>v.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 return runs.map((run,i)=>{
  if(run.points.length<2)return '';
  const a=project(run.points[0]),b=project(run.points[run.points.length-1]),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(len<10)return '';
  const nx=run.outward[0],ny=-run.outward[1],d=16;
  const pts=run.points.map(p=>project(p));
  const line=pts.map((p,k)=>`${k?'L':'M'}${(p.x+nx*d).toFixed(2)},${(p.y+ny*d).toFixed(2)}`).join(' ');
  const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},ang=Math.atan2(dy,dx)*180/Math.PI,angle=ang>90?ang-180:ang< -90?ang+180:ang;
  const x=center.x+nx*(d+9),y=center.y+ny*(d+9);
  const distance=(run.distanceM||0).toLocaleString('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:1});
  return `<g data-exterior-cota="${i}" fill="none" stroke="${esc(color)}" stroke-width="1" stroke-dasharray="5 4"><path d="${line}"/><path d="M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${(a.x+nx*d).toFixed(2)} ${(a.y+ny*d).toFixed(2)} M ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${(b.x+nx*d).toFixed(2)} ${(b.y+ny*d).toFixed(2)}"/></g><text data-exterior-cota-label="${i}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${fontsize}" text-anchor="middle" dominant-baseline="middle" fill="${esc(color)}" transform="rotate(${angle.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})">${distance} m</text>`;
 }).join('');
}
