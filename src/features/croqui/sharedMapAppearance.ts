/** Single source for map-only properties shared by Croqui, Prancha and Memorial.
 * Document-specific layout/scale/frames remain independent. */
import {record} from '../memorial/memorialEngine';
export type MapName={id:string;text:string;lon:number;lat:number;color:string;size:number;angle:number};
export type MapAppearance={polygonFill?:string;polygonStroke?:string;polygonStrokeWidth?:number;featureStyles?:Record<string,{fillColor?:string;strokeColor?:string;strokeWidth?:number}>;divisionColors?:Record<string,string>;mapNames?:MapName[]};
const color=(v:unknown)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function normalizeMapNames(value:unknown):MapName[]{
 if(!Array.isArray(value))return [];
 const ids=new Set<string>();return value.flatMap((item:unknown)=>{
  const v=record(item),id=String(v.id||''),lon=Number(v.lon),lat=Number(v.lat);
  if(!id||ids.has(id)||!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>85)return [];
  ids.add(id);return [{id,text:String(v.text||'').slice(0,180),lon,lat,color:color(v.color)?String(v.color):'#111827',size:Math.max(6,Math.min(36,Number(v.size)||13)),angle:Math.max(-180,Math.min(180,Number(v.angle)||0))}];
 });
}
/** Os nomes livres têm aparência própria em `mapNames`, não nos mapas genéricos
 * `labelSizes` / `labelAngles` usados pelos rótulos de vértices e glebas. */
export function mapNameForLabel(names:readonly MapName[],labelKey:string):MapName|undefined{
 if(!labelKey.startsWith('map-name:'))return undefined;
 return names.find(item=>item.id===labelKey.slice('map-name:'.length));
}
export function updateMapNameAppearance(names:readonly MapName[],labelKey:string,patch:Partial<Pick<MapName,'color'|'size'|'angle'>>):MapName[]{
 const selected=mapNameForLabel(names,labelKey);
 if(!selected)return [...names];
 return names.map(item=>item.id===selected.id?normalizeMapNames([{...item,...patch}])[0]||item:item);
}

export function readMapAppearance(options:unknown,projectId:string,featureId:string):MapAppearance{
 const v=record(record(record(options).mapAppearanceByFeature)[projectId]);
 const value=record(v[featureId]);
 const out:MapAppearance={};
 if(color(value.polygonFill))out.polygonFill=String(value.polygonFill);
 if(color(value.polygonStroke))out.polygonStroke=String(value.polygonStroke);
 if(Number.isFinite(Number(value.polygonStrokeWidth)))out.polygonStrokeWidth=Math.max(.5,Math.min(12,Number(value.polygonStrokeWidth)));
 const features=record(value.featureStyles) as NonNullable<MapAppearance['featureStyles']>;
 const divisions=record(value.divisionColors) as Record<string,string>;
 const featureStyles={...features},divisionColors={...divisions};
 // Sheet keys featureId:partIndex; Croqui keys featureId / featureId:parte-N.
 for(const [key,col] of Object.entries(divisions)){
  const m=/^(.*):(\d+)$/.exec(key);
  if(m&&color(col)){const id=Number(m[2])===0?m[1]:`${m[1]}:parte-${Number(m[2])+1}`;featureStyles[id]={...featureStyles[id],fillColor:col,strokeColor:col};}
 }
 for(const [key,style] of Object.entries(features)){
  const m=/^(.*):parte-(\d+)$/.exec(key);
  const id=m?`${m[1]}:${Number(m[2])-1}`:`${key}:0`;
  if(!divisionColors[id]&&color(style?.fillColor))divisionColors[id]=String(style.fillColor);
 }
 if(Object.keys(featureStyles).length)out.featureStyles=featureStyles;
 if(Object.keys(divisionColors).length)out.divisionColors=divisionColors;
 if(Array.isArray(value.mapNames))out.mapNames=normalizeMapNames(value.mapNames);
 return out;
}
/** Only modifies the selected project/feature. All other customization fields survive. */
export function mapAppearancePatch(options:unknown,projectId:string,featureId:string,source:MapAppearance):Record<string,unknown>{
 const prev=record(options),all=record(prev.mapAppearanceByFeature),project=record(all[projectId]);
 const current=record(project[featureId]);
 const next:Record<string,unknown>={...current};
 if(color(source.polygonFill))next.polygonFill=source.polygonFill;
 if(color(source.polygonStroke))next.polygonStroke=source.polygonStroke;
 if(typeof source.polygonStrokeWidth==='number'&&Number.isFinite(source.polygonStrokeWidth))next.polygonStrokeWidth=source.polygonStrokeWidth;
 if(source.featureStyles){
  next.featureStyles=source.featureStyles;
  const colors={...record(next.divisionColors)};
  for(const [key,style] of Object.entries(source.featureStyles)){
   const m=/^(.*):parte-(\d+)$/.exec(key),id=m?`${m[1]}:${Number(m[2])-1}`:`${key}:0`;
   if(color(style?.fillColor))colors[id]=style.fillColor;
  }
  next.divisionColors=colors;
 }
 if(source.divisionColors){
  next.divisionColors={...record(next.divisionColors),...source.divisionColors};
  const features={...record(next.featureStyles)};
  for(const [key,col] of Object.entries(source.divisionColors)){
   const m=/^(.*):(\d+)$/.exec(key);
   if(m&&color(col)){const id=Number(m[2])===0?m[1]:`${m[1]}:parte-${Number(m[2])+1}`;features[id]={...record(features[id]),fillColor:col,strokeColor:col};}
  }
  next.featureStyles=features;
 }
 if(source.mapNames)next.mapNames=normalizeMapNames(source.mapNames);
 return {mapAppearanceByFeature:{...all,[projectId]:{...project,[featureId]:next}}};
}
