import {useEffect,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {embedSvgSatellite} from '../lib/satelliteSvg';
/** Uses the same generated croqui for the screen and printable Memorial page.
 * Background requests may fail offline. In that case remote URLs are retained,
 * rather than silently replacing the satellite with a blank map.
 */
export function PortableCroquiSvg({svg,onPointerDown,onPointerMove,onPointerUp,onPointerCancel}:{
 svg:string;
 onPointerDown?:(event:ReactPointerEvent<HTMLDivElement>)=>void;
 onPointerMove?:(event:ReactPointerEvent<HTMLDivElement>)=>void;
 onPointerUp?:(event:ReactPointerEvent<HTMLDivElement>)=>void;
 onPointerCancel?:(event:ReactPointerEvent<HTMLDivElement>)=>void;
}){
 const [portable,setPortable]=useState<{source:string;body:string;missing:number}|null>(null);
 useEffect(()=>{
  let alive=true;
  void embedSvgSatellite(svg).then(prepared=>{
   if(alive)setPortable({source:svg,body:prepared.svg,missing:prepared.missing});
  }).catch(()=>{if(alive)setPortable(null);});
  return ()=>{alive=false;};
 },[svg]);
 const resolved=portable?.source===svg?portable:null;
 return <div className="mem-official-svg">
  {resolved&&resolved.missing>0&&<small className="mem-satellite-warning" role="status">Satélite: {resolved.missing} imagem(ns) remota(s) não incorporadas. Confira a impressão.</small>}
  <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} dangerouslySetInnerHTML={{__html:resolved?.body||svg}}/>
 </div>;
}
