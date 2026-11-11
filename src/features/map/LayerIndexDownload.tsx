import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Database,Search,X} from 'lucide-react';
import {storeMunicipalIndex,readMunicipalIndex,resumableIndex} from './indexedPropertyCache';
import {searchCities,fetchPropertyIndex,type CityHit} from './searchServices';
import {withSearchDeadline} from './searchDeadline';

/** Índice municipal de atributos públicos, sem geometria. */
export function LayerIndexDownload({uf,onClose}:{uf:string;onClose:()=>void}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<CityHit[]>([]),[pending,setPending]=useState(false),[progress,setProgress]=useState(0),[message,setMessage]=useState('');
 const requestRef=useRef<AbortController|null>(null);
 useEffect(()=>()=>requestRef.current?.abort(),[]);
 useEffect(()=>{if(query.trim().length<2){setResults([]);return;}let live=true;const handle=setTimeout(()=>void searchCities(query).then(cities=>{if(live)setResults(cities.filter(city=>city.uf===uf).slice(0,30));}).catch(()=>{if(live)setMessage('A lista municipal do IBGE está indisponível.');}),250);return()=>{live=false;clearTimeout(handle);};},[query,uf]);
 const download=async(city:CityHit)=>{
  const controller=new AbortController();requestRef.current=controller;
  setPending(true);setMessage('');setProgress(0);
  try{
   const existing=await readMunicipalIndex(city.uf,city.id);
   if(controller.signal.aborted)return;
   const resume=existing&&resumableIndex(existing)?existing:null;
   const data=existing&&!existing.truncated?existing:await withSearchDeadline(signal=>fetchPropertyIndex(city,setProgress,signal,{resume,onCheckpoint:checkpoint=>storeMunicipalIndex(checkpoint,city.id)}),180_000,controller.signal);
   if(controller.signal.aborted)return;
   if(!existing||existing.truncated)await storeMunicipalIndex(data,city.id);
   setMessage(data.truncated?`Índice parcial de ${city.name}: ${data.properties.length} registros guardados no navegador. ${data.resumeError?`${data.resumeError} `:''}${resumableIndex(data)?'Clique no município novamente para retomar do ponto salvo.':'A fonte atingiu o limite de consulta; os dados permanecem no navegador.'}`:`Índice de ${city.name}: ${data.properties.length} registros públicos guardados no navegador (IndexedDB), sem download nem geometrias.`);
   }catch(e){if(!controller.signal.aborted){
    const saved=await readMunicipalIndex(city.uf,city.id).catch(()=>null);
    if(saved?.truncated){setProgress(saved.properties.length);setMessage(`Consulta interrompida. ${saved.properties.length} registros de ${city.name} ficaram guardados no navegador. ${resumableIndex(saved)?'Clique no município novamente para continuar. ':''}${e instanceof Error?e.message:'Falha ao consultar o índice oficial.'}`);}
    else setMessage(e instanceof Error?e.message:'Falha ao consultar o índice oficial.');
   }}
  finally{if(requestRef.current===controller)requestRef.current=null;if(!controller.signal.aborted)setPending(false);}
 };
 return createPortal(<div className="map-index-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="map-municipality-download" role="dialog" aria-modal="true" aria-label="Armazenar índice municipal de imóveis"><header><strong>Armazenar índice municipal · {uf}</strong><button type="button" title="Fechar" aria-label="Fechar índice municipal" onClick={onClose}><X size={17}/></button></header><p>Índice de atributos públicos sem geometria: Bahia via INEMA; demais UFs via camada oficial nacional SICAR.</p><div className="map-muni-search"><Search size={16}/><input autoFocus placeholder="Digite o município" value={query} onChange={e=>setQuery(e.target.value)} /></div><div className="map-muni-results">{results.map(city=><button disabled={pending} key={city.id} onClick={()=>void download(city)}><span>{city.name}<small>{city.uf} · {city.id}</small></span><Database size={16}/></button>)}</div>{pending&&<p>Armazenando no navegador... {progress} registros recebidos</p>}{message&&<p role="status">{message}</p>}</section></div>,document.body);
}
