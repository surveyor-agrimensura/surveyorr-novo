/** Geometria e normalização dos rótulos do croqui, sem dependências de React. */
export type XY = {x:number;y:number};
export type ConfrontationGroup = {start:number;indices:number[];label:string};

export function neighborText(raw:unknown):string {
 if(typeof raw==='string'||typeof raw==='number') {const value=String(raw).trim();return value==='[object Object]'?'':value;}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return '';
 const v=raw as Record<string,unknown>;
 for(const k of ['display','label','property','nomePropriedade','nome_imovel','name','nome','confrontante','owner','proprietario','titular']){
  const found=v[k];if(typeof found==='string'&&found.trim())return found.trim();
 }
 return '';
}
export function readConfrontation(props:Record<string,unknown>,index:number,total:number):string {
 for(const name of ['confrontantes','confrontants','neighbors','confrontations']) {
  const raw=props[name];if(!raw)continue;
  if(Array.isArray(raw)) {const result=neighborText(raw[index]);if(result)return result;continue;}
  if(typeof raw!=='object')continue;
  const entries=raw as Record<string,unknown>;
  const next=(index+1)%total;
  const pair=`${Math.min(index,next)}-${Math.max(index,next)}`;
  for(const key of [pair,`${index}-${next}`,`V-${String(index+1).padStart(2,'0')} — V-${String(next+1).padStart(2,'0')}`,String(index),`V-${String(index+1).padStart(2,'0')}`]) {
   if(Object.prototype.hasOwnProperty.call(entries,key)){const value=neighborText(entries[key]);if(value)return value;}
  }
  // Cadastradores anteriores podem salvar uma confrontação cobrindo um intervalo inteiro.
  for(const [key,value] of Object.entries(entries)) {
   const match=/^(\d+)-(\d+)$/.exec(key);
   if(!match)continue;
   const start=Number(match[1]),end=Number(match[2]);
   if(start===end||Math.abs(end-start)===1)continue;
   const inRange=start<end?index>=start&&index<end:index>=start||index<end;
   if(inRange){const label=neighborText(value);if(label)return label;}
  }
 }
 return '';
}
/** Resolve todas as confrontações do perímetro antes de editar um único trecho.
 * Entradas ausentes herdam a geometria; strings vazias explícitas continuam
 * sendo exclusões voluntárias. Nunca descarta os demais segmentos.
 */
export function resolveSegmentConfrontants(
 props:Record<string,unknown>,count:number,
 primary:readonly string[] = [],fallback:readonly string[] = []
):string[] {
 return Array.from({length:Math.max(0,count)},(_,i)=>
  primary[i]!==undefined?neighborText(primary[i]):
  fallback[i]!==undefined?neighborText(fallback[i]):
  readConfrontation(props,i,count));
}

/** Edita só o segmento indicado, preservando os confrontantes dos outros. */
export function setSegmentConfrontant(
 props:Record<string,unknown>,count:number,values:readonly string[],index:number,label:string,
 fallback:readonly string[] = []
):string[] {
 if(!Number.isInteger(index)||index<0||index>=count)throw new Error('Trecho inválido.');
 const next=resolveSegmentConfrontants(props,count,values,fallback);
 next[index]=label;
 return next;
}
/** Agrupa segmentos consecutivos com o mesmo confrontante, inclusive ao cruzar o vértice V-01. */
/** A planta é segmentada por aresta, não por nome: dois trechos adjacentes
 * com o mesmo confrontante permanecem duas identificações independentes.
 * A antiga rotina de agrupamento continua disponível para relatórios resumidos.
 */
export function segmentConfrontations(labels:unknown[]):ConfrontationGroup[] {
 return labels.map((raw,start)=>({start,indices:[start],label:neighborText(raw)})).filter(item=>Boolean(item.label));
}
export function groupConfrontations(labels:unknown[]):ConfrontationGroup[] {
 const normalized=labels.map(neighborText),n=normalized.length;if(!n)return [];
 const equal=(a:string,b:string)=>a.normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('pt-BR')===b.normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
 let first=0;
 // Começa em uma fronteira verdadeira, para não criar rótulos duplicados no fechamento do polígono.
 for(let i=0;i<n;i++){if(!equal(normalized[i],normalized[(i+n-1)%n])){first=i;break;}}
 const groups:ConfrontationGroup[]=[];
 for(let count=0;count<n;){
  const i=(first+count)%n,label=normalized[i],indices=[i];count++;
  while(count<n&&equal(label,normalized[(first+count)%n])){indices.push((first+count)%n);count++;}
  if(label)groups.push({start:i,indices,label});
 }
 return groups;
}
export function polylineMidpoint(points:XY[],indices:number[]):{point:XY;direction:XY}|null {
 if(!indices.length||!points.length)return null;
 const edges=indices.map(i=>{const a=points[i],b=points[(i+1)%points.length];return {a,b,length:Math.hypot(b.x-a.x,b.y-a.y)};});
 const total=edges.reduce((acc,e)=>acc+e.length,0);let left=total/2;
 for(const edge of edges){if(left<=edge.length||edge===edges[edges.length-1]){const t=edge.length?Math.min(1,left/edge.length):0.5;return {point:{x:edge.a.x+(edge.b.x-edge.a.x)*t,y:edge.a.y+(edge.b.y-edge.a.y)*t},direction:{x:edge.b.x-edge.a.x,y:edge.b.y-edge.a.y}};}left-=edge.length;}
 return null;
}
export function roadBoundaries(points:XY[],width:number):{left:XY[];right:XY[]} {
 if(points.length<2)return {left:[],right:[]};
 const half=Math.max(2,Math.min(90,width))/2;
 const normal=(a:XY,b:XY)=>{const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;return {x:-dy/len,y:dx/len};};
 const out=points.map((p,i)=>{
  const n0=normal(points[Math.max(0,i-1)],points[i===0?1:i]);
  const n1=normal(points[i],points[Math.min(points.length-1,i+1)]);
  const nx=n0.x+n1.x,ny=n0.y+n1.y,len=Math.hypot(nx,ny);
  const v=len>0.01?{x:nx/len,y:ny/len}:{...n1};
  const dot=Math.max(.55,Math.abs(v.x*n1.x+v.y*n1.y));
  const d=half/Math.max(.6,dot);
  return {left:{x:p.x+v.x*d,y:p.y+v.y*d},right:{x:p.x-v.x*d,y:p.y-v.y*d}};
 });
 return {left:out.map(v=>v.left),right:out.map(v=>v.right)};
}
export const svgPoints=(pts:XY[])=>pts.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
/** Representa somente as bordas da servidão. As extremidades permanecem abertas,
 * sem o traço transversal criado pelo contorno de um polígono fechado. */
export function openRoadEdgesSvg(left:XY[],right:XY[],color:string,strokeWidth=2):string {
 if(left.length<2||right.length<2)return '';
 return [left,right].map(side=>`<polyline points="${svgPoints(side)}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="butt" stroke-linejoin="round"/>`).join('');
}


/** Traçado arredondado da servidão: pontos clicados são controles de uma
 * curva cúbica de Catmull–Rom. Amostramos a curva para calcular DUAS bordas
 * com a mesma distância e sem ângulos bruscos nos vértices intermediários. */
export function smoothRoadCenterline(points:XY[], step=5):XY[] {
 const clean=points.filter((p,i)=>i===0||Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)>0.01);
 if(clean.length<2)return clean.map(p=>({...p}));
 const out:XY[]=[{...clean[0]}];
 for(let i=0;i<clean.length-1;i++){
  const a=clean[Math.max(0,i-1)],b=clean[i],c=clean[i+1],d=clean[Math.min(clean.length-1,i+2)];
  const length=Math.hypot(c.x-b.x,c.y-b.y);
  const sections=Math.max(2,Math.min(80,Math.ceil(length/Math.max(2,step))));
  // Tangentes simétricas; reduzimos tensão para evitar overshoot nas pontas.
  const m0={x:(c.x-a.x)*0.34,y:(c.y-a.y)*0.34};
  const m1={x:(d.x-b.x)*0.34,y:(d.y-b.y)*0.34};
  for(let j=1;j<=sections;j++){
   const t=j/sections,t2=t*t,t3=t2*t;
   const h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
   out.push({x:h00*b.x+h10*m0.x+h01*c.x+h11*m1.x,y:h00*b.y+h10*m0.y+h01*c.y+h11*m1.y});
  }
 }
 return out;
}
