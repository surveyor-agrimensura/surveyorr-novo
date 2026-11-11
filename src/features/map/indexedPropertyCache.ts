/** Índices municipais sem geometria: persistência local, sem download automático. */
export type PropertyIndex={municipality:string;municipalityId?:string;state:string;geometryIncluded:false;properties:Record<string,unknown>[];truncated?:boolean;nextOffset?:number;lastPageIdentity?:string;resumeError?:string;fields?:string[];filteredByMunicipality?:boolean;verification?:'municipality-field'|'municipality-polygon';generatedAt?:string;source?:string};
const DB_NAME='surveyor-public-indices-v2',STORE='indices';
function openDB():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('Este navegador não permite armazenamento IndexedDB.'));return;}
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('Falha no banco local.'));
 });
}
const cacheKey=(uf:string,id:string)=>`${uf.toUpperCase()}:${id}`;
export const validIndex=(data:PropertyIndex|null|undefined,uf:string,id?:string):data is PropertyIndex=>!!data&&data.geometryIncluded===false&&data.filteredByMunicipality===true&&data.state.toUpperCase()===uf.toUpperCase()&&(!id||data.municipalityId===id)&&Array.isArray(data.properties);
export const resumableIndex=(data:PropertyIndex|null|undefined):data is PropertyIndex&{nextOffset:number}=>!!data&&data.truncated===true&&Number.isSafeInteger(data.nextOffset)&&Number(data.nextOffset)>=0;
export async function storeMunicipalIndex(data:PropertyIndex,id:string):Promise<void>{
 const db=await openDB();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({data,savedAt:Date.now()},cacheKey(data.state,id));
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Não foi possível armazenar o índice.'));
 });}finally{db.close();}
}
export async function readMunicipalIndex(uf:string,id:string):Promise<PropertyIndex|null>{
 const db=await openDB();
 try{return await new Promise<PropertyIndex|null>((resolve,reject)=>{
  const req=db.transaction(STORE,'readonly').objectStore(STORE).get(cacheKey(uf,id));
  req.onsuccess=()=>resolve(validIndex(req.result?.data,uf,id)?req.result.data as PropertyIndex:null);req.onerror=()=>reject(req.error);
 });}finally{db.close();}
}
export async function readMostRecentIndex(uf:string):Promise<PropertyIndex|null>{
 const db=await openDB();
 try{return await new Promise<PropertyIndex|null>((resolve,reject)=>{
  const cursor=db.transaction(STORE,'readonly').objectStore(STORE).openCursor();
  const result:{latest:{savedAt:number;data:PropertyIndex}|null}={latest:null};
  cursor.onsuccess=()=>{
   const cur=cursor.result;if(!cur){resolve(result.latest?.data||null);return;}
   const v=cur.value as {savedAt:number;data:PropertyIndex};
   if(validIndex(v.data,uf)&&(!result.latest||v.savedAt>result.latest.savedAt))result.latest=v;
   cur.continue();
  };cursor.onerror=()=>reject(cursor.error);
 });}finally{db.close();}
}
