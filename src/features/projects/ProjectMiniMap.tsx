import { memo, useMemo } from 'react';
import { Cloud, MapPinned } from 'lucide-react';
import type { Project, ProjectFull, GeoGeometry } from './projectsApi';

const W=490,H=230,TS=256;
function mercator(lon:number,lat:number,z:number):[number,number]{
 const scale=TS*Math.pow(2,z);
 const clamped=Math.max(-85.05112878,Math.min(85.05112878,lat));
 const sin=Math.sin(clamped*Math.PI/180);
 return [(lon+180)/360*scale, (0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale];
}
function coords(geometry?:GeoGeometry):number[][][]{
 const c=geometry?.coordinates as unknown;
 if(!Array.isArray(c))return [];
 const valid=(pts:unknown):number[][]=>Array.isArray(pts)?pts.filter((p):p is number[]=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))).map(p=>[Number(p[0]),Number(p[1])]).filter(([x,y])=>Math.abs(x)<=180&&Math.abs(y)<=90):[];
 if(geometry?.type==='Polygon')return [valid(c[0])];
 if(geometry?.type==='MultiPolygon')return c.map(p=>Array.isArray(p)?valid(p[0]):[]);
 if(geometry?.type==='LineString')return [valid(c)];
 return [];
}
function urlFrom(p:Project){
 const fields=[p.thumbnailUrl,p.previewImage,p.metadata?.thumbnailUrl,p.metadata?.previewImage,p.metadata?.previewUrl];
 return fields.find((value):value is string=>typeof value==='string'&&/^https:\/\//i.test(value))||'';
}
function ProjectMiniMapComponent({summary,full,loading}:{summary:Project;full?:ProjectFull;loading:boolean}){
 const previewUrl=urlFrom(full?.project||summary)||urlFrom(summary);
 const model=useMemo(()=>{
  const shapes=(full?.features||[]).flatMap(f=>coords(f.geoJson||f.geometry));
  const points=shapes.flat().filter(p=>p.length>=2);
  const lat=Number(full?.project?.centerLatitude??summary.centerLatitude);
  const lon=Number(full?.project?.centerLongitude??summary.centerLongitude);
  const validCenter=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=85&&Math.abs(lon)<=180;
  if(!points.length&&!validCenter)return null;
  let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity;
  for(const [x,y] of points){minLon=Math.min(minLon,x);maxLon=Math.max(maxLon,x);minLat=Math.min(minLat,y);maxLat=Math.max(maxLat,y);}
  const centerLon=points.length?(minLon+maxLon)/2:lon;
  const centerLat=points.length?(minLat+maxLat)/2:lat;
  let zoom=points.length?16:Math.min(17,Math.max(4,Number(summary.defaultZoom||15)));
  if(points.length){
   for(zoom=18;zoom>3;zoom--){
    const xy=points.map(([x,y])=>mercator(x,y,zoom));
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    for(const [px,py] of xy){x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py);}
    const dx=x1-x0,dy=y1-y0;
    if(dx<W*.64&&dy<H*.68)break;
   }
  }
  const [cx,cy]=mercator(centerLon,centerLat,zoom);
  const tx=Math.floor(cx/TS),ty=Math.floor(cy/TS);
  const count=2**zoom;
  const tiles=[] as {x:number;y:number;left:number;top:number;src:string}[];
  for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){
   const x=tx+dx,y=ty+dy;
   if(y<0||y>=count)continue;
   tiles.push({x,y,left:x*TS-cx+W/2,top:y*TS-cy+H/2,src:`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${((x%count)+count)%count}`});
  }
  const svg=shapes.map(ring=>{
   const step=Math.max(1,Math.ceil(ring.length/1100));
   return ring.filter((_,index)=>index%step===0||index===ring.length-1).map(([x,y])=>{const [px,py]=mercator(x,y,zoom);return `${(px-cx+W/2).toFixed(1)},${(py-cy+H/2).toFixed(1)}`;}).join(' ');
  }).filter(Boolean);
  return {tiles,svg};
 },[full,summary]);
 if(!model&&!previewUrl)return <div className="mini-map mini-map-empty">{loading?<span className="loader"/>:<MapPinned size={26}/>}<strong>{loading?'Carregando miniatura...':'Miniatura indisponível'}</strong><span>{loading?'Consultando geometrias na nuvem.':'Este projeto ainda não possui coordenadas ou imagem para exibição.'}</span></div>;
 return <div className="mini-map" role="img" aria-label={`Prévia de satélite do projeto ${summary.propertyName||summary.name||''}`}>
  {model ? <div className="mini-map-canvas" style={{aspectRatio:`${W}/${H}`}}>
    {model.tiles.map(tile=><img key={`${tile.x}-${tile.y}`} src={tile.src} alt="" draggable={false} style={{left:tile.left,top:tile.top}} loading="lazy" referrerPolicy="no-referrer"/>)}
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">{model.svg.map((points,i)=><polygon key={i} points={points} fill="rgba(255,179,23,.22)" stroke="#ffd23f" strokeWidth="2.5" strokeLinejoin="round"/>)}</svg>
   </div>:<img className="mini-map-direct" src={previewUrl} alt="Imagem da área do projeto" loading="lazy"/>}
   <span className="mini-map-tag"><Cloud size={12}/>Nuvem</span>
   {model&&<span className="mini-map-attribution">Imagens © Esri e parceiros</span>}
   {loading&&<span className="mini-map-loading">Atualizando limites...</span>}
  </div>;
}

export const ProjectMiniMap = memo(ProjectMiniMapComponent);
