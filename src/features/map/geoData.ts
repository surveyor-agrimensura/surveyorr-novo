/* Malhas cartográficas simplificadas, usadas somente para navegação territorial.
   Limites e projeções técnicos dos projetos continuam sendo tratados separadamente. */
import type { FeatureCollection } from 'geojson';
export type State = { id: string; uf: string; name: string };
export const STATES: State[] = [
 ['11','RO','Rondônia'],['12','AC','Acre'],['13','AM','Amazonas'],['14','RR','Roraima'],['15','PA','Pará'],['16','AP','Amapá'],['17','TO','Tocantins'],
 ['21','MA','Maranhão'],['22','PI','Piauí'],['23','CE','Ceará'],['24','RN','Rio Grande do Norte'],['25','PB','Paraíba'],['26','PE','Pernambuco'],['27','AL','Alagoas'],['28','SE','Sergipe'],['29','BA','Bahia'],
 ['31','MG','Minas Gerais'],['32','ES','Espírito Santo'],['33','RJ','Rio de Janeiro'],['35','SP','São Paulo'],['41','PR','Paraná'],['42','SC','Santa Catarina'],['43','RS','Rio Grande do Sul'],
 ['50','MS','Mato Grosso do Sul'],['51','MT','Mato Grosso'],['52','GO','Goiás'],['53','DF','Distrito Federal']
 ].map(([id,uf,name])=>({id,uf,name}));
export type Municipality = { id: string; name: string; uf: string; stateName: string; center: [number, number] };
export const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const meshBase='https://servicodados.ibge.gov.br/api/v3/malhas';
const locBase='https://servicodados.ibge.gov.br/api/v1/localidades';
const geoParam=encodeURIComponent('application/vnd.geo+json');
const fallback='https://cdn.jsdelivr.net/gh/henriquemalvar/br-geojson@main/dist';
const promiseCache=new Map<string,Promise<FeatureCollection>>();
const localCache=new Map<string,Promise<{mesh:FeatureCollection; names:Map<string,string>}>>();
async function json(url:string):Promise<unknown>{
 const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),22000);
 try{const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json, application/vnd.geo+json'},cache:'force-cache'});
 if(!response.ok)throw new Error(`O serviço geográfico respondeu ${response.status}.`);
 return await response.json();}finally{clearTimeout(timeout);}
}
function asCollection(data:unknown):FeatureCollection{
 if(!data||typeof data!=='object'||!('features' in data)||!Array.isArray(data.features)||!data.features.length)throw new Error('O IBGE não retornou uma malha geográfica válida.');
 return data as FeatureCollection;
}
export function getStates(){
 if(!promiseCache.has('states')){
  const request=json(`${meshBase}/paises/BR?intrarregiao=UF&formato=${geoParam}&qualidade=intermediaria`)
   .catch(()=>json(`${fallback}/estados.geojson`)).then(asCollection)
   .catch(error=>{promiseCache.delete('states');throw error;});
  promiseCache.set('states',request);
 }
 return promiseCache.get('states')!;
}
export function getMunicipalities(state:State){
 if(!localCache.has(state.id)){
  const request=Promise.all([
   json(`${meshBase}/estados/${state.id}?intrarregiao=municipio&formato=${geoParam}&qualidade=minima`)
    .catch(()=>json(`${fallback}/municipios/${state.uf}.geojson`)).then(asCollection),
   json(`${locBase}/estados/${state.id}/municipios?orderBy=nome`).catch(()=>[])
  ]).then(([mesh,list])=>{
   const names=new Map<string,string>();
   if(Array.isArray(list))for(const item of list as Array<{id?:number; nome?:string}>)if(item.id&&item.nome)names.set(String(item.id),item.nome);
   for(const f of mesh.features){const props=f.properties as Record<string,unknown>|null;const id=featureCode(props);const name=String(props?.nome||props?.name||'');if(id&&name&&!names.has(id))names.set(id,name);}
   return {mesh,names};
  }).catch(error=>{localCache.delete(state.id);throw error;});
  localCache.set(state.id,request);
 }
 return localCache.get(state.id)!;
}
export function featureCode(properties:Record<string,unknown>|null|undefined){return String(properties?.codarea??properties?.id??properties?.CD_UF??properties?.CD_MUN??properties?.cd_geocuf??properties?.cd_geocmu??'');}
