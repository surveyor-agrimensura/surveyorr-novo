/** Quadro de caminhamento geográfico aproximado, somente leitura. */
import {azimuth, distance, type SurveyPolygon} from '../memorial/memorialEngine';

export type SegmentReading = {
 index: number;
 from: string;
 to: string;
 distanceM: number;
 azimuthDegrees: number | null;
 azimuthLabel: string;
 bearingLabel: string;
 neighbor: string;
};

const numberPt=(value:number)=>value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

/** Arredonda para décimos de segundo antes de dividir em graus/minutos/segundos. */
export function degreesMinutesSeconds(degrees:number):string {
 if(!Number.isFinite(degrees)||degrees<0)return '—';
 const tenths=Math.round(degrees*36000);
 const d=Math.floor(tenths/36000);
 const m=Math.floor((tenths%36000)/600);
 const s=(tenths%600)/10;
 return `${d}°${String(m).padStart(2,'0')}'${s.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}).padStart(4,'0')}″`;
}

export function azimuthToRumo(value:number):string {
 if(!Number.isFinite(value))return '—';
 const bearing=((value%360)+360)%360;
 // A orientação deve acompanhar o arredondamento de décimos de segundo.
 const rounded=Math.round(bearing*36000)%(360*36000);
 if(rounded===0)return 'N';
 if(rounded===90*36000)return 'L';
 if(rounded===180*36000)return 'S';
 if(rounded===270*36000)return 'O';
 const degrees=rounded/36000;
 if(degrees<90)return `N ${degreesMinutesSeconds(degrees)} L`;
 if(degrees<180)return `S ${degreesMinutesSeconds(180-degrees)} L`;
 if(degrees<270)return `S ${degreesMinutesSeconds(degrees-180)} O`;
 return `N ${degreesMinutesSeconds(360-degrees)} O`;
}

/** Usa WGS84 (lon/lat); não transforma as medidas em distâncias topográficas planas. */
export function segmentReadings(polygon:SurveyPolygon, names:string[],neighbors:string[]):SegmentReading[] {
 const count=polygon.vertices.length;
 if(count<2)return [];
 return polygon.vertices.map((start,index)=>{
  const endIndex=(index+1)%count;
  const length=distance(start,polygon.vertices[endIndex]);
  const bearing=length>0.0001?azimuth(start,polygon.vertices[endIndex]):null;
  return {
   index, from:names[index]||`V-${index+1}`,to:names[endIndex]||`V-${endIndex+1}`,
   distanceM:length,azimuthDegrees:bearing,
   azimuthLabel:bearing===null?'—':degreesMinutesSeconds(Math.round(bearing*36000)%(360*36000)/36000),
   bearingLabel:bearing===null?'—':azimuthToRumo(bearing),
   neighbor:neighbors[index]||''
  };
 });
}

export function segmentReadingsCsv(rows:SegmentReading[]):string {
 // Não executar fórmulas inseridas em nomes/confrontações ao abrir no Excel.
 const escaped=(value:string|number)=>{
  const raw=String(value);
  const safe=/^[\s\u0000-\u001f]*[=+@-]/.test(raw)?`'${raw}`:raw;
  return `"${safe.replace(/"/g,'""')}"`;
 };
 return '\ufeff'+[
  ['Vértice inicial','Vértice final','Azimute aproximado','Rumo aproximado','Distância aproximada (m)','Confrontante'].map(escaped).join(';'),
  ...rows.map(row=>[row.from,row.to,row.azimuthLabel,row.bearingLabel,numberPt(row.distanceM),row.neighbor].map(escaped).join(';'))
 ].join('\r\n');
}
