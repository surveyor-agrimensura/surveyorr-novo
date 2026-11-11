import type {Feature,Geometry,GeoJsonProperties} from 'geojson';
import {sphericalRingAreaM2} from '../../lib/sphericalGeodesy';
import {measureMapGeometry} from './geometryMetrics';

type XY=[number,number];
const clamp=(x:number,min:number,max:number)=>Math.min(max,Math.max(min,x));

function dedupeRing(points:XY[]):XY[]{
 const out=points.filter((p,i)=>i===0||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-7);
 if(out.length>1&&Math.hypot(out[0][0]-out[out.length-1][0],out[0][1]-out[out.length-1][1])<=1e-7)out.pop();
 return out;
}

/** Recorta um anel fechado por um semiplano d(p) <= level (ou >= level), suportando polígonos convexos e côncavos. */
function clipPolygonByHalfPlane(points:XY[],dist:(p:XY)=>number,level:number,greater:boolean):XY[][]{
 const ring=dedupeRing(points);
 if(ring.length<3)return [];
 const val=(p:XY)=>greater?dist(p)-level:level-dist(p);
 // Pequeno deslocamento evita degeneração exata sobre vértices de perímetros côncavos.
 const eps=1e-9;
 const vals=ring.map(p=>{const v=val(p);return Math.abs(v)<eps?(v>=0?eps:-eps):v;});
 if(vals.every(v=>v>=0))return [ring];
 if(vals.every(v=>v<0))return [];

 // Tenta reconstruir múltiplos ciclos para polígonos côncavos quando o corte cruza mais de duas arestas.
 type Node={pt:XY;isCross:boolean;entry:boolean;coord:number;nextPoly:number;visited?:boolean};
 // Vetor tangente à linha de corte para ordenar interseções ao longo da reta d(p) = level.
 const p0:XY=[0,0],pX:XY=[1,0],pY:XY=[0,1];
 const gx=dist(pX)-dist(p0),gy=dist(pY)-dist(p0);
 const tx=-gy,ty=gx;
 const along=(p:XY)=>tx*p[0]+ty*p[1];

 // Garante orientação positiva (CCW) no plano XY para pareamento entrada/saída na reta de corte.
 let signed2=0;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  signed2+=a[0]*b[1]-b[0]*a[1];
 }
 const ccwRing=signed2>=0?ring:ring.slice().reverse();
 const ccwVals=signed2>=0?vals:vals.slice().reverse();

 const nodes:Node[]=[];
 const crossIndices:number[]=[];
 for(let i=0;i<ccwRing.length;i++){
  const next=(i+1)%ccwRing.length;
  const a=ccwRing[i],b=ccwRing[next];
  const va=ccwVals[i],vb=ccwVals[next];
  if(va>=0){
   nodes.push({pt:a,isCross:false,entry:false,coord:along(a),nextPoly:-1});
  }
  if((va>=0)!==(vb>=0)){
   const t=clamp(va/(va-vb),0,1);
   const ipt:XY=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   const idx=nodes.length;
   // entry=true quando entramos na região válida (va < 0 -> vb >= 0)
   nodes.push({pt:ipt,isCross:true,entry:va<0,coord:along(ipt),nextPoly:-1});
   crossIndices.push(idx);
  }
 }
 for(let i=0;i<nodes.length;i++)nodes[i].nextPoly=(i+1)%nodes.length;

 if(crossIndices.length<=2){
  const single=dedupeRing(nodes.map(n=>n.pt));
  return single.length>=3?[single]:[];
 }

 // Se houver mais de 2 cruzamentos (polígono côncavo cortado em mais de uma aba),
 // ordenamos os cruzamentos ao longo da linha de corte e ligamos cada saída (entry=false) à entrada correspondente.
 const sortedCross=[...crossIndices].sort((i,j)=>nodes[i].coord-nodes[j].coord);
 const cutPair=new Map<number,number>();
 // Na orientação CCW onde o semiplano válido fica à esquerda do sentido da reta (ou vice-versa),
 // os cruzamentos ao longo da reta alternam em pares consecutivos.
 for(let k=0;k+1<sortedCross.length;k+=2){
  const c1=sortedCross[k],c2=sortedCross[k+1];
  if(nodes[c1].entry!==nodes[c2].entry){
   const exitIdx=nodes[c1].entry?c2:c1;
   const entryIdx=nodes[c1].entry?c1:c2;
   cutPair.set(exitIdx,entryIdx);
  }
 }

 if(cutPair.size*2!==sortedCross.length){
  const fallback=dedupeRing(nodes.map(n=>n.pt));
  return fallback.length>=3?[fallback]:[];
 }

 const loops:XY[][]=[];
 for(const startIdx of crossIndices){
  if(nodes[startIdx].visited||!nodes[startIdx].entry)continue;
  const loop:XY[]=[];
  let curr=startIdx;
  let guard=0;
  while(!nodes[curr].visited&&guard++<=nodes.length*2){
   nodes[curr].visited=true;
   loop.push(nodes[curr].pt);
   if(nodes[curr].isCross&&!nodes[curr].entry){
    const paired=cutPair.get(curr);
    if(paired===undefined)break;
    curr=paired;
   }else{
    curr=nodes[curr].nextPoly;
   }
   if(curr===startIdx)break;
  }
  const clean=dedupeRing(loop);
  if(clean.length>=3)loops.push(clean);
 }
 if(!loops.length){
  const fallback=dedupeRing(nodes.map(n=>n.pt));
  return fallback.length>=3?[fallback]:[];
 }
 return loops;
}

function clipBand(points:XY[],dist:(p:XY)=>number,low:number,high:number):XY[][]{
 const afterLow=clipPolygonByHalfPlane(points,dist,low,true);
 return afterLow.flatMap(ring=>clipPolygonByHalfPlane(ring,dist,high,false));
}

export type GlebaSplitOptions={
 axis?:0|1;
 angleDeg?:number;
 targetAreasHa?:number[];
 names?:string[];
 colors?:string[];
};

export const GLEBA_PALETTE=['#2075db','#15a876','#a855f7','#ef8b25','#d84588','#17a9bf','#83a530','#c15e3c','#0284c7','#e11d48','#4f46e5','#ca8a04'];
const defaultColors=GLEBA_PALETTE;

/** Divisão por faixas de área (iguais ou personalizadas) em qualquer eixo ou azimute, compatível com polígonos convexos e côncavos. */
export function splitPolygonIntoLots(
 input:Feature<Geometry,GeoJsonProperties>,
 count:number,
 axis:0|1=0,
 options?:GlebaSplitOptions
):Feature<Geometry,GeoJsonProperties>[] {
 if(input.geometry.type!=='Polygon'||input.geometry.coordinates.length!==1)throw new Error('Selecione um polígono simples sem furos.');
 if(!Number.isInteger(count)||count<2||count>30)throw new Error('Informe de 2 a 30 glebas.');
 const coords=input.geometry.coordinates[0];
 const bare=coords.length>1&&coords[0][0]===coords.at(-1)?.[0]&&coords[0][1]===coords.at(-1)?.[1]?coords.slice(0,-1):coords;
 if(bare.length<3||bare.length>1500)throw new Error('Polígono inválido ou complexo demais para divisão preliminar.');
 const lat0=bare.reduce((s,p)=>s+p[1],0)/bare.length*Math.PI/180;
 const lon0=bare.reduce((s,p)=>s+p[0],0)/bare.length*Math.PI/180;
 const R=6378137,cos=Math.cos(lat0);
 const toXY=([lon,lat]:number[]):XY=>[(lon*Math.PI/180-lon0)*R*cos,(lat*Math.PI/180-lat0)*R];
 const toLonLat=([x,y]:XY):[number,number]=>[(lon0+x/(R*cos))*180/Math.PI,(lat0+y/R)*180/Math.PI];
 const source=bare.map(toXY);
 // Use the same spherical area formula as measureMapGeometry and the map UI.
 const ringArea=(p:XY[])=>p.length<3?0:sphericalRingAreaM2(p.map(toLonLat));
 const loopsArea=(loops:XY[][])=>loops.reduce((s,r)=>s+ringArea(r),0);
 const total=ringArea(source);
 if(total<1)throw new Error('Área pequena demais para esta operação.');

 // Direção do eixo de avanço dos cortes:
 // axis=0 -> Oeste->Leste (0 rad), axis=1 -> Sul->Norte (PI/2 rad), ou angleDeg personalizado.
 const rad=typeof options?.angleDeg==='number'&&Number.isFinite(options.angleDeg)
  ?(options.angleDeg*Math.PI/180)
  :(axis===1?Math.PI/2:0);
 const nx=Math.cos(rad),ny=Math.sin(rad);
 const dist=(p:XY)=>nx*p[0]+ny*p[1];

 const proj=source.map(dist);
 const min=Math.min(...proj),max=Math.max(...proj);
 const customHa=options?.targetAreasHa?.filter(v=>Number.isFinite(v)&&v>0);
 const weights=customHa&&customHa.length===count?customHa:Array.from({length:count},()=>1);
 const weightSum=weights.reduce((a,b)=>a+b,0)||count;
 const expectedAreas=weights.map(weight=>total*weight/weightSum);
 const cumulativeTargets:number[]=[];
 let acc=0;
 for(let index=0;index<count-1;index++){
  acc+=weights[index]/weightSum;
  const desired=total*acc;
  let lo=min,hi=max;
  for(let pass=0;pass<56;pass++){
   const mid=(lo+hi)/2;
   const a=loopsArea(clipPolygonByHalfPlane(source,dist,mid,false));
   if(a<desired)lo=mid;else hi=mid;
  }
  cumulativeTargets.push((lo+hi)/2);
 }
 const boundaries=[min-1,...cumulativeTargets,max+1];
 const results:Feature<Geometry,GeoJsonProperties>[]=[];
 for(let index=0;index<count;index++){
  const slices=clipBand(source,dist,boundaries[index],boundaries[index+1]).filter(r=>r.length>=3&&ringArea(r)>=0.5);
  if(!slices.length)throw new Error('A geometria não produziu glebas válidas.');
  // Ordena pelo maior anel; se uma gleba côncava tiver apenas 1 anel, gera Polygon, senão une o anel principal.
  slices.sort((a,b)=>ringArea(b)-ringArea(a));
  const chosen=slices[0];
  const ring=chosen.map(toLonLat);ring.push([...ring[0]]);
  const geometry:Geometry=slices.length===1
   ?{type:'Polygon',coordinates:[ring]}
   :{type:'MultiPolygon',coordinates:slices.map(s=>{const r=s.map(toLonLat);r.push([...r[0]]);return [r];})};
  const areaM2=measureMapGeometry(geometry).areaM2;
  const color=options?.colors?.[index]||defaultColors[index%defaultColors.length];
  const name=options?.names?.[index]?.trim()||`Gleba ${String(index+1).padStart(2,'0')}`;
  results.push({
   type:'Feature',
   id:crypto.randomUUID(),
   properties:{
    source:'surveyor-gleba-preliminar',
    name,
    category:'Gleba',
    parentFeatureId:String(input.id),
    estimatedAreaHa:areaM2/10000,
    lotColor:color,
    fillColor:color,
    strokeColor:color,
    fillOpacity:0.28,
    createdAt:new Date().toISOString()
   },
   geometry
  });
 }
 const sum=results.reduce((s,f)=>s+Number(f.properties?.estimatedAreaHa||0),0);
 if(Math.abs(sum-total/10000)/(total/10000)>0.01)throw new Error('Conferência de áreas falhou. Divisão descartada.');
 const measuredAreas=results.map(feature=>measureMapGeometry(feature.geometry).areaM2);
 if(measuredAreas.some((area,index)=>expectedAreas[index]<=0||Math.abs(area-expectedAreas[index])/expectedAreas[index]>0.005))
  throw new Error('A divisão não atingiu as proporções de área solicitadas. Ajuste a orientação ou a quantidade de glebas.');
 return results;
}

/** A linha guia fornece a DIREÇÃO do corte (ou o corte direto sobre a linha quando directCut=true).
 * Suporta polígonos convexos e côncavos, áreas iguais (2 ou N glebas) ou proporção personalizada.
 */
export function splitPolygonByGuide(
 source:Feature<Geometry,GeoJsonProperties>,
 guide:Feature<Geometry,GeoJsonProperties>,
 options?:{count?:number;directCut?:boolean;targetAreasHa?:number[];names?:string[];colors?:string[]}
):Feature<Geometry,GeoJsonProperties>[] {
 if(source.geometry.type!=='Polygon'||source.geometry.coordinates.length!==1||guide.geometry.type!=='LineString'||guide.geometry.coordinates.length<2)throw new Error('Selecione um polígono simples e uma linha guia.');
 const raw=source.geometry.coordinates[0];const bare=raw.length>1&&raw[0][0]===raw.at(-1)?.[0]&&raw[0][1]===raw.at(-1)?.[1]?raw.slice(0,-1):raw;
 if(bare.length<3||bare.length>1500)throw new Error('Perímetro inválido para a divisão.');
 const latitude=bare.reduce((s,p)=>s+p[1],0)/bare.length*Math.PI/180,lon=bare.reduce((s,p)=>s+p[0],0)/bare.length*Math.PI/180;
 const R=6378137,c=Math.cos(latitude);
 const toXY=([x,y]:number[]):XY=>[(x*Math.PI/180-lon)*R*c,(y*Math.PI/180-latitude)*R];
 const unproject=([x,y]:XY):[number,number]=>[(lon+x/(R*c))*180/Math.PI,(latitude+y/R)*180/Math.PI];
 const ring=bare.map(toXY);
 const guidePoints=guide.geometry.coordinates.map(toXY);
 const first=guidePoints[0],last=guidePoints.at(-1)!;
 let origin=first;
 let dx=last[0]-first[0],dy=last[1]-first[1],length=Math.hypot(dx,dy);
 if(length<.01){
  for(let i=1;i<guidePoints.length;i++){
   const segmentX=guidePoints[i][0]-guidePoints[i-1][0],segmentY=guidePoints[i][1]-guidePoints[i-1][1];
   const segmentLength=Math.hypot(segmentX,segmentY);
   if(segmentLength>length){origin=guidePoints[i-1];dx=segmentX;dy=segmentY;length=segmentLength;}
  }
 }
 if(length<.01)throw new Error('A linha-guia precisa de dois pontos distintos.');
 // Faixas deslocam-se na normal; seus limites permanecem paralelos à direção desenhada.
 const nx=-dy/length,ny=dx/length;
 const distance=(p:XY)=>nx*(p[0]-origin[0])+ny*(p[1]-origin[1]);
 const levels=ring.map(distance),min=Math.min(...levels),max=Math.max(...levels);
 // Match exactly the spherical area reported by measureMapGeometry.
 const surfaceArea=(points:XY[])=>points.length<3?0:sphericalRingAreaM2(points.map(unproject));
 const loopsArea=(loops:XY[][])=>loops.reduce((s,r)=>s+surfaceArea(r),0);
 const fullArea=surfaceArea(ring);
 if(fullArea<1)throw new Error('O perímetro tem área insuficiente.');

 const count=Math.max(2,Math.min(30,Number(options?.count)||2));
 if(options?.directCut&&count===2){
  // Corte exatamente sobre a reta que passa pela linha guia desenhada (offset = 0)
  const leftLoops=clipPolygonByHalfPlane(ring,distance,0,false).filter(r=>r.length>=3&&surfaceArea(r)>=1);
  const rightLoops=clipPolygonByHalfPlane(ring,distance,0,true).filter(r=>r.length>=3&&surfaceArea(r)>=1);
  if(!leftLoops.length||!rightLoops.length)throw new Error('A linha desenhada não atravessa o polígono em duas partes válidas.');
  return [leftLoops,rightLoops].map((loops,i)=>{
   loops.sort((a,b)=>surfaceArea(b)-surfaceArea(a));
   const color=options?.colors?.[i]||defaultColors[i%defaultColors.length];
   const name=options?.names?.[i]?.trim()||`Gleba recortada ${i+1}`;
   const coords=loops[0].map(unproject);coords.push([...coords[0]]);
   const geometry:Geometry=loops.length===1
    ?{type:'Polygon',coordinates:[coords]}
    :{type:'MultiPolygon',coordinates:loops.map(l=>{const r=l.map(unproject);r.push([...r[0]]);return [r];})};
   const areaM2=measureMapGeometry(geometry).areaM2;
   return {
    type:'Feature',
    id:crypto.randomUUID(),
    properties:{
     source:'surveyor-gleba-preliminar',
     name,
     category:'Gleba',
     parentFeatureId:String(source.id),
     estimatedAreaHa:areaM2/10000,
     equalArea:false,
     guideOffsetMeters:0,
     lotColor:color,
     fillColor:color,
     strokeColor:color,
     fillOpacity:0.28,
     createdAt:new Date().toISOString()
    },
    geometry
   };
  });
 }

 const customHa=options?.targetAreasHa?.filter(v=>Number.isFinite(v)&&v>0);
 const weights=customHa&&customHa.length===count?customHa:Array.from({length:count},()=>1);
 const weightSum=weights.reduce((a,b)=>a+b,0)||count;
 const expectedAreas=weights.map(weight=>fullArea*weight/weightSum);
 const offsets:number[]=[];
 let acc=0;
 for(let idx=0;idx<count-1;idx++){
  acc+=weights[idx]/weightSum;
  const desired=fullArea*acc;
  let lo=min,hi=max;
  for(let i=0;i<60;i++){
   const mid=(lo+hi)/2;
   if(loopsArea(clipPolygonByHalfPlane(ring,distance,mid,false))<desired)lo=mid;else hi=mid;
  }
  offsets.push((lo+hi)/2);
 }
 const bounds=[min-1,...offsets,max+1];
 const pieces=Array.from({length:count},(_,idx)=>clipBand(ring,distance,bounds[idx],bounds[idx+1]).filter(r=>r.length>=3&&surfaceArea(r)>=0.5));
 const calculated=pieces.map(loopsArea);
 if(pieces.some(p=>!p.length)||calculated.some(a=>a<1))throw new Error('Não foi possível gerar duas glebas válidas.');
 const sumCalc=calculated.reduce((a,b)=>a+b,0);
 if(Math.abs(sumCalc-fullArea)/fullArea>0.005)throw new Error('Não foi possível validar a área total gerada.');
 const measuredAreas=pieces.map(loops=>{
  const coordinates=loops.map(loop=>{
   const closed=loop.map(unproject);closed.push([...closed[0]]);return closed;
  });
  return measureMapGeometry({type:'MultiPolygon',coordinates:coordinates.map(ring=>[ring])}).areaM2;
 });
 if(measuredAreas.some((area,index)=>expectedAreas[index]<=0||Math.abs(area-expectedAreas[index])/expectedAreas[index]>0.005))
  throw new Error('A divisão não atingiu as proporções de área solicitadas. Ajuste a linha guia ou a quantidade de glebas.');
 return pieces.map((loops,i)=>{
  loops.sort((a,b)=>surfaceArea(b)-surfaceArea(a));
  const coords=loops[0].map(unproject);coords.push([...coords[0]]);
  const geometry:Geometry=loops.length===1
   ?{type:'Polygon',coordinates:[coords]}
   :{type:'MultiPolygon',coordinates:loops.map(l=>{const r=l.map(unproject);r.push([...r[0]]);return [r];})};
  const areaM2=measureMapGeometry(geometry).areaM2;
  const color=options?.colors?.[i]||defaultColors[i%defaultColors.length];
  const name=options?.names?.[i]?.trim()||`Gleba recortada ${i+1}`;
  return {
   type:'Feature',
   id:crypto.randomUUID(),
   properties:{
    source:'surveyor-gleba-preliminar',
    name,
    category:'Gleba',
    parentFeatureId:String(source.id),
    estimatedAreaHa:areaM2/10000,
    equalArea:!customHa,
    guideOffsetMeters:offsets[0]??0,
    lotColor:color,
    fillColor:color,
    strokeColor:color,
    fillOpacity:0.28,
    createdAt:new Date().toISOString()
   },
   geometry
  };
 });
}
