/** Snap opcional e explícito, inspirado no módulo snap.js do RC185.
 * Retorna coordenadas originais WGS84, sem mover qualquer feição existente.
 */
export type LatLng = [number, number];
export type SnapGeometry = {type:string;coordinates?:unknown};
export type SnapSource = {geometry:SnapGeometry;hidden?:boolean};
export type SnapCandidate = {position:LatLng;kind:'vertice'|'segmento';distancePx:number};
export function geometryLines(geometry:SnapGeometry):LatLng[][]{
 const toLine=(coords:unknown):LatLng[]=>Array.isArray(coords)?coords.flatMap(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))?[[Number(p[1]),Number(p[0])] as LatLng]:[]):[];
 switch(geometry.type){
  case 'Point':return [toLine([geometry.coordinates])];
  case 'MultiPoint':return Array.isArray(geometry.coordinates)?geometry.coordinates.map(p=>toLine([p])):[];
  case 'LineString':return [toLine(geometry.coordinates)];
  case 'MultiLineString':case 'Polygon':return Array.isArray(geometry.coordinates)?geometry.coordinates.map(toLine):[];
  case 'MultiPolygon':return Array.isArray(geometry.coordinates)?geometry.coordinates.flatMap(p=>Array.isArray(p)?p.map(toLine):[]):[];
  default:return [];
 }
}
export function findMapSnap(sources:SnapSource[],cursor:LatLng,toPixel:(p:LatLng)=>[number,number],tolerancePx=15):SnapCandidate|null{
 if(!Number.isFinite(cursor[0])||!Number.isFinite(cursor[1])||tolerancePx<=0)return null;
 const [px,py]=toPixel(cursor);if(!Number.isFinite(px)||!Number.isFinite(py))return null;
 let best:SnapCandidate|null=null,score=Infinity,seen=0;
 const consider=(candidate:SnapCandidate,priority:number)=>{const candidateScore=candidate.distancePx+priority;if(candidate.distancePx<=tolerancePx&&candidateScore<score){best=candidate;score=candidateScore;}};
 for(const item of sources){
  if(item.hidden)continue;
  const lines=geometryLines(item.geometry);
  for(const line of lines){
   const points=line.map(p=>({coords:p,xy:toPixel(p)}));
   for(let i=0;i<points.length;i++){
    if(++seen>12000)return best; // evita travamentos em arquivos muito extensos
    const p=points[i],delta=Math.hypot(px-p.xy[0],py-p.xy[1]);
    consider({position:p.coords,kind:'vertice',distancePx:delta},-3);
    if(i===0)continue;
    const a=points[i-1],b=p,dx=b.xy[0]-a.xy[0],dy=b.xy[1]-a.xy[1];
    const denom=dx*dx+dy*dy;if(denom<1e-12)continue;
    const t=Math.max(0,Math.min(1,((px-a.xy[0])*dx+(py-a.xy[1])*dy)/denom));
    const distance=Math.hypot(px-(a.xy[0]+t*dx),py-(a.xy[1]+t*dy));
    // Ponto interpolado no segmento em WGS84 para não alterar outras feições.
    const position:LatLng=[a.coords[0]+t*(b.coords[0]-a.coords[0]),a.coords[1]+t*(b.coords[1]-a.coords[1])];
    consider({position,kind:'segmento',distancePx:distance},0);
   }
  }
 }
 return best;
}
