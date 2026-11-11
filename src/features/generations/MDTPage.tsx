import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {GenerationWorkspace,useGenerationData,type GenerativeOptions} from './GenerationLayout';
import {bounds,featureVertices,makeProjection,polygonArea,polygonPerimeter,readPointFile,xmlEscape,type GeoPoint,type XY} from './geometry';
import {idw,triangulate,makeContours,paletteColor,meanSlope,type ZPoint} from './mdtEngine';
import {FileUploadField,type UploadProgressReporter} from '../../components/FileUploadField';

const fmt=(value:number,digits=2)=>value.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});

function readUploadText(file:File,reportProgress:UploadProgressReporter):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onprogress=event=>{if(event.lengthComputable&&event.total>0)reportProgress(file,event.loaded,event.total);};reader.onerror=()=>reject(reader.error||new Error('Falha ao ler os dados altimétricos.'));reader.onabort=()=>reject(new Error('Leitura dos dados cancelada.'));reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('Os dados não puderam ser lidos como texto.'));reader.readAsText(file);});}

function serialize(points:GeoPoint[]){return points.map((p,i)=>`${p.id||`P-${i+1}`};${p.lat.toFixed(8)};${p.lon.toFixed(8)};${p.z??''}`).join('\n');}
function parseInput(src:string){const result:GeoPoint[]=[];for(const [i,line] of src.split(/\r?\n/).entries()){if(!line.trim())continue;const v=line.split(/[;\t]/).map(s=>s.trim());if(v.length<3){if(i===0)continue;throw new Error(`Linha ${i+1}: informe ID;Latitude;Longitude;Altitude`);}const lat=Number(v[1].replace(',','.')),lon=Number(v[2].replace(',','.')),z=v[3]?.trim()?Number(v[3].replace(',','.')):undefined;if(!Number.isFinite(lat)||!Number.isFinite(lon)){if(i===0)continue;throw new Error(`Linha ${i+1}: coordenada inválida.`);}if(Math.abs(lat)>90||Math.abs(lon)>180)throw new Error(`Linha ${i+1}: os pontos devem estar em latitude/longitude (WGS84).`);if(z!==undefined&&!Number.isFinite(z))throw new Error(`Linha ${i+1}: altitude inválida.`);result.push({lat,lon,z,id:v[0]});}return result;}
function Heatmap({points,method,power,interval,major,opts}:{points:ZPoint[];method:'IDW'|'TIN';power:number;interval:number;major:number;opts:GenerativeOptions}){const b=bounds(points),s=Math.min(820/b.width,445/b.height)*.82;const xy=(p:XY)=>({x:510+(p.x-(b.minX+b.maxX)/2)*s,y:350-(p.y-(b.minY+b.maxY)/2)*s});const low=Math.min(...points.map(p=>p.z)),high=Math.max(...points.map(p=>p.z)),span=Math.max(.0001,high-low);const tin=triangulate(points);const nx=24,ny=16,dx=b.width/nx,dy=b.height/ny;const cells:ReactNode[]=[];const grid:ZPoint[]=[];if(method==='IDW'&&points.length>=3){for(let iy=0;iy<=ny;iy++)for(let ix=0;ix<=nx;ix++){const x=b.minX+ix*dx,y=b.minY+iy*dy;grid.push({x,y,z:idw(points,x,y,power)});}for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){const v=grid[iy*(nx+1)+ix],p=xy(v);cells.push(<rect key={`${ix}-${iy}`} x={p.x} y={p.y-dy*s} width={Math.max(1,dx*s+.8)} height={Math.max(1,dy*s+.8)} fill={paletteColor((v.z-low)/span,opts.palette)} opacity={opts.opacity/100}/>);}}
 if(method==='TIN')for(const [i,t] of tin.entries()){const avg=t.reduce((v,j)=>v+points[j].z,0)/3,vertices=t.map(j=>xy(points[j]));cells.push(<polygon key={i} points={vertices.map(p=>`${p.x},${p.y}`).join(' ')} fill={paletteColor((avg-low)/span,opts.palette)} opacity={opts.opacity/100} stroke="#7697b3" strokeWidth=".35"/>)}
 const triangles=method==='TIN'?tin:triangulate(grid);const src=method==='TIN'?points:grid;const contours=interval>0&&src.length>=3?makeContours(src,triangles,interval):[];
 return <g>{opts.palette!=='nenhum'&&cells}{contours.slice(0,3500).map((c,i)=>{const a=xy(c.a),b=xy(c.b),isMajor=major>0&&Math.abs(c.level/major-Math.round(c.level/major))<.0001;return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isMajor?'#775434':'#766d52'} strokeWidth={isMajor?1.5:.7} opacity=".9"/>})}{opts.showElevations&&contours.filter((c)=>major>0&&Math.abs(c.level/major-Math.round(c.level/major))<.0001).filter((_,i)=>i%Math.max(1,Math.floor(contours.length/23))===0).slice(0,16).map((c,i)=>{const p=xy(c.a);return <text key={i} x={p.x} y={p.y} fontSize="9" fontWeight="bold" fill="#3c3d42">{c.level.toFixed(1)}m</text>})}{points.map((p,i)=>{const pos=xy(p);return <g key={i}>{opts.showVertices&&<circle cx={pos.x} cy={pos.y} r="4" fill="#c93432" stroke="#fff" strokeWidth="1.5"/>}{opts.showLabels&&<text x={pos.x+6} y={pos.y-6} fontSize="10" fill="#183e6a">{p.id||`V-${i+1}`} ({p.z.toFixed(1)}m)</text>}</g>})}</g>;
}
function terrainHull(points:ZPoint[]){const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);if(sorted.length<=2)return sorted;const cross=(o:ZPoint,a:ZPoint,b:ZPoint)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lower:ZPoint[]=[],upper:ZPoint[]=[];for(const p of sorted){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}for(const p of [...sorted].reverse()){while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}lower.pop();upper.pop();return [...lower,...upper];}
function insidePolygon(point:XY,polygon:XY[]){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j],crosses=(a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y||1e-12)+a.x;if(crosses)inside=!inside;}return inside;}
function mdtModelSvg(points:ZPoint[],stats:[string,string][],method:'IDW'|'TIN',power:number,interval:number,major:number,projectName:string,opts:GenerativeOptions){
 const esc=xmlEscape,
 valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)),
 low=valid.length?Math.min(...valid.map(p=>p.z)):0,
 high=valid.length?Math.max(...valid.map(p=>p.z)):0,
 span=Math.max(.01,high-low),
 box=valid.length?bounds(valid):{minX:0,minY:0,maxX:1,maxY:1,width:1,height:1};
 const hull=terrainHull(valid),sampled=valid.length>500?valid.filter((_,i)=>i%Math.ceil(valid.length/500)===0):valid;
 const idwGrid:ZPoint[]=[];
 if(method==='IDW'&&valid.length>=3){
  for(let iy=0;iy<=16;iy++)for(let ix=0;ix<=20;ix++){
   const x=box.minX+box.width*ix/20,y=box.minY+box.height*iy/16,point={x,y,z:idw(valid,x,y,power)};
   if(hull.length<3||insidePolygon(point,hull))idwGrid.push(point);
  }
 }
 const mesh=method==='IDW'?idwGrid:sampled,
 triangles=mesh.length>=3?triangulate(mesh):[],
 proj=(p:XY,z:number)=>{
  const u=(p.x-box.minX)/Math.max(box.width,1),v=(p.y-box.minY)/Math.max(box.height,1),zNorm=(z-low)/span;
  return {x:346+u*336+v*415,y:503-u*307+v*135-zNorm*70};
 },
 fmtPoint=(p:XY)=>p.x.toFixed(1)+','+p.y.toFixed(1);
 const bottom=60,hullTop=hull.map(point=>proj(point,point.z)),
 edgePath=hull.length?hull.map((p,i)=>{const q=proj(p,p.z);return (i?'L':'M')+' '+q.x.toFixed(1)+' '+q.y.toFixed(1);}).join(' ')+' Z':'',
 screenBounds=hullTop.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
 const sideEdges=hullTop.length>=3?hullTop.map((p,i)=>({i,depth:(p.y+hullTop[(i+1)%hullTop.length].y)/2})).sort((a,b)=>a.depth-b.depth):[],
 visibleSides=sideEdges.slice(-2).sort((a,b)=>a.depth-b.depth),
 sideFaces=visibleSides.map((edge,i)=>{
  const q=hullTop[edge.i],r=hullTop[(edge.i+1)%hullTop.length],fill=i===visibleSides.length-1?'url(#frontSoil)':'url(#sideSoil)';
  return '<polygon points="'+fmtPoint(q)+' '+r.x.toFixed(1)+','+r.y.toFixed(1)+' '+r.x.toFixed(1)+','+(r.y+bottom).toFixed(1)+' '+q.x.toFixed(1)+','+(q.y+bottom).toFixed(1)+'" fill="'+fill+'" stroke="#6e5744" stroke-width="1.8"/>';
 }).join(''),
 sideDetails=visibleSides.map(edge=>{
  const q=hullTop[edge.i],r=hullTop[(edge.i+1)%hullTop.length],offset=bottom*.55;
  return '<line x1="'+q.x.toFixed(1)+'" y1="'+(q.y+offset).toFixed(1)+'" x2="'+r.x.toFixed(1)+'" y2="'+(r.y+offset).toFixed(1)+'" stroke="#83664c" stroke-width="1.1" opacity=".65"/>';
 }).join(''),
 terrainCells=opts.palette==='nenhum'?'':triangles.map((t,i)=>{
  const cell=t.map(j=>mesh[j]),avg=cell.reduce((sum,p)=>sum+p.z,0)/3,pts=cell.map(p=>proj(p,p.z)),fill=paletteColor((avg-low)/span,opts.palette);
  return {i,avg,markup:'<polygon points="'+pts.map(fmtPoint).join(' ')+'" fill="'+fill+'" fill-opacity="'+opts.opacity/100+'" stroke="#fff" stroke-width="1.2"/>'};
 }).sort((a,b)=>a.avg-b.avg).map(item=>item.markup).join('');
 const contours=mesh.length>=3&&interval>0?makeContours(mesh,triangles,interval):[],
 contourSvg=contours.slice(0,1500).map(line=>{
  const a=proj(line.a,line.level),b=proj(line.b,line.level),isMajor=major>0&&Math.abs(line.level/major-Math.round(line.level/major))<.0001;
  return '<line x1="'+a.x.toFixed(1)+'" y1="'+a.y.toFixed(1)+'" x2="'+b.x.toFixed(1)+'" y2="'+b.y.toFixed(1)+'" stroke="'+(isMajor?'#99693c':'#b89159')+'" stroke-width="'+(isMajor?2:1.1)+'" opacity="'+(isMajor?'.92':'.7')+'" stroke-linecap="round"/>';
 }).join(''),
 contourLabels=opts.showElevations?contours.filter(line=>major>0&&Math.abs(line.level/major-Math.round(line.level/major))<.0001).filter((_,i)=>i%Math.max(1,Math.floor(contours.length/10))===0).slice(0,10).map(line=>{
  const p=proj(line.a,line.level),label=fmt(line.level,1)+' m';
  return '<g><rect x="'+(p.x+4).toFixed(1)+'" y="'+(p.y-22).toFixed(1)+'" width="58" height="22" rx="4" fill="#eee3b2" fill-opacity=".9"/><text x="'+(p.x+33).toFixed(1)+'" y="'+(p.y-7).toFixed(1)+'" text-anchor="middle" font-size="12" font-weight="700" fill="#3e4a45">'+esc(label)+'</text></g>';
 }).join(''):'',
 edgeColor=esc(opts.lineColor||'#f9c500'),
 edgeOutline=edgePath?'<path d="'+edgePath+'" fill="none" stroke="'+edgeColor+'" stroke-width="2.5" stroke-linejoin="round"/>':'',
 vertexMarks=opts.showVertices?valid.slice(0,80).map(p=>{
  const q=proj(p,p.z);
  return '<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+'" r="4" fill="#fff" stroke="#173a5c" stroke-width="1.8"/>';
 }).join(''):'';
 const extremeIndex=(axis:'x'|'y',mode:'min'|'max')=>hullTop.reduce((best,p,i)=>(mode==='min'?p[axis]<hullTop[best][axis]:p[axis]>hullTop[best][axis])?i:best,0),
 calloutSlots=hullTop.length>=3?[
  {index:extremeIndex('x','min'),x:75,y:407,w:245,h:70,side:'right'},
  {index:extremeIndex('y','max'),x:856,y:684,w:250,h:70,side:'top'},
  {index:extremeIndex('x','max'),x:1095,y:143,w:236,h:70,side:'left'},
  {index:extremeIndex('y','min'),x:423,y:99,w:224,h:70,side:'bottom'}
 ]:[],
 uniqueCalloutSlots=calloutSlots.filter((slot,i,all)=>all.findIndex(other=>other.index===slot.index)===i),
 vertexCallouts=opts.showLabels?uniqueCalloutSlots.map(slot=>{
  const point=hull[slot.index],q=hullTop[slot.index],start=slot.side==='right'?{x:slot.x+slot.w,y:slot.y+slot.h/2}:slot.side==='left'?{x:slot.x,y:slot.y+slot.h/2}:slot.side==='top'?{x:slot.x+slot.w/2,y:slot.y}:{x:slot.x+slot.w/2,y:slot.y+slot.h},
  pointIndex=Math.max(0,valid.indexOf(point)),label=point.id||'V-'+String(pointIndex+1).padStart(2,'0');
  return '<g><line x1="'+start.x+'" y1="'+start.y+'" x2="'+q.x.toFixed(1)+'" y2="'+q.y.toFixed(1)+'" stroke="#14213d" stroke-width="1.2"/><circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+'" r="3.5" fill="#14213d"/><rect x="'+slot.x+'" y="'+slot.y+'" width="'+slot.w+'" height="'+slot.h+'" rx="10" fill="#fff" stroke="#102a56" stroke-width="1.5"/><text x="'+(slot.x+12)+'" y="'+(slot.y+28)+'" font-size="15" font-weight="750" fill="#14213d">'+esc(label)+'</text><text x="'+(slot.x+12)+'" y="'+(slot.y+52)+'" font-size="14" fill="#111827">Altitude: '+fmt(point.z,2)+' m</text></g>';
 }).join(''):'',
 hullCenter=hullTop.length?hullTop.reduce((center,p)=>({x:center.x+p.x/hullTop.length,y:center.y+p.y/hullTop.length}),{x:0,y:0}):{x:700,y:420},
 dimensionEdges=hull.length>=3?hull.map((p,i)=>({i,distance:Math.hypot(hull[(i+1)%hull.length].x-p.x,hull[(i+1)%hull.length].y-p.y)})).sort((a,b)=>b.distance-a.distance).slice(0,Math.min(8,hull.length)).sort((a,b)=>a.i-b.i):[],
 dimensionLabels=dimensionEdges.map(edge=>{
  const a=hullTop[edge.i],b=hullTop[(edge.i+1)%hullTop.length],midX=(a.x+b.x)/2,midY=(a.y+b.y)/2,dx=midX-hullCenter.x,dy=midY-hullCenter.y,length=Math.hypot(dx,dy)||1,x=midX+dx/length*22,y=midY+dy/length*22,label=fmt(edge.distance,1)+' m',width=Math.max(52,Math.ceil(label.length*7.2+14));
  return '<g><rect x="'+(x-width/2).toFixed(1)+'" y="'+(y-11).toFixed(1)+'" width="'+width+'" height="23" rx="4" fill="#eee3b2"/><text x="'+x.toFixed(1)+'" y="'+(y+4).toFixed(1)+'" text-anchor="middle" font-size="12" font-weight="700" fill="#4b4534">'+esc(label)+'</text></g>';
 }).join('');
 const statLabels=stats.slice(0,4).map(([label,value],i)=>{
  const column=i%2,row=Math.floor(i/2);
  return '<g transform="translate('+(column*205)+' '+(row*38)+')"><text x="0" y="0" font-size="12" fill="#5b7187">'+esc(label)+'</text><text x="0" y="18" font-size="14" font-weight="700" fill="#163956">'+esc(value)+'</text></g>';
 }).join(''),
 area=hull.length>=3?polygonArea(hull):0,
 perimeter=hull.length>=3?polygonPerimeter(hull):0,
 property=opts.property||projectName||'Imóvel',
 areaHa=fmt(area/10000,4),
 perimeterText=fmt(perimeter,2)+' m',
 elevationRange=valid.length?fmt(low,2)+'–'+fmt(high,2)+' m':'—',
 datum=esc(opts.datum||'WGS 84'),
 city=esc(opts.city||'Não informado'),
 date=esc(opts.date||'—'),
 technician=esc(opts.technician||'Não informado'),
 logo=opts.logo?'<image href="'+esc(opts.logo)+'" x="1164" y="842" width="180" height="65" preserveAspectRatio="xMidYMid meet"/>':'',
 shadowMarkup=hullTop.length>=3?'<ellipse cx="'+((screenBounds.minX+screenBounds.maxX)/2).toFixed(1)+'" cy="'+(screenBounds.maxY+bottom+7).toFixed(1)+'" rx="'+Math.max(80,Math.min(390,(screenBounds.maxX-screenBounds.minX)*.52)).toFixed(1)+'" ry="'+Math.max(24,Math.min(85,(screenBounds.maxY-screenBounds.minY)*.18)).toFixed(1)+'" fill="#263238" opacity=".12" filter="url(#shadow)"/>':'',
 surfaceMarkup=valid.length>=3?'<g id="volume-3d">'+sideFaces+'<path d="'+edgePath+'" fill="url(#terrainGrad)" stroke="#4b4534" stroke-width="1.9"/>'+sideDetails+'<g clip-path="url(#terrainClip)">'+terrainCells+'<g id="curvas-de-nivel" fill="none">'+contourSvg+'</g>'+contourLabels+'</g>'+edgeOutline+vertexMarks+dimensionLabels+vertexCallouts+'</g>':'<text x="700" y="450" text-anchor="middle" font-size="18" fill="#677d91">Carregue ao menos três pontos com altitude para formar o MDT.</text>',
 contourRange=valid.length?fmt(low,1)+'–'+fmt(high,1)+' m':'—',
 contourRangeWidth=Math.max(56,Math.ceil(contourRange.length*7.2+12)),
 title=esc(opts.title||'PLANTA ALTIMÉTRICA DO IMÓVEL RURAL'),
 propertyText=esc(property),
 areaText=areaHa+' ha · '+perimeterText,
 methodText=method==='IDW'?'IDW':'TIN',
 lineColor=esc(opts.lineColor||'#f9c500');
 return '<?xml version="1.0" encoding="UTF-8"?>'+
 '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1400" height="1120" viewBox="0 0 1400 1120" role="img" aria-label="Planta altimétrica 3D gerada com os dados do levantamento">'+
 '<title>'+title+'</title><defs>'+
 '<linearGradient id="terrainGrad" x1="0%" y1="0%" x2="46%" y2="100%"><stop offset="0" stop-color="#f2dea8"/><stop offset=".35" stop-color="#e9dda1"/><stop offset="1" stop-color="#d0dca0"/></linearGradient>'+
 '<linearGradient id="frontSoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b79a76"/><stop offset="1" stop-color="#806346"/></linearGradient>'+
 '<linearGradient id="sideSoil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b58d62"/><stop offset="1" stop-color="#997552"/></linearGradient>'+
 '<filter id="shadow" x="-40%" y="-50%" width="185%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>'+
 '<clipPath id="terrainClip"><path d="'+edgePath+'"/></clipPath>'+
 '<style>text{font-family:"Segoe UI",Arial,Helvetica,sans-serif}</style>'+
 '</defs><rect x="0" y="0" width="1400" height="1120" fill="#fff"/>'+
 '<rect x="20" y="18" width="1360" height="1082" fill="none" stroke="#14213d" stroke-width="3.5"/>'+
 '<text x="700" y="63" font-size="32" font-weight="800" fill="#14213d" text-anchor="middle">'+title+'</text>'+
 '<g id="rosa-dos-ventos" transform="translate(116 155)"><circle cx="0" cy="0" r="44" fill="none" stroke="#14213d" stroke-width="2.5"/><circle cx="0" cy="0" r="37" fill="none" stroke="#14213d" stroke-width="1.5"/>'+
 '<path d="M 0 -43 L 12 -12 L 0 0 L -12 -12 Z M 43 0 L 12 12 L 0 0 L 12 -12 Z M 0 43 L -12 12 L 0 0 L 12 12 Z M -43 0 L -12 -12 L 0 0 L -12 12 Z" fill="#fff" stroke="#14213d" stroke-width="2"/>'+
 '<path d="M0 -43L0 0L-12 -12Z M43 0L0 0L12 -12Z M0 43L0 0L12 12Z M-43 0L0 0L-12 12Z" fill="#14213d"/>'+
 '<text x="0" y="-57" font-size="21" font-weight="750" fill="#14213d" text-anchor="middle">N</text><text x="0" y="71" font-size="21" font-weight="750" fill="#14213d" text-anchor="middle">S</text><text x="-58" y="7" font-size="20" font-weight="750" fill="#14213d" text-anchor="middle">O</text><text x="58" y="7" font-size="20" font-weight="750" fill="#14213d" text-anchor="middle">L</text></g>'+
 shadowMarkup+surfaceMarkup+
 (valid.length>=3?'<rect x="551" y="372" width="255" height="68" rx="9" fill="#fffdf3" fill-opacity=".92" stroke="#3f3d34" stroke-width="1.3"/><text x="678" y="400" text-anchor="middle" font-size="17" font-weight="750" fill="#14213d">'+propertyText+'</text><text x="678" y="426" text-anchor="middle" font-size="14" fill="#111827">'+areaText+'</text>':'')+
 '<rect x="45" y="794" width="1310" height="281" fill="#fff" stroke="#14213d" stroke-width="2"/><line x1="492" y1="794" x2="492" y2="1075" stroke="#14213d" stroke-width="1.7"/><line x1="994" y1="794" x2="994" y2="1075" stroke="#14213d" stroke-width="1.7"/><line x1="45" y1="891" x2="492" y2="891" stroke="#14213d" stroke-width="1.4"/><line x1="492" y1="951" x2="994" y2="951" stroke="#14213d" stroke-width="1.4"/>'+
 '<text x="268" y="819" text-anchor="middle" font-size="16" font-weight="750" fill="#14213d">SISTEMA DE COORDENADAS</text><text x="268" y="839" text-anchor="middle" font-size="15" font-weight="750" fill="#14213d">GEOGRÁFICAS</text>'+
 '<text x="172" y="861" font-size="13" font-weight="650" fill="#111827">Datum:</text><text x="231" y="861" font-size="13" fill="#111827">'+datum+'</text><text x="172" y="883" font-size="13" font-weight="650" fill="#111827">Tipo:</text><text x="213" y="883" font-size="13" fill="#111827">DD (graus decimais)</text>'+
 '<text x="214" y="914" font-size="15" font-weight="750" fill="#14213d">LEGENDA</text><line x1="216" y1="932" x2="261" y2="932" stroke="'+lineColor+'" stroke-width="5"/><text x="273" y="937" font-size="13" fill="#111827">Perímetro</text>'+
 '<line x1="216" y1="958" x2="261" y2="958" stroke="#9d713f" stroke-width="2"/><text x="273" y="963" font-size="13" fill="#111827">Curvas de nível ('+fmt(interval,1)+' m)</text>'+
 '<rect x="216" y="976" width="'+contourRangeWidth+'" height="22" rx="4" fill="#eee3b2"/><text x="'+(216+contourRangeWidth/2)+'" y="992" text-anchor="middle" font-size="11" font-weight="700" fill="#14213d">'+esc(contourRange)+'</text><text x="'+(226+contourRangeWidth)+'" y="992" font-size="13" fill="#111827">Cotas / altitudes</text>'+
 '<circle cx="220" cy="1014" r="4" fill="#fff" stroke="#173a5c" stroke-width="1.5"/><text x="238" y="1019" font-size="13" fill="#111827">Vértices ('+valid.length+')</text><line x1="216" y1="1038" x2="258" y2="1038" stroke="#111827" stroke-width="1.5"/><line x1="216" y1="1038" x2="224" y2="1032" stroke="#111827" stroke-width="1.3"/><line x1="216" y1="1038" x2="224" y2="1044" stroke="#111827" stroke-width="1.3"/><line x1="258" y1="1038" x2="250" y2="1032" stroke="#111827" stroke-width="1.3"/><line x1="258" y1="1038" x2="250" y2="1044" stroke="#111827" stroke-width="1.3"/><text x="275" y="1042" font-size="13" fill="#111827">Dimensões (m)</text><text x="129" y="1052" font-size="12" font-weight="650" fill="#14213d">MDT · '+methodText+'</text>'+
 '<text x="742" y="824" text-anchor="middle" font-size="18" font-weight="750" fill="#14213d">DADOS DO IMÓVEL</text><text x="514" y="860" font-size="13" font-weight="650" fill="#111827">Imóvel:</text><text x="585" y="860" font-size="13" fill="#111827">'+propertyText+'</text><text x="514" y="883" font-size="13" font-weight="650" fill="#111827">Município/UF:</text><text x="615" y="883" font-size="13" fill="#111827">'+city+'</text>'+
 '<text x="514" y="930" font-size="13" font-weight="650" fill="#111827">Área:</text><text x="567" y="930" font-size="13" fill="#111827">'+areaHa+' ha</text><text x="726" y="930" font-size="13" font-weight="650" fill="#111827">Perímetro:</text><text x="828" y="930" font-size="13" fill="#111827">'+perimeterText+'</text><g transform="translate(514 970)">'+statLabels+'</g><text x="514" y="1051" font-size="13" font-weight="650" fill="#111827">Data:</text><text x="571" y="1051" font-size="13" fill="#111827">'+date+'</text>'+
 '<text x="1174" y="824" text-anchor="middle" font-size="16" font-weight="750" fill="#14213d">DADOS DO LEVANTAMENTO</text><text x="1014" y="860" font-size="12.5" font-weight="650" fill="#111827">Método:</text><text x="1076" y="860" font-size="12.5" fill="#111827">'+methodText+'</text><text x="1014" y="883" font-size="12.5" font-weight="650" fill="#111827">Intermediárias:</text><text x="1118" y="883" font-size="12.5" fill="#111827">'+fmt(interval,1)+' m</text><text x="1014" y="906" font-size="12.5" font-weight="650" fill="#111827">Mestras:</text><text x="1076" y="906" font-size="12.5" fill="#111827">'+fmt(major,1)+' m</text><text x="1014" y="929" font-size="12.5" font-weight="650" fill="#111827">Amplitude:</text><text x="1085" y="929" font-size="12.5" fill="#111827">'+esc(elevationRange)+'</text>'+
 logo+'<text x="1174" y="919" text-anchor="middle" font-size="15" font-weight="750" fill="#14213d">Surveyor Agrimensura</text><text x="1174" y="958" text-anchor="middle" font-size="12.5" fill="#111827">Prancha técnica gerada digitalmente</text><line x1="1014" y1="976" x2="1335" y2="976" stroke="#14213d" stroke-width="1.2"/><text x="1014" y="1006" font-size="12.5" font-weight="650" fill="#111827">Responsável técnico(a):</text><text x="1014" y="1030" font-size="12.5" fill="#111827">'+technician+'</text>'+
 '</svg>';
}export function MDTPage(){const data=useGenerationData();const [input,setInput]=useState(''),[points,setPoints]=useState<GeoPoint[]>([]),[error,setError]=useState(''),[method,setMethod]=useState<'IDW'|'TIN'>('IDW'),[power,setPower]=useState(2),[interval,setInterval]=useState(1),[major,setMajor]=useState(5),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!data.project)return;const pts=data.project.features.flatMap(f=>featureVertices(f)).filter((p,i,a)=>a.findIndex(q=>Math.abs(q.lon-p.lon)<1e-9&&Math.abs(q.lat-p.lat)<1e-9)===i);if(pts.length){setPoints(pts);setInput(serialize(pts));setError('');}},[data.project]);
 const xy=useMemo(()=>{if(!points.length)return [] as ZPoint[];const pr=makeProjection(points[0].lon,points[0].lat);return points.filter((p):p is GeoPoint&{z:number}=>Number.isFinite(p.z)).map(p=>({...pr.toXY(p),z:p.z,id:p.id}));},[points]);
 const apply=()=>{try{const pts=parseInput(input);if(!pts.length)throw new Error('Insira pelo menos 3 pontos com altitude.');setPoints(pts);setError('');}catch(e){setError(e instanceof Error?e.message:'Erro ao interpretar pontos.');}};
 const importFile=async(file:File,reportProgress:UploadProgressReporter)=>{try{const imported=readPointFile(await readUploadText(file,reportProgress),file.name);setPoints(imported);setInput(serialize(imported));setError('');}catch(err){setError(err instanceof Error?err.message:'Formato inválido.');throw err;}};
 const fillAltitude=async()=>{const missing=points.filter(p=>p.z===undefined);if(!missing.length){setError('Todos os pontos já possuem cota.');return;}if(missing.length>200){setError('Consulte no máximo 200 pontos por solicitação.');return;}setBusy(true);setError('');try{const results:number[]=[];for(let i=0;i<missing.length;i+=50){const group=missing.slice(i,i+50),qs=new URLSearchParams({latitude:group.map(p=>p.lat).join(','),longitude:group.map(p=>p.lon).join(',')});const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(`https://api.open-meteo.com/v1/elevation?${qs}`,{signal:controller.signal});if(!r.ok)throw new Error('API retornou HTTP '+r.status);const json=await r.json();if(!Array.isArray(json.elevation)||json.elevation.length!==group.length)throw new Error('Resposta altimétrica incompleta.');results.push(...json.elevation.map(Number));}finally{clearTimeout(timeout)}}let j=0;const updated=points.map(p=>p.z===undefined?{...p,z:results[j++]}:p);setPoints(updated);setInput(serialize(updated));}catch(e){setError('Falha na consulta de elevação Open-Meteo: '+(e instanceof Error?e.message:'indisponível'))}finally{setBusy(false)}};
 const fillWeighted=()=>{try{const known=points.filter((p):p is GeoPoint&{z:number}=>Number.isFinite(p.z));if(known.length<3)throw new Error('São necessários ao menos 3 pontos conhecidos para interpolar as cotas pendentes.');const pr=makeProjection(known[0].lon,known[0].lat),meters=known.map(p=>({...pr.toXY(p),z:p.z}));const updated=points.map(p=>p.z===undefined?{...p,z:idw(meters,pr.toXY(p).x,pr.toXY(p).y,power)}:p);setPoints(updated);setInput(serialize(updated));setError('As cotas faltantes foram interpoladas por IDW. São estimativas, não levantamentos medidos.');}catch(e){setError(e instanceof Error?e.message:'Interpolação indisponível.');}};
 const min=xy.length?Math.min(...xy.map(p=>p.z)):0,max=xy.length?Math.max(...xy.map(p=>p.z)):0,mean=xy.length?xy.reduce((s,p)=>s+p.z,0)/xy.length:0,slope=meanSlope(xy);const stats:[string,string][]=[['Cota mínima',`${min.toFixed(2)} m`],['Cota máxima',`${max.toFixed(2)} m`],['Desnível',`${(max-min).toFixed(2)} m`],['Cota média',`${mean.toFixed(2)} m`],['Decliv. média¹',Number.isFinite(slope)?`${slope.toFixed(2)}%`:'N/D']];
   return <GenerationWorkspace
    kind="mdt"
    heading="Planialtimetria / MDT"
    data={data}
    points={xy}
    stats={xy.length >= 3 ? stats : undefined}
    modelAsset={{
      url: '/models/planta-altimetrica-3d.svg',
      fileName: 'PLANTA_ALTIMETRICA_3D_SURVEYOR.svg',
      createSvg: options => mdtModelSvg(
        xy,
        xy.length >= 3 ? stats : [],
        method,
        power,
        interval,
        major,
        String(data.project?.project?.propertyName || data.project?.project?.name || data.projectId || 'Imóvel'),
        options
      )
    }}
    draw={opts => xy.length >= 3
      ? <Heatmap points={xy} method={method} power={power} interval={interval} major={major} opts={opts}/>
      : <text x="400" y="350" fill="#6f849a" fontSize="14">Carregue 3 ou mais pontos com altitude</text>}
    interpolationContent={
      <>
        <h3>Interpolação e curvas</h3>
        <label className="gen-control">
          <span>Método de interpolação</span>
          <select value={method} onChange={e => setMethod(e.target.value as 'IDW' | 'TIN')}>
            <option value="IDW">IDW • Inverso da distância</option>
            <option value="TIN">TIN • Triangulação Delaunay</option>
          </select>
        </label>
        {method === 'IDW' && <label className="gen-control">
          <span>Potência IDW</span>
          <input type="number" min=".5" max="8" step=".5" value={power} onChange={e => setPower(Math.max(.5, Number(e.target.value) || 2))}/>
        </label>}
        <div className="gen-multi-input">
          <label className="gen-control">
            <span>Intermediárias (m)</span>
            <input type="number" value={interval} min=".1" step=".5" onChange={e => setInterval(Math.max(.1, Number(e.target.value) || 1))}/>
          </label>
          <label className="gen-control">
            <span>Mestras (m)</span>
            <input type="number" min=".1" value={major} step="1" onChange={e => setMajor(Math.max(.1, Number(e.target.value) || 5))}/>
          </label>
        </div>
        <div className="gen-summary">
          <span>Pontos com Z: <b>{xy.length}</b></span>
          <span>Sem Z: <b>{points.length - xy.length}</b></span>
          {xy.length >= 3 && stats.map(([name, value]) => <span key={name}>{name}: <b>{value}</b></span>)}
        </div>
        {error && <p className="gen-error" role="alert">{error}</p>}
      </>
    }
  >
    <h3>Dados altimétricos</h3>
    <FileUploadField
      label="Importar CSV, TXT, GeoJSON, KML ou DXF ASCII POINT"
      accept=".csv,.txt,.json,.geojson,.kml,.dxf"
      maxBytes={50 * 1024 * 1024}
      description="Pontos em latitude/longitude WGS84; até 50 MB."
      onFile={importFile}
    />
    <label className="gen-control">
      <span>Pontos: ID;Latitude;Longitude;Altitude</span>
      <textarea rows={6} value={input} onChange={e => setInput(e.target.value)} placeholder={'V-01;-12.45;-39.65;385.6\nV-02;-12.46;-39.64;387.2'}/>
    </label>
    <div className="gen-action-row">
      <button onClick={apply}>Carregar vértices + altitudes</button>
      <button onClick={() => { setInput(''); setPoints([]); }}>Limpar</button>
    </div>
    <button onClick={fillWeighted}>Calcular cotas ponderadas (IDW)</button>
    <button disabled={busy} onClick={() => void fillAltitude()}>{busy ? 'Consultando...' : 'Consultar elevação automática (Open-Meteo)'}</button>
  </GenerationWorkspace>;
}
