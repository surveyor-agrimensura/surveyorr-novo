import type {Feature,Geometry,GeoJsonProperties} from 'geojson';
import {toCsv,toKml} from './mapFormats';

type Geodata=Feature<Geometry,GeoJsonProperties>;
type XY=[number,number];
type ShapeRecord={id:string;name:string;paths:XY[][];category:string;municipio:string;uf:string};
const encoder=new TextEncoder();
const prj='GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]]';
const utf8=(s:string)=>encoder.encode(s);

export type ShapeTarget='seia-cefir-ba'|'sicar-car'|'sigef-incra'|'qgis-arcgis'|'other';
const SIRGAS2000='GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_Americas_2000",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6674"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4674"]]';

const pointValid=(p:unknown):p is XY=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
function close(ring:XY[]):XY[]{if(!ring.length)return ring;const [f,l]=[ring[0],ring[ring.length-1]];return f[0]===l[0]&&f[1]===l[1]?ring:[...ring,f];}
function ringArea(ring:XY[]){return ring.slice(1).reduce((a,p,i)=>a+ring[i][0]*p[1]-p[0]*ring[i][1],0);}
function records(features:Geodata[]){
 const groups=new Map<number,ShapeRecord[]>([[1,[]],[3,[]],[5,[]]]);
 for(const f of features){
  const g=f.geometry,id=String(f.id??''),name=String(f.properties?.name??'Elemento').slice(0,80);
  let code=0,paths:XY[][]=[];
  if(g.type==='Point'&&pointValid(g.coordinates)){code=1;paths=[[g.coordinates as XY]];}
  if(g.type==='LineString'&&g.coordinates.length>=2&&g.coordinates.every(pointValid)){code=3;paths=[g.coordinates as XY[]];}
  const polygonParts=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  if(polygonParts.length&&polygonParts.every(poly=>poly.every(r=>r.length>=3&&r.every(pointValid)))){
   code=5;paths=polygonParts.flatMap(poly=>poly.map((r,i)=>{
    let ring=close(r as XY[]);let clockwise=ringArea(ring)<0;
    if((i===0&&!clockwise)||(i>0&&clockwise))ring=ring.slice().reverse();
    return ring;
   }));
  }
  if(code)groups.get(code)!.push({id,name,paths,category:String(f.properties?.category||''),municipio:String(f.properties?.municipio||f.properties?.city||''),uf:String(f.properties?.uf||'')});
 }
 return groups;
}
const put32=(a:DataView,at:number,n:number,le=true)=>a.setInt32(at,n,le);
const putF64=(a:DataView,at:number,n:number)=>a.setFloat64(at,n,true);
function bounds(paths:XY[][]):[number,number,number,number]{
 const pts=paths.flat();if(!pts.length)return [0,0,0,0];
 return [Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];
}
function shapeContent(code:number,record:ShapeRecord):Uint8Array{
 const pts=record.paths.flat(),parts=record.paths;
 const size=code===1?20:44+parts.length*4+pts.length*16;
 const bytes=new Uint8Array(size),v=new DataView(bytes.buffer);put32(v,0,code);
 if(code===1){putF64(v,4,pts[0][0]);putF64(v,12,pts[0][1]);return bytes;}
 bounds(parts).forEach((n,i)=>putF64(v,4+i*8,n));put32(v,36,parts.length);put32(v,40,pts.length);
 let pointIndex=0;for(let i=0;i<parts.length;i++){put32(v,44+i*4,pointIndex);pointIndex+=parts[i].length;}
 let offset=44+parts.length*4;
 for(const [x,y] of pts){putF64(v,offset,x);putF64(v,offset+8,y);offset+=16;}
 return bytes;
}
function shapeHeader(code:number,fileSize:number,bbox:[number,number,number,number]):Uint8Array{
 const data=new Uint8Array(100),v=new DataView(data.buffer);put32(v,0,9994,false);
 put32(v,24,fileSize/2,false);put32(v,28,1000);put32(v,32,code);
 bbox.forEach((n,i)=>putF64(v,36+i*8,n));return data;
}
function vectorFiles(code:number,data:ShapeRecord[],stem:string,projection=prj,includeCpg=true,strictSeia=false):Record<string,Uint8Array>{
 const parts=data.map(r=>shapeContent(code,r));const allPts=data.flatMap(r=>r.paths.flat());
 const bbox=bounds(allPts.length?[allPts]:[]);
 const shpSize=100+parts.reduce((n,p)=>n+8+p.length,0),shxSize=100+parts.length*8;
 const shp=new Uint8Array(shpSize),shx=new Uint8Array(shxSize);
 shp.set(shapeHeader(code,shpSize,bbox));shx.set(shapeHeader(code,shxSize,bbox));
 let offset=100;
 parts.forEach((bytes,i)=>{
  const rec=new DataView(shp.buffer,offset,8);put32(rec,0,i+1,false);put32(rec,4,bytes.length/2,false);
  shp.set(bytes,offset+8);
  const idx=new DataView(shx.buffer,100+i*8,8);put32(idx,0,offset/2,false);put32(idx,4,bytes.length/2,false);
  offset+=8+bytes.length;
 });
 return {...{[`${stem}.shp`]:shp,[`${stem}.shx`]:shx,[`${stem}.dbf`]:dbf(data,strictSeia),[`${stem}.prj`]:utf8(projection)},...(includeCpg?{[`${stem}.cpg`]:utf8('UTF-8')}: {})};
}
function bytesLatin1(text:string):Uint8Array{
 // DBF dos perfis ambientais exige ANSI/Windows-1252, não UTF-8.
 const special:Record<number,number>={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};
 return new Uint8Array(Array.from(text).map(c=>{const x=c.codePointAt(0)||0;return x<=255?x:(special[x]??63);}));
}
function dbf(rows:ShapeRecord[],strictSeia=false):Uint8Array{
 const fields=strictSeia?[
  {name:'ID',type:'N',size:10,dec:0},{name:'NOME',type:'C',size:80,dec:0},{name:'CATEGORIA',type:'C',size:40,dec:0},
  {name:'MUNICIPIO',type:'C',size:60,dec:0},{name:'UF',type:'C',size:2,dec:0},
  {name:'AREA_HA',type:'N',size:18,dec:4},{name:'PERIM_M',type:'N',size:18,dec:2},{name:'VERTICES',type:'N',size:10,dec:0}
 ]:[{name:'ID',type:'C',size:32,dec:0},{name:'NOME',type:'C',size:124,dec:0}];
 const n=rows.length,head=32+fields.length*32+1,recordLen=1+fields.reduce((v,f)=>v+f.size,0);
 const out=new Uint8Array(head+n*recordLen+1),view=new DataView(out.buffer),now=new Date();
 out[0]=3;out[1]=now.getUTCFullYear()%100;out[2]=now.getUTCMonth()+1;out[3]=now.getUTCDate();
 view.setUint32(4,n,true);view.setUint16(8,head,true);view.setUint16(10,recordLen,true);out[29]=strictSeia?0x57:0;
 fields.forEach((field,i)=>{const off=32+i*32;out.set(utf8(field.name),off);out[off+11]=field.type.charCodeAt(0);out[off+16]=field.size;out[off+17]=field.dec;});out[head-1]=13;
 rows.forEach((r,i)=>{let cursor=head+i*recordLen;out[cursor++]=32;
  const shapePts=r.paths.flat();let perimeter=0,area=0;
  for(const ring of r.paths){for(let j=1;j<ring.length;j++){
   const [lngA,latA]=ring[j-1],[lngB,latB]=ring[j],rad=Math.PI/180,dLat=(latB-latA)*rad,dLon=(lngB-lngA)*rad;
   const h=Math.sin(dLat/2)**2+Math.cos(latA*rad)*Math.cos(latB*rad)*Math.sin(dLon/2)**2;perimeter+=6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
   area+=(lngB-lngA)*rad*(2+Math.sin(latA*rad)+Math.sin(latB*rad));
  }}
  const vals=strictSeia?[String(i+1),r.name,r.category,r.municipio,r.uf,(Math.abs(area)*6378137**2/2/10000).toFixed(4),perimeter.toFixed(2),String(shapePts.length)]:[r.id||String(i+1),r.name];
  fields.forEach((f,j)=>{const b=strictSeia?bytesLatin1(vals[j]):utf8(vals[j]);const slice=b.slice(0,f.size);out.fill(32,cursor,cursor+f.size);if(f.type==='N')out.set(slice,cursor+Math.max(0,f.size-slice.length));else out.set(slice,cursor);cursor+=f.size;});
 });out[out.length-1]=26;return out;
}
// ZIP 'store' sem dependência externa. CRC32 e diretório central são exigidos por leitores ZIP.
const crcTable=(()=>{const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}return table;})();
function crc32(data:Uint8Array){let c=0xffffffff;for(const x of data)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function uint16(view:DataView,i:number,n:number){view.setUint16(i,n,true);}
function uint32(view:DataView,i:number,n:number){view.setUint32(i,n,true);}
export function zipFiles(files:Record<string,Uint8Array|string>):Uint8Array{
 const entries=Object.entries(files).map(([name,input])=>{const data=typeof input==='string'?utf8(input):input;return {name:utf8(name),data,crc:crc32(data)};});
 if(entries.length>65535)throw new Error('Muitos arquivos ZIP.');
 const locals:Uint8Array[]=[],centrals:Uint8Array[]=[];let current=0;
 for(const {name,data,crc} of entries){
  const local=new Uint8Array(30+name.length+data.length),l=new DataView(local.buffer);
  uint32(l,0,0x04034b50);uint16(l,4,20);uint16(l,6,0x0800);uint16(l,8,0);uint32(l,14,crc);uint32(l,18,data.length);uint32(l,22,data.length);uint16(l,26,name.length);local.set(name,30);local.set(data,30+name.length);locals.push(local);
  const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
  uint32(c,0,0x02014b50);uint16(c,4,20);uint16(c,6,20);uint16(c,8,0x0800);uint16(c,10,0);uint32(c,16,crc);uint32(c,20,data.length);uint32(c,24,data.length);uint16(c,28,name.length);uint32(c,42,current);central.set(name,46);centrals.push(central);current+=local.length;
 }
 const centralSize=centrals.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
 uint32(e,0,0x06054b50);uint16(e,8,entries.length);uint16(e,10,entries.length);uint32(e,12,centralSize);uint32(e,16,current);
 const out=new Uint8Array(current+centralSize+end.length);let at=0;for(const x of [...locals,...centrals,end]){out.set(x,at);at+=x.length;}return out;
}
export function toShapefileZip(features:Geodata[],target:ShapeTarget='qgis-arcgis'):Uint8Array{
 const files:Record<string,Uint8Array|string>={};
 const seia=target==='seia-cefir-ba',srg=target!=='qgis-arcgis';
 let selected=features;
 if(seia){const polys=features.filter(f=>f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon');if(!polys.length)throw new Error('Selecione um polígono para o SEIA/CEFIR.');
  const perimeter=polys.find(f=>/per[ií]metro|im[oó]vel|propriedade/i.test(String(f.properties?.name||f.properties?.category||'')))||polys[0];
  if(perimeter.geometry.type==='MultiPolygon')throw new Error('O SEIA/CEFIR exige um perímetro poligonal simples.');
  selected=[perimeter];
 }
 const groups=records(selected);
 for(const [code,data] of groups)if(data.length){if(seia&&code!==5)continue;
  const prefix=seia?'shapeImovelRural':code===1?'pontos':code===3?'linhas':'poligonos';
  Object.assign(files,vectorFiles(code,data,prefix,srg?SIRGAS2000:prj,!seia,seia));
 }
 if(!Object.keys(files).length)throw new Error('Não há geometrias compatíveis com Shapefile.');

 return zipFiles(files);
}
export function toTechnicalPackage(features:Geodata[],project:Record<string,unknown>):Uint8Array{
 const collection={type:'FeatureCollection',features};
 return zipFiles({
  'geometrias.geojson':JSON.stringify(collection,null,2),
  'geometrias.kml':toKml(features),
  'geometrias.csv':toCsv(features),
  'dados_projeto.json':JSON.stringify({...project,exportedAt:new Date().toISOString()},null,2),
  'LEIA_PRIMEIRO.txt':'Pacote técnico de trabalho SURVEYOR. Inclui dados cadastrais locais e geometrias exportadas; não contém peças técnicas assinadas, ART ou certificação geodésica.\n'
 });
}
export function downloadBytes(filename:string,bytes:Uint8Array):void{
 const copy=new Uint8Array(bytes.length);copy.set(bytes);
 const blob=new Blob([copy.buffer],{type:'application/zip'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
