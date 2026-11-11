import type {XY} from './geometry';
export type ZPoint=XY&{z:number};
export function idw(pts:ZPoint[],x:number,y:number,power=2){let n=0,d=0;for(const p of pts){const dist=Math.hypot(x-p.x,y-p.y);if(dist<1e-7)return p.z;const w=1/Math.pow(dist,power);n+=w*p.z;d+=w;}return d?n/d:NaN;}
export type Triangle=[number,number,number];
export function triangulate(points:XY[]):Triangle[]{if(points.length<3)return [];const pts=[...points];const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),delta=Math.max(maxx-minx,maxy-miny,1),mx=(minx+maxx)/2,my=(miny+maxy)/2;const n=pts.length;pts.push({x:mx-20*delta,y:my-delta},{x:mx,y:my+20*delta},{x:mx+20*delta,y:my-delta});let tris:Triangle[]=[[n,n+1,n+2]];const circle=(t:Triangle,p:XY)=>{const [a,b,c]=t.map(i=>pts[i]);const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));if(Math.abs(d)<1e-9)return false;const ax=a.x*a.x+a.y*a.y,bx=b.x*b.x+b.y*b.y,cx=c.x*c.x+c.y*c.y;const ux=(ax*(b.y-c.y)+bx*(c.y-a.y)+cx*(a.y-b.y))/d,uy=(ax*(c.x-b.x)+bx*(a.x-c.x)+cx*(b.x-a.x))/d;const r2=(a.x-ux)**2+(a.y-uy)**2;return (p.x-ux)**2+(p.y-uy)**2<=r2+1e-7;};for(let i=0;i<n;i++){const bad=tris.filter(t=>circle(t,pts[i]));const edges=new Map<string,[number,number,number]>();for(const t of bad){for(const [a,b] of [[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]]){const key=[a,b].sort((x,y)=>x-y).join(':');if(edges.has(key))edges.get(key)![2]++;else edges.set(key,[a,b,1]);}}tris=tris.filter(t=>!bad.includes(t));for(const [a,b,count] of edges.values())if(count===1)tris.push([a,b,i]);}return tris.filter(t=>t.every(i=>i<n)&&Math.abs((pts[t[1]].x-pts[t[0]].x)*(pts[t[2]].y-pts[t[0]].y)-(pts[t[2]].x-pts[t[0]].x)*(pts[t[1]].y-pts[t[0]].y))>1e-8);}
export function contourTriangle(points:ZPoint[],level:number):[XY,XY]|null{const intersections:XY[]=[];for(let i=0;i<3;i++){const a=points[i],b=points[(i+1)%3];if((a.z<level&&b.z>=level)||(b.z<level&&a.z>=level)){const t=(level-a.z)/(b.z-a.z);intersections.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return intersections.length===2?[intersections[0],intersections[1]]:null;}
export function makeContours(points:ZPoint[],triangles:Triangle[],spacing:number){const a=Math.min(...points.map(p=>p.z)),b=Math.max(...points.map(p=>p.z));if(!Number.isFinite(a)||!Number.isFinite(b)||b-a<1e-8||spacing<=0)return [];const num=Math.floor((b-a)/spacing);const contours:{level:number;a:XY;b:XY}[]=[];for(let v=1;v<=num&&v<400;v++){const z=Math.ceil(a/spacing)*spacing+(v-1)*spacing;if(z>=b)break;for(const tri of triangles){const segment=contourTriangle(tri.map(i=>points[i]),z);if(segment)contours.push({level:z,a:segment[0],b:segment[1]});}}return contours;}
export function paletteColor(level:number,palette:string){const stops:Record<string,string[]>={hips:['#4a8bd5','#67b98c','#d7c76d','#a76b46'],topo:['#316f5b','#81b56e','#d2c08b','#9a7350'],arco:['#444dc0','#28a8b8','#60c150','#e6be42','#d33a40'],cinza:['#e5e9ed','#b4c0cc','#5a6b7b']};const colors=stops[palette]||stops.hips;const t=Math.max(0,Math.min(.99999,level))*(colors.length-1),i=Math.floor(t),f=t-i;const rgb=(c:string)=>[1,3,5].map(j=>parseInt(c.slice(j,j+2),16));const a=rgb(colors[i]),b=rgb(colors[i+1]);return '#'+a.map((x,j)=>Math.round(x+(b[j]-x)*f).toString(16).padStart(2,'0')).join('');}
export function meanSlope(points:ZPoint[]){if(points.length<3)return NaN;const mx=points.reduce((s,p)=>s+p.x,0)/points.length,my=points.reduce((s,p)=>s+p.y,0)/points.length,mz=points.reduce((s,p)=>s+p.z,0)/points.length;let xx=0,yy=0,xy=0,xz=0,yz=0;for(const p of points){const dx=p.x-mx,dy=p.y-my,dz=p.z-mz;xx+=dx*dx;yy+=dy*dy;xy+=dx*dy;xz+=dx*dz;yz+=dy*dz;}const den=xx*yy-xy*xy;if(Math.abs(den)<1e-9)return NaN;const sx=(xz*yy-yz*xy)/den,sy=(yz*xx-xz*xy)/den;return Math.hypot(sx,sy)*100;}

export type ContourSegment={level:number;a:XY;b:XY};
export type ContourLine={level:number;points:XY[]};

/** Une os segmentos triangulares de uma mesma cota em linhas contínuas. */
export function stitchContours(segments:ContourSegment[],tolerance=1e-3):ContourLine[]{
 if(!Number.isFinite(tolerance)||tolerance<=0)throw new Error('A tolerância precisa ser positiva.');
 const byLevel=new Map<number,ContourSegment[]>();
 for(const segment of segments){
  if(!Number.isFinite(segment.level)||![segment.a.x,segment.a.y,segment.b.x,segment.b.y].every(Number.isFinite))continue;
  const group=byLevel.get(segment.level)||[];group.push(segment);byLevel.set(segment.level,group);
 }
 const pointKey=(point:XY)=>`${Math.round(point.x/tolerance)}:${Math.round(point.y/tolerance)}`;
 const result:ContourLine[]=[];
 for(const [level,group] of byLevel){
  const adjacent=new Map<string,number[]>();
  const unique:ContourSegment[]=[];
  const seen=new Set<string>();
  for(const segment of group){
   const a=pointKey(segment.a),b=pointKey(segment.b);
   if(a===b)continue;
   const key=a<b?`${a}|${b}`:`${b}|${a}`;
   if(seen.has(key))continue;
   seen.add(key);
   const index=unique.push(segment)-1;
   for(const endpoint of [a,b]){const list=adjacent.get(endpoint)||[];list.push(index);adjacent.set(endpoint,list);}
  }
  const used=new Uint8Array(unique.length);
  for(let seed=0;seed<unique.length;seed++){
   if(used[seed])continue;
   used[seed]=1;
   const chain=[unique[seed].a,unique[seed].b];
   const extend=(atHead:boolean)=>{
    for(;;){
     const endpoint=atHead?chain[0]:chain[chain.length-1];
     const key=pointKey(endpoint);
     const next=(adjacent.get(key)||[]).find(index=>!used[index]);
     if(next===undefined)break;
     used[next]=1;
     const segment=unique[next];
     const add=pointKey(segment.a)===key?segment.b:segment.a;
     if(atHead)chain.unshift(add);else chain.push(add);
    }
   };
   extend(false);
   extend(true);
   result.push({level,points:chain});
  }
 }
 return result;
}
