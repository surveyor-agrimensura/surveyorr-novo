import 'leaflet/dist/leaflet.css';
import './map.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Layers, Minus, Plus, Search, X, MapPinned } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as L from 'leaflet';
import { featureCode, getMunicipalities, getStates, normalize, STATES, type Municipality, type State } from './geoData';
import { clearStaleLeafletRotationRecovery, recoverFromStaleLeafletRotation } from './territorialMapRecovery';
import type { Feature, Geometry } from 'geojson';

const styleDefault:L.PathOptions={color:'#edf2f7',weight:1.1,fillColor:'#b6c1cb',fillOpacity:1};
const styleCity:L.PathOptions={color:'#eef3f5',weight:.8,fillColor:'#aabcc7',fillOpacity:1};
const activeStyle:L.PathOptions={color:'#ffffff',weight:2.1,fillColor:'#2185c7',fillOpacity:1};
const getPath=(layer:L.Layer)=>layer as L.Path;
const getBounds=(layer:L.Layer)=> (layer as L.Polygon).getBounds();
function errorText(error:unknown){return error instanceof Error?error.message:'Não foi possível carregar os limites.';}

export function TerritorialNavigator(){
 const navigate=useNavigate();
 const elementRef=useRef<HTMLDivElement>(null);
 const mapRef=useRef<L.Map|null>(null);
 const statesRef=useRef<L.GeoJSON|null>(null);
 const stateIndex=useRef(new Map<string,L.Layer>());
 const citiesRef=useRef<L.GeoJSON|null>(null);
 const cityIndex=useRef(new Map<string,{layer:L.Layer;name:string}>());
 const [selected,setSelected]=useState<State|null>(null);
 const [municipalities,setMunicipalities]=useState<Array<{id:string;name:string}>>([]);
 const [search,setSearch]=useState('');
 const [focus,setFocus]=useState(false);
 const [loading,setLoading]=useState('Carregando mapa do Brasil...');
 const [error,setError]=useState('');
 const [hovered,setHovered]=useState('');
 const [retry,setRetry]=useState(0);
 const selectedRef=useRef<State|null>(null);
 const requestRef=useRef(0);
 const goToMunicipality=useCallback((city:Municipality)=>{
   sessionStorage.setItem('surveyor-map-place-v1',JSON.stringify(city));
   sessionStorage.removeItem('surveyor-map-last-view-v1');
   navigate('/mapa/trabalho/',{state:city});
 },[navigate]);
 const pickCity=useCallback((id:string)=>{
  const current=selectedRef.current; const item=cityIndex.current.get(id); const map=mapRef.current;
  if(!current||!item||!map)return;
  const center=getBounds(item.layer).getCenter();
  goToMunicipality({id,name:item.name,uf:current.uf,stateName:current.name,center:[center.lat,center.lng]});
 },[goToMunicipality]);
 const chooseState=useCallback(async(state:State)=>{
  const map=mapRef.current;
  if(!map)return;
  selectedRef.current=state;setSelected(state);setSearch('');setFocus(false);setMunicipalities([]);setHovered('');setError('');
  const token=++requestRef.current;
  const stateLayer=stateIndex.current.get(state.id);
  if(stateLayer){const bounds=getBounds(stateLayer);if(bounds.isValid())map.flyToBounds(bounds,{padding:[38,38],maxZoom:7.6,duration:.55});}
  if(statesRef.current){map.removeLayer(statesRef.current);}
  if(citiesRef.current){map.removeLayer(citiesRef.current);citiesRef.current=null;}
  cityIndex.current.clear();setLoading(`Carregando municípios de ${state.name}...`);
  try{
   const {mesh,names}=await getMunicipalities(state);
   if(token!==requestRef.current||!mapRef.current)return;
   const items:Array<{id:string;name:string}>=[];
   const geo=L.geoJSON(mesh,{style:()=>({...styleCity}),onEachFeature(feature,layer){
    const id=featureCode(feature.properties as Record<string,unknown>);
    const name=names.get(id)||String(feature.properties?.nome||feature.properties?.name||`Município ${id}`);
    items.push({id,name});cityIndex.current.set(id,{layer,name});
    layer.bindTooltip(name,{sticky:true,direction:'top',className:'surveyor-territorial-tooltip'});
    layer.on('mouseover',()=>getPath(layer).setStyle(activeStyle));
    layer.on('mouseout',()=>getPath(layer).setStyle(styleCity));
    layer.on('click',()=>pickCity(id));
   }}).addTo(map);
   citiesRef.current=geo;setMunicipalities(items.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')));
   setLoading('');
   if(geo.getBounds().isValid())map.fitBounds(geo.getBounds(),{padding:[48,48],maxZoom:7.4});
  }catch(e){if(token!==requestRef.current)return;setLoading('');setError(`Falha ao carregar os municípios. ${errorText(e)}`);}
 },[pickCity]);
 const goBack=()=>{
  ++requestRef.current;selectedRef.current=null;setSelected(null);setMunicipalities([]);setHovered('');setSearch('');setError('');setLoading('');
  const map=mapRef.current;if(!map)return;
  if(citiesRef.current){map.removeLayer(citiesRef.current);citiesRef.current=null;cityIndex.current.clear();}
  if(statesRef.current){statesRef.current.addTo(map);map.fitBounds(statesRef.current.getBounds(),{padding:[36,36]});}
 };
 useEffect(()=>{
  if(!elementRef.current)return;
  const map=L.map(elementRef.current,{zoomControl:false,attributionControl:false,preferCanvas:true,zoomSnap:.25,minZoom:3,maxZoom:13,zoomAnimation:true,scrollWheelZoom:true,dragging:false});
  mapRef.current=map;map.setView([-14.3,-52.5],4);
  let alive=true;
  getStates().then(geo=>{
   if(!alive)return;
   const layer=L.geoJSON(geo,{style:()=>({...styleDefault}),onEachFeature(feature:Feature<Geometry>,node){
    const id=featureCode(feature.properties as Record<string,unknown>).padStart(2,'0').slice(0,2);
    const state=STATES.find(s=>s.id===id);
    if(!state)return;
    stateIndex.current.set(id,node);
    node.bindTooltip(`${state.name} (${state.uf})`,{sticky:true,direction:'top',className:'surveyor-territorial-tooltip'});
    node.on('mouseover',()=>{getPath(node).setStyle(activeStyle);setHovered(state.name);});
    node.on('mouseout',()=>{getPath(node).setStyle(styleDefault);setHovered('');});
    node.on('click',()=>{void chooseState(state);});
   }}).addTo(map);
   statesRef.current=layer;
   if(layer.getBounds().isValid())map.fitBounds(layer.getBounds(),{padding:[38,40],animate:false});
   clearStaleLeafletRotationRecovery({getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)});
   setLoading('');setError('');
  }).catch(e=>{
   if(!alive)return;
   const recovered= recoverFromStaleLeafletRotation(e,{getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)},()=>window.location.reload());
   if(recovered)return;
   setLoading('');setError(`Não foi possível abrir o Brasil. ${errorText(e)}`);
  });
  return()=>{alive=false;++requestRef.current;mapRef.current=null;statesRef.current=null;citiesRef.current=null;stateIndex.current.clear();cityIndex.current.clear();map.remove();};
 },[chooseState,retry]);
 const matches=useMemo(()=>{
  if(!search.trim())return [];
  const n=normalize(search);
  if(selected)return municipalities.filter(x=>normalize(x.name).includes(n)).slice(0,10);
  const results=STATES.filter(x=>normalize(x.name).includes(n)||normalize(x.uf)===n);
  const rank=(state:State)=>normalize(state.uf)===n?0:normalize(state.name)===n?1:normalize(state.name).startsWith(n)?2:3;
  return results.sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name,'pt-BR')).slice(0,10);
 },[search,selected,municipalities]);
 const submitSearch=()=>{
  const first=matches[0]; if(!first)return;
  if(selected)pickCity(first.id);else void chooseState(first as State);
 };
 return <main className="territorial-screen" aria-label="Seleção territorial do Brasil">
  <div className="territorial-map" ref={elementRef} />
   <button className="territorial-home-return" type="button" aria-label="Voltar à página inicial" title="Voltar ao início" onClick={()=>navigate('/')}><ArrowLeft size={19}/></button>
  {selected&&<button className="territorial-back" type="button" onClick={goBack}><ArrowLeft size={16}/> Brasil <ChevronRight size={14}/> <b>{selected.name}</b></button>}
  <div className="territorial-search"><span className="territorial-search-badge">{selected?'MUNICÍPIO':'ESTADO'}</span><input aria-label={selected?'Pesquisar município':'Pesquisar estado'} placeholder={selected?'Digite o nome do município':'Digite o nome do estado ou UF'} value={search} onChange={e=>{setSearch(e.target.value);setFocus(true);}} onFocus={()=>setFocus(true)} onKeyDown={e=>{if(e.key==='Enter')submitSearch();if(e.key==='Escape')setFocus(false);}}/><button aria-label="Pesquisar" type="button" onClick={submitSearch}><Search size={19}/></button>
   {focus&&search&&<div className="territorial-suggestions">{matches.length?matches.map(item=><button key={item.id} type="button" onClick={()=>{if(selected)pickCity(item.id);else void chooseState(item as State);}}><MapPinned size={15}/><span>{'uf' in item?`${item.name} · ${item.uf}`:`${item.name} · ${selected?.uf}`}</span><ChevronRight size={14}/></button>):<p>Nenhum resultado encontrado.</p>}</div>}
  </div>
  {selected&&<div className="territorial-city-count"><Layers size={15}/>{municipalities.length?`${municipalities.length} municípios`:'Selecionando estado'}</div>}
  {(loading||error)&&<div className="territorial-status" role="status">{loading?<span className="loader"/>:<X size={16}/>}<span>{error||loading}</span>{error&&<button type="button" onClick={()=>{if(selected)void chooseState(selected);else setRetry(n=>n+1);}}>Tentar novamente</button>}</div>}
  {hovered&&!selected&&<div className="territorial-hover-hint">{hovered}</div>}
  <div className="territorial-zoom"><button type="button" aria-label="Aproximar" onClick={()=>mapRef.current?.zoomIn()}><Plus size={19}/></button><button type="button" aria-label="Afastar" onClick={()=>mapRef.current?.zoomOut()}><Minus size={19}/></button></div>
 </main>;
}
