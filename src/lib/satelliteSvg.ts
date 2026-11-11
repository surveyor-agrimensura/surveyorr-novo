/** Makes remote basemap tiles portable in SVG, HTML and browser print.
 * Images are embedded only when the imagery provider permits CORS. Failure is
 * explicitly returned so the UI never silently claims that a missing raster
 * was exported successfully. No external tile data is stored on the server.
 */
const embeddedTiles=new Map<string,string>();
const MAX_TILES=48;
const allowed=(url:string)=>{
 try{const u=new URL(url);return u.protocol==='https:'&&[
  'server.arcgisonline.com','tile.openstreetmap.org','tiles.maps.eox.at'
 ].includes(u.hostname);}catch{return false;}
};
function asDataUrl(blob:Blob):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Imagem indisponível'));reader.readAsDataURL(blob);
 });
}
async function loadTile(url:string){
 if(embeddedTiles.has(url))return embeddedTiles.get(url)||'';
 const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),8500);
 try{
  const response=await fetch(url,{mode:'cors',credentials:'omit',signal:abort.signal});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const type=response.headers.get('content-type')||'';
  if(!type.startsWith('image/'))throw new Error('A resposta não contém uma imagem');
  const blob=await response.blob();if(blob.size>3_000_000)throw new Error('Imagem muito grande');
  const data=await asDataUrl(blob);
  if(embeddedTiles.size>400)embeddedTiles.clear();
  embeddedTiles.set(url,data);return data;
 }finally{clearTimeout(timeout);}
}
export async function embedSvgSatellite(svg:string):Promise<{svg:string;total:number;missing:number}>{
 const urls=[...new Set([...svg.matchAll(/<image\b[^>]*\bhref="(https:\/\/[^"]+)"/g)].map(match=>match[1]).filter(allowed))];
 if(urls.length===0)return {svg,total:0,missing:0};
 const converted=new Map<string,string>();let missing=0;
 // Limit parallel requests to prevent swamping imagery servers.
 for(let start=0;start<Math.min(urls.length,MAX_TILES);start+=6){
  await Promise.all(urls.slice(start,start+6).map(async url=>{
   try{converted.set(url,await loadTile(url));}catch{missing++;}
  }));
 }
 missing+=Math.max(0,urls.length-MAX_TILES);
 const output=svg.replace(/(<image\b[^>]*\bhref=")(https:\/\/[^"]+)(")/g,(match,opening,url,closing)=>{
  const data=converted.get(url);return data?`${opening}${data}${closing}`:match;
 });
 return {svg:output,total:urls.length,missing};
}
