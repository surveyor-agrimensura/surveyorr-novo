/** Consulta geográfica oficial do CAR/SICAR e de nomes de imóveis no CEFIR.
 * Não confundir índice local sem geometria com um resultado localizado no mapa.
 */
import type {Feature,Geometry} from 'geojson';
import {GEOSERVICES_BASE} from './geoServices';
import {municipalFeature,intersectsMunicipality,type CityHit} from './searchServices';
import {normalize} from './geoData';
import {propertyMatches} from './propertySearch';

export type OfficialPropertyResult={id:string;name:string;car:string;municipality:string;source:string;feature:Feature<Geometry,Record<string,unknown>>};
const SICAR='https://geoserver.car.gov.br/geoserver/sicar/ows';
const CEFIR='https://geoserver.inema.ba.gov.br/geoserver/ows';
const CEFIR_LAYER='Vetor_Recortes_Tematicos:cefir_imovel_rural_limite_inema';
const CAR_KEYS=['cod_imovel','codigo_imovel','codigoimovel','num_sicar','numero_sicar','numero_car','registro_car','cod_car','nr_car','car'];
const NAME_KEYS=['nomearea','nome_area','nom_area','nom_imovel','nome_imovel','nm_imovel','denominacao','denominacao_imovel','nome_sitio','nome_fazenda','nome_propriedade','nm_propriedade','nome'];
const CITY_CODE_KEYS=['cod_municipio_ibge','cod_munici','cod_municipio','codigo_municipio','codmun','codigo_ibge','geocodigo'];
const CITY_NAME_KEYS=['municipio','nom_munici','nome_municipio','municipio_nome','nom_municipio','municipio_nm'];
const normCode=(v:unknown)=>String(v??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const field=(obj:Record<string,unknown>,names:string[]):string=>{
 const keys=Object.keys(obj),hit=names.map(n=>keys.find(k=>k.toLowerCase()===n)).find(Boolean);
 return hit?String(obj[hit]??'').trim():'';
};
export const normalizeCar=(value:string):string=>{
 const v=normCode(value); const m=v.match(/^([A-Z]{2})(\d{7})([A-Z0-9]{32})$/);
 return m?`${m[1]}-${m[2]}-${m[3]}`:'';
};
export const carState=(value:string)=>normalizeCar(value).slice(0,2);
export function carFromProperties(properties:Record<string,unknown>){return field(properties,CAR_KEYS);}
const isPolygon=(g:Geometry|null|undefined):g is Extract<Geometry,{type:'Polygon'|'MultiPolygon'}>=>!!g&&(g.type==='Polygon'||g.type==='MultiPolygon');
function asResults(payload:unknown,source:string):OfficialPropertyResult[]{
 const list=(payload as {features?:unknown[]}|null)?.features;
 if(!Array.isArray(list))throw new Error('O serviço oficial não retornou feições válidas.');
 return list.flatMap((candidate,i)=>{
  if(!candidate||typeof candidate!=='object')return [];
  const f=candidate as Feature<Geometry,Record<string,unknown>>;
  if(f.type!=='Feature'||!isPolygon(f.geometry)||!Array.isArray(f.geometry.coordinates)||!f.geometry.coordinates.length)return [];
  const props=f.properties||{};
  return [{id:String(f.id??carFromProperties(props)??i),car:carFromProperties(props),name:field(props,NAME_KEYS)||'Imóvel rural sem denominação',municipality:field(props,CITY_NAME_KEYS),source,feature:f}];
 });
}
function makeUrl(base:string,layer:string,filter:string,max=50,bbox?:string){
 const url=new URL(base);
 Object.entries({SERVICE:'WFS',VERSION:'1.0.0',REQUEST:'GetFeature',TYPENAME:layer,OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',MAXFEATURES:String(max),CQL_FILTER:filter}).forEach(([k,v])=>url.searchParams.set(k,v));
 if(bbox)url.searchParams.set('BBOX',bbox);
 return url;
}
async function readWfs(url:URL,signal?:AbortSignal):Promise<unknown>{
 const sources=[`${GEOSERVICES_BASE}/wfs?target=${encodeURIComponent(url.toString())}`,url.toString()];
 let error:unknown;
 for(const source of sources){
  if(signal?.aborted)throw new Error('Consulta cancelada.');
  const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
   const response=await fetch(source,{signal:controller.signal,credentials:'omit',cache:'no-store',headers:{Accept:'application/json,application/geo+json,application/xml'}});
   if(!response.ok)throw new Error(`Consulta oficial HTTP ${response.status}`);
   const text=await response.text();
   if(text.length>8_000_000)throw new Error('Resposta geográfica excedeu o limite de segurança.');
   const data=JSON.parse(text) as {exceptions?:unknown;features?:unknown[]};
   if(!Array.isArray(data?.features))throw new Error('O serviço não retornou GeoJSON (verifique a disponibilidade do SICAR/INEMA).');
   return data;
  }catch(e){if(signal?.aborted)throw new Error('Consulta cancelada.');error=e;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 throw error instanceof Error?error:new Error('Serviço público indisponível.');
}
/** Exige correspondência cadastral exata; não usa o primeiro FID devolvido pelo GeoServer. */
export async function findPropertyByCar(input:string,signal?:AbortSignal):Promise<OfficialPropertyResult>{
 const canonical=normalizeCar(input);
 if(!canonical)throw new Error('Informe o CAR completo: UF, 7 dígitos do município e 32 caracteres do registro.');
 const uf=canonical.slice(0,2),compact=normCode(canonical);
 const dotted=canonical.slice(0,11)+canonical.slice(11).match(/.{1,4}/g)!.join('.');
 const targets=[{base:SICAR,layer:`sicar:sicar_imoveis_${uf.toLowerCase()}`,source:'SICAR / SFB'}];
 if(uf==='BA')targets.push({base:CEFIR,layer:CEFIR_LAYER,source:'CEFIR / INEMA'});
 let lastError:unknown=null;
 for(const target of targets){
  for(const key of (target.source.startsWith('SICAR')?['cod_imovel']:['cod_imovel','numero_car'])){
   for(const value of [canonical,dotted,compact]){
    try{
     const url=makeUrl(target.base,target.layer,`${key}='${value}'`,4);
     const list=asResults(await readWfs(url,signal),target.source);
     const match=list.find(x=>normCode(x.car)===compact);
     if(match)return match;
    }catch(e){lastError=e;if(signal?.aborted)throw e;}
   }
  }
 }
 if(lastError)throw new Error(`Nenhuma geometria confirmada para esse CAR. ${lastError instanceof Error?lastError.message:''}`.trim());
 throw new Error('O CAR não foi localizado nas camadas oficiais consultadas. Confira o código e a situação cadastral.');
}
type WfsSchema={names:string[];cityCodes:string[];cityNames:string[]};
const schemaCache=new Map<string,WfsSchema>();
async function schema(source:string,layer:string,signal?:AbortSignal):Promise<WfsSchema>{
 const key=`${source}:${layer}`;
 const cached=schemaCache.get(key);if(cached)return cached;
 {
  const url=new URL(source);url.searchParams.set('SERVICE','WFS');url.searchParams.set('VERSION','1.0.0');url.searchParams.set('REQUEST','DescribeFeatureType');url.searchParams.set('TYPENAME',layer);
  const proxy=`${GEOSERVICES_BASE}/wfs?target=${encodeURIComponent(url.toString())}`;
  for(const dest of [proxy,url.toString()]){
   if(signal?.aborted)throw new Error('Consulta cancelada.');
   const ctrl=new AbortController(),abort=()=>ctrl.abort(),timer=setTimeout(()=>ctrl.abort(),6000);
   signal?.addEventListener('abort',abort,{once:true});
   try{
    const r=await fetch(dest,{signal:ctrl.signal,cache:'no-store'});if(!r.ok)continue;
    const xml=new DOMParser().parseFromString(await r.text(),'application/xml');
    if(xml.querySelector('parsererror'))continue;
    const attrs=[...xml.getElementsByTagNameNS('*','element')].map(e=>e.getAttribute('name')||'').filter(Boolean);
    const available=(keys:string[])=>keys.flatMap(k=>attrs.filter(a=>a.toLowerCase()===k));
    const names=available(NAME_KEYS);if(names.length){const result={names,cityCodes:available(CITY_CODE_KEYS),cityNames:available(CITY_NAME_KEYS)};schemaCache.set(key,result);return result;}
   }catch{if(signal?.aborted)throw new Error('Consulta cancelada.');/* outro endpoint */}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  return {names:NAME_KEYS.slice(0,6),cityCodes:[],cityNames:[]};
 }
}
function queryTokens(query:string):string[]{
 const insignificant=new Set(['sitio','fazenda','chacara','de','da','do','das','dos','o','a','e']);
 const words=normalize(query).replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
 const meaningful=words.filter(w=>w.length>=2&&!insignificant.has(w));
 return (meaningful.length?meaningful:words).slice(0,5);
}
function score(item:OfficialPropertyResult,query:string){
 const name=normalize(item.name),needle=normalize(query),tokens=queryTokens(query);
 return name===needle?100:name.includes(needle)?90:tokens.every(w=>name.includes(w))?70:50;
}
function safeTerm(token:string){return token.replace(/'/g,"''").slice(0,75);}
function verifiedMunicipality(item:OfficialPropertyResult,hit:CityHit,geometry:Geometry|null){
 const props=item.feature.properties||{};
 const cityCode=field(props,CITY_CODE_KEYS).replace(/\D/g,'');
 if(cityCode&&cityCode!==hit.id)return false;
 const codeFromCar=normalizeCar(item.car).match(/^[A-Z]{2}-(\d{7})-/)?.[1];
 if(codeFromCar&&codeFromCar!==hit.id)return false;
 const cityName=field(props,CITY_NAME_KEYS);
 if(cityName&&normalize(cityName)!==normalize(hit.name))return false;
 return intersectsMunicipality(item.feature.geometry,geometry);
}
/** Consulta online com lista de geometrias selecionáveis no mesmo limite CEFIR exibido no mapa. */
export async function searchOfficialPropertiesByName(query:string,city:CityHit,signal?:AbortSignal):Promise<OfficialPropertyResult[]>{
 const tokens=queryTokens(query);
 if(query.trim().length<3||!tokens.length)throw new Error('Digite pelo menos 3 caracteres do nome do imóvel.');
 if(city.uf!=='BA')throw new Error('A pesquisa por nome integrada à camada de limites está disponível na Bahia. A consulta por CAR funciona em outras UFs.');
 const boundary=await municipalFeature(city);
 const coords=boundary.geometry;
 // BBOX espacial restringe a consulta; a geometria também é verificada após o retorno.
 const rings=(coords.type==='Polygon'?[coords.coordinates]:coords.type==='MultiPolygon'?coords.coordinates:[]).flat(2);
 const lons=rings.map(p=>p[0]),lats=rings.map(p=>p[1]);
 if(!lons.length)throw new Error('Não foi possível validar o contorno do município.');
 const bbox=`${Math.min(...lons)},${Math.min(...lats)},${Math.max(...lons)},${Math.max(...lats)},EPSG:4326`;
 const fields=await schema(CEFIR,CEFIR_LAYER,signal);
 const found=new Map<string,OfficialPropertyResult>();let lastError:unknown;let hadSuccessfulResponse=false;
  // Consultar atributos individualmente: alias inexistente não invalida todos os pedidos.
 for(const nameField of fields.names.slice(0,7)){
  if(signal?.aborted)throw new Error('Consulta cancelada.');
  for(const tolerant of [false,true]){
   const portions=tokens.map(t=>tolerant&&t.length>=4?`(${nameField} ILIKE '%${safeTerm(t.slice(0,2))}%' AND ${nameField} ILIKE '%${safeTerm(t.slice(-2))}%')`:`${nameField} ILIKE '%${safeTerm(t)}%'`);
   const filter=portions.join(' AND ');
   try{
    // Combinação com município não depende de uma coluna específica do WFS.
    const data=await readWfs(makeUrl(CEFIR,CEFIR_LAYER,filter,90,bbox),signal);hadSuccessfulResponse=true;
    for(const item of asResults(data,'CEFIR / INEMA')){
     if(!verifiedMunicipality(item,city,coords))continue;
     if(!propertyMatches(item.feature.properties||{},query)&&!tokens.every(t=>normalize(item.name).includes(t)))continue;
     // A geometria foi validada na leitura, mas o tipo GeoJSON também admite GeometryCollection.
     // Verificação explícita mantém o acesso às coordenadas seguro e tipado.
     if(!isPolygon(item.feature.geometry))continue;
     const key=normCode(item.car)||`${item.name}:${JSON.stringify(item.feature.geometry.coordinates).slice(0,80)}`;
     if(!found.has(key))found.set(key,item);
    }
    if(found.size>=30)break;
   }catch(err){lastError=err;if(signal?.aborted)throw err;}
  }
  if(found.size>0)break;
 }
 if(!found.size&&!hadSuccessfulResponse&&lastError)throw lastError instanceof Error?lastError:new Error('A consulta oficial está indisponível.');
 return [...found.values()].sort((a,b)=>score(b,query)-score(a,query)||a.name.localeCompare(b.name,'pt-BR')).slice(0,50);
}
