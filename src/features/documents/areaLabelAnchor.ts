/** Um ponto interno estável para o rótulo do imóvel na prancha.
 * Não modifica a geometria nem as medidas técnicas. */
export function areaLabelAnchor(vertices:readonly {x:number;y:number}[]):{x:number;y:number}{
 if(!vertices.length)return {x:500,y:400};
 const minX=Math.min(...vertices.map(v=>v.x)),maxX=Math.max(...vertices.map(v=>v.x));
 const minY=Math.min(...vertices.map(v=>v.y)),maxY=Math.max(...vertices.map(v=>v.y));
 const inside=(p:{x:number;y:number})=>{
  let odd=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
   const a=vertices[i],b=vertices[j];
   if(((a.y>p.y)!==(b.y>p.y))&&p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-10)+a.x)odd=!odd;
  }
  return odd;
 };
 const distanceToLine=(p:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number})=>{
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
 };
 let best:null|{x:number;y:number}=null,bestDistance=-Infinity;
 // A amostragem inclui o centro e encontra uma posição interna mesmo em polígonos côncavos.
 for(let iy=0;iy<=20;iy++)for(let ix=0;ix<=20;ix++){
  const p={x:minX+(maxX-minX)*(ix+.5)/21,y:minY+(maxY-minY)*(iy+.5)/21};
  if(!inside(p))continue;
  let d=Infinity;
  for(let i=0;i<vertices.length;i++)d=Math.min(d,distanceToLine(p,vertices[i],vertices[(i+1)%vertices.length]));
  if(d>bestDistance){bestDistance=d;best=p;}
 }
 if(best)return best;
 const avg=vertices.reduce((a,v)=>({x:a.x+v.x/vertices.length,y:a.y+v.y/vertices.length}),{x:0,y:0});
 return avg;
}
