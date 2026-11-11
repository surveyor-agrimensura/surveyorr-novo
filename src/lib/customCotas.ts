import { distance, type Vertex } from '../features/memorial/memorialEngine';
/** Cota diagonal/direta entre dois vértices, sem percorrer os trechos intermediários. */
export type CustomCota = { id:string; target:string; from:number; to:number; offsetX?:number; offsetY?:number };
export function normalizedCustomCotas(raw: unknown): CustomCota[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item):item is CustomCota=>Boolean(item && typeof item.id==='string' && typeof item.target==='string' && Number.isInteger(item.from) && Number.isInteger(item.to) && item.from>=0 && item.to>=0 && item.from!==item.to)).slice(0,100).map(item=>({...item,offsetX:Math.max(-800,Math.min(800,Number(item.offsetX)||0)),offsetY:Math.max(-800,Math.min(800,Number(item.offsetY)||0))}));
}
export function cotaDistance(vertices:readonly Vertex[],from:number,to:number):number | null {
  if (!Number.isInteger(from)||!Number.isInteger(to)||from===to||!vertices[from]||!vertices[to]) return null;
  return distance(vertices[from],vertices[to]);
}
export type CustomCotaTextAppearance={
 colors?:Record<string,string>;
 angles?:Record<string,number>;
 sizes?:Record<string,number>;
 offsets?:Record<string,{dx:number;dy:number}>;
};
export function drawCustomCotas(cotas:readonly CustomCota[],target:string,vertices:readonly Vertex[],project:(point:Vertex)=>{x:number;y:number},color='#0f766e',draggable=false,appearance?:CustomCotaTextAppearance):string {
 const esc=(str:string)=>str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 return cotas.filter(c=>c.target===target).map(c=>{
   const meters=cotaDistance(vertices,c.from,c.to);
   if(meters===null)return '';
   const a=project(vertices[c.from]),b=project(vertices[c.to]);
   const length=Math.hypot(b.x-a.x,b.y-a.y); if(length<1)return '';
   const nx=(b.y-a.y)/length,ny=-(b.x-a.x)/length;
   const ox=nx*10,oy=ny*10;
   // Deslocamento visual independente. A distância e os dois vértices originais não mudam.
   const offsetX=Math.max(-800,Math.min(800,Number(c.offsetX)||0));
   const offsetY=Math.max(-800,Math.min(800,Number(c.offsetY)||0));
   const midpoint={x:(a.x+b.x)/2+ox*1.8+offsetX,y:(a.y+b.y)/2+oy*1.8+offsetY};
   const rawAngle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
   const angle=rawAngle>90?rawAngle-180:rawAngle< -90?rawAngle+180:rawAngle;
   const p=(n:number)=>Number(n.toFixed(2));
   const name=`V-${String(c.from+1).padStart(2,'0')} → V-${String(c.to+1).padStart(2,'0')}`;
   const label=`${meters.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} m`;
   const labelKey=`custom-cota:${c.id}`;
   const shift=appearance?.offsets?.[labelKey]||{dx:0,dy:0};
   const labelX=p(midpoint.x+shift.dx),labelY=p(midpoint.y+shift.dy);
   const labelAngle=appearance?.angles?.[labelKey]??angle;
   const size=10*(appearance?.sizes?.[labelKey]??100)/100;
   const labelColor=appearance?.colors?.[labelKey]||color;
   // As extremidades geométricas permanecem ancoradas aos vértices. Somente a linha
   // de cota desloca, ligada aos vértices pelas extensões de referência.
   const x1=p(a.x+ox+offsetX),y1=p(a.y+oy+offsetY);
   const x2=p(b.x+ox+offsetX),y2=p(b.y+oy+offsetY);
   const path=`M${p(a.x)} ${p(a.y)} L${x1} ${y1} L${x2} ${y2} L${p(b.x)} ${p(b.y)}`;
   const hit=draggable?`<path data-custom-cota-drag="${esc(c.id)}" d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="transparent" stroke-width="18" pointer-events="stroke" style="cursor:grab;touch-action:none"/>`:'';
   const dragProps=draggable?`data-custom-cota-drag="${esc(c.id)}" pointer-events="all" style="cursor:grab;user-select:none;touch-action:none"`:appearance?`data-croqui-label="${esc(labelKey)}" pointer-events="all" style="cursor:grab;user-select:none;touch-action:none"`:'pointer-events="none"';
   return `<g class="surveyor-custom-cota" data-custom-cota="${esc(c.id)}" aria-label="${esc(name)}"${draggable||appearance?'':' pointer-events="none"'}><path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="5 2" pointer-events="none"/>${hit}<text ${dragProps} x="${labelX}" y="${labelY}" text-anchor="middle" font-size="${p(size)}" font-weight="700" fill="${esc(labelColor)}" stroke="#fff" stroke-width="3" paint-order="stroke" transform="rotate(${p(labelAngle)} ${labelX} ${labelY})">${esc(label)}</text></g>`;
 }).join('');
}
