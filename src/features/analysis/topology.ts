/** Verificação INDICATIVA em plano tangente local (metros). Jamais corrige ou move vértices. */
export type P=[number,number];
export type GeoPolygon={type:'Polygon';coordinates:number[][][]}|{type:'MultiPolygon';coordinates:number[][][][]};
export type Parcel={id:string;name:string;geometry:GeoPolygon};
export type Diagnostic={kind:'error'|'warning';title:string;detail:string;parcelId:string};
const R=6371008.8,deg=Math.PI/180;
const xy=(point:number[],lat0:number):P=>[point[0]*deg*R*Math.cos(lat0*deg),point[1]*deg*R];
const equal=(a:P,b:P,tol=1e-3)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=tol;
export const rings=(g:GeoPolygon):number[][][]=>g.type==='Polygon'?g.coordinates:g.coordinates.flat();
const groups=(g:GeoPolygon):number[][][][]=>g.type==='Polygon'?[g.coordinates]:g.coordinates;
const signed=(points:P[])=>points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p[0]*q[1]-p[1]*q[0];},0)/2;
const outer=(rings:number[][][],lat0:number)=>rings.length?Math.max(0,Math.abs(signed(rings[0].map(p=>xy(p,lat0))))-rings.slice(1).reduce((s,r)=>s+Math.abs(signed(r.map(p=>xy(p,lat0)))),0)):0;
export function areaMeters(parcel:Parcel,lat0?:number):number{
 const ref=lat0??meanLat([parcel]);return groups(parcel.geometry).reduce((s,shape)=>s+outer(shape,ref),0);
}
const meanLat=(items:Parcel[])=>{const pts=items.flatMap(p=>rings(p.geometry).flat());return pts.length?pts.reduce((s,p)=>s+p[1],0)/pts.length:0;};
const ccw=(a:P,b:P,c:P)=> (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const between=(a:P,b:P,c:P,tol:number)=>Math.min(a[0],b[0])-tol<=c[0]&&c[0]<=Math.max(a[0],b[0])+tol&&Math.min(a[1],b[1])-tol<=c[1]&&c[1]<=Math.max(a[1],b[1])+tol;
const crossing=(a:P,b:P,c:P,d:P)=>{const x=ccw(a,b,c),y=ccw(a,b,d),z=ccw(c,d,a),w=ccw(c,d,b);return (x*y< -1e-8 && z*w< -1e-8);};
const pointSegment=(p:P,a:P,b:P)=>{const u=b[0]-a[0],v=b[1]-a[1],den=u*u+v*v;const t=den?Math.max(0,Math.min(1,((p[0]-a[0])*u+(p[1]-a[1])*v)/den)):0;return {distance:Math.hypot(p[0]-a[0]-u*t,p[1]-a[1]-v*t),t};};
export function validateParcel(parcel:Parcel):Diagnostic[]{
 const faults:Diagnostic[]=[];const lat=meanLat([parcel]);const create=(kind:Diagnostic['kind'],title:string,detail:string)=>faults.push({kind,title,detail,parcelId:parcel.id});
 let count=0;
 for(const source of rings(parcel.geometry)){
  count++;
  if(source.length<4){create('error','Anel incompleto',`Anel ${count}: menos de três vértices e fechamento.`);continue;}
  if(source.some(p=>p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90)){create('error','Coordenadas inválidas',`Anel ${count} tem latitude/longitude incorreta.`);continue;}
  const points=source.map(p=>xy(p,lat));
  if(!equal(points[0],points.at(-1)!,1e-5))create('error','Perímetro aberto',`Anel ${count}: última coordenada diferente da primeira.`);
  const unique=equal(points[0],points.at(-1)!)?points.slice(0,-1):points;
  if(unique.length>1500){create('warning','Geometria grande',`Anel ${count}: ${unique.length} vértices. Análise detalhada de cruzamentos e duplicidades limitada a 1500 vértices.`);continue;}
  if(Math.abs(signed(unique))<.01)create('error','Área degenerada',`Anel ${count}: área próxima de zero.`);
  let duplicates=0;
  for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++)if(equal(unique[i],unique[j],.01))duplicates++;
  if(duplicates)create('error','Vértices duplicados',`Anel ${count}: ${duplicates} par(es) a menos de 1 cm.`);
  let intersections=0;
  for(let i=0;i<unique.length;i++)for(let j=i+2;j<unique.length;j++){
   if(i===0&&j===unique.length-1)continue;
   if(crossing(unique[i],unique[(i+1)%unique.length],unique[j],unique[(j+1)%unique.length]))intersections++;
  }
  if(intersections)create('error','Autointerseção',`Anel ${count}: ${intersections} cruzamento(s) de segmentos.`);
 }
 return faults;
}
export function checkNearGaps(a:Parcel,b:Parcel,tolerance=0.2):{count:number;closest:number|null}{
 const lat=meanLat([a,b]);const lines=rings(b.geometry).flatMap(r=>r.slice(0,-1).map((point,i):[P,P]=>[xy(point,lat),xy(r[i+1],lat)]));
 let count=0,min=Infinity;
 for(const point of rings(a.geometry).flatMap(r=>r.slice(0,-1))){const p=xy(point,lat);
  for(const [x,y] of lines){const hit=pointSegment(p,x,y);if(hit.t<=.001||hit.t>=.999||hit.distance<.005)continue;
   if(hit.distance<=tolerance){count++;min=Math.min(min,hit.distance);break;}
  }
 }
 return {count,closest:Number.isFinite(min)?min:null};
}
const onSegment=(p:P,a:P,b:P)=>Math.abs(ccw(a,b,p))<.01&&between(a,b,p,.01);
const inRing=(p:P,ring:P[])=>{
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];if(onSegment(p,a,b))return true;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
};
const inside=(p:P,polygon:P[][][])=>polygon.some(rings=>rings.length>0&&inRing(p,rings[0])&&!rings.slice(1).some(r=>inRing(p,r)));
export type Comparison={a:string;b:string;areaA:number;areaB:number;deltaArea:number;overlapM2:number;overlapPercent:number;gapCandidates:number;closestGap:number|null;estimated:boolean;note:string};
/** Área de interseção estimada por amostragem estratificada determinística.
 * NÃO serve como cálculo registral/certificação; usa plano tangente local e área de célula.
 */
export function compareParcels(a:Parcel,b:Parcel,resolution=100):Comparison{
 const lat=meanLat([a,b]);const pa=groups(a.geometry).map(group=>group.map(r=>r.map(p=>xy(p,lat))));const pb=groups(b.geometry).map(group=>group.map(r=>r.map(p=>xy(p,lat))));
 const areaA=areaMeters(a,lat),areaB=areaMeters(b,lat);
 const allA=pa.flat(2),allB=pb.flat(2);
 const aa={minX:Math.min(...allA.map(p=>p[0])),maxX:Math.max(...allA.map(p=>p[0])),minY:Math.min(...allA.map(p=>p[1])),maxY:Math.max(...allA.map(p=>p[1]))};
 const bb={minX:Math.min(...allB.map(p=>p[0])),maxX:Math.max(...allB.map(p=>p[0])),minY:Math.min(...allB.map(p=>p[1])),maxY:Math.max(...allB.map(p=>p[1]))};
 const xmin=Math.max(aa.minX,bb.minX),xmax=Math.min(aa.maxX,bb.maxX),ymin=Math.max(aa.minY,bb.minY),ymax=Math.min(aa.maxY,bb.maxY);
 let overlapM2=0;
 if(allA.length>1500||allB.length>1500)throw new Error('Geometria com mais de 1500 vértices: reduza o conjunto para análise preliminar.');
 if(xmax>xmin&&ymax>ymin){
  const n=Math.max(24,Math.min(220,Math.floor(resolution))),dx=(xmax-xmin)/n,dy=(ymax-ymin)/n;
  let insideBoth=0;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
   const p:P=[xmin+(i+.5)*dx,ymin+(j+.5)*dy];if(inside(p,pa)&&inside(p,pb))insideBoth++;
  }
  overlapM2=insideBoth*dx*dy;
 }
 const x=checkNearGaps(a,b),y=checkNearGaps(b,a);
 return {a:a.name,b:b.name,areaA,areaB,deltaArea:areaB-areaA,overlapM2,overlapPercent:Math.min(100,Math.max(0,100*overlapM2/Math.max(.01,Math.min(areaA,areaB)))),gapCandidates:x.count+y.count,closestGap:x.closest===null?y.closest:y.closest===null?x.closest:Math.min(x.closest,y.closest),estimated:true,note:'Áreas estimadas no plano local e por amostragem; não comprovam conflito jurídico nem substituem análise SIGEF/CAR.'};
}
export function parcelFromFeature(f:{id?:string|number;geometry:{type:string;coordinates?:unknown};properties?:Record<string,unknown>|null},i:number):Parcel|null{
 if(f.geometry.type!=='Polygon'&&f.geometry.type!=='MultiPolygon')return null;
 const coords=f.geometry.coordinates;
 if(!Array.isArray(coords)||!coords.length)return null;
 return {id:String(f.id??i),name:String(f.properties?.name||`Polígono ${i+1}`),geometry:{type:f.geometry.type,coordinates:coords} as GeoPolygon};
}
