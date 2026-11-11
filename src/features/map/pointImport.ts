/** Importação segura de coordenadas locais. Nunca pressupõe projeção de uma planilha. */
export type ImportedPoint={name:string;lat:number;lon:number};
const norm=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const num=(v:unknown)=>Number(String(v??'').trim().replace(/\s/g,'').replace(/^([-+]?\d+),(\d+)$/,'$1.$2'));
function parseRows(rows:unknown[][]):ImportedPoint[]{
 const data=rows.filter(r=>Array.isArray(r)&&r.some(x=>String(x??'').trim()));
 if(!data.length)return [];
 const headers=data[0].map(v=>norm(String(v??'')));
 const find=(patterns:string[])=>headers.findIndex(h=>patterns.some(p=>h===p));
 const latCol=find(['lat','latitude','latitudedecimal','latitude_dd','norte','y']);
 const lonCol=find(['lon','lng','longitude','longitudedecimal','leste','x']);
 const nameCol=find(['nome','name','ponto','point','id','codigo','descricao']);
 const heading=latCol>=0&&lonCol>=0;
 const results:ImportedPoint[]=[];
 for(const r of data.slice(heading?1:0)){
  if(results.length>=5000)break;
  const lat=num(r[heading?latCol:0]),lon=num(r[heading?lonCol:1]);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
  results.push({lat,lon,name:String(nameCol>=0&&heading?r[nameCol]??'':`P-${String(results.length+1).padStart(3,'0')}`).slice(0,100)});
 }
 return results;
}
function parseText(text:string){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length)return [];
 // Planilhas brasileiras usam ponto e vírgula, CSV internacional usa vírgula.
 // Não confundir vírgula decimal quando o separador é ';'.
 const separator=lines[0].includes(';')?';':lines[0].includes('\t')?'\t':lines[0].includes(',')?',':null;
 const rows=lines.map(line=>separator?line.split(separator):line.split(/\s+/));
 return parseRows(rows);
}
export async function importPointFile(file:File):Promise<ImportedPoint[]>{
 if(file.size>10*1024*1024)throw new Error('O arquivo deve ter no máximo 10 MB.');
 const extension=file.name.split('.').pop()?.toLowerCase();
 let result:ImportedPoint[]=[];
 if(extension==='xlsx'){
  const {readSheet}=await import('read-excel-file/browser');
  const rows=await readSheet(file);
  result=parseRows(rows as unknown[][]);
 }else if(extension==='geojson'||extension==='json'){
  const input=JSON.parse(await file.text());
  const features=input.type==='FeatureCollection'?input.features:input.type==='Feature'?[input]:[];
  result=features.filter((f:any)=>f?.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)).slice(0,5000).map((f:any,i:number)=>({lat:Number(f.geometry.coordinates[1]),lon:Number(f.geometry.coordinates[0]),name:String(f.properties?.name||`P-${i+1}`)})).filter((p:ImportedPoint)=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180);
 }else if(extension==='csv'||extension==='txt')result=parseText(await file.text());
 else throw new Error('Use XLSX, CSV, TXT ou GeoJSON com coordenadas geográficas WGS84.');
 if(!result.length)throw new Error('Nenhuma coordenada válida encontrada. Para planilhas, use colunas Latitude e Longitude em graus decimais WGS84.');
 return result;
}
