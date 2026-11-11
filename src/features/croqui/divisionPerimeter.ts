import type {ProjectDivision} from './projectDivisions';
import {distance} from '../memorial/memorialEngine';
/** Mesmo perímetro em Croqui e Prancha; prioriza a medição salva quando válida. */
export function divisionPerimeter(d:ProjectDivision):number{
 return Number.isFinite(d.perimeterM)&&d.perimeterM>0
  ? d.perimeterM
  : d.rings.reduce((total,ring)=>total+ring.reduce((sum,pt,k,arr)=>sum+distance(pt,arr[(k+1)%arr.length]),0),0);
}
