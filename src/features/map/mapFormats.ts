import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
export type Geodata=Feature<Geometry,GeoJsonProperties>;
function esc(s:unknown){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]||c));}
function segments(g:Geometry):string[]{
 const coords=(points:number[][])=>points.map(p=>`${p[0]},${p[1]}`).join(' ');
 const ring=(points:number[][],inner=false)=>`<${inner?'innerBoundaryIs':'outerBoundaryIs'}><LinearRing><coordinates>${coords(points)}</coordinates></LinearRing></${inner?'innerBoundaryIs':'outerBoundaryIs'}>`;
 const polygon=(parts:number[][][])=>`<Polygon>${parts.map((r,i)=>ring(r,i>0)).join('')}</Polygon>`;
 if(g.type==='Polygon')return [polygon(g.coordinates)];
 if(g.type==='MultiPolygon')return [`<MultiGeometry>${g.coordinates.map(polygon).join('')}</MultiGeometry>`];
 if(g.type==='Point')return [`<Point><coordinates>${coords([g.coordinates])}</coordinates></Point>`];
 if(g.type==='LineString')return [`<LineString><tessellate>1</tessellate><coordinates>${coords(g.coordinates)}</coordinates></LineString>`];
 return [];
}

export function toKml(features:Geodata[]){
 const placemarks=features.map((f,i)=>segments(f.geometry).map(g=>`<Placemark><name>${esc(f.properties?.name||`Elemento ${i+1}`)}</name>${g}</Placemark>`).join('')).join('');
 return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>SURVEYOR</name>${placemarks}</Document></kml>`;
}
function csv(s:unknown){return `"${String(s??'').replace(/"/g,'""')}"`;}
function csvText(s:unknown){const value=String(s??'');const formula=/^[\u0000-\u0020\u00a0\u2000-\u200f\u2028\u2029\ufeff]*[=+\-@]/.test(value);return csv(formula||value.startsWith("'")?`'${value}`:value);}
export function toCsv(features:Geodata[]){
 return '\ufeffid;nome;tipo;latitude;longitude;coordenadas_geojson;surveyor_export_version\r\n'+features.map((f,i)=>{
  const p=f.geometry.type==='Point'?f.geometry.coordinates:[];
  const coords='coordinates' in f.geometry ? f.geometry.coordinates : f.geometry.geometries.map(g=>'coordinates' in g?g.coordinates:null);
  return [csvText(f.id??i+1),csvText(f.properties?.name??''),csv(f.geometry.type),csv(p[1]??''),csv(p[0]??''),csv(JSON.stringify(coords)),csv('1')].join(';');
 }).join('\r\n');
}
function parseCsvRows(text:string,delimiter:string):string[][]{
 const rows:string[][]=[];let row:string[]=[];let field='';let quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}
   else quoted=!quoted;
  }else if(char===delimiter&&!quoted){row.push(field);field='';}
  else if((char==='\n'||char==='\r')&&!quoted){
   if(char==='\r'&&text[i+1]==='\n')i++;
   row.push(field);rows.push(row);row=[];field='';
  }else field+=char;
 }
 if(field.length||row.length){row.push(field);rows.push(row);}
 return rows;
}
function detectCsvDelimiter(header:string):string{
 let quoted=false,commas=0,semicolons=0;
 for(let i=0;i<header.length;i++){
  const char=header[i];
  if(char==='"'){
   if(quoted&&header[i+1]==='"'){i++;continue;}
   quoted=!quoted;
  }else if(!quoted&&char===',')commas++;
  else if(!quoted&&char===';')semicolons++;
 }
 return semicolons>commas?';':',';
}
export function downloadText(filename:string,content:string,mime:string){
 const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function kmlCoordinates(raw:string|null|undefined):number[][]|null{
 const values=String(raw||'').trim().split(/\s+/).filter(Boolean);
 if(!values.length)return null;
 const numeric=/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/;
 const points:number[][]=[];
 for(const value of values){
  const parts=value.split(',');
  if(parts.length<2||parts.length>3||!numeric.test(parts[0])||!numeric.test(parts[1]))return null;
  if(parts[2]&& !numeric.test(parts[2]))return null;
  const longitude=Number(parts[0]),latitude=Number(parts[1]);
  if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>90)return null;
  points.push([longitude,latitude]);
 }
 return points;
}
function closedKmlRing(points:number[][]|null):number[][]|null{
 if(!points||points.length<3)return null;
 const ring=points.map(point=>[point[0],point[1]]);
 if(ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1])ring.push([...ring[0]]);
 return new Set(ring.slice(0,-1).map(point=>`${point[0]},${point[1]}`)).size>=3?ring:null;
}
function kmlPolygonCoordinates(element:Element):number[][][]|null{
 const outer=element.getElementsByTagName('outerBoundaryIs')[0]?.getElementsByTagName('coordinates')[0]?.textContent;
 const outerRing=closedKmlRing(kmlCoordinates(outer));
 if(!outerRing)return null;
 const boundaries=Array.from(element.getElementsByTagName('innerBoundaryIs'));
 const holes=boundaries.map(boundary=>closedKmlRing(kmlCoordinates(boundary.getElementsByTagName('coordinates')[0]?.textContent)));
 if(holes.some(ring=>!ring))return null;
 return [outerRing,...holes as number[][][]];
}
export function kmlFeatures(text:string):Geodata[]{
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.querySelector('parsererror'))throw new Error('KML inválido.');
 const out:Geodata[]=[];
 for(const p of Array.from(doc.getElementsByTagName('Placemark'))){
  const name=p.getElementsByTagName('name')[0]?.textContent||'';
  const polygons=Array.from(p.getElementsByTagName('Polygon')).map(kmlPolygonCoordinates).filter((rings):rings is number[][][]=>Boolean(rings));
  if(polygons.length){
   const geometry:Geometry=polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
   out.push({type:'Feature',id:crypto.randomUUID(),geometry,properties:{name,source:'KML importado'}});
   continue;
  }
  const line=p.getElementsByTagName('LineString')[0];
 const linePoints=kmlCoordinates(line?.getElementsByTagName('coordinates')[0]?.textContent);
 if(linePoints&&linePoints.length>=2){out.push({type:'Feature',id:crypto.randomUUID(),geometry:{type:'LineString',coordinates:linePoints},properties:{name,source:'KML importado'}});continue;}
  const point=p.getElementsByTagName('Point')[0];
  const pointCoordinates=kmlCoordinates(point?.getElementsByTagName('coordinates')[0]?.textContent);
  if(pointCoordinates?.length)out.push({type:'Feature',id:crypto.randomUUID(),geometry:{type:'Point',coordinates:pointCoordinates[0]},properties:{name,source:'KML importado'}});
 }
 return out;
}
/** CSV simples: coluna latitude e longitude, separador ponto-e-vírgula ou vírgula. */
export function csvFeatures(text:string):Geodata[]{
 const input=text.replace(/^\ufeff/,'');const firstLine=input.split(/\r?\n/,1)[0]||'';const delimiter=detectCsvDelimiter(firstLine);
 const rows=parseCsvRows(input,delimiter);const headers=(rows.shift()||[]).map(h=>h.trim().toLowerCase());
 const id=headers.indexOf('id'),type=headers.indexOf('tipo'),coordinates=headers.indexOf('coordenadas_geojson'),version=headers.indexOf('surveyor_export_version');
 const lat=headers.findIndex(x=>['latitude','lat'].includes(x)),lng=headers.findIndex(x=>['longitude','lon','lng'].includes(x));
 if(lat<0||lng<0)throw new Error('CSV deve conter colunas latitude e longitude.');
 const name=headers.findIndex(x=>['nome','name','ponto'].includes(x));
 return rows.slice(0,3000).flatMap((v):Geodata[]=>{
 const surveyorExport=id>=0&&type>=0&&coordinates>=0&&version>=0&&v[version]?.trim()==='1';
 const y=Number(v[lat]?.trim()),x=Number(v[lng]?.trim());
  if(!Number.isFinite(y)||!Number.isFinite(x)||Math.abs(y)>90||Math.abs(x)>180)return [];
  const importedName=name>=0?v[name]?.trim()??'':'Ponto CSV';
  const safeName=surveyorExport?(importedName.startsWith("''")?importedName.slice(1):/^'[\u0000-\u0020\u00a0\u2000-\u200f\u2028\u2029\ufeff]*[=+\-@]/.test(importedName)?importedName.slice(1):importedName):importedName;
  return [{type:'Feature',id:crypto.randomUUID(),geometry:{type:'Point',coordinates:[x,y]},properties:{name:safeName,source:'CSV importado'}}];
 });
}
