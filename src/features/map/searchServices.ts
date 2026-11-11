import {STATES,getMunicipalities,featureCode,normalize} from './geoData';
import {GEOSERVICES_BASE} from './geoServices';
import * as L from 'leaflet';
import type { Geometry } from 'geojson';
import type { PropertyIndex } from './indexedPropertyCache';

export type CityHit={id:string;name:string;uf:string;stateName:string};
let cityCache:Promise<CityHit[]>|null=null;
export async function searchCities(term:string):Promise<CityHit[]>{
 if(normalize(term).length<2)return [];
 if(!cityCache){cityCache=fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios',{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('IBGE indisponível');return r.json();}).then((xs:unknown)=>{
  if(!Array.isArray(xs))throw new Error('Lista municipal indisponível');
  return xs.map((x:any)=>{const state=x['regiao-imediata']?.['regiao-intermediaria']?.UF||x.microrregiao?.mesorregiao?.UF;return {id:String(x.id),name:String(x.nome),uf:String(state?.sigla||''),stateName:String(state?.nome||'')};}).filter((x:CityHit)=>x.uf);
 }).catch(e=>{cityCache=null;throw e;});}
 const names=await cityCache;const needle=normalize(term);
 return names.filter(x=>normalize(`${x.name} ${x.uf} ${x.stateName}`).includes(needle)).slice(0,45);
}
export async function municipalFeature(hit:CityHit,signal?:AbortSignal):Promise<GeoJSON.Feature>{
 const state=STATES.find(x=>x.uf===hit.uf);if(!state)throw new Error('UF desconhecida');
 try{
  const {mesh}=await getMunicipalities(state);
  if(signal?.aborted)throw new Error('Consulta cancelada.');
  const match=mesh.features.find(f=>featureCode(f.properties as Record<string,unknown>|null)===hit.id);
  if(match)return match as GeoJSON.Feature;
 }catch{if(signal?.aborted)throw new Error('Consulta cancelada.');/* fallback de malha individual */}
 if(signal?.aborted)throw new Error('Consulta cancelada.');
 let response:Response;
 try{response=await fetch(`https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${encodeURIComponent(hit.id)}?formato=application%2Fvnd.geo%2Bjson`,{cache:'force-cache',signal});}
 catch(error){if(signal?.aborted)throw new Error('Consulta cancelada.');throw error;}
 if(!response.ok)throw new Error(`IBGE não retornou o contorno de ${hit.name}.`);
 const geo=await response.json() as GeoJSON.GeoJSON;
 if(geo.type==='Feature')return geo as GeoJSON.Feature;
 if(geo.type==='FeatureCollection'&&geo.features.length)return geo.features[0];
 throw new Error('Malha municipal sem geometrias utilizáveis.');
}
export async function cityGeometry(hit:CityHit,signal?:AbortSignal){
 const geometry=L.geoJSON(await municipalFeature(hit,signal));const bounds=geometry.getBounds();if(!bounds.isValid())throw new Error('Limites municipais inválidos');
 return bounds;
}
const BAHIA_PROPERTY_LAYER='Vetor_Recortes_Tematicos:cefir_imovel_rural_limite_inema';
const BAHIA_UPSTREAM='https://geoserver.inema.ba.gov.br/geoserver/ows';
const SICAR_UPSTREAM='https://geoserver.car.gov.br/geoserver/sicar/ows';
const SCHEMA_FIELDS=['nom_imovel','nome_imovel','nm_imovel','nome_area','nom_area','nomearea','nome_sitio','nom_sitio','nome_fazenda','nom_fazenda','nome_propriedade','nom_propriedade','nm_propriedade','denominacao','denominacao_imovel','nome','cod_imovel','codigo_imovel','codigoimovel','num_sicar','numero_sicar','numero_car','registro_car','cod_car','nr_car','car','ide_imovel','id_imovel','codigo_imo','codigo_incra','cod_incra','objectid','fid','id','municipio','nom_munici','nome_municipio','municipio_nome','nommun','nom_municipio','municipio_nm','cod_municipio_ibge','cod_munici','cod_municipio','codigo_municipio','codmun','codigo_ibge','geocodigo','area','area_ha','area_ha_calc','area_hectares','area_imovel','area_total','status','situacao','situacao_imovel','condicao','tipo_imovel'];
const squish=(value:string)=>normalize(value).replace(/[^a-z0-9]/g,'');
const MUNICIPAL_CODES=['cod_municipio_ibge','codigo_municipio','codigo_ibge','cod_municipio','cod_munici','codmun','geocodigo'];
const MUNICIPAL_NAMES=['nome_municipio','municipio_nome','nom_municipio','municipio_nm','nom_munici','nommun','municipio'];
function propertySource(hit:CityHit){
 if(hit.uf==='BA')return {upstream:BAHIA_UPSTREAM,layer:BAHIA_PROPERTY_LAYER,label:'INEMA / GeoBahia WFS via SURVEYOR GeoServices'};
 if(!STATES.some(state=>state.uf===hit.uf))throw new Error(`Não há camada SICAR oficial configurada para ${hit.uf}.`);
 return {upstream:SICAR_UPSTREAM,layer:`sicar:sicar_imoveis_${hit.uf.toLowerCase()}`,label:'SICAR nacional / SFB via SURVEYOR GeoServices'};
}
// O proxy oficial tenta no máximo dois caminhos upstream (2 x 8,5 s no GeoServices).
// Um limite curto impede que uma única página mantenha a interface ocupada por minutos.
const GEO_PROXY_TIMEOUT_MS=30_000;
function timeoutSignal(ms:number){const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),ms);return {signal:ctrl.signal,clear:()=>clearTimeout(timeout)};}
async function proxy(url:URL,signal?:AbortSignal){
 const timeout=timeoutSignal(GEO_PROXY_TIMEOUT_MS);
 const controller=new AbortController();
 const abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 timeout.signal.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)controller.abort();
 try{
  const response=await fetch(`${GEOSERVICES_BASE}/wfs?target=${encodeURIComponent(url.toString())}`,{signal:controller.signal,headers:{Accept:'application/json,application/xml,*/*'}});
  const body=await response.text();
  if(!response.ok){let detail=body.trim();try{const payload=JSON.parse(body) as {error?:unknown;detail?:unknown};const summary=typeof payload.error==='string'?payload.error:'';const diagnostic=typeof payload.detail==='string'?payload.detail:'';detail=[summary,diagnostic].filter(Boolean).join(' — ')||detail;}catch{}throw new Error(detail?`Serviço WFS respondeu HTTP ${response.status}: ${detail.slice(0,500)}`:`Serviço WFS respondeu HTTP ${response.status}`);}
  return body;
 }catch(error){
  if(signal?.aborted)throw new Error('Consulta cancelada.');
  if(timeout.signal.aborted)throw new Error(`Tempo limite de ${Math.ceil(GEO_PROXY_TIMEOUT_MS/1000)} segundos ao consultar o GeoServices.`);
  throw error;
 }finally{timeout.clear();signal?.removeEventListener('abort',abort);timeout.signal.removeEventListener('abort',abort);}
}
function ringsOf(geom:Geometry|null|undefined):number[][][][]{
 if(!geom)return [];
 if(geom.type==='Polygon')return [geom.coordinates];
 if(geom.type==='MultiPolygon')return geom.coordinates;
 return [];
}
function inRing(p:number[],ring:number[][]):boolean{
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function inGeometry(p:number[],g:Geometry|null|undefined){return ringsOf(g).some(r=>inRing(p,r[0])&&!r.slice(1).some(h=>inRing(p,h)));}
export function intersectsMunicipality(property:Geometry|null|undefined,municipality:Geometry|null|undefined):boolean{
 if(!property||!municipality)return false;
 if(property.type==='Point')return inGeometry(property.coordinates,municipality);
 if(property.type==='MultiPoint')return property.coordinates.some(p=>inGeometry(p,municipality));
 // A geometria é utilizada SOMENTE na verificação; ela não vai para o cache.
 const propertyRings=ringsOf(property),cityRings=ringsOf(municipality);
 for(const polygon of propertyRings){
  for(const ring of polygon){if(ring.some(p=>inGeometry(p,municipality)))return true;}
 }
 for(const polygon of cityRings){for(const ring of polygon){if(ring.some(p=>inGeometry(p,property)))return true;}}
 return false;
}
export type VerifiedPropertyIndex={source:string;state:string;municipality:string;municipalityId:string;geometryIncluded:false;filteredByMunicipality:true;verification:'municipality-field'|'municipality-polygon';properties:Record<string,unknown>[];truncated:boolean;nextOffset?:number;lastPageIdentity?:string;resumeError?:string;generatedAt:string;fields:string[]};
type FetchPropertyIndexOptions={resume?:PropertyIndex|null;onCheckpoint?:(data:VerifiedPropertyIndex)=>Promise<void>|void};
function isRetryablePageError(error:unknown){
 const message=error instanceof Error?error.message:String(error);
 return /HTTP (?:429|502|503|504)\b|Failed to fetch|NetworkError|Load failed|network request failed|Tempo limite de \d+ segundos/i.test(message);
}
async function requestFeaturePage(url:URL,requestedSize:number,signal?:AbortSignal){
 // No máximo duas consultas por página: a segunda reduz o payload caso a fonte
 // oficial não consiga responder ao tamanho solicitado.
 const sizes=Array.from(new Set([requestedSize,Math.max(50,Math.floor(requestedSize/2))]));
 let lastError:unknown=new Error('Falha ao consultar uma página do serviço WFS.');
 for(const size of sizes){
  url.searchParams.set('MAXFEATURES',String(size));
  if(signal?.aborted)throw new Error('Download do índice cancelado.');
  try{return {size,payload:JSON.parse(await proxy(url,signal)) as {features?:Array<{properties?:Record<string,unknown>;geometry?:Geometry}>;numberMatched?:number|string}};}
  catch(error){
   if(signal?.aborted)throw new Error('Download do índice cancelado.');
   if(!isRetryablePageError(error))throw error;
   lastError=error;
  }
 }
 throw lastError;
}
/** Não armazenar um BBOX bruto como se fosse uma lista de imóveis de um município. */
export async function fetchPropertyIndex(hit:CityHit,onProgress:(n:number)=>void,signal?:AbortSignal,options:FetchPropertyIndexOptions={}):Promise<VerifiedPropertyIndex>{
 const source=propertySource(hit);
 const city=await municipalFeature(hit,signal),bounds=L.geoJSON(city).getBounds();
 if(!bounds.isValid())throw new Error('Contorno do município indisponível.');
 const describe=new URL(source.upstream);describe.searchParams.set('SERVICE','WFS');describe.searchParams.set('REQUEST','DescribeFeatureType');describe.searchParams.set('VERSION','1.0.0');describe.searchParams.set('TYPENAME',source.layer);
 const xml=await proxy(describe,signal);
 const dom=new DOMParser().parseFromString(xml,'application/xml');if(dom.querySelector('parsererror'))throw new Error('Esquema oficial inválido.');
 const fields=Array.from(dom.getElementsByTagNameNS('*','element')).map(n=>({name:n.getAttribute('name')||'',type:n.getAttribute('type')||''})).filter(x=>x.name);
 const geometryField=fields.find(x=>/(geom|shape|surface|polygon|gml)/i.test(x.type)||/^(geom|the_geom|shape|wkb_geometry)$/i.test(x.name));
 const attrs=fields.filter(x=>x!==geometryField&&!/(geom|shape|point|surface|polygon|line|multi|curve|gml)/i.test(x.type));
 const pick=attrs.filter(x=>SCHEMA_FIELDS.some(s=>squish(x.name)===squish(s))).map(x=>x.name);
 if(!pick.length)throw new Error('A camada não publicou atributos pesquisáveis. Não foi criado um índice vazio.');
 const fieldCode=attrs.find(x=>MUNICIPAL_CODES.some(s=>squish(x.name)===squish(s)));
 const fieldName=attrs.find(x=>MUNICIPAL_NAMES.some(s=>squish(x.name)===squish(s)));
 const field=fieldCode||fieldName;
 if(!field&&!geometryField)throw new Error('A fonte não permite confirmar o município de cada imóvel: índice cancelado para evitar dados de outra cidade.');
 const kind:'municipality-field'|'municipality-polygon'=field?'municipality-field':'municipality-polygon';
 // Com filtro exato, a resposta contém apenas atributos e pode ser paginada em
 // blocos maiores. A consulta espacial ainda inclui geometria e usa blocos menores.
 const pageSize=field?750:250,maxRecords=30000,maxScan=30000;
 const candidate=options.resume;
 const canResume=!!candidate&&candidate.truncated===true&&candidate.geometryIncluded===false&&candidate.filteredByMunicipality===true&&candidate.state===hit.uf&&candidate.municipalityId===hit.id&&candidate.source===source.label&&candidate.verification===kind&&candidate.fields?.join('\u0000')===pick.join('\u0000')&&Number.isSafeInteger(candidate.nextOffset)&&Number(candidate.nextOffset)>=0;
 const records:Record<string,unknown>[]=canResume?[...candidate.properties]:[];const seen=new Set(records.map(x=>JSON.stringify(x)));
 let offset=canResume?Number(candidate.nextOffset):0,requestedPageSize=pageSize,exhausted=false,limited=false,lastPageIdentity=canResume?candidate.lastPageIdentity:undefined;
 const fetchStartedAt=Date.now(),softDeadline=150_000;
 const seenPageIds=new Set<string>(lastPageIdentity?[lastPageIdentity]:[]);
 const makeIndex=(truncated:boolean,next?:number,resumeError?:string):VerifiedPropertyIndex=>({source:source.label,state:hit.uf,municipality:hit.name,municipalityId:hit.id,geometryIncluded:false,filteredByMunicipality:true,verification:kind,properties:[...records],truncated,...(next===undefined?{}:{nextOffset:next}),...(lastPageIdentity?{lastPageIdentity}:{}),...(resumeError?{resumeError}:{}),generatedAt:new Date().toISOString(),fields:pick});
 const checkpoint=async(data:VerifiedPropertyIndex)=>{await options.onCheckpoint?.(data);};
 onProgress(records.length);
 while(offset<maxScan){
  if(signal?.aborted)throw new Error('Download do índice cancelado.');
  if(Date.now()-fetchStartedAt>=softDeadline){
   const partial=makeIndex(true,offset,'A consulta foi pausada para preservar os registros já recebidos. Clique novamente para continuar.');
   await checkpoint(partial);return partial;
  }
  const url=new URL(source.upstream);url.searchParams.set('SERVICE','WFS');url.searchParams.set('VERSION','1.0.0');url.searchParams.set('REQUEST','GetFeature');url.searchParams.set('TYPENAME',source.layer);url.searchParams.set('OUTPUTFORMAT','application/json');url.searchParams.set('SRSNAME','EPSG:4326');url.searchParams.set('MAXFEATURES',String(pageSize));url.searchParams.set('STARTINDEX',String(offset));
  // Quando há um campo de município, o filtro exato é aplicado no servidor.
  // Sem esse campo, a geometria é recebida temporariamente e cruzada com a malha IBGE.
  if(field){
   const literal=fieldCode?(field.type.toLowerCase().includes('string')?`'${hit.id}'`:hit.id):`'${hit.name.replace(/'/g,"''")}'`;
   url.searchParams.set('CQL_FILTER',`${field.name} ${fieldCode?'=':'ILIKE'} ${literal}`);
   url.searchParams.set('PROPERTYNAME',Array.from(new Set([...pick,field.name])).join(','));
  }else{
   const west=bounds.getWest(),south=bounds.getSouth(),east=bounds.getEast(),north=bounds.getNorth();
   url.searchParams.set('BBOX',`${west},${south},${east},${north},EPSG:4326`);
  }
  let page:{size:number;payload:{features?:Array<{properties?:Record<string,unknown>;geometry?:Geometry}>;numberMatched?:number|string}};
  try{page=await requestFeaturePage(url,requestedPageSize,signal);}
  catch(error){
   if(signal?.aborted)throw new Error('Download do índice cancelado.');
   if(!records.length)throw error;
   const partial=makeIndex(true,offset,error instanceof Error?error.message:String(error));
   await checkpoint(partial);onProgress(records.length);return partial;
  }
  const payload=page.payload;
  if(!Array.isArray(payload.features))throw new Error('O WFS não retornou feições JSON válidas.');
  const pageIdentity=JSON.stringify(payload.features.slice(0,2).map(x=>[x.properties,x.geometry?.type]));if(payload.features.length&&seenPageIds.has(pageIdentity))throw new Error('O serviço WFS repetiu uma página de dados; confira a paginação da fonte oficial.');seenPageIds.add(pageIdentity);
  for(const f of payload.features){
   if(!f.properties)continue;
   if(field){
    const actual=String(f.properties[field.name]??'');
    if(fieldCode?actual.replace(/\D/g,'')!==hit.id:normalize(actual)!==normalize(hit.name))continue;
   }else if(!intersectsMunicipality(f.geometry,city.geometry))continue;
   else if(f.geometry){const polygons=ringsOf(f.geometry),points=polygons.flatMap(poly=>poly[0]||[]);if(points.length){const center=[points.reduce((n,p)=>n+p[0],0)/points.length,points.reduce((n,p)=>n+p[1],0)/points.length];if(!inGeometry(center,city.geometry))continue;}}
   // Guardar exclusivamente atributos oficiais; nunca guardar geometrias neste índice.
   const props=Object.fromEntries(pick.filter(k=>k in f.properties!).map(k=>[k,f.properties![k]]));
   if(Object.keys(props).length){const unique=JSON.stringify(props);if(!seen.has(unique)){seen.add(unique);records.push(props);}}
   if(records.length>=maxRecords)break;
  }
  const received=payload.features.length;offset+=received;requestedPageSize=page.size;lastPageIdentity=pageIdentity;
  onProgress(records.length);
  await checkpoint(makeIndex(true,offset));
  if(records.length>=maxRecords||offset>=maxScan){limited=true;break;}
  if(!received){exhausted=true;break;}
  const matched=Number(payload.numberMatched);
  if(Number.isFinite(matched)&&matched>0?offset>=matched:received<page.size){exhausted=true;break;}
 }
 return makeIndex(!exhausted||limited,undefined);
}
