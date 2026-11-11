/**
 * Área de interseção entre um polígono (com vazios opcionais) e a união de
 * faixas poligonais. Integra as seções verticais de polígonos lineares.
 * Não usa pixels como unidade de área: retorna fração da área do imóvel,
 * que é convertida pela área geográfica calculada no documento.
 * Trata sobreposições de servidões uma única vez.
 */
export type AreaPoint = {x:number;y:number};
export type AreaRing = readonly AreaPoint[];
export type AreaFootprint = readonly AreaPoint[];
const EPS=1e-8;
type Segment = {a:AreaPoint;b:AreaPoint};
const segments=(rings:readonly AreaRing[]):Segment[]=>rings.flatMap(ring=>ring.length<3?[]:ring.map((a,i)=>({a,b:ring[(i+1)%ring.length]})).filter(({a,b})=>Math.hypot(b.x-a.x,b.y-a.y)>EPS));
const cross=(ax:number,ay:number,bx:number,by:number)=>ax*by-ay*bx;
function crossX(p:Segment,q:Segment):number|null{
 const rx=p.b.x-p.a.x,ry=p.b.y-p.a.y,sx=q.b.x-q.a.x,sy=q.b.y-q.a.y;
 const den=cross(rx,ry,sx,sy);
 if(Math.abs(den)<EPS)return null;
 const x=q.a.x-p.a.x,y=q.a.y-p.a.y;
 const t=cross(x,y,sx,sy)/den,u=cross(x,y,rx,ry)/den;
 if(t<=EPS||t>=1-EPS||u<=EPS||u>=1-EPS)return null;
 return p.a.x+rx*t;
}
function intervals(rings:readonly AreaRing[],x:number):[number,number][]{
 const ys:number[]=[];
 for(const {a,b} of segments(rings)){
  const dx=b.x-a.x;
  if(Math.abs(dx)<EPS)continue;
  if(x>=Math.min(a.x,b.x)&&x<Math.max(a.x,b.x))ys.push(a.y+(x-a.x)*(b.y-a.y)/dx);
 }
 ys.sort((a,b)=>a-b);
 const out:[number,number][]=[];
 for(let i=0;i+1<ys.length;i+=2)if(ys[i+1]-ys[i]>EPS)out.push([ys[i],ys[i+1]]);
 return out;
}
const merge=(intervals0:[number,number][]):[number,number][]=>{
 const sorted=intervals0.slice().sort((a,b)=>a[0]-b[0]);
 const result:[number,number][]=[];
 for(const [a,b] of sorted){const last=result[result.length-1];if(last&&a<=last[1]+EPS)last[1]=Math.max(last[1],b);else result.push([a,b]);}
 return result;
};
const height=(property:readonly AreaRing[],footprints:readonly AreaFootprint[],x:number)=>{
 const land=intervals(property,x),easements=merge(footprints.flatMap(r=>intervals([r],x)));
 let h=0;
 for(const [a,b] of land)for(const [c,d] of easements)h+=Math.max(0,Math.min(b,d)-Math.max(a,c));
 return h;
};
export function ringArea2D(ring:AreaRing):number{
 let a=0;for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];a+=p.x*q.y-q.x*p.y;}return Math.abs(a)/2;
}
export function polygonArea2D(rings:readonly AreaRing[]):number{
 return Math.max(0,ringArea2D(rings[0]||[])-rings.slice(1).reduce((s,r)=>s+ringArea2D(r),0));
}
export function overlappedArea2D(property:readonly AreaRing[],footprints:readonly AreaFootprint[]):number{
 if(!property.length||!footprints.length)return 0;
 const all=[...property,...footprints];const edges=segments(all);
 if(edges.length>1600)throw new Error('Geometria muito complexa para cálculo de interseção nesta prancha.');
 const xs=edges.flatMap(({a,b})=>[a.x,b.x]);
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
  const x=crossX(edges[i],edges[j]);if(x!==null)xs.push(x);
 }
 xs.sort((a,b)=>a-b);
 const cuts=xs.filter((x,i)=>i===0||x-xs[i-1]>EPS);
 let area=0;
 for(let i=1;i<cuts.length;i++){
  const left=cuts[i-1],right=cuts[i],width=right-left;
  if(width<=EPS)continue;
  const inset=Math.min(width*1e-6,1e-5);
  area+=(height(property,footprints,left+inset)+height(property,footprints,right-inset))*width/2;
 }
 return Math.max(0,Math.min(polygonArea2D(property),area));
}
export function partitionAreaM2(property:readonly AreaRing[],footprints:readonly AreaFootprint[],officialAreaM2:number){
 const total=Math.max(0,Number(officialAreaM2)||0),planArea=polygonArea2D(property);
 const intersection=planArea>EPS?overlappedArea2D(property,footprints):0;
 const easementM2=planArea>EPS?Math.min(total,Math.max(0,total*intersection/planArea)):0;
 return {totalM2:total,easementM2,remainderM2:Math.max(0,total-easementM2)};
}
