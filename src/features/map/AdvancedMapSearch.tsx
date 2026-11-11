import {useEffect,useMemo,useRef,useState} from 'react';
import {Search,Database,X,MapPin,Check} from 'lucide-react';
import {cityGeometry,fetchPropertyIndex,searchCities,type CityHit} from './searchServices';
import {normalize} from './geoData';
import {propertyMatches} from './propertySearch';
import {parseMapCoordinates,type CoordinateFormat} from './coordinateParser';
import {readMunicipalIndex,storeMunicipalIndex,validIndex,resumableIndex,type PropertyIndex} from './indexedPropertyCache';
import {findPropertyByCar,searchOfficialPropertiesByName,carFromProperties,type OfficialPropertyResult} from './propertyLookup';
import type * as L from 'leaflet';
import {withSearchDeadline} from './searchDeadline';
import {FileUploadField,type UploadProgressReporter} from '../../components/FileUploadField';

function readUploadText(file:File,reportProgress:UploadProgressReporter):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onprogress=event=>{if(event.lengthComputable&&event.total>0)reportProgress(file,event.loaded,event.total);};
  reader.onerror=()=>reject(reader.error||new Error('Falha ao ler o índice.'));
  reader.onabort=()=>reject(new Error('Leitura do índice cancelada.'));
  reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('O índice não pôde ser lido.'));
  reader.readAsText(file);
 });
}

type Mode='IMÓVEL'|'CIDADE'|'CAR'|'COORDENADAS';
const modes:Mode[]=['IMÓVEL','CIDADE','CAR','COORDENADAS'];
const formats:CoordinateFormat[]=['DD','DMS','DDM','UTM','EPSG'];
function humanError(err:unknown){return err instanceof Error?err.message:'Não foi possível concluir a consulta.';}
export function AdvancedMapSearch({uf,initialCity,onBounds,onCoordinates,onProperty,onClearProperty}:{uf:string;initialCity?:CityHit|null;onBounds:(b:L.LatLngBounds)=>void;onCoordinates:(lat:number,lng:number)=>void;onProperty:(hit:OfficialPropertyResult)=>void;onClearProperty:()=>void}){
 const [mode,setMode]=useState<Mode>('CAR'),[active,setActive]=useState(false),[menu,setMenu]=useState(false);
 const [format,setFormat]=useState<CoordinateFormat>('DD'),[formatOpen,setFormatOpen]=useState(false);
 const [query,setQuery]=useState(''),[cityQuery,setCityQuery]=useState(initialCity?.name||''),[cities,setCities]=useState<CityHit[]>([]);
 const [city,setCity]=useState<CityHit|null>(initialCity||null),[index,setIndex]=useState<PropertyIndex|null>(null);
 const [results,setResults]=useState<OfficialPropertyResult[]>([]);
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[message,setMessage]=useState('');
 const [visibleCount,setVisibleCount]=useState(40);
 const root=useRef<HTMLDivElement>(null),searchInput=useRef<HTMLInputElement>(null),sequence=useRef(0),requestRef=useRef<AbortController|null>(null);
 const searchExpanded=active||menu||formatOpen;
 const cancelRequest=()=>{requestRef.current?.abort();requestRef.current=null;};
 useEffect(()=>()=>{requestRef.current?.abort();},[]);
 useEffect(()=>{
  const close=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node)){setActive(false);setMenu(false);setFormatOpen(false);}};
  const keyboard=(e:KeyboardEvent)=>{if(e.key==='Escape'){setActive(false);setMenu(false);setFormatOpen(false);}};
  document.addEventListener('pointerdown',close);document.addEventListener('keydown',keyboard);
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',keyboard);};
 },[]);
 useEffect(()=>{let alive=true;setIndex(null);if(city?.id&&city.uf===uf)void readMunicipalIndex(city.uf,city.id).then(saved=>{if(alive)setIndex(saved);}).catch(()=>{});return()=>{alive=false;};},[city?.id,city?.uf,uf]);
 const term=mode==='CIDADE'?query:mode==='IMÓVEL'?cityQuery:'';
 useEffect(()=>{
  if(normalize(term).length<2||!['CIDADE','IMÓVEL'].includes(mode)){setCities([]);return;}
  if(city&&mode==='IMÓVEL'&&normalize(city.name)===normalize(term)){setCities([]);return;}
  let live=true;
  const t=setTimeout(()=>void searchCities(term).then(list=>{if(live)setCities(list.slice(0,25));}).catch(err=>{if(live)setMessage(humanError(err));}),240);
  return()=>{live=false;clearTimeout(t);};
 },[term,mode,city,uf]);
 const selectCity=async(hit:CityHit)=>{
  const ticket=++sequence.current;cancelRequest();onClearProperty();setCity(hit);setIndex(null);setResults([]);setCityQuery(hit.name);setCities([]);setMessage('');setBusy(true);
  if(mode==='CIDADE')setQuery(`${hit.name} - ${hit.uf}`);
  const controller=new AbortController();requestRef.current=controller;
  try{
   const boundary=await withSearchDeadline(signal=>cityGeometry(hit,signal),15000,controller.signal);if(ticket!==sequence.current)return;onBounds(boundary);
   const cached=await readMunicipalIndex(hit.uf,hit.id).catch(()=>null);if(ticket!==sequence.current)return;
   if(cached){setIndex(cached);setMessage(`Município: ${hit.name}/${hit.uf}. Índice local com ${cached.properties.length} registros disponível.${cached.truncated?' O índice está parcial; use “Guardar índice no navegador” para retomar a consulta.':''}`);}
   else if(mode==='IMÓVEL')setMessage(`Município selecionado: ${hit.name}/${hit.uf}. Pesquise o nome do imóvel.`);
  }catch(err){if(ticket===sequence.current)setMessage(`Município selecionado. ${humanError(err)}`);}
  finally{if(requestRef.current===controller)requestRef.current=null;if(ticket===sequence.current)setBusy(false);}
 };
 const storeIndex=async(hit:CityHit|null=city)=>{
  if(!hit){setMessage('Selecione primeiro o município na lista.');return;}
  const ticket=++sequence.current;cancelRequest();const controller=new AbortController();requestRef.current=controller;
  setCity(hit);setCityQuery(hit.name);setBusy(true);setMessage('');setProgress(0);
  try{
   const existing=await readMunicipalIndex(hit.uf,hit.id).catch(()=>null);
   if(ticket!==sequence.current)return;
   if(existing&&!existing.truncated&&validIndex(existing,hit.uf,hit.id)){
    setIndex(existing);setMessage(`Índice completo de ${hit.name} já está guardado no navegador (${existing.properties.length} registros).`);setCities([]);return existing;
   }
   const resume=existing&&resumableIndex(existing)?existing:null;
   const data=await withSearchDeadline(signal=>fetchPropertyIndex(hit,count=>{if(ticket===sequence.current)setProgress(count);},signal,{resume,onCheckpoint:checkpoint=>storeMunicipalIndex(checkpoint,hit.id)}),180000,controller.signal);
   if(ticket!==sequence.current)return;
   await storeMunicipalIndex(data,hit.id);if(ticket!==sequence.current)return;setIndex(data);
   setMessage(data.truncated?`${data.properties.length} registros verificados de ${hit.name} guardados no navegador. Índice parcial.${data.resumeError?` ${data.resumeError}`:''}${resumableIndex(data)?' Use “Guardar índice no navegador” para retomar do ponto salvo.':' A fonte atingiu o limite de consulta.'}`:`${data.properties.length} registros verificados de ${hit.name} guardados no navegador.`);
   setCities([]);return data;
  }catch(err){
   if(ticket===sequence.current){
    const saved=await readMunicipalIndex(hit.uf,hit.id).catch(()=>null);
    if(ticket===sequence.current&&saved&&validIndex(saved,hit.uf,hit.id)){
     setIndex(saved);
     const reason=humanError(err);
     setMessage(saved.truncated?`${saved.properties.length} registros de ${hit.name} foram preservados no navegador. ${resumableIndex(saved)?'A consulta pode ser retomada pelo botão “Guardar índice no navegador”. ':''}${reason}`:`Índice completo de ${hit.name} já está guardado no navegador (${saved.properties.length} registros).`);
    }else if(ticket===sequence.current)setMessage(`Não foi possível guardar o índice: ${humanError(err)}`);
   }
  }
  finally{if(requestRef.current===controller)requestRef.current=null;if(ticket===sequence.current)setBusy(false);}
 };
 const importIndex=async(file:File,reportProgress:UploadProgressReporter)=>{
  try{
   if(file.size>30*1024*1024)throw new Error('O JSON excede 30 MB.');
   const obj=JSON.parse(await readUploadText(file,reportProgress)) as PropertyIndex;
   if(!Array.isArray(obj.properties)||obj.geometryIncluded!==false||!obj.state||!obj.filteredByMunicipality)throw new Error('Índice sem validação municipal.');
   const id=obj.municipalityId||city?.id;
   if(!id||!validIndex(obj,uf,id))throw new Error('O índice não corresponde ao município escolhido.');
   await storeMunicipalIndex(obj,id);setIndex(obj);setMessage(`Índice importado: ${obj.properties.length} registros.`);
  }catch(err){setMessage(humanError(err));throw err;}
 };
 const matches=useMemo(()=>{
  if(!index||mode!=='IMÓVEL'||results.length)return [];
  const needle=normalize(query);if(needle.length<2)return [];
  return index.properties.filter(p=>propertyMatches(p,needle));
 },[index,query,mode,results.length]);
 useEffect(()=>{setVisibleCount(40);setResults([]);},[query,city?.id,mode]);
 const chooseResult=(hit:OfficialPropertyResult)=>{onProperty(hit);setMessage(`Imóvel “${hit.name}” localizado na geometria de ${hit.source}.`);};
 const chooseCached=async(properties:Record<string,unknown>)=>{
  const code=carFromProperties(properties);
  if(!code){setMessage('Este registro municipal tem apenas atributos, sem CAR/geometria publicada. Não é possível localizar com segurança.');return;}
  cancelRequest();const ticket=++sequence.current;const controller=new AbortController();requestRef.current=controller;setBusy(true);try{const hit=await withSearchDeadline(signal=>findPropertyByCar(code,signal),25000,controller.signal);if(ticket===sequence.current)chooseResult(hit);}catch(err){if(ticket===sequence.current)setMessage(humanError(err));}finally{if(requestRef.current===controller)requestRef.current=null;if(ticket===sequence.current)setBusy(false);}
 };
 const submit=async()=>{
  const ticket=++sequence.current;
  cancelRequest();
  onClearProperty();setMessage('');setResults([]);setProgress(0);
  if(mode==='COORDENADAS'){
   try{const [lat,lon]=parseMapCoordinates(query,format);onCoordinates(lat,lon);setMessage(`Mapa centralizado em ${lat.toFixed(6)}, ${lon.toFixed(6)}.`);}
   catch(err){setMessage(humanError(err));}return;
  }
  if(mode==='CIDADE'){
   if(cities.length===1)await selectCity(cities[0]);else setMessage('Escolha a cidade na lista de resultados.');return;
  }
  const controller=new AbortController();requestRef.current=controller;
  setBusy(true);
  try{
   if(mode==='CAR'){
    const found=await withSearchDeadline(signal=>findPropertyByCar(query,signal),25000,controller.signal);
    if(ticket!==sequence.current)return;
    chooseResult(found);setResults([found]);return;
   }
   if(!city)throw new Error('Selecione primeiro o município; depois pesquise pelo nome do imóvel.');
   if(city.uf!=='BA')throw new Error(`A camada SICAR nacional de ${city.uf} publica código CAR e atributos, mas não nome de imóvel. Baixe o índice municipal ou pesquise pelo CAR completo para localizar a geometria.`);
   const found=await withSearchDeadline(signal=>searchOfficialPropertiesByName(query,city,signal),25000,controller.signal);
   if(ticket!==sequence.current)return;
   setResults(found);
   setMessage(found.length?`${found.length} imóvel(is) encontrado(s) em ${city.name}. Clique em um resultado para localizar o perímetro no mapa.`:'Nenhum imóvel correspondente encontrado na camada CEFIR consultada. Confira o nome ou tente o índice municipal.');
  }catch(err){if(ticket===sequence.current)setMessage(humanError(err)+(mode==='IMÓVEL'&&matches.length?' Os registros do índice municipal continuam disponíveis abaixo, mas não confirmam a geometria.':''));}
  finally{if(requestRef.current===controller)requestRef.current=null;if(ticket===sequence.current)setBusy(false);}
 };
 const chooseMode=(m:Mode)=>{++sequence.current;cancelRequest();onClearProperty();setBusy(false);setMode(m);setActive(true);setMenu(false);setFormatOpen(false);setQuery('');setResults([]);if(m==='IMÓVEL'&&!city){setCityQuery(initialCity?.name||'');setCity(initialCity||null);}setCities([]);setMessage('');};
 return <div ref={root} className={`map-search-container map-advanced-search ${searchExpanded?'is-expanded':''}`}>
  <button type="button" className="map-search-collapsed-trigger" aria-label={`Abrir pesquisa de ${mode}`} aria-expanded={searchExpanded} title="Abrir pesquisa" onClick={()=>{setActive(true);requestAnimationFrame(()=>searchInput.current?.focus());}}><Search size={18}/></button>
  <form className="map-operational-search" onSubmit={e=>{e.preventDefault();void submit();}}>
   <button className="map-search-mode" type="button" onClick={()=>{setActive(true);setMenu(!menu);setFormatOpen(false);}}>{mode==='COORDENADAS'?'COORD.':mode}</button>
   {mode==='COORDENADAS'&&<button className="map-coordinate-type" type="button" onClick={()=>{setActive(true);setFormatOpen(!formatOpen);setMenu(false);}}>{format}</button>}
   <input ref={searchInput} aria-label={`Pesquisar ${mode}`} onFocus={()=>setActive(true)} placeholder={mode==='COORDENADAS'?'Latitude, longitude':mode==='CIDADE'?'Nome da cidade':mode==='CAR'?'Número do CAR':'Nome do imóvel'} value={query} onChange={e=>{if(busy&&requestRef.current){++sequence.current;cancelRequest();setBusy(false);}setQuery(e.target.value);setMessage('');}}/>
   <button type="submit" title="Pesquisar" disabled={busy}><Search size={17}/></button>
  </form>
  {(active||menu||formatOpen)&&<section className="map-search-flyout" aria-label="Pesquisa do mapa">
   <header><strong>{menu?'Escolha a pesquisa':formatOpen?'Formato das coordenadas':mode==='IMÓVEL'?'Busca de imóveis rurais':mode==='CIDADE'?'Pesquisar município':mode==='CAR'?'Consulta de CAR':'Localizar coordenadas'}</strong><button aria-label="Fechar pesquisa" type="button" onClick={()=>{setActive(false);setMenu(false);setFormatOpen(false);}}><X size={14}/></button></header>
   {menu?modes.map(m=><button key={m} className={'map-search-choice '+(m===mode?'selected':'')} type="button" onClick={()=>chooseMode(m)}><strong>{m}</strong><small>{m==='IMÓVEL'?'Pesquisar por nome e localizar polígono':m==='CIDADE'?'Navegar até o município':m==='CAR'?'Localizar CAR exato no SICAR':'DD, DMS, DDM, UTM, EPSG'}</small></button>):formatOpen?formats.map(f=><button key={f} className={'map-search-choice '+(f===format?'selected':'')} type="button" onClick={()=>{setFormat(f);setFormatOpen(false);}}><strong>{f}</strong><small>{f==='DD'?'Graus decimais':f==='DMS'?'Graus, minutos e segundos':f==='DDM'?'Graus e minutos decimais':f==='UTM'?'Zona, leste e norte':'EPSG:4326 ou 4674'}</small></button>):<>
    {mode==='IMÓVEL'&&<label className="map-search-municipality"><span>Município · UF {city?.uf||uf}</span><input value={cityQuery} placeholder="Ex.: Amargosa ou Maragogi" onChange={e=>{if(busy&&requestRef.current){++sequence.current;cancelRequest();setBusy(false);}setCityQuery(e.target.value);setCity(null);setIndex(null);setResults([]);setMessage('');}}/></label>}
    {['CIDADE','IMÓVEL'].includes(mode)&&cities.length>0&&<div className="map-search-city-list" role="listbox">{cities.map(hit=><div className="map-search-city-row" key={hit.id}><button type="button" onClick={()=>void selectCity(hit)}><MapPin size={13}/><span>{hit.name} · {hit.uf}</span></button>{mode==='IMÓVEL'&&<button type="button" className="map-cache-action" disabled={busy} title="Baixar índice verificado do município" onClick={()=>void storeIndex(hit)}><Database size={14}/></button>}</div>)}</div>}
    {mode==='IMÓVEL'&&<div className="map-index-panel"><small>{index&&city&&validIndex(index,city.uf,city.id)?city.uf==='BA'?`Índice municipal: ${index.properties.length} registros locais (sem geometria). A pesquisa online localiza o polígono.`:`Índice SICAR: ${index.properties.length} registros locais (sem geometria). A camada nacional não publica nomes; use o CAR para localizar perímetros.`:city?city.uf==='BA'?`Município: ${city.name}/${city.uf}. A pesquisa por nome consulta o limite oficial.`:`Município: ${city.name}/${city.uf}. O índice SICAR será armazenado no navegador; não publica nomes de imóvel. Use o CAR completo para localizar o perímetro.`:'Escolha o município antes de pesquisar imóveis.'}</small><button type="button" className="map-search-submit-property" disabled={busy||!!city&&city.uf!=='BA'} title={city&&city.uf!=='BA'?'A camada SICAR nacional não publica nome do imóvel. Use o CAR completo.':undefined} onClick={()=>void submit()}><Search size={16}/>{busy?'Consultando…':city&&city.uf!=='BA'?'Busca por nome indisponível nesta camada':'Buscar imóveis pelo nome'}</button><div className="map-index-actions"><button type="button" disabled={busy||!city} onClick={()=>void storeIndex()}><Database size={13}/> Guardar índice no navegador</button><FileUploadField label="Importar índice JSON" accept=".json,application/json" maxBytes={30*1024*1024} description="Índice municipal validado, até 30 MB." disabled={busy} onFile={importIndex}/></div></div>}
    {mode==='CAR'&&<small className="map-index-hint">Pesquise pelo número completo do CAR. A busca consulta a geometria no SICAR, sem exigir a escolha de município.</small>}
    {results.length>0&&<div className="map-search-properties" aria-label="Imóveis encontrados"><strong>{results.length} resultado(s) com geometria</strong>{results.slice(0,visibleCount).map((hit,i)=><button className="map-found-property" type="button" key={`${hit.id}-${i}`} onClick={()=>chooseResult(hit)}><strong>{hit.name}</strong><small>{hit.municipality||city?.name||''} · {hit.source}</small>{hit.car&&<code>{hit.car}</code>}<span><MapPin size={12}/> Mostrar perímetro no mapa</span></button>)}{results.length>visibleCount&&<button type="button" className="map-search-more-results" onClick={()=>setVisibleCount(n=>n+40)}>Mostrar mais resultados</button>}</div>}
    {matches.length>0&&<div className="map-search-properties" aria-label="Índice municipal"><strong>{matches.length} registro(s) no índice local · sem geometria</strong>{matches.slice(0,visibleCount).map((p,i)=><button key={i} type="button" className="map-found-property" onClick={()=>void chooseCached(p)}><strong>{String(p.nomearea||p.nome_area||p.nome_imovel||p.nom_imovel||'Registro cadastral')}</strong>{Object.entries(p).slice(0,4).map(([k,v])=><small key={k}>{k}: {String(v)}</small>)}<span><MapPin size={12}/> Consultar geometria pelo CAR</span></button>)}{matches.length>visibleCount&&<button type="button" className="map-search-more-results" onClick={()=>setVisibleCount(n=>n+40)}>Mostrar mais resultados</button>}</div>}
    {busy&&<div className="map-search-guidance" role="status"><Database size={13}/> Consultando serviços oficiais… {progress?`${progress} registros obtidos`:''}<button type="button" onClick={()=>{++sequence.current;cancelRequest();setBusy(false);setMessage('Consulta cancelada. Nenhuma geometria foi alterada.');}}>Cancelar</button></div>}
    {message&&<p role="status" className="map-search-feedback"><Check size={13}/>{message}</p>}
   </>}
  </section>}
 </div>;
}
