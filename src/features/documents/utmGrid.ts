/** Grade cartográfica UTM de pré-visualização. WGS84, sem transformação de datum. */
import {projectWgs84ToUtm} from '../../lib/wgs84Utm';
export type LonLat = [number,number];
export type ScreenPoint={x:number;y:number};
export function utmFromWgs84([lon,lat]:LonLat,zoneOverride?:number){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||lat<=-80||lat>=84||lon< -180||lon>180)throw new Error('Coordenada fora da cobertura UTM.');
 return projectWgs84ToUtm([lon,lat],zoneOverride);
}
const xml=(n:number)=>Number(n.toFixed(2));
const niceStep=(v:number)=>{const power=10**Math.floor(Math.log10(Math.max(v,.00001)));const factor=v/power;return (factor<=1?1:factor<=2?2:factor<=5?5:10)*power;};
/** Projeta uma grade UTM com linearização LOCAL controlada. Não imprime coordenadas geodésicas de levantamento. */
export function buildUtmGrid(vertices:LonLat[],toScreen:(point:LonLat)=>ScreenPoint,rect:{x:number;y:number;w:number;h:number},color='#94a3b8'):{svg:string;zone:number;hemisphere:string;step:number}{
 if(vertices.length<3)throw new Error('É necessário um perímetro com três vértices.');
 const lon=vertices.reduce((v,p)=>v+p[0],0)/vertices.length,lat=vertices.reduce((v,p)=>v+p[1],0)/vertices.length;
 const center:[number,number]=[lon,lat],utm=utmFromWgs84(center);
 const base=toScreen(center),d=.00001;
 const pE=toScreen([lon+d,lat]),pN=toScreen([lon,lat+d]);
 const ue=utmFromWgs84([lon+d,lat],utm.zone),un=utmFromWgs84([lon,lat+d],utm.zone);
 const de=ue.east-utm.east,dn=ue.north-utm.north,ve=un.east-utm.east,vn=un.north-utm.north;
 const determinant=de*vn-dn*ve;
 if(Math.abs(determinant)<1e-8)throw new Error('Não foi possível calcular a grade UTM.');
 // Matriz afim local e inversa: converte easting/northing em posições SVG.
 const j11=((pE.x-base.x)*vn-(pN.x-base.x)*dn)/determinant;
 const j12=((pN.x-base.x)*de-(pE.x-base.x)*ve)/determinant;
 const j21=((pE.y-base.y)*vn-(pN.y-base.y)*dn)/determinant;
 const j22=((pN.y-base.y)*de-(pE.y-base.y)*ve)/determinant;
 const det=j11*j22-j12*j21;
 if(Math.abs(det)<1e-12)throw new Error('A escala do mapa não permite calcular a grade UTM.');
 const toXY=(east:number,north:number):ScreenPoint=>({x:base.x+j11*(east-utm.east)+j12*(north-utm.north),y:base.y+j21*(east-utm.east)+j22*(north-utm.north)});
 const toEN=(x:number,y:number)=>({east:utm.east+(j22*(x-base.x)-j12*(y-base.y))/det,north:utm.north+(-j21*(x-base.x)+j11*(y-base.y))/det});
 const corners=[toEN(rect.x,rect.y),toEN(rect.x+rect.w,rect.y),toEN(rect.x,rect.y+rect.h),toEN(rect.x+rect.w,rect.y+rect.h)];
 const eMin=Math.min(...corners.map(p=>p.east)),eMax=Math.max(...corners.map(p=>p.east)),nMin=Math.min(...corners.map(p=>p.north)),nMax=Math.max(...corners.map(p=>p.north));
 const span=Math.max((eMax-eMin)/6,(nMax-nMin)/6),step=niceStep(span);
 const lines:string[]=[];let used=0;
 // Grade UTM alinhada à projeção real, com recorte no quadro principal.
 for(let e=Math.ceil(eMin/step)*step;e<=eMax&&used<35;e+=step,used++){
  const q=toXY(e,nMin),r=toXY(e,nMax);
  lines.push(`<line x1="${xml(q.x)}" y1="${xml(q.y)}" x2="${xml(r.x)}" y2="${xml(r.y)}"/>`);
 }
 used=0;
 for(let n=Math.ceil(nMin/step)*step;n<=nMax&&used<35;n+=step,used++){
  const q=toXY(eMin,n),r=toXY(eMax,n);
  lines.push(`<line x1="${xml(q.x)}" y1="${xml(q.y)}" x2="${xml(r.x)}" y2="${xml(r.y)}"/>`);
 }
 const border=`<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="none" stroke="#64748b" stroke-width="1"/>`;
 const safeColor=/^#[a-fA-F0-9]{6}$/.test(color)?color:'#94a3b8';
 const svg=`<defs><clipPath id="surveyor-utm-clip"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"/></clipPath></defs><g class="surveyor-utm-grid" data-grid-zone="${utm.zone}${utm.hemisphere}" clip-path="url(#surveyor-utm-clip)" stroke="${safeColor}" stroke-width=".85" stroke-opacity=".65" stroke-dasharray="5 6" fill="none">${lines.join('')}</g>${border}<text x="${rect.x+7}" y="${rect.y+15}" font-size="11" fill="#334155" font-weight="600">UTM ${utm.zone}${utm.hemisphere} · WGS84 · grade de referência · ${step} m</text>`;
 return {svg,zone:utm.zone,hemisphere:utm.hemisphere,step};
}
